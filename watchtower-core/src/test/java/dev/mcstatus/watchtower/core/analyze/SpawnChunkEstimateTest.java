package dev.mcstatus.watchtower.core.analyze;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class SpawnChunkEstimateTest {

    @Test
    void radiusZeroIsSingleChunk() {
        assertEquals(1, SpawnChunkEstimate.chunkCount(0));
    }

    @Test
    void defaultRadiusTwoIsFiveByFive() {
        assertEquals(25, SpawnChunkEstimate.chunkCount(2));
    }

    @Test
    void negativeIsZero() {
        assertEquals(0, SpawnChunkEstimate.chunkCount(-1));
    }
}
