package dev.mcstatus.watchtower;

import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertTrue;

/** Wizard Initial discovery creates a BAU facts baseline via ReportEngine. */
class InitialDiscoveryArchitectureTest {

    @Test
    void discoveryRunnerUsesReportEngineForBaseline() throws Exception {
        Path src = Path.of("src/main/java/dev/mcstatus/watchtower/InitialDiscoveryRunner.java");
        assertTrue(Files.isRegularFile(src), "InitialDiscoveryRunner source present");
        String text = Files.readString(src);
        assertTrue(text.contains("import dev.mcstatus.watchtower.core.report.ReportEngine"),
                "InitialDiscoveryRunner must import ReportEngine for the first-run baseline");
        assertTrue(text.contains("ReportEngine.run"),
                "InitialDiscoveryRunner must call ReportEngine.run for the deep audit baseline");
    }
}
