package dev.mcstatus.watchtower.runtime;

/**
 * Runtime config surface used by dashboard / live / report code.
 * Glue implements via NeoForge {@code ModConfigSpec}; common must not import NeoForge.
 */
public interface ModRuntimeConfig {
    boolean dashboardEnabled();

    String dashboardBindHost();

    int dashboardPort();

    String dashboardAuthToken();

    int sampleIntervalSeconds();

    int reportTimeoutMinutes();

    int lookbackHours();

    boolean incremental();

    boolean countEntities();

    int liveSampleIntervalSeconds();

    int liveRetentionHours();

    int livePregenTailIntervalSeconds();

    int liveCountEntitiesIntervalSeconds();

    int liveStorageIntervalSeconds();

    int liveFlushIntervalSeconds();
}
