package dev.mcstatus.watchtower;

import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.entity.Entity;
import net.neoforged.fml.ModList;
import net.neoforged.neoforge.server.ServerLifecycleHooks;
import net.neoforged.neoforgespi.language.IModInfo;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Set;

public final class WatchtowerSampler {
    private static final Set<String> DEFAULT_DIMENSIONS = Set.of(
            "minecraft:overworld",
            "minecraft:the_nether",
            "minecraft:the_end"
    );

    public record DimensionSample(String id, double tps, double mspt, long entities, long chunks) {
    }

    public record PlayerSample(String name, String uuid, int ping, String dimension) {
    }

    public record ModSample(String id, String version, String displayName) {
    }

    public record HeapMb(double used, double committed, double max) {
    }

    public record Sample(
            double mspt,
            double tps,
            int playersOnline,
            long entities,
            long chunks,
            int modCount,
            List<DimensionSample> dimensions,
            TickMetrics.SessionMspt sessionMspt,
            HeapMb heap,
            List<PlayerSample> players,
            List<ModSample> mods
    ) {
    }

    private WatchtowerSampler() {
    }

    public static Sample collect(MinecraftServer server) {
        double mspt = TickMetrics.smoothedMspt();
        double tps = Math.min(20.0, 1000.0 / Math.max(mspt, 0.001));
        int players = server.getPlayerCount();
        long entities = -1;
        long chunks = -1;
        List<DimensionSample> dimensions = new ArrayList<>();

        boolean countEntities = WatchtowerConfig.COUNT_ENTITIES.get();
        if (countEntities) {
            entities = 0;
            chunks = 0;
            for (ServerLevel level : server.getAllLevels()) {
                String dimId = level.dimension().location().toString();
                if (!DEFAULT_DIMENSIONS.contains(dimId)) {
                    continue;
                }
                long levelChunks = level.getChunkSource().getLoadedChunksCount();
                long levelEntities = 0;
                for (Entity ignored : level.getAllEntities()) {
                    levelEntities++;
                }
                chunks += levelChunks;
                entities += levelEntities;
                dimensions.add(new DimensionSample(dimId, tps, mspt, levelEntities, levelChunks));
            }
        }

        dimensions.sort(Comparator.comparing(DimensionSample::id));

        int modCount = countMods(server);
        List<ModSample> mods = sampleMods();
        List<PlayerSample> playerSamples = samplePlayers(server);
        HeapMb heap = sampleHeap();

        return new Sample(
                mspt,
                tps,
                players,
                entities,
                chunks,
                modCount,
                dimensions,
                TickMetrics.sessionMspt(),
                heap,
                playerSamples,
                mods
        );
    }

    public static HeapMb sampleHeapOnly() {
        return sampleHeap();
    }

    private static HeapMb sampleHeap() {
        Runtime rt = Runtime.getRuntime();
        double used = (rt.totalMemory() - rt.freeMemory()) / (1024.0 * 1024.0);
        double committed = rt.totalMemory() / (1024.0 * 1024.0);
        double max = rt.maxMemory() / (1024.0 * 1024.0);
        return new HeapMb(
                Math.round(used * 10.0) / 10.0,
                Math.round(committed * 10.0) / 10.0,
                Math.round(max * 10.0) / 10.0
        );
    }

    private static List<PlayerSample> samplePlayers(MinecraftServer server) {
        List<PlayerSample> out = new ArrayList<>();
        for (ServerPlayer player : server.getPlayerList().getPlayers()) {
            String dim = player.level().dimension().location().toString();
            out.add(new PlayerSample(
                    player.getGameProfile().getName(),
                    player.getUUID().toString(),
                    player.connection.latency(),
                    dim));
        }
        return out;
    }

    private static List<ModSample> sampleMods() {
        List<ModSample> out = new ArrayList<>();
        try {
            for (IModInfo info : ModList.get().getMods()) {
                String id = info.getModId();
                if ("minecraft".equals(id) || "neoforge".equals(id)) {
                    continue;
                }
                out.add(new ModSample(id, info.getVersion().toString(), info.getDisplayName()));
            }
        } catch (Exception e) {
            WatchtowerMod.LOGGER.debug("Mod list sample failed: {}", e.toString());
        }
        out.sort(Comparator.comparing(ModSample::id));
        return out;
    }

    private static int countMods(MinecraftServer server) {
        Path modsDir = server.getServerDirectory().resolve("mods");
        if (!Files.isDirectory(modsDir)) {
            return 0;
        }
        try (var stream = Files.list(modsDir)) {
            return (int) stream
                    .filter(p -> {
                        String name = p.getFileName().toString().toLowerCase();
                        return name.endsWith(".jar") && Files.isRegularFile(p);
                    })
                    .count();
        } catch (Exception e) {
            WatchtowerMod.LOGGER.warn("Failed to count mods: {}", e.toString());
            return 0;
        }
    }

    public static Sample currentSample() {
        MinecraftServer server = ServerLifecycleHooks.getCurrentServer();
        if (server == null) {
            return new Sample(0, 0, 0, -1, -1, 0, List.of(), new TickMetrics.SessionMspt(0, 0, 0, 0, null),
                    new HeapMb(0, 0, 0), List.of(), List.of());
        }
        return collect(server);
    }
}
