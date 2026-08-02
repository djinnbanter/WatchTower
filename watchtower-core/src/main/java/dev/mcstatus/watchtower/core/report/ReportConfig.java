package dev.mcstatus.watchtower.core.report;

import dev.mcstatus.watchtower.core.collect.ExternalBackupDetector;
import dev.mcstatus.watchtower.core.ops.ActivityGapBackfill;

import java.nio.file.Path;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Configuration for staging collection (ported from mc-status environment variables).
 */
public final class ReportConfig {

    private static final DateTimeFormatter SINCE_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private final String serverDir;
    private final int lookbackHours;
    private final int lookbackMinutes;
    private final String reportMode;
    private final boolean incremental;
    private final String windowStart;
    private final String since;
    private final int logGzipCount;
    private final List<Pattern> errorIgnorePatterns;
    private final String javaPattern;
    private final String craftyApp;
    private final String backupDir;
    private final List<String> backupDirs;
    private final int backupWarnDays;
    /** Hours before newest backup is treated as stale (Issues + dashboard chips). */
    private final int backupStaleHours;
    private final String stateFile;
    private final int cpuSampleIntervalMs;
    private final String panelDetected;
    private final String loader;
    private final boolean javaRunning;
    private final boolean panelRunning;
    private final int diskWarnPct;
    private final double memWarnAvailGb;
    private final int logStaleMinutes;
    private final int cantKeepUpWarn;
    private final double msptWarn;
    private final double tpsWarn;
    private final double cpuThrottlePct;
    private final int tickLagThrottleMs;
    private final String rconHost;
    private final int rconPort;
    private final String rconPassword;
    private final String rconTpsCommand;
    private final boolean rconEntityPoll;
    private final String craftyUrl;
    private final String craftyApiToken;
    private final String craftyServerUuid;
    private final String hostname;
    private final boolean modSideScan;
    private final int modSideScanMaxJars;
    private final boolean modrinthLookup;
    private final boolean modrinthLookupOnReport;
    private final boolean modrinthAutoScanOnModChanges;
    private final int modrinthRateLimit;
    private final int chunkyStallMinutes;
    private final double chunkyDegradedCps;
    private final int chunkGenFailThreshold;
    private final int chunkGenFailWindowMin;
    private final boolean metricsContextBanner;
    private final boolean updateCheck;
    private final boolean l1RollupEnabled;
    private final int l1RetentionDays;
    private final boolean dimensionStorageScan;
    private final double rssHeapRatioWarn;
    private final int opsPollSec;
    private final int opsLogScanSec;
    private final int backupPollMin;
    private final String backupExternalMarker;
    private final String backupWebhookToken;
    private final boolean backupSuppressLocalMissing;
    private final boolean backupTrackingEnabled;
    private final boolean backupVerifyAuto;
    private final boolean backupVerifyDeferWhenPlayers;
    private final int backupVerifyMaxMspt;
    private final boolean backupTestRestoreEnabled;
    private final int lagIncidentCooldownSec;
    private final boolean lagIncidentEnabled;
    private final int incidentMaxFiles;
    private final boolean sparkEnabled;
    private final int sparkFreshHours;
    private final String sparkUploadDir;
    private final boolean sparkAutoCaptureOnLag;
    private final int sparkAutoCaptureWindowSec;
    private final int sparkAutoCaptureCooldownSec;
    private final boolean sparkAutoCaptureCopyToUpload;
    private final boolean baselineAutoCapture;
    private final double baselineRegressionThresholdPct;
    private final int diskFillWarnDays;
    private final int diskFillLookbackHours;
    private final int diskFillMinSpanHours;
    private final double diskFillOutlierGb;
    private final double diskIoLatencyWarnMs;
    private final boolean diskIoProbeEnabled;
    private final boolean incidentStoryEnabled;
    private final int incidentStoryWindowMin;
    private final int incidentStoryLookbackHours;
    private final int incidentStoryMax;
    private final boolean weeklyDigestEnabled;
    private final int weeklyDigestIntervalDays;
    private final int weeklyDigestHistoryMax;
    private final boolean modJarDriftEnabled;
    private final boolean clientOnServerIssuesEnabled;
    private final boolean externalKillDetectEnabled;
    private final boolean softHangEnabled;
    private final int softHangSeconds;
    private final boolean softHangThreadDump;
    private final int softHangCooldownMin;
    private final boolean restartHygieneEnabled;
    private final boolean silentFailDetectEnabled;
    private final boolean worldPressureEnabled;
    private final boolean chunkWritePressureEnabled;
    private final int chunkWriteGrowthChunks;
    private final int chunkWriteSustainedScans;
    private final boolean joinClinicEnabled;
    private final boolean modDisableEnabled;
    private final boolean modConfigEditEnabled;
    private final boolean worldRiskEnabled;
    private final boolean configAuditEnabled;
    private final int reportRetentionCount;
    private final int reportRetentionDays;
    private final boolean modForensicsScan;
    private final boolean forensicsCorruptJarWalk;
    private final boolean forensicsIndexOnReport;
    private final String forensicsStderrPaths;
    private final boolean crashRulePacks;
    private final boolean crashRuleBuiltin;
    private final String issueSuppressions;
    private final String issueSuppressionRegex;
    private final boolean issuesLiveEnabled;
    private final boolean startupProfileOnBoot;
    private final int startupProfileBootDelaySec;
    private final boolean modsLightOnJarChange;
    private final boolean modsDeepOnJarChange;
    private final boolean modsDeepSeedOnBoot;
    private final int modsDeepMaxJarsPerWake;
    private final int playerDirectoryPollSec;
    private final boolean crashEnrichOnMtime;
    private final boolean activityGapBackfillEnabled;
    private final long activityGapThresholdBytes;
    private final long activityGapChunkBytes;

