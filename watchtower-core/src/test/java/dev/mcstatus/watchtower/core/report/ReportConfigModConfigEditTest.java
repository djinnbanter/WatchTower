package dev.mcstatus.watchtower.core.report;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ReportConfigModConfigEditTest {

    @Test
    void modConfigEditDefaultsTrue() {
        assertTrue(ReportConfig.fromMap(Map.of()).modConfigEditEnabled());
    }

    @Test
    void modConfigEditCanDisable() {
        assertFalse(ReportConfig.fromMap(Map.of("MOD_CONFIG_EDIT_ENABLED", "false")).modConfigEditEnabled());
    }
}
