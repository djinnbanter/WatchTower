package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import me.lucko.spark.proto.SparkHeapProtos;

import java.util.Comparator;

/**
 * Parses Spark {@link SparkHeapProtos.HeapData} into {@code optional.spark_profile.heap_summary}.
 */
public final class SparkHeapParser {

    private static final int TOP_ENTRIES = 15;

    private SparkHeapParser() {
    }

    public static JsonObject toSummary(SparkHeapCollectResult result) {
        if (result == null || result.data() == null) {
            return null;
        }
        SparkHeapProtos.HeapData data = result.data();
        JsonObject out = new JsonObject();
        out.addProperty("captured_at", SparkProfileFacts.formatCapturedAt(result.capturedAt()));
        out.addProperty("source_file", result.sourceFile());
        out.addProperty("source_kind", result.sourceKind());
        out.addProperty("source_path", result.sourcePath().toString().replace('\\', '/'));
        String viewerUrl = SparkBytebinUrls.heapViewerUrl(result.sourceFile());
        if (viewerUrl != null) {
            out.addProperty("spark_viewer_url", viewerUrl);
        }

        long totalBytes = 0;
        JsonArray entries = new JsonArray();
        data.getEntriesList().stream()
                .sorted(Comparator.comparingLong(SparkHeapProtos.HeapEntry::getSize).reversed())
                .limit(TOP_ENTRIES)
                .forEach(entry -> {
                    JsonObject row = new JsonObject();
                    row.addProperty("type", entry.getType());
                    row.addProperty("instances", entry.getInstances());
                    row.addProperty("size_bytes", entry.getSize());
                    row.addProperty("size_mb", round2(entry.getSize() / (1024.0 * 1024.0)));
                    row.addProperty("mod_id", modFromClass(entry.getType()));
                    entries.add(row);
                });
        for (SparkHeapProtos.HeapEntry entry : data.getEntriesList()) {
            totalBytes += entry.getSize();
        }
        out.addProperty("total_bytes", totalBytes);
        out.addProperty("total_mb", round2(totalBytes / (1024.0 * 1024.0)));
        out.add("top_entries", entries);

        if (data.hasMetadata() && data.getMetadata().hasPlatformStatistics()) {
            var stats = data.getMetadata().getPlatformStatistics();
            if (stats.hasMemory() && stats.getMemory().hasHeap()) {
                var heap = stats.getMemory().getHeap();
                JsonObject jvm = new JsonObject();
                jvm.addProperty("used_mb", round2(heap.getUsed() / (1024.0 * 1024.0)));
                if (heap.getMax() > 0) {
                    jvm.addProperty("max_mb", round2(heap.getMax() / (1024.0 * 1024.0)));
                }
                out.add("jvm_heap", jvm);
            }
        }
        return out;
    }

    private static String modFromClass(String className) {
        if (className == null || className.isBlank()) {
            return "unknown";
        }
        if (className.startsWith("net.minecraft")) {
            return "minecraft";
        }
        if (className.startsWith("net.neoforged") || className.startsWith("net.minecraftforge")) {
            return "neoforge";
        }
        int dot = className.indexOf('.');
        if (dot > 0) {
            return className.substring(0, dot);
        }
        return "unknown";
    }

    private static double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }
}
