package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeFormatterBuilder;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoField;
import java.util.Locale;
import java.util.regex.Matcher;

/**
 * Shared helpers used across collectors.
 */
public final class CollectSupport {

    private static final DateTimeFormatter LOG_TS_WITH_FRACTION = new DateTimeFormatterBuilder()
            .parseCaseInsensitive()
            .appendPattern("dMMMyyyy HH:mm:ss")
            .appendFraction(ChronoField.NANO_OF_SECOND, 0, 9, true)
            .toFormatter(Locale.ENGLISH)
            .withZone(ZoneId.systemDefault());

    private static final DateTimeFormatter LOG_TS_NO_FRACTION = DateTimeFormatter.ofPattern(
                    "dMMMyyyy HH:mm:ss", Locale.ENGLISH)
            .withZone(ZoneId.systemDefault());

    private CollectSupport() {
    }

    public static ZonedDateTime parseLogTs(String line) {
        Matcher m = LogPatterns.LOG_TS.matcher(line);
        if (!m.find()) {
            return null;
        }
        String raw = m.group(1);
        try {
            if (raw.contains(".")) {
                return ZonedDateTime.parse(raw, LOG_TS_WITH_FRACTION);
            }
            return ZonedDateTime.parse(raw, LOG_TS_NO_FRACTION);
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    public static ZonedDateTime parseTime(String s) {
        if (s == null || s.isBlank()) {
            return null;
        }
        try {
            return OffsetDateTime.parse(s.replace("Z", "+00:00")).toZonedDateTime();
        } catch (DateTimeParseException e) {
            try {
                return ZonedDateTime.parse(s);
            } catch (DateTimeParseException e2) {
                return null;
            }
        }
    }

    public static String isoNow() {
        return ZonedDateTime.now(ZoneId.systemDefault()).format(DateTimeFormatter.ISO_OFFSET_DATE_TIME);
    }

    public static String iso(ZonedDateTime zdt) {
        if (zdt == null) {
            return null;
        }
        return zdt.format(DateTimeFormatter.ISO_OFFSET_DATE_TIME);
    }

    public static double clampLogGap(double gapMinutes) {
        return Math.round(Math.max(0.0, gapMinutes) * 10.0) / 10.0;
    }

    public static boolean pregenMeaningful(JsonObject entry) {
        int cps = entry.has("cps") && !entry.get("cps").isJsonNull() ? entry.get("cps").getAsInt() : 0;
        double chunks = entry.has("chunks") && !entry.get("chunks").isJsonNull() ? entry.get("chunks").getAsDouble() : 0;
        return cps > 0 || chunks >= 10;
    }

    public static String relLogPath(String serverDir, java.nio.file.Path path) {
        try {
            return java.nio.file.Path.of(serverDir).toAbsolutePath().normalize()
                    .relativize(path.toAbsolutePath().normalize()).toString();
        } catch (Exception e) {
            return path.getFileName().toString();
        }
    }

    public static JsonObject evidence(String file, Integer line, String quote, String time) {
        JsonObject ev = new JsonObject();
        ev.addProperty("file", file);
        if (line != null) {
            ev.addProperty("line", line);
        } else {
            ev.add("line", null);
        }
        String q = quote == null ? "" : quote;
        ev.addProperty("quote", q.length() > 300 ? q.substring(0, 300) : q);
        if (time != null) {
            ev.addProperty("time", time);
        }
        return ev;
    }

    public static void appendEvent(JsonObject staging, JsonObject event) {
        JsonArray events = staging.getAsJsonArray("events");
        String type = event.has("type") ? event.get("type").getAsString() : "";
        String time = event.has("time") ? event.get("time").getAsString() : "";
        String detail = event.has("detail") ? event.get("detail").getAsString() : "";
        for (var el : events) {
            JsonObject e = el.getAsJsonObject();
            if (type.equals(getString(e, "type"))
                    && time.equals(getString(e, "time"))
                    && detail.equals(getString(e, "detail"))) {
                return;
            }
        }
        events.add(event);
    }

    public static String getString(JsonObject obj, String key) {
        return obj.has(key) && !obj.get(key).isJsonNull() ? obj.get(key).getAsString() : "";
    }

    public static double epochSeconds(ZonedDateTime zdt) {
        return zdt.toInstant().getEpochSecond() + zdt.getNano() / 1_000_000_000.0;
    }

    public static double nowEpoch() {
        return Instant.now().getEpochSecond() + Instant.now().getNano() / 1_000_000_000.0;
    }

    public static String normalizeErrorMessage(String line) {
        String s = line.replaceAll("\\d+", "N");
        s = s.replaceAll("\\s+", " ").trim();
        return s.length() > 120 ? s.substring(0, 120) : s;
    }

    public static double[] parseJvmHeapGb(String text) {
        Double xms = null;
        Double xmx = null;
        for (String line : text.split("\\R")) {
            String trimmed = line.strip();
            if (trimmed.isEmpty() || trimmed.startsWith("#")) {
                continue;
            }
            for (String flag : new String[]{"-Xms", "-Xmx"}) {
                Matcher m = java.util.regex.Pattern.compile(flag + "(\\d+)([gGmM])").matcher(line);
                if (m.find()) {
                    int val = Integer.parseInt(m.group(1));
                    char unit = Character.toLowerCase(m.group(2).charAt(0));
                    double gb = unit == 'g' ? val : Math.round(val / 1024.0 * 100.0) / 100.0;
                    if ("-Xms".equals(flag)) {
                        xms = gb;
                    } else {
                        xmx = gb;
                    }
                }
            }
        }
        return new double[]{xms == null ? Double.NaN : xms, xmx == null ? Double.NaN : xmx};
    }
}
