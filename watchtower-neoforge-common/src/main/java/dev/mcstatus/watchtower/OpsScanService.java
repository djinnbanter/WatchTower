package dev.mcstatus.watchtower;

import dev.mcstatus.watchtower.runtime.ModRuntime;

import dev.mcstatus.watchtower.runtime.ServerContext;
import dev.mcstatus.watchtower.runtime.WatchtowerSample;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.collect.CraftyCollector;
import dev.mcstatus.watchtower.core.collect.CrashMtimeScanner;
import dev.mcstatus.watchtower.core.collect.CgroupProbe;
import dev.mcstatus.watchtower.core.collect.CpuUsageSampler;
import dev.mcstatus.watchtower.core.collect.ExternalBackupDetector;
import dev.mcstatus.watchtower.core.collect.HostMetricsCollector;
import dev.mcstatus.watchtower.core.collect.ModsInventoryDiff;
import dev.mcstatus.watchtower.core.collect.ModNesting;
import dev.mcstatus.watchtower.core.collect.RunningModsCollector;
import dev.mcstatus.watchtower.core.analyze.ChunkWritePressureAnalyzer;
import dev.mcstatus.watchtower.core.analyze.DiskJumpEvaluator;
import dev.mcstatus.watchtower.core.analyze.DiskProjectionAnalyzer;
import dev.mcstatus.watchtower.core.analyze.ScorecardBuilder;
import dev.mcstatus.watchtower.core.analyze.WeeklyDigestBuilder;
import dev.mcstatus.watchtower.core.analyze.WorldPressureAnalyzer;
import dev.mcstatus.watchtower.core.analyze.WorldRiskAnalyzer;
import dev.mcstatus.watchtower.core.collect.ReportArtifactFinder;
import dev.mcstatus.watchtower.core.collect.StagingBuilder;
import dev.mcstatus.watchtower.core.incident.IncidentWriter;
import dev.mcstatus.watchtower.core.live.PerformanceRollupWriter;
import dev.mcstatus.watchtower.core.ops.ActivityLedgerScanner;
import dev.mcstatus.watchtower.core.ops.IncidentStoryBuilder;
import dev.mcstatus.watchtower.core.ops.PackChangeActivityScanner;
import dev.mcstatus.watchtower.core.ops.LagIssueBuilder;
import dev.mcstatus.watchtower.core.ops.LogStaleEvaluator;
import dev.mcstatus.watchtower.core.ops.OpsCacheSchema;
import dev.mcstatus.watchtower.core.ops.OpsCacheWriter;
import dev.mcstatus.watchtower.core.ops.OpsCacheReader;
import dev.mcstatus.watchtower.core.ops.OpsLogTailScanner;
import dev.mcstatus.watchtower.core.ops.IssuesLiveEvaluators;
import dev.mcstatus.watchtower.core.report.ReportConfig;
import dev.mcstatus.watchtower.core.report.StateManager;
import dev.mcstatus.watchtower.core.util.TimeParse;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Runs lightweight ops cache scans (crashes, unified log tail, running mods).
 */
public final class OpsScanService {

    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_OFFSET_DATE_TIME;

    private OpsScanService() {
    }

    public static OpsLogTailScanner.ScanResult scanOpsLog(ServerContext server) throws IOException {
        ReportConfig config = ModReportConfig.forServer(server);
        Path statePath = WatchtowerPaths.statePath(server);
        String serverDir = server.serverDirectory().toAbsolutePath().toString();
        OpsLogTailScanner.ScanResult scan = OpsLogTailScanner.scanIncremental(
                serverDir, statePath, config.tickLagThrottleMs(),
                config.activityGapBackfillEnabled() ? config.activityGapThresholdBytes() : 0);
        Path opsCachePath = WatchtowerPaths.opsCachePath(server);
        Path rollupsPath = WatchtowerPaths.performanceRollupsPath(server);
        Path logPath = Path.of(serverDir, "logs", "latest.log");
        JsonObject logStale = LogStaleEvaluator.evaluate(logPath, true, config.logStaleMinutes());
        JsonObject pregenHint = buildPregenHint(server);
        OpsCacheWriter.applyOpsLogScanResult(opsCachePath, statePath, rollupsPath, scan, pregenHint, null, logStale);
        ActivityGapBackfillScheduler.maybeEnqueue(server, config);
        scanPackChanges(server);
        scanDiskJump(server);
        scanDiskProjection(server);
        scanWorldPressure(server);
        scanBackupExternal(server);
        rebuildIncidentStories(server);
        refreshIssuesLive(server);
        return scan;
    }

