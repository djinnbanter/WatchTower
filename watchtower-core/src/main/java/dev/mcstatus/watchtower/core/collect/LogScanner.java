package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.analyze.DbAddonSignatures;
import dev.mcstatus.watchtower.core.analyze.JadeSidecarAnalyzer;
import dev.mcstatus.watchtower.core.report.ReportConfig;
import dev.mcstatus.watchtower.core.report.ReportProgress;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Scan Minecraft server logs (ported from {@code scan_logs}).
 */
public final class LogScanner {

    private LogScanner() {
    }

    public static void scanLogs(String serverDir, JsonObject staging, double cutoff, ReportConfig config) {
        scanLogs(serverDir, staging, cutoff, config, ReportProgress.NOOP);
    }

    public static void scanLogs(
            String serverDir,
            JsonObject staging,
            double cutoff,
            ReportConfig config,
            ReportProgress progress
    ) {
        ReportProgress p = progress != null ? progress : ReportProgress.NOOP;
        JsonObject mc = staging.getAsJsonObject("minecraft");
        List<Path> logFiles = GzipLineReader.iterLogFiles(serverDir, config.logGzipCount(), cutoff);
        ZonedDateTime now = ZonedDateTime.now();
        int total = logFiles.size();
        p.found("logs", total);
        if (total > 0) {
            p.units(0, total);
            p.detail("Found " + total + " log file" + (total == 1 ? "" : "s") + "…");
        }

        Set<String> knownModIds = knownModIdsFromJars(serverDir);
        ScanState state = new ScanState(now, config.errorIgnorePatterns(), knownModIds);

        int index = 0;
        for (Path logPath : logFiles) {
            index++;
            String rel = CollectSupport.relLogPath(serverDir, logPath);
            p.units(index, total);
            p.detail("Scanning log " + index + "/" + total + ": " + rel);
            if (isJadeSidecar(logPath)) {
                try {
                    String jadeText = Files.readString(logPath, StandardCharsets.UTF_8);
                    JsonObject jade = JadeSidecarAnalyzer.analyze(jadeText);
                    if (jade != null) {
                        staging.getAsJsonObject("optional").add("jade_sidecar", jade);
                    }
                } catch (IOException ignored) {
                    // skip unreadable jade sidecar
                }
                continue;
            }
            try {
                GzipLineReader.forEachLine(logPath, (lineNo, line) ->
                        processLine(staging, mc, cutoff, rel, lineNo, line, state));
            } catch (IOException ignored) {
                // skip unreadable log
            }
        }

        PlayerTracker.replayPlayerEvents(state.players, state.playerRawEvents);

        if (!state.maxLine.isEmpty()) {
            mc.addProperty("last_log_line",
                    state.maxLine.length() > 300 ? state.maxLine.substring(0, 300) : state.maxLine);
            mc.addProperty("last_log_file", state.maxFile);
            mc.addProperty("last_log_line_no", state.maxLineNo);
        }
        if (state.maxTs != null) {
            mc.addProperty("last_log_time", CollectSupport.iso(state.maxTs));
            staging.addProperty("health_log_gap_minutes",
                    CollectSupport.clampLogGap((CollectSupport.epochSeconds(now)
                            - CollectSupport.epochSeconds(state.maxTs)) / 60.0));
        }

        Path latest = Path.of(serverDir, "logs", "latest.log");
        if (Files.isRegularFile(latest)) {
            try {
                ZonedDateTime mtime = Files.getLastModifiedTime(latest).toInstant().atZone(now.getZone());
                mc.addProperty("latest_log_mtime", CollectSupport.iso(mtime));
                if (state.maxTs == null || mtime.isAfter(state.maxTs)) {
                    mc.addProperty("last_log_time", CollectSupport.iso(mtime));
                    staging.addProperty("health_log_gap_minutes",
                            CollectSupport.clampLogGap((CollectSupport.epochSeconds(now)
                                    - CollectSupport.epochSeconds(mtime)) / 60.0));
                }
            } catch (IOException ignored) {
                // skip
            }
        }

        if (state.pregenLast != null) {
            if (state.pregenFirst == null) {
                state.pregenFirst = state.pregenLast;
            }
            JsonObject dh = buildDhPregen(state.pregenFirst, state.pregenLast, state.cpsVals, now, state.serverStarted);
            staging.getAsJsonObject("optional").add("dh_pregen", dh);
        }
        if (state.chunkyLast != null) {
            JsonObject chunky = ChunkyLogSupport.buildChunkyPregen(
                    state.chunkyFirst,
                    state.chunkyLast,
                    state.chunkyRateVals,
                    now,
                    state.serverStarted,
                    state.chunkyState);
            staging.getAsJsonObject("optional").add("chunky_pregen", chunky);
        }

        mc.addProperty("cant_keep_up_count", state.tickLagSeen.size());
        List<JsonObject> sessionEvidence = new ArrayList<>();
        List<JsonObject> historicalEvidence = new ArrayList<>();
        for (JsonObject ev : state.tickLagEvidence) {
            ZonedDateTime evTime = CollectSupport.parseTime(CollectSupport.getString(ev, "time"));
            if (state.serverStarted != null && evTime != null && evTime.isBefore(state.serverStarted)) {
                historicalEvidence.add(ev);
            } else {
                sessionEvidence.add(ev);
            }
        }
        mc.add("tick_lag_evidence", toJsonArray(state.tickLagEvidence));
        mc.add("tick_lag_session_evidence", toJsonArray(sessionEvidence));
        mc.add("tick_lag_historical_evidence", toJsonArray(historicalEvidence));

        int sessionCount;
        int historicalCount = 0;
        if (state.serverStarted != null) {
            sessionCount = 0;
            for (String key : state.tickLagSeen) {
                String tsPart = key.contains("|") ? key.substring(0, key.indexOf('|')) : key;
                ZonedDateTime tsDt = CollectSupport.parseTime(tsPart);
                if (tsDt != null && tsDt.isBefore(state.serverStarted)) {
                    historicalCount++;
                } else {
                    sessionCount++;
                }
            }
        } else {
            sessionCount = state.tickLagSeen.size();
        }
        mc.addProperty("cant_keep_up_session_count", sessionCount);
        mc.addProperty("cant_keep_up_historical_count", historicalCount);

        JsonObject logErrors = new JsonObject();
        logErrors.addProperty("error", state.errorCount);
        logErrors.addProperty("fatal", state.fatalCount);
        JsonArray topArr = new JsonArray();
        state.errorSigs.entrySet().stream()
                .sorted(Map.Entry.<String, Integer>comparingByValue().reversed())
                .limit(3)
                .forEach(e -> {
                    JsonObject item = new JsonObject();
                    item.addProperty("message", e.getKey());
                    item.addProperty("count", e.getValue());
                    topArr.add(item);
                });
        logErrors.add("top", topArr);
        mc.add("log_errors", logErrors);
        mc.add("oom_evidence", toJsonArray(state.oomEvidence));
        mc.addProperty("worst_tick_lag_ms", state.worstTickMs);
        if (state.serverStarted != null) {
            mc.addProperty("server_started", CollectSupport.iso(state.serverStarted));
        }

        JsonObject playerStats = state.players.finalizeStats();
        if (!state.tickLagEvidence.isEmpty()) {
            JsonObject worstLag = state.tickLagEvidence.stream()
                    .max(Comparator.comparingInt(LogScanner::tickLagMsFromEvidence))
                    .orElse(null);
            if (worstLag != null) {
                ZonedDateTime lagTime = CollectSupport.parseTime(CollectSupport.getString(worstLag, "time"));
                if (lagTime != null) {
                    playerStats.addProperty("concurrent_at_worst_lag", state.players.concurrentAt(lagTime));
                }
            }
        }
        mc.add("player_stats", playerStats);

        JsonArray startupWarnings = StartupWarnings.toJsonArray(state.startupWarnCounts);
        if (!startupWarnings.isEmpty()) {
            staging.getAsJsonObject("optional").add("startup_warnings", startupWarnings);
        }

        JsonArray modLogErrors = state.modLogAnalyzer.toJsonArray();
        if (!modLogErrors.isEmpty()) {
            staging.getAsJsonObject("optional").add("mod_log_errors", modLogErrors);
        }
        emitDbAddonFail(staging, state);
        JsonArray clientWarnings = state.clientLogAttributor.toJsonArray();
        if (!clientWarnings.isEmpty()) {
            staging.getAsJsonObject("optional").add("client_class_warnings_by_mod", clientWarnings);
        }
        if (state.mapRenderActive && state.mapRenderSource != null) {
            JsonObject mapRender = new JsonObject();
            mapRender.addProperty("active", true);
            mapRender.addProperty("source", state.mapRenderSource);
            if (state.mapRenderLastLine != null) {
                mapRender.addProperty("last_line", state.mapRenderLastLine);
            }
            staging.getAsJsonObject("optional").add("map_render", mapRender);
        }
        if (state.fmlBlockBuf.length() > 0 || state.fmlAccumulating) {
            if (state.fmlAccumulating && state.fmlBlockBuf.length() > 0) {
                // flush open block
            }
            JsonArray fmlIssues = FmlIssueParser.parse(state.fmlBlockBuf.toString());
            if (!fmlIssues.isEmpty()) {
                staging.getAsJsonObject("optional").add("fml_issues", fmlIssues);
            }
        }
        // CA-31: merge stderr; prefer last Done! boot from latest.log (outside incremental cutoff)
        {
            StderrBootMerger.Result stderr = StderrBootMerger.merge(
                    Path.of(serverDir),
                    config.forensicsStderrPaths() != null
                            ? config.forensicsStderrPaths()
                            : "logs/stderr.log,logs/stderr_stream.log");
            if (!stderr.lines().isEmpty()) {
                List<String> merged = new ArrayList<>(stderr.lines());
                merged.addAll(state.bootLines);
                state.bootLines.clear();
                state.bootLines.addAll(merged);
            }
            Double prevBoot = null;
            JsonObject optional = staging.getAsJsonObject("optional");
            if (optional.has("startup_profile_prev_total_sec")
                    && !optional.get("startup_profile_prev_total_sec").isJsonNull()) {
                prevBoot = optional.get("startup_profile_prev_total_sec").getAsDouble();
            }

            JsonObject profile = null;
            Path latestLog = Path.of(serverDir, "logs", "latest.log");
            if (Files.isRegularFile(latestLog)) {
                try {
                    profile = StartupProfileScanner.scanLastBootFromLog(latestLog, prevBoot);
                } catch (Exception e) {
                    profile = null;
                }
            }
            // Fall back to in-window bootLines only when latest.log has no Done!
            if (profile == null
                    || "unknown".equals(CollectSupport.getString(profile, "status"))
                    || "latest_log_no_done".equals(CollectSupport.getString(profile, "source"))) {
                if (!state.bootLines.isEmpty()) {
                    JsonObject fromWindow = StartupProfileScanner.scan(state.bootLines, prevBoot);
                    if (fromWindow != null && fromWindow.size() > 0
                            && !"unknown".equals(CollectSupport.getString(fromWindow, "status"))) {
                        profile = fromWindow;
                    } else if (profile == null || profile.size() == 0) {
                        profile = fromWindow;
                    }
                }
            }

            if (profile != null && profile.size() > 0) {
                if (!stderr.excerpt().isEmpty()) {
                    JsonArray excerpt = new JsonArray();
                    stderr.excerpt().forEach(excerpt::add);
                    profile.add("stderr_excerpt", excerpt);
                }
                if (!stderr.sources().isEmpty()) {
                    JsonArray sources = new JsonArray();
                    stderr.sources().forEach(sources::add);
                    profile.add("stderr_sources", sources);
                }
                optional.add("startup_profile", profile);
            } else if (!stderr.sources().isEmpty()) {
                JsonObject stderrOnly = new JsonObject();
                JsonArray excerpt = new JsonArray();
                stderr.excerpt().forEach(excerpt::add);
                stderrOnly.add("stderr_excerpt", excerpt);
                JsonArray sources = new JsonArray();
                stderr.sources().forEach(sources::add);
                stderrOnly.add("stderr_sources", sources);
                stderrOnly.addProperty("status", "unknown");
                optional.add("startup_profile", stderrOnly);
            }
        }
    }