    private ReportConfig(Builder b) {
        this.serverDir = b.serverDir;
        this.lookbackHours = b.lookbackHours;
        this.lookbackMinutes = b.lookbackMinutes;
        this.reportMode = b.reportMode;
        this.incremental = b.incremental;
        this.windowStart = b.windowStart;
        this.since = b.since;
        this.logGzipCount = b.logGzipCount;
        this.errorIgnorePatterns = List.copyOf(b.errorIgnorePatterns);
        this.javaPattern = b.javaPattern;
        this.craftyApp = b.craftyApp;
        this.backupDir = b.backupDir;
        this.backupDirs = List.copyOf(b.backupDirs);
        this.backupWarnDays = b.backupWarnDays;
        this.backupStaleHours = b.backupStaleHours;
        this.stateFile = b.stateFile;
        this.cpuSampleIntervalMs = b.cpuSampleIntervalMs;
        this.panelDetected = b.panelDetected;
        this.loader = b.loader;
        this.javaRunning = b.javaRunning;
        this.panelRunning = b.panelRunning;
        this.diskWarnPct = b.diskWarnPct;
        this.memWarnAvailGb = b.memWarnAvailGb;
        this.logStaleMinutes = b.logStaleMinutes;
        this.cantKeepUpWarn = b.cantKeepUpWarn;
        this.msptWarn = b.msptWarn;
        this.tpsWarn = b.tpsWarn;
        this.cpuThrottlePct = b.cpuThrottlePct;
        this.tickLagThrottleMs = b.tickLagThrottleMs;
        this.rconHost = b.rconHost;
        this.rconPort = b.rconPort;
        this.rconPassword = b.rconPassword;
        this.rconTpsCommand = b.rconTpsCommand;
        this.rconEntityPoll = b.rconEntityPoll;
        this.craftyUrl = b.craftyUrl;
        this.craftyApiToken = b.craftyApiToken;
        this.craftyServerUuid = b.craftyServerUuid;
        this.hostname = b.hostname;
        this.modSideScan = b.modSideScan;
        this.modSideScanMaxJars = b.modSideScanMaxJars;
        this.modrinthLookup = b.modrinthLookup;
        this.modrinthLookupOnReport = b.modrinthLookupOnReport;
        this.modrinthAutoScanOnModChanges = b.modrinthAutoScanOnModChanges;
        this.modrinthRateLimit = b.modrinthRateLimit;
        this.chunkyStallMinutes = b.chunkyStallMinutes;
        this.chunkyDegradedCps = b.chunkyDegradedCps;
        this.chunkGenFailThreshold = b.chunkGenFailThreshold;
        this.chunkGenFailWindowMin = b.chunkGenFailWindowMin;
        this.metricsContextBanner = b.metricsContextBanner;
        this.updateCheck = b.updateCheck;
        this.l1RollupEnabled = b.l1RollupEnabled;
        this.l1RetentionDays = b.l1RetentionDays;
        this.dimensionStorageScan = b.dimensionStorageScan;
        this.rssHeapRatioWarn = b.rssHeapRatioWarn;
        this.opsPollSec = b.opsPollSec;
        this.opsLogScanSec = b.opsLogScanSec;
        this.backupPollMin = b.backupPollMin;
        this.backupExternalMarker = b.backupExternalMarker;
        this.backupWebhookToken = b.backupWebhookToken;
        this.backupSuppressLocalMissing = b.backupSuppressLocalMissing;
        this.backupTrackingEnabled = b.backupTrackingEnabled;
        this.backupVerifyAuto = b.backupVerifyAuto;
        this.backupVerifyDeferWhenPlayers = b.backupVerifyDeferWhenPlayers;
        this.backupVerifyMaxMspt = b.backupVerifyMaxMspt;
        this.backupTestRestoreEnabled = b.backupTestRestoreEnabled;
        this.lagIncidentCooldownSec = b.lagIncidentCooldownSec;
        this.lagIncidentEnabled = b.lagIncidentEnabled;
        this.incidentMaxFiles = b.incidentMaxFiles;
        this.sparkEnabled = b.sparkEnabled;
        this.sparkFreshHours = b.sparkFreshHours;
        this.sparkUploadDir = b.sparkUploadDir;
        this.sparkAutoCaptureOnLag = b.sparkAutoCaptureOnLag;
        this.sparkAutoCaptureWindowSec = b.sparkAutoCaptureWindowSec;
        this.sparkAutoCaptureCooldownSec = b.sparkAutoCaptureCooldownSec;
        this.sparkAutoCaptureCopyToUpload = b.sparkAutoCaptureCopyToUpload;
        this.baselineAutoCapture = b.baselineAutoCapture;
        this.baselineRegressionThresholdPct = b.baselineRegressionThresholdPct;
        this.diskFillWarnDays = b.diskFillWarnDays;
        this.diskFillLookbackHours = b.diskFillLookbackHours;
        this.diskFillMinSpanHours = b.diskFillMinSpanHours;
        this.diskFillOutlierGb = b.diskFillOutlierGb;
        this.diskIoLatencyWarnMs = b.diskIoLatencyWarnMs;
        this.diskIoProbeEnabled = b.diskIoProbeEnabled;
        this.incidentStoryEnabled = b.incidentStoryEnabled;
        this.incidentStoryWindowMin = b.incidentStoryWindowMin;
        this.incidentStoryLookbackHours = b.incidentStoryLookbackHours;
        this.incidentStoryMax = b.incidentStoryMax;
        this.weeklyDigestEnabled = b.weeklyDigestEnabled;
        this.weeklyDigestIntervalDays = b.weeklyDigestIntervalDays;
        this.weeklyDigestHistoryMax = b.weeklyDigestHistoryMax;
        this.modJarDriftEnabled = b.modJarDriftEnabled;
        this.clientOnServerIssuesEnabled = b.clientOnServerIssuesEnabled;
        this.externalKillDetectEnabled = b.externalKillDetectEnabled;
        this.softHangEnabled = b.softHangEnabled;
        this.softHangSeconds = b.softHangSeconds;
        this.softHangThreadDump = b.softHangThreadDump;
        this.softHangCooldownMin = b.softHangCooldownMin;
        this.restartHygieneEnabled = b.restartHygieneEnabled;
        this.silentFailDetectEnabled = b.silentFailDetectEnabled;
        this.worldPressureEnabled = b.worldPressureEnabled;
        this.chunkWritePressureEnabled = b.chunkWritePressureEnabled;
        this.chunkWriteGrowthChunks = b.chunkWriteGrowthChunks;
        this.chunkWriteSustainedScans = b.chunkWriteSustainedScans;
        this.joinClinicEnabled = b.joinClinicEnabled;
        this.modDisableEnabled = b.modDisableEnabled;
        this.modConfigEditEnabled = b.modConfigEditEnabled;
        this.worldRiskEnabled = b.worldRiskEnabled;
        this.configAuditEnabled = b.configAuditEnabled;
        this.reportRetentionCount = b.reportRetentionCount;
        this.reportRetentionDays = b.reportRetentionDays;
        this.modForensicsScan = b.modForensicsScan;
        this.forensicsCorruptJarWalk = b.forensicsCorruptJarWalk;
        this.forensicsIndexOnReport = b.forensicsIndexOnReport;
        this.forensicsStderrPaths = b.forensicsStderrPaths;
        this.crashRulePacks = b.crashRulePacks;
        this.crashRuleBuiltin = b.crashRuleBuiltin;
        this.issueSuppressions = b.issueSuppressions;
        this.issueSuppressionRegex = b.issueSuppressionRegex;
        this.issuesLiveEnabled = b.issuesLiveEnabled;
        this.startupProfileOnBoot = b.startupProfileOnBoot;
        this.startupProfileBootDelaySec = b.startupProfileBootDelaySec;
        this.modsLightOnJarChange = b.modsLightOnJarChange;
        this.modsDeepOnJarChange = b.modsDeepOnJarChange;
        this.modsDeepSeedOnBoot = b.modsDeepSeedOnBoot;
        this.modsDeepMaxJarsPerWake = b.modsDeepMaxJarsPerWake;
        this.playerDirectoryPollSec = b.playerDirectoryPollSec;
        this.crashEnrichOnMtime = b.crashEnrichOnMtime;
        this.activityGapBackfillEnabled = b.activityGapBackfillEnabled;
        this.activityGapThresholdBytes = b.activityGapThresholdBytes;
        this.activityGapChunkBytes = b.activityGapChunkBytes;
    }

    public static Builder builder() {
        return new Builder();
    }

    public static ReportConfig fromEnvironment() {
        return fromMap(System.getenv());
    }

