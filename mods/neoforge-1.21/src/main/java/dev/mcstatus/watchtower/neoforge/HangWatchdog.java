package dev.mcstatus.watchtower.neoforge;

import com.google.gson.JsonObject;
import com.google.gson.JsonNull;
import dev.mcstatus.watchtower.ModReportConfig;
import dev.mcstatus.watchtower.OpsScanService;
import dev.mcstatus.watchtower.WatchtowerPaths;
import dev.mcstatus.watchtower.core.analyze.HangDumpWriter;
import dev.mcstatus.watchtower.core.analyze.SoftHangDetector;
import dev.mcstatus.watchtower.core.analyze.SoftHangThreshold;
import dev.mcstatus.watchtower.core.ops.OpsCacheSchema;
import dev.mcstatus.watchtower.core.ops.OpsCacheWriter;
import dev.mcstatus.watchtower.core.report.ReportConfig;
import dev.mcstatus.watchtower.runtime.ModRuntime;
import dev.mcstatus.watchtower.runtime.ServerContext;

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.Properties;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Background soft-hang watchdog: dual stall signals → ops-cache peek + Issues live.
 */
public final class HangWatchdog {

    private static final int POLL_SEC = 5;
    private static final AtomicBoolean STARTED = new AtomicBoolean(false);
    private static ScheduledExecutorService exec;

    private static volatile SoftHangDetector.PollState pollState =
            new SoftHangDetector.PollState(Long.MIN_VALUE, false, 0L);
    private static volatile long lastRecoveredAtMs;
    private static volatile boolean dumpWrittenThisHang;

    private HangWatchdog() {
    }

