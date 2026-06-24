package dev.mcstatus.watchtower;

import dev.mcstatus.watchtower.core.report.ReportSchedule;
import dev.mcstatus.watchtower.core.WatchtowerFiles;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class WatchtowerConfWriterTest {

    @TempDir
    Path temp;

    @Test
    void upsertAndReadReportInterval() throws Exception {
        Path conf = temp.resolve(WatchtowerFiles.CONF_FILENAME);
        Files.writeString(conf, "LOOKBACK_HOURS=24\n");
        WatchtowerConfWriter.upsertKey(conf, "REPORT_INTERVAL_MINUTES", "60");
        assertEquals(60, WatchtowerConfWriter.loadReportIntervalMinutes(conf));
        Map<String, String> map = WatchtowerConfWriter.readMap(conf);
        assertEquals("60", map.get("REPORT_INTERVAL_MINUTES"));
    }

    @Test
    void loadWallClockSchedule() throws Exception {
        Path conf = temp.resolve(WatchtowerFiles.CONF_FILENAME);
        Files.writeString(conf, """
                REPORT_SCHEDULE_MODE=wall_clock
                REPORT_WALL_CLOCK_HOURS=0,12
                """);
        ReportSchedule schedule = WatchtowerConfWriter.loadReportSchedule(conf);
        assertEquals(ReportSchedule.ScheduleMode.WALL_CLOCK, schedule.mode());
        assertEquals(List.of(0, 12), schedule.wallClockHours());
    }

    @Test
    void upsertLineReplacesExistingKey() {
        String text = "LOOKBACK_HOURS=24\nINCREMENTAL=true\n";
        String updated = WatchtowerConfWriter.upsertLine(text, "LOOKBACK_HOURS", "168");
        assertTrue(updated.contains("LOOKBACK_HOURS=168"));
        assertFalse(updated.contains("LOOKBACK_HOURS=24"));
    }
}
