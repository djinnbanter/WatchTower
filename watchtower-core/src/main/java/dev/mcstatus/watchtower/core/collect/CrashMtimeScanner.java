package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.analyze.CrashClassifier;
import dev.mcstatus.watchtower.core.analyze.CrashNarrator;
import dev.mcstatus.watchtower.core.report.StateManager;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Stream;

/**
 * Lightweight crash-reports filesystem scan using mtime/fingerprint index in state.
 * When enrich is on, changed crashes get light classify + CrashNarrator Fix fields (Z4).
 *
 * <p>Background polls use a narrate budget and must keep catching up historical folders.
 * Files missing a fingerprint ledger entry are preferred so older crashes are not starved
 * behind newest-first ordering. Weak {@code unknown} heads without a label/exception do not
 * advance the ledger (so later polls retry); manual Scan force-reenriches everything.
 */
public final class CrashMtimeScanner {

    /** Max unreviewed crashes to narrate on first empty fingerprint ledger (boot seed). */
    public static final int BOOT_SEED_UNREVIEWED_MAX = 25;

    /** Per-poll classify/narrate budget when not force-reenrichesing (historical catch-up). */
    public static final int BACKGROUND_NARRATE_BUDGET = 20;

    public record CrashEntry(
            String file,
            long mtime,
            long size,
            String displayLabel,
            boolean newOrUpdated,
            String failureKind,
            String primaryModId,
            String stallModId,
            String exception,
            String plainEnglish,
            String likelyCause,
            String confidence,
            JsonArray fixHints,
            Boolean manualReview,
            String fingerprint
    ) {
    }

    public record ScanResult(
            Instant scannedAt,
            int newCount,
            int unreviewed,
            List<CrashEntry> entries,
            Map<String, Long> updatedIndex,
            Map<String, String> updatedFingerprints
    ) {
        public ScanResult(
                Instant scannedAt,
                int newCount,
                int unreviewed,
                List<CrashEntry> entries,
                Map<String, Long> updatedIndex) {
            this(scannedAt, newCount, unreviewed, entries, updatedIndex, Map.of());
        }
    }

    private static final int PARSE_HEAD_BYTES = 32_768;
    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_OFFSET_DATE_TIME;

    private CrashMtimeScanner() {
    }

    public static ScanResult scan(String serverDir, Path statePath) throws IOException {
        return scan(serverDir, statePath, true, false);
    }

    /**
     * @param enrichHeads when false, skip classify/narrate of crash heads (kill-switch
     *                    {@code CRASH_ENRICH_ON_MTIME=false}); still indexes mtimes/unreviewed.
     */
    public static ScanResult scan(String serverDir, Path statePath, boolean enrichHeads) throws IOException {
        return scan(serverDir, statePath, enrichHeads, false);
    }

