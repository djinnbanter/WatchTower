package dev.mcstatus.watchtower.core.report;

import dev.mcstatus.watchtower.core.collect.ExternalBackupDetector;

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
    private final boolean rconSparkTps;
    private final boolean rconEntityPoll;
    private final String craftyUrl;
    private final String craftyApiToken;
    private final String craftyServerUuid;
    private final String hostname;
    private final boolean modSideScan;
    private final int modSideScanMaxJars;
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
    private final int lagIncidentCooldownSec;
    private final boolean lagIncidentEnabled;
    private final int incidentMaxFiles;
    private final boolean sparkEnabled;
    private final int sparkFreshHours;
    private final String sparkUploadDir;
    private final int reportRetentionCount;
    private final int reportRetentionDays;

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
        this.rconSparkTps = b.rconSparkTps;
        this.rconEntityPoll = b.rconEntityPoll;
        this.craftyUrl = b.craftyUrl;
        this.craftyApiToken = b.craftyApiToken;
        this.craftyServerUuid = b.craftyServerUuid;
        this.hostname = b.hostname;
        this.modSideScan = b.modSideScan;
        this.modSideScanMaxJars = b.modSideScanMaxJars;
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
        this.lagIncidentCooldownSec = b.lagIncidentCooldownSec;
        this.lagIncidentEnabled = b.lagIncidentEnabled;
        this.incidentMaxFiles = b.incidentMaxFiles;
        this.sparkEnabled = b.sparkEnabled;
        this.sparkFreshHours = b.sparkFreshHours;
        this.sparkUploadDir = b.sparkUploadDir;
        this.reportRetentionCount = b.reportRetentionCount;
        this.reportRetentionDays = b.reportRetentionDays;
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
        b.rconSparkTps = isTruthy(env.get("RCON_SPARK_TPS"), false);
        b.rconEntityPoll = isTruthy(env.get("RCON_ENTITY_POLL"), false);
        b.craftyUrl = env.getOrDefault("CRAFTY_URL", "");
        b.craftyApiToken = env.getOrDefault("CRAFTY_API_TOKEN", "");
        b.craftyServerUuid = env.getOrDefault("CRAFTY_SERVER_UUID", "");
        b.hostname = resolveHostname();
        b.modSideScan = isTruthy(env.get("MOD_SIDE_SCAN"), false);
        b.modSideScanMaxJars = parseInt(env.get("MOD_SIDE_SCAN_MAX_JARS"), 50);
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
        b.lagIncidentCooldownSec = parseInt(env.get("LAG_INCIDENT_COOLDOWN_SEC"), 180);
        b.lagIncidentEnabled = isTruthy(env.get("LAG_INCIDENT_ENABLED"), true);
        b.incidentMaxFiles = parseInt(env.get("INCIDENT_MAX_FILES"), 50);
        b.sparkEnabled = isTruthy(env.get("SPARK_ENABLED"), true);
        b.sparkFreshHours = parseInt(env.get("SPARK_FRESH_HOURS"), 24);
        b.sparkUploadDir = env.getOrDefault("SPARK_UPLOAD_DIR", "");
        b.reportRetentionCount = parseInt(env.get("REPORT_RETENTION_COUNT"), ReportRetentionPolicy.DEFAULT_RETENTION_COUNT);
        b.reportRetentionDays = parseInt(env.get("REPORT_RETENTION_DAYS"), ReportRetentionPolicy.DEFAULT_RETENTION_DAYS);
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
    public boolean rconSparkTps() { return rconSparkTps; }
    public boolean rconEntityPoll() { return rconEntityPoll; }
    public String craftyUrl() { return craftyUrl; }
    public String craftyApiToken() { return craftyApiToken; }
    public String craftyServerUuid() { return craftyServerUuid; }
    public String hostname() { return hostname; }
    public boolean modSideScan() { return modSideScan; }
    public int modSideScanMaxJars() { return modSideScanMaxJars; }
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
    public int reportRetentionCount() { return reportRetentionCount; }
    public int reportRetentionDays() { return reportRetentionDays; }

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
        private boolean rconSparkTps;
        private boolean rconEntityPoll;
        private String craftyUrl = "";
        private String craftyApiToken = "";
        private String craftyServerUuid = "";
        private String hostname = "unknown";
        private boolean modSideScan;
        private int modSideScanMaxJars = 50;
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
        private int lagIncidentCooldownSec = 180;
        private boolean lagIncidentEnabled = true;
        private int incidentMaxFiles = 50;
        private boolean sparkEnabled = true;
        private int sparkFreshHours = 24;
        private String sparkUploadDir = "";
        private int reportRetentionCount = ReportRetentionPolicy.DEFAULT_RETENTION_COUNT;
        private int reportRetentionDays = ReportRetentionPolicy.DEFAULT_RETENTION_DAYS;

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
        public Builder backupPollMin(int v) { this.backupPollMin = v; return this; }
        public Builder backupExternalMarker(String v) { this.backupExternalMarker = v != null ? v : ""; return this; }
        public Builder backupWebhookToken(String v) { this.backupWebhookToken = v != null ? v : ""; return this; }
        public Builder backupSuppressLocalMissing(boolean v) { this.backupSuppressLocalMissing = v; return this; }
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
        public Builder rconSparkTps(boolean v) { this.rconSparkTps = v; return this; }
        public Builder rconEntityPoll(boolean v) { this.rconEntityPoll = v; return this; }
        public Builder craftyUrl(String v) { this.craftyUrl = v; return this; }
        public Builder craftyApiToken(String v) { this.craftyApiToken = v; return this; }
        public Builder craftyServerUuid(String v) { this.craftyServerUuid = v; return this; }
        public Builder hostname(String v) { this.hostname = v; return this; }
        public Builder modSideScan(boolean v) { this.modSideScan = v; return this; }
        public Builder modSideScanMaxJars(int v) { this.modSideScanMaxJars = v; return this; }
        public Builder sparkEnabled(boolean v) { this.sparkEnabled = v; return this; }
        public Builder sparkFreshHours(int v) { this.sparkFreshHours = v; return this; }
        public Builder sparkUploadDir(String v) { this.sparkUploadDir = v; return this; }
        public Builder reportRetentionCount(int v) { this.reportRetentionCount = v; return this; }
        public Builder reportRetentionDays(int v) { this.reportRetentionDays = v; return this; }

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
            this.backupPollMin = c.backupPollMin();
            this.backupExternalMarker = c.backupExternalMarker();
            this.backupWebhookToken = c.backupWebhookToken();
            this.backupSuppressLocalMissing = c.backupSuppressLocalMissing();
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
            this.rconSparkTps = c.rconSparkTps();
            this.rconEntityPoll = c.rconEntityPoll();
            this.craftyUrl = c.craftyUrl();
            this.craftyApiToken = c.craftyApiToken();
            this.craftyServerUuid = c.craftyServerUuid();
            this.hostname = c.hostname();
            this.modSideScan = c.modSideScan();
            this.modSideScanMaxJars = c.modSideScanMaxJars();
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
            this.reportRetentionCount = c.reportRetentionCount();
            this.reportRetentionDays = c.reportRetentionDays();
            return this;
        }

        public ReportConfig build() {
            return new ReportConfig(this);
        }
    }
}