    /** Snapshot-poll mods/ + config/ into activity ledger (1.1.24 server diary). */
    public static void scanPackChanges(ServerContext server) throws IOException {
        Path statePath = WatchtowerPaths.statePath(server);
        Path opsCachePath = WatchtowerPaths.opsCachePath(server);
        Path serverDir = server.serverDirectory().toAbsolutePath();
        JsonObject prev = StateManager.getPackChangeSnapshot(statePath);
        long now = Instant.now().getEpochSecond();
        PackChangeActivityScanner.Result r = PackChangeActivityScanner.scan(serverDir, prev, now);
        StateManager.setPackChangeSnapshot(statePath, r.nextSnapshot());
        if (!r.events().isEmpty()) {
            OpsCacheWriter.applyActivityBackfillChunk(opsCachePath, statePath, r.events(), r.events().size());
        }
    }

    /** Cheap continuous issue ledger refresh from ops-cache peeks (no StagingBuilder). */
    public static void refreshIssuesLive(ServerContext server) throws IOException {
        ReportConfig config = ModReportConfig.forServer(server);
        if (!config.issuesLiveEnabled()) {
            return;
        }
        OpsCacheWriter.refreshIssuesLive(
                WatchtowerPaths.opsCachePath(server),
                WatchtowerPaths.statePath(server),
                config.backupTrackingEnabled(),
                config.diskFillWarnDays(),
                config.clientOnServerIssuesEnabled(),
                config.externalKillDetectEnabled(),
                config.silentFailDetectEnabled(),
                config.worldPressureEnabled(),
                config.joinClinicEnabled(),
                config.worldRiskEnabled(),
                config.backupStaleHours());
    }

    public static void scanBackupExternal(ServerContext server) throws IOException {
        ReportConfig config = ModReportConfig.forServer(server);
        if (!ExternalBackupDetector.isConfigured(config)) {
            return;
        }
        String serverDir = server.serverDirectory().toAbsolutePath().toString();
        JsonObject block = ExternalBackupDetector.read(serverDir, config, "file");
        OpsCacheWriter.applyBackupExternal(
                WatchtowerPaths.opsCachePath(server),
                WatchtowerPaths.statePath(server),
                block);
    }

    public static void scanDiskJump(ServerContext server) throws IOException {
        String serverDir = server.serverDirectory().toAbsolutePath().toString();
        Path statePath = WatchtowerPaths.statePath(server);
        JsonObject system = HostMetricsCollector.collectSystemBasics(serverDir);
        JsonObject state = StateManager.loadStateObject(statePath);
        JsonObject baseline = state.has("disk_baseline") ? state.getAsJsonObject("disk_baseline") : null;
        double jumpPct = 5.0;
        double jumpGb = 10.0;
        try {
            var map = WatchtowerConfWriter.readMap(WatchtowerPaths.confPath(server));
            if (map.containsKey("DISK_JUMP_PCT")) {
                jumpPct = Double.parseDouble(map.get("DISK_JUMP_PCT").trim());
            }
            if (map.containsKey("DISK_JUMP_GB")) {
                jumpGb = Double.parseDouble(map.get("DISK_JUMP_GB").trim());
            }
        } catch (Exception ignored) {
        }
        JsonObject jump = DiskJumpEvaluator.evaluate(system, baseline, jumpPct, jumpGb);
        jump.addProperty("scanned_at", ZonedDateTime.now(ZoneId.systemDefault()).format(ISO));
        OpsCacheWriter.applyDiskJump(WatchtowerPaths.opsCachePath(server), statePath, jump);
    }

