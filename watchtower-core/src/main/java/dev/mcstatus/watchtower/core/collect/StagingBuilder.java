package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.panel.PanelLabels;
import dev.mcstatus.watchtower.core.report.ReportConfig;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Orchestrates staging JSON construction (ported from {@code build_staging}).
 */
public final class StagingBuilder {

    private StagingBuilder() {
    }

    public static JsonObject buildStaging(ReportConfig config) {
        double cutoff = config.windowStartEpoch();
        String since = config.sinceString();

        JsonObject staging = newStagingSkeleton(config, cutoff);

        JsonObject system = HostMetricsCollector.collectSystemBasics(config.serverDir());
        HostMetricsCollector.applyJavaProcessInfo(system, config);
        HostMetricsCollector.collectCpuMetrics(system, config, since);
        staging.add("system", system);

        String serverDir = config.serverDir();
        if (config.serverDirValid()) {
            try {
                LogScanner.scanLogs(serverDir, staging, cutoff, config);
            } catch (Exception e) {
                CollectionWarnings.add(staging, "log scan failed — " + safeMessage(e));
            }
            try {
                DhPregenScanner.scanDhPregenLogs(serverDir, staging, cutoff, config);
            } catch (Exception e) {
                CollectionWarnings.add(staging, "DH pregen log scan failed — " + safeMessage(e));
            }
            try {
                ChunkyPregenScanner.scanChunkyPregenLogs(serverDir, staging, cutoff, config);
            } catch (Exception e) {
                CollectionWarnings.add(staging, "Chunky pregen log scan failed — " + safeMessage(e));
            }
            try {
                CrashReportScanner.scanCrashReports(serverDir, staging, cutoff);
            } catch (Exception e) {
                CollectionWarnings.add(staging, "crash report scan failed — " + safeMessage(e));
            }
            try {
                CraftyCollector.scanBackups(staging, serverDir, cutoff, config);
            } catch (Exception e) {
                CollectionWarnings.add(staging, "backup scan failed — " + safeMessage(e));
            }
            try {
                JsonObject optional = staging.getAsJsonObject("optional");
                optional.add("backup_external",
                        ExternalBackupDetector.readForReport(serverDir, config));
            } catch (Exception e) {
                CollectionWarnings.add(staging, "external backup heartbeat read failed — " + safeMessage(e));
            }
        }

        try {
            CraftyCollector.scanCraftyAudit(staging, cutoff, config);
        } catch (Exception e) {
            CollectionWarnings.add(staging, "Crafty audit.log not readable — " + safeMessage(e));
        }
        try {
            HostEventScanner.scanHostEvents(staging, since, cutoff);
        } catch (Exception e) {
            CollectionWarnings.add(staging, "journalctl unavailable — host events from auth.log only");
        }

        if (config.serverDirValid()) {
            try {
                applyV3Collectors(staging, serverDir, cutoff, config);
            } catch (Exception e) {
                CollectionWarnings.add(staging, "extended collectors failed — " + safeMessage(e));
            }
        }

        JsonObject optional = staging.getAsJsonObject("optional");
        String panelId = staging.getAsJsonObject("meta").get("panel").getAsString();
        optional.add("host_environment", HostEnvironmentDetector.detect(panelId));

        return staging;
    }

    private static String safeMessage(Exception e) {
        return e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName();
    }