    private static JsonArray toJsonArray(List<JsonObject> items) {
        JsonArray arr = new JsonArray();
        items.forEach(arr::add);
        return arr;
    }

    private static int tickLagMsFromEvidence(JsonObject ev) {
        Matcher m = LogPatterns.TICK_LAG_MS.matcher(CollectSupport.getString(ev, "quote"));
        return m.find() ? Integer.parseInt(m.group(1)) : 0;
    }

    private static void processLine(
            JsonObject staging,
            JsonObject mc,
            double cutoff,
            String rel,
            int lineNo,
            String line,
            ScanState state) {
        String stripped = line.stripTrailing();
        StartupWarnings.countLine(stripped, state.startupWarnCounts);
        ZonedDateTime ts = CollectSupport.parseLogTs(stripped);
        if (ts != null && CollectSupport.epochSeconds(ts) < cutoff) {
            return;
        }

        boolean inBootWindow = !state.bootComplete;
        if (inBootWindow) {
            state.bootLines.add(stripped);
        }

        state.modLogAnalyzer.processLine(rel, lineNo, stripped, inBootWindow);
        state.clientLogAttributor.processLine(stripped);
        accumulateFml(stripped, state);
        maybeRecordDbAddon(stripped, rel, lineNo, ts, state);

        if (ts != null && CollectSupport.epochSeconds(ts) >= cutoff) {
            mc.addProperty("log_had_activity_in_window", true);
        }
        if (ts != null && (state.maxTs == null || ts.isAfter(state.maxTs))) {
            state.maxTs = ts;
            state.maxLine = stripped;
            state.maxFile = rel;
            state.maxLineNo = lineNo;
        }

        if (StartupProfileScanner.isDoneBootLine(stripped)) {
            state.bootComplete = true;
            state.modLogAnalyzer.setBootComplete(true);
            if (ts != null && (state.serverStarted == null || ts.isAfter(state.serverStarted))) {
                state.serverStarted = ts;
                state.playerRawEvents.add(new PlayerTracker.PlayerRawEvent(ts, "server_start", ""));
                JsonObject ev = new JsonObject();
                ev.addProperty("time", CollectSupport.iso(ts));
                ev.addProperty("type", "server_start");
                ev.addProperty("source", "log");
                ev.addProperty("detail", "Server started");
                ev.addProperty("importance", 8);
                CollectSupport.appendEvent(staging, ev);
            }
        }

        if (stripped.contains("Stopping server")) {
            mc.addProperty("clean_shutdown_seen", true);
            if (ts != null) {
                state.playerRawEvents.add(new PlayerTracker.PlayerRawEvent(ts, "server_stop", ""));
                JsonObject ev = new JsonObject();
                ev.addProperty("time", CollectSupport.iso(ts));
                ev.addProperty("type", "clean_stop");
                ev.addProperty("source", "log");
                ev.addProperty("detail", "Stopping server");
                ev.addProperty("importance", 8);
                JsonArray evArr = new JsonArray();
                evArr.add(CollectSupport.evidence(rel, lineNo, stripped, CollectSupport.iso(ts)));
                ev.add("evidence", evArr);
                CollectSupport.appendEvent(staging, ev);
            }
        }

        if (LogPatterns.OOM_LOG.matcher(stripped).find()) {
            mc.addProperty("oom_in_logs", true);
            if (ts != null) {
                state.oomEvidence.add(CollectSupport.evidence(rel, lineNo, stripped, CollectSupport.iso(ts)));
                JsonObject ev = new JsonObject();
                ev.addProperty("time", CollectSupport.iso(ts));
                ev.addProperty("type", "oom");
                ev.addProperty("source", "log");
                ev.addProperty("detail", stripped.length() > 200 ? stripped.substring(0, 200) : stripped);
                ev.addProperty("importance", 10);
                JsonArray evArr = new JsonArray();
                evArr.add(CollectSupport.evidence(rel, lineNo, stripped, CollectSupport.iso(ts)));
                ev.add("evidence", evArr);
                CollectSupport.appendEvent(staging, ev);
            }
        }

        if (LogPatterns.ERROR_LINE.matcher(stripped).find()) {
            boolean ignored = false;
            for (Pattern p : state.errorIgnore) {
                if (p.matcher(stripped).find()) {
                    ignored = true;
                    break;
                }
            }
            if (!ignored) {
                if (stripped.toUpperCase().contains("[FATAL]")) {
                    state.fatalCount++;
                } else {
                    state.errorCount++;
                }
                state.errorSigs.merge(CollectSupport.normalizeErrorMessage(stripped), 1, Integer::sum);
            }
        }

        if (stripped.contains("Can't keep up")
                || LogPatterns.SHTREIMEL_LAG.matcher(stripped).find()
                || LogPatterns.TABTPS_MSPT.matcher(stripped).find()
                || LogPatterns.WATCHDOG_FATAL_LOG.matcher(stripped).find()) {
            int msBehind = 0;
            Matcher m = LogPatterns.TICK_LAG_MS.matcher(stripped);
            if (m.find()) {
                msBehind = Integer.parseInt(m.group(1));
            }
            String lagKey = (ts != null ? CollectSupport.iso(ts) : stripped.substring(0, Math.min(40, stripped.length())))
                    + "|" + msBehind + "|" + stripped.hashCode();
            if (!state.tickLagSeen.contains(lagKey)) {
                state.tickLagSeen.add(lagKey);
                if (msBehind > 0) {
                    state.worstTickMs = Math.max(state.worstTickMs, msBehind);
                }
                if (state.tickLagEvidence.size() < 5) {
                    state.tickLagEvidence.add(CollectSupport.evidence(rel, lineNo, stripped,
                            ts != null ? CollectSupport.iso(ts) : null));
                }
            }
        }

        Matcher pm = LogPatterns.PREGEN.matcher(stripped);
        if (pm.find() && ts != null) {
            updatePregenEntry(pm, ts, rel, lineNo, state);
        }

        if (LogPatterns.CHUNK_GEN_FAILURE.matcher(stripped).find()) {
            state.chunkyState.chunkGenFailures++;
        }
        if (LogPatterns.CHUNKY_PAUSED.matcher(stripped).find() && ts != null) {
            ChunkyLogSupport.markPaused(state.chunkyState, ts);
        }
        Matcher cm = LogPatterns.CHUNKY_TASK.matcher(stripped);
        if (cm.find() && ts != null && stripped.contains("Server thread")) {
            updateChunkyEntry(cm, ts, rel, lineNo, state);
        }

        if (LogPatterns.SQUAREMAP_RUNTIME.matcher(stripped).find()
                && !stripped.toLowerCase().contains("moddiscoverer")
                && !stripped.contains(" SCAN")) {
            state.mapRenderActive = true;
            state.mapRenderSource = "squaremap";
            state.mapRenderLastLine = stripped.length() > 300 ? stripped.substring(0, 300) : stripped;
        } else if (LogPatterns.BLUEMAP_RUNTIME.matcher(stripped).find()
                && !stripped.toLowerCase().contains("moddiscoverer")
                && !stripped.contains(" SCAN")) {
            state.mapRenderActive = true;
            state.mapRenderSource = "bluemap";
            state.mapRenderLastLine = stripped.length() > 300 ? stripped.substring(0, 300) : stripped;
        }

        if (ts != null) {
            Matcher jm = LogPatterns.PLAYER_JOIN.matcher(stripped);
            if (jm.find()) {
                state.successfulJoins++;
                state.playerRawEvents.add(new PlayerTracker.PlayerRawEvent(ts, "join", jm.group(1).strip()));
            } else {
                Matcher jmb = LogPatterns.PLAYER_JOIN_BRACKET.matcher(stripped);
                if (jmb.find()) {
                    state.successfulJoins++;
                    state.playerRawEvents.add(new PlayerTracker.PlayerRawEvent(ts, "join", jmb.group(1).strip()));
                } else {
                    Matcher jme = LogPatterns.PLAYER_JOIN_ENTITY.matcher(stripped);
                    if (jme.find()) {
                        state.successfulJoins++;
                        state.playerRawEvents.add(new PlayerTracker.PlayerRawEvent(ts, "join", jme.group(1).strip()));
                    }
                }
            }
            boolean loginDisconnect = LogPatterns.LOGIN_DISCONNECT.matcher(stripped).find();
            if (loginDisconnect) {
                state.loginDisconnects++;
                if (state.loginDisconnectEvidence.size() < 5) {
                    state.loginDisconnectEvidence.add(
                            CollectSupport.evidence(rel, lineNo, stripped, CollectSupport.iso(ts)));
                }
                maybeEmitLoginStorm(staging, state, ts);
            }
            Matcher lm = LogPatterns.PLAYER_LEAVE.matcher(stripped);
            if (lm.find()) {
                recordLeave(staging, state, ts, lm.group(1).strip(), rel, lineNo, stripped);
            } else {
                Matcher lmb = LogPatterns.PLAYER_LEAVE_BRACKET.matcher(stripped);
                if (lmb.find()) {
                    recordLeave(staging, state, ts, lmb.group(1).strip(), rel, lineNo, stripped);
                } else if (!loginDisconnect && LogPatterns.PLAYER_DISCONNECT.matcher(stripped).find()) {
                    // Avoid double-counting login-path disconnects as in-game leave storms.
                    recordLeave(staging, state, ts, "?", rel, lineNo, stripped);
                }
            }
        }
    }

