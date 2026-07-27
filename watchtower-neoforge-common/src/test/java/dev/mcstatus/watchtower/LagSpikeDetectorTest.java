package dev.mcstatus.watchtower;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class LagSpikeDetectorTest {

    @Test
    void autoSparkOnlyOnCriticalSeverity() {
        assertTrue(LagSpikeDetector.shouldScheduleAutoSpark("critical"));
        assertFalse(LagSpikeDetector.shouldScheduleAutoSpark("warning"));
        assertFalse(LagSpikeDetector.shouldScheduleAutoSpark("ok"));
        assertFalse(LagSpikeDetector.shouldScheduleAutoSpark(null));
    }
}
