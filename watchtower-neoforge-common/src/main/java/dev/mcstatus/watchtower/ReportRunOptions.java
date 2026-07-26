package dev.mcstatus.watchtower;

/**
 * Optional overrides for a single report run (dashboard / command).
 */
public record ReportRunOptions(
        Integer lookbackHours,
        String since,
        Boolean incremental,
        boolean scheduled,
        boolean disableTimeout
) {
    public ReportRunOptions(Integer lookbackHours, String since, Boolean incremental) {
        this(lookbackHours, since, incremental, false, false);
    }

    public ReportRunOptions(Integer lookbackHours, String since, Boolean incremental, boolean scheduled) {
        this(lookbackHours, since, incremental, scheduled, false);
    }

    public static ReportRunOptions empty() {
        return new ReportRunOptions(null, null, null, false, false);
    }

    public static ReportRunOptions forScheduledRun() {
        return new ReportRunOptions(null, null, null, true, false);
    }
}