    public static ReportConfig fromMap(Map<String, String> env) {
        Builder b = builder();
        b.serverDir = env.getOrDefault("SERVER_DIR", "");
        b.lookbackHours = parseInt(env.get("LOOKBACK_HOURS"), 24);
        b.lookbackMinutes = parseInt(env.get("LOOKBACK_MINUTES"), 0);
        b.reportMode = env.getOrDefault("REPORT_MODE", "live");
        b.incremental = isTruthy(env.get("INCREMENTAL"), true);
        b.windowStart = env.getOrDefault("WINDOW_START", "");
        b.since = env.getOrDefault("SINCE", "");
        b.logGzipCount = parseInt(env.get("LOG_GZIP_COUNT"), 5);
        b.errorIgnorePatterns = compileIgnorePatterns(env.get("ERROR_IGNORE_PATTERNS"));
        b.javaPattern = env.getOrDefault("JAVA_PATTERN", "forge|neoforge|fabric|minecraft");
        b.craftyApp = env.getOrDefault("CRAFTY_APP", "");
        b.backupDir = env.getOrDefault("BACKUP_DIR", "");
        b.backupDirs = parseCsvPaths(env.get("BACKUP_DIRS"));
        b.backupWarnDays = parseInt(env.get("BACKUP_WARN_DAYS"), 7);
        b.backupStaleHours = Math.max(1, Math.min(720, parseInt(env.get("BACKUP_STALE_HOURS"), 24)));
        b.stateFile = env.getOrDefault("STATE_FILE", "");
        b.cpuSampleIntervalMs = parseInt(env.get("CPU_SAMPLE_INTERVAL_MS"), 200);
        b.panelDetected = env.getOrDefault("PANEL_DETECTED", "unknown");
        b.loader = env.getOrDefault("LOADER", "unknown");
        b.javaRunning = "true".equalsIgnoreCase(env.get("JAVA_RUNNING"));
        b.panelRunning = "true".equalsIgnoreCase(env.get("PANEL_RUNNING"));
        b.diskWarnPct = parseInt(env.get("DISK_WARN_PCT"), 85);
        b.memWarnAvailGb = parseDouble(env.get("MEM_WARN_AVAIL_GB"), 2.0);
        b.logStaleMinutes = parseInt(env.get("LOG_STALE_MINUTES"), 15);
        b.cantKeepUpWarn = parseInt(env.get("CANT_KEEP_UP_WARN"), 5);
        b.msptWarn = parseDouble(env.get("MSPT_WARN"), 50.0);
        b.tpsWarn = parseDouble(env.get("TPS_WARN"), 19.5);
        b.cpuThrottlePct = parseDouble(env.get("CPU_THROTTLE_PCT"), 95.0);
        b.tickLagThrottleMs = parseInt(env.get("TICK_LAG_THROTTLE_MS"), 5000);
        b.rconHost = env.getOrDefault("RCON_HOST", "127.0.0.1");
        b.rconPort = parseInt(env.get("RCON_PORT"), 25575);
        b.rconPassword = env.getOrDefault("RCON_PASSWORD", "");
        b.rconTpsCommand = env.getOrDefault("RCON_TPS_COMMAND", "neoforge tps");
        b.rconEntityPoll = isTruthy(env.get("RCON_ENTITY_POLL"), false);
        b.craftyUrl = env.getOrDefault("CRAFTY_URL", "");
        b.craftyApiToken = env.getOrDefault("CRAFTY_API_TOKEN", "");
        b.craftyServerUuid = env.getOrDefault("CRAFTY_SERVER_UUID", "");
        b.hostname = resolveHostname();
        b.modSideScan = isTruthy(env.get("MOD_SIDE_SCAN"), false);
        b.modSideScanMaxJars = parseInt(env.get("MOD_SIDE_SCAN_MAX_JARS"), 50);
        b.modrinthLookup = isTruthy(env.get("MODRINTH_LOOKUP"), false);
        b.modrinthLookupOnReport = isTruthy(env.get("MODRINTH_LOOKUP_ON_REPORT"), true);
        b.modrinthAutoScanOnModChanges = isTruthy(env.get("MODRINTH_AUTO_SCAN_ON_MOD_CHANGES"), false);
        b.modrinthRateLimit = parseInt(env.get("MODRINTH_RATE_LIMIT"), 5);
        b.chunkyStallMinutes = parseInt(env.get("CHUNKY_STALL_MINUTES"), 10);
        b.chunkyDegradedCps = parseDouble(env.get("CHUNKY_DEGRADED_CPS"), 5.0);
        b.chunkGenFailThreshold = parseInt(env.get("CHUNK_GEN_FAIL_THRESHOLD"), 3);
        b.chunkGenFailWindowMin = parseInt(env.get("CHUNK_GEN_FAIL_WINDOW_MIN"), 30);
        b.metricsContextBanner = isTruthy(env.get("METRICS_CONTEXT_BANNER"), true);
        b.updateCheck = isTruthy(env.get("UPDATE_CHECK"), true);
        b.l1RollupEnabled = isTruthy(env.get("L1_ROLLUP_ENABLED"), true);
        b.l1RetentionDays = parseInt(env.get("L1_RETENTION_DAYS"), 90);
        b.dimensionStorageScan = isTruthy(env.get("DIMENSION_STORAGE_SCAN"), true);
        b.rssHeapRatioWarn = parseDouble(env.get("RSS_HEAP_RATIO_WARN"), 1.25);
        b.opsPollSec = parseInt(env.get("OPS_POLL_SEC"), 60);
        b.opsLogScanSec = parseInt(env.get("OPS_LOG_SCAN_SEC"), 60);
        b.backupPollMin = parseInt(env.get("BACKUP_POLL_MIN"), 0);
        String markerEnv = env.get("BACKUP_EXTERNAL_MARKER");
        if (markerEnv == null) {
            b.backupExternalMarker = ExternalBackupDetector.DEFAULT_MARKER_REL;
        } else {
            b.backupExternalMarker = markerEnv.strip();
        }
        b.backupWebhookToken = env.getOrDefault("BACKUP_WEBHOOK_TOKEN", "");
        b.backupSuppressLocalMissing = isTruthy(env.get("BACKUP_SUPPRESS_LOCAL_MISSING"), true);
        b.backupTrackingEnabled = isTruthy(env.get("BACKUP_TRACKING_ENABLED"), true);
        b.backupVerifyAuto = isTruthy(env.get("BACKUP_VERIFY_AUTO"), true);
        b.backupVerifyDeferWhenPlayers = isTruthy(env.get("BACKUP_VERIFY_DEFER_WHEN_PLAYERS"), true);
        b.backupVerifyMaxMspt = parseInt(env.get("BACKUP_VERIFY_MAX_MSPT"), 40);
        b.backupTestRestoreEnabled = isTruthy(env.get("BACKUP_TEST_RESTORE_ENABLED"), true);
        b.lagIncidentCooldownSec = parseInt(env.get("LAG_INCIDENT_COOLDOWN_SEC"), 180);
        b.lagIncidentEnabled = isTruthy(env.get("LAG_INCIDENT_ENABLED"), true);
        b.incidentMaxFiles = parseInt(env.get("INCIDENT_MAX_FILES"), 50);
        b.sparkEnabled = isTruthy(env.get("SPARK_ENABLED"), true);
        b.sparkFreshHours = parseInt(env.get("SPARK_FRESH_HOURS"), 24);
        b.sparkUploadDir = env.getOrDefault("SPARK_UPLOAD_DIR", "");
        b.sparkAutoCaptureOnLag = isTruthy(env.get("SPARK_AUTO_CAPTURE_ON_LAG"), false);
        b.sparkAutoCaptureWindowSec = parseInt(env.get("SPARK_AUTO_CAPTURE_WINDOW_SEC"), 45);
        b.sparkAutoCaptureCooldownSec = parseInt(env.get("SPARK_AUTO_CAPTURE_COOLDOWN_SEC"), 900);
        b.sparkAutoCaptureCopyToUpload = isTruthy(env.get("SPARK_AUTO_CAPTURE_COPY_TO_UPLOAD"), true);
        b.baselineAutoCapture = isTruthy(env.get("BASELINE_AUTO_CAPTURE"), true);
        b.baselineRegressionThresholdPct = parseDouble(env.get("BASELINE_REGRESSION_THRESHOLD_PCT"), 10.0);
        b.diskFillWarnDays = parseInt(env.get("DISK_FILL_WARN_DAYS"), 14);
        b.diskFillLookbackHours = parseInt(env.get("DISK_FILL_LOOKBACK_HOURS"), 24);
        b.diskFillMinSpanHours = parseInt(env.get("DISK_FILL_MIN_SPAN_HOURS"), 6);
        b.diskFillOutlierGb = parseDouble(env.get("DISK_FILL_OUTLIER_GB"), 5.0);
        b.diskIoLatencyWarnMs = parseDouble(env.get("DISK_IO_LATENCY_WARN_MS"), 50.0);
        b.diskIoProbeEnabled = isTruthy(env.get("DISK_IO_PROBE_ENABLED"), true);
        b.incidentStoryEnabled = isTruthy(env.get("INCIDENT_STORY_ENABLED"), true);
        b.incidentStoryWindowMin = parseInt(env.get("INCIDENT_STORY_WINDOW_MIN"), 30);
        b.incidentStoryLookbackHours = parseInt(env.get("INCIDENT_STORY_LOOKBACK_HOURS"), 48);
        b.incidentStoryMax = parseInt(env.get("INCIDENT_STORY_MAX"), 10);
        b.weeklyDigestEnabled = isTruthy(env.get("WEEKLY_DIGEST_ENABLED"), true);
        b.weeklyDigestIntervalDays = parseInt(env.get("WEEKLY_DIGEST_INTERVAL_DAYS"), 7);
        b.weeklyDigestHistoryMax = parseInt(env.get("WEEKLY_DIGEST_HISTORY_MAX"), 8);
        b.modJarDriftEnabled = isTruthy(env.get("MOD_JAR_DRIFT_ENABLED"), true);
        b.clientOnServerIssuesEnabled = isTruthy(env.get("CLIENT_ON_SERVER_ISSUES_ENABLED"), true);
        b.externalKillDetectEnabled = isTruthy(env.get("EXTERNAL_KILL_DETECT_ENABLED"), true);
        b.softHangEnabled = isTruthy(env.get("SOFT_HANG_ENABLED"), true);
        b.softHangSeconds = parseInt(env.get("SOFT_HANG_SECONDS"), 90);
        b.softHangThreadDump = isTruthy(env.get("SOFT_HANG_THREAD_DUMP"), false);
        b.softHangCooldownMin = parseInt(env.get("SOFT_HANG_COOLDOWN_MIN"), 15);
        b.restartHygieneEnabled = isTruthy(env.get("RESTART_HYGIENE_ENABLED"), true);
        b.silentFailDetectEnabled = isTruthy(env.get("SILENT_FAIL_DETECT_ENABLED"), true);
        b.worldPressureEnabled = isTruthy(env.get("WORLD_PRESSURE_ENABLED"), true);
        b.chunkWritePressureEnabled = isTruthy(env.get("CHUNK_WRITE_PRESSURE_ENABLED"), true);
        b.chunkWriteGrowthChunks = parseInt(env.get("CHUNK_WRITE_GROWTH_CHUNKS"), 48);
        b.chunkWriteSustainedScans = parseInt(env.get("CHUNK_WRITE_SUSTAINED_SCANS"), 3);
        b.joinClinicEnabled = isTruthy(env.get("JOIN_CLINIC_ENABLED"), true);
        b.modDisableEnabled = isTruthy(env.get("MOD_DISABLE_ENABLED"), true);
        b.modConfigEditEnabled = isTruthy(env.get("MOD_CONFIG_EDIT_ENABLED"), true);
        b.worldRiskEnabled = isTruthy(env.get("WORLD_RISK_ENABLED"), true);
        b.configAuditEnabled = isTruthy(env.get("CONFIG_AUDIT_ENABLED"), true);
        b.reportRetentionCount = parseInt(env.get("REPORT_RETENTION_COUNT"), ReportRetentionPolicy.DEFAULT_RETENTION_COUNT);
        b.reportRetentionDays = parseInt(env.get("REPORT_RETENTION_DAYS"), ReportRetentionPolicy.DEFAULT_RETENTION_DAYS);
        b.modForensicsScan = isTruthy(env.get("MOD_FORENSICS_SCAN"), true);
        b.forensicsCorruptJarWalk = isTruthy(env.get("FORENSICS_CORRUPT_JAR_WALK"), false);
        b.forensicsIndexOnReport = isTruthy(env.get("FORENSICS_INDEX_ON_REPORT"), false);
        b.forensicsStderrPaths = env.getOrDefault("FORENSICS_STDERR_PATHS",
                "logs/stderr.log,logs/stderr_stream.log");
        b.crashRulePacks = isTruthy(env.get("CRASH_RULE_PACKS"), true);
        b.crashRuleBuiltin = isTruthy(env.get("CRASH_RULE_BUILTIN"), true);
        b.issueSuppressions = env.getOrDefault("ISSUE_SUPPRESSIONS", "");
        b.issueSuppressionRegex = env.getOrDefault("ISSUE_SUPPRESSION_REGEX", "");
        b.issuesLiveEnabled = isTruthy(env.get("ISSUES_LIVE_ENABLED"), true);
        b.startupProfileOnBoot = isTruthy(env.get("STARTUP_PROFILE_ON_BOOT"), true);
        b.startupProfileBootDelaySec = parseInt(env.get("STARTUP_PROFILE_BOOT_DELAY_SEC"), 60);
        b.modsLightOnJarChange = isTruthy(env.get("MODS_LIGHT_ON_JAR_CHANGE"), true);
        b.modsDeepOnJarChange = isTruthy(env.get("MODS_DEEP_ON_JAR_CHANGE"), true);
        b.modsDeepSeedOnBoot = isTruthy(env.get("MODS_DEEP_SEED_ON_BOOT"), true);
        b.modsDeepMaxJarsPerWake = parseInt(env.get("MODS_DEEP_MAX_JARS_PER_WAKE"), 32);
        b.playerDirectoryPollSec = parseInt(env.get("PLAYER_DIRECTORY_POLL_SEC"), 900);
        b.crashEnrichOnMtime = isTruthy(env.get("CRASH_ENRICH_ON_MTIME"), true);
        b.activityGapBackfillEnabled = isTruthy(env.get("ACTIVITY_GAP_BACKFILL_ENABLED"), true);
        b.activityGapThresholdBytes = parseLongBytes(
                env.get("ACTIVITY_GAP_THRESHOLD_MB"), ActivityGapBackfill.DEFAULT_GAP_THRESHOLD_BYTES, 1024 * 1024);
        b.activityGapChunkBytes = parseLongBytes(
                env.get("ACTIVITY_GAP_CHUNK_MB"), ActivityGapBackfill.DEFAULT_CHUNK_BYTES, 1024 * 1024);
        return b.build();
    }

