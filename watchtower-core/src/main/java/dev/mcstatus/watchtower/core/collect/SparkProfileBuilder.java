package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.report.ReportConfig;

/**
 * Builds the full {@code optional.spark_profile} JSON from a collected CPU export.
 */
public final class SparkProfileBuilder {

    private SparkProfileBuilder() {
    }

    public static JsonObject build(SparkCollectResult result, String serverDir, ReportConfig config) {
        if (result == null) {
            return null;
        }
        JsonObject profile = SparkParser.toFacts(result, config);
        if (profile == null) {
            return null;
        }
        if (serverDir != null && !serverDir.isBlank()) {
            SparkHeapCollector.collect(serverDir, config).ifPresent(heap -> {
                JsonObject heapSummary = SparkHeapParser.toSummary(heap);
                if (heapSummary != null) {
                    profile.add("heap_summary", heapSummary);
                }
            });
        }
        SparkRecommendationBuilder.enrich(profile);
        return profile;
    }
}
