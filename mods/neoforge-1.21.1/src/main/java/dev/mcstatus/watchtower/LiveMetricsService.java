package dev.mcstatus.watchtower;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import dev.mcstatus.watchtower.core.analyze.PerformanceInsightEngine;
import dev.mcstatus.watchtower.core.collect.DimensionStorageScanner;
import dev.mcstatus.watchtower.core.ops.OpsCacheWriter;
import dev.mcstatus.watchtower.core.collect.ExtrasCollector;
import dev.mcstatus.watchtower.core.collect.HostEnvironmentDetector;
import dev.mcstatus.watchtower.core.collect.HostMetricsCollector;
import dev.mcstatus.watchtower.core.collect.LivePregenTailer;
import dev.mcstatus.watchtower.core.collect.PerCoreCpuSampler;
import dev.mcstatus.watchtower.core.collect.ThermalCollector;
import dev.mcstatus.watchtower.core.live.PerformanceRollupAccumulator;
import dev.mcstatus.watchtower.core.live.PerformanceRollupWriter;
import dev.mcstatus.watchtower.core.live.LiveHistoryStore;
import dev.mcstatus.watchtower.core.panel.PanelInfo;
import dev.mcstatus.watchtower.core.panel.PanelResolver;
import dev.mcstatus.watchtower.core.report.ReportConfig;
import net.minecraft.server.MinecraftServer;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Per-server live metrics recording and history store.
 */
public final class LiveMetricsService {
    private static final LiveMetricsService INSTANCE = new LiveMetricsService();

    private LiveHistoryStore store = new LiveHistoryStore();
    private final PerformanceRollupWriter rollupWriter = new PerformanceRollupWriter();
    private final PerformanceRollupAccumulator rollupAccumulator = new PerformanceRollupAccumulator();
    private final PerCoreCpuSampler perCoreCpuSampler = new PerCoreCpuSampler();
    private MinecraftServer boundServer;
    private long lastEntityScanEpoch;
    private long lastStorageScanEpoch;
    private long lastPregenTailEpoch;
    private long lastThermalScanEpoch;
    private long lastBandwidthScanEpoch;
    private long lastDiskIoScanEpoch;
    private long lastPerCoreCpuScanEpoch;
    private long lastJavaRssScanEpoch;
    private long openRollupMinuteEpoch = -1;
    private double tpsWarn = 19.5;
    private boolean l1Enabled = true;
    private boolean dimensionStorageScan = true;
    private int rollupFlushCounter;
    private final AtomicReference<JsonObject> cachedBandwidth = new AtomicReference<>(new JsonObject());
    private final AtomicReference<JsonObject> cachedDiskIo = new AtomicReference<>(new JsonObject());
    private final AtomicReference<JsonObject> cachedPerCoreCpu = new AtomicReference<>(new JsonObject());
    private volatile Double cachedJavaRssGb;
    private volatile long prevRxBytes = -1;
    private volatile long prevTxBytes = -1;
    private volatile long prevBandwidthSampleEpoch;
    private volatile long prevReadBytes = -1;
    private volatile long prevWriteBytes = -1;
    private volatile long prevDiskIoSampleEpoch;
    private final LivePregenTailer pregenTailer = new LivePregenTailer();
    private long entities = -1;
    private long chunks = -1;
    private final AtomicReference<JsonObject> cachedStorage = new AtomicReference<>(new JsonObject());
    private final AtomicReference<JsonObject> cachedThermal = new AtomicReference<>(new JsonObject());
    private volatile String cachedPanelId = "unknown";
    private volatile JsonObject cachedHostEnvironment;
    private volatile boolean storageScanRunning;

    private LiveMetricsService() {
    }

    public static LiveMetricsService get() {
        return INSTANCE;
    }

    public LiveHistoryStore store() {
        return store;
    }

    public PerformanceRollupWriter rollupWriter() {
        return rollupWriter;
    }

