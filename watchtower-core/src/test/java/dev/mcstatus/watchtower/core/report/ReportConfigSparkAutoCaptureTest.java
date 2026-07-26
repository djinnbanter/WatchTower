package dev.mcstatus.watchtower.core.report;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class ReportConfigSparkAutoCaptureTest {

    @Test
    void sparkAutoCaptureDefaultsOff() {
        ReportConfig config = ReportConfig.fromMap(Map.of());
        assertFalse(config.sparkAutoCaptureOnLag());
        assertEquals(45, config.sparkAutoCaptureWindowSec());
        assertEquals(900, config.sparkAutoCaptureCooldownSec());
        assertTrue(config.sparkAutoCaptureCopyToUpload());
    }

    @Test
    void incidentStoryDefaults() {
        ReportConfig config = ReportConfig.fromMap(Map.of());
        assertTrue(config.incidentStoryEnabled());
        assertEquals(30, config.incidentStoryWindowMin());
        assertEquals(48, config.incidentStoryLookbackHours());
        assertEquals(10, config.incidentStoryMax());
    }

    @Test
    void sparkAutoCaptureParsesTruthy() {
        ReportConfig config = ReportConfig.fromMap(Map.of(
                "SPARK_AUTO_CAPTURE_ON_LAG", "true",
                "SPARK_AUTO_CAPTURE_WINDOW_SEC", "30",
                "SPARK_AUTO_CAPTURE_COOLDOWN_SEC", "600",
                "SPARK_AUTO_CAPTURE_COPY_TO_UPLOAD", "false"
        ));
        assertTrue(config.sparkAutoCaptureOnLag());
        assertEquals(30, config.sparkAutoCaptureWindowSec());
        assertEquals(600, config.sparkAutoCaptureCooldownSec());
        assertFalse(config.sparkAutoCaptureCopyToUpload());
    }
}
