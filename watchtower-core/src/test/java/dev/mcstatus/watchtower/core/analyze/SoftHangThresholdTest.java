package dev.mcstatus.watchtower.core.analyze;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

class SoftHangThresholdTest {

    @Test
    void disabledWatchdogUsesConfSeconds() {
        assertEquals(90, SoftHangThreshold.effectiveSeconds(-1, 90));
    }

    @Test
    void defaultWatchdogIsFortyFive() {
        assertEquals(45, SoftHangThreshold.effectiveSeconds(60_000, 90));
    }

    @Test
    void shortWatchdogFloorsAtThirty() {
        assertEquals(30, SoftHangThreshold.effectiveSeconds(20_000, 90));
    }
}
