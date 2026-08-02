package dev.mcstatus.watchtower.core.report;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ReportConfigChunkWritePressureTest {

    @Test
    void chunkWritePressureDefaultsTrue() {
        ReportConfig c = ReportConfig.fromMap(Map.of());
        assertTrue(c.chunkWritePressureEnabled());
        assertEquals(48, c.chunkWriteGrowthChunks());
        assertEquals(3, c.chunkWriteSustainedScans());
    }

    @Test
    void chunkWritePressureCanDisable() {
        assertFalse(ReportConfig.fromMap(Map.of("CHUNK_WRITE_PRESSURE_ENABLED", "false"))
                .chunkWritePressureEnabled());
    }

    @Test
    void chunkWriteThresholdsFromConf() {
        ReportConfig c = ReportConfig.fromMap(Map.of(
                "CHUNK_WRITE_GROWTH_CHUNKS", "96",
                "CHUNK_WRITE_SUSTAINED_SCANS", "5"
        ));
        assertEquals(96, c.chunkWriteGrowthChunks());
        assertEquals(5, c.chunkWriteSustainedScans());
    }
}