    /** Threshold: ≥20 login disconnects and joins ≤ 10% of those disconnects (scan window). */
    static boolean isLoginStorm(int loginDisconnects, int successfulJoins) {
        return loginDisconnects >= 20 && successfulJoins * 10 <= loginDisconnects;
    }

    private static void maybeEmitLoginStorm(JsonObject staging, ScanState state, ZonedDateTime ts) {
        if (state.loginStormEmitted || !isLoginStorm(state.loginDisconnects, state.successfulJoins)) {
            return;
        }
        state.loginStormEmitted = true;
        String joinWord = state.successfulJoins == 1 ? "join" : "joins";
        JsonObject ev = new JsonObject();
        ev.addProperty("time", CollectSupport.iso(ts));
        ev.addProperty("type", "login_storm");
        ev.addProperty("source", "log");
        ev.addProperty("detail", state.loginDisconnects + " login disconnects vs "
                + state.successfulJoins + " " + joinWord + " — server up but unjoinable");
        ev.addProperty("importance", 9);
        ev.addProperty("login_disconnects", state.loginDisconnects);
        ev.addProperty("successful_joins", state.successfulJoins);
        JsonArray evArr = new JsonArray();
        for (JsonObject evidence : state.loginDisconnectEvidence) {
            evArr.add(evidence.deepCopy());
        }
        ev.add("evidence", evArr);
        CollectSupport.appendEvent(staging, ev);

        JsonObject optional = staging.getAsJsonObject("optional");
        if (optional != null) {
            JsonObject summary = new JsonObject();
            summary.addProperty("active", true);
            summary.addProperty("issue_id", "signal_login_storm");
            summary.addProperty("login_disconnects", state.loginDisconnects);
            summary.addProperty("successful_joins", state.successfulJoins);
            summary.addProperty("detail", CollectSupport.getString(ev, "detail"));
            optional.add("login_storm", summary);
        }
    }

