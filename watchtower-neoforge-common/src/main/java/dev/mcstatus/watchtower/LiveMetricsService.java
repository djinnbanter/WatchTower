package dev.mcstatus.watchtower;

import dev.mcstatus.watchtower.runtime.ModRuntime;

import dev.mcstatus.watchtower.runtime.ServerContext;
import dev.mcstatus.watchtower.runtime.WatchtowerSample;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import dev.mcstatus.watchtower.core.analyze.GcAdvisor;
import dev.mcstatus.watchtower.core.analyze.PerformanceInsightEngine;
import dev.mcstatus.watchtower.core.collect.DimensionStorageScanner;
import dev.mcstatus.watchtower.core.ops.OpsCacheWriter;
import dev.mcstatus.watchtower.core.collect.ExtrasCollector;
import dev.mcstatus.watchtower.core.collect.HostEnvironmentDetector;
import dev.mcstatus.watchtower.core.collect.HostMetricsCollector;
import dev.mcstatus.watchtower.core.collect.JvmHealthCollector;
import dev.mcstatus.watchtower.core.collect.LivePregenTailer;
import dev.mcstatus.watchtower.core.collect.PerCoreCpuSampler;
import dev.mcstatus.watchtower.core.collect.ThermalCollector;
import dev.mcstatus.watchtower.core.live.PerformanceRollupAccumulator;
import dev.mcstatus.watchtower.core.live.PerformanceRollupWriter;
import dev.mcstatus.watchtower.core.live.LiveHistoryStore;
import dev.mcstatus.watchtower.core.panel.PanelInfo;
import dev.mcstatus.watchtower.core.panel.PanelResolver;
import dev.mcstatus.watchtower.core.report.ReportConfig;

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
    private ServerContext boundServer;
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
    private volatile long prevWritesCompleted = -1;
    private volatile long prevTimeWritingMs = -1;
    private volatile long prevDiskIoSampleEpoch;
    private volatile long lastIoProbeEpoch;
    private boolean diskIoProbeEnabled = true;
    private final LivePregenTailer pregenTailer = new LivePregenTailer();
    private long entities = -1;
    private long chunks = -1;
    private final AtomicReference<JsonObject> cachedStorage = new AtomicReference<>(new JsonObject());
    private final AtomicReference<JsonObject> cachedThermal = new AtomicReference<>(new JsonObject());
    private volatile String cachedPanelId = "unknown";
    private volatile JsonObject cachedHostEnvironment;
    private volatile boolean storageScanRunning;
    private volatile boolean thermalScanRunning;

    /** Host thermal poll interval (seconds). Faster than the old 60s so Live temp charts move. */
    private static final int THERMAL_SCAN_INTERVAL_SEC = 15;

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

    public void bindServer(ServerContext server) {
        this.boundServer = server;
        Path path = WatchtowerPaths.liveHistoryPath(server);
        int sampleSec = configInt(1, () -> ModRuntime.config().liveSampleIntervalSeconds());
        int retention = configInt(2160, () -> ModRuntime.config().liveRetentionHours());
        int flushSec = configInt(30, () -> ModRuntime.config().liveFlushIntervalSeconds());
        store.configure(sampleSec, retention, flushSec, path);
        ZonedDateTime started = ZonedDateTime.now(ZoneId.systemDefault());
        pregenTailer.reset(server.serverDirectory(), started);
        lastPregenTailEpoch = 0;
        openRollupMinuteEpoch = -1;
        rollupAccumulator.reset();
        loadRollupConfig(server);
        try {
            Map<String, String> conf = WatchtowerConfWriter.readMap(WatchtowerPaths.confPath(server));
            PanelInfo panel = PanelResolver.resolve(conf, server.serverDirectory());
            cachedPanelId = panel.panelId();
            cachedHostEnvironment = HostEnvironmentDetector.detect(cachedPanelId);
        } catch (Exception e) {
            cachedPanelId = "unknown";
            cachedHostEnvironment = HostEnvironmentDetector.detect("unknown");
        }
        try {
            store.loadFromDisk();
        } catch (Exception e) {
            ModRuntime.logger().warn("Failed to load live history: {}", e.toString());
        }
        try {
            rollupWriter.loadFromDisk();
            maybeBackfillRollups(server);
        } catch (Exception e) {
            ModRuntime.logger().warn("Failed to load performance rollups: {}", e.toString());
        }
        refreshHostEnvironment(server);
    }

    private void loadRollupConfig(ServerContext server) {
        try {
            ReportConfig config = ModReportConfig.forServer(server);
            tpsWarn = config.tpsWarn();
            l1Enabled = config.l1RollupEnabled();
            dimensionStorageScan = config.dimensionStorageScan();
            diskIoProbeEnabled = config.diskIoProbeEnabled();
            rollupWriter.configure(
                    WatchtowerPaths.performanceRollupsPath(server),
                    config.l1RetentionDays(),
                    l1Enabled);
        } catch (Exception e) {
            tpsWarn = 19.5;
            l1Enabled = true;
            dimensionStorageScan = true;
            diskIoProbeEnabled = true;
            rollupWriter.configure(WatchtowerPaths.performanceRollupsPath(server), 90, true);
        }
    }

    private void maybeBackfillRollups(ServerContext server) {
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
                ModRuntime.logger().info("Backfilled {} minute rollups from live history", added);
            }
        } catch (Exception e) {
            ModRuntime.logger().debug("L1 backfill skipped: {}", e.toString());
        }
    }

    private void refreshHostEnvironment(ServerContext server) {
        try {
            String serverDir = server.serverDirectory().toAbsolutePath().toString();
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
            ModRuntime.logger().debug("Performance rollup flush on stop: {}", e.toString());
        }
        try {
            store.flushToDisk();
        } catch (Exception e) {
            ModRuntime.logger().debug("Live history flush on stop: {}", e.toString());
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

    public void recordTick(ServerContext server) {
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
        Double heapPressurePct = null;
        if (snap.has("heap_mb") && snap.get("heap_mb").isJsonObject()) {
            JsonObject heap = snap.getAsJsonObject("heap_mb");
            if (heap.has("used")) {
                heapGb = heap.get("used").getAsDouble() / 1024.0;
            }
            if (heap.has("pressure_pct") && !heap.get("pressure_pct").isJsonNull()) {
                heapPressurePct = heap.get("pressure_pct").getAsDouble();
            }
        }
        Double memUsed = snap.has("mem_used_gb") && !snap.get("mem_used_gb").isJsonNull()
                ? snap.get("mem_used_gb").getAsDouble() : null;
        Double cpu = snap.has("host_cpu_pct") && !snap.get("host_cpu_pct").isJsonNull()
                ? snap.get("host_cpu_pct").getAsDouble() : null;
        Double gcPausePct = null;
        if (snap.has("jvm_gc") && snap.get("jvm_gc").isJsonObject()) {
            JsonObject gc = snap.getAsJsonObject("jvm_gc");
            if (gc.has("pause_pct_of_wall") && !gc.get("pause_pct_of_wall").isJsonNull()) {
                gcPausePct = gc.get("pause_pct_of_wall").getAsDouble();
            }
        }
        Double diskUse = snap.has("disk_use_pct") && !snap.get("disk_use_pct").isJsonNull()
                ? snap.get("disk_use_pct").getAsDouble() : null;
        Double diskFree = snap.has("disk_free_gb") && !snap.get("disk_free_gb").isJsonNull()
                ? snap.get("disk_free_gb").getAsDouble() : null;
        Double diskWriteMbS = snap.has("disk_write_mb_s") && !snap.get("disk_write_mb_s").isJsonNull()
                ? snap.get("disk_write_mb_s").getAsDouble() : null;
        Double diskWriteAwait = snap.has("disk_write_await_ms") && !snap.get("disk_write_await_ms").isJsonNull()
                ? snap.get("disk_write_await_ms").getAsDouble() : null;
        if (diskWriteMbS == null || diskWriteAwait == null) {
            JsonObject diskIo = cachedDiskIo.get();
            if (diskIo != null) {
                if (diskWriteMbS == null && diskIo.has("write_mb_s") && !diskIo.get("write_mb_s").isJsonNull()) {
                    diskWriteMbS = diskIo.get("write_mb_s").getAsDouble();
                }
                if (diskWriteAwait == null && diskIo.has("write_await_ms") && !diskIo.get("write_await_ms").isJsonNull()) {
                    diskWriteAwait = diskIo.get("write_await_ms").getAsDouble();
                }
            }
        }
        rollupAccumulator.addSample(tps, mspt, players, heapGb, memUsed, cpu, tpsWarn,
                heapPressurePct, gcPausePct, diskUse, diskFree, diskWriteMbS, diskWriteAwait);
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
                ModRuntime.logger().debug("Performance rollup periodic flush failed: {}", e.toString());
            }
        }
    }

    private void maybeRecordStickyLagEpisodes() {
        ServerContext server = boundServer;
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
            ModRuntime.logger().debug("Sticky lag activity hook failed: {}", e.toString());
        }
    }

    private void refreshSlowMetrics(ServerContext server, long now) {
        int entityInterval = configInt(30, () -> ModRuntime.config().liveCountEntitiesIntervalSeconds());
        if (now - lastEntityScanEpoch >= entityInterval && ModRuntime.config().countEntities()) {
            lastEntityScanEpoch = now;
            try {
                WatchtowerSample.Sample sample = server.collectSample();
                entities = sample.entities();
                chunks = sample.chunks();
            } catch (Exception e) {
                ModRuntime.logger().debug("Live entity scan failed: {}", e.toString());
            }
        }

        int storageInterval = configInt(300, () -> ModRuntime.config().liveStorageIntervalSeconds());
        if (now - lastStorageScanEpoch >= storageInterval && !storageScanRunning) {
            lastStorageScanEpoch = now;
            storageScanRunning = true;
            String serverDir = server.serverDirectory().toAbsolutePath().toString();
            boolean dimScan = dimensionStorageScan;
            Thread.ofVirtual().name("watchtower-live-storage").start(() -> {
                try {
                    JsonObject storage = dimScan
                            ? DimensionStorageScanner.scan(serverDir, true)
                            : ExtrasCollector.collectStorage(serverDir);
                    cachedStorage.set(storage);
                } catch (Exception e) {
                    ModRuntime.logger().debug("Live storage scan failed: {}", e.toString());
                } finally {
                    storageScanRunning = false;
                }
            });
        }

        int pregenInterval = configInt(5, () -> ModRuntime.config().livePregenTailIntervalSeconds());
        if (now - lastPregenTailEpoch >= pregenInterval) {
            lastPregenTailEpoch = now;
            try {
                pregenTailer.tail();
            } catch (Exception e) {
                ModRuntime.logger().debug("Live pregen tail failed: {}", e.toString());
            }
        }

        if (now - lastThermalScanEpoch >= THERMAL_SCAN_INTERVAL_SEC && !thermalScanRunning) {
            lastThermalScanEpoch = now;
            thermalScanRunning = true;
            // lm-sensors can block briefly — keep it off the live tick thread.
            Thread.ofVirtual().name("watchtower-live-thermal").start(() -> {
                try {
                    JsonObject thermal = ThermalCollector.collect();
                    cachedThermal.set(thermal);
                    Double packageC = thermal.has("package_c") && !thermal.get("package_c").isJsonNull()
                            ? thermal.get("package_c").getAsDouble() : null;
                    Double ambientC = thermal.has("ambient_c") && !thermal.get("ambient_c").isJsonNull()
                            ? thermal.get("ambient_c").getAsDouble() : null;
                    if (packageC != null || ambientC != null) {
                        store.appendThermal(now, packageC, ambientC);
                    }
                } catch (Exception e) {
                    ModRuntime.logger().debug("Live thermal scan failed: {}", e.toString());
                } finally {
                    thermalScanRunning = false;
                }
            });
        }

        if (now - lastPerCoreCpuScanEpoch >= 30) {
            lastPerCoreCpuScanEpoch = now;
            try {
                JsonObject cores = perCoreCpuSampler.sample();
                if (cores != null) {
                    cachedPerCoreCpu.set(cores);
                }
            } catch (Exception e) {
                ModRuntime.logger().debug("Per-core CPU sample failed: {}", e.toString());
            }
        }

        if (now - lastJavaRssScanEpoch >= 60) {
            lastJavaRssScanEpoch = now;
            try {
                ReportConfig cfg = ReportConfig.builder()
                        .serverDir(server.serverDirectory().toAbsolutePath().toString())
                        .build();
                JsonObject javaInfo = HostMetricsCollector.javaProcessInfo(cfg);
                if (javaInfo.has("java_rss_gb")) {
                    cachedJavaRssGb = javaInfo.get("java_rss_gb").getAsDouble();
                }
            } catch (Exception e) {
                ModRuntime.logger().debug("Java RSS sample failed: {}", e.toString());
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
                ModRuntime.logger().debug("Live bandwidth scan failed: {}", e.toString());
            }
        }

        if (now - lastDiskIoScanEpoch >= 30) {
            lastDiskIoScanEpoch = now;
            try {
                String serverDir = server.serverDirectory().toAbsolutePath().toString();
                JsonObject disk = ExtrasCollector.readServerDiskIo(serverDir);
                if (disk != null && disk.has("read_bytes")) {
                    long read = disk.get("read_bytes").getAsLong();
                    long write = disk.get("write_bytes").getAsLong();
                    long writesCompleted = disk.has("writes_completed")
                            ? disk.get("writes_completed").getAsLong() : -1;
                    long timeWritingMs = disk.has("time_writing_ms")
                            ? disk.get("time_writing_ms").getAsLong() : -1;
                    boolean awaitSet = false;
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

                        if (writesCompleted >= 0 && timeWritingMs >= 0
                                && prevWritesCompleted >= 0 && prevTimeWritingMs >= 0) {
                            long dWrites = writesCompleted - prevWritesCompleted;
                            long dTime = timeWritingMs - prevTimeWritingMs;
                            if (dWrites > 0 && dTime >= 0) {
                                double awaitMs = (double) dTime / (double) dWrites;
                                disk.addProperty("write_await_ms", round1(awaitMs));
                                disk.addProperty("latency_source", "diskstats");
                                awaitSet = true;
                            }
                        }
                    }
                    prevReadBytes = read;
                    prevWriteBytes = write;
                    if (writesCompleted >= 0) {
                        prevWritesCompleted = writesCompleted;
                    }
                    if (timeWritingMs >= 0) {
                        prevTimeWritingMs = timeWritingMs;
                    }
                    prevDiskIoSampleEpoch = now;

                    if (!awaitSet) {
                        maybeApplyLatencyProbe(serverDir, disk, now);
                    }
                    cachedDiskIo.set(disk);
                } else {
                    JsonObject fallback = new JsonObject();
                    maybeApplyLatencyProbe(serverDir, fallback, now);
                    if (fallback.has("write_await_ms") || fallback.has("latency_source")) {
                        cachedDiskIo.set(fallback);
                    }
                }
            } catch (Exception e) {
                ModRuntime.logger().debug("Live disk I/O scan failed: {}", e.toString());
            }
        }
    }

    private void maybeApplyLatencyProbe(String serverDir, JsonObject disk, long now) {
        if (ExtrasCollector.isNetworkFilesystem(serverDir)) {
            disk.addProperty("latency_source", "unavailable");
            disk.addProperty("latency_unavailable_reason", "network_mount");
            return;
        }
        if (!diskIoProbeEnabled) {
            if (!disk.has("latency_source")) {
                disk.addProperty("latency_source", "unavailable");
            }
            return;
        }
        if (now - lastIoProbeEpoch < 60) {
            JsonObject prev = cachedDiskIo.get();
            if (prev != null && prev.has("write_await_ms")
                    && "fsync_probe".equals(prev.has("latency_source")
                    ? prev.get("latency_source").getAsString() : "")) {
                disk.addProperty("write_await_ms", prev.get("write_await_ms").getAsDouble());
                disk.addProperty("latency_source", "fsync_probe");
            } else if (!disk.has("latency_source")) {
                disk.addProperty("latency_source", "unavailable");
            }
            return;
        }
        lastIoProbeEpoch = now;
        JsonObject probe = ExtrasCollector.probeWriteLatency(serverDir);
        if (probe != null && probe.has("write_latency_ms")) {
            disk.addProperty("write_await_ms", probe.get("write_latency_ms").getAsDouble());
            disk.addProperty("latency_source", "fsync_probe");
        } else if (!disk.has("latency_source")) {
            disk.addProperty("latency_source", "unavailable");
        }
    }

    private JsonObject buildFastSnapshot(ServerContext server, long now) {
        JsonObject o = new JsonObject();
        o.addProperty("polled_at", Instant.now().toString());
        o.addProperty("source", "watchtower");

        double mspt = server.smoothedMspt();
        double tps = Math.min(20.0, 1000.0 / Math.max(mspt, 0.001));
        o.addProperty("tps", round2(tps));
        o.addProperty("mspt", round1(mspt));
        o.addProperty("players_online", server.playerCount());

        WatchtowerSample.HeapMb heap = WatchtowerSample.sampleHeapOnly();
        Double xmxHint = null;
        if (heap != null) {
            JsonObject heapMb = new JsonObject();
            heapMb.addProperty("used", heap.used());
            heapMb.addProperty("max", heap.max());
            if (heap.max() > 0) {
                double pressure = Math.min(100.0, (heap.used() * 100.0) / heap.max());
                heapMb.addProperty("pressure_pct", round1(pressure));
            }
            o.add("heap_mb", heapMb);
            if (heap.max() > 0) {
                xmxHint = heap.max() / 1024.0;
            }
        }

        try {
            JsonObject jvmSample = JvmHealthCollector.sampleLive(xmxHint);
            if (jvmSample.has("jvm_gc")) {
                o.add("jvm_gc", jvmSample.get("jvm_gc"));
            }
            // Prefer MemoryMXBean pressure when available.
            if (jvmSample.has("heap") && jvmSample.get("heap").isJsonObject()) {
                JsonObject h = jvmSample.getAsJsonObject("heap");
                if (o.has("heap_mb") && h.has("pressure_pct")) {
                    o.getAsJsonObject("heap_mb").addProperty("pressure_pct", h.get("pressure_pct").getAsDouble());
                }
                if (h.has("max_mb") && h.get("max_mb").getAsDouble() > 0) {
                    xmxHint = h.get("max_mb").getAsDouble() / 1024.0;
                }
            }
            JsonObject advisorIn = new JsonObject();
            if (jvmSample.has("java_major")) {
                advisorIn.add("java_major", jvmSample.get("java_major"));
            }
            if (jvmSample.has("flags") && jvmSample.get("flags").isJsonObject()) {
                JsonObject flags = jvmSample.getAsJsonObject("flags");
                if (flags.has("flags_profile")) {
                    advisorIn.add("flags_profile", flags.get("flags_profile"));
                }
                if (flags.has("xms_equals_xmx")) {
                    advisorIn.add("xms_equals_xmx", flags.get("xms_equals_xmx"));
                }
                if (flags.has("large_heap_overrides_ok")) {
                    advisorIn.add("large_heap_overrides_ok", flags.get("large_heap_overrides_ok"));
                }
                if (flags.has("xmx_gb")) {
                    advisorIn.add("xmx_gb", flags.get("xmx_gb"));
                } else if (xmxHint != null) {
                    advisorIn.addProperty("xmx_gb", round2(xmxHint));
                }
                if (flags.has("missing_flags")) {
                    advisorIn.add("missing_flags", flags.get("missing_flags").deepCopy());
                }
                if (flags.has("flags_coverage")) {
                    advisorIn.add("flags_coverage", flags.get("flags_coverage").deepCopy());
                }
            }
            if (o.has("heap_mb") && o.getAsJsonObject("heap_mb").has("pressure_pct")) {
                advisorIn.add("heap_pressure_pct", o.getAsJsonObject("heap_mb").get("pressure_pct"));
            }
            if (o.has("jvm_gc") && o.getAsJsonObject("jvm_gc").has("pause_pct_of_wall")) {
                advisorIn.add("gc_pause_pct_of_wall", o.getAsJsonObject("jvm_gc").get("pause_pct_of_wall"));
            }
            if (o.has("jvm_gc") && o.getAsJsonObject("jvm_gc").has("pause_source")) {
                advisorIn.add("pause_source", o.getAsJsonObject("jvm_gc").get("pause_source"));
            }
            advisorIn.addProperty("mspt", mspt);
            if (o.has("cpu_count") && !o.get("cpu_count").isJsonNull()) {
                advisorIn.add("cpu_count", o.get("cpu_count"));
            }
            if (server != null) {
                String mcVer = server.minecraftVersion();
                if (mcVer != null && !mcVer.isBlank()) {
                    advisorIn.addProperty("mc_version", mcVer);
                }
            }
            advisorIn.addProperty("loader", "neoforge");
            // Same payload shape as report optional.jvm_health (avoid live/report drift).
            JsonObject liveHealth = GcAdvisor.buildJvmHealth(jvmSample, advisorIn);
            o.add("jvm_health_live", liveHealth);
            if (o.has("jvm_gc") && jvmSample.getAsJsonObject("jvm_gc").has("pause_pct_of_wall")) {
                o.addProperty("gc_pause_pct",
                        jvmSample.getAsJsonObject("jvm_gc").get("pause_pct_of_wall").getAsDouble());
            }
        } catch (Exception e) {
            ModRuntime.logger().debug("Live JVM health sample failed: {}", e.toString());
        }

        Double hostCpu = HostCpuProbe.readHostCpuPct();
        if (hostCpu != null) {
            o.addProperty("host_cpu_pct", round1(hostCpu));
        }

        String serverDir = server.serverDirectory().toAbsolutePath().toString();
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
