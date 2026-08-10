package dev.mcstatus.watchtower;

import dev.mcstatus.watchtower.core.collect.ModJarMetadataCache;
import dev.mcstatus.watchtower.core.collect.ModJarMetadataReader;
import dev.mcstatus.watchtower.runtime.ModRuntime;
import dev.mcstatus.watchtower.runtime.ServerContext;

import java.nio.file.Path;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Background warm/rebuild of {@link ModJarMetadataCache}. Never runs on the tick thread.
 */
public final class ModJarMetadataCacheScheduler {

    private static final AtomicBoolean RUNNING = new AtomicBoolean(false);
    private static final AtomicBoolean BOOT_STARTED = new AtomicBoolean(false);
    private static final AtomicBoolean FOLLOW_UP = new AtomicBoolean(false);

    private static ExecutorService exec;
    private static ScheduledExecutorService bootExec;

    private ModJarMetadataCacheScheduler() {
    }

    public static void startBootWarm(ServerContext server) {
        if (server == null || !BOOT_STARTED.compareAndSet(false, true)) {
            return;
        }
        bootExec = Executors.newSingleThreadScheduledExecutor(r -> {
            Thread t = new Thread(r, "watchtower-mod-jar-meta-boot");
            t.setDaemon(true);
            return t;
        });
        bootExec.schedule(() -> {
            try {
                requestRebuild(server, "boot");
            } catch (Exception e) {
                ModRuntime.logger().debug("Mod jar metadata boot warm failed: {}", e.toString());
            }
        }, 5, TimeUnit.SECONDS);
    }

    public static void stop() {
        BOOT_STARTED.set(false);
        FOLLOW_UP.set(false);
        if (bootExec != null) {
            bootExec.shutdownNow();
            bootExec = null;
        }
        if (exec != null) {
            exec.shutdownNow();
            exec = null;
        }
        RUNNING.set(false);
        ModJarMetadataCache.get().setRebuilding(false);
    }

    public static void checkFingerprint(ServerContext server) {
        if (server == null) {
            return;
        }
        try {
            Path modsDir = server.serverDirectory().resolve("mods");
            String diskFp = ModJarMetadataCache.fingerprintModsDir(modsDir);
            ModJarMetadataCache cache = ModJarMetadataCache.get();
            String cachedFp = cache.snapshot().fingerprint();
            if (cache.isDirty() || !diskFp.equals(cachedFp)) {
                requestRebuild(server, "fingerprint");
            }
        } catch (Exception e) {
            ModRuntime.logger().debug("Mod jar metadata fingerprint check failed: {}", e.toString());
        }
    }

    public static void requestRebuild(ServerContext server, String reason) {
        if (server == null) {
            return;
        }
        ensureExec();
        if (!RUNNING.compareAndSet(false, true)) {
            FOLLOW_UP.set(true);
            return;
        }
        final String trigger = reason != null ? reason : "rebuild";
        exec.execute(() -> {
            try {
                runRebuild(server, trigger);
            } finally {
                RUNNING.set(false);
                ModJarMetadataCache.get().setRebuilding(false);
                if (FOLLOW_UP.compareAndSet(true, false)
                        || ModJarMetadataCache.get().isDirty()
                        || fingerprintMismatched(server)) {
                    requestRebuild(server, "follow_up");
                }
            }
        });
    }

    private static boolean fingerprintMismatched(ServerContext server) {
        try {
            Path modsDir = server.serverDirectory().resolve("mods");
            String diskFp = ModJarMetadataCache.fingerprintModsDir(modsDir);
            return !diskFp.equals(ModJarMetadataCache.get().snapshot().fingerprint());
        } catch (Exception e) {
            return false;
        }
    }

    private static void runRebuild(ServerContext server, String reason) {
        ModJarMetadataCache cache = ModJarMetadataCache.get();
        cache.setRebuilding(true);
        try {
            String serverDir = server.serverDirectory().toAbsolutePath().toString();
            Path modsDir = server.serverDirectory().resolve("mods");
            List<ModJarMetadataReader.ModEntry> entries = ModJarMetadataReader.readFromModsDir(serverDir);
            String fp = ModJarMetadataCache.fingerprintModsDir(modsDir);
            cache.publish(fp, entries);
            ModRuntime.logger().debug(
                    "Mod jar metadata cache rebuilt ({}) entries={}", reason, entries.size());
        } catch (Exception e) {
            ModRuntime.logger().warn("Mod jar metadata rebuild failed ({}): {}", reason, e.toString());
        }
    }

    public static boolean isRunning() {
        return RUNNING.get();
    }

    private static synchronized void ensureExec() {
        if (exec == null || exec.isShutdown()) {
            exec = Executors.newSingleThreadExecutor(r -> {
                Thread t = new Thread(r, "watchtower-mod-jar-meta");
                t.setDaemon(true);
                return t;
            });
        }
    }
}