    private static JsonObject newStagingSkeleton(ReportConfig config, double cutoff) {
        ZonedDateTime now = ZonedDateTime.now(ZoneId.systemDefault());
        ZonedDateTime windowStart = Instant.ofEpochSecond((long) cutoff).atZone(ZoneId.systemDefault());

        JsonObject staging = new JsonObject();

        JsonObject meta = new JsonObject();
        meta.addProperty("generated", now.format(java.time.format.DateTimeFormatter.ISO_OFFSET_DATE_TIME));
        meta.addProperty("hostname", config.hostname());
        if (config.disasterRecovery()) {
            meta.addProperty("report_mode", "dr");
            meta.addProperty("lookback_minutes", config.lookbackMinutes());
            meta.addProperty("lookback_hours", 0);
        } else {
            meta.addProperty("lookback_hours", config.lookbackHours());
        }
        meta.addProperty("window_start", windowStart.format(java.time.format.DateTimeFormatter.ISO_OFFSET_DATE_TIME));
        meta.addProperty("incremental", config.incremental());
        meta.addProperty("server_dir", config.serverDir());
        String panelId = config.panelDetected();
        meta.addProperty("panel", panelId);
        meta.addProperty("panel_display_name", PanelLabels.displayName(panelId));
        meta.addProperty("loader", config.loader());
        meta.addProperty("backup_suppress_local_missing", config.backupSuppressLocalMissing());
        meta.addProperty("backup_local_configured", config.hasBackupDirs());
        meta.addProperty("backup_external_configured", config.isExternalBackupConfigured());
        staging.add("meta", meta);

        JsonObject flags = new JsonObject();
        flags.addProperty("java_running", config.javaRunning());
        flags.addProperty("panel_running", config.panelRunning());
        flags.addProperty("panel_has_daemon", PanelLabels.hasDaemon(panelId));
        flags.addProperty("hosted_container", PanelLabels.shouldSuppressPanelDown(panelId));
        staging.add("flags", flags);

        JsonObject thresholds = new JsonObject();
        thresholds.addProperty("disk_warn_pct", config.diskWarnPct());
        thresholds.addProperty("mem_warn_avail_gb", config.memWarnAvailGb());
        thresholds.addProperty("log_stale_minutes", config.logStaleMinutes());
        thresholds.addProperty("cant_keep_up_warn", config.cantKeepUpWarn());
        thresholds.addProperty("mspt_warn", config.msptWarn());
        thresholds.addProperty("tps_warn", config.tpsWarn());
        thresholds.addProperty("cpu_throttle_pct", config.cpuThrottlePct());
        thresholds.addProperty("tick_lag_throttle_ms", config.tickLagThrottleMs());
        thresholds.addProperty("chunky_stall_minutes", config.chunkyStallMinutes());
        thresholds.addProperty("chunky_degraded_cps", config.chunkyDegradedCps());
        thresholds.addProperty("chunk_gen_fail_threshold", config.chunkGenFailThreshold());
        thresholds.addProperty("chunk_gen_fail_window_min", config.chunkGenFailWindowMin());
        staging.add("thresholds", thresholds);

        staging.add("events", new JsonArray());

        JsonObject mc = new JsonObject();
        mc.addProperty("clean_shutdown_seen", false);
        mc.addProperty("oom_in_logs", false);
        mc.addProperty("cant_keep_up_count", 0);
        mc.add("new_crash_reports", new JsonArray());
        mc.add("last_log_line", null);
        mc.add("last_log_time", null);
        mc.addProperty("log_had_activity_in_window", false);
        mc.add("tick_lag_evidence", new JsonArray());
        mc.add("oom_evidence", new JsonArray());
        mc.addProperty("worst_tick_lag_ms", 0);
        staging.add("minecraft", mc);

        staging.add("optional", new JsonObject());
        staging.add("kernel_oom_evidence", new JsonArray());

        return staging;
    }

