package dev.mcstatus.watchtower;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ReportRunOptionsTest {

    @Test
    void emptyAndScheduledKeepTimeoutEnabled() {
        assertFalse(ReportRunOptions.empty().disableTimeout());
        assertFalse(ReportRunOptions.forScheduledRun().disableTimeout());
    }

    @Test
    void firstRunStyleOptionsCanDisableTimeout() {
        ReportRunOptions opts = new ReportRunOptions(24, null, false, false, true);
        assertTrue(opts.disableTimeout());
        assertFalse(opts.scheduled());
    }
}
