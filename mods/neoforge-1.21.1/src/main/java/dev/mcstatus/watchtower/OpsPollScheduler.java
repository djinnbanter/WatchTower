package dev.mcstatus.watchtower;

import dev.mcstatus.watchtower.core.auth.DashboardAuthStore;
import net.minecraft.server.MinecraftServer;

import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Session-gated extra crash folder polling while dashboard is open ({@code OPS_POLL_SEC}).
 * Unified log tail, activity, mod errors, and baseline crash scans run via {@link AlwaysOnOpsLogScheduler}.
 */
public final class OpsPollScheduler {

    private static final OpsPollScheduler INSTANCE = new OpsPollScheduler();
    private final ScheduledExecutorService executor = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "watchtower-ops-poll");
        t.setDaemon(true);
        return t;
    });
    private final AtomicReference<ScheduledFuture<?>> future = new AtomicReference<>();
    private volatile MinecraftServer server;
    private volatile int pollSec = 60;

    private OpsPollScheduler() {
    }

    public static OpsPollScheduler get() {
        return INSTANCE;
    }

    public void bind(MinecraftServer server) {
        this.server = server;
        try {
            pollSec = ModReportConfig.forServer(server).opsPollSec();
        } catch (Exception e) {
            pollSec = 60;
        }
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
            pollSec = ModReportConfig.forServer(s).opsPollSec();
        } catch (Exception ignored) {
        }
        if (pollSec <= 0 || !hasAuthenticatedSession()) {
            stop();
            return;
        }
        if (future.get() != null) {
            return;
        }
        ScheduledFuture<?> f = executor.scheduleAtFixedRate(
                () -> {
                    MinecraftServer current = server;
                    if (current == null || !hasAuthenticatedSession()) {
                        stop();
                        return;
                    }
                    OpsScanService.runRoutinePoll(current);
                },
                pollSec,
                pollSec,
                TimeUnit.SECONDS);
        future.set(f);
    }

    public void stop() {
        ScheduledFuture<?> f = future.getAndSet(null);
        if (f != null) {
            f.cancel(false);
        }
    }

    public boolean isPollActive() {
        return future.get() != null;
    }

    private boolean hasAuthenticatedSession() {
        try {
            DashboardAuthStore store = DashboardAuthServices.store();
            boolean totp = store != null && store.totpEnabled();
            return DashboardAuthServices.sessions().fullyAuthenticatedCount(totp) > 0;
        } catch (Exception e) {
            return false;
        }
    }
}
