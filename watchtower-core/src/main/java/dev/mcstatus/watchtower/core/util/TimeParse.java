package dev.mcstatus.watchtower.core.util;

import java.time.Instant;
import java.time.LocalDateTime;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;

/**
 * Time parsing and formatting utilities ported from mc-status-analyze.py.
 */
public final class TimeParse {

    private static final DateTimeFormatter FMT_TZ_NO_FRAC =
            DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ssX");
    private static final DateTimeFormatter FMT_TZ_FRAC =
            DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss[.SSSSSSSSS][.SSSSSS][.SSS]X");
    private static final DateTimeFormatter FMT_OUT =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private TimeParse() {
    }

    public static Instant parseTime(String s) {
        if (s == null || s.isBlank()) {
            return null;
        }
        s = s.strip();
        DateTimeFormatter[] formats = {FMT_TZ_NO_FRAC, FMT_TZ_FRAC};
        for (int i = 0; i < 4; i++) {
            try {
                if (i < 2 && s.length() >= 6) {
                    char c = s.charAt(s.length() - 6);
                    if (c == '+' || c == '-') {
                        return OffsetDateTime.parse(s, formats[i]).toInstant();
                    }
                }
                return OffsetDateTime.parse(s.replace("Z", "+00:00")).toInstant();
            } catch (DateTimeParseException ignored) {
                // continue loop like Python ValueError
            }
        }
        try {
            return OffsetDateTime.parse(s).toInstant();
        } catch (DateTimeParseException e) {
            try {
                String norm = s.replace(',', '.');
                if (norm.contains(" ") && !norm.contains("T")) {
                    norm = norm.replace(' ', 'T');
                }
                LocalDateTime ldt = LocalDateTime.parse(norm);
                return ldt.atOffset(ZoneOffset.UTC).toInstant();
            } catch (DateTimeParseException e2) {
                try {
                    LocalDateTime ldt = LocalDateTime.parse(s);
                    return ldt.atOffset(ZoneOffset.UTC).toInstant();
                } catch (DateTimeParseException e3) {
                    return null;
                }
            }
        }
    }

    public static double timeSortKey(String s) {
        Instant dt = parseTime(s);
        if (dt == null) {
            return 0.0;
        }
        return dt.getEpochSecond() + dt.getNano() / 1_000_000_000.0;
    }

    public static String fmtTime(String s) {
        if (s == null || s.isEmpty()) {
            return "unknown";
        }
        Instant dt = parseTime(s);
        if (dt != null) {
            return FMT_OUT.format(dt.atZone(ZoneId.systemDefault()));
        }
        return s.length() > 19 ? s.substring(0, 19) : s;
    }

    public static String fmtGap(Double minutes) {
        if (minutes == null) {
            return "";
        }
        double m = minutes;
        if (m < 0) {
            m = 0;
        }
        if (m < 1) {
            return " (just now)";
        }
        return String.format(" (%.0f min ago)", m);
    }
}