    private static void applyV3Collectors(
            JsonObject staging,
            String serverDir,
            double cutoff,
            ReportConfig config) {
        JsonObject optional = staging.getAsJsonObject("optional");
        JsonObject mc = staging.getAsJsonObject("minecraft");
        JsonObject state = HostMetricsCollector.loadStateFile(config);

        JsonObject tps = WatchtowerSnapshotLoader.loadWatchtowerSnapshot(serverDir);
        boolean snapshotFresh = isSnapshotFresh(serverDir, tps);
        if (!config.disasterRecovery() && !snapshotFresh && RconMetricsCollector.isConfigured(config)) {
            JsonObject rconTps = RconMetricsCollector.poll(config);
            if (rconTps != null) {
                tps = rconTps;
            }
        }
        JsonObject nativeBlob = null;
        if (tps != null && tps.has("_native")) {
            nativeBlob = tps.getAsJsonObject("_native").deepCopy();
            optional.add("watchtower_native", nativeBlob);
            tps.remove("_native");
        }
        applyPlayers(mc, optional, tps, nativeBlob);
        ModChangeDetector.apply(optional, nativeBlob, state);
        JsonArray modsSnapshot = ModsInventoryDiff.buildSnapshot(serverDir);
        optional.add("mods_inventory_snapshot", modsSnapshot);
        ModsInventoryDiff.enrichModChanges(optional, modsSnapshot, ModsInventoryDiff.loadBaseline(state));
        if (state.has("acknowledged_crashes")) {
            optional.add("acknowledged_crashes", state.get("acknowledged_crashes").deepCopy());
        }
        if (state.has("ignored_client_mods")) {
            optional.add("ignored_client_mods", state.get("ignored_client_mods").deepCopy());
        }
        applyModsList(optional, nativeBlob, serverDir, config);

        double peakLog = mc.has("worst_tick_lag_ms") ? mc.get("worst_tick_lag_ms").getAsDouble() : 0;

        if (tps == null) {
            if (peakLog > 0) {
                double estTps = Math.max(0.0, Math.min(20.0, 20.0 - Math.max(0.0, peakLog - 50.0) / 50.0 * 20.0));
                JsonObject tpsEst = new JsonObject();
                tpsEst.addProperty("source", "log-estimate");
                JsonObject ow = new JsonObject();
                ow.addProperty("tps", Math.round(estTps * 100.0) / 100.0);
                ow.addProperty("mspt", peakLog);
                tpsEst.add("overworld", ow);
                tpsEst.addProperty("polled_at", ZonedDateTime.now(ZoneId.systemDefault())
                        .format(java.time.format.DateTimeFormatter.ISO_OFFSET_DATE_TIME));
                mc.add("tps", tpsEst);
            }
        } else {
            JsonObject tpsForMc = new JsonObject();
            for (String key : tps.keySet()) {
                if (!List.of("entities", "chunks", "mod_count", "players_online").contains(key)) {
                    tpsForMc.add(key, tps.get(key));
                }
            }
            mc.add("tps", tpsForMc);

            JsonObject ow = tps.has("overworld") ? tps.getAsJsonObject("overworld") : null;
            if (ow != null && ow.has("mspt") && !ow.get("mspt").isJsonNull()) {
                peakLog = Math.max(peakLog, ow.get("mspt").getAsDouble());
            }

            if (tps.has("entities") || tps.has("chunks")) {
                JsonObject entityStats = new JsonObject();
                if (tps.has("entities")) {
                    entityStats.add("entities", tps.get("entities"));
                } else {
                    entityStats.add("entities", null);
                }
                if (tps.has("chunks")) {
                    entityStats.add("chunks", tps.get("chunks"));
                } else {
                    entityStats.add("chunks", null);
                }
                entityStats.addProperty("source", CollectSupport.getString(tps, "source").isEmpty()
                        ? "watchtower" : tps.get("source").getAsString());
                mc.add("entity_stats", entityStats);
            }

            if (tps.has("mod_count")) {
                int modCount = tps.get("mod_count").getAsInt();
                mc.addProperty("mod_count", modCount);
                applyModCountDelta(mc, state, modCount);
            }
        }

        double cutoffTs = config.lookbackMinutes() > 0
                ? Instant.now().getEpochSecond() - (long) config.lookbackMinutes() * 60L
                : Instant.now().getEpochSecond() - (long) config.lookbackHours() * 3600L;
        WatchtowerSnapshotLoader.PeakMsptResult peakResult = WatchtowerSnapshotLoader.computePeakMspt(
                peakLog, tps, nativeBlob, state, cutoffTs);

        JsonObject tpsObj = mc.has("tps") ? mc.getAsJsonObject("tps") : new JsonObject();
        if (!mc.has("tps")) {
            mc.add("tps", tpsObj);
        }
        tpsObj.addProperty("peak_mspt_24h", Math.round(peakResult.peak() * 10.0) / 10.0);
        if (!peakResult.source().isEmpty()) {
            tpsObj.addProperty("peak_mspt_24h_source", peakResult.source());
        }

        JsonObject storage = config.dimensionStorageScan()
                ? DimensionStorageScanner.scan(serverDir, true)
                : ExtrasCollector.collectStorage(serverDir);
        if (!storage.entrySet().isEmpty()) {
            optional.add("storage", storage);
            if (storage.has("world_bytes")) {
                long wb = storage.get("world_bytes").getAsLong();
                JsonArray history = state.has("world_size_history")
                        ? state.getAsJsonArray("world_size_history") : new JsonArray();
                Double delta24h = ExtrasCollector.storageDeltaMb(wb, history, 24.0);
                if (delta24h != null) {
                    storage.addProperty("delta_mb_24h", delta24h);
                }
                if (state.has("world_size_bytes")) {
                    long lastWb = state.get("world_size_bytes").getAsLong();
                    storage.addProperty("delta_mb_since_last",
                            Math.round((wb - lastWb) / (1024.0 * 1024.0) * 10.0) / 10.0);
                }
            }
        }

        JsonObject diskIo = ExtrasCollector.collectDiskIo(serverDir);
        if (diskIo != null) {
            optional.add("disk_io", diskIo);
        }

        if (!mc.has("mod_count")) {
            int modCount = ExtrasCollector.countMods(serverDir);
            mc.addProperty("mod_count", modCount);
            applyModCountDelta(mc, state, modCount);
        }

        if (!mc.has("entity_stats")) {
            JsonObject entityStats = new JsonObject();
            entityStats.add("entities", null);
            entityStats.add("chunks", null);
            mc.add("entity_stats", entityStats);
        }

        JsonObject dh = optional.has("dh_pregen") ? optional.getAsJsonObject("dh_pregen") : new JsonObject();
        boolean pregenActive = dh.has("pregen_active") && dh.get("pregen_active").getAsBoolean();
        JsonObject ps = mc.has("player_stats") ? mc.getAsJsonObject("player_stats") : new JsonObject();
        Integer peakConcurrent = ps.has("peak_concurrent") ? ps.get("peak_concurrent").getAsInt() : null;
        Integer concurrentAtWorstLag = ps.has("concurrent_at_worst_lag")
                ? ps.get("concurrent_at_worst_lag").getAsInt() : null;
        optional.add("load_attribution", ExtrasCollector.computeLoadAttribution(
                pregenActive, peakConcurrent, concurrentAtWorstLag, null));

        JsonObject trendState = new JsonObject();
        trendState.addProperty("cpu_sample_count",
                state.has("cpu_samples") ? state.getAsJsonArray("cpu_samples").size() : 0);
        trendState.addProperty("tps_sample_count",
                state.has("tps_samples") ? state.getAsJsonArray("tps_samples").size() : 0);
        optional.add("trend_state", trendState);

        String craftyApp = config.craftyApp();
        String auditPath = craftyApp != null && !craftyApp.isBlank()
                ? Path.of(craftyApp, "logs", "audit.log").toString() : "";
        if (!auditPath.isEmpty() && !Path.of(auditPath).toFile().isFile()) {
            auditPath = null;
        }

        List<String> logPaths = new ArrayList<>();
        for (Path p : GzipLineReader.iterLogFiles(serverDir, config.logGzipCount(), cutoff)) {
            logPaths.add(p.toString());
        }
        ZonedDateTime windowStartDt = Instant.ofEpochSecond((long) cutoff).atZone(ZoneId.systemDefault());
        optional.add("security", ExtrasCollector.collectSecurity(
                windowStartDt,
                auditPath,
                logPaths));

        JsonObject net = ExtrasCollector.readProcNetDev();
        if (net != null) {
            optional.add("bandwidth", net);
            if (state.has("bandwidth_sample")) {
                JsonObject prev = state.getAsJsonObject("bandwidth_sample");
                if (prev.has("rx_bytes") && !prev.get("rx_bytes").isJsonNull()) {
                    long rxDelta = net.get("rx_bytes").getAsLong() - prev.get("rx_bytes").getAsLong();
                    long txDelta = net.get("tx_bytes").getAsLong() - prev.get("tx_bytes").getAsLong();
                    net.addProperty("rx_mb_since_last", Math.round(rxDelta / (1024.0 * 1024.0) * 10.0) / 10.0);
                    net.addProperty("tx_mb_since_last", Math.round(txDelta / (1024.0 * 1024.0) * 10.0) / 10.0);
                }
            }
        }

        JsonObject thermal = ThermalCollector.collect();
        optional.add("thermal", thermal);

        optional.add("player_directory", buildPlayerDirectory(serverDir, optional, mc));

        if (config.sparkEnabled()) {
            SparkCollector.collect(serverDir, config).ifPresent(result -> {
                JsonObject profile = SparkProfileBuilder.build(result, serverDir, config);
                if (profile != null) {
                    optional.add(SparkProfileFacts.KEY, profile);
                }
            });
        }
    }

