package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonObject;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.Comparator;
import java.util.List;

/**
 * Builds JVM uptime and last-stop heuristics from process info and server logs.
 */
public final class UptimeSummaryBuilder {

    private static final int LOG_TAIL_LINES = 2000;

    private UptimeSummaryBuilder() {
    }

    public static JsonObject build(Path serverDir, JsonObject systemBasics) {
        JsonObject summary = new JsonObject();
        if (systemBasics != null && systemBasics.has("java_uptime_sec") && !systemBasics.get("java_uptime_sec").isJsonNull()) {
            summary.add("java_uptime_sec", systemBasics.get("java_uptime_sec"));
        }

        StopInfo stop = detectLastStop(serverDir);
        summary.addProperty("last_stop_kind", stop.kind());
        if (stop.at() != null) {
            summary.addProperty("last_stop_at", stop.at());
        }
        return summary;
    }

    private record StopInfo(String kind, String at) {
    }

    static StopInfo detectLastStop(Path serverDir) {
        if (serverDir == null || !Files.isDirectory(serverDir)) {
            return new StopInfo("unknown", null);
        }

        ZonedDateTime cleanStop = findCleanStopTime(serverDir);
        Instant crashAt = findLatestCrashMtime(serverDir);

        if (crashAt != null && (cleanStop == null || crashAt.isAfter(cleanStop.toInstant()))) {
            ZoneId zone = cleanStop != null ? cleanStop.getZone() : ZoneId.systemDefault();
            return new StopInfo("crash", CollectSupport.iso(crashAt.atZone(zone)));
        }
        if (cleanStop != null) {
            return new StopInfo("clean", CollectSupport.iso(cleanStop));
        }
        return new StopInfo("unknown", null);
    }

    private static ZonedDateTime findCleanStopTime(Path serverDir) {
        Path latest = serverDir.resolve("logs").resolve("latest.log");
        if (!Files.isRegularFile(latest)) {
            return null;
        }
        ZonedDateTime lastStop = null;
        try {
            List<String> lines = Files.readAllLines(latest, StandardCharsets.UTF_8);
            int start = Math.max(0, lines.size() - LOG_TAIL_LINES);
            for (int i = start; i < lines.size(); i++) {
                String line = lines.get(i);
                if (line.contains("Stopping server")) {
                    ZonedDateTime ts = CollectSupport.parseLogTs(line);
                    if (ts != null) {
                        lastStop = ts;
                    }
                }
            }
        } catch (IOException ignored) {
            // unreadable log
        }
        return lastStop;
    }

    private static Instant findLatestCrashMtime(Path serverDir) {
        Path crashDir = serverDir.resolve("crash-reports");
        if (!Files.isDirectory(crashDir)) {
            return null;
        }
        try (var stream = Files.list(crashDir)) {
            return stream
                    .filter(Files::isRegularFile)
                    .max(Comparator.comparingLong(p -> {
                        try {
                            return Files.getLastModifiedTime(p).toMillis();
                        } catch (IOException e) {
                            return 0L;
                        }
                    }))
                    .map(p -> {
                        try {
                            return Files.getLastModifiedTime(p).toInstant();
                        } catch (IOException e) {
                            return null;
                        }
                    })
                    .orElse(null);
        } catch (IOException e) {
            return null;
        }
    }
}