    public void bindServer(MinecraftServer server) {
        this.boundServer = server;
        Path path = WatchtowerPaths.liveHistoryPath(server);
        int sampleSec = configInt(1, () -> WatchtowerConfig.LIVE_SAMPLE_INTERVAL_SECONDS.get());
        int retention = configInt(2160, () -> WatchtowerConfig.LIVE_RETENTION_HOURS.get());
        int flushSec = configInt(30, () -> WatchtowerConfig.LIVE_FLUSH_INTERVAL_SECONDS.get());
        store.configure(sampleSec, retention, flushSec, path);
        ZonedDateTime started = ZonedDateTime.now(ZoneId.systemDefault());
        pregenTailer.reset(server.getServerDirectory(), started);
        lastPregenTailEpoch = 0;
        openRollupMinuteEpoch = -1;
        rollupAccumulator.reset();
        loadRollupConfig(server);
        try {
            Map<String, String> conf = WatchtowerConfWriter.readMap(WatchtowerPaths.confPath(server));
            PanelInfo panel = PanelResolver.resolve(conf, server.getServerDirectory());
            cachedPanelId = panel.panelId();
            cachedHostEnvironment = HostEnvironmentDetector.detect(cachedPanelId);
        } catch (Exception e) {
            cachedPanelId = "unknown";
            cachedHostEnvironment = HostEnvironmentDetector.detect("unknown");
        }
        try {
            store.loadFromDisk();
        } catch (Exception e) {
            WatchtowerMod.LOGGER.warn("Failed to load live history: {}", e.toString());
        }
        try {
            rollupWriter.loadFromDisk();
            maybeBackfillRollups(server);
        } catch (Exception e) {
            WatchtowerMod.LOGGER.warn("Failed to load performance rollups: {}", e.toString());
        }
        refreshHostEnvironment(server);
    }

    private void loadRollupConfig(MinecraftServer server) {
        try {
            ReportConfig config = ModReportConfig.forServer(server);
            tpsWarn = config.tpsWarn();
            l1Enabled = config.l1RollupEnabled();
            dimensionStorageScan = config.dimensionStorageScan();
            rollupWriter.configure(
                    WatchtowerPaths.performanceRollupsPath(server),
                    config.l1RetentionDays(),
                    l1Enabled);
        } catch (Exception e) {
            tpsWarn = 19.5;
            l1Enabled = true;
            dimensionStorageScan = true;
            rollupWriter.configure(WatchtowerPaths.performanceRollupsPath(server), 90, true);
        }
    }

    private void maybeBackfillRollups(MinecraftServer server) {
        if (!l1Enabled || !rollupWriter.isEmpty()) {
            return;
        }
        Path livePath = WatchtowerPaths.liveHistoryPath(server);
        if (!Files.isRegularFile(livePath)) {
            return;
        }
        try {
            String text = Files.readString(livePath, StandardCharsets.UTF_8);
            JsonObject liveHistory = JsonParser.parseString(text).getAsJsonObject();
            int added = rollupWriter.backfillFromLiveHistory(liveHistory, tpsWarn);
            if (added > 0) {
                rollupWriter.flushToDisk();
                WatchtowerMod.LOGGER.info("Backfilled {} minute rollups from live history", added);
            }
        } catch (Exception e) {
            WatchtowerMod.LOGGER.debug("L1 backfill skipped: {}", e.toString());
        }
    }

    private void refreshHostEnvironment(MinecraftServer server) {
        try {
            String serverDir = server.getServerDirectory().toAbsolutePath().toString();
            JsonObject sys = HostMetricsCollector.collectSystemBasics(serverDir);
            cachedHostEnvironment = HostEnvironmentDetector.detect(cachedPanelId, sys);
        } catch (Exception e) {
            cachedHostEnvironment = HostEnvironmentDetector.detect(cachedPanelId);
        }
    }

    public void unbindServer() {
        try {
            flushOpenRollupMinute(Instant.now().getEpochSecond());
            rollupWriter.flushToDisk();
        } catch (Exception e) {
            WatchtowerMod.LOGGER.debug("Performance rollup flush on stop: {}", e.toString());
        }
        try {
            store.flushToDisk();
        } catch (Exception e) {
            WatchtowerMod.LOGGER.debug("Live history flush on stop: {}", e.toString());
        }
        boundServer = null;
    }