    private static void recordLeave(
            JsonObject staging,
            ScanState state,
            ZonedDateTime ts,
            String player,
            String rel,
            int lineNo,
            String stripped) {
        state.playerRawEvents.add(new PlayerTracker.PlayerRawEvent(ts, "leave", player));
        long epoch = (long) CollectSupport.epochSeconds(ts);
        state.recentLeaveEpochs.add(epoch);
        state.recentLeaveEpochs.removeIf(e -> epoch - e > 60);
        if (state.recentLeaveEpochs.size() >= 5 && !state.disconnectStormEmitted) {
            state.disconnectStormEmitted = true;
            JsonObject ev = new JsonObject();
            ev.addProperty("time", CollectSupport.iso(ts));
            ev.addProperty("type", "disconnect_storm");
            ev.addProperty("source", "log");
            ev.addProperty("detail", state.recentLeaveEpochs.size() + " disconnects in 60s");
            ev.addProperty("importance", 7);
            JsonArray evArr = new JsonArray();
            evArr.add(CollectSupport.evidence(rel, lineNo, stripped, CollectSupport.iso(ts)));
            ev.add("evidence", evArr);
            CollectSupport.appendEvent(staging, ev);
        }
    }

    private static void accumulateFml(String stripped, ScanState state) {
        String s = stripped.strip();
        if (LogPatterns.FML_ISSUE_HEADER.matcher(s).matches()
                || s.startsWith("-- Mod loading issue")) {
            state.fmlAccumulating = true;
            if (state.fmlBlockBuf.length() > 0) {
                state.fmlBlockBuf.append('\n');
            }
            state.fmlBlockBuf.append(stripped).append('\n');
            return;
        }
        if (state.fmlAccumulating) {
            state.fmlBlockBuf.append(stripped).append('\n');
            if (s.startsWith("-- ") && s.endsWith(" --") && !s.contains("Mod loading issue")) {
                state.fmlAccumulating = false;
            } else if (s.isEmpty() && state.fmlBlockBuf.toString().contains("Failure message:")) {
                // keep accumulating through blank lines inside a block
            }
        }
    }

