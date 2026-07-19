package dev.mcstatus.watchtower;

import net.minecraft.server.MinecraftServer;

import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Always-on unified ops log tail scan while the Minecraft server is running.
 */
public final class AlwaysOnOpsLogScheduler {

    private static final AlwaysOnOpsLogScheduler INSTANCE = new AlwaysOnOpsLogScheduler();
    private final ScheduledExecutorService executor = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "watchtower-ops-log");
        t.setDaemon(true);
        return t;
    });
    private final AtomicReference<ScheduledFuture<?>> future = new AtomicReference<>();
    private volatile MinecraftServer server;
    private volatile int scanSec = 60;

    private AlwaysOnOpsLogScheduler() {
    }

    public static AlwaysOnOpsLogScheduler get() {
        return INSTANCE;
    }

    public void bind(MinecraftServer server) {
        this.server = server;
        try {
            scanSec = ModReportConfig.forServer(server).opsLogScanSec();
        } catch (Exception e) {
            scanSec = 60;
        }
        startIfNeeded();
    }

    public void unbind() {
        stop();
        server = null;
    }

    public void refreshSchedule() {
        MinecraftServer s = server;
        if (s == null) {
            stop();
            return;
        }
        try {
            scanSec = ModReportConfig.forServer(s).opsLogScanSec();
        } catch (Exception ignored) {
        }
        stop();
        startIfNeeded();
    }

    public boolean isActive() {
        return future.get() != null && scanSec > 0;
    }

    private void startIfNeeded() {
        if (scanSec <= 0 || server == null) {
            return;
        }
        if (future.get() != null) {
            return;
        }
        ScheduledFuture<?> f = executor.scheduleAtFixedRate(
                () -> {
                    MinecraftServer current = server;
                    if (current == null) {
                        stop();
                        return;
                    }
                    try {
                        OpsScanService.scanOpsLog(current);
                        OpsScanService.scanRunningMods(current);
                        OpsScanService.scanCrashes(current);
                    } catch (Exception e) {
                        WatchtowerMod.LOGGER.debug("Always-on ops log scan failed: {}", e.toString());
                    }
                },
                scanSec,
                scanSec,
                TimeUnit.SECONDS);
        future.set(f);
    }

    private void stop() {
        ScheduledFuture<?> f = future.getAndSet(null);
        if (f != null) {
            f.cancel(false);
        }
    }
}
