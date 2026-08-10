package dev.mcstatus.watchtower.neoforge;

import net.minecraft.core.registries.BuiltInRegistries;
import net.minecraft.resources.ResourceLocation;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.entity.Entity;
import net.minecraft.world.entity.LivingEntity;
import net.minecraft.world.entity.item.ItemEntity;
import net.neoforged.fml.ModList;
import net.neoforged.neoforge.server.ServerLifecycleHooks;
import net.neoforged.neoforgespi.language.IModInfo;

import dev.mcstatus.watchtower.core.collect.ModJarMetadataCache;
import dev.mcstatus.watchtower.runtime.ModRuntime;
import dev.mcstatus.watchtower.runtime.WatchtowerSample;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
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
    private static final int MAX_CENSUS_DIMENSIONS = 24;

    private WatchtowerSampler() {
    }

    public static WatchtowerSample.Sample collect(MinecraftServer server) {
        double mspt = TickMetrics.smoothedMspt();
        double tps = Math.min(20.0, 1000.0 / Math.max(mspt, 0.001));
        int players = server.getPlayerCount();
        long entities = -1;
        long chunks = -1;
        List<WatchtowerSample.DimensionSample> dimensions = new ArrayList<>();

        boolean countEntities = ModRuntime.config().countEntities();
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
                dimensions.add(new WatchtowerSample.DimensionSample(dimId, tps, mspt, levelEntities, levelChunks));
            }
        }

        dimensions.sort(Comparator.comparing(WatchtowerSample.DimensionSample::id));

        int modCount = countMods(server);
        List<WatchtowerSample.ModSample> mods = sampleMods(server.getServerDirectory());
        List<WatchtowerSample.PlayerSample> playerSamples = samplePlayers(server);
        WatchtowerSample.HeapMb heap = sampleHeap();

        return new WatchtowerSample.Sample(
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

    /**
     * Tick-safe sample for lag capture / live metrics — never walks mod jars.
     */
    public static WatchtowerSample.Sample collectLight(MinecraftServer server) {
        double mspt = TickMetrics.smoothedMspt();
        double tps = Math.min(20.0, 1000.0 / Math.max(mspt, 0.001));
        int players = server.getPlayerCount();
        long entities = -1;
        long chunks = -1;
        List<WatchtowerSample.DimensionSample> dimensions = new ArrayList<>();

        boolean countEntities = ModRuntime.config().countEntities();
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
                dimensions.add(new WatchtowerSample.DimensionSample(dimId, tps, mspt, levelEntities, levelChunks));
            }
        }

        dimensions.sort(Comparator.comparing(WatchtowerSample.DimensionSample::id));

        int modCount = countMods(server);
        List<WatchtowerSample.PlayerSample> playerSamples = samplePlayers(server);
        WatchtowerSample.HeapMb heap = sampleHeap();

        return new WatchtowerSample.Sample(
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
                List.of()
        );
    }

    /**
     * Per-dimension world census for pressure analysis. Walks all loaded levels (including
     * mod dimensions). Must run on the server tick thread.
     */
    public static WatchtowerSample.WorldCensus collectWorldCensus(MinecraftServer server) {
        if (!ModRuntime.config().countEntities()) {
            return WatchtowerSample.WorldCensus.empty();
        }
        List<WatchtowerSample.DimensionCensus> rows = new ArrayList<>();
        for (ServerLevel level : server.getAllLevels()) {
            String dimId = level.dimension().location().toString();
            long entities = 0;
            long items = 0;
            long living = 0;
            Map<String, Long> byType = new HashMap<>();
            for (Entity e : level.getAllEntities()) {
                entities++;
                if (e instanceof ItemEntity) {
                    items++;
                } else if (e instanceof LivingEntity) {
                    living++;
                }
                ResourceLocation rl = BuiltInRegistries.ENTITY_TYPE.getKey(e.getType());
                String typeKey = rl != null ? rl.toString() : "unknown";
                byType.merge(typeKey, 1L, Long::sum);
            }
            long loadedChunks = level.getChunkSource().getLoadedChunksCount();
            ChunkLoadBreakdown.Counts load = ChunkLoadBreakdown.collect(level);
            int players = level.players().size();
            rows.add(new WatchtowerSample.DimensionCensus(
                    dimId,
                    entities,
                    items,
                    living,
                    loadedChunks,
                    load.vanillaForced(),
                    load.spawnChunks(),
                    load.modForced(),
                    players,
                    topN(byType, 8)));
        }
        rows.sort(Comparator.comparingLong(WatchtowerSample.DimensionCensus::entities).reversed());
        if (rows.size() > MAX_CENSUS_DIMENSIONS) {
            rows = new ArrayList<>(rows.subList(0, MAX_CENSUS_DIMENSIONS));
        }
        return new WatchtowerSample.WorldCensus(Instant.now(), List.copyOf(rows));
    }

    private static List<WatchtowerSample.TypeCount> topN(Map<String, Long> byType, int n) {
        return byType.entrySet().stream()
                .sorted(Map.Entry.<String, Long>comparingByValue().reversed())
                .limit(n)
                .map(e -> new WatchtowerSample.TypeCount(e.getKey(), e.getValue()))
                .toList();
    }

    public static WatchtowerSample.HeapMb sampleHeapOnly() {
        return WatchtowerSample.sampleHeapOnly();
    }

    private static WatchtowerSample.HeapMb sampleHeap() {
        return WatchtowerSample.sampleHeapOnly();
    }

    private static List<WatchtowerSample.PlayerSample> samplePlayers(MinecraftServer server) {
        List<WatchtowerSample.PlayerSample> out = new ArrayList<>();
        for (ServerPlayer player : server.getPlayerList().getPlayers()) {
            String dim = player.level().dimension().location().toString();
            out.add(new WatchtowerSample.PlayerSample(
                    player.getGameProfile().getName(),
                    player.getUUID().toString(),
                    player.connection.latency(),
                    dim));
        }
        return out;
    }

    private static List<WatchtowerSample.ModSample> sampleMods(Path serverDir) {
        List<WatchtowerSample.ModSample> out = new ArrayList<>();
        Map<String, String> nestedToParent = ModJarMetadataCache.get().nestedIdToParentJar();
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

                out.add(new WatchtowerSample.ModSample(
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
        out.sort(Comparator.comparing(WatchtowerSample.ModSample::id));
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

    public static WatchtowerSample.Sample currentSample() {
        MinecraftServer server = ServerLifecycleHooks.getCurrentServer();
        if (server == null) {
            return new WatchtowerSample.Sample(0, 0, 0, -1, -1, 0, List.of(),
                    new WatchtowerSample.SessionMspt(0, 0, 0, 0, null),
                    new WatchtowerSample.HeapMb(0, 0, 0), List.of(), List.of());
        }
        return collect(server);
    }
}
