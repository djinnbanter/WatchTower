package dev.mcstatus.watchtower;

import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.entity.Entity;
import net.neoforged.fml.ModList;
import net.neoforged.neoforge.server.ServerLifecycleHooks;
import net.neoforged.neoforgespi.language.IModInfo;

import dev.mcstatus.watchtower.core.collect.ModJarMetadataReader;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
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

    public record ModSample(
            String id,
            String version,
            String displayName,
            String jarFile,
            boolean nested,
            String parentJar,
            String nestedPath) {
        public ModSample(String id, String version, String displayName) {
            this(id, version, displayName, null, false, null, null);
        }
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
        List<ModSample> mods = sampleMods(server.getServerDirectory());
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

    private static List<ModSample> sampleMods(Path serverDir) {
        List<ModSample> out = new ArrayList<>();
        Map<String, String> nestedToParent = Map.of();
        if (serverDir != null) {
            try {
                nestedToParent = ModJarMetadataReader.nestedIdToParentJar(serverDir.toAbsolutePath().toString());
            } catch (Exception e) {
                WatchtowerMod.LOGGER.debug("Nested jar index failed: {}", e.toString());
            }
        }
        Path modsDir = serverDir != null ? serverDir.resolve("mods") : null;
        try {
            for (IModInfo info : ModList.get().getMods()) {
                String id = info.getModId();
                if ("minecraft".equals(id) || "neoforge".equals(id)) {
                    continue;
                }
                String pathStr = owningFilePath(info);
                String jarFile = null;
                boolean nested = false;
                String parentJar = null;
                String nestedPath = null;

                if (pathStr != null && !pathStr.isBlank()) {
                    String normalized = pathStr.replace('\\', '/');
                    int bang = normalized.indexOf('!');
                    if (bang > 0) {
                        nested = true;
                        String outer = normalized.substring(0, bang);
                        int slash = Math.max(outer.lastIndexOf('/'), outer.lastIndexOf('\\'));
                        parentJar = slash >= 0 ? outer.substring(slash + 1) : outer;
                        nestedPath = normalized.substring(bang + 1);
                        if (nestedPath.startsWith("/")) {
                            nestedPath = nestedPath.substring(1);
                        }
                        jarFile = parentJar;
                    } else {
                        Path p = Path.of(pathStr);
                        jarFile = p.getFileName() != null ? p.getFileName().toString() : null;
                        if (modsDir != null && jarFile != null) {
                            Path direct = modsDir.resolve(jarFile);
                            nested = !Files.isRegularFile(direct)
                                    || normalized.toLowerCase(Locale.ROOT).contains("/jarjar/")
                                    || normalized.toLowerCase(Locale.ROOT).contains("META-INF/jars/".toLowerCase(Locale.ROOT));
                            if (nested) {
                                parentJar = nestedToParent.get(id.toLowerCase(Locale.ROOT));
                            }
                        }
                    }
                }

                if (!nested) {
                    String mappedParent = nestedToParent.get(id.toLowerCase(Locale.ROOT));
                    if (mappedParent != null) {
                        nested = true;
                        parentJar = mappedParent;
                        if (jarFile == null) {
                            jarFile = mappedParent;
                        }
                    }
                }

                out.add(new ModSample(
                        id,
                        info.getVersion().toString(),
                        info.getDisplayName(),
                        jarFile,
                        nested,
                        parentJar,
                        nestedPath));
            }
        } catch (Exception e) {
            WatchtowerMod.LOGGER.debug("Mod list sample failed: {}", e.toString());
        }
        out.sort(Comparator.comparing(ModSample::id));
        return out;
    }

    private static String owningFilePath(IModInfo info) {
        try {
            var owning = info.getOwningFile();
            if (owning == null) {
                return null;
            }
            var file = owning.getFile();
            if (file == null) {
                return null;
            }
            Path path = file.getFilePath();
            return path != null ? path.toString() : null;
        } catch (Exception e) {
            return null;
        }
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
