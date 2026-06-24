package dev.mcstatus.watchtower;

import dev.mcstatus.watchtower.core.report.ReportSchedule;
import net.minecraft.server.MinecraftServer;

import java.time.LocalDateTime;
import java.util.List;

public final class WatchtowerScheduler {
    private int sampleTickCounter;
    private int liveTickCounter;
    private int reportTickCounter;
    private int configuredReportMinutes = -1;
    /** -1 = use config file; 0 = disabled; >0 = override interval in minutes */
    private int reportIntervalOverride = -1;
    private ReportSchedule scheduleOverride;
    private ReportSchedule effectiveSchedule = ReportSchedule.off();
    private String lastWallClockSlotFired;
    private int wallClockCheckTickCounter;
    private LocalDateTime lastReportAt;

    public void resetReportSchedule() {
        reportTickCounter = 0;
        wallClockCheckTickCounter = 0;
        configuredReportMinutes = effectiveReportMinutes();
        effectiveSchedule = resolveSchedule();
    }

    public void setReportIntervalMinutes(int minutes) {
        reportIntervalOverride = minutes;
        if (minutes <= 0) {
            scheduleOverride = ReportSchedule.off();
        } else {
            scheduleOverride = ReportSchedule.interval(minutes);
        }
        resetReportSchedule();
    }

    public void setReportSchedule(ReportSchedule schedule) {
        scheduleOverride = schedule;
        if (schedule.mode() == ReportSchedule.ScheduleMode.INTERVAL) {
            reportIntervalOverride = schedule.intervalMinutes();
        } else if (schedule.mode() == ReportSchedule.ScheduleMode.OFF) {
            reportIntervalOverride = 0;
        } else {
            reportIntervalOverride = -1;
        }
        resetReportSchedule();
    }

    public ReportSchedule effectiveSchedule() {
        return resolveSchedule();
    }

    public int effectiveReportMinutes() {
        ReportSchedule schedule = resolveSchedule();
        if (schedule.mode() == ReportSchedule.ScheduleMode.INTERVAL) {
            return schedule.intervalMinutes();
        }
        if (schedule.mode() == ReportSchedule.ScheduleMode.WALL_CLOCK) {
            return 720;
        }
        return 0;
    }

    /** Minutes until the next scheduled report, or -1 when scheduling is off. */
    public int minutesUntilNextReport() {
        ReportSchedule schedule = resolveSchedule();
        if (!schedule.isEnabled()) {
            return -1;
        }
        if (schedule.mode() == ReportSchedule.ScheduleMode.WALL_CLOCK) {
            return schedule.minutesUntilNext(LocalDateTime.now(ReportSchedule.serverZone()), lastWallClockSlotFired);
        }
        int reportMinutes = schedule.intervalMinutes();
        if (reportMinutes <= 0) {
            return -1;
        }
        int reportTicks = reportMinutes * 60 * 20;
        int remainingTicks = Math.max(0, reportTicks - reportTickCounter);
        return Math.max(1, (int) Math.ceil(remainingTicks / (60.0 * 20.0)));
    }

    public String nextReportAtIso() {
        ReportSchedule schedule = resolveSchedule();
        if (!schedule.isEnabled()) {
            return null;
        }
        if (schedule.mode() == ReportSchedule.ScheduleMode.WALL_CLOCK) {
            LocalDateTime next = schedule.nextWallClockSlot(
                    LocalDateTime.now(ReportSchedule.serverZone()),
                    lastWallClockSlotFired
            );
            return ReportSchedule.toIso(next);
        }
        int minutes = minutesUntilNextReport();
        if (minutes <= 0) {
            return null;
        }
        return ReportSchedule.toIso(LocalDateTime.now(ReportSchedule.serverZone()).plusMinutes(minutes));
    }

