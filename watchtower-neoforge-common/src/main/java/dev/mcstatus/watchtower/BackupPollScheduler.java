package dev.mcstatus.watchtower;

import dev.mcstatus.watchtower.runtime.ModRuntime;

import dev.mcstatus.watchtower.runtime.ServerContext;

import dev.mcstatus.watchtower.core.report.ReportConfig;

import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Optional slow backup-folder poll while the server is running ({@code BACKUP_POLL_MIN}).
 */
public final class BackupPollScheduler {

    private static final BackupPollScheduler INSTANCE = new BackupPollScheduler();
    private final ScheduledExecutorService executor = Executors.newSingleThreadScheduledExecutor(r -> {
        Thread t = new Thread(r, "watchtower-backup-poll");
        t.setDaemon(true);
        return t;
    });
    private final AtomicReference<ScheduledFuture<?>> future = new AtomicReference<>();
    private volatile ServerContext server;
    private volatile int pollMin = 0;

    private BackupPollScheduler() {
    }

    public static BackupPollScheduler get() {
        return INSTANCE;
    }

    public void bind(ServerContext server) {
        this.server = server;
        try {
            pollMin = ModReportConfig.forServer(server).backupPollMin();
        } catch (Exception e) {
            pollMin = 0;
        }
        startIfNeeded();
    }

    public void unbind() {
        stop();
        server = null;
    }

    public void refreshSchedule() {
        ServerContext s = server;
        if (s == null) {
            stop();
            return;
        }
        try {
            pollMin = ModReportConfig.forServer(s).backupPollMin();
        } catch (Exception ignored) {
        }
        stop();
        startIfNeeded();
    }

    public boolean isActive() {
        return future.get() != null && pollMin > 0;
    }

    private void startIfNeeded() {
        if (pollMin <= 0 || server == null) {
            return;
        }
        try {
            ReportConfig config = ModReportConfig.forServer(server);
            if (!config.hasBackupDirs() || !config.backupTrackingEnabled()) {
                return;
            }
        } catch (Exception e) {
            return;
        }
        if (future.get() != null) {
            return;
        }
        long periodSec = (long) pollMin * 60L;
        ScheduledFuture<?> f = executor.scheduleAtFixedRate(
                () -> {
                    ServerContext current = server;
                    if (current == null) {
                        stop();
                        return;
                    }
                    try {
                        OpsScanService.scanBackupsLive(current);
                    } catch (Exception e) {
                        ModRuntime.logger().debug("Backup folder poll failed: {}", e.toString());
                    }
                },
                periodSec,
                periodSec,
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