    private static void updateChunkyEntry(Matcher cm, ZonedDateTime ts, String rel, int lineNo, ScanState state) {
        JsonObject entry = ChunkyLogSupport.buildEntryFromMatcher(cm, ts, rel, lineNo);
        long processed = entry.get("chunks").getAsLong();
        if (state.chunkyState.lastProcessed >= 0 && processed != state.chunkyState.lastProcessed) {
            state.chunkyState.lastProcessedChangeEpoch = (long) CollectSupport.epochSeconds(ts);
        }
        state.chunkyState.lastProcessed = processed;
        ChunkyLogSupport.applyEntry(state.chunkyState, entry, ts);
        state.chunkyFirst = state.chunkyState.first;
        state.chunkyLast = state.chunkyState.last;
        state.chunkyRateVals.clear();
        state.chunkyRateVals.addAll(state.chunkyState.rateVals);
    }

    private static void updatePregenEntry(Matcher pm, ZonedDateTime ts, String rel, int lineNo, ScanState state) {
        JsonObject entry = PregenLogSupport.buildEntryFromMatcher(pm, ts, rel, lineNo);
        PregenLogSupport.PregenState scratch = new PregenLogSupport.PregenState();
        scratch.pregenFirst = state.pregenFirst;
        scratch.pregenLast = state.pregenLast;
        scratch.cpsVals.addAll(state.cpsVals);
        PregenLogSupport.applyEntry(scratch, entry, ts);
        state.pregenFirst = scratch.pregenFirst;
        state.pregenLast = scratch.pregenLast;
        state.cpsVals.clear();
        state.cpsVals.addAll(scratch.cpsVals);
    }

