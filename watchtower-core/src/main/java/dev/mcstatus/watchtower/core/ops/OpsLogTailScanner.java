package dev.mcstatus.watchtower.core.ops;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.collect.CollectSupport;
import dev.mcstatus.watchtower.core.collect.LogPatterns;
import dev.mcstatus.watchtower.core.collect.ModLogAnalyzer;
import dev.mcstatus.watchtower.core.report.StateManager;

import java.io.IOException;
import java.io.RandomAccessFile;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;

/**
 * Unified incremental tail scan of {@code logs/latest.log} for activity ledger,
 * mod log errors, KubeJS failures, and background job signals.
 */
public final class OpsLogTailScanner {

    public static final int MAX_LEDGER_EVENTS = 500;
    public static final int DEFAULT_TAIL_LINES = 200;
    public static final int MAX_BYTES_PER_SCAN = 4 * 1024 * 1024;

    public record ScanResult(
            Instant scannedAt,
            int newActivityCount,
            List<JsonObject> activityEvents,
            JsonArray modLogErrors,
            List<JsonObject> kubejsFailures,
            List<JsonObject> backgroundJobs,
            JsonObject updatedOffset,
            JsonObject context,
            boolean hadNewData
    ) {
    }

    private OpsLogTailScanner() {
    }

    public static ScanResult scanIncremental(String serverDir, Path statePath, int tickLagThrottleMs)
            throws IOException {
        Path logPath = Path.of(serverDir, "logs", "latest.log");
        if (!Files.isRegularFile(logPath)) {
            return emptyResult(StateManager.getOpsLogOffset(statePath));
        }

        JsonObject priorOffset = StateManager.getOpsLogOffset(statePath);
        long fileSize = Files.size(logPath);
        long startOffset = resolveStartOffset(logPath, priorOffset, fileSize);
        if (fileSize <= startOffset) {
            return emptyResult(priorOffset);
        }

        long bytesToRead = Math.min(fileSize - startOffset, MAX_BYTES_PER_SCAN);
        String chunk = readUtf8Chunk(logPath, startOffset, bytesToRead);
        long newOffset = startOffset + bytesToRead;
        boolean truncated = bytesToRead < fileSize - startOffset;

        List<String> lines = chunk.lines().toList();
        if (startOffset > 0 && !lines.isEmpty()) {
            lines = lines.subList(1, lines.size());
        }

        long now = Instant.now().getEpochSecond();
        long lastTickLagAt = StateManager.getLastTickLagEventAt(statePath);
        ParseState state = new ParseState(tickLagThrottleMs, lastTickLagAt, now);
        for (String line : lines) {
            processLine(line, state);
        }

        JsonObject updatedOffset = new JsonObject();
        updatedOffset.addProperty("file", logPath.toString());
        updatedOffset.addProperty("byte_offset", newOffset);
        updatedOffset.addProperty("size", fileSize);
        if (truncated) {
            updatedOffset.addProperty("truncated", true);
        }
        StateManager.updateOpsLogOffset(statePath, updatedOffset);
        if (state.lastTickLagAt > lastTickLagAt) {
            StateManager.setLastTickLagEventAt(statePath, state.lastTickLagAt);
        }

        boolean hadNewData = !state.events.isEmpty()
                || state.modLogAnalyzer.toJsonArray().size() > 0
                || !state.kubejsFailures.isEmpty()
                || !state.backgroundJobs.isEmpty();
        return new ScanResult(
                Instant.now(),
                state.events.size(),
                state.events,
                state.modLogAnalyzer.toJsonArray(),
                List.copyOf(state.kubejsFailures),
                List.copyOf(state.backgroundJobs),
                updatedOffset,
                state.buildContext(),
                hadNewData
        );
    }

    public static ScanResult scanTail(String serverDir, int maxLines, int tickLagThrottleMs) throws IOException {
        Path logPath = Path.of(serverDir, "logs", "latest.log");
        if (!Files.isRegularFile(logPath)) {
            return emptyResult(new JsonObject());
        }

        List<String> allLines = Files.readAllLines(logPath, StandardCharsets.UTF_8);
        int start = Math.max(0, allLines.size() - maxLines);
        List<String> lines = allLines.subList(start, allLines.size());

        long now = Instant.now().getEpochSecond();
        ParseState state = new ParseState(tickLagThrottleMs, 0, now);
        for (String line : lines) {
            processLine(line, state);
        }
        boolean hadNewData = !state.events.isEmpty()
                || state.modLogAnalyzer.toJsonArray().size() > 0
                || !state.kubejsFailures.isEmpty()
                || !state.backgroundJobs.isEmpty();
        return new ScanResult(
                Instant.now(),
                state.events.size(),
                state.events,
                state.modLogAnalyzer.toJsonArray(),
                List.copyOf(state.kubejsFailures),
                List.copyOf(state.backgroundJobs),
                new JsonObject(),
                state.buildContext(),
                hadNewData
        );
    }