    public JsonObject getLiveResponse() {
        JsonObject body = store.getLatestWithMeta();
        JsonObject dh = pregenTailer.getDhPregen();
        if (dh != null) {
            body.add("dh_pregen", dh);
        }
        JsonObject chunky = pregenTailer.getChunkyPregen();
        if (chunky != null) {
            body.add("chunky_pregen", chunky);
        }
        if (cachedHostEnvironment != null) {
            body.add("host_environment", cachedHostEnvironment.deepCopy());
        }
        JsonObject storage = cachedStorage.get();
        if (storage != null && !storage.entrySet().isEmpty()) {
            body.add("storage", storage.deepCopy());
        }
        JsonObject thermal = cachedThermal.get();
        if (thermal != null && !thermal.entrySet().isEmpty()) {
            body.add("thermal", thermal.deepCopy());
        }
        JsonObject bandwidth = cachedBandwidth.get();
        if (bandwidth != null && bandwidth.has("interface")) {
            body.add("bandwidth", bandwidth.deepCopy());
        }
        JsonObject diskIo = cachedDiskIo.get();
        if (diskIo != null && diskIo.has("device")) {
            body.add("disk_io", diskIo.deepCopy());
        }
        JsonObject perCore = cachedPerCoreCpu.get();
        if (perCore != null && perCore.has("cores")) {
            body.add("cpu_cores", perCore.getAsJsonArray("cores").deepCopy());
            if (perCore.has("cpu_count")) {
                body.addProperty("cpu_count", perCore.get("cpu_count").getAsInt());
            }
        }
        if (cachedJavaRssGb != null) {
            body.addProperty("java_rss_gb", cachedJavaRssGb);
        }
        return body;
    }

    public void recordTick(MinecraftServer server) {
        long now = Instant.now().getEpochSecond();
        refreshSlowMetrics(server, now);

        JsonObject snap = buildFastSnapshot(server, now);
        store.append(snap);
        recordRollupSample(snap, now);
        if (snap.has("tps") && snap.has("mspt")) {
            LagSpikeDetector.onLiveSample(server, snap.get("tps").getAsDouble(), snap.get("mspt").getAsDouble());
        }
    }

    private void recordRollupSample(JsonObject snap, long now) {
        if (!l1Enabled) {
            return;
        }
        long minute = now - (now % 60);
        if (openRollupMinuteEpoch >= 0 && minute > openRollupMinuteEpoch) {
            flushOpenRollupMinute(openRollupMinuteEpoch);
            openRollupMinuteEpoch = minute;
        } else if (openRollupMinuteEpoch < 0) {
            openRollupMinuteEpoch = minute;
        }

        Double tps = snap.has("tps") && !snap.get("tps").isJsonNull() ? snap.get("tps").getAsDouble() : null;
        Double mspt = snap.has("mspt") && !snap.get("mspt").isJsonNull() ? snap.get("mspt").getAsDouble() : null;
        int players = snap.has("players_online") ? snap.get("players_online").getAsInt() : 0;
        Double heapGb = null;
        if (snap.has("heap_mb") && snap.get("heap_mb").isJsonObject()) {
            JsonObject heap = snap.getAsJsonObject("heap_mb");
            if (heap.has("used")) {
                heapGb = heap.get("used").getAsDouble() / 1024.0;
            }
        }
        Double memUsed = snap.has("mem_used_gb") && !snap.get("mem_used_gb").isJsonNull()
                ? snap.get("mem_used_gb").getAsDouble() : null;
        Double cpu = snap.has("host_cpu_pct") && !snap.get("host_cpu_pct").isJsonNull()
                ? snap.get("host_cpu_pct").getAsDouble() : null;
        rollupAccumulator.addSample(tps, mspt, players, heapGb, memUsed, cpu, tpsWarn);
    }

