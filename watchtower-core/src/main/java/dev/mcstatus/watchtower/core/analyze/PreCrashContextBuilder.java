package dev.mcstatus.watchtower.core.analyze;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.collect.CollectSupport;
import dev.mcstatus.watchtower.core.collect.LogPatterns;
import dev.mcstatus.watchtower.core.live.LiveHistoryStore;
import dev.mcstatus.watchtower.core.util.TimeParse;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;

/**
 * Builds pre-crash context (TPS, chunk gen, commands) for a crash timestamp.
 */
public final class PreCrashContextBuilder {

    private static final int DEFAULT_WINDOW_MINUTES = 10;
    private static final int MAX_COMMANDS = 15;
    private static final int MAX_LOG_TAIL = 8;
    private static final int LOG_TAIL_LINES = 12_000;

    private PreCrashContextBuilder() {
    }

    public static JsonObject build(
            long crashEpochSec,
            int windowMinutes,
            LiveHistoryStore store,
            Path logPath,
            JsonObject optional,
            JsonArray events) {
        int minutes = windowMinutes > 0 ? windowMinutes : DEFAULT_WINDOW_MINUTES;
        long startEpoch = crashEpochSec - (long) minutes * 60L;

        JsonObject out = new JsonObject();
        out.addProperty("window_minutes", minutes);

        boolean hasLive = false;
        if (store != null) {
            JsonObject live = store.getWindowBefore(crashEpochSec, minutes);
            if (live.has("tps")) {
                out.add("tps", live.getAsJsonObject("tps"));
            }
            if (live.has("mspt")) {
                out.add("mspt", live.getAsJsonObject("mspt"));
            }
            if (live.has("players")) {
                out.add("players", live.getAsJsonObject("players"));
            }
            if (live.has("retention_hours")) {
                out.addProperty("retention_hours", live.get("retention_hours").getAsInt());
            }
            JsonObject tps = live.has("tps") ? live.getAsJsonObject("tps") : null;
            hasLive = tps != null && tps.has("points") && tps.getAsJsonArray("points").size() > 0;
        }

        JsonObject chunkGen = buildChunkGen(startEpoch, crashEpochSec, logPath, optional);
        if (chunkGen != null) {
            out.add("chunk_gen", chunkGen);
        }

        JsonArray commands = buildCommands(startEpoch, crashEpochSec, logPath, optional, events);
        if (!commands.isEmpty()) {
            out.add("commands", commands);
        }

        JsonArray logTail = buildLogTail(startEpoch, crashEpochSec, logPath);
        if (!logTail.isEmpty()) {
            out.add("log_tail", logTail);
        }

        if (!hasLive) {
            out.addProperty("unavailable_reason",
                    "Live history only covers recent uptime — no samples before this crash.");
        }
        return out;
    }

    private static JsonObject buildChunkGen(long startEpoch, long endEpoch, Path logPath, JsonObject optional) {
        JsonObject fromLog = chunkGenFromLog(startEpoch, endEpoch, logPath);
        if (fromLog != null) {
            return fromLog;
        }
        if (optional == null || !optional.has("dh_pregen")) {
            return null;
        }
        JsonObject dh = optional.getAsJsonObject("dh_pregen");
        JsonObject last = dh.has("last") ? dh.getAsJsonObject("last") : null;
        if (last == null) {
            return null;
        }
        Instant lastTime = TimeParse.parseTime(str(last, "time"));
        if (lastTime == null || lastTime.getEpochSecond() < startEpoch || lastTime.getEpochSecond() > endEpoch) {
            if (!bool(dh, "pregen_active", false)) {
                return null;
            }
        }
        JsonObject out = new JsonObject();
        out.addProperty("active", bool(dh, "pregen_active", false));
        out.addProperty("source", "dh_pregen");
        if (str(last, "quote") != null) {
            out.addProperty("last_line", str(last, "quote"));
        }
        if (last.has("pct") && !last.get("pct").isJsonNull()) {
            out.addProperty("pct", last.get("pct").getAsDouble());
        }
        return out;
    }

    private static JsonObject chunkGenFromLog(long startEpoch, long endEpoch, Path logPath) {
        if (logPath == null || !Files.isRegularFile(logPath)) {
            return null;
        }
        JsonObject bestDh = null;
        long bestDhEpoch = 0;
        JsonObject bestChunky = null;
        long bestChunkyEpoch = 0;
        try {
            List<String> lines = tailLines(logPath, LOG_TAIL_LINES);
            for (String line : lines) {
                ZonedDateTime ts = CollectSupport.parseLogTs(line);
                if (ts == null) {
                    continue;
                }
                long epoch = ts.toEpochSecond();
                if (epoch < startEpoch || epoch > endEpoch) {
                    continue;
                }
                Matcher dh = LogPatterns.PREGEN.matcher(line);
                if (dh.find()) {
                    if (epoch >= bestDhEpoch) {
                        bestDhEpoch = epoch;
                        bestDh = new JsonObject();
                        bestDh.addProperty("active", true);
                        bestDh.addProperty("source", "dh_pregen");
                        bestDh.addProperty("last_line", line.strip());
                        if (dh.group(4) != null) {
                            try {
                                bestDh.addProperty("pct", Double.parseDouble(dh.group(4)));
                            } catch (NumberFormatException ignored) {
                            }
                        }
                    }
                }
                Matcher chunky = LogPatterns.CHUNKY_PROGRESS.matcher(line);
                if (chunky.find()) {
                    if (epoch >= bestChunkyEpoch) {
                        bestChunkyEpoch = epoch;
                        bestChunky = new JsonObject();
                        bestChunky.addProperty("active", true);
                        bestChunky.addProperty("source", "chunky");
                        bestChunky.addProperty("last_line", line.strip());
                        try {
                            bestChunky.addProperty("pct", Double.parseDouble(chunky.group(1)));
                        } catch (NumberFormatException ignored) {
                        }
                    }
                }
            }
        } catch (IOException ignored) {
            return null;
        }
        if (bestDh != null) {
            return bestDh;
        }
        return bestChunky;
    }