    private static String resolveHostname() {
        String host = System.getenv("HOSTNAME");
        if (host != null && !host.isBlank()) {
            return host;
        }
        host = System.getenv("COMPUTERNAME");
        if (host != null && !host.isBlank()) {
            return host;
        }
        try {
            return java.net.InetAddress.getLocalHost().getHostName();
        } catch (Exception e) {
            return "unknown";
        }
    }

    private static List<Pattern> compileIgnorePatterns(String raw) {
        if (raw == null || raw.isBlank()) {
            return List.of();
        }
        List<Pattern> patterns = new ArrayList<>();
        for (String part : raw.split("\\|")) {
            if (!part.isBlank()) {
                patterns.add(Pattern.compile(part, Pattern.CASE_INSENSITIVE));
            }
        }
        return patterns;
    }

    private static boolean isTruthy(String value, boolean defaultValue) {
        if (value == null || value.isBlank()) {
            return defaultValue;
        }
        String v = value.toLowerCase(Locale.ROOT);
        return v.equals("1") || v.equals("true") || v.equals("yes");
    }

    private static int parseInt(String value, int defaultValue) {
        if (value == null || value.isBlank()) {
            return defaultValue;
        }
        try {
            return Integer.parseInt(value.trim());
        } catch (NumberFormatException e) {
            return defaultValue;
        }
    }

    private static double parseDouble(String value, double defaultValue) {
        if (value == null || value.isBlank()) {
            return defaultValue;
        }
        try {
            return Double.parseDouble(value.trim());
        } catch (NumberFormatException e) {
            return defaultValue;
        }
    }

    private static long parseLongBytes(String value, long defaultBytes, long unit) {
        if (value == null || value.isBlank()) {
            return defaultBytes;
        }
        try {
            return Math.max(1024, (long) Double.parseDouble(value.trim()) * unit);
        } catch (NumberFormatException e) {
            return defaultBytes;
        }
    }

    private static List<String> parseCsvPaths(String raw) {
        if (raw == null || raw.isBlank()) {
            return List.of();
        }
        List<String> out = new ArrayList<>();
        for (String part : raw.split(",")) {
            if (!part.isBlank()) {
                out.add(part.trim());
            }
        }
        return out;
    }

    /**
     * Window start as epoch seconds (matches Python {@code parse_window_start}).
     */
    public double windowStartEpoch() {
        String ws = windowStart != null && !windowStart.isBlank() ? windowStart : since;
        if (ws != null && !ws.isBlank()) {
            if (ws.contains("T")) {
                try {
                    return Instant.parse(ws.replace("Z", "+00:00")).getEpochSecond()
                            + Instant.parse(ws.replace("Z", "+00:00")).getNano() / 1_000_000_000.0;
                } catch (DateTimeParseException ignored) {
                    try {
                        return ZonedDateTime.parse(ws).toEpochSecond();
                    } catch (DateTimeParseException ignored2) {
                        // fall through
                    }
                }
            }
            for (String fmt : List.of("yyyy-MM-dd HH:mm:ss", "yyyy-MM-dd'T'HH:mm:ss")) {
                try {
                    if (fmt.contains("T")) {
                        return ZonedDateTime.parse(ws).toEpochSecond();
                    }
                    return ZonedDateTime.parse(ws, DateTimeFormatter.ofPattern(fmt).withZone(ZoneId.systemDefault()))
                            .toEpochSecond();
                } catch (DateTimeParseException ignored) {
                    // try next
                }
            }
        }
        if (lookbackMinutes > 0) {
            return Instant.now().getEpochSecond() - (long) lookbackMinutes * 60L;
        }
        return Instant.now().getEpochSecond() - (long) lookbackHours * 3600L;
    }

    /**
     * Human-readable since string for journalctl (matches Python build_staging).
     */
    public String sinceString() {
        if (since != null && !since.isBlank()) {
            return since;
        }
        return ZonedDateTime.ofInstant(Instant.ofEpochSecond((long) windowStartEpoch()), ZoneId.systemDefault())
                .format(SINCE_FMT);
    }

    public boolean serverDirValid() {
        return serverDir != null && !serverDir.isBlank() && Path.of(serverDir).toFile().isDirectory();
    }

