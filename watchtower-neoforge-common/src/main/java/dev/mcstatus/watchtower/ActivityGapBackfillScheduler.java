package dev.mcstatus.watchtower;

import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.ops.ActivityGapBackfill;
import dev.mcstatus.watchtower.core.report.ReportConfig;
import dev.mcstatus.watchtower.core.report.StateManager;
import dev.mcstatus.watchtower.runtime.ModRuntime;
import dev.mcstatus.watchtower.runtime.ServerContext;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Async Activity ledger gap backfill — never on the 60s ops tick body.
 */
public final class ActivityGapBackfillScheduler {

    private static final AtomicBoolean RUNNING = new AtomicBoolean(false);
    private static final AtomicReference<JsonObject> LAST_STATUS = new AtomicReference<>(null);
    private static ExecutorService exec;
    private static ScheduledExecutorService bootExec;
    private static final AtomicBoolean BOOT_STARTED = new AtomicBoolean(false);

    private ActivityGapBackfillScheduler() {
    }

    public static void startBootCatchup(ServerContext server) {
        if (server == null || !BOOT_STARTED.compareAndSet(false, true)) {
            return;
        }
        ReportConfig config;
        try {
            config = ModReportConfig.forServer(server);
        } catch (Exception e) {
            return;
        }
        if (!config.activityGapBackfillEnabled()) {
            return;
        }
        bootExec = Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, "watchtower-activity-gap-boot");
            t.setDaemon(true);
            return t;
        });
        int delaySec = Math.max(30, config.startupProfileBootDelaySec());
        bootExec.schedule(() -> {
            try {
                if (ActivityGapBackfill.shouldEnqueue(
                        server.serverDirectory().toAbsolutePath().toString(),
                        WatchtowerPaths.statePath(server),
                        config)) {
                    enqueue(server, "boot_gap");
                }
            } catch (Exception e) {
                ModRuntime.logger().debug("Activity gap boot catchup failed: {}", e.toString());
            }
        }, delaySec, TimeUnit.SECONDS);
    }

    public static void stop() {
        BOOT_STARTED.set(false);
        if (bootExec != null) {
            bootExec.shutdownNow();
            bootExec = null;
        }
        if (exec != null) {
            exec.shutdownNow();
            exec = null;
        }
        RUNNING.set(false);
    }

    public static void maybeEnqueue(ServerContext server, ReportConfig config) {
        try {
            if (config == null || !config.activityGapBackfillEnabled()) {
                return;
            }
            String serverDir = server.serverDirectory().toAbsolutePath().toString();
            if (ActivityGapBackfill.shouldEnqueue(serverDir, WatchtowerPaths.statePath(server), config)) {
                enqueue(server, "ops_gap");
            }
        } catch (Exception e) {
            ModRuntime.logger().debug("Activity gap enqueue check failed: {}", e.toString());
        }
    }

    public static void enqueue(ServerContext server, String trigger) {
        if (server == null) {
            return;
        }
        ensureExec();
        if (!RUNNING.compareAndSet(false, true)) {
            JsonObject busy = new JsonObject();
            busy.addProperty("status", "busy");
            busy.addProperty("trigger", trigger);
            LAST_STATUS.set(busy);
            return;
        }
        JsonObject starting = new JsonObject();
        starting.addProperty("status", "running");
        starting.addProperty("trigger", trigger);
        LAST_STATUS.set(starting);
        exec.execute(() -> {
            try {
                runOnce(server, trigger);
            } finally {
                RUNNING.set(false);
            }
        });
    }

    static void runOnce(ServerContext server, String trigger) {
        try {
            ReportConfig config = ModReportConfig.forServer(server);
            String serverDir = server.serverDirectory().toAbsolutePath().toString();
            ActivityGapBackfill.WakeResult result = ActivityGapBackfill.runWake(
                    serverDir,
                    WatchtowerPaths.statePath(server),
                    WatchtowerPaths.opsCachePath(server),
                    config);
            JsonObject status = new JsonObject();
            status.addProperty("status", result.complete() ? "ok" : "partial");
            status.addProperty("trigger", trigger);
            status.addProperty("chunks", result.chunksRun());
            status.addProperty("events_merged", result.eventsMerged());
            status.addProperty("complete", result.complete());
            if (result.complete()) {
                StateManager.clearActivityBackfillState(WatchtowerPaths.statePath(server));
            }
            LAST_STATUS.set(status);
            ModRuntime.logger().info(
                    "[Watchtower] Activity gap backfill ({}) chunks={} events={} complete={}",
                    trigger, result.chunksRun(), result.eventsMerged(), result.complete());
        } catch (Exception e) {
            JsonObject err = new JsonObject();
            err.addProperty("status", "error");
            err.addProperty("trigger", trigger);
            err.addProperty("reason", e.getMessage() != null ? e.getMessage() : e.toString());
            LAST_STATUS.set(err);
            ModRuntime.logger().warn("[Watchtower] Activity gap backfill failed: {}", e.toString());
        }
    }

    public static boolean isRunning() {
        return RUNNING.get();
    }

    public static JsonObject lastStatus() {
        JsonObject s = LAST_STATUS.get();
        return s != null ? s.deepCopy() : null;
    }

    private static synchronized void ensureExec() {
        if (exec == null || exec.isShutdown()) {
            exec = Executors.newSingleThreadExecutor(r -> {
                Thread t = new Thread(r, "watchtower-activity-gap");
                t.setDaemon(true);
                return t;
            });
        }
    }
}
