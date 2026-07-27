package dev.mcstatus.watchtower;

import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.collect.StartupProfileScanner;
import dev.mcstatus.watchtower.core.ops.OpsCacheWriter;
import dev.mcstatus.watchtower.core.report.ReportConfig;
import dev.mcstatus.watchtower.runtime.ServerContext;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Once per server start: after settle delay, scan latest.log for boot profile into ops-cache
 * (no full ReportEngine).
 */
public final class BootStartupProfileScheduler {

    private static final AtomicBoolean STARTED = new AtomicBoolean(false);
    private static ScheduledExecutorService exec;

    private BootStartupProfileScheduler() {
    }

    public static void start(ServerContext server) {
        if (server == null || !STARTED.compareAndSet(false, true)) {
            return;
        }
        ReportConfig config;
        try {
            config = ModReportConfig.forServer(server);
        } catch (Exception e) {
            return;
        }
        if (!config.startupProfileOnBoot()) {
            return;
        }
        int delaySec = Math.max(15, config.startupProfileBootDelaySec());
        exec = Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, "watchtower-boot-startup-profile");
            t.setDaemon(true);
            return t;
        });
        exec.schedule(() -> {
            try {
                runOnce(server);
            } catch (Exception ignored) {
            }
        }, delaySec, TimeUnit.SECONDS);
    }

    public static void stop() {
        STARTED.set(false);
        if (exec != null) {
            exec.shutdownNow();
            exec = null;
        }
    }

    static void runOnce(ServerContext server) throws Exception {
        Path latest = server.serverDirectory().resolve("logs").resolve("latest.log");
        if (!Files.isRegularFile(latest)) {
            return;
        }
        Path ops = WatchtowerPaths.opsCachePath(server);
        OpsCacheWriter.mutate(ops, cache -> {
            JsonObject previous = cache.has("startup_profile") && cache.get("startup_profile").isJsonObject()
                    ? cache.getAsJsonObject("startup_profile")
                    : null;
            Double prevTotal = null;
            if (previous != null && previous.has("total_sec") && !previous.get("total_sec").isJsonNull()) {
                try {
                    prevTotal = previous.get("total_sec").getAsDouble();
                } catch (Exception ignored) {
                    prevTotal = null;
                }
            }
            JsonObject profile;
            try {
                profile = StartupProfileScanner.scanLastBootFromLog(latest, prevTotal);
            } catch (Exception e) {
                return;
            }
            if (profile == null || profile.size() == 0) {
                return;
            }
            StartupProfileScanner.attachBootHistory(profile, previous);
            cache.add("startup_profile", profile);
        });
    }
}