    private static JsonObject buildPlayerDirectory(String serverDir, JsonObject optional, JsonObject mc) {
        List<PlayerDirectoryCollector.OnlinePlayer> online = new ArrayList<>();
        if (optional.has("players_now")) {
            for (JsonElement el : optional.getAsJsonArray("players_now")) {
                if (!el.isJsonObject()) {
                    continue;
                }
                JsonObject p = el.getAsJsonObject();
                String name = CollectSupport.getString(p, "name");
                if (name.isEmpty()) {
                    continue;
                }
                String uuid = CollectSupport.getString(p, "uuid");
                int ping = p.has("ping") && !p.get("ping").isJsonNull() ? p.get("ping").getAsInt() : 0;
                String dimension = CollectSupport.getString(p, "dimension");
                online.add(new PlayerDirectoryCollector.OnlinePlayer(
                        name,
                        uuid.isEmpty() ? null : uuid,
                        ping,
                        dimension.isEmpty() ? null : dimension));
            }
        }
        JsonObject directory = PlayerDirectoryCollector.collect(serverDir, online);
        if (mc.has("player_stats")) {
            directory.add("window_stats", mc.getAsJsonObject("player_stats").deepCopy());
        }
        return directory;
    }

    private static void applyModCountDelta(JsonObject mc, JsonObject state, int modCount) {
        if (state.has("mod_count") && !state.get("mod_count").isJsonNull()) {
            mc.addProperty("mod_count_delta", modCount - state.get("mod_count").getAsInt());
        }
    }