    private static long resolveStartOffset(Path logPath, JsonObject priorOffset, long fileSize) {
        if (!priorOffset.has("file") || !logPath.toString().equals(priorOffset.get("file").getAsString())) {
            return 0;
        }
        long priorSize = priorOffset.has("size") ? priorOffset.get("size").getAsLong() : 0;
        if (fileSize < priorSize) {
            return 0;
        }
        return priorOffset.has("byte_offset") ? priorOffset.get("byte_offset").getAsLong() : 0;
    }

    private static String readUtf8Chunk(Path logPath, long startOffset, long bytesToRead) throws IOException {
        try (RandomAccessFile raf = new RandomAccessFile(logPath.toFile(), "r")) {
            raf.seek(startOffset);
            byte[] buf = new byte[(int) bytesToRead];
            int read = raf.read(buf);
            if (read <= 0) {
                return "";
            }
            return new String(buf, 0, read, StandardCharsets.UTF_8);
        }
    }

    private static ScanResult emptyResult(JsonObject offset) {
        return new ScanResult(
                Instant.now(), 0, List.of(), new JsonArray(), List.of(), List.of(),
                offset, new JsonObject(), false);
    }

    static void processLine(String line, ParseState state) {
        String stripped = line.stripTrailing();
        ZonedDateTime ts = CollectSupport.parseLogTs(stripped);
        if (ts == null) {
            return;
        }

        state.modLogAnalyzer.processLine(stripped);
        detectKubejsFailure(stripped, ts, state);

        Matcher jm = LogPatterns.PLAYER_JOIN.matcher(stripped);
        if (jm.find()) {
            addEvent(state, ts, "player_join", jm.group(1).strip());
            state.recentJoinsLeaves.add(eventCopy(ts, "player_join", jm.group(1).strip()));
            return;
        }
        jm = LogPatterns.PLAYER_JOIN_BRACKET.matcher(stripped);
        if (jm.find()) {
            addEvent(state, ts, "player_join", jm.group(1).strip());
            state.recentJoinsLeaves.add(eventCopy(ts, "player_join", jm.group(1).strip()));
            return;
        }
        jm = LogPatterns.PLAYER_JOIN_ENTITY.matcher(stripped);
        if (jm.find()) {
            addEvent(state, ts, "player_join", jm.group(1).strip());
            state.recentJoinsLeaves.add(eventCopy(ts, "player_join", jm.group(1).strip()));
            return;
        }

        Matcher lm = LogPatterns.PLAYER_LEAVE.matcher(stripped);
        if (lm.find()) {
            addEvent(state, ts, "player_leave", lm.group(1).strip());
            state.recentJoinsLeaves.add(eventCopy(ts, "player_leave", lm.group(1).strip()));
            return;
        }
        lm = LogPatterns.PLAYER_LEAVE_BRACKET.matcher(stripped);
        if (lm.find()) {
            addEvent(state, ts, "player_leave", lm.group(1).strip());
            state.recentJoinsLeaves.add(eventCopy(ts, "player_leave", lm.group(1).strip()));
            return;
        }

        Matcher cm = LogPatterns.COMMAND_ISSUED.matcher(stripped);
        if (cm.find()) {
            String cmd = cm.group(1).strip();
            String player = extractCommandPlayer(stripped);
            JsonObject ev = addEvent(state, ts, "command", cmd);
            if (player != null) {
                ev.addProperty("player", player);
            }
            state.recentCommands.add(commandCopy(ts, player, cmd));
            return;
        }
        cm = LogPatterns.CONSOLE_COMMAND.matcher(stripped);
        if (cm.find()) {
            String cmd = cm.group(1).strip();
            addEvent(state, ts, "command", cmd);
            state.recentCommands.add(commandCopy(ts, null, cmd));
            return;
        }

        if (stripped.contains("Can't keep up")) {
            Matcher m = LogPatterns.TICK_LAG_MS.matcher(stripped);
            int msBehind = m.find() ? Integer.parseInt(m.group(1)) : 0;
            if (msBehind >= state.tickLagThrottleMs) {
                long epoch = (long) CollectSupport.epochSeconds(ts);
                if (epoch - state.lastTickLagAt >= 60) {
                    state.lastTickLagAt = epoch;
                    JsonObject ev = addEvent(state, ts, "tick_lag",
                            stripped.length() > 200 ? stripped.substring(0, 200) : stripped);
                    ev.addProperty("ms_behind", msBehind);
                }
            }
        }

        Matcher chunky = LogPatterns.CHUNKY_TASK.matcher(stripped);
        if (chunky.find() && stripped.contains("Server thread")) {
            addBackgroundJob(state, backgroundJob("chunky_pregen",
                    chunky.group(1) + " " + chunky.group(3) + "%"));
        }
        Matcher pregen = LogPatterns.PREGEN.matcher(stripped);
        if (pregen.find()) {
            addBackgroundJob(state, backgroundJob("dh_pregen",
                    pregen.group(2) + " chunks " + (pregen.group(4) != null ? pregen.group(4) + "%" : "")));
        }

        if (LogPatterns.BACKUP_JOB_START.matcher(stripped).find()) {
            String detail = jobDetailFromLine(stripped, 120);
            addBackgroundJob(state, backgroundJob("backup_job", detail));
            addEvent(state, ts, "backup_job", detail);
        } else if (LogPatterns.RESTART_SOON.matcher(stripped).find()
                || LogPatterns.RESTART_SCHEDULED.matcher(stripped).find()) {
            String detail = jobDetailFromLine(stripped, 120);
            addBackgroundJob(state, backgroundJob("restart_scheduled", detail));
            addEvent(state, ts, "restart_scheduled", detail);
        }

        if (state.logTail.size() < 20) {
            state.logTail.add(stripped.length() > 300 ? stripped.substring(0, 300) : stripped);
        } else {
            state.logTail.remove(0);
            state.logTail.add(stripped.length() > 300 ? stripped.substring(0, 300) : stripped);
        }
    }

