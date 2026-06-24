package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.report.ReportConfig;

import java.time.ZoneId;
import java.time.ZonedDateTime;

/**
 * Poll live TPS/MSPT via RCON when snapshot is missing or stale.
 */
public final class RconMetricsCollector {

    private static final int TIMEOUT_MS = 3000;

    private RconMetricsCollector() {
    }

    public static boolean isConfigured(ReportConfig config) {
        return config != null
                && config.rconPassword() != null
                && !config.rconPassword().isBlank();
    }

    public static JsonObject poll(ReportConfig config) {
        if (!isConfigured(config)) {
            return null;
        }
        try {
            String raw = RconClient.command(
                    config.rconHost(),
                    config.rconPort(),
                    config.rconPassword(),
                    config.rconTpsCommand(),
                    TIMEOUT_MS);
            if (raw == null || raw.isBlank()) {
                return null;
            }
            JsonObject parsed = RconTpsParser.parse(raw);
            if (!RconTpsParser.hasMetrics(parsed)) {
                return null;
            }
            JsonObject result = new JsonObject();
            result.addProperty("source", "rcon");
            result.addProperty("polled_at", ZonedDateTime.now(ZoneId.systemDefault())
                    .format(java.time.format.DateTimeFormatter.ISO_OFFSET_DATE_TIME));
            if (parsed.has("overworld")) {
                result.add("overworld", parsed.getAsJsonObject("overworld"));
            }
            if (parsed.has("dimensions")) {
                result.add("dimensions", parsed.get("dimensions"));
            }
            if (parsed.has("spark_tps")) {
                result.add("spark_tps", parsed.get("spark_tps"));
            }
            return result;
        } catch (RconClient.RconException | RuntimeException ignored) {
            return null;
        }
    }
}
