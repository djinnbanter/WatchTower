package dev.mcstatus.watchtower.core.analyze;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Builds the expanded Performance tab dashboard payload from L1 rows and ops context.
 */
public final class PerformanceDashboardBuilder {

    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_OFFSET_DATE_TIME;

    private PerformanceDashboardBuilder() {
    }

    public static JsonObject build(
            List<JsonObject> allRows,
            String window,
            double msptWarn,
            double tpsWarn,
            PerformanceContext context
    ) {
        String win = window != null && !window.isBlank() ? window : "7d";
        int hours = PerformanceInsightEngine.windowToHours(win);
        PerformanceInsightEngine.WindowSplit split = PerformanceInsightEngine.splitWindowRows(allRows, hours);
        List<JsonObject> current = sortRows(split.current);
        List<JsonObject> prior = sortRows(split.prior);

        JsonObject currentAnalysis = PerformanceInsightEngine.analyze(current, win, msptWarn, tpsWarn);
        JsonObject priorAnalysis = prior.isEmpty()
                ? null
                : PerformanceInsightEngine.analyze(prior, win, msptWarn, tpsWarn);

        JsonObject busyQuiet = currentAnalysis.getAsJsonObject("busy_quiet");
        JsonArray playerBins = currentAnalysis.getAsJsonArray("player_bins");
        JsonArray outliers = currentAnalysis.getAsJsonArray("outlier_minutes");
        JsonArray stickyLag = currentAnalysis.getAsJsonArray("sticky_lag");
        JsonArray priorOutliers = priorAnalysis != null
                ? priorAnalysis.getAsJsonArray("outlier_minutes") : new JsonArray();
        JsonArray priorSticky = priorAnalysis != null
                ? priorAnalysis.getAsJsonArray("sticky_lag") : new JsonArray();

        JsonObject periodCompare = PerformanceInsightEngine.buildPeriodCompare(
                current, prior, stickyLag, priorSticky, outliers, priorOutliers, win);

        JsonObject out = currentAnalysis.deepCopy();
        out.addProperty("generated_at", ZonedDateTime.now(ZoneOffset.UTC).format(ISO));
        out.add("summary_extended", PerformanceInsightEngine.buildSummaryExtended(current, stickyLag, outliers));
        out.add("insights", PerformanceInsightEngine.buildInsightsFull(busyQuiet, playerBins, outliers, stickyLag, win));
        out.add("hour_of_week", PerformanceInsightEngine.buildHourOfWeek(current));
        out.add("daily_series", PerformanceInsightEngine.buildDailySeries(current));
        out.add("period_compare", periodCompare);

        JsonArray relatedEvents = PerformanceContextMerger.buildRelatedEvents(context);
        out.add("related_events", relatedEvents);
        out.addProperty("related_event_count", relatedEvents.size());

        JsonArray baseCorrelations = PerformanceInsightEngine.buildCorrelations(
                busyQuiet, outliers, stickyLag, periodCompare);
        out.add("correlations", PerformanceContextMerger.enrichCorrelations(
                baseCorrelations, busyQuiet, relatedEvents));

        if (context != null && context.scorecardPerf() != null) {
            out.add("scorecard_perf", context.scorecardPerf().deepCopy());
        }

        JsonObject ramStats = PerformanceInsightEngine.buildRamSizingStats(current);
        double xmxGb = Double.NaN;
        String xmxSource = "unknown";
        if (context != null && context.xmxGb() != null && context.xmxGb() > 0) {
            xmxGb = context.xmxGb();
            xmxSource = context.xmxSource() != null ? context.xmxSource() : "live";
        }
        double hostMemGb = Double.NaN;
        String ramSource = null;
        if (context != null && context.hostMemGb() != null && context.hostMemGb() > 0) {
            hostMemGb = context.hostMemGb();
            ramSource = context.ramSource();
        }
        JsonObject gcIn = PerformanceInsightEngine.buildWindowGcAdvisorInput(ramStats, msptWarn);
        if (!Double.isNaN(xmxGb)) {
            gcIn.addProperty("xmx_gb", xmxGb);
        }
        JsonObject gcOut = GcAdvisor.evaluate(gcIn);
        String gcVerdict = gcOut.has("verdict") ? gcOut.get("verdict").getAsString() : GcAdvisor.VERDICT_HEALTHY;
        JsonObject ramSizing = RamSizingAdvisor.evaluate(
                win, ramStats, xmxGb, xmxSource, gcVerdict, hostMemGb, ramSource);
        out.add("ram_sizing", ramSizing);
        attachAlignedJvmRecommendedFlags(out, ramSizing, xmxGb);

        JsonObject modsInv = null;
        if (context != null && context.opsCache() != null
                && context.opsCache().has("mods_inventory")
                && context.opsCache().get("mods_inventory").isJsonObject()) {
            modsInv = context.opsCache().getAsJsonObject("mods_inventory");
        }
        JsonObject baseline = context != null ? context.perfBaseline() : null;
        double thresh = context != null ? context.baselineThresholdPct() : 10.0;
        out.add("baseline_regression",
                PerformanceBaselineTracker.evaluate(baseline, allRows, thresh, modsInv));

        Double freeNow = null;
        Double usePct = null;
        JsonObject storageOpt = null;
        int lookbackH = 24;
        int minSpanH = 6;
        double outlierGb = 5;
        double latencyWarnMs = 50;
        if (context != null) {
            lookbackH = context.diskFillLookbackHours();
            minSpanH = context.diskFillMinSpanHours();
            outlierGb = context.diskFillOutlierGb();
            latencyWarnMs = context.diskIoLatencyWarnMs();
            freeNow = context.diskFreeGb();
            usePct = context.diskUsePct();
            storageOpt = context.storageOptional();
        }
        JsonObject projection = DiskProjectionAnalyzer.analyze(
                current, freeNow, usePct, lookbackH, minSpanH, outlierGb, storageOpt);
        out.add("disk_projection", projection);

        JsonObject diskAlign = DiskIoLagAlign.evaluate(current, msptWarn, latencyWarnMs, 5.0);
        if (diskAlign != null) {
            JsonArray insightsArr = out.has("insights") && out.get("insights").isJsonArray()
                    ? out.getAsJsonArray("insights") : new JsonArray();
            DiskIoLagAlign.appendToInsights(insightsArr, diskAlign);
            out.add("insights", insightsArr);
            JsonArray corr = out.has("correlations") && out.get("correlations").isJsonArray()
                    ? out.getAsJsonArray("correlations") : new JsonArray();
            JsonObject corrRow = DiskIoLagAlign.toCorrelation(diskAlign);
            if (corrRow != null) {
                corr.add(corrRow);
            }
            out.add("correlations", corr);
        }

        out.add("world_pressure_compare", WorldPressureAnalyzer.compareBaselines(current, win));

        return out;
    }

