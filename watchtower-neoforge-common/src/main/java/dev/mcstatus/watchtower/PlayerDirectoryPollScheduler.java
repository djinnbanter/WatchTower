package dev.mcstatus.watchtower;

import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.ops.OpsCacheWriter;
import dev.mcstatus.watchtower.core.report.ReportConfig;
import dev.mcstatus.watchtower.runtime.ModRuntime;
import dev.mcstatus.watchtower.runtime.ServerContext;

import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Slow poll for player directory / window stats into ops-cache (no full report).
 */
public final class PlayerDirectoryPollScheduler {

    private static final PlayerDirectoryPollScheduler INSTANCE = new PlayerDirectoryPollScheduler();
    private final ScheduledExecutorService executor = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "watchtower-player-directory");
        t.setDaemon(true);
        return t;
    });
    private final AtomicReference<ScheduledFuture<?>> future = new AtomicReference<>();
    private volatile ServerContext server;

    private PlayerDirectoryPollScheduler() {
    }

    public static PlayerDirectoryPollScheduler get() {
        return INSTANCE;
    }

    public void bind(ServerContext server) {
        this.server = server;
        refreshSchedule();
    }

    public void unbind() {
        stop();
        server = null;
    }

    public void refreshSchedule() {
        stop();
        ServerContext s = server;
        if (s == null) {
            return;
        }
        int sec = 900;
        try {
            ReportConfig config = ModReportConfig.forServer(s);
            sec = config.playerDirectoryPollSec();
        } catch (Exception ignored) {
        }
        future.set(executor.scheduleWithFixedDelay(() -> {
            try {
                tick();
            } catch (Exception e) {
                ModRuntime.logger().debug("Player directory poll failed: {}", e.toString());
            }
        }, Math.min(120, sec), sec, TimeUnit.SECONDS));
    }

    private void stop() {
        ScheduledFuture<?> f = future.getAndSet(null);
        if (f != null) {
            f.cancel(false);
        }
    }

    private void tick() throws Exception {
        ServerContext s = server;
        if (s == null) {
            return;
        }
        String serverDir = s.serverDirectory().toAbsolutePath().toString();
        JsonObject directory = PlayerRosterService.scanRoster(s);
        if (directory == null || directory.size() == 0) {
            return;
        }
        var ops = WatchtowerPaths.opsCachePath(s);
        OpsCacheWriter.mutate(ops, cache -> cache.add("player_directory", directory));
    }
}