    public static void scanDiskProjection(ServerContext server) throws IOException {
        String serverDir = server.serverDirectory().toAbsolutePath().toString();
        Path statePath = WatchtowerPaths.statePath(server);
        Path rollupsPath = WatchtowerPaths.performanceRollupsPath(server);
        JsonObject system = HostMetricsCollector.collectSystemBasics(serverDir);
        ReportConfig config = ModReportConfig.forServer(server);
        int lookback = Math.max(config.diskFillLookbackHours(), config.diskFillMinSpanHours());
        List<JsonObject> rows = PerformanceRollupWriter.loadRowsFromFile(rollupsPath, lookback + 1);
        Double freeGb = system.has("disk_free_gb") && !system.get("disk_free_gb").isJsonNull()
                ? system.get("disk_free_gb").getAsDouble() : null;
        Double usePct = system.has("disk_use_pct") && !system.get("disk_use_pct").isJsonNull()
                ? system.get("disk_use_pct").getAsDouble() : null;
        JsonObject projection = DiskProjectionAnalyzer.analyze(
                rows, freeGb, usePct,
                config.diskFillLookbackHours(),
                config.diskFillMinSpanHours(),
                config.diskFillOutlierGb(),
                null);
        projection.addProperty("scanned_at", ZonedDateTime.now(ZoneId.systemDefault()).format(ISO));
        OpsCacheWriter.applyDiskProjection(WatchtowerPaths.opsCachePath(server), statePath, projection);
    }

    public static void scanWorldPressure(ServerContext server) throws IOException {
        ReportConfig config = ModReportConfig.forServer(server);
        if (!config.worldPressureEnabled()) {
            return;
        }
        JsonObject census = LiveMetricsService.get().latestWorldCensus();
        if (census == null) {
            return;
        }
        Path rollupsPath = WatchtowerPaths.performanceRollupsPath(server);
        // 7d lookback for quiet-hour learning / MSPT correlation (UI compare bars come from dashboard window)
        List<JsonObject> rows = PerformanceRollupWriter.loadRowsFromFile(rollupsPath, 168);
        JsonObject prev = OpsCacheReader.load(WatchtowerPaths.opsCachePath(server));
        JsonObject block = WorldPressureAnalyzer.analyze(
                census, rows, prev, config.msptWarn());
        if (config.chunkWritePressureEnabled()) {
            JsonObject signals = new JsonObject();
            LiveMetricsService live = LiveMetricsService.get();
            JsonObject dh = live.latestDhPregen();
            JsonObject chunky = live.latestChunkyPregen();
            if (dh != null) {
                signals.add("dh_pregen", dh);
            }
            if (chunky != null) {
                signals.add("chunky_pregen", chunky);
            }
            JsonObject disk = live.latestDiskIo();
            if (disk != null) {
                if (disk.has("write_await_ms") && !disk.get("write_await_ms").isJsonNull()) {
                    signals.add("write_await_ms", disk.get("write_await_ms"));
                }
                if (disk.has("write_mb_s") && !disk.get("write_mb_s").isJsonNull()) {
                    signals.add("write_mb_s", disk.get("write_mb_s"));
                }
            }
            signals.add("census", census.deepCopy());
            ChunkWritePressureAnalyzer.enrich(
                    block,
                    signals,
                    prev,
                    config.diskIoLatencyWarnMs(),
                    config.chunkWriteGrowthChunks(),
                    config.chunkWriteSustainedScans());
        }
        block.addProperty("scanned_at", ZonedDateTime.now(ZoneId.systemDefault()).format(ISO));
        OpsCacheWriter.applyWorldPressure(
                WatchtowerPaths.opsCachePath(server),
                WatchtowerPaths.statePath(server),
                block);
    }

    public static void scanModsInventory(ServerContext server) throws IOException {
        scanModsInventory(server, true);
    }

    /**
     * @param maybeAutoModrinth when true, start a dedicated Modrinth scan if jar inventory
     *                          changed since the last ops poll and auto-scan is enabled
     * @return true when jars changed vs the previous ops snapshot (false on first baseline)
     */
    public static boolean scanModsInventory(ServerContext server, boolean maybeAutoModrinth) throws IOException {
        ReportConfig config = ModReportConfig.forServer(server);
        String serverDir = server.serverDirectory().toAbsolutePath().toString();
        Path statePath = WatchtowerPaths.statePath(server);
        JsonObject state = StateManager.loadStateObject(statePath);
        JsonArray reportBaseline = ModsInventoryDiff.loadBaseline(state);
        JsonArray opsBaseline = ModsInventoryDiff.loadOpsBaseline(state);
        JsonArray hashCache = opsBaseline.size() > 0 ? opsBaseline : reportBaseline;
        JsonArray current = ModsInventoryDiff.buildSnapshot(
                serverDir, hashCache, config.modJarDriftEnabled());
        JsonObject block = ModsInventoryDiff.buildOpsBlock(current, reportBaseline);
        OpsCacheWriter.applyModsInventory(WatchtowerPaths.opsCachePath(server), statePath, block);

        boolean hadOpsBaseline = opsBaseline.size() > 0;
        JsonObject vsOps = ModsInventoryDiff.diff(current, opsBaseline);
        boolean changed = hadOpsBaseline && vsOps.has("has_changes") && vsOps.get("has_changes").getAsBoolean();
        StateManager.saveLastModsOpsSnapshot(statePath, current);

        if (maybeAutoModrinth && changed) {
            maybeStartModrinthAutoScan(server);
        }
        if (changed) {
            applyModsLight(server, current);
            ModsDeepJobScheduler.enqueueOnJarChange(server);
        }
        rebuildIncidentStories(server);
        return changed;
    }

