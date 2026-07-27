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
     * (or start of file) through the last Done line, plus a short post-Done peek for ModernFix
     * full-load timing when present.
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
        int end = lastDone;
        for (int i = lastDone + 1; i < lines.size() && i <= lastDone + 400; i++) {
            String line = lines.get(i);
            if (line != null && line.contains("ModLauncher starting")) {
                break;
            }
            if (isModernFixFullLoadLine(line)) {
                end = i;
                break;
            }
        }
        return new ArrayList<>(lines.subList(start, end + 1));
    }

    public static boolean isDoneBootLine(String line) {
        if (line == null || !line.contains("/INFO]")) {
            return false;
        }
        return LogPatterns.DONE_BOOT.matcher(line).find();
    }

    public static boolean isModernFixFullLoadLine(String line) {
        if (line == null) {
            return false;
        }
        return LogPatterns.MODERNFIX_FULL_LOAD.matcher(line).find();
    }

    public static JsonObject scan(List<String> lines, Double previousTotalSec) {
        JsonObject out = new JsonObject();
        if (lines == null || lines.isEmpty()) {
            out.addProperty("status", "unknown");
            return out;
        }

        Double vanillaDoneSec = null;
        Double modernFixSec = null;
        String doneAt = null;
        int doneIndex = -1;
        List<PhaseHit> phaseHits = new ArrayList<>();
        Map<String, Integer> warnCounts = StartupWarnings.newCounter();
        List<JsonObject> warnSamples = StartupWarnings.newSampleList();
        Map<String, BootError> bootErrors = new LinkedHashMap<>();

        for (int i = 0; i < lines.size(); i++) {
            String line = lines.get(i);
            Matcher done = LogPatterns.DONE_BOOT.matcher(line);
            if (doneIndex < 0 && done.find() && line.contains("/INFO]")) {
                try {
                    vanillaDoneSec = Double.parseDouble(done.group(1));
                } catch (NumberFormatException ignored) {
                    vanillaDoneSec = null;
                }
                ZonedDateTime ts = CollectSupport.parseLogTs(line);
                doneAt = ts != null ? CollectSupport.iso(ts) : null;
                doneIndex = i;
            }
        }

        // ModernFix (and similar) reports full JVM→ready time after Done; vanilla Done (Xs)
        // is only world prep and under-reports heavy NeoForge boots.
        if (doneIndex >= 0) {
            for (int i = doneIndex + 1; i < lines.size() && i <= doneIndex + 400; i++) {
                String line = lines.get(i);
                if (line != null && line.contains("ModLauncher starting")) {
                    break;
                }
                Matcher mf = LogPatterns.MODERNFIX_FULL_LOAD.matcher(line);
                if (mf.find()) {
                    try {
                        modernFixSec = Double.parseDouble(mf.group(1));
                    } catch (NumberFormatException ignored) {
                        modernFixSec = null;
                    }
                    break;
                }
            }
        }

        Double firstEpoch = null;
        for (int i = 0; i < lines.size(); i++) {
            if (doneIndex >= 0 && i > doneIndex) {
                break;
            }
            ZonedDateTime ts = CollectSupport.parseLogTs(lines.get(i));
            if (ts != null) {
                firstEpoch = CollectSupport.epochSeconds(ts);
                break;
            }
        }

        Double doneEpoch = null;
        if (doneIndex >= 0) {
            ZonedDateTime doneTs = CollectSupport.parseLogTs(lines.get(doneIndex));
            if (doneTs != null) {
                doneEpoch = CollectSupport.epochSeconds(doneTs);
            }
        }

        Double wallClockSec = null;
        if (firstEpoch != null && doneEpoch != null && doneEpoch >= firstEpoch) {
            wallClockSec = Math.round((doneEpoch - firstEpoch) * 10.0) / 10.0;
        }

        // Prefer ModernFix full load → wall clock when it clearly exceeds vanilla Done (Xs)
        // (mod loading before Preparing level) → else vanilla Done.
        Double totalSec;
        String totalSource;
        if (modernFixSec != null && modernFixSec > 0) {
            totalSec = Math.round(modernFixSec * 10.0) / 10.0;
            totalSource = "modernfix";
        } else if (wallClockSec != null
                && wallClockSec > 0
                && (vanillaDoneSec == null || wallClockSec > vanillaDoneSec + 1.0)) {
            totalSec = wallClockSec;
            totalSource = "wall_clock";
        } else if (vanillaDoneSec != null) {
            totalSec = Math.round(vanillaDoneSec * 10.0) / 10.0;
            totalSource = "vanilla_done";
        } else if (wallClockSec != null && wallClockSec > 0) {
            totalSec = wallClockSec;
            totalSource = "wall_clock";
        } else {
            totalSec = null;
            totalSource = "unknown";
        }

        // Phase bars end at Done!; budget must not use ModernFix post-Done tail.
        Double phaseBudgetSec;
        if (wallClockSec != null) {
            phaseBudgetSec = wallClockSec;
        } else if (vanillaDoneSec != null) {
            phaseBudgetSec = Math.round(vanillaDoneSec * 10.0) / 10.0;
        } else {
            phaseBudgetSec = totalSec;
        }

        int bootEnd = doneIndex >= 0 ? doneIndex : lines.size() - 1;
        for (int i = 0; i <= bootEnd; i++) {
            String line = lines.get(i);
            StartupWarnings.noteLine(line, warnCounts, warnSamples, 24);
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
            out.addProperty("total_sec", totalSec);
            out.addProperty("total_source", totalSource);
        }
        if (vanillaDoneSec != null) {
            out.addProperty("vanilla_done_sec", Math.round(vanillaDoneSec * 10.0) / 10.0);
        }
        if (wallClockSec != null) {
            out.addProperty("wall_clock_sec", wallClockSec);
        }
        if (modernFixSec != null) {
            out.addProperty("modernfix_sec", Math.round(modernFixSec * 10.0) / 10.0);
        }
        if (doneAt != null) {
            out.addProperty("done_at", doneAt);
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
                if (phaseBudgetSec != null) {
                    sec = Math.min(sec, phaseBudgetSec);
                }
                knownSec[i] = Math.round(sec * 10.0) / 10.0;
                knownSum += knownSec[i];
            } else {
                knownSec[i] = null;
                unknownCount++;
            }
        }

        // Remaining-budget allocation for phases without parseable timestamps.
        if (phaseBudgetSec != null && unknownCount > 0) {
            double remaining = Math.max(0, phaseBudgetSec - knownSum);
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
                if (phaseBudgetSec != null) {
                    sec = Math.min(sec, phaseBudgetSec);
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

        JsonArray warnings = StartupWarnings.samplesToJson(warnSamples);
        if (warnings.isEmpty()) {
            // Legacy fallback: grouped counts when no samples were captured.
            warnings = StartupWarnings.toJsonArray(warnCounts);
        }
        out.add("warnings", warnings);
        JsonObject warningTotals = new JsonObject();
        int warnTotal = 0;
        for (var e : warnCounts.entrySet()) {
            if (e.getValue() != null && e.getValue() > 0) {
                warningTotals.addProperty(e.getKey(), e.getValue());
                warnTotal += e.getValue();
            }
        }
        if (warnTotal > 0) {
            out.add("warning_totals", warningTotals);
            out.addProperty("warning_event_count", warnTotal);
        }

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
            row.addProperty("title", errorTitle(err.kind));
            row.addProperty("detail", errorDetail(err.kind, blocking));
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

    /**
     * Preserve a rolling {@code boot_history} on the new profile from the previous ops profile
     * (last {@value #BOOT_HISTORY_CAP} boots with {@code total_sec} / {@code done_at} / {@code status}).
     */
    public static void attachBootHistory(JsonObject newProfile, JsonObject previousProfile) {
        if (newProfile == null) {
            return;
        }
        JsonArray history = new JsonArray();
        if (previousProfile != null
                && previousProfile.has("boot_history")
                && previousProfile.get("boot_history").isJsonArray()) {
            history = previousProfile.getAsJsonArray("boot_history").deepCopy();
        } else {
            JsonObject seeded = historyEntryFrom(previousProfile);
            if (seeded != null) {
                history.add(seeded);
            }
        }

        JsonObject current = historyEntryFrom(newProfile);
        if (current != null) {
            String currentDone = current.has("done_at") ? current.get("done_at").getAsString() : null;
            boolean dup = false;
            if (currentDone != null && history.size() > 0) {
                JsonObject last = history.get(history.size() - 1).getAsJsonObject();
                if (last.has("done_at") && currentDone.equals(last.get("done_at").getAsString())) {
                    dup = true;
                    history.set(history.size() - 1, current);
                }
            }
            if (!dup) {
                history.add(current);
            }
        }

        JsonArray trimmed = new JsonArray();
        int start = Math.max(0, history.size() - BOOT_HISTORY_CAP);
        for (int i = start; i < history.size(); i++) {
            trimmed.add(history.get(i));
        }
        newProfile.add("boot_history", trimmed);
    }

    private static final int BOOT_HISTORY_CAP = 12;

    private static String errorTitle(String kind) {
        if (kind == null) {
            return "Mod load issue";
        }
        return switch (kind) {
            case "mod_corrupt" -> "Corrupt or unreadable jar";
            case "mod_runtime" -> "Runtime mod failure";
            case "mod_load_failed" -> "Mod failed to load";
            case "mod_load_dependency" -> "Missing dependency";
            case "mod_load_script" -> "Script load failure";
            case "loot_parse" -> "Loot parse failure";
            case "recipe_missing_item", "recipe_format", "recipe_compat" -> "Recipe issue";
            default -> kind.replace('_', ' ');
        };
    }

    private static String errorDetail(String kind, boolean blocking) {
        String base = switch (kind == null ? "" : kind) {
            case "mod_corrupt" -> "This jar looked corrupt or unreadable during boot.";
            case "mod_runtime" -> "The mod threw errors while initializing or running at startup.";
            case "mod_load_failed" -> "NeoForge reported this mod failed to load.";
            case "mod_load_dependency" -> "A required dependency was missing or incompatible.";
            case "mod_load_script" -> "A KubeJS/script pack failed while loading.";
            default -> "Watchtower classified a serious boot-time mod error from the log.";
        };
        return blocking
                ? base + " Marked blocking because the server may not have reached Done! cleanly."
                : base + " Non-blocking — the server still reached Done!.";
    }

    private static JsonObject historyEntryFrom(JsonObject profile) {
        if (profile == null || !profile.has("total_sec") || profile.get("total_sec").isJsonNull()) {
            return null;
        }
        try {
            double total = profile.get("total_sec").getAsDouble();
            if (!Double.isFinite(total) || total < 0) {
                return null;
            }
            JsonObject entry = new JsonObject();
            entry.addProperty("total_sec", Math.round(total * 10.0) / 10.0);
            if (profile.has("done_at") && !profile.get("done_at").isJsonNull()) {
                entry.addProperty("done_at", profile.get("done_at").getAsString());
            }
            if (profile.has("status") && !profile.get("status").isJsonNull()) {
                entry.addProperty("status", profile.get("status").getAsString());
            }
            if (profile.has("phases") && profile.get("phases").isJsonArray()) {
                JsonArray phasesOut = new JsonArray();
                for (var el : profile.getAsJsonArray("phases")) {
                    if (el == null || !el.isJsonObject()) {
                        continue;
                    }
                    JsonObject src = el.getAsJsonObject();
                    if (!src.has("sec") || src.get("sec").isJsonNull()) {
                        continue;
                    }
                    try {
                        double sec = src.get("sec").getAsDouble();
                        if (!Double.isFinite(sec) || sec < 0) {
                            continue;
                        }
                        JsonObject row = new JsonObject();
                        if (src.has("id") && !src.get("id").isJsonNull()) {
                            row.addProperty("id", src.get("id").getAsString());
                        }
                        if (src.has("label") && !src.get("label").isJsonNull()) {
                            row.addProperty("label", src.get("label").getAsString());
                        }
                        row.addProperty("sec", Math.round(sec * 10.0) / 10.0);
                        phasesOut.add(row);
                    } catch (Exception ignored) {
                        /* skip bad phase */
                    }
                }
                if (phasesOut.size() > 0) {
                    entry.add("phases", phasesOut);
                }
            }
            return entry;
        } catch (Exception e) {
            return null;
        }
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
