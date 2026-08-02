package dev.mcstatus.watchtower;

import dev.mcstatus.watchtower.runtime.ModRuntime;

import dev.mcstatus.watchtower.runtime.ServerContext;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

/**
 * Creates watchtower directories and optional watchtower.conf (no bash/python bundle).
 */
public final class WatchtowerSetup {

    private static volatile boolean ready;
    private static volatile String message = "Not initialized";

    static final String BACKUP_CONF_SECTION = """

            # --- Backups (optional — choose folder in dashboard Backups tab) ---
            # Example Crafty: crafty-4/backups/<server-uuid>/  (timestamp .zip)
            # BACKUP_DIR=/var/opt/minecraft/crafty/crafty-4/backups
            # BACKUP_DIRS=/path/to/crafty-4/backups/<server-uuid>
            # CRAFTY_SERVER_UUID=server-uuid-from-crafty-panel
            # BACKUP_POLL_MIN=30
            # Off-disk backups (S3, panel, k8up): heartbeat file or webhook
            # BACKUP_EXTERNAL_MARKER=watchtower/backup-heartbeat.json
            # BACKUP_WEBHOOK_TOKEN=your-secret-token
            # BACKUP_SUPPRESS_LOCAL_MISSING=true
            # Set false to opt out of backup tracking (no BACKUP_* issues / Overview nudges)
            # BACKUP_TRACKING_ENABLED=true
            """;

    private WatchtowerSetup() {
    }

    public static boolean isReady() {
        return ready;
    }

    public static String getMessage() {
        return message;
    }

    public static void ensureReady(ServerContext server) throws IOException {
        Path watchtowerRoot = WatchtowerPaths.watchtowerRoot(server);
        Files.createDirectories(watchtowerRoot);
        Path rulesDir = server.serverDirectory().resolve("config").resolve("watchtower").resolve("rules");
        Files.createDirectories(rulesDir);
        ensureUserConfig(server);
        EngineProbe.verify();
        if (EngineProbe.isAvailable()) {
            ready = true;
            message = "OK";
            ModRuntime.logger().info("Watchtower ready (pure-Java engine). Reports: {}", watchtowerRoot);
        } else {
            ready = false;
            message = EngineProbe.getFailureReason();
            ModRuntime.logger().error("Watchtower reports disabled: {}", message);
        }
    }

    private static void ensureUserConfig(ServerContext server) throws IOException {
        Path conf = WatchtowerPaths.confPath(server);
        if (Files.isRegularFile(conf)) {
            syncTomlIntoConf(conf);
            return;
        }
        Files.writeString(conf, buildDefaultConf(), StandardCharsets.UTF_8);
        ModRuntime.logger().info("Created default config: {}", conf);
    }

    private static void syncTomlIntoConf(Path conf) throws IOException {
        String text = Files.readString(conf, StandardCharsets.UTF_8);
        String updated = WatchtowerConfWriter.upsertLine(text, "LOOKBACK_HOURS", String.valueOf(ModRuntime.config().lookbackHours()));
        updated = WatchtowerConfWriter.upsertLine(updated, "INCREMENTAL", ModRuntime.config().incremental() ? "true" : "false");
        updated = WatchtowerConfWriter.upsertLine(updated, "LIVE_RETENTION_HOURS", String.valueOf(ModRuntime.config().liveRetentionHours()));
        updated = ensureBackupSection(updated);
        if (!updated.equals(text)) {
            Files.writeString(conf, updated, StandardCharsets.UTF_8);
        }
    }

    static String ensureBackupSection(String text) {
        if (text.contains("BACKUP_DIR=") || text.contains("BACKUP_DIRS=") || text.contains("# --- Backups")) {
            return text;
        }
        return text.stripTrailing() + BACKUP_CONF_SECTION;
    }

