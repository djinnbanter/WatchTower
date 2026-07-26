package dev.mcstatus.watchtower;

import dev.mcstatus.watchtower.core.WatchtowerFiles;
import dev.mcstatus.watchtower.runtime.ServerContext;

import java.nio.file.Path;

public final class WatchtowerPaths {
    public static final String ROOT_DIR = "watchtower";
    public static final String BUNDLE_DIR = ".bundle";

    private WatchtowerPaths() {
    }

    public static Path watchtowerRoot(Path serverDir) {
        return serverDir.resolve(ROOT_DIR).normalize();
    }

    public static Path watchtowerRoot(ServerContext ctx) {
        return watchtowerRoot(ctx.serverDirectory());
    }

    public static Path bundleDir(Path serverDir) {
        return watchtowerRoot(serverDir).resolve(BUNDLE_DIR).normalize();
    }

    public static Path bundleDir(ServerContext ctx) {
        return bundleDir(ctx.serverDirectory());
    }

    public static Path reportDir(Path serverDir) {
        return watchtowerRoot(serverDir);
    }

    public static Path reportDir(ServerContext ctx) {
        return reportDir(ctx.serverDirectory());
    }

    public static Path confPath(Path serverDir) {
        return watchtowerRoot(serverDir).resolve(WatchtowerFiles.CONF_FILENAME);
    }

    public static Path confPath(ServerContext ctx) {
        return confPath(ctx.serverDirectory());
    }

    public static Path snapshotPath(Path serverDir) {
        return watchtowerRoot(serverDir).resolve("snapshot.json");
    }

    public static Path snapshotPath(ServerContext ctx) {
        return snapshotPath(ctx.serverDirectory());
    }

    public static Path platformPath(Path serverDir) {
        return watchtowerRoot(serverDir).resolve("platform.json");
    }

    public static Path platformPath(ServerContext ctx) {
        return platformPath(ctx.serverDirectory());
    }

    public static Path statePath(Path serverDir) {
        return watchtowerRoot(serverDir).resolve(WatchtowerFiles.STATE_FILENAME);
    }

    public static Path statePath(ServerContext ctx) {
        return statePath(ctx.serverDirectory());
    }

    public static Path liveHistoryPath(Path serverDir) {
        return watchtowerRoot(serverDir).resolve("live-history.json");
    }

    public static Path liveHistoryPath(ServerContext ctx) {
        return liveHistoryPath(ctx.serverDirectory());
    }

    public static Path performanceRollupsPath(Path serverDir) {
        return watchtowerRoot(serverDir).resolve("performance-rollups.json");
    }

    public static Path performanceRollupsPath(ServerContext ctx) {
        return performanceRollupsPath(ctx.serverDirectory());
    }

    public static Path opsCachePath(Path serverDir) {
        return watchtowerRoot(serverDir).resolve(WatchtowerFiles.OPS_CACHE_FILENAME);
    }

    public static Path opsCachePath(ServerContext ctx) {
        return opsCachePath(ctx.serverDirectory());
    }

    public static Path incidentsDir(Path serverDir) {
        return watchtowerRoot(serverDir).resolve("incidents").normalize();
    }

    public static Path incidentsDir(ServerContext ctx) {
        return incidentsDir(ctx.serverDirectory());
    }

    public static Path dashboardAuthPath(Path serverDir) {
        return watchtowerRoot(serverDir).resolve("dashboard-auth.json");
    }

    public static Path dashboardAuthPath(ServerContext ctx) {
        return dashboardAuthPath(ctx.serverDirectory());
    }

    public static Path authKeyPath(Path serverDir) {
        return watchtowerRoot(serverDir).resolve(".auth-key");
    }

    public static Path authKeyPath(ServerContext ctx) {
        return authKeyPath(ctx.serverDirectory());
    }
}
