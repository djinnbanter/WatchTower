package dev.mcstatus.watchtower.core.ops;

import com.google.gson.JsonObject;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;

/**
 * Live log-stale check: {@code latest.log} mtime gap while the JVM is up.
 */
public final class LogStaleEvaluator {

    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_OFFSET_DATE_TIME;

    private LogStaleEvaluator() {
    }

    public static JsonObject evaluate(Path logPath, boolean javaRunning, int staleMinutes) {
        ZonedDateTime now = ZonedDateTime.now(ZoneId.systemDefault());
        JsonObject out = new JsonObject();
        out.addProperty("checked_at", now.format(ISO));
        out.addProperty("active", false);
        if (!javaRunning || logPath == null || !Files.isRegularFile(logPath)) {
            return out;
        }
        try {
            long mtimeMs = Files.getLastModifiedTime(logPath).toMillis();
            double gapMin = (Instant.now().toEpochMilli() - mtimeMs) / 60000.0;
            out.addProperty("gap_minutes", Math.round(gapMin * 10.0) / 10.0);
            out.addProperty("last_mtime",
                    ZonedDateTime.ofInstant(Instant.ofEpochMilli(mtimeMs), ZoneId.systemDefault()).format(ISO));
            out.addProperty("active", gapMin > staleMinutes);
        } catch (IOException ignored) {
            out.addProperty("active", false);
        }
        return out;
    }
}
