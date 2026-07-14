package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.analyze.CrashClassifier;
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
 * Lightweight crash-reports filesystem scan using mtime index in state.
 */
public final class CrashMtimeScanner {

    public record CrashEntry(
            String file,
            long mtime,
            long size,
            String displayLabel,
            boolean newOrUpdated,
            String failureKind,
            String primaryModId,
            String stallModId,
            String exception
    ) {
    }

    public record ScanResult(
            Instant scannedAt,
            int newCount,
            int unreviewed,
            List<CrashEntry> entries,
            Map<String, Long> updatedIndex
    ) {
    }

    private static final int PARSE_HEAD_BYTES = 8192;
    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_OFFSET_DATE_TIME;

    private CrashMtimeScanner() {
    }

    public static ScanResult scan(String serverDir, Path statePath) throws IOException {
        Path crashDir = Path.of(serverDir, "crash-reports");
        Map<String, Long> priorIndex = StateManager.getCrashMtimeIndex(statePath);
        Map<String, Long> updatedIndex = new HashMap<>(priorIndex);
        JsonObject acks = StateManager.getAcknowledgedCrashes(statePath);
        Set<String> ackedBare = ackKeys(acks);

        List<CrashEntry> entries = new ArrayList<>();
        int newCount = 0;

        if (Files.isDirectory(crashDir)) {
            List<Path> files;
            try (Stream<Path> stream = Files.list(crashDir)) {
                files = stream
                        .filter(p -> p.getFileName().toString().endsWith(".txt"))
                        .sorted(Comparator.comparingLong(CrashMtimeScanner::mtimeSec).reversed())
                        .toList();
            }

            for (Path p : files) {
                String file = p.getFileName().toString();
                long mtime = mtimeSec(p);
                long size;
                try {
                    size = Files.size(p);
                } catch (IOException e) {
                    size = 0;
                }
                Long prior = priorIndex.get(file);
                boolean changed = prior == null || prior != mtime;
                if (changed) {
                    newCount++;
                }
                ParsedHead head = (changed || !priorIndex.containsKey(file))
                        ? parseCrashHead(p)
                        : ParsedHead.empty();
                if (head.displayLabel().isBlank() && changed) {
                    head = parseCrashHead(p);
                }
                entries.add(new CrashEntry(
                        file, mtime, size, head.displayLabel(), changed,
                        head.failureKind(), head.primaryModId(), head.stallModId(), head.exception()));
                updatedIndex.put(file, mtime);
            }
        }

        int unreviewed = 0;
        for (CrashEntry entry : entries) {
            if (!ackedBare.contains(bareKey(entry.file()))) {
                unreviewed++;
            }
        }

        Instant scannedAt = Instant.now();
        return new ScanResult(scannedAt, newCount, unreviewed, entries, updatedIndex);
    }

    /**
     * Full index refresh for report reconcile — parses display labels for all files in window.
     */
    public static ScanResult scanForReconcile(String serverDir, Path statePath, double cutoffEpochSec) throws IOException {
        Path crashDir = Path.of(serverDir, "crash-reports");
        Map<String, Long> updatedIndex = new HashMap<>();
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
                ParsedHead head = parseCrashHead(p);
                entries.add(new CrashEntry(
                        file, mtime, size, head.displayLabel(), false,
                        head.failureKind(), head.primaryModId(), head.stallModId(), head.exception()));
                updatedIndex.put(file, mtime);
            }
        }

        int unreviewed = 0;
        for (CrashEntry entry : entries) {
            if (!ackedBare.contains(bareKey(entry.file()))) {
                unreviewed++;
            }
        }

        return new ScanResult(Instant.now(), 0, unreviewed, entries, updatedIndex);
    }

    private record ParsedHead(
            String displayLabel,
            String failureKind,
            String primaryModId,
            String stallModId,
            String exception
    ) {
        static ParsedHead empty() {
            return new ParsedHead("", null, null, null, null);
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
            String label = summary;
            if (label.isBlank()) {
                label = details.displayLabel();
            }
            if (label.isBlank()) {
                label = details.summary();
            }
            return new ParsedHead(
                    label != null ? label : "",
                    classification.failureKind(),
                    classification.primaryModId(),
                    classification.stallModId(),
                    details.exception());
        } catch (IOException ignored) {
            return ParsedHead.empty();
        }
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