    /** Light mods side-score snapshot on jar change (no forensics walk). */
    public static void applyModsLight(ServerContext server, JsonArray inventorySnapshot) {
        try {
            ReportConfig config = ModReportConfig.forServer(server);
            if (!config.modsLightOnJarChange()) {
                return;
            }
            JsonObject optional = new JsonObject();
            optional.add("mods_inventory_snapshot", inventorySnapshot.deepCopy());
            try {
                JsonObject ignores = StateManager.getIgnoredClientMods(WatchtowerPaths.statePath(server));
                if (ignores != null && ignores.size() > 0) {
                    optional.add("ignored_client_mods", ignores);
                }
            } catch (Exception ignored) {
                // ignore load failures
            }
            // Reuse inventory as mods list shape when native list unavailable
            JsonObject cache = OpsCacheReader.load(WatchtowerPaths.opsCachePath(server));
            if (cache.has(OpsCacheSchema.RUNNING_MODS)
                    && cache.getAsJsonObject(OpsCacheSchema.RUNNING_MODS).has(OpsCacheSchema.RUNNING_MODS_MODS)) {
                optional.add("mods",
                        cache.getAsJsonObject(OpsCacheSchema.RUNNING_MODS)
                                .get(OpsCacheSchema.RUNNING_MODS_MODS).deepCopy());
            }
            if (!optional.has("mods")) {
                optional.add("mods", new JsonArray());
            }
            StagingBuilder.mergeDisabledJarsFromDisk(
                    optional.getAsJsonArray("mods"), server.serverDirectory().toString());
            if (config.worldRiskEnabled()) {
                Set<String> liveDims = liveDimensionIds(server);
                WorldRiskAnalyzer.attachToMods(
                        optional.getAsJsonArray("mods"),
                        server.serverDirectory(),
                        liveDims);
            }
            dev.mcstatus.watchtower.core.collect.ModSideScorer.apply(optional, config, server.serverDirectory().toString());
            JsonObject light = new JsonObject();
            light.addProperty("updated_at", ZonedDateTime.now(ZoneId.systemDefault()).format(ISO));
            light.addProperty("trigger", "jar_change");
            if (optional.has("mods")) {
                light.add("mods", optional.get("mods"));
            }
            if (optional.has("client_only_mods")) {
                light.add("client_only_mods", optional.get("client_only_mods"));
            }
            if (optional.has("client_only_mods_summary")) {
                light.add("client_only_mods_summary", optional.get("client_only_mods_summary"));
            }
            if (optional.has("ignored_client_mods")) {
                light.add("ignored_client_mods", optional.get("ignored_client_mods"));
            }
            OpsCacheWriter.applyModsLight(WatchtowerPaths.opsCachePath(server), light);
        } catch (Exception e) {
            ModRuntime.logger().debug("Mods light on jar change failed: {}", e.toString());
        }
    }

    /** Live dimension resource locations from world_pressure census when present. */
    static Set<String> liveDimensionIds(ServerContext server) {
        Set<String> out = new HashSet<>();
        try {
            JsonObject cache = OpsCacheReader.load(WatchtowerPaths.opsCachePath(server));
            if (!cache.has("world_pressure") || !cache.get("world_pressure").isJsonObject()) {
                return out;
            }
            JsonObject wp = cache.getAsJsonObject("world_pressure");
            if (!wp.has("dimensions") || !wp.get("dimensions").isJsonArray()) {
                return out;
            }
            for (var el : wp.getAsJsonArray("dimensions")) {
                if (!el.isJsonObject()) {
                    continue;
                }
                JsonObject d = el.getAsJsonObject();
                if (d.has("name") && !d.get("name").isJsonNull()) {
                    out.add(d.get("name").getAsString());
                } else if (d.has("id") && !d.get("id").isJsonNull()) {
                    out.add(d.get("id").getAsString());
                }
            }
        } catch (Exception ignored) {
            // empty
        }
        return out;
    }