    private static boolean isSnapshotFresh(String serverDir, JsonObject tps) {
        if (tps == null) {
            return false;
        }
        String source = CollectSupport.getString(tps, "source");
        if (!source.isEmpty() && !"watchtower".equals(source)) {
            return false;
        }
        long nowSec = Instant.now().getEpochSecond();
        String polledAt = CollectSupport.getString(tps, "polled_at");
        if (!polledAt.isEmpty()) {
            Instant polled = dev.mcstatus.watchtower.core.util.TimeParse.parseTime(polledAt);
            if (polled != null) {
                return nowSec - polled.getEpochSecond() <= 300;
            }
        }
        Path snapshot = Path.of(serverDir, "watchtower", "snapshot.json");
        try {
            if (Files.isRegularFile(snapshot)) {
                long mtimeSec = Files.getLastModifiedTime(snapshot).toMillis() / 1000L;
                return nowSec - mtimeSec <= 300;
            }
        } catch (IOException ignored) {
            // fall through
        }
        return true;
    }

    private static void applyPlayers(JsonObject mc, JsonObject optional, JsonObject tps, JsonObject nativeBlob) {
        int online = 0;
        if (tps != null && tps.has("players_online") && !tps.get("players_online").isJsonNull()) {
            online = tps.get("players_online").getAsInt();
        }
        JsonArray playersNow = new JsonArray();
        JsonArray names = new JsonArray();
        if (nativeBlob != null && nativeBlob.has("players") && nativeBlob.get("players").isJsonArray()) {
            for (var el : nativeBlob.getAsJsonArray("players")) {
                if (!el.isJsonObject()) {
                    continue;
                }
                JsonObject p = el.getAsJsonObject();
                playersNow.add(p.deepCopy());
                if (p.has("name") && !p.get("name").isJsonNull()) {
                    names.add(p.get("name").getAsString());
                }
            }
            if (tps == null || !tps.has("players_online")) {
                online = playersNow.size();
            }
        }
        mc.addProperty("players_online_now", online);
        mc.add("players_online_names", names);
        if (!playersNow.isEmpty()) {
            optional.add("players_now", playersNow);
        }
    }

    private static void applyModsList(JsonObject optional, JsonObject nativeBlob, String serverDir,
                                      ReportConfig config) {
        JsonArray mods = new JsonArray();
        if (nativeBlob != null && nativeBlob.has("mods") && nativeBlob.get("mods").isJsonArray()) {
            List<JsonObject> sorted = new ArrayList<>();
            for (var el : nativeBlob.getAsJsonArray("mods")) {
                if (el.isJsonObject()) {
                    sorted.add(el.getAsJsonObject().deepCopy());
                }
            }
            sorted.sort((a, b) -> strId(a).compareTo(strId(b)));
            sorted.forEach(mods::add);
        } else {
            mods = ModJarMetadataReader.listModsFromDir(serverDir);
        }
        if (!mods.isEmpty()) {
            ModJarMetadataReader.enrichModArray(mods, serverDir);
            optional.add("mods", mods);
            ClientModDetector.apply(optional, config, serverDir);
        }
    }

    private static String strId(JsonObject mod) {
        return mod.has("id") ? mod.get("id").getAsString() : "";
    }
}
