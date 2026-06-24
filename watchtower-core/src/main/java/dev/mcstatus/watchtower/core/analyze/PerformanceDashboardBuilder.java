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

        return out;
    }

    private static List<JsonObject> sortRows(List<JsonObject> rows) {
        List<JsonObject> sorted = new ArrayList<>(rows);
        sorted.sort(Comparator.comparingLong(PerformanceInsightEngine::rowEpochPublic));
        return sorted;
    }
}
