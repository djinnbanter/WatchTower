package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.analyze.ModErrorCategory;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;

/**
 * Build a startup / boot profile from server log lines (boot window → {@code Done!}).
 */
public final class StartupProfileScanner {

    private StartupProfileScanner() {
    }

    public static JsonObject scan(Path logPath) throws Exception {
        return scan(Files.readAllLines(logPath, StandardCharsets.UTF_8), null);
    }

    public static JsonObject scan(List<String> lines) {
        return scan(lines, null);
    }

    /**
     * Profile the last successful boot in {@code latest.log}, ignoring any report cutoff.
     * Finds the last {@code Done (Ns)!} line and scans from the prior boot boundary through Done.
     */
    public static JsonObject scanLastBootFromLog(Path latestLog, Double previousTotalSec) throws Exception {
        if (latestLog == null || !Files.isRegularFile(latestLog)) {
            JsonObject empty = new JsonObject();
            empty.addProperty("status", "unknown");
            return empty;
        }
        List<String> lines = Files.readAllLines(latestLog, StandardCharsets.UTF_8);
        List<String> window = extractLastBootWindow(lines);
        if (window.isEmpty()) {
            JsonObject empty = new JsonObject();
            empty.addProperty("status", "unknown");
            empty.addProperty("source", "latest_log_no_done");
            return empty;
        }
        JsonObject profile = scan(window, previousTotalSec);
        profile.addProperty("source", "latest_log_last_boot");
        return profile;
    }

    /**
     * Slice lines covering the last Done! boot: from after the previous Done / Stopping server
     * (or start of file) through the last Done line inclusive.
     */
    public static List<String> extractLastBootWindow(List<String> lines) {
        if (lines == null || lines.isEmpty()) {
            return List.of();
        }
        int lastDone = -1;
        for (int i = 0; i < lines.size(); i++) {
            if (isDoneBootLine(lines.get(i))) {
                lastDone = i;
            }
        }
        if (lastDone < 0) {
            return List.of();
        }
        int start = 0;
        for (int i = lastDone - 1; i >= 0; i--) {
            String line = lines.get(i);
            if (isDoneBootLine(line) || (line != null && line.contains("Stopping server"))) {
                start = i + 1;
                break;
            }
        }
        return new ArrayList<>(lines.subList(start, lastDone + 1));
    }

    public static boolean isDoneBootLine(String line) {
        if (line == null || !line.contains("/INFO]")) {
            return false;
        }
        return LogPatterns.DONE_BOOT.matcher(line).find();
    }

