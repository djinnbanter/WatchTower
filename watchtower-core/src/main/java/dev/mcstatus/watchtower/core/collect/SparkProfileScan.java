package dev.mcstatus.watchtower.core.collect;

import java.util.List;

/**
 * Result of scanning Spark profile directories for listable and skipped files.
 */
public record SparkProfileScan(
        List<SparkProfileEntry> profiles,
        List<SparkSkippedProfile> skipped) {

    public static SparkProfileScan empty() {
        return new SparkProfileScan(List.of(), List.of());
    }
}