    public String serverDir() { return serverDir; }
    public int lookbackHours() { return lookbackHours; }
    public int lookbackMinutes() { return lookbackMinutes; }
    public String reportMode() { return reportMode; }
    public boolean disasterRecovery() { return "dr".equalsIgnoreCase(reportMode); }
    public boolean incremental() { return incremental; }
    public String windowStart() { return windowStart; }
    public String since() { return since; }
    public int logGzipCount() { return logGzipCount; }
    public List<Pattern> errorIgnorePatterns() { return errorIgnorePatterns; }
    public String javaPattern() { return javaPattern; }
    public String craftyApp() { return craftyApp; }
    public String backupDir() { return backupDir; }
    public List<String> backupDirs() { return backupDirs; }
    public int backupWarnDays() { return backupWarnDays; }
    public int backupStaleHours() { return backupStaleHours; }
    public String stateFile() { return stateFile; }
    public int cpuSampleIntervalMs() { return cpuSampleIntervalMs; }
    public String panelDetected() { return panelDetected; }
    public String loader() { return loader; }
    public boolean javaRunning() { return javaRunning; }
    public boolean panelRunning() { return panelRunning; }
    public int diskWarnPct() { return diskWarnPct; }
    public double memWarnAvailGb() { return memWarnAvailGb; }
    public int logStaleMinutes() { return logStaleMinutes; }
    public int cantKeepUpWarn() { return cantKeepUpWarn; }
    public double msptWarn() { return msptWarn; }
    public double tpsWarn() { return tpsWarn; }
    public double cpuThrottlePct() { return cpuThrottlePct; }
    public int tickLagThrottleMs() { return tickLagThrottleMs; }
    public String rconHost() { return rconHost; }
    public int rconPort() { return rconPort; }
    public String rconPassword() { return rconPassword; }
    public String rconTpsCommand() { return rconTpsCommand; }
    public boolean rconEntityPoll() { return rconEntityPoll; }
    public String craftyUrl() { return craftyUrl; }
    public String craftyApiToken() { return craftyApiToken; }
    public String craftyServerUuid() { return craftyServerUuid; }
    public String hostname() { return hostname; }
    public boolean modSideScan() { return modSideScan; }
    public int modSideScanMaxJars() { return modSideScanMaxJars; }
    public boolean modrinthLookup() { return modrinthLookup; }
    public boolean modrinthLookupOnReport() { return modrinthLookupOnReport; }
    public boolean modrinthAutoScanOnModChanges() { return modrinthAutoScanOnModChanges; }
    public int modrinthRateLimit() { return modrinthRateLimit; }
    public int chunkyStallMinutes() { return chunkyStallMinutes; }
    public double chunkyDegradedCps() { return chunkyDegradedCps; }
    public int chunkGenFailThreshold() { return chunkGenFailThreshold; }
    public int chunkGenFailWindowMin() { return chunkGenFailWindowMin; }
    public boolean metricsContextBanner() { return metricsContextBanner; }
    public boolean updateCheck() { return updateCheck; }
    public boolean l1RollupEnabled() { return l1RollupEnabled; }
    public int l1RetentionDays() { return l1RetentionDays; }
    public boolean dimensionStorageScan() { return dimensionStorageScan; }
    public double rssHeapRatioWarn() { return rssHeapRatioWarn; }
    public int opsPollSec() { return opsPollSec; }
    public int opsLogScanSec() { return opsLogScanSec; }
    public int backupPollMin() { return backupPollMin; }
    public String backupExternalMarker() { return backupExternalMarker; }
    public String backupWebhookToken() { return backupWebhookToken; }
    public boolean backupSuppressLocalMissing() { return backupSuppressLocalMissing; }
    public boolean backupTrackingEnabled() { return backupTrackingEnabled; }
    public boolean backupVerifyAuto() { return backupVerifyAuto; }
    public boolean backupVerifyDeferWhenPlayers() { return backupVerifyDeferWhenPlayers; }
    public int backupVerifyMaxMspt() { return backupVerifyMaxMspt; }
    public boolean backupTestRestoreEnabled() { return backupTestRestoreEnabled; }
    public boolean isExternalBackupConfigured() {
        if (backupWebhookToken != null && !backupWebhookToken.isBlank()) {
            return true;
        }
        return backupExternalMarker != null && !backupExternalMarker.isBlank();
    }
    public boolean hasBackupDirs() {
        if (!backupDirs.isEmpty()) {
            return true;
        }
        return backupDir != null && !backupDir.isBlank();
    }
    public int lagIncidentCooldownSec() { return lagIncidentCooldownSec; }
    public boolean lagIncidentEnabled() { return lagIncidentEnabled; }
    public int incidentMaxFiles() { return incidentMaxFiles; }
    public boolean sparkEnabled() { return sparkEnabled; }
    public int sparkFreshHours() { return sparkFreshHours; }
    public String sparkUploadDir() { return sparkUploadDir; }
    public boolean sparkAutoCaptureOnLag() { return sparkAutoCaptureOnLag; }
    public int sparkAutoCaptureWindowSec() { return sparkAutoCaptureWindowSec; }
    public int sparkAutoCaptureCooldownSec() { return sparkAutoCaptureCooldownSec; }
    public boolean sparkAutoCaptureCopyToUpload() { return sparkAutoCaptureCopyToUpload; }
    public boolean baselineAutoCapture() { return baselineAutoCapture; }
    public double baselineRegressionThresholdPct() { return baselineRegressionThresholdPct; }
    public int diskFillWarnDays() { return diskFillWarnDays; }
    public int diskFillLookbackHours() { return diskFillLookbackHours; }
    public int diskFillMinSpanHours() { return diskFillMinSpanHours; }
    public double diskFillOutlierGb() { return diskFillOutlierGb; }
    public double diskIoLatencyWarnMs() { return diskIoLatencyWarnMs; }
    public boolean diskIoProbeEnabled() { return diskIoProbeEnabled; }
    public boolean incidentStoryEnabled() { return incidentStoryEnabled; }
    public int incidentStoryWindowMin() { return incidentStoryWindowMin; }
    public int incidentStoryLookbackHours() { return incidentStoryLookbackHours; }
    public int incidentStoryMax() { return incidentStoryMax; }
    public boolean weeklyDigestEnabled() { return weeklyDigestEnabled; }
    public int weeklyDigestIntervalDays() { return weeklyDigestIntervalDays; }
    public int weeklyDigestHistoryMax() { return weeklyDigestHistoryMax; }
    public boolean modJarDriftEnabled() { return modJarDriftEnabled; }
    public boolean clientOnServerIssuesEnabled() { return clientOnServerIssuesEnabled; }
    public boolean externalKillDetectEnabled() { return externalKillDetectEnabled; }
    public boolean softHangEnabled() { return softHangEnabled; }
    public int softHangSeconds() { return softHangSeconds; }
    public boolean softHangThreadDump() { return softHangThreadDump; }
    public int softHangCooldownMin() { return softHangCooldownMin; }
    public boolean restartHygieneEnabled() { return restartHygieneEnabled; }
    public boolean silentFailDetectEnabled() { return silentFailDetectEnabled; }
    public boolean worldPressureEnabled() { return worldPressureEnabled; }
    public boolean chunkWritePressureEnabled() { return chunkWritePressureEnabled; }
    public int chunkWriteGrowthChunks() { return chunkWriteGrowthChunks; }
    public int chunkWriteSustainedScans() { return chunkWriteSustainedScans; }
    public boolean joinClinicEnabled() { return joinClinicEnabled; }
    public boolean modDisableEnabled() { return modDisableEnabled; }
    public boolean modConfigEditEnabled() { return modConfigEditEnabled; }
    public boolean worldRiskEnabled() { return worldRiskEnabled; }
    public boolean configAuditEnabled() { return configAuditEnabled; }
    public int reportRetentionCount() { return reportRetentionCount; }
    public int reportRetentionDays() { return reportRetentionDays; }
    public boolean modForensicsScan() { return modForensicsScan; }
    public boolean forensicsCorruptJarWalk() { return forensicsCorruptJarWalk; }
    public boolean forensicsIndexOnReport() { return forensicsIndexOnReport; }
    public String forensicsStderrPaths() { return forensicsStderrPaths; }
    public boolean crashRulePacks() { return crashRulePacks; }
    public boolean crashRuleBuiltin() { return crashRuleBuiltin; }
    public String issueSuppressions() { return issueSuppressions; }
    public String issueSuppressionRegex() { return issueSuppressionRegex; }
    public boolean issuesLiveEnabled() { return issuesLiveEnabled; }
    public boolean startupProfileOnBoot() { return startupProfileOnBoot; }
    public int startupProfileBootDelaySec() { return startupProfileBootDelaySec; }
    public boolean modsLightOnJarChange() { return modsLightOnJarChange; }
    public boolean modsDeepOnJarChange() { return modsDeepOnJarChange; }
    public boolean modsDeepSeedOnBoot() { return modsDeepSeedOnBoot; }
    public int modsDeepMaxJarsPerWake() { return modsDeepMaxJarsPerWake; }
    public int playerDirectoryPollSec() { return playerDirectoryPollSec; }
    public boolean crashEnrichOnMtime() { return crashEnrichOnMtime; }
    public boolean activityGapBackfillEnabled() { return activityGapBackfillEnabled; }
    public long activityGapThresholdBytes() { return activityGapThresholdBytes; }
    public long activityGapChunkBytes() { return activityGapChunkBytes; }

