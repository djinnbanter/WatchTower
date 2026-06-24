package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.report.ReportConfig;

import java.io.IOException;
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
        JsonObject mc = staging.getAsJsonObject("minecraft");
        List<Path> logFiles = GzipLineReader.iterLogFiles(serverDir, config.logGzipCount(), cutoff);
        ZonedDateTime now = ZonedDateTime.now();

        ScanState state = new ScanState(now, config.errorIgnorePatterns());

        for (Path logPath : logFiles) {
            String rel = CollectSupport.relLogPath(serverDir, logPath);
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
        JsonArray clientWarnings = state.clientLogAttributor.toJsonArray();
        if (!clientWarnings.isEmpty()) {
            staging.getAsJsonObject("optional").add("client_class_warnings_by_mod", clientWarnings);
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
        state.modLogAnalyzer.processLine(stripped);
        state.clientLogAttributor.processLine(stripped);
        if (ts != null && CollectSupport.epochSeconds(ts) >= cutoff) {
            mc.addProperty("log_had_activity_in_window", true);
        }
        if (ts != null && (state.maxTs == null || ts.isAfter(state.maxTs))) {
            state.maxTs = ts;
            state.maxLine = stripped;
            state.maxFile = rel;
            state.maxLineNo = lineNo;
        }

        if (stripped.contains("Done (") && stripped.contains("/INFO]")) {
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

        if (stripped.contains("Can't keep up")) {
            Matcher m = LogPatterns.TICK_LAG_MS.matcher(stripped);
            int msBehind = m.find() ? Integer.parseInt(m.group(1)) : 0;
            String lagKey = (ts != null ? CollectSupport.iso(ts) : stripped.substring(0, Math.min(40, stripped.length())))
                    + "|" + msBehind;
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

        if (ts != null) {
            Matcher jm = LogPatterns.PLAYER_JOIN.matcher(stripped);
            if (jm.find()) {
                state.playerRawEvents.add(new PlayerTracker.PlayerRawEvent(ts, "join", jm.group(1).strip()));
            }
            Matcher lm = LogPatterns.PLAYER_LEAVE.matcher(stripped);
            if (lm.find()) {
                state.playerRawEvents.add(new PlayerTracker.PlayerRawEvent(ts, "leave", lm.group(1).strip()));
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
        final ClientLogAttributor clientLogAttributor = new ClientLogAttributor();

        ScanState(ZonedDateTime now, List<Pattern> errorIgnore) {
            this.now = now;
            this.players = new PlayerTracker(now);
            this.errorIgnore = errorIgnore;
        }
    }
}
