package dev.mcstatus.watchtower;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.collect.CraftyCollector;
import dev.mcstatus.watchtower.core.collect.CrashMtimeScanner;
import dev.mcstatus.watchtower.core.collect.ExternalBackupDetector;
import dev.mcstatus.watchtower.core.collect.HostMetricsCollector;
import dev.mcstatus.watchtower.core.collect.ModsInventoryDiff;
import dev.mcstatus.watchtower.core.collect.RunningModsCollector;
import dev.mcstatus.watchtower.core.analyze.DiskJumpEvaluator;
import dev.mcstatus.watchtower.core.incident.IncidentWriter;
import dev.mcstatus.watchtower.core.ops.ActivityLedgerScanner;
import dev.mcstatus.watchtower.core.ops.LagIssueBuilder;
import dev.mcstatus.watchtower.core.ops.LogStaleEvaluator;
import dev.mcstatus.watchtower.core.ops.OpsCacheSchema;
import dev.mcstatus.watchtower.core.ops.OpsCacheWriter;
import dev.mcstatus.watchtower.core.ops.OpsLogTailScanner;
import dev.mcstatus.watchtower.core.report.ReportConfig;
import dev.mcstatus.watchtower.core.report.StateManager;
import net.minecraft.server.MinecraftServer;

import java.io.IOException;
import java.nio.file.Path;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

/**
 * Runs lightweight ops cache scans (crashes, unified log tail, running mods).
 */
public final class OpsScanService {

    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_OFFSET_DATE_TIME;

    private OpsScanService() {
    }

    public static OpsLogTailScanner.ScanResult scanOpsLog(MinecraftServer server) throws IOException {
        ReportConfig config = ModReportConfig.forServer(server);
        Path statePath = WatchtowerPaths.statePath(server);
        String serverDir = server.getServerDirectory().toAbsolutePath().toString();
        OpsLogTailScanner.ScanResult scan = OpsLogTailScanner.scanIncremental(
                serverDir, statePath, config.tickLagThrottleMs());
        Path opsCachePath = WatchtowerPaths.opsCachePath(server);
        Path rollupsPath = WatchtowerPaths.performanceRollupsPath(server);
        Path logPath = Path.of(serverDir, "logs", "latest.log");
        JsonObject logStale = LogStaleEvaluator.evaluate(logPath, true, config.logStaleMinutes());
        JsonObject pregenHint = buildPregenHint(server);
        OpsCacheWriter.applyOpsLogScanResult(opsCachePath, statePath, rollupsPath, scan, pregenHint, null, logStale);
        scanDiskJump(server);
        scanBackupExternal(server);
        return scan;
    }

    public static void scanBackupExternal(MinecraftServer server) throws IOException {
        ReportConfig config = ModReportConfig.forServer(server);
        if (!ExternalBackupDetector.isConfigured(config)) {
            return;
        }
        String serverDir = server.getServerDirectory().toAbsolutePath().toString();
        JsonObject block = ExternalBackupDetector.read(serverDir, config, "file");
        OpsCacheWriter.applyBackupExternal(
                WatchtowerPaths.opsCachePath(server),
                WatchtowerPaths.statePath(server),
                block);
    }

    public static void scanDiskJump(MinecraftServer server) throws IOException {
        String serverDir = server.getServerDirectory().toAbsolutePath().toString();
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

    public static void scanModsInventory(MinecraftServer server) throws IOException {
        String serverDir = server.getServerDirectory().toAbsolutePath().toString();
        Path statePath = WatchtowerPaths.statePath(server);
        JsonArray current = ModsInventoryDiff.buildSnapshot(serverDir);
        JsonObject state = StateManager.loadStateObject(statePath);
        JsonArray baseline = ModsInventoryDiff.loadBaseline(state);
        JsonObject block = ModsInventoryDiff.buildOpsBlock(current, baseline);
        OpsCacheWriter.applyModsInventory(WatchtowerPaths.opsCachePath(server), statePath, block);
    }

    public static void scanBackupsLive(MinecraftServer server) throws IOException {
        ReportConfig config = ModReportConfig.forServer(server);
        if (!config.hasBackupDirs()) {
            return;
        }
        double cutoff = Instant.now().getEpochSecond() - (long) config.lookbackHours() * 3600L;
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
    }

    public static JsonArray scanRunningMods(MinecraftServer server) throws IOException {
        List<RunningModsCollector.ModRow> rows = new ArrayList<>();
        for (WatchtowerSampler.ModSample m : WatchtowerSampler.collect(server).mods()) {
            rows.add(new RunningModsCollector.ModRow(m.id(), m.version(), m.displayName()));
        }
        JsonArray mods = RunningModsCollector.toJsonArray(rows);
        OpsCacheWriter.applyRunningMods(
                WatchtowerPaths.opsCachePath(server),
                WatchtowerPaths.statePath(server),
                mods);
        scanModsInventory(server);
        return mods;
    }

    public static ActivityLedgerScanner.ScanResult scanActivity(MinecraftServer server) throws IOException {
        OpsLogTailScanner.ScanResult unified = scanOpsLog(server);
        return new ActivityLedgerScanner.ScanResult(
                unified.scannedAt(),
                unified.newActivityCount(),
                unified.activityEvents(),
                unified.updatedOffset(),
                unified.context()
        );
    }

    public static CrashMtimeScanner.ScanResult scanCrashes(MinecraftServer server) throws IOException {
        Path statePath = WatchtowerPaths.statePath(server);
        Path opsCachePath = WatchtowerPaths.opsCachePath(server);
        Path rollupsPath = WatchtowerPaths.performanceRollupsPath(server);
        String serverDir = server.getServerDirectory().toAbsolutePath().toString();
        CrashMtimeScanner.ScanResult scan = CrashMtimeScanner.scan(serverDir, statePath);
        OpsCacheWriter.applyScanResult(opsCachePath, statePath, rollupsPath, scan, OpsCacheSchema.SOURCE_SCAN);
        return scan;
    }

    public static void runRoutinePoll(MinecraftServer server) {
        try {
            scanCrashes(server);
        } catch (Exception e) {
            WatchtowerMod.LOGGER.debug("Ops routine crash poll failed: {}", e.toString());
        }
    }

    private static JsonObject buildPregenHint(MinecraftServer server) {
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

    public static JsonObject buildManualIncident(MinecraftServer server, String note, String trigger) {
        WatchtowerSampler.Sample sample = WatchtowerSampler.collect(server);
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
        WatchtowerSampler.HeapMb heap = sample.heap();
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
                    server.getServerDirectory().toAbsolutePath().toString(),
                    OpsLogTailScanner.DEFAULT_TAIL_LINES,
                    5000);
            JsonObject ctx = tail.context();
            Double hostCpu = HostCpuProbe.readHostCpuPct();
            if (hostCpu != null) {
                ctx.addProperty("host_cpu_pct", round1(hostCpu));
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

    public static JsonObject writeIncident(MinecraftServer server, JsonObject incident) throws IOException {
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
        return incident;
    }

    private static JsonArray playersArray(WatchtowerSampler.Sample sample) {
        JsonArray arr = new JsonArray();
        for (WatchtowerSampler.PlayerSample p : sample.players()) {
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