    public static final class Builder {
        private String serverDir = "";
        private int lookbackHours = 24;
        private int lookbackMinutes;
        private String reportMode = "live";
        private boolean incremental = true;
        private String windowStart = "";
        private String since = "";
        private int logGzipCount = 5;
        private List<Pattern> errorIgnorePatterns = List.of();
        private String javaPattern = "forge|neoforge|fabric|minecraft";
        private String craftyApp = "";
        private String backupDir = "";
        private List<String> backupDirs = List.of();
        private int backupWarnDays = 7;
        private int backupStaleHours = 24;
        private String stateFile = "";
        private int cpuSampleIntervalMs = 200;
        private String panelDetected = "unknown";
        private String loader = "unknown";
        private boolean javaRunning;
        private boolean panelRunning;
        private int diskWarnPct = 85;
        private double memWarnAvailGb = 2.0;
        private int logStaleMinutes = 15;
        private int cantKeepUpWarn = 5;
        private double msptWarn = 50.0;
        private double tpsWarn = 19.5;
        private double cpuThrottlePct = 95.0;
        private int tickLagThrottleMs = 5000;
        private String rconHost = "127.0.0.1";
        private int rconPort = 25575;
        private String rconPassword = "";
        private String rconTpsCommand = "neoforge tps";
        private boolean rconEntityPoll;
        private String craftyUrl = "";
        private String craftyApiToken = "";
        private String craftyServerUuid = "";
        private String hostname = "unknown";
        private boolean modSideScan;
        private int modSideScanMaxJars = 50;
        private boolean modrinthLookup;
        private boolean modrinthLookupOnReport = true;
        private boolean modrinthAutoScanOnModChanges;
        private int modrinthRateLimit = 5;
        private int chunkyStallMinutes = 10;
        private double chunkyDegradedCps = 5.0;
        private int chunkGenFailThreshold = 3;
        private int chunkGenFailWindowMin = 30;
        private boolean metricsContextBanner = true;
        private boolean updateCheck = true;
        private boolean l1RollupEnabled = true;
        private int l1RetentionDays = 90;
        private boolean dimensionStorageScan = true;
        private double rssHeapRatioWarn = 1.25;
        private int opsPollSec = 60;
        private int opsLogScanSec = 60;
        private int backupPollMin;
        private String backupExternalMarker = ExternalBackupDetector.DEFAULT_MARKER_REL;
        private String backupWebhookToken = "";
        private boolean backupSuppressLocalMissing = true;
        private boolean backupTrackingEnabled = true;
        private boolean backupVerifyAuto = true;
        private boolean backupVerifyDeferWhenPlayers = true;
        private int backupVerifyMaxMspt = 40;
        private boolean backupTestRestoreEnabled = true;
        private int lagIncidentCooldownSec = 180;
        private boolean lagIncidentEnabled = true;
        private int incidentMaxFiles = 50;
        private boolean sparkEnabled = true;
        private int sparkFreshHours = 24;
        private String sparkUploadDir = "";
        private boolean sparkAutoCaptureOnLag;
        private int sparkAutoCaptureWindowSec = 45;
        private int sparkAutoCaptureCooldownSec = 900;
        private boolean sparkAutoCaptureCopyToUpload = true;
        private boolean baselineAutoCapture = true;
        private double baselineRegressionThresholdPct = 10.0;
        private int diskFillWarnDays = 14;
        private int diskFillLookbackHours = 24;
        private int diskFillMinSpanHours = 6;
        private double diskFillOutlierGb = 5.0;
        private double diskIoLatencyWarnMs = 50.0;
        private boolean diskIoProbeEnabled = true;
        private boolean incidentStoryEnabled = true;
        private int incidentStoryWindowMin = 30;
        private int incidentStoryLookbackHours = 48;
        private int incidentStoryMax = 10;
        private boolean weeklyDigestEnabled = true;
        private int weeklyDigestIntervalDays = 7;
        private int weeklyDigestHistoryMax = 8;
        private boolean modJarDriftEnabled = true;
        private boolean clientOnServerIssuesEnabled = true;
        private boolean externalKillDetectEnabled = true;
        private boolean softHangEnabled = true;
        private int softHangSeconds = 90;
        private boolean softHangThreadDump;
        private int softHangCooldownMin = 15;
        private boolean restartHygieneEnabled = true;
        private boolean silentFailDetectEnabled = true;
        private boolean worldPressureEnabled = true;
        private boolean chunkWritePressureEnabled = true;
        private int chunkWriteGrowthChunks = 48;
        private int chunkWriteSustainedScans = 3;
        private boolean joinClinicEnabled = true;
        private boolean modDisableEnabled = true;
        private boolean modConfigEditEnabled = true;
        private boolean worldRiskEnabled = true;
        private boolean configAuditEnabled = true;
        private int reportRetentionCount = ReportRetentionPolicy.DEFAULT_RETENTION_COUNT;
        private int reportRetentionDays = ReportRetentionPolicy.DEFAULT_RETENTION_DAYS;
        private boolean modForensicsScan = true;
        private boolean forensicsCorruptJarWalk;
        private boolean forensicsIndexOnReport;
        private String forensicsStderrPaths = "logs/stderr.log,logs/stderr_stream.log";
        private boolean crashRulePacks = true;
        private boolean crashRuleBuiltin = true;
        private String issueSuppressions = "";
        private String issueSuppressionRegex = "";
        private boolean issuesLiveEnabled = true;
        private boolean startupProfileOnBoot = true;
        private int startupProfileBootDelaySec = 60;
        private boolean modsLightOnJarChange = true;
        private boolean modsDeepOnJarChange = true;
        private boolean modsDeepSeedOnBoot = true;
        private int modsDeepMaxJarsPerWake = 32;
        private int playerDirectoryPollSec = 900;
        private boolean crashEnrichOnMtime = true;
        private boolean activityGapBackfillEnabled = true;
        private long activityGapThresholdBytes = ActivityGapBackfill.DEFAULT_GAP_THRESHOLD_BYTES;
        private long activityGapChunkBytes = ActivityGapBackfill.DEFAULT_CHUNK_BYTES;