    private void flushOpenRollupMinute(long minuteEpoch) {
        if (!l1Enabled || rollupAccumulator.isEmpty()) {
            rollupAccumulator.reset();
            return;
        }
        rollupWriter.appendRow(rollupAccumulator.finalizeRow(minuteEpoch));
        rollupAccumulator.reset();
        rollupFlushCounter++;
        if (rollupFlushCounter >= 5) {
            rollupFlushCounter = 0;
            try {
                rollupWriter.flushToDisk();
                maybeRecordStickyLagEpisodes();
            } catch (Exception e) {
                WatchtowerMod.LOGGER.debug("Performance rollup periodic flush failed: {}", e.toString());
            }
        }
    }

    private void maybeRecordStickyLagEpisodes() {
        MinecraftServer server = boundServer;
        if (server == null || !l1Enabled) {
            return;
        }
        try {
            ReportConfig config = ModReportConfig.forServer(server);
            Path rollupsPath = WatchtowerPaths.performanceRollupsPath(server);
            List<com.google.gson.JsonObject> rows = PerformanceRollupWriter.loadRowsFromFile(rollupsPath, 24);
            if (rows.isEmpty()) {
                rows = rollupWriter.loadRowsForHours(24);
            }
            JsonObject insights = PerformanceInsightEngine.analyze(
                    rows, "7d", config.msptWarn(), config.tpsWarn());
            if (insights.has("sticky_lag")) {
                OpsCacheWriter.applyPerformanceSpikeEvents(
                        WatchtowerPaths.opsCachePath(server),
                        WatchtowerPaths.statePath(server),
                        insights.getAsJsonArray("sticky_lag"));
            }
        } catch (Exception e) {
            WatchtowerMod.LOGGER.debug("Sticky lag activity hook failed: {}", e.toString());
        }
    }

