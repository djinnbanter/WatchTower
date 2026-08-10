package dev.mcstatus.watchtower.neoforge;

import dev.mcstatus.watchtower.runtime.OnlinePlayerView;
import dev.mcstatus.watchtower.runtime.ServerContext;
import dev.mcstatus.watchtower.runtime.WatchtowerSample;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerPlayer;
import net.neoforged.fml.ModList;
import org.slf4j.Logger;

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

/**
 * NeoForge {@link MinecraftServer}-backed {@link ServerContext}.
 */
public final class NeoForgeServerContext implements ServerContext {
    private final MinecraftServer server;

    public NeoForgeServerContext(MinecraftServer server) {
        this.server = server;
    }

    public MinecraftServer server() {
        return server;
    }

    @Override
    public Path serverDirectory() {
        return server.getServerDirectory();
    }

    @Override
    public void execute(Runnable task) {
        server.execute(task);
    }

    @Override
    public boolean runConsoleCommand(String command) {
        if (command == null || command.isBlank()) {
            return false;
        }
        String trimmed = command.startsWith("/") ? command.substring(1) : command;
        try {
            server.getCommands().performPrefixedCommand(server.createCommandSourceStack(), trimmed);
            return true;
        } catch (Exception e) {
            WatchtowerMod.LOGGER.warn("Console command failed: {} ({})", trimmed, e.toString());
            return false;
        }
    }

    @Override
    public boolean isModLoaded(String modId) {
        if (modId == null || modId.isBlank()) {
            return false;
        }
        return ModList.get().isLoaded(modId);
    }

    @Override
    public int playerCount() {
        return server.getPlayerCount();
    }

    @Override
    public String modId() {
        return WatchtowerMod.MOD_ID;
    }

    @Override
    public String modVersion() {
        return ModList.get().getModContainerById(WatchtowerMod.MOD_ID)
                .map(c -> c.getModInfo().getVersion().toString())
                .orElse("unknown");
    }

    @Override
    public String minecraftVersion() {
        try {
            String fromWorld = net.minecraft.SharedConstants.getCurrentVersion().getName();
            if (fromWorld != null && !fromWorld.isBlank()) {
                return fromWorld.strip();
            }
        } catch (Exception e) {
            WatchtowerMod.LOGGER.warn(
                    "SharedConstants.getCurrentVersion() failed; falling back to VERSION_STRING ({})",
                    e.toString());
        }
        try {
            // Baked into the Minecraft jar for this NeoForge build (e.g. "1.21.1").
            String baked = net.minecraft.SharedConstants.VERSION_STRING;
            if (baked != null && !baked.isBlank()) {
                return baked.strip();
            }
        } catch (Exception e) {
            WatchtowerMod.LOGGER.warn("SharedConstants.VERSION_STRING unavailable: {}", e.toString());
        }
        WatchtowerMod.LOGGER.error("Could not resolve Minecraft version from the running server");
        return "";
    }

    @Override
    public Logger logger() {
        return WatchtowerMod.LOGGER;
    }

    @Override
    public WatchtowerSample.Sample collectSample() {
        return WatchtowerSampler.collect(server);
    }

    @Override
    public WatchtowerSample.Sample collectSampleLight() {
        return WatchtowerSampler.collectLight(server);
    }

    @Override
    public WatchtowerSample.WorldCensus collectWorldCensus() {
        return WatchtowerSampler.collectWorldCensus(server);
    }

    @Override
    public List<OnlinePlayerView> onlinePlayers() {
        List<OnlinePlayerView> out = new ArrayList<>();
        for (ServerPlayer player : server.getPlayerList().getPlayers()) {
            String dim = player.level() != null
                    ? player.level().dimension().location().toString()
                    : "";
            out.add(new OnlinePlayerView(
                    player.getGameProfile().getName(),
                    player.getUUID().toString(),
                    player.connection.latency(),
                    dim));
        }
        return out;
    }

    @Override
    public double smoothedMspt() {
        return TickMetrics.smoothedMspt();
    }

    @Override
    public WatchtowerSample.SessionMspt sessionMspt() {
        return TickMetrics.sessionMspt();
    }
}