        public Builder serverDir(String v) { this.serverDir = v; return this; }
        public Builder lookbackHours(int v) { this.lookbackHours = v; return this; }
        public Builder lookbackMinutes(int v) { this.lookbackMinutes = v; return this; }
        public Builder reportMode(String v) { this.reportMode = v; return this; }
        public Builder incremental(boolean v) { this.incremental = v; return this; }
        public Builder windowStart(String v) { this.windowStart = v; return this; }
        public Builder since(String v) { this.since = v; return this; }
        public Builder logGzipCount(int v) { this.logGzipCount = v; return this; }
        public Builder errorIgnorePatterns(List<Pattern> v) { this.errorIgnorePatterns = v; return this; }
        public Builder errorIgnorePatterns(String... patterns) {
            this.errorIgnorePatterns = compileIgnorePatterns(String.join("|", Arrays.asList(patterns)));
            return this;
        }
        public Builder javaPattern(String v) { this.javaPattern = v; return this; }
        public Builder craftyApp(String v) { this.craftyApp = v; return this; }
        public Builder backupDir(String v) { this.backupDir = v; return this; }
        public Builder backupDirs(List<String> v) { this.backupDirs = v != null ? v : List.of(); return this; }
        public Builder backupDirs(String... paths) { this.backupDirs = List.of(paths); return this; }
        public Builder backupWarnDays(int v) { this.backupWarnDays = v; return this; }
        public Builder backupStaleHours(int v) { this.backupStaleHours = v; return this; }
        public Builder backupPollMin(int v) { this.backupPollMin = v; return this; }
        public Builder backupExternalMarker(String v) { this.backupExternalMarker = v != null ? v : ""; return this; }
        public Builder backupWebhookToken(String v) { this.backupWebhookToken = v != null ? v : ""; return this; }
        public Builder backupSuppressLocalMissing(boolean v) { this.backupSuppressLocalMissing = v; return this; }
        public Builder backupTrackingEnabled(boolean v) { this.backupTrackingEnabled = v; return this; }
        public Builder backupVerifyAuto(boolean v) { this.backupVerifyAuto = v; return this; }
        public Builder backupVerifyDeferWhenPlayers(boolean v) { this.backupVerifyDeferWhenPlayers = v; return this; }
        public Builder backupVerifyMaxMspt(int v) { this.backupVerifyMaxMspt = v; return this; }
        public Builder backupTestRestoreEnabled(boolean v) { this.backupTestRestoreEnabled = v; return this; }
        public Builder stateFile(String v) { this.stateFile = v; return this; }
        public Builder cpuSampleIntervalMs(int v) { this.cpuSampleIntervalMs = v; return this; }
        public Builder panelDetected(String v) { this.panelDetected = v; return this; }
        public Builder loader(String v) { this.loader = v; return this; }
        public Builder javaRunning(boolean v) { this.javaRunning = v; return this; }
        public Builder panelRunning(boolean v) { this.panelRunning = v; return this; }
        public Builder diskWarnPct(int v) { this.diskWarnPct = v; return this; }
        public Builder memWarnAvailGb(double v) { this.memWarnAvailGb = v; return this; }
        public Builder logStaleMinutes(int v) { this.logStaleMinutes = v; return this; }
        public Builder cantKeepUpWarn(int v) { this.cantKeepUpWarn = v; return this; }
        public Builder msptWarn(double v) { this.msptWarn = v; return this; }
        public Builder tpsWarn(double v) { this.tpsWarn = v; return this; }
        public Builder cpuThrottlePct(double v) { this.cpuThrottlePct = v; return this; }
        public Builder tickLagThrottleMs(int v) { this.tickLagThrottleMs = v; return this; }
        public Builder rconHost(String v) { this.rconHost = v; return this; }
        public Builder rconPort(int v) { this.rconPort = v; return this; }
        public Builder rconPassword(String v) { this.rconPassword = v; return this; }
        public Builder rconTpsCommand(String v) { this.rconTpsCommand = v; return this; }
        public Builder rconEntityPoll(boolean v) { this.rconEntityPoll = v; return this; }
        public Builder craftyUrl(String v) { this.craftyUrl = v; return this; }
        public Builder craftyApiToken(String v) { this.craftyApiToken = v; return this; }
        public Builder craftyServerUuid(String v) { this.craftyServerUuid = v; return this; }
        public Builder hostname(String v) { this.hostname = v; return this; }
        public Builder modSideScan(boolean v) { this.modSideScan = v; return this; }
        public Builder modSideScanMaxJars(int v) { this.modSideScanMaxJars = v; return this; }
        public Builder modrinthLookup(boolean v) { this.modrinthLookup = v; return this; }
        public Builder modrinthLookupOnReport(boolean v) { this.modrinthLookupOnReport = v; return this; }
        public Builder modrinthAutoScanOnModChanges(boolean v) { this.modrinthAutoScanOnModChanges = v; return this; }
        public Builder modrinthRateLimit(int v) { this.modrinthRateLimit = v; return this; }
        public Builder sparkEnabled(boolean v) { this.sparkEnabled = v; return this; }
        public Builder sparkFreshHours(int v) { this.sparkFreshHours = v; return this; }
        public Builder sparkUploadDir(String v) { this.sparkUploadDir = v; return this; }
        public Builder sparkAutoCaptureOnLag(boolean v) { this.sparkAutoCaptureOnLag = v; return this; }
        public Builder sparkAutoCaptureWindowSec(int v) { this.sparkAutoCaptureWindowSec = v; return this; }
        public Builder sparkAutoCaptureCooldownSec(int v) { this.sparkAutoCaptureCooldownSec = v; return this; }
        public Builder sparkAutoCaptureCopyToUpload(boolean v) { this.sparkAutoCaptureCopyToUpload = v; return this; }
        public Builder baselineAutoCapture(boolean v) { this.baselineAutoCapture = v; return this; }
        public Builder baselineRegressionThresholdPct(double v) { this.baselineRegressionThresholdPct = v; return this; }
        public Builder diskFillWarnDays(int v) { this.diskFillWarnDays = v; return this; }
        public Builder diskFillLookbackHours(int v) { this.diskFillLookbackHours = v; return this; }
        public Builder diskFillMinSpanHours(int v) { this.diskFillMinSpanHours = v; return this; }
        public Builder diskFillOutlierGb(double v) { this.diskFillOutlierGb = v; return this; }
        public Builder diskIoLatencyWarnMs(double v) { this.diskIoLatencyWarnMs = v; return this; }
        public Builder diskIoProbeEnabled(boolean v) { this.diskIoProbeEnabled = v; return this; }
        public Builder incidentStoryEnabled(boolean v) { this.incidentStoryEnabled = v; return this; }
        public Builder incidentStoryWindowMin(int v) { this.incidentStoryWindowMin = v; return this; }
        public Builder incidentStoryLookbackHours(int v) { this.incidentStoryLookbackHours = v; return this; }
        public Builder incidentStoryMax(int v) { this.incidentStoryMax = v; return this; }
        public Builder weeklyDigestEnabled(boolean v) { this.weeklyDigestEnabled = v; return this; }
        public Builder weeklyDigestIntervalDays(int v) { this.weeklyDigestIntervalDays = v; return this; }
        public Builder weeklyDigestHistoryMax(int v) { this.weeklyDigestHistoryMax = v; return this; }
        public Builder modJarDriftEnabled(boolean v) { this.modJarDriftEnabled = v; return this; }
        public Builder clientOnServerIssuesEnabled(boolean v) { this.clientOnServerIssuesEnabled = v; return this; }
        public Builder externalKillDetectEnabled(boolean v) { this.externalKillDetectEnabled = v; return this; }
        public Builder softHangEnabled(boolean v) { this.softHangEnabled = v; return this; }
        public Builder softHangSeconds(int v) { this.softHangSeconds = v; return this; }
        public Builder softHangThreadDump(boolean v) { this.softHangThreadDump = v; return this; }
        public Builder softHangCooldownMin(int v) { this.softHangCooldownMin = v; return this; }
        public Builder restartHygieneEnabled(boolean v) { this.restartHygieneEnabled = v; return this; }
        public Builder silentFailDetectEnabled(boolean v) { this.silentFailDetectEnabled = v; return this; }
        public Builder worldPressureEnabled(boolean v) { this.worldPressureEnabled = v; return this; }
        public Builder chunkWritePressureEnabled(boolean v) { this.chunkWritePressureEnabled = v; return this; }
        public Builder chunkWriteGrowthChunks(int v) { this.chunkWriteGrowthChunks = v; return this; }
        public Builder chunkWriteSustainedScans(int v) { this.chunkWriteSustainedScans = v; return this; }
        public Builder joinClinicEnabled(boolean v) { this.joinClinicEnabled = v; return this; }
        public Builder modDisableEnabled(boolean v) { this.modDisableEnabled = v; return this; }
        public Builder modConfigEditEnabled(boolean v) { this.modConfigEditEnabled = v; return this; }
        public Builder worldRiskEnabled(boolean v) { this.worldRiskEnabled = v; return this; }
        public Builder configAuditEnabled(boolean v) { this.configAuditEnabled = v; return this; }
        public Builder reportRetentionCount(int v) { this.reportRetentionCount = v; return this; }
        public Builder reportRetentionDays(int v) { this.reportRetentionDays = v; return this; }
        public Builder modForensicsScan(boolean v) { this.modForensicsScan = v; return this; }
        public Builder forensicsCorruptJarWalk(boolean v) { this.forensicsCorruptJarWalk = v; return this; }
        public Builder forensicsIndexOnReport(boolean v) { this.forensicsIndexOnReport = v; return this; }
        public Builder forensicsStderrPaths(String v) {
            this.forensicsStderrPaths = v != null ? v : "logs/stderr.log,logs/stderr_stream.log";
            return this;
        }
        public Builder crashRulePacks(boolean v) { this.crashRulePacks = v; return this; }
        public Builder crashRuleBuiltin(boolean v) { this.crashRuleBuiltin = v; return this; }
        public Builder issueSuppressions(String v) { this.issueSuppressions = v != null ? v : ""; return this; }
        public Builder issueSuppressionRegex(String v) {
            this.issueSuppressionRegex = v != null ? v : "";
            return this;
        }

        public Builder issuesLiveEnabled(boolean v) {
            this.issuesLiveEnabled = v;
            return this;
        }

        public Builder startupProfileOnBoot(boolean v) {
            this.startupProfileOnBoot = v;
            return this;
        }

        public Builder startupProfileBootDelaySec(int v) {
            this.startupProfileBootDelaySec = Math.max(5, v);
            return this;
        }

        public Builder modsLightOnJarChange(boolean v) {
            this.modsLightOnJarChange = v;
            return this;
        }

        public Builder modsDeepOnJarChange(boolean v) {
            this.modsDeepOnJarChange = v;
            return this;
        }

        public Builder modsDeepSeedOnBoot(boolean v) {
            this.modsDeepSeedOnBoot = v;
            return this;
        }

        public Builder modsDeepMaxJarsPerWake(int v) {
            this.modsDeepMaxJarsPerWake = Math.max(1, v);
            return this;
        }

        public Builder playerDirectoryPollSec(int v) {
            this.playerDirectoryPollSec = Math.max(60, v);
            return this;
        }

        public Builder crashEnrichOnMtime(boolean v) {
            this.crashEnrichOnMtime = v;
            return this;
        }

        public Builder activityGapBackfillEnabled(boolean v) {
            this.activityGapBackfillEnabled = v;
            return this;
        }

        public Builder activityGapThresholdBytes(long v) {
            this.activityGapThresholdBytes = Math.max(1024, v);
            return this;
        }

