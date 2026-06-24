package dev.mcstatus.watchtower.core.panel;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

import java.time.ZonedDateTime;

/**
 * Minimal staging fixtures for panel brief tests.
 */
final class PanelBriefFixtures {

    private PanelBriefFixtures() {
    }

    static JsonObject baseStaging(String panel, boolean panelRunning) {
        JsonObject staging = new JsonObject();
        JsonObject meta = new JsonObject();
        meta.addProperty("lookback_hours", 24);
        meta.addProperty("incremental", false);
        meta.addProperty("panel", panel);
        meta.addProperty("panel_display_name", PanelLabels.displayName(panel));
        meta.addProperty("loader", "neoforge");
        staging.add("meta", meta);
        JsonObject flags = new JsonObject();
        flags.addProperty("java_running", true);
        flags.addProperty("panel_running", panelRunning);
        flags.addProperty("panel_has_daemon", PanelLabels.hasDaemon(panel));
        staging.add("flags", flags);
        JsonObject thresholds = new JsonObject();
        thresholds.addProperty("disk_warn_pct", 85);
        thresholds.addProperty("mem_warn_avail_gb", 2);
        thresholds.addProperty("log_stale_minutes", 15);
        thresholds.addProperty("cant_keep_up_warn", 5);
        staging.add("thresholds", thresholds);
        JsonObject system = new JsonObject();
        system.addProperty("uptime_seconds", 5000);
        system.addProperty("mem_available_gb", 10);
        system.addProperty("disk_use_pct", 5);
        staging.add("system", system);
        staging.add("events", new JsonArray());
        JsonObject mc = new JsonObject();
        mc.addProperty("log_had_activity_in_window", true);
        mc.addProperty("last_log_time", ZonedDateTime.now().format(java.time.format.DateTimeFormatter.ISO_OFFSET_DATE_TIME));
        mc.addProperty("cant_keep_up_count", 0);
        mc.add("new_crash_reports", new JsonArray());
        mc.addProperty("oom_in_logs", false);
        mc.add("tick_lag_evidence", new JsonArray());
        mc.add("oom_evidence", new JsonArray());
        staging.add("minecraft", mc);
        staging.addProperty("health_log_gap_minutes", 1);
        staging.add("kernel_oom_evidence", new JsonArray());
        staging.add("optional", new JsonObject());
        return staging;
    }
}