    public void onReportCompleted(boolean scheduled) {
        lastReportAt = LocalDateTime.now(ReportSchedule.serverZone());
        if (scheduled && effectiveSchedule().mode() == ReportSchedule.ScheduleMode.WALL_CLOCK) {
            String due = effectiveSchedule().dueWallClockSlot(lastReportAt, lastWallClockSlotFired, null);
            if (due == null) {
                due = ReportSchedule.slotKey(lastReportAt.truncatedTo(java.time.temporal.ChronoUnit.HOURS));
            }
            lastWallClockSlotFired = due;
        }
        if (scheduled && effectiveSchedule().mode() == ReportSchedule.ScheduleMode.INTERVAL) {
            reportTickCounter = 0;
        }
    }

    public void loadPersistedScheduleState(String lastScheduledSlot, String lastScheduledReportAt) {
        lastWallClockSlotFired = lastScheduledSlot;
        lastReportAt = ReportSchedule.parseIso(lastScheduledReportAt);
    }

    public String lastWallClockSlotFired() {
        return lastWallClockSlotFired;
    }

    public void onServerTick(MinecraftServer server, WatchtowerRuntimeState state, Runnable reportTrigger) {
        int liveIntervalSec = liveIntervalSeconds();
        int liveTicks = Math.max(20, liveIntervalSec * 20);
        liveTickCounter++;
        if (liveTickCounter >= liveTicks) {
            liveTickCounter = 0;
            try {
                LiveMetricsService.get().recordTick(server);
            } catch (Exception e) {
                WatchtowerMod.LOGGER.debug("Live metrics tick failed: {}", e.toString());
            }
        }

        int sampleIntervalSeconds = WatchtowerConfig.SAMPLE_INTERVAL_SECONDS.get();
        int sampleTicks = Math.max(20, sampleIntervalSeconds * 20);
        sampleTickCounter++;
        if (sampleTickCounter >= sampleTicks) {
            sampleTickCounter = 0;
            sample(server);
        }

        ReportSchedule schedule = resolveSchedule();
        int reportMinutes = effectiveReportMinutes();
        if (reportMinutes != configuredReportMinutes) {
            configuredReportMinutes = reportMinutes;
            reportTickCounter = 0;
        }

        if (!schedule.isEnabled()) {
            return;
        }

        if (schedule.mode() == ReportSchedule.ScheduleMode.WALL_CLOCK) {
            wallClockCheckTickCounter++;
            if (wallClockCheckTickCounter < 20 * 60) {
                return;
            }
            wallClockCheckTickCounter = 0;
            LocalDateTime now = LocalDateTime.now(ReportSchedule.serverZone());
            String dueSlot = schedule.dueWallClockSlot(now, lastWallClockSlotFired, lastReportAt);
            if (dueSlot != null && !state.isReportRunning()) {
                reportTrigger.run();
            }
            return;
        }

        int reportTicks = reportMinutes * 60 * 20;
        reportTickCounter++;
        if (reportTickCounter >= reportTicks) {
            reportTickCounter = 0;
            if (!state.isReportRunning()) {
                reportTrigger.run();
            }
        }
    }

    private ReportSchedule resolveSchedule() {
        if (scheduleOverride != null) {
            return scheduleOverride;
        }
        return effectiveSchedule;
    }

    void applyScheduleFromConf(ReportSchedule schedule) {
        effectiveSchedule = schedule == null ? ReportSchedule.off() : schedule;
        if (scheduleOverride == null) {
            configuredReportMinutes = effectiveReportMinutes();
            reportTickCounter = 0;
            wallClockCheckTickCounter = 0;
        }
    }

    private static int liveIntervalSeconds() {
        try {
            return WatchtowerConfig.LIVE_SAMPLE_INTERVAL_SECONDS.get();
        } catch (IllegalStateException e) {
            return 1;
        }
    }

    private void sample(MinecraftServer server) {
        try {
            WatchtowerSampler.Sample sample = WatchtowerSampler.collect(server);
            SnapshotWriter.write(server, sample);
            StateSampler.recordSample(server, sample);
        } catch (Exception e) {
            WatchtowerMod.LOGGER.warn("Failed to write watchtower snapshot: {}", e.toString());
        }
    }

    public void sampleNow(MinecraftServer server) {
        sample(server);
        LiveMetricsService.get().recordTick(server);
    }
}