    static JsonObject buildDhPregen(
            JsonObject pregenFirst,
            JsonObject pregenLast,
            List<Integer> cpsVals,
            ZonedDateTime now,
            ZonedDateTime serverStarted) {
        return PregenLogSupport.buildDhPregen(pregenFirst, pregenLast, cpsVals, now, serverStarted);
    }

    private static JsonObject slicePregen(JsonObject entry) {
        return PregenLogSupport.slicePregen(entry);
    }

    private static final class ScanState {
        final ZonedDateTime now;
        final PlayerTracker players;
        final List<PlayerTracker.PlayerRawEvent> playerRawEvents = new ArrayList<>();
        final List<Pattern> errorIgnore;
        final List<JsonObject> tickLagEvidence = new ArrayList<>();
        final Set<String> tickLagSeen = new HashSet<>();
        final List<JsonObject> oomEvidence = new ArrayList<>();
        final List<Integer> cpsVals = new ArrayList<>();
        final Map<String, Integer> errorSigs = new HashMap<>();
        ZonedDateTime maxTs;
        String maxLine = "";
        String maxFile = "";
        int maxLineNo;
        JsonObject pregenFirst;
        JsonObject pregenLast;
        JsonObject chunkyFirst;
        JsonObject chunkyLast;
        final List<Double> chunkyRateVals = new ArrayList<>();
        final ChunkyLogSupport.ChunkyState chunkyState = new ChunkyLogSupport.ChunkyState();
        int worstTickMs;
        ZonedDateTime serverStarted;
        int errorCount;
        int fatalCount;
        final Map<String, Integer> startupWarnCounts = StartupWarnings.newCounter();
        final ModLogAnalyzer modLogAnalyzer = new ModLogAnalyzer();
        final ClientLogAttributor clientLogAttributor;
        boolean bootComplete;
        final List<String> bootLines = new ArrayList<>();
        boolean mapRenderActive;
        String mapRenderSource;
        String mapRenderLastLine;
        final StringBuilder fmlBlockBuf = new StringBuilder();
        boolean fmlAccumulating;
        final List<Long> recentLeaveEpochs = new ArrayList<>();
        boolean disconnectStormEmitted;
        int loginDisconnects;
        int successfulJoins;
        boolean loginStormEmitted;
        final List<JsonObject> loginDisconnectEvidence = new ArrayList<>();
        DbAddonSignatures.Hit dbAddonBest;
        final List<JsonObject> dbAddonEvidence = new ArrayList<>();

