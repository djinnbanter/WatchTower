package dev.mcstatus.watchtower;

import dev.mcstatus.watchtower.core.WatchtowerFiles;

import net.minecraft.server.MinecraftServer;

import java.nio.file.Path;

public final class WatchtowerPaths {
    public static final String ROOT_DIR = "watchtower";
    public static final String BUNDLE_DIR = ".bundle";

    private WatchtowerPaths() {
    }

    public static Path watchtowerRoot(MinecraftServer server) {
        return server.getServerDirectory().resolve(ROOT_DIR).normalize();
    }

    public static Path bundleDir(MinecraftServer server) {
        return watchtowerRoot(server).resolve(BUNDLE_DIR).normalize();
    }

    public static Path reportDir(MinecraftServer server) {
        return watchtowerRoot(server);
    }

    public static Path confPath(MinecraftServer server) {
        return watchtowerRoot(server).resolve(WatchtowerFiles.CONF_FILENAME);
    }

    public static Path snapshotPath(MinecraftServer server) {
        return watchtowerRoot(server).resolve("snapshot.json");
    }

    public static Path statePath(MinecraftServer server) {
        return watchtowerRoot(server).resolve(WatchtowerFiles.STATE_FILENAME);
    }

    public static Path liveHistoryPath(MinecraftServer server) {
        return watchtowerRoot(server).resolve("live-history.json");
    }

    public static Path performanceRollupsPath(MinecraftServer server) {
        return watchtowerRoot(server).resolve("performance-rollups.json");
    }

    public static Path opsCachePath(MinecraftServer server) {
        return watchtowerRoot(server).resolve(WatchtowerFiles.OPS_CACHE_FILENAME);
    }

    public static Path incidentsDir(MinecraftServer server) {
        return watchtowerRoot(server).resolve("incidents").normalize();
    }

    public static Path dashboardAuthPath(MinecraftServer server) {
        return watchtowerRoot(server).resolve("dashboard-auth.json");
    }

    public static Path authKeyPath(MinecraftServer server) {
        return watchtowerRoot(server).resolve(".auth-key");
    }
}
