package dev.mcstatus.watchtower.core.report;

import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.TreeSet;
import java.util.stream.Collectors;

/**
 * Wall-clock and interval scheduling for full health reports.
 */
public final class ReportSchedule {

    public static final String MODE_WALL_CLOCK = "wall_clock";
    public static final String MODE_INTERVAL = "interval";
    public static final String KEY_MODE = "REPORT_SCHEDULE_MODE";
    public static final String KEY_WALL_CLOCK_HOURS = "REPORT_WALL_CLOCK_HOURS";
    public static final String KEY_INTERVAL_MINUTES = "REPORT_INTERVAL_MINUTES";
    public static final List<Integer> DEFAULT_WALL_CLOCK_HOURS = List.of(0, 12);
    public static final int MISSED_SLOT_GRACE_MINUTES = 120;

    private final ScheduleMode mode;
    private final List<Integer> wallClockHours;
    private final int intervalMinutes;

    public enum ScheduleMode {
        OFF,
        WALL_CLOCK,
        INTERVAL
    }

    private ReportSchedule(ScheduleMode mode, List<Integer> wallClockHours, int intervalMinutes) {
        this.mode = mode;
        this.wallClockHours = wallClockHours;
        this.intervalMinutes = intervalMinutes;
    }

    public static ReportSchedule off() {
        return new ReportSchedule(ScheduleMode.OFF, List.of(), 0);
    }

    public static ReportSchedule wallClock(List<Integer> hours) {
        List<Integer> normalized = normalizeHours(hours);
        if (normalized.isEmpty()) {
            return off();
        }
        return new ReportSchedule(ScheduleMode.WALL_CLOCK, normalized, 0);
    }

    public static ReportSchedule interval(int minutes) {
        if (minutes <= 0) {
            return off();
        }
        return new ReportSchedule(ScheduleMode.INTERVAL, List.of(), minutes);
    }

    public static ReportSchedule fromMap(Map<String, String> map) {
        if (map == null || map.isEmpty()) {
            return wallClock(DEFAULT_WALL_CLOCK_HOURS);
        }
        boolean hasMode = map.containsKey(KEY_MODE);
        boolean hasInterval = map.containsKey(KEY_INTERVAL_MINUTES);
        if (!hasMode && hasInterval) {
            int minutes = readInt(map, KEY_INTERVAL_MINUTES, 0);
            return minutes <= 0 ? off() : interval(minutes);
        }
        String modeRaw = map.getOrDefault(KEY_MODE, MODE_WALL_CLOCK).trim().toLowerCase(Locale.ROOT);
        if ("off".equals(modeRaw) || "disabled".equals(modeRaw)) {
            return off();
        }
        if (MODE_INTERVAL.equals(modeRaw)) {
            int minutes = readInt(map, KEY_INTERVAL_MINUTES, 720);
            return minutes <= 0 ? off() : interval(minutes);
        }
        List<Integer> hours = parseHours(map.get(KEY_WALL_CLOCK_HOURS));
        if (hours.isEmpty()) {
            hours = DEFAULT_WALL_CLOCK_HOURS;
        }
        return wallClock(hours);
    }

    public ScheduleMode mode() {
        return mode;
    }

    public List<Integer> wallClockHours() {
        return wallClockHours;
    }

    public int intervalMinutes() {
        return intervalMinutes;
    }

    public boolean isEnabled() {
        return mode != ScheduleMode.OFF;
    }

    /** Minutes until next report, or -1 when off. */
    public int minutesUntilNext(LocalDateTime now) {
        return minutesUntilNext(now, null);
    }

    public int minutesUntilNext(LocalDateTime now, String lastFiredSlotKey) {
        if (mode == ScheduleMode.OFF) {
            return -1;
        }
        if (mode == ScheduleMode.INTERVAL) {
            return -1;
        }
        LocalDateTime next = nextWallClockSlot(now, lastFiredSlotKey);
        long minutes = ChronoUnit.MINUTES.between(now.truncatedTo(ChronoUnit.MINUTES), next);
        return (int) Math.max(1, minutes);
    }

    public LocalDateTime nextWallClockSlot(LocalDateTime now) {
        return nextWallClockSlot(now, null);
    }

    public LocalDateTime nextWallClockSlot(LocalDateTime now, String lastFiredSlotKey) {
        LocalDateTime truncated = now.truncatedTo(ChronoUnit.MINUTES);
        for (int dayOffset = 0; dayOffset <= 1; dayOffset++) {
            for (int hour : wallClockHours) {
                LocalDateTime candidate = truncated.toLocalDate()
                        .plusDays(dayOffset)
                        .atTime(hour, 0);
                String key = slotKey(candidate);
                if (candidate.isAfter(truncated) && !key.equals(lastFiredSlotKey)) {
                    return candidate;
                }
            }
        }
        int firstHour = wallClockHours.get(0);
        return truncated.toLocalDate().plusDays(1).atTime(firstHour, 0);
    }

