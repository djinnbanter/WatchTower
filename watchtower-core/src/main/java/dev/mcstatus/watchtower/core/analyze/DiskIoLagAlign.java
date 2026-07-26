package dev.mcstatus.watchtower.core.analyze;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

import java.util.List;
import java.util.Locale;

/**
 * Detects minutes where high MSPT co-occurs with elevated disk write activity.
 */
public final class DiskIoLagAlign {

    public static final String INSIGHT_ID = "disk_io_lag_align";

    private static final int MIN_CO_OCCUR_MINUTES = 5;
    private static final double DEFAULT_WRITE_MB_S_ELEVATED = 5.0;

    private DiskIoLagAlign() {
    }

    /**
     * @return insight object, or null when no alignment
     */
    public static JsonObject evaluate(
            List<JsonObject> rows,
            double msptWarn,
            double writeAwaitWarnMs,
            double writeMbSElevated
    ) {
        if (rows == null || rows.isEmpty()) {
            return null;
        }
        double awaitWarn = writeAwaitWarnMs > 0 ? writeAwaitWarnMs : 50.0;
        double writeWarn = writeMbSElevated > 0 ? writeMbSElevated : DEFAULT_WRITE_MB_S_ELEVATED;

        int coOccur = 0;
        int highMspt = 0;
        boolean sawAwait = false;
        boolean sawWrite = false;

        for (JsonObject row : rows) {
            if (row == null || !row.has("mspt_avg") || row.get("mspt_avg").isJsonNull()) {
                continue;
            }
            double mspt = row.get("mspt_avg").getAsDouble();
            if (mspt < msptWarn) {
                continue;
            }
            highMspt++;
            Double awaitMs = dbl(row, "disk_write_await_ms_avg");
            Double writeMbS = dbl(row, "disk_write_mb_s_avg");
            boolean elevated = false;
            if (awaitMs != null) {
                sawAwait = true;
                if (awaitMs >= awaitWarn) {
                    elevated = true;
                }
            }
            if (writeMbS != null) {
                sawWrite = true;
                if (writeMbS >= writeWarn) {
                    elevated = true;
                }
            }
            if (elevated) {
                coOccur++;
            }
        }

        if (!sawAwait && !sawWrite) {
            return null;
        }
        if (coOccur < MIN_CO_OCCUR_MINUTES) {
            return null;
        }

        JsonObject insight = new JsonObject();
        insight.addProperty("id", INSIGHT_ID);
        insight.addProperty("severity", "warning");
        insight.addProperty("title", "Lag aligned with slow disk writes");
        insight.addProperty("summary", String.format(Locale.US,
                "%d of %d high-MSPT minutes also showed elevated disk write latency or throughput.",
                coOccur, highMspt));
        insight.addProperty("co_occur_minutes", coOccur);
        insight.addProperty("high_mspt_minutes", highMspt);
        return insight;
    }

    public static void appendToInsights(JsonArray insights, JsonObject align) {
        if (insights == null || align == null) {
            return;
        }
        insights.add(align);
    }

    public static JsonObject toCorrelation(JsonObject align) {
        if (align == null) {
            return null;
        }
        JsonObject c = new JsonObject();
        c.addProperty("id", INSIGHT_ID);
        c.addProperty("severity", "warning");
        c.addProperty("title", align.has("title") ? align.get("title").getAsString()
                : "Lag aligned with slow disk writes");
        c.addProperty("detail", align.has("summary") ? align.get("summary").getAsString() : "");
        return c;
    }

    private static Double dbl(JsonObject o, String key) {
        if (o == null || !o.has(key) || o.get(key).isJsonNull()) {
            return null;
        }
        return o.get(key).getAsDouble();
    }
}