    /**
     * @param forceReenrich when true (manual dashboard Scan), re-classify every crash head even if
     *                      the fingerprint is unchanged — used to refresh labels after a jar upgrade.
     */
    public static ScanResult scan(
            String serverDir, Path statePath, boolean enrichHeads, boolean forceReenrich) throws IOException {
        Path crashDir = Path.of(serverDir, "crash-reports");
        Map<String, Long> priorIndex = StateManager.getCrashMtimeIndex(statePath);
        Map<String, String> priorFp = StateManager.getCrashFingerprintIndex(statePath);
        Map<String, Long> updatedIndex = new HashMap<>(priorIndex);
        Map<String, String> updatedFp = new HashMap<>(priorFp);
        JsonObject acks = StateManager.getAcknowledgedCrashes(statePath);
        Set<String> ackedBare = ackKeys(acks);

        List<CrashEntry> entries = new ArrayList<>();
        int newCount = 0;
        boolean emptyFpLedger = priorFp.isEmpty();

        if (Files.isDirectory(crashDir)) {
            List<Path> files;
            try (Stream<Path> stream = Files.list(crashDir)) {
                files = stream
                        .filter(p -> p.getFileName().toString().endsWith(".txt"))
                        .sorted(Comparator
                                // Prefer crashes not yet in the fingerprint ledger so historical
                                // folders catch up instead of always spending budget on newest files.
                                .comparingInt((Path p) -> priorFp.containsKey(p.getFileName().toString()) ? 1 : 0)
                                .thenComparing(Comparator.comparingLong(CrashMtimeScanner::mtimeSec).reversed()))
                        .toList();
            }

            int bootSeedLeft = emptyFpLedger ? BOOT_SEED_UNREVIEWED_MAX : 0;
            // Manual Scan re-classifies the whole folder; background polls stay budgeted.
            int narrateBudget = forceReenrich
                    ? Math.max(files.size(), 1)
                    : BACKGROUND_NARRATE_BUDGET;

            for (Path p : files) {
                String file = p.getFileName().toString();
                long mtime = mtimeSec(p);
                long size;
                try {
                    size = Files.size(p);
                } catch (IOException e) {
                    size = 0;
                }
                String fp = fingerprint(file, mtime, size);
                Long prior = priorIndex.get(file);
                String priorFinger = priorFp.get(file);
                boolean fpChanged = priorFinger == null || !priorFinger.equals(fp);
                boolean mtimeChanged = prior == null || prior != mtime;
                boolean changed = mtimeChanged || fpChanged;
                if (mtimeChanged) {
                    newCount++;
                }
                boolean unacked = !ackedBare.contains(bareKey(file));
                boolean bootSeed = enrichHeads && !forceReenrich && bootSeedLeft > 0 && unacked && priorFinger == null;
                if (bootSeed) {
                    bootSeedLeft--;
                }
                boolean shouldNarrate = enrichHeads
                        && (forceReenrich || fpChanged || bootSeed)
                        && narrateBudget > 0;
                ParsedHead head = ParsedHead.empty();
                if (shouldNarrate) {
                    head = parseCrashHead(p);
                    narrateBudget--;
                }
                entries.add(new CrashEntry(
                        file, mtime, size, head.displayLabel(), changed,
                        head.failureKind(), head.primaryModId(), head.stallModId(), head.exception(),
                        head.plainEnglish(), head.likelyCause(), head.confidence(),
                        head.fixHints(), head.manualReview(), fp));
                updatedIndex.put(file, mtime);
                // Progress the ledger only for useful heads. Pure "unknown" with no label/exception
                // must not stamp the FP — otherwise historical crashes stick as Unknown until
                // Tools → Scan now (force reenrich).
                if (shouldNarrate && headWorthRemembering(head)) {
                    updatedFp.put(file, fp);
                } else if (priorFinger != null) {
                    updatedFp.put(file, priorFinger);
                }
            }
        }

        int unreviewed = 0;
        for (CrashEntry entry : entries) {
            if (!ackedBare.contains(bareKey(entry.file()))) {
                unreviewed++;
            }
        }

        Instant scannedAt = Instant.now();
        return new ScanResult(scannedAt, newCount, unreviewed, entries, updatedIndex, updatedFp);
    }

    /**
     * Full index refresh for report reconcile — parses display labels for all files in window.
     */
    public static ScanResult scanForReconcile(String serverDir, Path statePath, double cutoffEpochSec) throws IOException {
        Path crashDir = Path.of(serverDir, "crash-reports");
        Map<String, Long> updatedIndex = new HashMap<>();
        Map<String, String> updatedFp = new HashMap<>();
        JsonObject acks = StateManager.getAcknowledgedCrashes(statePath);
        Set<String> ackedBare = ackKeys(acks);

        List<CrashEntry> entries = new ArrayList<>();

        if (Files.isDirectory(crashDir)) {
            List<Path> files;
            try (Stream<Path> stream = Files.list(crashDir)) {
                files = stream
                        .filter(p -> p.getFileName().toString().endsWith(".txt"))
                        .sorted(Comparator.comparingLong(CrashMtimeScanner::mtimeSec).reversed())
                        .toList();
            }

            for (Path p : files) {
                long mtime = mtimeSec(p);
                if (mtime < cutoffEpochSec) {
                    continue;
                }
                String file = p.getFileName().toString();
                long size;
                try {
                    size = Files.size(p);
                } catch (IOException e) {
                    size = 0;
                }
                String fp = fingerprint(file, mtime, size);
                ParsedHead head = parseCrashHead(p);
                entries.add(new CrashEntry(
                        file, mtime, size, head.displayLabel(), false,
                        head.failureKind(), head.primaryModId(), head.stallModId(), head.exception(),
                        head.plainEnglish(), head.likelyCause(), head.confidence(),
                        head.fixHints(), head.manualReview(), fp));
                updatedIndex.put(file, mtime);
                updatedFp.put(file, fp);
            }
        }

        int unreviewed = 0;
        for (CrashEntry entry : entries) {
            if (!ackedBare.contains(bareKey(entry.file()))) {
                unreviewed++;
            }
        }

        return new ScanResult(Instant.now(), 0, unreviewed, entries, updatedIndex, updatedFp);
    }