    /**
     * Returns slot key when a wall-clock report should fire, or null.
     *
     * @param now              current time
     * @param lastFiredSlotKey last fired slot (yyyy-MM-ddTHH)
     * @param lastReportAt     optional last report time for missed-slot grace
     */
    public String dueWallClockSlot(LocalDateTime now, String lastFiredSlotKey, LocalDateTime lastReportAt) {
        if (mode != ScheduleMode.WALL_CLOCK) {
            return null;
        }
        LocalDateTime truncated = now.truncatedTo(ChronoUnit.MINUTES);
        for (int dayOffset = 0; dayOffset >= -1; dayOffset--) {
            for (int hour : descendingHours()) {
                LocalDateTime slot = truncated.toLocalDate().plusDays(dayOffset).atTime(hour, 0);
                if (slot.isAfter(truncated)) {
                    continue;
                }
                String key = slotKey(slot);
                if (key.equals(lastFiredSlotKey)) {
                    continue;
                }
                if (truncated.equals(slot) || (truncated.isAfter(slot) && ChronoUnit.MINUTES.between(slot, truncated) <= 1)) {
                    return key;
                }
                if (lastReportAt != null && lastReportAt.isBefore(slot)
                        && ChronoUnit.MINUTES.between(slot, truncated) <= MISSED_SLOT_GRACE_MINUTES) {
                    return key;
                }
            }
        }
        return null;
    }

    public static String slotKey(LocalDateTime slot) {
        return slot.format(DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH"));
    }

    public String describe() {
        if (mode == ScheduleMode.OFF) {
            return "off";
        }
        if (mode == ScheduleMode.INTERVAL) {
            return "every " + intervalMinutes + " minutes";
        }
        String times = wallClockHours.stream()
                .map(ReportSchedule::formatHour)
                .collect(Collectors.joining(" and "));
        return "twice daily at " + times + " (server time)";
    }

    public static String formatHour(int hour) {
        if (hour == 0) {
            return "00:00";
        }
        if (hour == 12) {
            return "12:00";
        }
        return String.format(Locale.ROOT, "%02d:00", hour);
    }

    public static List<Integer> parseHours(String raw) {
        if (raw == null || raw.isBlank()) {
            return List.of();
        }
        List<Integer> out = new ArrayList<>();
        for (String part : raw.split(",")) {
            String trimmed = part.trim();
            if (trimmed.isEmpty()) {
                continue;
            }
            try {
                int h = Integer.parseInt(trimmed);
                if (h >= 0 && h <= 23) {
                    out.add(h);
                }
            } catch (NumberFormatException ignored) {
            }
        }
        return normalizeHours(out);
    }

    public static List<Integer> normalizeHours(List<Integer> hours) {
        if (hours == null || hours.isEmpty()) {
            return List.of();
        }
        TreeSet<Integer> sorted = new TreeSet<>();
        for (Integer h : hours) {
            if (h != null && h >= 0 && h <= 23) {
                sorted.add(h);
            }
        }
        return Collections.unmodifiableList(new ArrayList<>(sorted));
    }

    public static String wallClockHoursToString(List<Integer> hours) {
        return normalizeHours(hours).stream()
                .map(String::valueOf)
                .collect(Collectors.joining(","));
    }

    public static LocalDateTime parseIso(String iso) {
        if (iso == null || iso.isBlank()) {
            return null;
        }
        try {
            return LocalDateTime.parse(iso, DateTimeFormatter.ISO_LOCAL_DATE_TIME);
        } catch (Exception e) {
            return null;
        }
    }

    public static String toIso(LocalDateTime time) {
        return time == null ? null : time.format(DateTimeFormatter.ISO_LOCAL_DATE_TIME);
    }

    public static ZoneId serverZone() {
        return ZoneId.systemDefault();
    }

    private List<Integer> descendingHours() {
        List<Integer> copy = new ArrayList<>(wallClockHours);
        copy.sort(Collections.reverseOrder());
        return copy;
    }

    private static int readInt(Map<String, String> map, String key, int defaultValue) {
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

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof ReportSchedule that)) {
            return false;
        }
        return intervalMinutes == that.intervalMinutes
                && mode == that.mode
                && Objects.equals(wallClockHours, that.wallClockHours);
    }

    @Override
    public int hashCode() {
        return Objects.hash(mode, wallClockHours, intervalMinutes);
    }
}
