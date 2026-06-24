package dev.mcstatus.watchtower.core.collect;

import me.lucko.spark.proto.SparkHeapProtos;
import me.lucko.spark.proto.SparkSamplerProtos;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.*;

class SparkCaptureTimesTest {

    @Test
    void samplerPrefersMetadataStartTime() {
        SparkSamplerProtos.SamplerMetadata meta = SparkSamplerProtos.SamplerMetadata.newBuilder()
                .setStartTime(1_700_000_000_000L)
                .build();
        SparkSamplerProtos.SamplerData data = SparkSamplerProtos.SamplerData.newBuilder()
                .setMetadata(meta)
                .build();
        Instant fileMtime = Instant.parse("2026-01-01T00:00:00Z");
        Instant resolved = SparkCaptureTimes.resolveSampler(data, fileMtime);
        assertEquals(Instant.ofEpochMilli(1_700_000_000_000L), resolved);
    }

    @Test
    void samplerFallsBackToFileMtime() {
        SparkSamplerProtos.SamplerData data = SparkSamplerProtos.SamplerData.newBuilder()
                .setMetadata(SparkSamplerProtos.SamplerMetadata.newBuilder().build())
                .build();
        Instant fileMtime = Instant.parse("2026-06-18T12:00:00Z");
        assertEquals(fileMtime, SparkCaptureTimes.resolveSampler(data, fileMtime));
    }

    @Test
    void heapPrefersGeneratedTime() {
        SparkHeapProtos.HeapMetadata meta = SparkHeapProtos.HeapMetadata.newBuilder()
                .setGeneratedTime(1_700_000_100_000L)
                .build();
        SparkHeapProtos.HeapData data = SparkHeapProtos.HeapData.newBuilder()
                .setMetadata(meta)
                .build();
        Instant fileMtime = Instant.parse("2026-01-01T00:00:00Z");
        assertEquals(Instant.ofEpochMilli(1_700_000_100_000L),
                SparkCaptureTimes.resolveHeap(data, fileMtime));
    }
}
