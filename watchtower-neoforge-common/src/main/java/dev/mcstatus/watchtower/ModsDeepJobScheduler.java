package dev.mcstatus.watchtower;

import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.collect.ModsDeepAnalyzer;
import dev.mcstatus.watchtower.core.ops.OpsCacheReader;
import dev.mcstatus.watchtower.core.ops.OpsCacheSchema;
import dev.mcstatus.watchtower.core.ops.OpsCacheWriter;
import dev.mcstatus.watchtower.core.report.ReportConfig;
import dev.mcstatus.watchtower.runtime.ModRuntime;
import dev.mcstatus.watchtower.runtime.ServerContext;

import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Async Mods deep (forensics) delta — never on the 60s ops tick body.
 * Jar-change and empty-ledger boot seed enqueue work here.
 */
public final class ModsDeepJobScheduler {

    private static final AtomicBoolean RUNNING = new AtomicBoolean(false);
    private static final AtomicReference<JsonObject> LAST_STATUS = new AtomicReference<>(null);
    private static ExecutorService exec;
    private static ScheduledExecutorService bootExec;
    private static final AtomicBoolean BOOT_STARTED = new AtomicBoolean(false);

    private ModsDeepJobScheduler() {
    }

    public static void startBootSeed(ServerContext server) {
        if (server == null || !BOOT_STARTED.compareAndSet(false, true)) {
            return;
        }
        ReportConfig config;
        try {
            config = ModReportConfig.forServer(server);
        } catch (Exception e) {
            return;
        }
        if (!config.modsDeepSeedOnBoot() || !config.modForensicsScan()) {
            return;
        }
        bootExec = Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, "watchtower-mods-deep-boot");
            t.setDaemon(true);
            return t;
        });
        int delaySec = Math.max(20, config.startupProfileBootDelaySec());
        bootExec.schedule(() -> {
            try {
                JsonObject cache = OpsCacheReader.load(WatchtowerPaths.opsCachePath(server));
                if (cache != null && cache.has(OpsCacheSchema.MODS_DEEP)
                        && cache.get(OpsCacheSchema.MODS_DEEP).isJsonObject()) {
                    JsonObject existing = cache.getAsJsonObject(OpsCacheSchema.MODS_DEEP);
                    if ("ok".equals(existing.has("status") ? existing.get("status").getAsString() : "")) {
                        return;
                    }
                }
                enqueue(server, "boot_seed");
            } catch (Exception e) {
                ModRuntime.logger().debug("Mods deep boot seed failed: {}", e.toString());
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

    /** Enqueue jar-change deep delta when kill-switch allows. */
    public static void enqueueOnJarChange(ServerContext server) {
        try {
            ReportConfig config = ModReportConfig.forServer(server);
            if (!config.modsDeepOnJarChange() || !config.modForensicsScan()) {
                return;
            }
            enqueue(server, "jar_change");
        } catch (Exception e) {
            ModRuntime.logger().debug("Mods deep jar-change enqueue failed: {}", e.toString());
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
            JsonObject deep = ModsDeepAnalyzer.analyze(serverDir, config, trigger);
            LAST_STATUS.set(deep.deepCopy());
            OpsCacheWriter.applyModsDeep(WatchtowerPaths.opsCachePath(server), deep);
            ModRuntime.logger().info("[Watchtower] Mods deep ({}) status={}", trigger,
                    deep.has("status") ? deep.get("status").getAsString() : "?");
        } catch (Exception e) {
            JsonObject err = new JsonObject();
            err.addProperty("status", "error");
            err.addProperty("trigger", trigger);
            err.addProperty("reason", e.getMessage() != null ? e.getMessage() : e.toString());
            LAST_STATUS.set(err);
            ModRuntime.logger().warn("[Watchtower] Mods deep failed: {}", e.toString());
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
                Thread t = new Thread(r, "watchtower-mods-deep");
                t.setDaemon(true);
                return t;
            });
        }
    }
}