    private void refreshSlowMetrics(MinecraftServer server, long now) {
        int entityInterval = configInt(30, () -> WatchtowerConfig.LIVE_COUNT_ENTITIES_INTERVAL_SECONDS.get());
        if (now - lastEntityScanEpoch >= entityInterval && WatchtowerConfig.COUNT_ENTITIES.get()) {
            lastEntityScanEpoch = now;
            try {
                WatchtowerSampler.Sample sample = WatchtowerSampler.collect(server);
                entities = sample.entities();
                chunks = sample.chunks();
            } catch (Exception e) {
                WatchtowerMod.LOGGER.debug("Live entity scan failed: {}", e.toString());
            }
        }

        int storageInterval = configInt(300, () -> WatchtowerConfig.LIVE_STORAGE_INTERVAL_SECONDS.get());
        if (now - lastStorageScanEpoch >= storageInterval && !storageScanRunning) {
            lastStorageScanEpoch = now;
            storageScanRunning = true;
            String serverDir = server.getServerDirectory().toAbsolutePath().toString();
            boolean dimScan = dimensionStorageScan;
            Thread.ofVirtual().name("watchtower-live-storage").start(() -> {
                try {
                    JsonObject storage = dimScan
                            ? DimensionStorageScanner.scan(serverDir, true)
                            : ExtrasCollector.collectStorage(serverDir);
                    cachedStorage.set(storage);
                } catch (Exception e) {
                    WatchtowerMod.LOGGER.debug("Live storage scan failed: {}", e.toString());
                } finally {
                    storageScanRunning = false;
                }
            });
        }

        int pregenInterval = configInt(5, () -> WatchtowerConfig.LIVE_PREGEN_TAIL_INTERVAL_SECONDS.get());
        if (now - lastPregenTailEpoch >= pregenInterval) {
            lastPregenTailEpoch = now;
            try {
                pregenTailer.tail();
            } catch (Exception e) {
                WatchtowerMod.LOGGER.debug("Live pregen tail failed: {}", e.toString());
            }
        }

        if (now - lastThermalScanEpoch >= 60) {
            lastThermalScanEpoch = now;
            try {
                cachedThermal.set(ThermalCollector.collect());
            } catch (Exception e) {
                WatchtowerMod.LOGGER.debug("Live thermal scan failed: {}", e.toString());
            }
        }

        if (now - lastPerCoreCpuScanEpoch >= 30) {
            lastPerCoreCpuScanEpoch = now;
            try {
                JsonObject cores = perCoreCpuSampler.sample();
                if (cores != null) {
                    cachedPerCoreCpu.set(cores);
                }
            } catch (Exception e) {
                WatchtowerMod.LOGGER.debug("Per-core CPU sample failed: {}", e.toString());
            }
        }

        if (now - lastJavaRssScanEpoch >= 60) {
            lastJavaRssScanEpoch = now;
            try {
                ReportConfig cfg = ReportConfig.builder()
                        .serverDir(server.getServerDirectory().toAbsolutePath().toString())
                        .build();
                JsonObject javaInfo = HostMetricsCollector.javaProcessInfo(cfg);
                if (javaInfo.has("java_rss_gb")) {
                    cachedJavaRssGb = javaInfo.get("java_rss_gb").getAsDouble();
                }
            } catch (Exception e) {
                WatchtowerMod.LOGGER.debug("Java RSS sample failed: {}", e.toString());
            }
        }

        if (now - lastBandwidthScanEpoch >= 30) {
            lastBandwidthScanEpoch = now;
            try {
                JsonObject net = ExtrasCollector.readProcNetDev();
                if (net != null) {
                    long rx = net.get("rx_bytes").getAsLong();
                    long tx = net.get("tx_bytes").getAsLong();
                    if (prevRxBytes >= 0 && prevBandwidthSampleEpoch > 0) {
                        long dt = Math.max(1, now - prevBandwidthSampleEpoch);
                        double rxMbps = (rx - prevRxBytes) * 8.0 / dt / 1_000_000.0;
                        double txMbps = (tx - prevTxBytes) * 8.0 / dt / 1_000_000.0;
                        net.addProperty("rx_mbps", round2(rxMbps));
                        net.addProperty("tx_mbps", round2(txMbps));
                        net.addProperty("rx_mb_since_sample", round1((rx - prevRxBytes) / (1024.0 * 1024.0)));
                        net.addProperty("tx_mb_since_sample", round1((tx - prevTxBytes) / (1024.0 * 1024.0)));
                        net.addProperty("sample_age_sec", dt);
                        store.appendIoMetrics(now, rxMbps, txMbps, null, null);
                    }
                    prevRxBytes = rx;
                    prevTxBytes = tx;
                    prevBandwidthSampleEpoch = now;
                    cachedBandwidth.set(net);
                }
            } catch (Exception e) {
                WatchtowerMod.LOGGER.debug("Live bandwidth scan failed: {}", e.toString());
            }
        }

        if (now - lastDiskIoScanEpoch >= 30) {
            lastDiskIoScanEpoch = now;
            try {
                String serverDir = server.getServerDirectory().toAbsolutePath().toString();
                JsonObject disk = ExtrasCollector.readServerDiskIo(serverDir);
                if (disk != null && disk.has("read_bytes")) {
                    long read = disk.get("read_bytes").getAsLong();
                    long write = disk.get("write_bytes").getAsLong();
                    if (prevReadBytes >= 0 && prevDiskIoSampleEpoch > 0) {
                        long dt = Math.max(1, now - prevDiskIoSampleEpoch);
                        double readMbS = (read - prevReadBytes) / (1024.0 * 1024.0) / dt;
                        double writeMbS = (write - prevWriteBytes) / (1024.0 * 1024.0) / dt;
                        readMbS = round2(Math.max(0, readMbS));
                        writeMbS = round2(Math.max(0, writeMbS));
                        disk.addProperty("read_mb_s", readMbS);
                        disk.addProperty("write_mb_s", writeMbS);
                        disk.addProperty("sample_age_sec", dt);
                        store.appendIoMetrics(now, null, null, readMbS, writeMbS);
                    }
                    prevReadBytes = read;
                    prevWriteBytes = write;
                    prevDiskIoSampleEpoch = now;
                    cachedDiskIo.set(disk);
                }
            } catch (Exception e) {
                WatchtowerMod.LOGGER.debug("Live disk I/O scan failed: {}", e.toString());
            }
        }
    }

