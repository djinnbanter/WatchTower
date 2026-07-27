package dev.mcstatus.watchtower.core.collect;

import dev.mcstatus.watchtower.core.spark.proto.SparkSamplerProtos;

import java.nio.file.Path;
import java.time.Instant;

/**
 * Result of locating and validating a Spark CPU profiler export.
 *
 * @param sourcePath absolute path to the file on disk (for path metadata / IO)
 * @param relativeSourcePath path relative to the server root (for API / facts)
 */
public record SparkCollectResult(
        Path sourcePath,
        String relativeSourcePath,
        String sourceFile,
        String sourceKind,
        Instant capturedAt,
        SparkSamplerProtos.SamplerData data) {
}
