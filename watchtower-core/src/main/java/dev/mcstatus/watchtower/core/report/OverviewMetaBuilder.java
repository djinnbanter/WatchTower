package dev.mcstatus.watchtower.core.report;

import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.analyze.DiskNudgeEvaluator;
import dev.mcstatus.watchtower.core.collect.HostEnvironmentDetector;
import dev.mcstatus.watchtower.core.collect.ReportArtifactFinder;
import dev.mcstatus.watchtower.core.collect.UptimeSummaryBuilder;
import dev.mcstatus.watchtower.core.update.ReleaseVersionChecker;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;

/**
 * Builds Overview metadata for dashboard freshness, uptime, nudges, and environment context.
 */
public final class OverviewMetaBuilder {

    private static final double STALE_HOURS = 24.0;

    private OverviewMetaBuilder() {
    }

    public static JsonObject build(
            Path reportDir,
            Path serverDir,
            String panelId,
            JsonObject systemBasics,
            JsonObject optional,
            String modVersion,
            ReportConfig config
    ) {
        JsonObject meta = new JsonObject();
        applyReportFreshness(meta, reportDir);
        meta.add("uptime", UptimeSummaryBuilder.build(serverDir, systemBasics));

        JsonObject lastBackup = optional != null && optional.has("last_backup") && optional.get("last_backup").isJsonObject()
                ? optional.getAsJsonObject("last_backup")
                : null;
        JsonObject backupExternal = optional != null && optional.has("backup_external") && optional.get("backup_external").isJsonObject()
                ? optional.getAsJsonObject("backup_external")
                : null;
        Double diskFreeGb = systemBasics != null && systemBasics.has("disk_free_gb") && !systemBasics.get("disk_free_gb").isJsonNull()
                ? systemBasics.get("disk_free_gb").getAsDouble()
                : null;
        meta.add("disk_nudge", DiskNudgeEvaluator.evaluateDisk(diskFreeGb, lastBackup));
        meta.add("backup_nudge", DiskNudgeEvaluator.evaluateBackup(lastBackup, backupExternal, config.backupWarnDays()));

        JsonObject environment = HostEnvironmentDetector.detect(panelId, systemBasics);
        meta.add("environment", environment);

        meta.addProperty("version", modVersion != null ? modVersion : "unknown");
        meta.add("update_check", buildUpdateCheck(modVersion, config.updateCheck()));
        return meta;
    }

    private static void applyReportFreshness(JsonObject meta, Path reportDir) {
        try {
            Path latestFacts = ReportArtifactFinder.findLatestFacts(reportDir);
            if (latestFacts == null) {
                meta.addProperty("stale", true);
                return;
            }
            Instant mtime = Files.getLastModifiedTime(latestFacts).toInstant();
            ZonedDateTime at = mtime.atZone(ZoneId.systemDefault());
            meta.addProperty("last_report_at", at.toString());
            double ageHours = Duration.between(mtime, Instant.now()).toMinutes() / 60.0;
            meta.addProperty("age_hours", Math.round(ageHours * 10.0) / 10.0);
            meta.addProperty("stale", ageHours >= STALE_HOURS);
            meta.addProperty("last_report_file", latestFacts.getFileName().toString());
        } catch (IOException ignored) {
            meta.addProperty("stale", true);
        }
    }

    private static JsonObject buildUpdateCheck(String modVersion, boolean enabled) {
        if (!enabled) {
            JsonObject placeholder = new JsonObject();
            placeholder.addProperty("enabled", false);
            placeholder.addProperty("current", modVersion != null ? modVersion : "unknown");
            placeholder.addProperty("update_available", false);
            return placeholder;
        }
        return ReleaseVersionChecker.check(modVersion, true);
    }
}
