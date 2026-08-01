package dev.mcstatus.watchtower.core.analyze;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SoftHangDetectorTest {

    @Test
    void bothSignalsRequired() {
        SoftHangDetector.TickStamp s = new SoftHangDetector.TickStamp(0L, 10L, "ticking");
        SoftHangDetector.PollState prev = new SoftHangDetector.PollState(10L, false, 0L);
        SoftHangDetector.Decision d = SoftHangDetector.evaluate(s, prev, 45_000L, 45);
        assertTrue(d.active());
        assertTrue(d.newlyActive());
    }

    @Test
    void wallGapAloneNotEnough() {
        SoftHangDetector.TickStamp s = new SoftHangDetector.TickStamp(0L, 11L, "ticking");
        SoftHangDetector.PollState prev = new SoftHangDetector.PollState(10L, false, 0L);
        SoftHangDetector.Decision d = SoftHangDetector.evaluate(s, prev, 45_000L, 45);
        assertFalse(d.active());
    }

    @Test
    void recoversWhenTicksResume() {
        SoftHangDetector.TickStamp s = new SoftHangDetector.TickStamp(50_000L, 12L, "ticking");
        SoftHangDetector.PollState prev = new SoftHangDetector.PollState(10L, true, 5_000L);
        SoftHangDetector.Decision d = SoftHangDetector.evaluate(s, prev, 55_000L, 45);
        assertFalse(d.active());
        assertTrue(d.newlyRecovered());
    }
}