    private static String buildDefaultConf() {
        int lookback = 24;
        int liveRetention = 2160;
        boolean incremental = true;
        try {
            lookback = ModRuntime.config().lookbackHours();
            liveRetention = ModRuntime.config().liveRetentionHours();
            incremental = ModRuntime.config().incremental();
        } catch (IllegalStateException ignored) {
        }
        return """
                # Watchtower configuration (auto-created; safe to edit)
                LOOKBACK_HOURS=%d
                LIVE_RETENTION_HOURS=%d
                INCREMENTAL=%s
                REPORT_SCHEDULE_MODE=off
                REPORT_WALL_CLOCK_HOURS=0,12
                REPORT_INTERVAL_MINUTES=720
                ISSUES_LIVE_ENABLED=true
                STARTUP_PROFILE_ON_BOOT=true
                CRASH_ENRICH_ON_MTIME=true
                MODS_LIGHT_ON_JAR_CHANGE=true
                MOD_JAR_DRIFT_ENABLED=true
                CLIENT_ON_SERVER_ISSUES_ENABLED=true
                EXTERNAL_KILL_DETECT_ENABLED=true
                RESTART_HYGIENE_ENABLED=true
                SILENT_FAIL_DETECT_ENABLED=true
                WORLD_PRESSURE_ENABLED=true
                MOD_DISABLE_ENABLED=true
                WORLD_RISK_ENABLED=true
                BACKUP_VERIFY_AUTO=true
                BACKUP_VERIFY_DEFER_WHEN_PLAYERS=true
                BACKUP_VERIFY_MAX_MSPT=40
                BACKUP_TEST_RESTORE_ENABLED=true
                MODS_DEEP_ON_JAR_CHANGE=true
                MODS_DEEP_SEED_ON_BOOT=true
                MODS_DEEP_MAX_JARS_PER_WAKE=32
                ACTIVITY_GAP_BACKFILL_ENABLED=true
                ACTIVITY_GAP_THRESHOLD_MB=5
                ACTIVITY_GAP_CHUNK_MB=2
                PLAYER_DIRECTORY_POLL_SEC=900
                OVERLAP_MINUTES=5
                PANEL=auto
                # Panel override keys (if auto fails): CRAFTY_APP, PTERO_ROOT, PELICAN_ROOT,
                # PUFFER_ROOT, MCSM_ROOT, AMP_ROOT, MULTICRAFT_ROOT, PANEL_ROOT, SYSTEMD_UNIT
                JAVA_PATTERN=forge|neoforge|fabric|minecraft.*jar|unix_args
                DISK_WARN_PCT=85
                MEM_WARN_AVAIL_GB=2
                LOG_STALE_MINUTES=15
                CANT_KEEP_UP_WARN=5
                MSPT_WARN=50
                TPS_WARN=19.5
                CPU_THROTTLE_PCT=95
                TICK_LAG_THROTTLE_MS=5000
                L1_ROLLUP_ENABLED=true
                L1_RETENTION_DAYS=90
                DISK_JUMP_PCT=5
                DISK_JUMP_GB=10
                RSS_HEAP_RATIO_WARN=1.25
                OPS_POLL_SEC=60
                OPS_LOG_SCAN_SEC=60
                REPORT_RETENTION_COUNT=30
                REPORT_RETENTION_DAYS=90
                LAG_INCIDENT_ENABLED=true
                LAG_INCIDENT_COOLDOWN_SEC=180
                INCIDENT_MAX_FILES=50
                LOG_TAIL_LINES=80
                LOG_GZIP_COUNT=12
                BACKUP_WARN_DAYS=7
                BACKUP_STALE_HOURS=24
                BACKUP_POLL_MIN=0
                # Opt-in Modrinth side lookup (SHA-512 hashes only; off by default)
                # MODRINTH_LOOKUP=false
                # Legacy meta-only flag (reports never call Modrinth; dedicated scan owns network)
                # MODRINTH_LOOKUP_ON_REPORT=true
                # MODRINTH_AUTO_SCAN_ON_MOD_CHANGES=false
                # MODRINTH_RATE_LIMIT=5
                # Mod forensics toolbox (1.0.17) — master on; zip walk / index-on-report off by default
                # MOD_FORENSICS_SCAN=true
                # FORENSICS_CORRUPT_JAR_WALK=false
                # FORENSICS_INDEX_ON_REPORT=false
                # FORENSICS_STDERR_PATHS=logs/stderr.log,logs/stderr_stream.log
                # Crash rule packs (1.0.18) — YAML under config/watchtower/rules/; no JEXL/exec
                # CRASH_RULE_PACKS=true
                # CRASH_RULE_BUILTIN=true
                # ISSUE_SUPPRESSIONS=CLIENT_ON_SERVER
                # ISSUE_SUPPRESSION_REGEX=
                """.formatted(lookback, liveRetention, incremental ? "true" : "false") + BACKUP_CONF_SECTION;
    }
}
