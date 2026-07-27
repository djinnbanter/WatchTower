package dev.mcstatus.watchtower.runtime;

import org.slf4j.Logger;

import java.nio.file.Path;
import java.util.List;

/**
 * Loader-agnostic handle for server directory, tick thread, and live sampling.
 * Glue provides a NeoForge (or future) implementation; common code must not import Minecraft.
 */
public interface ServerContext {
    Path serverDirectory();

    void execute(Runnable task);

    /**
     * Run a console-level command (no leading slash). Returns false if unsupported or dispatch failed.
     */
    boolean runConsoleCommand(String command);

    /** Whether a mod id is loaded on this server (e.g. {@code spark}). */
    boolean isModLoaded(String modId);

    int playerCount();

    String modId();

    String modVersion();

    /** Minecraft version string (e.g. 1.21.1), or empty if unknown. */
    String minecraftVersion();

    Logger logger();

    WatchtowerSample.Sample collectSample();

    List<OnlinePlayerView> onlinePlayers();

    double smoothedMspt();

    WatchtowerSample.SessionMspt sessionMspt();
}
