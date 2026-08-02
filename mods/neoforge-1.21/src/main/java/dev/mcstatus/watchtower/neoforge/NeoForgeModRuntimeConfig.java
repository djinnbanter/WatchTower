package dev.mcstatus.watchtower.neoforge;

import dev.mcstatus.watchtower.runtime.ModRuntimeConfig;

/**
 * NeoForge ModConfigSpec-backed {@link ModRuntimeConfig}.
 */
public final class NeoForgeModRuntimeConfig implements ModRuntimeConfig {
    @Override
    public boolean dashboardEnabled() {
        try {
            return WatchtowerConfig.DASHBOARD_ENABLED.get();
        } catch (IllegalStateException e) {
            return true;
        }
    }

    @Override
    public String dashboardBindHost() {
        try {
            return WatchtowerConfig.DASHBOARD_BIND_HOST.get();
        } catch (IllegalStateException e) {
            return "0.0.0.0";
        }
    }

    @Override
    public int dashboardPort() {
        try {
            return WatchtowerConfig.DASHBOARD_PORT.get();
        } catch (IllegalStateException e) {
            return 8787;
        }
    }

    @Override
    public String dashboardAuthToken() {
        try {
            return WatchtowerConfig.DASHBOARD_AUTH_TOKEN.get();
        } catch (IllegalStateException e) {
            return "";
        }
    }

    @Override
    public int sampleIntervalSeconds() {
        try {
            return WatchtowerConfig.SAMPLE_INTERVAL_SECONDS.get();
        } catch (IllegalStateException e) {
            return 60;
        }
    }

    @Override
    public int reportTimeoutMinutes() {
        try {
            return WatchtowerConfig.REPORT_TIMEOUT_MINUTES.get();
        } catch (IllegalStateException e) {
            return 15;
        }
    }

    @Override
    public int lookbackHours() {
        try {
            return WatchtowerConfig.LOOKBACK_HOURS.get();
        } catch (IllegalStateException e) {
            return 24;
        }
    }

    @Override
    public boolean incremental() {
        try {
            return WatchtowerConfig.INCREMENTAL.get();
        } catch (IllegalStateException e) {
            return true;
        }
    }

    @Override
    public boolean countEntities() {
        try {
            return WatchtowerConfig.COUNT_ENTITIES.get();
        } catch (IllegalStateException e) {
            return true;
        }
    }

    @Override
    public int liveSampleIntervalSeconds() {
        try {
            return WatchtowerConfig.LIVE_SAMPLE_INTERVAL_SECONDS.get();
        } catch (IllegalStateException e) {
            return 1;
        }
    }

    @Override
    public int liveRetentionHours() {
        try {
            return WatchtowerConfig.LIVE_RETENTION_HOURS.get();
        } catch (IllegalStateException e) {
            return 2160;
        }
    }

    @Override
    public int livePregenTailIntervalSeconds() {
        try {
            return WatchtowerConfig.LIVE_PREGEN_TAIL_INTERVAL_SECONDS.get();
        } catch (IllegalStateException e) {
            return 5;
        }
    }

    @Override
    public int liveCountEntitiesIntervalSeconds() {
        try {
            return WatchtowerConfig.LIVE_COUNT_ENTITIES_INTERVAL_SECONDS.get();
        } catch (IllegalStateException e) {
            return 30;
        }
    }

    @Override
    public int liveWorldCensusIntervalSeconds() {
        try {
            return WatchtowerConfig.LIVE_WORLD_CENSUS_INTERVAL_SECONDS.get();
        } catch (IllegalStateException e) {
            return 60;
        }
    }

    @Override
    public int liveStorageIntervalSeconds() {
        try {
            return WatchtowerConfig.LIVE_STORAGE_INTERVAL_SECONDS.get();
        } catch (IllegalStateException e) {
            return 300;
        }
    }

    @Override
    public int liveFlushIntervalSeconds() {
        try {
            return WatchtowerConfig.LIVE_FLUSH_INTERVAL_SECONDS.get();
        } catch (IllegalStateException e) {
            return 30;
        }
    }
}
