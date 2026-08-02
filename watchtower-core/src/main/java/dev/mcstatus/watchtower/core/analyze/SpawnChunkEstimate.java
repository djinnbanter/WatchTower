package dev.mcstatus.watchtower.core.analyze;

/**
 * Pure helpers for world-pressure chunk-load breakdown (no Minecraft types).
 */
public final class SpawnChunkEstimate {

    private SpawnChunkEstimate() {
    }

    /**
     * Approximate vanilla START-ticket footprint from {@code spawnChunkRadius}.
     * Side length {@code 2 * radius + 1} → square chunk count.
     */
    public static int chunkCount(int radius) {
        if (radius < 0) {
            return 0;
        }
        int side = 2 * radius + 1;
        // Guard absurd gamerule values
        if (side > 64) {
            side = 64;
        }
        return side * side;
    }
}
