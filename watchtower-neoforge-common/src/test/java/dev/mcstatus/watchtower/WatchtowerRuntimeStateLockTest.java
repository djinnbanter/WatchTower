package dev.mcstatus.watchtower;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class WatchtowerRuntimeStateLockTest {

    @Test
    void releaseRunningLocksOnStopClearsDiscoveryAndReportFlags() {
        WatchtowerRuntimeState state = new WatchtowerRuntimeState();

        assertTrue(state.tryBeginDiscovery());
        assertTrue(state.isDiscoveryRunning());
        assertTrue(state.tryBeginReport());
        assertTrue(state.isReportRunning());

        state.releaseRunningLocksOnStop();

        assertFalse(state.isDiscoveryRunning());
        assertFalse(state.isReportRunning());
        assertTrue(state.tryBeginDiscovery(), "discovery must be acquirable after stop release");
        assertTrue(state.tryBeginReport(), "report must be acquirable after stop release");

        state.releaseRunningLocksOnStop();
        assertFalse(state.isDiscoveryRunning());
        assertFalse(state.isReportRunning());
    }

    @Test
    void releaseRunningLocksOnStopIsSafeWhenNothingRunning() {
        WatchtowerRuntimeState state = new WatchtowerRuntimeState();
        assertDoesNotThrow(state::releaseRunningLocksOnStop);
        assertTrue(state.tryBeginDiscovery());
        state.releaseRunningLocksOnStop();
        assertFalse(state.isDiscoveryRunning());
    }
}
