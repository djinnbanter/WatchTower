package dev.mcstatus.watchtower.core.analyze;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import dev.mcstatus.watchtower.core.live.PerformanceRollupAccumulator;
import dev.mcstatus.watchtower.core.report.StateManager;

import java.io.IOException;
import java.nio.file.Path;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Performance baseline capture + 7d regression detection (1.1.2).
 * Auto-capture is once-only; refresh only via {@link #setBaselineNow}.
 */
public final class PerformanceBaselineTracker {

    public static final String STATE_KEY = "perf_baseline";
    public static final int MIN_HEALTHY_MINUTES = 360; // ~6h of L1 minute rows
    public static final int CAPTURE_WINDOW_HOURS = 24;
    public static final int COMPARE_WINDOW_HOURS = 168; // 7d
    /** Live sample ticks (~5s each at default poll) — 360 ≈ 30 min healthy after lag clears. */
    public static final int MIN_HEALTHY_STREAK = 360;
    public static final long MOD_MTIME_SLACK_SEC = 3L * 86400L;

    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_OFFSET_DATE_TIME;

    private PerformanceBaselineTracker() {
    }

    public static JsonObject getBaseline(Path statePath) throws IOException {
        JsonObject state = StateManager.loadStateObject(statePath);
        if (state.has(STATE_KEY) && state.get(STATE_KEY).isJsonObject()) {
            return state.getAsJsonObject(STATE_KEY).deepCopy();
        }
        return null;
    }

    public static void saveBaseline(Path statePath, JsonObject baseline) throws IOException {
        JsonObject state = StateManager.loadStateObject(statePath);
        state.add(STATE_KEY, baseline.deepCopy());
        StateManager.writeStateObject(statePath, state);
    }

    /**
     * Capture-once when conf on, baseline missing, and healthy gate passes.
     * @return saved baseline or null if skipped
     */
    public static JsonObject maybeAutoCapture(
            Path statePath,
            List<JsonObject> allRows,
            boolean autoCaptureEnabled,
            int healthyStreak,
            boolean scorecardCritical,
            int unreviewedCrashes
    ) throws IOException {
        if (!autoCaptureEnabled) {
            return null;
        }
        if (getBaseline(statePath) != null) {
            return null;
        }
        if (!passesHealthyGate(healthyStreak, scorecardCritical, unreviewedCrashes)) {
            return null;
        }
        List<JsonObject> window = lastHours(allRows, CAPTURE_WINDOW_HOURS);
        if (window.size() < MIN_HEALTHY_MINUTES) {
            return null;
        }
        JsonObject baseline = buildBaselineBlob(window, "auto", CAPTURE_WINDOW_HOURS);
        saveBaseline(statePath, baseline);
        return baseline;
    }

    public static JsonObject setBaselineNow(Path statePath, List<JsonObject> allRows) throws IOException {
        List<JsonObject> window = lastHours(allRows, CAPTURE_WINDOW_HOURS);
        if (window.isEmpty()) {
            window = allRows != null ? new ArrayList<>(allRows) : List.of();
        }
        JsonObject baseline = buildBaselineBlob(window, "manual", CAPTURE_WINDOW_HOURS);
        saveBaseline(statePath, baseline);
        return baseline;
    }

    public static boolean passesHealthyGate(int healthyStreak, boolean scorecardCritical, int unreviewedCrashes) {
        if (scorecardCritical) {
            return false;
        }
        if (unreviewedCrashes > 3) {
            return false;
        }
        return healthyStreak >= MIN_HEALTHY_STREAK;
    }

    public static JsonObject buildBaselineBlob(List<JsonObject> rows, String source, int windowHours) {
        JsonObject metrics = PerformanceInsightEngine.buildBaselineMetrics(rows);
        JsonObject out = new JsonObject();
        out.addProperty("captured_at", ZonedDateTime.now(ZoneOffset.UTC).format(ISO));
        out.addProperty("source", source != null ? source : "manual");
        out.addProperty("window_hours", windowHours);
        out.addProperty("sample_minutes", metrics.has("sample_minutes")
                ? metrics.get("sample_minutes").getAsInt() : 0);
        JsonObject m = new JsonObject();
        for (String key : List.of(
                "tps_p50", "tps_p95", "mspt_p50", "mspt_p95",
                "heap_pressure_pct_p50", "heap_pressure_pct_p95")) {
            if (metrics.has(key)) {
                m.add(key, metrics.get(key));
            }
        }
        out.add("metrics", m);
        if (metrics.has("players_peak")) {
            out.addProperty("players_peak", metrics.get("players_peak").getAsInt());
        }
        return out;
    }

    /**
     * Compare rolling 7d metrics against frozen baseline.
     */
    public static JsonObject evaluate(
            JsonObject baseline,
            List<JsonObject> allRows,
            double thresholdPct,
            JsonObject opsModsInventory
    ) {
        JsonObject out = new JsonObject();
        out.addProperty("active", false);
        out.addProperty("can_set_baseline", true);
        out.addProperty("threshold_pct", thresholdPct);
        if (baseline == null || !baseline.has("metrics")) {
            out.addProperty("has_baseline", false);
            out.addProperty("label", "No performance baseline yet");
            out.addProperty("detail", "Watchtower will capture one after a healthy stretch, or set one manually.");
            return out;
        }
        out.addProperty("has_baseline", true);
        if (baseline.has("captured_at")) {
            out.addProperty("baseline_captured_at", baseline.get("captured_at").getAsString());
        }
        if (baseline.has("source")) {
            out.addProperty("baseline_source", baseline.get("source").getAsString());
        }
        int baselineSamples = baseline.has("sample_minutes")
                ? baseline.get("sample_minutes").getAsInt() : 0;
        if (baselineSamples > 0 && baselineSamples < MIN_HEALTHY_MINUTES) {
            out.addProperty("thin_baseline", true);
        }

        List<JsonObject> currentRows = lastHours(allRows, COMPARE_WINDOW_HOURS);
        JsonObject current = PerformanceInsightEngine.buildBaselineMetrics(currentRows);
        out.add("current_metrics", current.deepCopy());
        out.add("baseline_metrics", baseline.getAsJsonObject("metrics").deepCopy());

        if (current.get("sample_minutes").getAsInt() < 60) {
            out.addProperty("label", "Baseline ready");
            out.addProperty("detail", "Need more live samples in the last 7 days to compare.");
            return out;
        }

        JsonObject baseM = baseline.getAsJsonObject("metrics");
        JsonObject deltas = new JsonObject();
        String worstMetric = null;
        double worstMag = 0;
        boolean active = false;

        // Higher is worse for mspt / heap; lower is worse for tps
        Double msptDelta = pctDeltaHigherWorse(baseM, current, "mspt_p95");
        if (msptDelta != null) {
            deltas.addProperty("mspt_p95", round1(msptDelta));
            if (msptDelta >= thresholdPct && msptDelta > worstMag) {
                worstMag = msptDelta;
                worstMetric = "mspt_p95";
                active = true;
            }
        }
        Double heapDelta = pctDeltaHigherWorse(baseM, current, "heap_pressure_pct_p95");
        if (heapDelta != null) {
            deltas.addProperty("heap_pressure_pct_p95", round1(heapDelta));
            if (heapDelta >= thresholdPct && heapDelta > worstMag) {
                worstMag = heapDelta;
                worstMetric = "heap_pressure_pct_p95";
                active = true;
            }
        }
        Double tpsDelta = pctDeltaLowerWorse(baseM, current, "tps_p50");
        if (tpsDelta != null) {
            deltas.addProperty("tps_p50", round1(tpsDelta));
            if (tpsDelta >= thresholdPct && tpsDelta > worstMag) {
                worstMag = tpsDelta;
                worstMetric = "tps_p50";
                active = true;
            }
        }
        out.add("deltas_pct", deltas);

        if (!active) {
            out.addProperty("label", "On pace with baseline");
            out.addProperty("detail", "Last 7 days are within " + (int) thresholdPct + "% of your saved baseline.");
            out.addProperty("severity", "ok");
            return out;
        }

        out.addProperty("active", true);
        out.addProperty("severity", "warn");
        out.addProperty("worst_metric", worstMetric);
        out.addProperty("worst_delta_pct", round1(worstMag));
        out.addProperty("label", "Slower than your baseline");
        out.addProperty("detail", formatRegressionDetail(worstMetric, worstMag, baseM, current));

        String since = estimateSince(currentRows, baseM, worstMetric, thresholdPct);
        if (since != null) {
            out.addProperty("since", since);
        }

        JsonObject corr = correlateMods(opsModsInventory, since);
        if (corr != null) {
            out.add("mod_correlation", corr);
            if (corr.has("likely") && corr.get("likely").getAsBoolean() && corr.has("note")) {
                out.addProperty("detail", out.get("detail").getAsString() + " " + corr.get("note").getAsString());
            }
        }
        return out;
    }

    static JsonObject correlateMods(JsonObject modsInventory, String sinceIsoDate) {
        if (modsInventory == null) {
            return null;
        }
        long sinceEpoch = 0;
        if (sinceIsoDate != null && !sinceIsoDate.isBlank()) {
            try {
                sinceEpoch = Instant.parse(sinceIsoDate.contains("T")
                        ? sinceIsoDate
                        : sinceIsoDate + "T00:00:00Z").getEpochSecond();
            } catch (Exception ignored) {
                sinceEpoch = 0;
            }
        }
        if (sinceEpoch <= 0) {
            // Unknown onset: any jar touch in the last 7d (+slack) through now.
            long nowSec = Instant.now().getEpochSecond();
            long windowStart = nowSec - 7L * 86400L - MOD_MTIME_SLACK_SEC;
            long windowEnd = nowSec;
            return correlateModsInWindow(modsInventory, windowStart, windowEnd);
        }
        long windowStart = sinceEpoch - MOD_MTIME_SLACK_SEC;
        long windowEnd = sinceEpoch + MOD_MTIME_SLACK_SEC;
        return correlateModsInWindow(modsInventory, windowStart, windowEnd);
    }

    static JsonObject correlateModsInWindow(JsonObject modsInventory, long windowStart, long windowEnd) {
        List<String> jars = new ArrayList<>();
        long changeAt = 0;
        JsonObject diff = modsInventory.has("diff") && modsInventory.get("diff").isJsonObject()
                ? modsInventory.getAsJsonObject("diff") : null;
        if (diff != null) {
            for (String key : List.of("added", "changed", "removed")) {
                if (!diff.has(key) || !diff.get(key).isJsonArray()) {
                    continue;
                }
                for (JsonElement el : diff.getAsJsonArray(key)) {
                    if (!el.isJsonObject()) {
                        continue;
                    }
                    JsonObject row = el.getAsJsonObject();
                    long mt = row.has("mtime") && !row.get("mtime").isJsonNull()
                            ? row.get("mtime").getAsLong() : 0;
                    if (mt <= 0 && row.has("prev_mtime") && !row.get("prev_mtime").isJsonNull()) {
                        mt = row.get("prev_mtime").getAsLong();
                    }
                    if (mt >= windowStart && mt <= windowEnd) {
                        String jar = row.has("jar") ? row.get("jar").getAsString()
                                : (row.has("display_name") ? row.get("display_name").getAsString() : null);
                        if (jar != null) {
                            jars.add(jar);
                        }
                        if (mt > changeAt) {
                            changeAt = mt;
                        }
                    }
                }
            }
        }

        JsonObject out = new JsonObject();
        if (jars.isEmpty()) {
            out.addProperty("likely", false);
            return out;
        }
        out.addProperty("likely", true);
        if (changeAt > 0) {
            out.addProperty("change_at", Instant.ofEpochSecond(changeAt).toString());
        }
        JsonArray arr = new JsonArray();
        int n = Math.min(3, jars.size());
        for (int i = 0; i < n; i++) {
            arr.add(jars.get(i));
        }
        out.add("jars", arr);
        out.addProperty("note", "Jar change near regression onset: " + jars.getFirst()
                + (jars.size() > 1 ? " (+" + (jars.size() - 1) + " more)" : "") + ".");
        return out;
    }

    private static String formatRegressionDetail(
            String metric, double deltaPct, JsonObject baseM, JsonObject current) {
        if ("mspt_p95".equals(metric)) {
            return String.format(
                    "MSPT p95 is %.0f%% worse than baseline (%.0f→%.0f ms) over the last 7 days.",
                    deltaPct, dbl(baseM, "mspt_p95"), dbl(current, "mspt_p95"));
        }
        if ("heap_pressure_pct_p95".equals(metric)) {
            return String.format(
                    "Heap pressure p95 is %.0f%% higher than baseline (%.0f→%.0f%%) over the last 7 days.",
                    deltaPct, dbl(baseM, "heap_pressure_pct_p95"), dbl(current, "heap_pressure_pct_p95"));
        }
        if ("tps_p50".equals(metric)) {
            return String.format(
                    "TPS p50 is %.0f%% lower than baseline (%.1f→%.1f) over the last 7 days.",
                    deltaPct, dbl(baseM, "tps_p50"), dbl(current, "tps_p50"));
        }
        return String.format("%.0f%% worse than baseline on %s.", deltaPct, metric);
    }

    /** Rough onset: first day in the 7d window where the metric crosses threshold vs baseline. */
    private static String estimateSince(
            List<JsonObject> rows, JsonObject baseM, String metric, double thresholdPct) {
        if (rows == null || rows.isEmpty() || metric == null) {
            return null;
        }
        double base = dbl(baseM, metric);
        // For daily estimate use mspt_avg / tps_avg / heap avg
        String rowKey = switch (metric) {
            case "mspt_p95" -> "mspt_avg";
            case "heap_pressure_pct_p95" -> "heap_pressure_pct_avg";
            case "tps_p50" -> "tps_avg";
            default -> null;
        };
        if (rowKey == null || Double.isNaN(base) || base == 0) {
            return null;
        }
        List<JsonObject> sorted = new ArrayList<>(rows);
        sorted.sort(Comparator.comparingLong(PerformanceInsightEngine::rowEpochPublic));
        for (JsonObject row : sorted) {
            if (!row.has(rowKey) || row.get(rowKey).isJsonNull() || !row.has("ts")) {
                continue;
            }
            double v = row.get(rowKey).getAsDouble();
            boolean crossed;
            if ("tps_avg".equals(rowKey)) {
                crossed = ((base - v) / Math.abs(base)) * 100.0 >= thresholdPct;
            } else {
                crossed = ((v - base) / Math.abs(base)) * 100.0 >= thresholdPct;
            }
            if (crossed) {
                try {
                    return Instant.parse(row.get("ts").getAsString()).atZone(ZoneOffset.UTC).toLocalDate().toString();
                } catch (Exception e) {
                    return null;
                }
            }
        }
        return null;
    }

    private static Double pctDeltaHigherWorse(JsonObject base, JsonObject cur, String key) {
        double b = dbl(base, key);
        double c = dbl(cur, key);
        if (Double.isNaN(b) || Double.isNaN(c) || Math.abs(b) < 1e-6) {
            return null;
        }
        return ((c - b) / Math.abs(b)) * 100.0;
    }

    private static Double pctDeltaLowerWorse(JsonObject base, JsonObject cur, String key) {
        double b = dbl(base, key);
        double c = dbl(cur, key);
        if (Double.isNaN(b) || Double.isNaN(c) || Math.abs(b) < 1e-6) {
            return null;
        }
        return ((b - c) / Math.abs(b)) * 100.0;
    }

    static List<JsonObject> lastHours(List<JsonObject> allRows, int hours) {
        if (allRows == null || allRows.isEmpty()) {
            return List.of();
        }
        long cutoff = Instant.now().getEpochSecond() - (long) hours * 3600L;
        List<JsonObject> out = new ArrayList<>();
        for (JsonObject row : allRows) {
            if (PerformanceInsightEngine.rowEpochPublic(row) >= cutoff) {
                out.add(row);
            }
        }
        return out;
    }

    private static double dbl(JsonObject o, String key) {
        if (o == null || !o.has(key) || o.get(key).isJsonNull()) {
            return Double.NaN;
        }
        try {
            return o.get(key).getAsDouble();
        } catch (Exception e) {
            return Double.NaN;
        }
    }

    private static double round1(double v) {
        return PerformanceRollupAccumulator.round1(v);
    }

    /** Package-visible for tests that parse fixture JSON. */
    public static JsonObject parseJson(String s) {
        return JsonParser.parseString(s).getAsJsonObject();
    }
}