        public Builder activityGapChunkBytes(long v) {
            this.activityGapChunkBytes = Math.max(1024, v);
            return this;
        }

        public Builder from(ReportConfig c) {
            this.serverDir = c.serverDir();
            this.lookbackHours = c.lookbackHours();
            this.lookbackMinutes = c.lookbackMinutes();
            this.reportMode = c.reportMode();
            this.incremental = c.incremental();
            this.windowStart = c.windowStart();
            this.since = c.since();
            this.logGzipCount = c.logGzipCount();
            this.errorIgnorePatterns = c.errorIgnorePatterns();
            this.javaPattern = c.javaPattern();
            this.craftyApp = c.craftyApp();
            this.backupDir = c.backupDir();
            this.backupDirs = c.backupDirs();
            this.backupWarnDays = c.backupWarnDays();
            this.backupStaleHours = c.backupStaleHours();
            this.backupPollMin = c.backupPollMin();
            this.backupExternalMarker = c.backupExternalMarker();
            this.backupWebhookToken = c.backupWebhookToken();
            this.backupSuppressLocalMissing = c.backupSuppressLocalMissing();
            this.backupTrackingEnabled = c.backupTrackingEnabled();
            this.backupVerifyAuto = c.backupVerifyAuto();
            this.backupVerifyDeferWhenPlayers = c.backupVerifyDeferWhenPlayers();
            this.backupVerifyMaxMspt = c.backupVerifyMaxMspt();
            this.backupTestRestoreEnabled = c.backupTestRestoreEnabled();
            this.stateFile = c.stateFile();
            this.cpuSampleIntervalMs = c.cpuSampleIntervalMs();
            this.panelDetected = c.panelDetected();
            this.loader = c.loader();
            this.javaRunning = c.javaRunning();
            this.panelRunning = c.panelRunning();
            this.diskWarnPct = c.diskWarnPct();
            this.memWarnAvailGb = c.memWarnAvailGb();
            this.logStaleMinutes = c.logStaleMinutes();
            this.cantKeepUpWarn = c.cantKeepUpWarn();
            this.msptWarn = c.msptWarn();
            this.tpsWarn = c.tpsWarn();
            this.cpuThrottlePct = c.cpuThrottlePct();
            this.tickLagThrottleMs = c.tickLagThrottleMs();
            this.rconHost = c.rconHost();
            this.rconPort = c.rconPort();
            this.rconPassword = c.rconPassword();
            this.rconTpsCommand = c.rconTpsCommand();
            this.rconEntityPoll = c.rconEntityPoll();
            this.craftyUrl = c.craftyUrl();
            this.craftyApiToken = c.craftyApiToken();
            this.craftyServerUuid = c.craftyServerUuid();
            this.hostname = c.hostname();
            this.modSideScan = c.modSideScan();
            this.modSideScanMaxJars = c.modSideScanMaxJars();
            this.modrinthLookup = c.modrinthLookup();
            this.modrinthLookupOnReport = c.modrinthLookupOnReport();
            this.modrinthAutoScanOnModChanges = c.modrinthAutoScanOnModChanges();
            this.modrinthRateLimit = c.modrinthRateLimit();
            this.chunkyStallMinutes = c.chunkyStallMinutes();
            this.chunkyDegradedCps = c.chunkyDegradedCps();
            this.chunkGenFailThreshold = c.chunkGenFailThreshold();
            this.chunkGenFailWindowMin = c.chunkGenFailWindowMin();
            this.metricsContextBanner = c.metricsContextBanner();
            this.updateCheck = c.updateCheck();
            this.l1RollupEnabled = c.l1RollupEnabled();
            this.l1RetentionDays = c.l1RetentionDays();
            this.dimensionStorageScan = c.dimensionStorageScan();
            this.rssHeapRatioWarn = c.rssHeapRatioWarn();
            this.opsPollSec = c.opsPollSec();
            this.opsLogScanSec = c.opsLogScanSec();
            this.lagIncidentCooldownSec = c.lagIncidentCooldownSec();
            this.lagIncidentEnabled = c.lagIncidentEnabled();
            this.incidentMaxFiles = c.incidentMaxFiles();
            this.sparkEnabled = c.sparkEnabled();
            this.sparkFreshHours = c.sparkFreshHours();
            this.sparkUploadDir = c.sparkUploadDir();
            this.sparkAutoCaptureOnLag = c.sparkAutoCaptureOnLag();
            this.sparkAutoCaptureWindowSec = c.sparkAutoCaptureWindowSec();
            this.sparkAutoCaptureCooldownSec = c.sparkAutoCaptureCooldownSec();
            this.sparkAutoCaptureCopyToUpload = c.sparkAutoCaptureCopyToUpload();
            this.baselineAutoCapture = c.baselineAutoCapture();
            this.baselineRegressionThresholdPct = c.baselineRegressionThresholdPct();
            this.diskFillWarnDays = c.diskFillWarnDays();
            this.diskFillLookbackHours = c.diskFillLookbackHours();
            this.diskFillMinSpanHours = c.diskFillMinSpanHours();
            this.diskFillOutlierGb = c.diskFillOutlierGb();
            this.diskIoLatencyWarnMs = c.diskIoLatencyWarnMs();
            this.diskIoProbeEnabled = c.diskIoProbeEnabled();
            this.incidentStoryEnabled = c.incidentStoryEnabled();
            this.incidentStoryWindowMin = c.incidentStoryWindowMin();
            this.incidentStoryLookbackHours = c.incidentStoryLookbackHours();
            this.incidentStoryMax = c.incidentStoryMax();
            this.weeklyDigestEnabled = c.weeklyDigestEnabled();
            this.weeklyDigestIntervalDays = c.weeklyDigestIntervalDays();
            this.weeklyDigestHistoryMax = c.weeklyDigestHistoryMax();
            this.modJarDriftEnabled = c.modJarDriftEnabled();
            this.clientOnServerIssuesEnabled = c.clientOnServerIssuesEnabled();
            this.externalKillDetectEnabled = c.externalKillDetectEnabled();
            this.softHangEnabled = c.softHangEnabled();
            this.softHangSeconds = c.softHangSeconds();
            this.softHangThreadDump = c.softHangThreadDump();
            this.softHangCooldownMin = c.softHangCooldownMin();
            this.restartHygieneEnabled = c.restartHygieneEnabled();
            this.silentFailDetectEnabled = c.silentFailDetectEnabled();
            this.worldPressureEnabled = c.worldPressureEnabled();
            this.chunkWritePressureEnabled = c.chunkWritePressureEnabled();
            this.chunkWriteGrowthChunks = c.chunkWriteGrowthChunks();
            this.chunkWriteSustainedScans = c.chunkWriteSustainedScans();
            this.joinClinicEnabled = c.joinClinicEnabled();
            this.modDisableEnabled = c.modDisableEnabled();
            this.modConfigEditEnabled = c.modConfigEditEnabled();
            this.worldRiskEnabled = c.worldRiskEnabled();
            this.configAuditEnabled = c.configAuditEnabled();
            this.reportRetentionCount = c.reportRetentionCount();
            this.reportRetentionDays = c.reportRetentionDays();
            this.modForensicsScan = c.modForensicsScan();
            this.forensicsCorruptJarWalk = c.forensicsCorruptJarWalk();
            this.forensicsIndexOnReport = c.forensicsIndexOnReport();
            this.forensicsStderrPaths = c.forensicsStderrPaths();
            this.crashRulePacks = c.crashRulePacks();
            this.crashRuleBuiltin = c.crashRuleBuiltin();
            this.issueSuppressions = c.issueSuppressions();
            this.issueSuppressionRegex = c.issueSuppressionRegex();
            this.issuesLiveEnabled = c.issuesLiveEnabled();
            this.startupProfileOnBoot = c.startupProfileOnBoot();
            this.startupProfileBootDelaySec = c.startupProfileBootDelaySec();
            this.modsLightOnJarChange = c.modsLightOnJarChange();
            this.modsDeepOnJarChange = c.modsDeepOnJarChange();
            this.modsDeepSeedOnBoot = c.modsDeepSeedOnBoot();
            this.modsDeepMaxJarsPerWake = c.modsDeepMaxJarsPerWake();
            this.playerDirectoryPollSec = c.playerDirectoryPollSec();
            this.crashEnrichOnMtime = c.crashEnrichOnMtime();
            this.activityGapBackfillEnabled = c.activityGapBackfillEnabled();
            this.activityGapThresholdBytes = c.activityGapThresholdBytes();
            this.activityGapChunkBytes = c.activityGapChunkBytes();
            return this;
        }

        public ReportConfig build() {
            return new ReportConfig(this);
        }
    }
}
