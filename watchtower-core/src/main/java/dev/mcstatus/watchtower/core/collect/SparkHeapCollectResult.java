package dev.mcstatus.watchtower.core.collect;

import me.lucko.spark.proto.SparkHeapProtos;

import java.nio.file.Path;
import java.time.Instant;

/**
 * Result of locating and validating a Spark heap summary export.
 */
public record SparkHeapCollectResult(
        Path sourcePath,
        String sourceFile,
        String sourceKind,
        Instant capturedAt,
        SparkHeapProtos.HeapData data) {
}