    /** Starts a dedicated Modrinth scan when lookup + auto-scan-on-mod-changes are enabled. */
    public static void maybeStartModrinthAutoScan(ServerContext server) {
        try {
            ReportConfig config = ModReportConfig.forServer(server);
            if (!config.modrinthLookup() || !config.modrinthAutoScanOnModChanges() || config.disasterRecovery()) {
                return;
            }
            WatchtowerRuntimeState runtime = ModRuntime.state();
            if (runtime == null) {
                return;
            }
            if (!runtime.tryBeginModrinthScan()) {
                ModRuntime.logger().info("[Watchtower] Modrinth auto-scan skipped — scan already running");
                return;
            }
            runtime.setModrinthScanStage("prepare", "Preparing Modrinth scan");
            ModRuntime.logger().info("[Watchtower] Mod jar changes detected — starting Modrinth auto-scan");
            ModrinthScanRunner.continueAfterBegin(
                    server,
                    runtime,
                    msg -> ModRuntime.logger().info("[Watchtower] {}", msg)
            );
        } catch (Exception e) {
            ModRuntime.logger().warn("[Watchtower] Modrinth auto-scan failed to start: {}", e.toString());
        }
    }

    public static void scanBackupsLive(ServerContext server) throws IOException {
        ReportConfig config = ModReportConfig.forServer(server);
        if (!config.hasBackupDirs()) {
            return;
        }
        // BAU freshness window (24h) — not report LOOKBACK_HOURS (in_lookback is informational only)
        double cutoff = Instant.now().getEpochSecond()
                - (long) IssuesLiveEvaluators.BACKUP_FRESH_HOURS * 3600L;
        JsonObject staging = new JsonObject();
        staging.add("optional", new JsonObject());
        CraftyCollector.scanBackups(staging, config.serverDir(), cutoff, config);
        JsonObject optional = staging.getAsJsonObject("optional");
        JsonObject lastBackup = optional.has("last_backup")
                ? optional.getAsJsonObject("last_backup") : null;
        com.google.gson.JsonElement inventory = optional.has("backup_inventory")
                ? optional.get("backup_inventory") : null;
        OpsCacheWriter.applyBackupsLive(
                WatchtowerPaths.opsCachePath(server),
                WatchtowerPaths.statePath(server),
                lastBackup,
                inventory);
        rebuildIncidentStories(server);
        refreshIssuesLive(server);
        try {
            BackupVerifyScheduler.get().enqueueAfterScan();
        } catch (Exception ignored) {
        }
    }

    public static JsonArray scanRunningMods(ServerContext server) throws IOException {
        List<RunningModsCollector.ModRow> rows = new ArrayList<>();
        for (WatchtowerSample.ModSample m : server.collectSample().mods()) {
            rows.add(new RunningModsCollector.ModRow(
                    m.id(),
                    m.version(),
                    m.displayName(),
                    m.jarFile(),
                    m.nested(),
                    m.parentJar(),
                    m.nestedPath()));
        }
        JsonArray mods = RunningModsCollector.toJsonArray(rows);
        // Fold nested ModList peers under parents before persisting.
        ModNesting.foldRunningMods(mods, server.serverDirectory().toAbsolutePath().toString());
        OpsCacheWriter.applyRunningMods(
                WatchtowerPaths.opsCachePath(server),
                WatchtowerPaths.statePath(server),
                mods);
        scanModsInventory(server);
        return mods;
    }

    public static ActivityLedgerScanner.ScanResult scanActivity(ServerContext server) throws IOException {
        OpsLogTailScanner.ScanResult unified = scanOpsLog(server);
        return new ActivityLedgerScanner.ScanResult(
                unified.scannedAt(),
                unified.newActivityCount(),
                unified.activityEvents(),
                unified.updatedOffset(),
                unified.context()
        );
    }