    public static void start(ServerContext server) {
        if (server == null || !STARTED.compareAndSet(false, true)) {
            return;
        }
        ReportConfig config;
        try {
            config = ModReportConfig.forServer(server);
        } catch (Exception e) {
            STARTED.set(false);
            return;
        }
        if (!config.softHangEnabled()) {
            STARTED.set(false);
            return;
        }
        pollState = new SoftHangDetector.PollState(Long.MIN_VALUE, false, 0L);
        dumpWrittenThisHang = false;
        exec = Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, "watchtower-soft-hang");
            t.setDaemon(true);
            return t;
        });
        exec.scheduleAtFixedRate(() -> {
            try {
                poll(server);
            } catch (Exception e) {
                try {
                    ModRuntime.logger().debug("Soft-hang poll failed: {}", e.toString());
                } catch (Exception ignored) {
                }
            }
        }, POLL_SEC, POLL_SEC, TimeUnit.SECONDS);
    }

    public static void stop() {
        STARTED.set(false);
        if (exec != null) {
            exec.shutdownNow();
            exec = null;
        }
        pollState = new SoftHangDetector.PollState(Long.MIN_VALUE, false, 0L);
        dumpWrittenThisHang = false;
    }

    static void poll(ServerContext server) throws Exception {
        ReportConfig config = ModReportConfig.forServer(server);
        if (!config.softHangEnabled()) {
            return;
        }
        long maxTickMs = readMaxTickTimeMs(server.serverDirectory());
        int effective = SoftHangThreshold.effectiveSeconds(maxTickMs, config.softHangSeconds());
        SoftHangDetector.TickStamp stamp = TickMetrics.stamp();
        SoftHangDetector.PollState prev = pollState;
        long nowMs = System.currentTimeMillis();
        SoftHangDetector.Decision d = SoftHangDetector.evaluate(stamp, prev, nowMs, effective);

        boolean skipNewActive = false;
        if (d.newlyActive()) {
            long cooldownMs = Math.max(0, config.softHangCooldownMin()) * 60_000L;
            if (lastRecoveredAtMs > 0 && nowMs - lastRecoveredAtMs < cooldownMs) {
                skipNewActive = true;
            }
        }

        SoftHangDetector.PollState next = new SoftHangDetector.PollState(
                stamp.tickCount(),
                skipNewActive ? false : d.active(),
                skipNewActive ? 0L : d.hangStartedAtMs());
        pollState = next;

        if (skipNewActive) {
            return;
        }

        if (d.newlyActive()) {
            dumpWrittenThisHang = false;
            String dumpRel = null;
            if (config.softHangThreadDump()) {
                Path rel = HangDumpWriter.writeOnce(server.serverDirectory(), d.phase(), d.stallSeconds());
                if (rel != null) {
                    dumpRel = rel.toString().replace('\\', '/');
                    dumpWrittenThisHang = true;
                }
            }
            JsonObject peek = buildPeek(true, d, effective, maxTickMs, dumpRel, null);
            OpsCacheWriter.applySoftHang(
                    WatchtowerPaths.opsCachePath(server),
                    WatchtowerPaths.statePath(server),
                    peek);
            OpsScanService.refreshIssuesLive(server);
        } else if (d.newlyRecovered()) {
            lastRecoveredAtMs = nowMs;
            String dumpRel = dumpWrittenThisHang ? existingDumpHint(server) : null;
            JsonObject peek = buildPeek(false, d, effective, maxTickMs, dumpRel, Instant.ofEpochMilli(nowMs).toString());
            OpsCacheWriter.applySoftHang(
                    WatchtowerPaths.opsCachePath(server),
                    WatchtowerPaths.statePath(server),
                    peek);
            OpsScanService.refreshIssuesLive(server);
            dumpWrittenThisHang = false;
        } else if (d.active()) {
            // Refresh stall_seconds while hung (no new dump).
            JsonObject peek = buildPeek(true, d, effective, maxTickMs,
                    dumpWrittenThisHang ? existingDumpHint(server) : null, null);
            OpsCacheWriter.applySoftHang(
                    WatchtowerPaths.opsCachePath(server),
                    WatchtowerPaths.statePath(server),
                    peek);
        }
    }

    private static JsonObject buildPeek(
            boolean active,
            SoftHangDetector.Decision d,
            int effective,
            long maxTickMs,
            String dumpPath,
            String recoveredAt
    ) {
        JsonObject o = new JsonObject();
        o.addProperty(OpsCacheSchema.SOFT_HANG_ACTIVE, active);
        o.addProperty(OpsCacheSchema.SOFT_HANG_PHASE, d.phase());
        o.addProperty(OpsCacheSchema.SOFT_HANG_STALL_SECONDS, d.stallSeconds());
        o.addProperty(OpsCacheSchema.SOFT_HANG_EFFECTIVE_THRESHOLD_SECONDS, effective);
        o.addProperty(OpsCacheSchema.SOFT_HANG_MAX_TICK_TIME_MS, maxTickMs);
        long started = d.hangStartedAtMs() > 0 ? d.hangStartedAtMs() : System.currentTimeMillis();
        o.addProperty(OpsCacheSchema.SOFT_HANG_STARTED_AT, Instant.ofEpochMilli(started).toString());
        SoftHangDetector.TickStamp stamp = TickMetrics.stamp();
        o.addProperty(OpsCacheSchema.SOFT_HANG_LAST_TICK_AT, Instant.ofEpochMilli(stamp.lastTickAtMs()).toString());
        o.addProperty(OpsCacheSchema.SOFT_HANG_TICK_COUNT, stamp.tickCount());
        if (dumpPath != null && !dumpPath.isBlank()) {
            o.addProperty(OpsCacheSchema.SOFT_HANG_DUMP_PATH, dumpPath);
        } else {
            o.add(OpsCacheSchema.SOFT_HANG_DUMP_PATH, JsonNull.INSTANCE);
        }
        if (recoveredAt != null) {
            o.addProperty(OpsCacheSchema.SOFT_HANG_RECOVERED_AT, recoveredAt);
        } else {
            o.add(OpsCacheSchema.SOFT_HANG_RECOVERED_AT, JsonNull.INSTANCE);
        }
        return o;
    }

    private static String existingDumpHint(ServerContext server) {
        try {
            Path dir = server.serverDirectory().resolve("watchtower").resolve("hangs");
            if (!Files.isDirectory(dir)) {
                return null;
            }
            try (var stream = Files.list(dir)) {
                return stream
                        .filter(p -> {
                            String n = p.getFileName().toString();
                            return n.endsWith(".txt") || n.endsWith(".log");
                        })
                        .max((a, b) -> {
                            try {
                                return Files.getLastModifiedTime(a).compareTo(Files.getLastModifiedTime(b));
                            } catch (Exception e) {
                                return 0;
                            }
                        })
                        .map(p -> Path.of("watchtower", "hangs", p.getFileName().toString()).toString().replace('\\', '/'))
                        .orElse(null);
            }
        } catch (Exception e) {
            return null;
        }
    }

    /** Missing key → 60000 (vanilla default). Parse failure → 60000. */
    static long readMaxTickTimeMs(Path serverDir) {
        Path props = serverDir.resolve("server.properties");
        if (!Files.isRegularFile(props)) {
            return 60_000L;
        }
        Properties p = new Properties();
        try (InputStream in = Files.newInputStream(props)) {
            p.load(in);
        } catch (Exception e) {
            return 60_000L;
        }
        String raw = p.getProperty("max-tick-time");
        if (raw == null || raw.isBlank()) {
            return 60_000L;
        }
        try {
            return Long.parseLong(raw.trim());
        } catch (NumberFormatException e) {
            return 60_000L;
        }
    }
}