    private static JsonArray buildLogTail(long startEpoch, long endEpoch, Path logPath) {
        JsonArray out = new JsonArray();
        if (logPath == null || !Files.isRegularFile(logPath)) {
            return out;
        }
        List<String> inWindow = new ArrayList<>();
        try {
            for (String line : tailLines(logPath, LOG_TAIL_LINES)) {
                ZonedDateTime ts = CollectSupport.parseLogTs(line);
                if (ts == null) {
                    continue;
                }
                long epoch = ts.toEpochSecond();
                if (epoch < startEpoch || epoch > endEpoch) {
                    continue;
                }
                inWindow.add(line.strip());
            }
        } catch (IOException ignored) {
            return out;
        }
        int from = Math.max(0, inWindow.size() - MAX_LOG_TAIL);
        for (int i = from; i < inWindow.size(); i++) {
            out.add(inWindow.get(i));
        }
        return out;
    }

    private static JsonArray buildCommands(
            long startEpoch,
            long endEpoch,
            Path logPath,
            JsonObject optional,
            JsonArray events) {
        List<CommandRow> rows = new ArrayList<>();

        if (logPath != null && Files.isRegularFile(logPath)) {
            try {
                for (String line : tailLines(logPath, LOG_TAIL_LINES)) {
                    ZonedDateTime ts = CollectSupport.parseLogTs(line);
                    if (ts == null) {
                        continue;
                    }
                    long epoch = ts.toEpochSecond();
                    if (epoch < startEpoch || epoch > endEpoch) {
                        continue;
                    }
                    Matcher issued = LogPatterns.COMMAND_ISSUED.matcher(line);
                    if (issued.find()) {
                        String player = extractPlayer(line);
                        rows.add(new CommandRow(epoch, CollectSupport.iso(ts), player, issued.group(1).strip(), null));
                        continue;
                    }
                    Matcher console = LogPatterns.CONSOLE_COMMAND.matcher(line);
                    if (console.find()) {
                        rows.add(new CommandRow(epoch, CollectSupport.iso(ts), null, console.group(1).strip(), null));
                    }
                }
            } catch (IOException ignored) {
            }
        }

        if (optional != null && optional.has("crafty_commands")) {
            for (JsonElement el : optional.getAsJsonArray("crafty_commands")) {
                if (!el.isJsonObject()) {
                    continue;
                }
                JsonObject cmd = el.getAsJsonObject();
                Instant t = TimeParse.parseTime(str(cmd, "time"));
                if (t == null || t.getEpochSecond() < startEpoch || t.getEpochSecond() > endEpoch) {
                    continue;
                }
                String command = str(cmd, "cmd");
                if (command == null || command.isBlank()) {
                    continue;
                }
                rows.add(new CommandRow(t.getEpochSecond(), str(cmd, "time"), null, command, "panel"));
            }
        }

        if (events != null) {
            for (JsonElement el : events) {
                if (!el.isJsonObject()) {
                    continue;
                }
                JsonObject ev = el.getAsJsonObject();
                if (!"panel_command".equals(str(ev, "type"))) {
                    continue;
                }
                Instant t = TimeParse.parseTime(str(ev, "time"));
                if (t == null || t.getEpochSecond() < startEpoch || t.getEpochSecond() > endEpoch) {
                    continue;
                }
                String detail = str(ev, "detail");
                if (detail == null || detail.isBlank()) {
                    continue;
                }
                rows.add(new CommandRow(t.getEpochSecond(), str(ev, "time"), null, detail, "panel"));
            }
        }

        rows.sort(Comparator.comparingLong(CommandRow::epoch).reversed());
        JsonArray out = new JsonArray();
        int limit = Math.min(MAX_COMMANDS, rows.size());
        for (int i = 0; i < limit; i++) {
            CommandRow row = rows.get(i);
            JsonObject o = new JsonObject();
            o.addProperty("time", row.timeIso());
            if (row.player() != null) {
                o.addProperty("player", row.player());
            }
            if (row.source() != null) {
                o.addProperty("source", row.source());
            }
            o.addProperty("command", row.command());
            out.add(o);
        }
        return out;
    }

    private static String extractPlayer(String line) {
        int bracket = line.indexOf("]:");
        if (bracket < 0) {
            return null;
        }
        String head = line.substring(0, bracket);
        int slash = head.lastIndexOf('/');
        if (slash >= 0 && slash + 1 < head.length()) {
            return head.substring(slash + 1).strip();
        }
        return null;
    }

    private static List<String> tailLines(Path path, int maxLines) throws IOException {
        List<String> all = Files.readAllLines(path, StandardCharsets.UTF_8);
        if (all.size() <= maxLines) {
            return all;
        }
        return all.subList(all.size() - maxLines, all.size());
    }

    private static String str(JsonObject o, String key) {
        if (o == null || !o.has(key) || o.get(key).isJsonNull()) {
            return null;
        }
        return o.get(key).getAsString();
    }

    private static boolean bool(JsonObject o, String key, boolean def) {
        if (o == null || !o.has(key) || o.get(key).isJsonNull()) {
            return def;
        }
        return o.get(key).getAsBoolean();
    }

    private record CommandRow(long epoch, String timeIso, String player, String command, String source) {
    }
}
