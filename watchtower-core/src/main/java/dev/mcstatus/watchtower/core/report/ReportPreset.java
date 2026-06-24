package dev.mcstatus.watchtower.core.report;

/**
 * Headless health report presets for panel cron and quick audits.
 */
public enum ReportPreset {

    QUICK(6, true),
    FULL(24, false),
    PANEL(24, false);

    private final int lookbackHours;
    private final boolean incremental;

    ReportPreset(int lookbackHours, boolean incremental) {
        this.lookbackHours = lookbackHours;
        this.incremental = incremental;
    }

    public int lookbackHours() {
        return lookbackHours;
    }

    public boolean incremental() {
        return incremental;
    }

    public static ReportPreset parse(String raw) {
        if (raw == null || raw.isBlank()) {
            return FULL;
        }
        return switch (raw.strip().toLowerCase()) {
            case "quick" -> QUICK;
            case "panel" -> PANEL;
            case "full" -> FULL;
            default -> throw new IllegalArgumentException("Unknown preset: " + raw + " (use quick|full|panel)");
        };
    }
}
