package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.spark.proto.SparkHeapProtos;

import java.time.Duration;
import java.util.Comparator;
import java.util.Locale;
import java.util.Map;

/**
 * Parses Spark {@link SparkHeapProtos.HeapData} into {@code optional.spark_profile.heap_summary}.
 */
public final class SparkHeapParser {

    private static final int TOP_ENTRIES = 15;

    private SparkHeapParser() {
    }

    public static JsonObject toSummary(SparkHeapCollectResult result) {
        return toSummary(result, null);
    }

    public static JsonObject toSummary(SparkHeapCollectResult result, SparkCollectResult cpuResult) {
        if (result == null || result.data() == null) {
            return null;
        }
        SparkHeapProtos.HeapData data = result.data();
        JsonObject out = new JsonObject();
        out.addProperty("captured_at", SparkProfileFacts.formatCapturedAt(result.capturedAt()));
        out.addProperty("source_file", result.sourceFile());
        out.addProperty("source_kind", result.sourceKind());
        out.addProperty("source_path", result.sourcePath().toString().replace('\\', '/'));
        out.addProperty("analysis_version", 2);
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
                    if (entry.getInstances() >= 0) {
                        row.addProperty("instances", entry.getInstances());
                    }
                    if (entry.getSize() >= 0) {
                        row.addProperty("size_bytes", entry.getSize());
                        row.addProperty("size_mb", round2(entry.getSize() / (1024.0 * 1024.0)));
                    }
                    row.addProperty("mod_id", modFromClass(entry.getType()));
                    entries.add(row);
                });
        for (SparkHeapProtos.HeapEntry entry : data.getEntriesList()) {
            if (entry.getSize() >= 0) {
                totalBytes += entry.getSize();
            }
        }
        out.addProperty("total_bytes", totalBytes);
        out.addProperty("total_mb", round2(totalBytes / (1024.0 * 1024.0)));
        out.add("top_entries", entries);
        JsonObject attribution = new JsonObject();
        attribution.addProperty("mode", "conservative");
        attribution.addProperty("caveat",
                "Heap exports do not include class-to-source mappings; only explicit platform/native classes are labeled and all other entries remain unknown.");
        out.add("attribution", attribution);

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
        if (data.hasMetadata()) {
            JsonObject sources = new JsonObject();
            for (Map.Entry<String, dev.mcstatus.watchtower.core.spark.proto.SparkProtos.PluginOrModMetadata> entry
                    : data.getMetadata().getSourcesMap().entrySet()) {
                var source = entry.getValue();
                JsonObject row = new JsonObject();
                if (!source.getName().isBlank()) {
                    row.addProperty("name", source.getName());
                }
                if (!source.getVersion().isBlank()) {
                    row.addProperty("version", source.getVersion());
                }
                if (!source.getDescription().isBlank()) {
                    row.addProperty("description", source.getDescription());
                }
                row.addProperty("builtin", source.getBuiltin());
                sources.add(entry.getKey(), row);
            }
            if (!sources.entrySet().isEmpty()) {
                out.add("source_catalog", sources);
            }
        }
        if (cpuResult != null && cpuResult.capturedAt() != null && result.capturedAt() != null) {
            long deltaSeconds = Math.abs(Duration.between(cpuResult.capturedAt(), result.capturedAt()).getSeconds());
            JsonObject pairing = new JsonObject();
            pairing.addProperty("cpu_captured_at", SparkProfileFacts.formatCapturedAt(cpuResult.capturedAt()));
            pairing.addProperty("heap_captured_at", SparkProfileFacts.formatCapturedAt(result.capturedAt()));
            pairing.addProperty("delta_seconds", deltaSeconds);
            pairing.addProperty("status", deltaSeconds <= 15 * 60 ? "nearby_capture" : "separate_capture");
            pairing.addProperty("caveat",
                    "CPU and heap files are separate captures; timing proximity does not prove that they represent the same workload.");
            out.add("pairing", pairing);
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
        String lower = className.toLowerCase(Locale.ROOT);
        if (lower.startsWith("native.") || lower.endsWith(".so") || lower.endsWith(".dll")
                || lower.endsWith(".dylib")) {
            return "native";
        }
        return "unknown";
    }

    private static double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }
}