        ScanState(ZonedDateTime now, List<Pattern> errorIgnore, Set<String> knownModIds) {
            this.now = now;
            this.players = new PlayerTracker(now);
            this.errorIgnore = errorIgnore;
            this.clientLogAttributor = new ClientLogAttributor(knownModIds);
            this.bootComplete = false;
            this.mapRenderActive = false;
            this.mapRenderSource = null;
            this.mapRenderLastLine = null;
            this.fmlAccumulating = false;
            this.disconnectStormEmitted = false;
            this.loginDisconnects = 0;
            this.successfulJoins = 0;
            this.loginStormEmitted = false;
            this.dbAddonBest = null;
        }
    }

    private static void maybeRecordDbAddon(
            String stripped, String rel, int lineNo, ZonedDateTime ts, ScanState state) {
        DbAddonSignatures.Hit hit = DbAddonSignatures.match(stripped);
        if (hit == null) {
            return;
        }
        if (state.dbAddonEvidence.size() < 5) {
            state.dbAddonEvidence.add(
                    CollectSupport.evidence(rel, lineNo, stripped, ts != null ? CollectSupport.iso(ts) : null));
        }
        state.dbAddonBest = preferDbAddonHit(state.dbAddonBest, hit);
    }

    /** Prefer MariaDB ACL core-disable over GLRA connection-only fails when both appear. */
    static DbAddonSignatures.Hit preferDbAddonHit(DbAddonSignatures.Hit current, DbAddonSignatures.Hit next) {
        if (next == null) {
            return current;
        }
        if (current == null) {
            return next;
        }
        if (DbAddonSignatures.KIND_ACL.equals(next.kind())
                && !DbAddonSignatures.KIND_ACL.equals(current.kind())) {
            return next;
        }
        return current;
    }