    public static CrashMtimeScanner.ScanResult scanCrashes(ServerContext server) throws IOException {
        Path statePath = WatchtowerPaths.statePath(server);
        Path opsCachePath = WatchtowerPaths.opsCachePath(server);
        Path rollupsPath = WatchtowerPaths.performanceRollupsPath(server);
        String serverDir = server.serverDirectory().toAbsolutePath().toString();
        ReportConfig config = ModReportConfig.forServer(server);
        CrashMtimeScanner.ScanResult scan = CrashMtimeScanner.scan(
                serverDir, statePath, config.crashEnrichOnMtime());
        OpsCacheWriter.applyScanResult(opsCachePath, statePath, rollupsPath, scan, OpsCacheSchema.SOURCE_SCAN);
        rebuildIncidentStories(server);
        return scan;
    }

    public static void runRoutinePoll(ServerContext server) {
        try {
            scanCrashes(server);
        } catch (Exception e) {
            ModRuntime.logger().debug("Ops routine crash poll failed: {}", e.toString());
        }
        try {
            maybeBuildWeeklyDigest(server);
        } catch (Exception e) {
            ModRuntime.logger().debug("Weekly digest poll failed: {}", e.toString());
        }
        try {
            writeExternalKillHeartbeat(server);
        } catch (Exception e) {
            ModRuntime.logger().debug("External-kill heartbeat failed: {}", e.toString());
        }
    }

    /** Touch last_alive_at + cgroup oom_kill counter for post-mortem external-kill detection. */
    static void writeExternalKillHeartbeat(ServerContext server) {
        if (server == null) {
            return;
        }
        try {
            ReportConfig config = ModReportConfig.forServer(server);
            if (!config.externalKillDetectEnabled()) {
                return;
            }
            Path statePath = WatchtowerPaths.statePath(server);
            String nowIso = Instant.now().toString();
            JsonObject patch = new JsonObject();
            patch.addProperty("last_alive_at", nowIso);
            long oomKill = CgroupProbe.oomKillCount();
            patch.addProperty("cgroup_oom_kill", oomKill);
            JsonObject existing = StateManager.getExternalKillSession(statePath);
            if (!existing.has("boot_at") || existing.get("boot_at").isJsonNull()
                    || existing.get("boot_at").getAsString().isBlank()) {
                patch.addProperty("boot_at", nowIso);
            }
            StateManager.updateExternalKillSession(statePath, patch);
        } catch (Exception e) {
            ModRuntime.logger().debug("External-kill heartbeat write failed: {}", e.toString());
        }
    }

    /**
     * Build and persist a weekly ops digest now. {@code trigger} is {@code "auto"} or {@code "manual"}.
     *
     * @return the new digest entry, or null when disabled / build failed
     */
    public static JsonObject buildWeeklyDigest(ServerContext server, String trigger) {
        if (server == null) {
            return null;
        }
        try {
            ReportConfig config = ModReportConfig.forServer(server);
            if (!config.weeklyDigestEnabled()) {
                return null;
            }
            Path opsCachePath = WatchtowerPaths.opsCachePath(server);
            Path statePath = WatchtowerPaths.statePath(server);
            Path rollupsPath = WatchtowerPaths.performanceRollupsPath(server);
            JsonObject opsCache = OpsCacheReader.load(opsCachePath);
            int loadHours = Math.max(1, config.weeklyDigestIntervalDays()) * 24 * 2;
            List<JsonObject> rows = PerformanceRollupWriter.loadRowsFromFile(rollupsPath, loadHours);

            JsonObject facts = null;
            try {
                Path factsPath = ReportArtifactFinder.findLatestFacts(WatchtowerPaths.reportDir(server));
                if (factsPath != null && Files.isRegularFile(factsPath)) {
                    facts = com.google.gson.JsonParser.parseString(
                            Files.readString(factsPath, StandardCharsets.UTF_8)).getAsJsonObject();
                }
            } catch (Exception ignored) {
            }

            JsonObject scorecard = ScorecardBuilder.build(
                    facts, opsCache, rollupsPath, config.tpsWarn(), config.msptWarn(), 5);
            JsonArray priorHistory = priorDigestHistory(opsCache);
            WeeklyDigestBuilder.Settings settings = new WeeklyDigestBuilder.Settings(
                    config.weeklyDigestEnabled(),
                    config.weeklyDigestIntervalDays(),
                    config.weeklyDigestHistoryMax()
            );
            JsonObject entry = WeeklyDigestBuilder.build(
                    opsCache, scorecard, rows, priorHistory,
                    trigger != null ? trigger : "auto",
                    settings,
                    Instant.now());
            if (entry == null) {
                return null;
            }
            OpsCacheWriter.applyWeeklyDigest(
                    opsCachePath, statePath, entry, config.weeklyDigestHistoryMax());
            return entry;
        } catch (Exception e) {
            ModRuntime.logger().debug("Weekly digest build failed: {}", e.toString());
            return null;
        }
    }

