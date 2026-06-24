package dev.mcstatus.watchtower;

import dev.mcstatus.watchtower.core.report.ReportSchedule;
import net.minecraft.server.MinecraftServer;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Upserts key=value lines in watchtower/watchtower.conf while preserving comments.
 */
public final class WatchtowerConfWriter {

    private static final Pattern KEY_VALUE = Pattern.compile("^([A-Z_][A-Z0-9_]*)=(.*)$");

    private WatchtowerConfWriter() {
    }

    public static Map<String, String> readMap(Path conf) throws IOException {
        Map<String, String> map = new HashMap<>();
        if (!Files.isRegularFile(conf)) {
            return map;
        }
        for (String line : Files.readAllLines(conf, StandardCharsets.UTF_8)) {
            line = line.strip();
            if (line.isEmpty() || line.startsWith("#")) {
                continue;
            }
            Matcher m = KEY_VALUE.matcher(line);
            if (m.matches()) {
                map.put(m.group(1), m.group(2).strip());
            }
        }
        return map;
    }

    public static int readInt(Map<String, String> map, String key, int defaultValue) {
        String raw = map.get(key);
        if (raw == null || raw.isBlank()) {
            return defaultValue;
        }
        try {
            return Integer.parseInt(raw.trim());
        } catch (NumberFormatException e) {
            return defaultValue;
        }
    }

    public static boolean readBool(Map<String, String> map, String key, boolean defaultValue) {
        String raw = map.get(key);
        if (raw == null || raw.isBlank()) {
            return defaultValue;
        }
        String v = raw.toLowerCase(Locale.ROOT);
        return v.equals("1") || v.equals("true") || v.equals("yes");
    }

    public static int loadReportIntervalMinutes(Path conf) throws IOException {
        ReportSchedule schedule = loadReportSchedule(conf);
        if (schedule.mode() == ReportSchedule.ScheduleMode.INTERVAL) {
            return schedule.intervalMinutes();
        }
        if (schedule.mode() == ReportSchedule.ScheduleMode.WALL_CLOCK) {
            return 720;
        }
        return 0;
    }

    public static ReportSchedule loadReportSchedule(Path conf) throws IOException {
        return ReportSchedule.fromMap(readMap(conf));
    }

    public static void persistReportIntervalMinutes(MinecraftServer server, int minutes) throws IOException {
        ReportSchedule schedule = minutes <= 0 ? ReportSchedule.off() : ReportSchedule.interval(minutes);
        persistReportSchedule(server, schedule);
    }

    public static void persistReportSchedule(MinecraftServer server, ReportSchedule schedule) throws IOException {
        Path conf = WatchtowerPaths.confPath(server);
        if (schedule.mode() == ReportSchedule.ScheduleMode.OFF) {
            upsertKey(conf, ReportSchedule.KEY_MODE, "off");
            upsertKey(conf, ReportSchedule.KEY_INTERVAL_MINUTES, "0");
        } else if (schedule.mode() == ReportSchedule.ScheduleMode.INTERVAL) {
            upsertKey(conf, ReportSchedule.KEY_MODE, ReportSchedule.MODE_INTERVAL);
            upsertKey(conf, ReportSchedule.KEY_INTERVAL_MINUTES, String.valueOf(schedule.intervalMinutes()));
        } else {
            upsertKey(conf, ReportSchedule.KEY_MODE, ReportSchedule.MODE_WALL_CLOCK);
            upsertKey(conf, ReportSchedule.KEY_WALL_CLOCK_HOURS,
                    ReportSchedule.wallClockHoursToString(schedule.wallClockHours()));
            upsertKey(conf, ReportSchedule.KEY_INTERVAL_MINUTES, "720");
        }
        WatchtowerBootstrap.getScheduler().setReportSchedule(schedule);
    }

    public static void upsertKey(Path conf, String key, String value) throws IOException {
        String text = Files.isRegularFile(conf) ? Files.readString(conf, StandardCharsets.UTF_8) : "";
        String updated = upsertLine(text, key, value);
        Files.writeString(conf, updated, StandardCharsets.UTF_8);
    }

    public static String upsertLine(String text, String key, String value) {
        String line = key + "=" + value;
        String pattern = "(?m)^" + key + "=.*$";
        if (text.matches("(?s).*" + pattern + ".*")) {
            return text.replaceAll(pattern, line);
        }
        if (text.isEmpty()) {
            return line + System.lineSeparator();
        }
        return text.stripTrailing() + System.lineSeparator() + line + System.lineSeparator();
    }

    public static String mergeBackupDirs(String existingCsv, List<String> newDirs) {
        Set<String> merged = new LinkedHashSet<>();
        if (existingCsv != null && !existingCsv.isBlank()) {
            for (String part : existingCsv.split(",")) {
                String trimmed = part.strip();
                if (!trimmed.isEmpty()) {
                    merged.add(trimmed);
                }
            }
        }
        if (newDirs != null) {
            for (String d : newDirs) {
                if (d != null && !d.isBlank()) {
                    merged.add(d.strip());
                }
            }
        }
        return String.join(",", new ArrayList<>(merged));
    }
}