    private JsonObject buildFastSnapshot(MinecraftServer server, long now) {
        JsonObject o = new JsonObject();
        o.addProperty("polled_at", Instant.now().toString());
        o.addProperty("source", "watchtower");

        double mspt = TickMetrics.smoothedMspt();
        double tps = Math.min(20.0, 1000.0 / Math.max(mspt, 0.001));
        o.addProperty("tps", round2(tps));
        o.addProperty("mspt", round1(mspt));
        o.addProperty("players_online", server.getPlayerCount());

        WatchtowerSampler.HeapMb heap = WatchtowerSampler.sampleHeapOnly();
        if (heap != null) {
            JsonObject heapMb = new JsonObject();
            heapMb.addProperty("used", heap.used());
            heapMb.addProperty("max", heap.max());
            o.add("heap_mb", heapMb);
        }

        Double hostCpu = HostCpuProbe.readHostCpuPct();
        if (hostCpu != null) {
            o.addProperty("host_cpu_pct", round1(hostCpu));
        }

        String serverDir = server.getServerDirectory().toAbsolutePath().toString();
        JsonObject sys = HostMetricsCollector.collectSystemBasics(serverDir);
        copySystemFields(o, sys);
        String javaVersion = System.getProperty("java.version");
        if (javaVersion != null && !javaVersion.isBlank()) {
            o.addProperty("java_version", javaVersion);
        }
        if (cachedJavaRssGb != null) {
            o.addProperty("java_rss_gb", cachedJavaRssGb);
        }
        JsonObject metricStates = new JsonObject();
        if (sys.has("disk_available") && !sys.get("disk_available").getAsBoolean()) {
            JsonObject diskState = new JsonObject();
            diskState.addProperty("status", "unavailable");
            diskState.addProperty("reason", "could_not_read_filesystem");
            metricStates.add("disk_use_pct", diskState);
        }
        if (!metricStates.entrySet().isEmpty()) {
            o.add("metric_states", metricStates);
        }

        if (entities >= 0) {
            o.addProperty("entities", entities);
            o.addProperty("entities_age_sec", Math.max(0, now - lastEntityScanEpoch));
        }
        if (chunks >= 0) {
            o.addProperty("chunks", chunks);
        }

        JsonObject storage = cachedStorage.get();
        if (storage.has("world_gb")) {
            o.add("world_gb", storage.get("world_gb"));
        }
        if (storage.has("server_dir_gb")) {
            o.add("server_dir_gb", storage.get("server_dir_gb"));
        }
        if (storage.has("by_dimension")) {
            o.add("by_dimension", storage.getAsJsonArray("by_dimension").deepCopy());
        }
        if (lastStorageScanEpoch > 0) {
            o.addProperty("storage_age_sec", Math.max(0, now - lastStorageScanEpoch));
        }

        return o;
    }

    private static void copySystemFields(JsonObject target, JsonObject sys) {
        for (String key : List.of(
                "mem_available_gb", "disk_use_pct", "disk_free_gb", "disk_total_gb", "disk_available",
                "load_avg", "cpu_count", "load_1m_per_core", "mem_used_gb", "mem_total_gb",
                "cpu_limit_cores", "ram_source", "cpu_source", "java_uptime_sec", "java_xmx_gb")) {
            if (sys.has(key) && !sys.get(key).isJsonNull()) {
                target.add(key, sys.get(key));
            }
        }
    }

    private static int configInt(int fallback, java.util.function.Supplier<Integer> supplier) {
        try {
            return supplier.get();
        } catch (IllegalStateException e) {
            return fallback;
        }
    }

    private static double round1(double v) {
        return Math.round(v * 10.0) / 10.0;
    }

    private static double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }
}
