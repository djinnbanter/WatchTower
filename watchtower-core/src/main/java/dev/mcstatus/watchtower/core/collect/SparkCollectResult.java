package dev.mcstatus.watchtower.core.collect;

import dev.mcstatus.watchtower.core.spark.proto.SparkSamplerProtos;

import java.nio.file.Path;
import java.time.Instant;

/**
 * Result of locating and validating a Spark CPU profiler export.
 */
public record SparkCollectResult(
        Path sourcePath,
        String sourceFile,
        String sourceKind,
        Instant capturedAt,
        SparkSamplerProtos.SamplerData data) {
}