    private static void detectKubejsFailure(String stripped, ZonedDateTime ts, ParseState state) {
        if (!LogPatterns.KUBEJS_ERROR.matcher(stripped).find()) {
            return;
        }
        String sample = stripped.length() > 240 ? stripped.substring(0, 240) : stripped;
        String key = CollectSupport.iso(ts) + "|" + sample;
        if (!state.kubejsKeys.add(key)) {
            return;
        }
        JsonObject row = new JsonObject();
        row.addProperty("time", CollectSupport.iso(ts));
        row.addProperty("mod_id", "kubejs");
        row.addProperty("sample_line", sample);
        if (stripped.toLowerCase().contains("error")) {
            row.addProperty("severity", "warning");
        }
        state.kubejsFailures.add(row);
    }

    private static void addBackgroundJob(ParseState state, JsonObject job) {
        String key = job.get("type").getAsString() + "|" + job.get("detail").getAsString();
        if (state.backgroundJobKeys.add(key)) {
            state.backgroundJobs.add(job);
        }
    }

    private static JsonObject backgroundJob(String type, String detail) {
        JsonObject o = new JsonObject();
        o.addProperty("type", type);
        o.addProperty("detail", detail.strip());
        return o;
    }

    private static String jobDetailFromLine(String stripped, int maxLen) {
        String detail = stripped;
        int bracket = stripped.indexOf("]: ");
        if (bracket >= 0 && bracket + 3 < stripped.length()) {
            detail = stripped.substring(bracket + 3).strip();
        }
        if (detail.length() > maxLen) {
            return detail.substring(0, maxLen);
        }
        return detail;
    }

    private static JsonObject commandCopy(ZonedDateTime ts, String player, String cmd) {
        JsonObject o = new JsonObject();
        o.addProperty("time", CollectSupport.iso(ts));
        o.addProperty("command", cmd);
        if (player != null) {
            o.addProperty("player", player);
        }
        return o;
    }

    private static JsonObject eventCopy(ZonedDateTime ts, String type, String detail) {
        JsonObject o = new JsonObject();
        o.addProperty("time", CollectSupport.iso(ts));
        o.addProperty("type", type);
        o.addProperty("detail", detail);
        return o;
    }