    /**
     * Cadence gate — builds a digest when history is empty or the newest entry is older than the interval.
     */
    public static void maybeBuildWeeklyDigest(ServerContext server) {
        if (server == null) {
            return;
        }
        try {
            ReportConfig config = ModReportConfig.forServer(server);
            if (!config.weeklyDigestEnabled()) {
                return;
            }
            JsonObject opsCache = OpsCacheReader.load(WatchtowerPaths.opsCachePath(server));
            JsonArray history = priorDigestHistory(opsCache);
            if (history.size() > 0 && history.get(0).isJsonObject()) {
                JsonObject latest = history.get(0).getAsJsonObject();
                if (latest.has("generated_at") && !latest.get("generated_at").isJsonNull()) {
                    Instant last = TimeParse.parseTime(latest.get("generated_at").getAsString());
                    if (last != null) {
                        long intervalSec = (long) Math.max(1, config.weeklyDigestIntervalDays()) * 86400L;
                        if (Instant.now().getEpochSecond() - last.getEpochSecond() < intervalSec) {
                            return;
                        }
                    }
                }
            }
            buildWeeklyDigest(server, "auto");
        } catch (Exception e) {
            ModRuntime.logger().debug("Weekly digest cadence check failed: {}", e.toString());
        }
    }

    private static JsonArray priorDigestHistory(JsonObject opsCache) {
        if (opsCache != null
                && opsCache.has(OpsCacheSchema.WEEKLY_DIGEST)
                && opsCache.get(OpsCacheSchema.WEEKLY_DIGEST).isJsonObject()) {
            JsonObject block = opsCache.getAsJsonObject(OpsCacheSchema.WEEKLY_DIGEST);
            if (block.has(OpsCacheSchema.WEEKLY_DIGEST_HISTORY)
                    && block.get(OpsCacheSchema.WEEKLY_DIGEST_HISTORY).isJsonArray()) {
                return block.getAsJsonArray(OpsCacheSchema.WEEKLY_DIGEST_HISTORY);
            }
        }
        return new JsonArray();
    }

    private static JsonObject buildPregenHint(ServerContext server) {
        JsonObject hint = new JsonObject();
        try {
            JsonObject live = LiveMetricsService.get().getLiveResponse();
            if (live.has("chunky_pregen")) {
                JsonObject chunky = live.getAsJsonObject("chunky_pregen");
                boolean active = chunky.has("pregen_active") && chunky.get("pregen_active").getAsBoolean();
                hint.addProperty("chunky_active", active);
                if (chunky.has("last") && chunky.get("last").isJsonObject()) {
                    JsonObject last = chunky.getAsJsonObject("last");
                    if (last.has("pct")) {
                        hint.addProperty("chunky_detail", last.get("pct").getAsDouble() + "%");
                    }
                }
            }
            if (live.has("dh_pregen")) {
                JsonObject dh = live.getAsJsonObject("dh_pregen");
                boolean active = dh.has("pregen_active") && dh.get("pregen_active").getAsBoolean();
                hint.addProperty("dh_active", active);
                if (dh.has("last") && dh.get("last").isJsonObject()) {
                    JsonObject last = dh.getAsJsonObject("last");
                    if (last.has("pct")) {
                        hint.addProperty("dh_detail", last.get("pct").getAsDouble() + "%");
                    }
                }
            }
        } catch (Exception ignored) {
        }
        return hint;
    }

