package dev.mcstatus.watchtower.core.analyze;

import com.google.gson.JsonObject;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Projects days-until-full from L1 free-space trends (Netdata-style fill rate).
 */
public final class DiskProjectionAnalyzer {

    public static final String VERDICT_FILLING = "filling";
    public static final String VERDICT_STABLE = "stable";
    public static final String VERDICT_INSUFFICIENT = "insufficient";

    public static final String CONFIDENCE_OK = "ok";
    public static final String CONFIDENCE_LOW = "low";
    public static final String CONFIDENCE_INSUFFICIENT = "insufficient";

    private DiskProjectionAnalyzer() {
    }

    public static JsonObject analyze(
            List<JsonObject> l1Rows,
            Double diskFreeGbNow,
            Double diskUsePctNow,
            int lookbackHours,
            int minSpanHours,
            double outlierGb,
            JsonObject storageOptional
    ) {
        int lookback = Math.max(1, lookbackHours);
        int minSpan = Math.max(1, minSpanHours);
        double outlier = outlierGb > 0 ? outlierGb : 5.0;

        JsonObject out = new JsonObject();
        out.addProperty("lookback_hours", lookback);
        if (diskFreeGbNow != null) {
            out.addProperty("disk_free_gb", round2(diskFreeGbNow));
        }
        if (diskUsePctNow != null) {
            out.addProperty("disk_use_pct", round1(diskUsePctNow));
        }

        List<JsonObject> rows = filterLookback(l1Rows, lookback);
        out.addProperty("sample_minutes", rows.size());

        List<HourMedian> hours = hourlyMedians(rows);
        List<HourMedian> filtered = dropOutlierHours(hours, outlier);

        if (filtered.size() < 2) {
            return insufficient(out, "Not enough disk history to project fill rate.");
        }

        HourMedian first = filtered.get(0);
        HourMedian last = filtered.get(filtered.size() - 1);
        double spanHours = (last.epochSec - first.epochSec) / 3600.0;
        if (spanHours < minSpan) {
            return insufficient(out, String.format(Locale.US,
                    "Need at least %dh of disk history (have %.1fh).", minSpan, spanHours));
        }

        double freePast = first.freeGb;
        double freeNowSample = last.freeGb;
        double freeNow = diskFreeGbNow != null ? diskFreeGbNow : freeNowSample;
        double daysSpan = Math.max(1.0 / 24.0, (last.epochSec - first.epochSec) / 86400.0);
        double fillRate = (freePast - freeNowSample) / daysSpan;

        String confidence = spanHours >= 24 ? CONFIDENCE_OK : CONFIDENCE_LOW;
        out.addProperty("confidence", confidence);
        out.addProperty("fill_rate_gb_per_day", round2(fillRate));

        String driver = driverHint(storageOptional);
        if (driver != null) {
            out.addProperty("driver_hint", driver);
        }

        if (fillRate <= 0.01) {
            out.addProperty("verdict", VERDICT_STABLE);
            out.addProperty("message", "Disk free space is stable / not filling at current growth.");
            return out;
        }

        if (freeNow <= 0) {
            out.addProperty("verdict", VERDICT_FILLING);
            out.addProperty("days_until_full", 0.0);
            out.addProperty("message", "Disk appears full or nearly full.");
            return out;
        }

        double daysUntil = freeNow / fillRate;
        out.addProperty("verdict", VERDICT_FILLING);
        out.addProperty("days_until_full", round1(daysUntil));
        out.addProperty("message", String.format(Locale.US,
                "≈%.0f days until full at current growth", daysUntil));
        return out;
    }

    /**
     * Whether {@code DISK_FILL_PROJECTED} should fire for this projection.
     */
    public static boolean shouldRaiseIssue(JsonObject projection, double warnDays) {
        if (projection == null || !projection.has("verdict")) {
            return false;
        }
        if (!VERDICT_FILLING.equals(projection.get("verdict").getAsString())) {
            return false;
        }
        String conf = projection.has("confidence") ? projection.get("confidence").getAsString() : "";
        if (CONFIDENCE_INSUFFICIENT.equals(conf)) {
            return false;
        }
        if (!projection.has("days_until_full") || projection.get("days_until_full").isJsonNull()) {
            return false;
        }
        double days = projection.get("days_until_full").getAsDouble();
        return days > 0 && days <= warnDays;
    }

