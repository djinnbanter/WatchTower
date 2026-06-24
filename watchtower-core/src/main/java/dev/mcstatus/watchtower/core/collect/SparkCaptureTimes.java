package dev.mcstatus.watchtower.core.collect;

import me.lucko.spark.proto.SparkHeapProtos;
import me.lucko.spark.proto.SparkSamplerProtos;

import java.time.Instant;

/**
 * Resolves capture instants from Spark protobuf metadata, falling back to file mtime.
 */
public final class SparkCaptureTimes {

    private SparkCaptureTimes() {
    }

    public static Instant resolveSampler(SparkSamplerProtos.SamplerData data, Instant fileMtime) {
        if (data != null && data.hasMetadata()) {
            long startMs = data.getMetadata().getStartTime();
            if (startMs > 0) {
                return Instant.ofEpochMilli(startMs);
            }
        }
        return fileMtime != null ? fileMtime : Instant.now();
    }

    public static Instant resolveHeap(SparkHeapProtos.HeapData data, Instant fileMtime) {
        if (data != null && data.hasMetadata()) {
            long generatedMs = data.getMetadata().getGeneratedTime();
            if (generatedMs > 0) {
                return Instant.ofEpochMilli(generatedMs);
            }
        }
        return fileMtime != null ? fileMtime : Instant.now();
    }
}