    public static String fingerprint(String file, long mtime, long size) {
        return bareKey(file) + "|" + mtime + "|" + size;
    }

    private record ParsedHead(
            String displayLabel,
            String failureKind,
            String primaryModId,
            String stallModId,
            String exception,
            String plainEnglish,
            String likelyCause,
            String confidence,
            JsonArray fixHints,
            Boolean manualReview
    ) {
        static ParsedHead empty() {
            return new ParsedHead("", null, null, null, null, null, null, null, null, null);
        }
    }

    private static ParsedHead parseCrashHead(Path crashFile) {
        try {
            byte[] head = Files.readAllBytes(crashFile);
            if (head.length > PARSE_HEAD_BYTES) {
                head = java.util.Arrays.copyOf(head, PARSE_HEAD_BYTES);
            }
            String text = new String(head, StandardCharsets.UTF_8);
            CrashClassifier.Classification classification = CrashClassifier.classifyLight(text);
            String summary = CrashReportScanner.parseCrashSummary(text);
            CrashDetails details = CrashDetails.parse(text);
            CrashReportParser.ParsedCrash deep = CrashReportParser.parse(text, List.of());
            String label = summary;
            if (label.isBlank()) {
                label = details.displayLabel();
            }
            if (label.isBlank()) {
                label = details.summary();
            }

            JsonObject crashObj = new JsonObject();
            deep.applyTo(crashObj);
            if (!crashObj.has("summary") && label != null && !label.isBlank()) {
                crashObj.addProperty("summary", label);
            }
            if (classification.failureKind() != null) {
                crashObj.addProperty("failure_kind", classification.failureKind());
            }
            if (classification.primaryModId() != null) {
                crashObj.addProperty("primary_mod_id", classification.primaryModId());
            }
            if (classification.stallModId() != null) {
                crashObj.addProperty("stall_mod_id", classification.stallModId());
            }
            crashObj.addProperty("file", crashFile.getFileName().toString());
            CrashNarrator.Narrative narrative = CrashNarrator.narrate(crashObj, new JsonArray());

            return new ParsedHead(
                    label != null ? label : "",
                    classification.failureKind(),
                    classification.primaryModId(),
                    classification.stallModId(),
                    details.exception() != null ? details.exception() : deep.exception(),
                    narrative.plainEnglish(),
                    narrative.likelyCause(),
                    narrative.confidence(),
                    narrative.fixHints(),
                    narrative.manualReview());
        } catch (IOException ignored) {
            return ParsedHead.empty();
        }
    }

    /**
     * Whether a narrated head is strong enough to stamp the fingerprint ledger.
     * Blank / {@code unknown}-only results must stay unstamped so later polls retry
     * (otherwise Tools → Scan now is the only way to recover labels).
     */
    static boolean headWorthRemembering(ParsedHead head) {
        if (head == null) {
            return false;
        }
        String kind = head.failureKind();
        boolean strongKind = kind != null && !kind.isBlank() && !"unknown".equalsIgnoreCase(kind);
        boolean hasException = head.exception() != null && !head.exception().isBlank();
        boolean hasLabel = (head.displayLabel() != null && !head.displayLabel().isBlank())
                || (head.plainEnglish() != null && !head.plainEnglish().isBlank());
        return strongKind || hasException || hasLabel;
    }

    private static Set<String> ackKeys(JsonObject acks) {
        Set<String> keys = new HashSet<>();
        for (String key : acks.keySet()) {
            keys.add(bareKey(key));
        }
        return keys;
    }

    private static String bareKey(String crashFile) {
        if (crashFile.startsWith("crash-reports/")) {
            return crashFile.substring("crash-reports/".length());
        }
        return crashFile;
    }

    private static long mtimeSec(Path p) {
        try {
            return Files.getLastModifiedTime(p).toMillis() / 1000L;
        } catch (IOException e) {
            return 0;
        }
    }

    public static String formatMtimeIso(long epochSec) {
        return ZonedDateTime.ofInstant(Instant.ofEpochSecond(epochSec), ZoneId.systemDefault()).format(ISO);
    }
}
