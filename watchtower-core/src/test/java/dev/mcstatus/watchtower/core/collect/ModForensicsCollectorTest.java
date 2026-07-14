package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.report.ReportConfig;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class ModForensicsCollectorTest {

    @Test
    void statusSkippedWhenMasterOff() {
        ReportConfig config = ReportConfig.builder().modForensicsScan(false).build();
        JsonObject status = ModForensicsCollector.status(config, ModForensicsCollector.STATE_READY,
                "2026-07-13T12:00:00Z", 10, 100, false, null);
        assertEquals(ModForensicsCollector.STATE_SKIPPED, status.getAsJsonObject("index").get("state").getAsString());
        assertFalse(status.getAsJsonObject("config").get("mod_forensics_scan").getAsBoolean());
        assertFalse(status.getAsJsonObject("config").get("corrupt_jar_walk").getAsBoolean());
    }

    @Test
    void statusReadyWhenEnabled() {
        ReportConfig config = ReportConfig.builder()
                .modForensicsScan(true)
                .forensicsCorruptJarWalk(false)
                .forensicsIndexOnReport(true)
                .build();
        JsonObject last = new JsonObject();
        last.addProperty("at", "2026-07-13T12:00:00Z");
        last.addProperty("corrupt_jars", 0);
        last.addProperty("config_issues", 1);
        last.addProperty("stderr_merged", true);
        JsonObject status = ModForensicsCollector.status(config, ModForensicsCollector.STATE_READY,
                "2026-07-13T11:00:00Z", 187, 84210, false, last);
        assertEquals(ModForensicsCollector.STATE_READY, status.getAsJsonObject("index").get("state").getAsString());
        assertEquals(187, status.getAsJsonObject("index").get("jar_count").getAsInt());
        assertEquals(84210, status.getAsJsonObject("index").get("entry_count").getAsInt());
        assertTrue(status.getAsJsonObject("config").get("mod_forensics_scan").getAsBoolean());
        assertTrue(status.getAsJsonObject("config").get("index_on_report").getAsBoolean());
        assertEquals(1, status.getAsJsonObject("last_report_scan").get("config_issues").getAsInt());
    }

    @Test
    void fromMapDefaultsMatchLockIn() {
        ReportConfig config = ReportConfig.fromMap(java.util.Map.of());
        assertTrue(config.modForensicsScan());
        assertFalse(config.forensicsCorruptJarWalk());
        assertFalse(config.forensicsIndexOnReport());
        assertTrue(config.forensicsStderrPaths().contains("stderr.log"));
    }

    @Test
    void statusIdleWhenEnabledButNoIndexYet() {
        ReportConfig config = ReportConfig.builder().modForensicsScan(true).build();
        JsonObject status = ModForensicsCollector.status(config, null, null, 0, 0, false, null);
        assertEquals(ModForensicsCollector.STATE_IDLE, status.getAsJsonObject("index").get("state").getAsString());
        assertTrue(status.getAsJsonObject("config").get("mod_forensics_scan").getAsBoolean());
    }
}
