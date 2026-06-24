package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonObject;
import me.lucko.spark.proto.SparkHeapProtos;
import me.lucko.spark.proto.SparkProtos;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.*;

class SparkHeapParserTest {

    @Test
    void parsesHeapSummaryFromProto() {
        SparkHeapProtos.HeapEntry entry = SparkHeapProtos.HeapEntry.newBuilder()
                .setType("sable.api.sublevel.BigBuffer")
                .setInstances(42)
                .setSize(8L * 1024 * 1024)
                .build();
        SparkProtos.PlatformStatistics.Memory memory = SparkProtos.PlatformStatistics.Memory.newBuilder()
                .setHeap(SparkProtos.PlatformStatistics.Memory.MemoryUsage.newBuilder()
                        .setUsed(512L * 1024 * 1024)
                        .setMax(2048L * 1024 * 1024)
                        .build())
                .build();
        SparkProtos.PlatformStatistics platform = SparkProtos.PlatformStatistics.newBuilder()
                .setMemory(memory)
                .build();
        SparkHeapProtos.HeapData data = SparkHeapProtos.HeapData.newBuilder()
                .addEntries(entry)
                .setMetadata(SparkHeapProtos.HeapMetadata.newBuilder()
                        .setPlatformStatistics(platform)
                        .build())
                .build();

        SparkHeapCollectResult result = new SparkHeapCollectResult(
                java.nio.file.Path.of("config/spark/H5BVV4Annz.sparkheap"),
                "H5BVV4Annz.sparkheap",
                "config_spark",
                Instant.now(),
                data);

        JsonObject summary = SparkHeapParser.toSummary(result);
        assertNotNull(summary);
        assertEquals("https://spark.lucko.me/H5BVV4Annz", summary.get("spark_viewer_url").getAsString());
        assertEquals(8.0, summary.get("total_mb").getAsDouble(), 0.01);
        assertEquals(1, summary.getAsJsonArray("top_entries").size());
        assertEquals("sable", summary.getAsJsonArray("top_entries").get(0).getAsJsonObject()
                .get("mod_id").getAsString());
        assertTrue(summary.has("jvm_heap"));
    }
}