    private static JsonObject insufficient(JsonObject out, String message) {
        out.addProperty("verdict", VERDICT_INSUFFICIENT);
        out.addProperty("confidence", CONFIDENCE_INSUFFICIENT);
        out.addProperty("message", message);
        return out;
    }

    private static List<JsonObject> filterLookback(List<JsonObject> l1Rows, int lookbackHours) {
        if (l1Rows == null || l1Rows.isEmpty()) {
            return List.of();
        }
        long cutoff = Instant.now().getEpochSecond() - lookbackHours * 3600L;
        List<JsonObject> out = new ArrayList<>();
        for (JsonObject row : l1Rows) {
            if (row == null || !row.has("disk_free_gb_avg") || row.get("disk_free_gb_avg").isJsonNull()) {
                continue;
            }
            long epoch = rowEpoch(row);
            if (epoch >= cutoff) {
                out.add(row);
            }
        }
        out.sort(Comparator.comparingLong(DiskProjectionAnalyzer::rowEpoch));
        return out;
    }

    private static List<HourMedian> hourlyMedians(List<JsonObject> rows) {
        Map<Long, List<Double>> byHour = new LinkedHashMap<>();
        for (JsonObject row : rows) {
            long epoch = rowEpoch(row);
            long hour = epoch - (epoch % 3600);
            byHour.computeIfAbsent(hour, k -> new ArrayList<>())
                    .add(row.get("disk_free_gb_avg").getAsDouble());
        }
        List<HourMedian> hours = new ArrayList<>();
        for (Map.Entry<Long, List<Double>> e : byHour.entrySet()) {
            hours.add(new HourMedian(e.getKey(), median(e.getValue())));
        }
        hours.sort(Comparator.comparingLong(h -> h.epochSec));
        return hours;
    }

    private static List<HourMedian> dropOutlierHours(List<HourMedian> hours, double outlierGb) {
        if (hours.isEmpty()) {
            return List.of();
        }
        List<HourMedian> filtered = new ArrayList<>();
        filtered.add(hours.get(0));
        for (int i = 1; i < hours.size(); i++) {
            HourMedian prev = filtered.get(filtered.size() - 1);
            HourMedian cur = hours.get(i);
            if (Math.abs(prev.freeGb - cur.freeGb) >= outlierGb) {
                continue;
            }
            filtered.add(cur);
        }
        return filtered;
    }

    private static String driverHint(JsonObject storage) {
        if (storage == null) {
            return null;
        }
        if (storage.has("delta_mb_24h") && !storage.get("delta_mb_24h").isJsonNull()) {
            double deltaMb = storage.get("delta_mb_24h").getAsDouble();
            if (Math.abs(deltaMb) >= 100) {
                double gb = deltaMb / 1024.0;
                return String.format(Locale.US, "world %+0.1f GB in 24h", gb);
            }
        }
        return null;
    }

    private static long rowEpoch(JsonObject row) {
        if (row.has("ts") && !row.get("ts").isJsonNull()) {
            try {
                return Instant.parse(row.get("ts").getAsString()).getEpochSecond();
            } catch (Exception ignored) {
            }
        }
        return 0;
    }

    private static double median(List<Double> values) {
        if (values.isEmpty()) {
            return 0;
        }
        List<Double> sorted = new ArrayList<>(values);
        Collections.sort(sorted);
        int mid = sorted.size() / 2;
        if (sorted.size() % 2 == 0) {
            return (sorted.get(mid - 1) + sorted.get(mid)) / 2.0;
        }
        return sorted.get(mid);
    }

    private static double round1(double v) {
        return Math.round(v * 10.0) / 10.0;
    }

    private static double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }

    private record HourMedian(long epochSec, double freeGb) {
    }
}
