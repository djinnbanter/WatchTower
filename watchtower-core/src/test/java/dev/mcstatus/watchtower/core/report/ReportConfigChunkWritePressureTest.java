package dev.mcstatus.watchtower.core.report;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ReportConfigChunkWritePressureTest {

    @Test
    void chunkWritePressureDefaultsTrue() {
        assertTrue(ReportConfig.fromMap(Map.of()).chunkWritePressureEnabled());
    }

    @Test
    void chunkWritePressureCanDisable() {
        assertFalse(ReportConfig.fromMap(Map.of("CHUNK_WRITE_PRESSURE_ENABLED", "false"))
                .chunkWritePressureEnabled());
    }
}
