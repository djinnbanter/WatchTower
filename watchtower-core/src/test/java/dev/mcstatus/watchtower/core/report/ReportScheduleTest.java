package dev.mcstatus.watchtower.core.report;

import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class ReportScheduleTest {

    @Test
    void minutesUntilNextFrom1030() {
        ReportSchedule schedule = ReportSchedule.wallClock(List.of(0, 12));
        LocalDateTime now = LocalDateTime.of(2025, 6, 23, 10, 30);
        assertEquals(90, schedule.minutesUntilNext(now));
    }

    @Test
    void minutesUntilNextFrom1300() {
        ReportSchedule schedule = ReportSchedule.wallClock(List.of(0, 12));
        LocalDateTime now = LocalDateTime.of(2025, 6, 23, 13, 0);
        assertEquals(660, schedule.minutesUntilNext(now));
    }

    @Test
    void dueAtExactSlot() {
        ReportSchedule schedule = ReportSchedule.wallClock(List.of(0, 12));
        LocalDateTime now = LocalDateTime.of(2025, 6, 23, 12, 0);
        String due = schedule.dueWallClockSlot(now, null, null);
        assertEquals("2025-06-23T12", due);
    }

    @Test
    void notDueAfterFiredSlot() {
        ReportSchedule schedule = ReportSchedule.wallClock(List.of(0, 12));
        LocalDateTime now = LocalDateTime.of(2025, 6, 23, 12, 1);
        String due = schedule.dueWallClockSlot(now, "2025-06-23T12", LocalDateTime.of(2025, 6, 23, 12, 0));
        assertNull(due);
    }

    @Test
    void missedSlotWithinGrace() {
        ReportSchedule schedule = ReportSchedule.wallClock(List.of(0, 12));
        LocalDateTime now = LocalDateTime.of(2025, 6, 23, 12, 45);
        LocalDateTime lastReport = LocalDateTime.of(2025, 6, 23, 8, 0);
        String due = schedule.dueWallClockSlot(now, null, lastReport);
        assertEquals("2025-06-23T12", due);
    }

    @Test
    void fromMapPreservesLegacyInterval() {
        Map<String, String> map = new HashMap<>();
        map.put("REPORT_INTERVAL_MINUTES", "60");
        ReportSchedule schedule = ReportSchedule.fromMap(map);
        assertEquals(ReportSchedule.ScheduleMode.INTERVAL, schedule.mode());
        assertEquals(60, schedule.intervalMinutes());
    }

    @Test
    void fromMapDefaultWallClockForNewInstall() {
        ReportSchedule schedule = ReportSchedule.fromMap(Map.of());
        assertEquals(ReportSchedule.ScheduleMode.WALL_CLOCK, schedule.mode());
        assertEquals(List.of(0, 12), schedule.wallClockHours());
    }

    @Test
    void parseHoursNormalizesAndSorts() {
        assertEquals(List.of(0, 12), ReportSchedule.parseHours("12,0"));
    }
}
