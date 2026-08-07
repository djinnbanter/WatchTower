package dev.mcstatus.watchtower;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;

class SchedulerRefreshWiringTest {

    @Test
    void handleSettingsSourceRefreshesAlwaysOnOpsLogSchedule() throws Exception {
        Path src = Path.of("src/main/java/dev/mcstatus/watchtower/DashboardHttpServer.java");
        if (!Files.isRegularFile(src)) {
            src = Path.of("../watchtower-neoforge-common/src/main/java/dev/mcstatus/watchtower/DashboardHttpServer.java");
        }
        if (!Files.isRegularFile(src)) {
            src = Path.of("watchtower-neoforge-common/src/main/java/dev/mcstatus/watchtower/DashboardHttpServer.java");
        }
        assertTrue(Files.isRegularFile(src), "DashboardHttpServer.java must be readable for wiring assert");
        String text = Files.readString(src, StandardCharsets.UTF_8);

        assertTrue(text.contains("opsLogScanSec"), "settings POST must handle opsLogScanSec");
        assertTrue(
                text.contains("AlwaysOnOpsLogScheduler.get().refreshSchedule()"),
                "After OPS_LOG_SCAN_SEC save, AlwaysOnOpsLogScheduler.refreshSchedule must be called");
        assertTrue(
                text.contains("BackupPollScheduler.get().refreshSchedule()"),
                "After backup dirs save, BackupPollScheduler.refreshSchedule must be called");
    }
}
