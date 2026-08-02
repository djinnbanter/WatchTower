package dev.mcstatus.watchtower.neoforge;

import it.unimi.dsi.fastutil.longs.LongOpenHashSet;
import it.unimi.dsi.fastutil.longs.LongSet;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.level.ForcedChunksSavedData;
import net.minecraft.world.level.GameRules;
import net.minecraft.world.level.Level;
import net.neoforged.neoforge.common.world.chunk.ForcedChunkManager;
import dev.mcstatus.watchtower.core.analyze.SpawnChunkEstimate;

/**
 * Cheap chunk-load breakdown for the world census (tick-thread safe, rare cadence).
 */
final class ChunkLoadBreakdown {

    private ChunkLoadBreakdown() {
    }

    record Counts(long spawnChunks, long vanillaForced, long modForced) {
    }

    static Counts collect(ServerLevel level) {
        long vanillaForced = level.getForcedChunks().size();
        long modForced = countModForcedChunks(level);
        long spawnChunks = estimateSpawnChunks(level);
        return new Counts(spawnChunks, vanillaForced, modForced);
    }

    /** Overworld only — estimate from {@code spawnChunkRadius} gamerule. */
    static long estimateSpawnChunks(ServerLevel level) {
        if (level.dimension() != Level.OVERWORLD) {
            return 0;
        }
        int radius = level.getGameRules().getInt(GameRules.RULE_SPAWN_CHUNK_RADIUS);
        return SpawnChunkEstimate.chunkCount(radius);
    }

    /**
     * Unique chunk positions held by NeoForge {@link ForcedChunksSavedData} block/entity
     * force-load trackers (TicketController path). Not every custom DistanceManager ticket.
     */
    static long countModForcedChunks(ServerLevel level) {
        try {
            ForcedChunksSavedData data = level.getDataStorage()
                    .computeIfAbsent(ForcedChunksSavedData.factory(), ForcedChunksSavedData.FILE_ID);
            LongOpenHashSet unique = new LongOpenHashSet();
            addTrackerChunks(unique, data.getBlockForcedChunks());
            addTrackerChunks(unique, data.getEntityForcedChunks());
            return unique.size();
        } catch (Throwable t) {
            // Older worlds / unexpected NeoForge shape — census must not break sampling
            return 0;
        }
    }

    private static <T extends Comparable<? super T>> void addTrackerChunks(
            LongOpenHashSet unique,
            ForcedChunkManager.TicketTracker<T> tracker) {
        if (tracker == null || tracker.isEmpty()) {
            return;
        }
        for (LongSet set : tracker.getChunks().values()) {
            if (set != null) {
                unique.addAll(set);
            }
        }
        for (LongSet set : tracker.getTickingChunks().values()) {
            if (set != null) {
                unique.addAll(set);
            }
        }
    }
}