    private static void emitDbAddonFail(JsonObject staging, ScanState state) {
        if (state.dbAddonBest == null) {
            return;
        }
        DbAddonSignatures.Hit best = state.dbAddonBest;
        String detail;
        if (DbAddonSignatures.KIND_ACL.equals(best.kind())) {
            detail = "GriefLogger disabled — MariaDB host ACL (1130) blocked database access";
        } else {
            detail = "GriefLogger Rollback Addon (griefloggerrollbackaddon) database connection failed";
        }
        JsonObject ev = new JsonObject();
        ev.addProperty("time", CollectSupport.iso(state.now));
        ev.addProperty("type", "db_addon_fail");
        ev.addProperty("source", "log");
        ev.addProperty("detail", detail);
        ev.addProperty("importance", 8);
        ev.addProperty("kind", best.kind());
        ev.addProperty("primary_mod", best.modId());
        JsonArray evArr = new JsonArray();
        for (JsonObject evidence : state.dbAddonEvidence) {
            evArr.add(evidence.deepCopy());
        }
        ev.add("evidence", evArr);
        CollectSupport.appendEvent(staging, ev);

        JsonObject optional = staging.getAsJsonObject("optional");
        if (optional != null) {
            JsonObject summary = new JsonObject();
            summary.addProperty("active", true);
            summary.addProperty("issue_id", DbAddonSignatures.ISSUE_ID);
            summary.addProperty("kind", best.kind());
            summary.addProperty("primary_mod", best.modId());
            summary.addProperty("detail", detail);
            summary.add("evidence", evArr.deepCopy());
            optional.add("db_addon_fail", summary);
        }
    }

    private static boolean isJadeSidecar(Path logPath) {
        if (logPath == null) {
            return false;
        }
        String name = logPath.getFileName() != null ? logPath.getFileName().toString() : "";
        return "JadeErrorOutput.txt".equalsIgnoreCase(name);
    }

    private static Set<String> knownModIdsFromJars(String serverDir) {
        if (serverDir == null || serverDir.isBlank()) {
            return null;
        }
        try {
            JsonArray mods = ModJarMetadataReader.listModsFromDir(serverDir);
            if (mods == null || mods.isEmpty()) {
                return null;
            }
            Set<String> ids = new HashSet<>();
            for (var el : mods) {
                if (!el.isJsonObject()) {
                    continue;
                }
                if (el.getAsJsonObject().has("id") && !el.getAsJsonObject().get("id").isJsonNull()) {
                    ids.add(el.getAsJsonObject().get("id").getAsString());
                }
            }
            return ids.isEmpty() ? null : ids;
        } catch (Exception ignored) {
            return null;
        }
    }
}