    public static JsonObject scan(List<String> lines, Double previousTotalSec) {
        JsonObject out = new JsonObject();
        if (lines == null || lines.isEmpty()) {
            out.addProperty("status", "unknown");
            return out;
        }

        Double totalSec = null;
        String doneAt = null;
        int doneIndex = -1;
        List<PhaseHit> phaseHits = new ArrayList<>();
        Map<String, Integer> warnCounts = StartupWarnings.newCounter();
        Map<String, BootError> bootErrors = new LinkedHashMap<>();

        for (int i = 0; i < lines.size(); i++) {
            String line = lines.get(i);
            Matcher done = LogPatterns.DONE_BOOT.matcher(line);
            if (done.find() && line.contains("/INFO]")) {
                try {
                    totalSec = Double.parseDouble(done.group(1));
                } catch (NumberFormatException ignored) {
                    totalSec = null;
                }
                ZonedDateTime ts = CollectSupport.parseLogTs(line);
                doneAt = ts != null ? CollectSupport.iso(ts) : null;
                doneIndex = i;
                break;
            }
        }

        int bootEnd = doneIndex >= 0 ? doneIndex : lines.size() - 1;
        for (int i = 0; i <= bootEnd; i++) {
            String line = lines.get(i);
            StartupWarnings.countLine(line, warnCounts);
            StartupPhaseMarkers.PhaseDef phase = StartupPhaseMarkers.match(line);
            if (phase != null) {
                // First hit only — re-matches (e.g. modloading-worker) must not re-open a phase.
                boolean alreadySeen = false;
                for (PhaseHit existing : phaseHits) {
                    if (existing.id.equals(phase.id())) {
                        alreadySeen = true;
                        break;
                    }
                }
                if (!alreadySeen) {
                    ZonedDateTime ts = CollectSupport.parseLogTs(line);
                    Double epoch = ts != null ? CollectSupport.epochSeconds(ts) : null;
                    phaseHits.add(new PhaseHit(phase.id(), phase.label(), epoch, i));
                }
            }
            ModErrorCategory.Hit hit = ModErrorCategory.classify(line);
            if (hit != null && hit.primaryMod() != null && !"unknown".equals(hit.primaryMod())
                    && hit.category().severityRank() >= 3) {
                String modId = hit.primaryMod();
                BootError err = bootErrors.computeIfAbsent(modId,
                        k -> new BootError(modId, hit.category().id()));
                err.kind = hit.category().id();
            }
        }

        if (totalSec != null) {
            out.addProperty("total_sec", Math.round(totalSec * 10.0) / 10.0);
        }
        if (doneAt != null) {
            out.addProperty("done_at", doneAt);
        }

        Double doneEpoch = null;
        if (doneIndex >= 0) {
            ZonedDateTime doneTs = CollectSupport.parseLogTs(lines.get(doneIndex));
            if (doneTs != null) {
                doneEpoch = CollectSupport.epochSeconds(doneTs);
            }
        }

        // Durations only when both ends have real timestamps — never invent epochs from line index.
        Double[] knownSec = new Double[phaseHits.size()];
        int unknownCount = 0;
        double knownSum = 0;
        for (int i = 0; i < phaseHits.size(); i++) {
            PhaseHit hit = phaseHits.get(i);
            Double endEpoch;
            if (i + 1 < phaseHits.size()) {
                endEpoch = phaseHits.get(i + 1).epoch;
            } else {
                endEpoch = doneEpoch;
            }
            if (hit.epoch != null && endEpoch != null) {
                double sec = Math.max(0, endEpoch - hit.epoch);
                if (totalSec != null) {
                    sec = Math.min(sec, totalSec);
                }
                knownSec[i] = Math.round(sec * 10.0) / 10.0;
                knownSum += knownSec[i];
            } else {
                knownSec[i] = null;
                unknownCount++;
            }
        }

        // Remaining-budget allocation for phases without parseable timestamps.
        if (totalSec != null && unknownCount > 0) {
            double remaining = Math.max(0, totalSec - knownSum);
            double share = Math.round((remaining / unknownCount) * 10.0) / 10.0;
            for (int i = 0; i < knownSec.length; i++) {
                if (knownSec[i] == null) {
                    knownSec[i] = share;
                }
            }
        }

        JsonArray phases = new JsonArray();
        List<JsonObject> phaseRows = new ArrayList<>();
        for (int i = 0; i < phaseHits.size(); i++) {
            PhaseHit hit = phaseHits.get(i);
            JsonObject row = new JsonObject();
            row.addProperty("id", hit.id);
            row.addProperty("label", hit.label);
            if (knownSec[i] != null) {
                double sec = knownSec[i];
                if (totalSec != null) {
                    sec = Math.min(sec, totalSec);
                }
                row.addProperty("sec", Math.round(sec * 10.0) / 10.0);
            }
            phases.add(row);
            phaseRows.add(row);
        }
        out.add("phases", phases);

        List<JsonObject> slowest = new ArrayList<>();
        for (JsonObject row : phaseRows) {
            if (row.has("sec") && !row.get("sec").isJsonNull()) {
                slowest.add(row);
            }
        }
        slowest.sort(Comparator.comparingDouble((JsonObject o) -> o.get("sec").getAsDouble()).reversed());
        JsonArray slowestArr = new JsonArray();
        int slowLimit = Math.min(3, slowest.size());
        for (int i = 0; i < slowLimit; i++) {
            JsonObject src = slowest.get(i);
            JsonObject row = new JsonObject();
            row.addProperty("phase", src.get("id").getAsString());
            row.addProperty("sec", src.get("sec").getAsDouble());
            slowestArr.add(row);
        }
        out.add("slowest", slowestArr);

        JsonArray warnings = new JsonArray();
        for (var e : warnCounts.entrySet()) {
            if (e.getValue() == null || e.getValue() <= 0) {
                continue;
            }
            JsonObject row = new JsonObject();
            row.addProperty("id", e.getKey());
            row.addProperty("count", e.getValue());
            warnings.add(row);
        }
        out.add("warnings", warnings);

        boolean reachedDone = doneIndex >= 0;
        JsonArray errors = new JsonArray();
        for (BootError err : bootErrors.values()) {
            JsonObject row = new JsonObject();
            row.addProperty("mod_id", err.modId);
            row.addProperty("kind", err.kind);
            boolean blocking = !(reachedDone && ("mod_corrupt".equals(err.kind)
                    || "loot_parse".equals(err.kind)
                    || "recipe_missing_item".equals(err.kind)
                    || "recipe_format".equals(err.kind)
                    || "recipe_compat".equals(err.kind)));
            row.addProperty("blocking", blocking);
            errors.add(row);
        }
        out.add("errors", errors);

        String status;
        if (!reachedDone) {
            // Missing Done in the supplied window is not automatically a failed boot —
            // callers should prefer scanLastBootFromLog over incremental bootLines.
            boolean looksFailed = false;
            for (String line : lines) {
                if (line == null) {
                    continue;
                }
                if (line.contains("ModLoadingCrashException")
                        || line.contains("-- Mod loading issue")
                        || (line.contains("ServerHangWatchdog") && doneIndex < 0 && bootEnd < 50)) {
                    looksFailed = true;
                    break;
                }
            }
            status = looksFailed ? "failed" : "unknown";
        } else if (!errors.isEmpty() || !warnings.isEmpty()) {
            status = "warnings";
        } else {
            status = "ok";
        }
        out.addProperty("status", status);

        if (previousTotalSec != null && totalSec != null) {
            JsonObject cmp = new JsonObject();
            double delta = Math.round((totalSec - previousTotalSec) * 10.0) / 10.0;
            cmp.addProperty("delta_sec", delta);
            if (Math.abs(delta) < 0.05) {
                cmp.addProperty("direction", "same");
            } else if (delta > 0) {
                cmp.addProperty("direction", "slower");
            } else {
                cmp.addProperty("direction", "faster");
            }
            out.add("compare_to_last_boot", cmp);
        }

        return out;
    }

    private record PhaseHit(String id, String label, Double epoch, int lineIndex) {
    }

    private static final class BootError {
        final String modId;
        String kind;

        BootError(String modId, String kind) {
            this.modId = modId;
            this.kind = kind;
        }
    }
}