    public static JsonObject buildManualIncident(ServerContext server, String note, String trigger) {
        WatchtowerSample.Sample sample = server.collectSampleLight();
        Instant now = Instant.now();
        String id = IncidentWriter.newIncidentId(now);

        JsonObject incident = new JsonObject();
        incident.addProperty("id", id);
        incident.addProperty("pinned_at", ZonedDateTime.now(ZoneId.systemDefault()).format(ISO));
        incident.addProperty("source", "manual");
        incident.addProperty("trigger", trigger != null ? trigger : "manual");
        incident.addProperty("severity", sample.mspt() > 100 || sample.tps() < 15 ? "critical" : "warning");
        if (note != null && !note.isBlank()) {
            incident.addProperty("note", note);
        }
        incident.addProperty("tps", round2(Math.min(20.0, 1000.0 / Math.max(sample.mspt(), 0.001))));
        incident.addProperty("mspt", round1(sample.mspt()));
        incident.addProperty("players_online", sample.playersOnline());
        incident.add("players", playersArray(sample));
        WatchtowerSample.HeapMb heap = sample.heap();
        if (heap != null) {
            incident.addProperty("heap_used_gb", round2(heap.used() / 1024.0));
            incident.addProperty("heap_max_gb", round2(heap.max() / 1024.0));
        }
        if (sample.entities() >= 0) {
            incident.addProperty("entities", sample.entities());
        }
        if (sample.chunks() >= 0) {
            incident.addProperty("chunks", sample.chunks());
        }

        try {
            OpsLogTailScanner.ScanResult tail = OpsLogTailScanner.scanTail(
                    server.serverDirectory().toAbsolutePath().toString(),
                    OpsLogTailScanner.DEFAULT_TAIL_LINES,
                    5000);
            JsonObject ctx = tail.context();
            CpuUsageSampler.Reading cpu = HostCpuProbe.sample();
            if (cpu.hostCpuPct() != null) {
                ctx.addProperty("host_cpu_pct", round1(cpu.hostCpuPct()));
            }
            if (cpu.coresUsed() != null) {
                ctx.addProperty("cpu_cores_used", round2(cpu.coresUsed()));
            }
            if (cpu.limitCores() != null) {
                ctx.addProperty("cpu_limit_cores", round2(cpu.limitCores()));
            }
            incident.add("context", ctx);
        } catch (IOException e) {
            incident.add("context", new JsonObject());
        }

        incident.addProperty("narrative", LagIssueBuilder.buildNarrative(incident));
        incident.add("findings", LagIssueBuilder.buildFindings(incident));
        String suspect = LagIssueBuilder.primarySuspect(incident);
        if (suspect != null) {
            incident.addProperty("primary_suspect", suspect);
        }
        return incident;
    }

    public static JsonObject writeIncident(ServerContext server, JsonObject incident) throws IOException {
        ReportConfig config = ModReportConfig.forServer(server);
        Path incidentsDir = WatchtowerPaths.incidentsDir(server);
        IncidentWriter.write(incidentsDir, incident, config.incidentMaxFiles());

        JsonObject lagIssue = LagIssueBuilder.buildPeekEntry(incident);
        JsonObject lagEvent = OpsLogTailScanner.lagIncidentEvent(
                incident.get("id").getAsString(), Instant.now());
        OpsCacheWriter.applyLagIncident(
                WatchtowerPaths.opsCachePath(server),
                WatchtowerPaths.statePath(server),
                incident,
                lagIssue,
                lagEvent);
        rebuildIncidentStories(server);
        return incident;
    }

    /** Rebuild cross-domain incident stories into ops-cache (best-effort). */
    public static void rebuildIncidentStories(ServerContext server) {
        if (server == null) {
            return;
        }
        try {
            ReportConfig config = ModReportConfig.forServer(server);
            IncidentStoryBuilder.Settings settings = new IncidentStoryBuilder.Settings(
                    config.incidentStoryEnabled(),
                    config.incidentStoryWindowMin(),
                    config.incidentStoryLookbackHours(),
                    config.incidentStoryMax()
            );
            OpsCacheWriter.applyIncidentStories(
                    WatchtowerPaths.opsCachePath(server),
                    WatchtowerPaths.statePath(server),
                    settings,
                    null);
        } catch (Exception e) {
            ModRuntime.logger().debug("Incident story rebuild failed: {}", e.toString());
        }
    }

    private static JsonArray playersArray(WatchtowerSample.Sample sample) {
        JsonArray arr = new JsonArray();
        for (WatchtowerSample.PlayerSample p : sample.players()) {
            JsonObject row = new JsonObject();
            row.addProperty("name", p.name());
            row.addProperty("uuid", p.uuid());
            row.addProperty("ping", p.ping());
            row.addProperty("dimension", p.dimension());
            arr.add(row);
        }
        return arr;
    }

    private static double round1(double v) {
        return Math.round(v * 10.0) / 10.0;
    }

    private static double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }
}
