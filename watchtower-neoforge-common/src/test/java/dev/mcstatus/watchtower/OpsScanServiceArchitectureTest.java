package dev.mcstatus.watchtower;

import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Regression: the ~60s ops tick must never pull in full report staging.
 */
class OpsScanServiceArchitectureTest {

    @Test
    void opsScanServiceDoesNotUseFullReportStaging() throws Exception {
        Path src = Path.of("src/main/java/dev/mcstatus/watchtower/OpsScanService.java");
        assertTrue(Files.isRegularFile(src), "OpsScanService source present");
        String text = Files.readString(src);
        assertFalse(text.contains("import dev.mcstatus.watchtower.core.collect.StagingBuilder"),
                "OpsScanService must not import StagingBuilder");
        assertFalse(text.contains("import dev.mcstatus.watchtower.core.report.ReportEngine"),
                "OpsScanService must not import ReportEngine");
        assertFalse(text.matches("(?s).*\\bStagingBuilder\\s*\\."),
                "OpsScanService must not call StagingBuilder");
        assertFalse(text.matches("(?s).*\\bReportEngine\\s*\\."),
                "OpsScanService must not call ReportEngine");
    }
}