    /**
     * Prefer RAM-sizing suggested heap for the Configs cut-paste Aikar set when available.
     */
    static void attachAlignedJvmRecommendedFlags(JsonObject out, JsonObject ramSizing, double currentXmxGb) {
        if (out == null) {
            return;
        }
        double pasteHeap = Double.NaN;
        if (ramSizing != null) {
            if (ramSizing.has("suggested_xmx_gb_min") && !ramSizing.get("suggested_xmx_gb_min").isJsonNull()) {
                double min = ramSizing.get("suggested_xmx_gb_min").getAsDouble();
                double max = ramSizing.has("suggested_xmx_gb_max") && !ramSizing.get("suggested_xmx_gb_max").isJsonNull()
                        ? ramSizing.get("suggested_xmx_gb_max").getAsDouble()
                        : min;
                pasteHeap = (min + max) / 2.0;
            }
        }
        if (Double.isNaN(pasteHeap) || pasteHeap <= 0) {
            pasteHeap = currentXmxGb;
        }
        if (Double.isNaN(pasteHeap) || pasteHeap <= 0) {
            return;
        }
        out.addProperty("jvm_recommended_flags", GcAdvisor.aikarsSnippetForHeapGb(pasteHeap));
        out.addProperty("jvm_recommended_flags_xmx_gb", Math.round(pasteHeap));
    }

    private static List<JsonObject> sortRows(List<JsonObject> rows) {
        List<JsonObject> sorted = new ArrayList<>(rows);
        sorted.sort(Comparator.comparingLong(PerformanceInsightEngine::rowEpochPublic));
        return sorted;
    }
}
