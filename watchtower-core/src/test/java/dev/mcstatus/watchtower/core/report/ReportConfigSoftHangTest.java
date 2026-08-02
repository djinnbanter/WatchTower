package dev.mcstatus.watchtower.core.report;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ReportConfigSoftHangTest {

    @Test
    void softHangDefaults() {
        ReportConfig c = ReportConfig.fromMap(Map.of());
        assertTrue(c.softHangEnabled());
        assertEquals(90, c.softHangSeconds());
        assertFalse(c.softHangThreadDump());
        assertEquals(15, c.softHangCooldownMin());
    }

    @Test
    void softHangSecondsFromEnv() {
        ReportConfig c = ReportConfig.fromMap(Map.of("SOFT_HANG_SECONDS", "120"));
        assertEquals(120, c.softHangSeconds());
    }
}
