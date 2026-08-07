package dev.mcstatus.watchtower;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;

class LagSpikeDetectorRefreshTest {

    @Test
    void sourceRefreshesIssuesLiveAfterResolutionAndApply() throws Exception {
        Path src = Path.of("src/main/java/dev/mcstatus/watchtower/LagSpikeDetector.java");
        assertTrue(Files.isRegularFile(src), "LagSpikeDetector source present");
        String text = Files.readString(src, StandardCharsets.UTF_8);

        assertTrue(text.contains("OpsCacheWriter.updateLagIssueResolution"),
                "resolution path present");
        assertTrue(text.contains("OpsCacheWriter.applyLagIncident"),
                "apply path present");

        int resolveAt = text.indexOf("OpsCacheWriter.updateLagIssueResolution");
        int applyAt = text.indexOf("OpsCacheWriter.applyLagIncident");
        assertTrue(resolveAt >= 0 && applyAt >= 0);

        String afterResolve = text.substring(resolveAt, Math.min(text.length(), resolveAt + 450));
        String afterApply = text.substring(applyAt, Math.min(text.length(), applyAt + 450));

        assertTrue(afterResolve.contains("OpsScanService.refreshIssuesLive"),
                "must refresh Issues Live after updateLagIssueResolution");
        assertTrue(afterApply.contains("OpsScanService.refreshIssuesLive"),
                "must refresh Issues Live after applyLagIncident");
    }
}