    private static String extractCommandPlayer(String line) {
        int idx = line.indexOf("issued server command");
        if (idx <= 0) {
            return null;
        }
        String head = line.substring(0, idx);
        int bracket = head.lastIndexOf(']');
        if (bracket >= 0 && bracket + 2 < head.length()) {
            String candidate = head.substring(bracket + 2).trim();
            if (!candidate.isEmpty() && !candidate.contains("/")) {
                return candidate.split("\\s+")[0];
            }
        }
        return null;
    }

    private static JsonObject addEvent(ParseState state, ZonedDateTime ts, String type, String detail) {
        String key = CollectSupport.iso(ts) + "|" + type + "|" + detail;
        if (!state.seen.add(key)) {
            return new JsonObject();
        }
        JsonObject ev = new JsonObject();
        ev.addProperty(OpsCacheSchema.EVENT_TIME, CollectSupport.iso(ts));
        ev.addProperty(OpsCacheSchema.EVENT_TYPE, type);
        ev.addProperty(OpsCacheSchema.EVENT_DETAIL, detail);
        ev.addProperty(OpsCacheSchema.EVENT_SOURCE, OpsCacheSchema.SOURCE_SCAN);
        state.events.add(ev);
        return ev;
    }

    public static JsonObject lagIncidentEvent(String incidentId, Instant when) {
        JsonObject ev = new JsonObject();
        ev.addProperty(OpsCacheSchema.EVENT_TIME, when.atZone(java.time.ZoneId.systemDefault())
                .format(java.time.format.DateTimeFormatter.ISO_OFFSET_DATE_TIME));
        ev.addProperty(OpsCacheSchema.EVENT_TYPE, "lag_incident");
        ev.addProperty(OpsCacheSchema.EVENT_DETAIL, "Lag spike captured");
        ev.addProperty(OpsCacheSchema.EVENT_INCIDENT_ID, incidentId);
        ev.addProperty(OpsCacheSchema.EVENT_SOURCE, OpsCacheSchema.SOURCE_SCAN);
        return ev;
    }

    static final class ParseState {
        final int tickLagThrottleMs;
        long lastTickLagAt;
        final long nowEpoch;
        final Set<String> seen = new HashSet<>();
        final List<JsonObject> events = new ArrayList<>();
        final List<JsonObject> recentCommands = new ArrayList<>();
        final List<JsonObject> recentJoinsLeaves = new ArrayList<>();
        final List<JsonObject> backgroundJobs = new ArrayList<>();
        final Set<String> backgroundJobKeys = new HashSet<>();
        final List<String> logTail = new ArrayList<>();
        final ModLogAnalyzer modLogAnalyzer = new ModLogAnalyzer();
        final List<JsonObject> kubejsFailures = new ArrayList<>();
        final Set<String> kubejsKeys = new HashSet<>();

        ParseState(int tickLagThrottleMs, long lastTickLagAt, long nowEpoch) {
            this.tickLagThrottleMs = tickLagThrottleMs;
            this.lastTickLagAt = lastTickLagAt;
            this.nowEpoch = nowEpoch;
        }

        JsonObject buildContext() {
            JsonObject ctx = new JsonObject();
            JsonArray cmds = new JsonArray();
            int cmdStart = Math.max(0, recentCommands.size() - 5);
            for (int i = cmdStart; i < recentCommands.size(); i++) {
                cmds.add(recentCommands.get(i));
            }
            ctx.add("recent_commands", cmds);

            JsonArray jl = new JsonArray();
            for (JsonObject ev : recentJoinsLeaves) {
                if (ev.has("time")) {
                    Instant t = dev.mcstatus.watchtower.core.util.TimeParse.parseTime(ev.get("time").getAsString());
                    if (t != null && t.getEpochSecond() >= nowEpoch - 120) {
                        jl.add(ev);
                    }
                }
            }
            ctx.add("recent_joins_leaves", jl);

            JsonArray jobs = new JsonArray();
            backgroundJobs.stream().distinct().limit(3).forEach(jobs::add);
            ctx.add("background_jobs", jobs);

            JsonArray tail = new JsonArray();
            logTail.forEach(tail::add);
            ctx.add("log_tail", tail);

            if (!kubejsFailures.isEmpty()) {
                JsonArray kube = new JsonArray();
                kubejsFailures.stream().limit(5).forEach(kube::add);
                ctx.add("kubejs_failures", kube);
            }
            return ctx;
        }
    }
}
