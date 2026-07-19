package dev.mcstatus.watchtower;

import net.neoforged.neoforge.common.ModConfigSpec;

public final class WatchtowerConfig {
    private static final ModConfigSpec.Builder BUILDER = new ModConfigSpec.Builder();

    public static final ModConfigSpec.IntValue SAMPLE_INTERVAL_SECONDS = BUILDER
            .comment("How often to refresh watchtower/snapshot.json with live TPS/MSPT")
            .defineInRange("sampleIntervalSeconds", 60, 10, 3600);

    public static final ModConfigSpec.IntValue REPORT_INTERVAL_MINUTES = BUILDER
            .comment("Auto-run full report every N minutes (0 = disabled)")
            .defineInRange("reportIntervalMinutes", 0, 0, 10080);

    public static final ModConfigSpec.IntValue REPORT_TIMEOUT_MINUTES = BUILDER
            .comment("Maximum time to wait for a full report run")
            .defineInRange("reportTimeoutMinutes", 15, 1, 120);

    public static final ModConfigSpec.IntValue LOOKBACK_HOURS = BUILDER
            .comment("Log/journal lookback cap (written to watchtower/watchtower.conf)")
            .defineInRange("lookbackHours", 24, 1, 720);

    public static final ModConfigSpec.BooleanValue INCREMENTAL = BUILDER
            .comment("Incremental log scans since last report (written to watchtower/watchtower.conf)")
            .define("incremental", true);

    public static final ModConfigSpec.IntValue COMMAND_PERMISSION_LEVEL = BUILDER
            .comment("Minimum permission level for /watchtower (2 = OP)")
            .defineInRange("commandPermissionLevel", 2, 0, 4);

    public static final ModConfigSpec.BooleanValue COUNT_ENTITIES = BUILDER
            .comment("Include loaded entity/chunk counts in snapshot (slightly more expensive)")
            .define("countEntities", true);

    public static final ModConfigSpec.IntValue LIVE_SAMPLE_INTERVAL_SECONDS = BUILDER
            .comment("Live dashboard metric recording interval (seconds)")
            .defineInRange("liveSampleIntervalSeconds", 1, 1, 60);

    public static final ModConfigSpec.IntValue LIVE_RETENTION_HOURS = BUILDER
            .comment("How long to retain live metric history (max 2160 = 90 days; older data is downsampled)")
            .defineInRange("liveRetentionHours", 2160, 1, 2160);

    public static final ModConfigSpec.IntValue LIVE_PREGEN_TAIL_INTERVAL_SECONDS = BUILDER
            .comment("How often to tail logs/latest.log for DH pregen progress")
            .defineInRange("livePregenTailIntervalSeconds", 5, 2, 60);

    public static final ModConfigSpec.IntValue LIVE_COUNT_ENTITIES_INTERVAL_SECONDS = BUILDER
            .comment("How often to scan entity/chunk counts for live metrics")
            .defineInRange("liveCountEntitiesIntervalSeconds", 30, 5, 300);

    public static final ModConfigSpec.IntValue LIVE_STORAGE_INTERVAL_SECONDS = BUILDER
            .comment("How often to run storage du scan for live metrics")
            .defineInRange("liveStorageIntervalSeconds", 300, 60, 3600);

    public static final ModConfigSpec.IntValue LIVE_FLUSH_INTERVAL_SECONDS = BUILDER
            .comment("How often to flush live-history.json to disk")
            .defineInRange("liveFlushIntervalSeconds", 30, 5, 600);

    public static final ModConfigSpec.BooleanValue DASHBOARD_ENABLED = BUILDER
            .comment("Start embedded HTTP dashboard server")
            .define("dashboardEnabled", true);

    public static final ModConfigSpec.ConfigValue<String> DASHBOARD_BIND_HOST = BUILDER
            .comment("Dashboard HTTP bind address (0.0.0.0 = all interfaces; use 127.0.0.1 to restrict to localhost)")
            .define("dashboardBindHost", "0.0.0.0");

    public static final ModConfigSpec.IntValue DASHBOARD_PORT = BUILDER
            .comment("Dashboard HTTP port")
            .defineInRange("dashboardPort", 8787, 1024, 65535);

    public static final ModConfigSpec.ConfigValue<String> DASHBOARD_AUTH_TOKEN = BUILDER
            .comment("Deprecated since 1.0.0 — use username/password login instead (ignored at runtime)")
            .define("dashboardAuthToken", "");

    public static final ModConfigSpec SPEC = BUILDER.build();

    private WatchtowerConfig() {
    }
}
