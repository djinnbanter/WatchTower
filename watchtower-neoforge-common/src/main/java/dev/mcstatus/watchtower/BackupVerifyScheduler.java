package dev.mcstatus.watchtower;

import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.analyze.BackupVerifier;
import dev.mcstatus.watchtower.core.analyze.BackupVerifyPolicy;
import dev.mcstatus.watchtower.core.ops.OpsCacheReader;
import dev.mcstatus.watchtower.core.ops.OpsCacheSchema;
import dev.mcstatus.watchtower.core.ops.OpsCacheWriter;
import dev.mcstatus.watchtower.core.report.ReportConfig;
import dev.mcstatus.watchtower.runtime.ModRuntime;
import dev.mcstatus.watchtower.runtime.ServerContext;

import java.nio.file.Path;
import java.util.ArrayDeque;
import java.util.Deque;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Single-flight auto light-verify for backup inventory (1.1.20). Never on the tick thread.
 */
public final class BackupVerifyScheduler {

    private static final BackupVerifyScheduler INSTANCE = new BackupVerifyScheduler();

    private final ExecutorService executor = Executors.newSingleThreadExecutor(r -> {
        Thread t = new Thread(r, "watchtower-backup-verify");
        t.setDaemon(true);
        return t;
    });
    private final Deque<String> queue = new ArrayDeque<>();
    private final AtomicBoolean running = new AtomicBoolean(false);
    private final AtomicBoolean restoreBusy = new AtomicBoolean(false);
    private volatile ServerContext server;

    private BackupVerifyScheduler() {
    }

    public static BackupVerifyScheduler get() {
        return INSTANCE;
    }

    public void bind(ServerContext server) {
        this.server = server;
    }

    public void unbind() {
        this.server = null;
        synchronized (queue) {
            queue.clear();
        }
    }

    public boolean isRestoreBusy() {
        return restoreBusy.get();
    }

    public void enqueueAfterScan() {
        ServerContext ctx = server;
        if (ctx == null) {
            return;
        }
        try {
            ReportConfig config = ModReportConfig.forServer(ctx);
            if (!config.backupVerifyAuto() || !config.hasBackupDirs() || !config.backupTrackingEnabled()) {
                return;
            }
            JsonObject cache = OpsCacheReader.load(WatchtowerPaths.opsCachePath(ctx));
            if (!cache.has(OpsCacheSchema.BACKUPS_LIVE) || !cache.get(OpsCacheSchema.BACKUPS_LIVE).isJsonObject()) {
                return;
            }
            for (String path : BackupVerifyPolicy.pathsNeedingVerify(
                    cache.getAsJsonObject(OpsCacheSchema.BACKUPS_LIVE))) {
                enqueue(path);
            }
            kick();
        } catch (Exception e) {
            ModRuntime.logger().debug("Backup verify enqueue failed: {}", e.toString());
        }
    }

    public void enqueue(String absolutePath) {
        if (absolutePath == null || absolutePath.isBlank()) {
            return;
        }
        synchronized (queue) {
            if (!queue.contains(absolutePath)) {
                queue.addLast(absolutePath);
            }
        }
        kick();
    }

    public void runLightVerifyNow(String absolutePath) {
        enqueue(absolutePath);
        kick();
    }

    public void submitRestore(Runnable task) {
        if (!restoreBusy.compareAndSet(false, true)) {
            throw new IllegalStateException("busy");
        }
        executor.execute(() -> {
            try {
                task.run();
            } finally {
                restoreBusy.set(false);
            }
        });
    }

    private void kick() {
        if (!running.compareAndSet(false, true)) {
            return;
        }
        executor.execute(this::drain);
    }

    private void drain() {
        try {
            while (true) {
                String path;
                synchronized (queue) {
                    path = queue.pollFirst();
                }
                if (path == null) {
                    break;
                }
                verifyOne(path, false);
            }
        } finally {
            running.set(false);
            synchronized (queue) {
                if (!queue.isEmpty()) {
                    kick();
                }
            }
        }
    }

    /**
     * @param manual when true, skip defer-under-load
     */
    public JsonObject verifyOne(String absolutePath, boolean manual) {
        ServerContext ctx = server;
        if (ctx == null || absolutePath == null) {
            return null;
        }
        try {
            ReportConfig config = ModReportConfig.forServer(ctx);
            if (!manual) {
                int players = 0;
                double mspt = 0;
                try {
                    JsonObject live = LiveMetricsService.get().getLiveResponse();
                    JsonObject latest = live.has("latest") && live.get("latest").isJsonObject()
                            ? live.getAsJsonObject("latest") : live;
                    if (latest.has("players_online") && !latest.get("players_online").isJsonNull()) {
                        players = latest.get("players_online").getAsInt();
                    }
                    if (latest.has("mspt") && !latest.get("mspt").isJsonNull()) {
                        mspt = latest.get("mspt").getAsDouble();
                    }
                } catch (Exception ignored) {
                }
                if (BackupVerifyPolicy.shouldDeferAuto(players, mspt, config)) {
                    synchronized (queue) {
                        queue.addLast(absolutePath);
                    }
                    return null;
                }
            }
            Path file = Path.of(absolutePath);
            if (!BackupVerifyPolicy.isPathUnderBackupDirs(file, config, config.serverDir())) {
                return null;
            }
            JsonObject verify = BackupVerifier.lightVerify(file);
            OpsCacheWriter.applyBackupVerify(
                    WatchtowerPaths.opsCachePath(ctx),
                    WatchtowerPaths.statePath(ctx),
                    absolutePath,
                    verify);
            OpsScanService.refreshIssuesLive(ctx);
            return verify;
        } catch (Exception e) {
            ModRuntime.logger().debug("Backup light verify failed: {}", e.toString());
            return null;
        }
    }
}
