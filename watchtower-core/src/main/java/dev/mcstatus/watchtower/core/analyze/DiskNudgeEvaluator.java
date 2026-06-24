package dev.mcstatus.watchtower.core.analyze;

import com.google.gson.JsonObject;

import java.util.Locale;

/**
 * Evaluates Overview disk and backup nudge cards from live disk space and last backup metadata.
 */
public final class DiskNudgeEvaluator {

    private DiskNudgeEvaluator() {
    }

    public static JsonObject evaluateDisk(Double diskFreeGb, JsonObject lastBackup) {
        JsonObject nudge = inactiveNudge("disk");
        if (diskFreeGb == null || lastBackup == null) {
            return nudge;
        }
        Double backupSizeGb = jsonDouble(lastBackup, "size_gb");
        if (backupSizeGb == null) {
            backupSizeGb = jsonDouble(lastBackup, "newest_size_gb");
        }
        if (backupSizeGb == null || backupSizeGb <= 0) {
            return nudge;
        }
        if (diskFreeGb < backupSizeGb) {
            nudge.addProperty("active", true);
            nudge.addProperty("kind", "disk_low");
            nudge.addProperty("disk_free_gb", diskFreeGb);
            nudge.addProperty("backup_size_gb", backupSizeGb);
            nudge.addProperty("message", String.format(Locale.US,
                    "Only %.1f GB free — less than the newest backup (%.1f GB).",
                    diskFreeGb, backupSizeGb));
        }
        return nudge;
    }

    public static JsonObject evaluateBackup(JsonObject lastBackup, int backupWarnDays) {
        return evaluateBackup(lastBackup, null, backupWarnDays);
    }

    public static JsonObject evaluateBackup(JsonObject lastBackup, JsonObject backupExternal, int backupWarnDays) {
        JsonObject nudge = inactiveNudge("backup");
        boolean externalConfigured = backupExternal != null && bool(backupExternal, "configured", false);
        boolean externalFresh = externalConfigured
                && ("success".equals(str(backupExternal, "status")) || "running".equals(str(backupExternal, "status")))
                && !bool(backupExternal, "stale", false);

        if (lastBackup == null && !externalConfigured) {
            return nudge;
        }
        String status = lastBackup != null ? str(lastBackup, "status") : null;
        if ("unconfigured".equals(status) && !externalConfigured) {
            return nudge;
        }
        boolean stale = lastBackup != null && bool(lastBackup, "stale", false);
        Double ageDays = lastBackup != null ? jsonDouble(lastBackup, "age_days") : null;
        if (!stale && ageDays != null) {
            stale = ageDays > backupWarnDays;
        }
        if ("not_found".equals(status) && externalFresh) {
            return nudge;
        }
        if ("not_found".equals(status)) {
            nudge.addProperty("active", true);
            nudge.addProperty("kind", "backup_missing");
            nudge.addProperty("message", "No backup archive found in the configured search paths.");
            return nudge;
        }
        if (externalConfigured && (bool(backupExternal, "stale", false) || "stale".equals(str(backupExternal, "status")))) {
            Double extAge = jsonDouble(backupExternal, "age_days");
            nudge.addProperty("active", true);
            nudge.addProperty("kind", "backup_stale");
            if (extAge != null) {
                nudge.addProperty("age_days", extAge);
            }
            nudge.addProperty("warn_days", backupWarnDays);
            String source = str(backupExternal, "source");
            nudge.addProperty("message", String.format(Locale.US,
                    "External backup is %s days old (warn > %d days)%s.",
                    extAge != null ? String.format(Locale.US, "%.1f", extAge) : "?",
                    backupWarnDays,
                    source != null ? " (" + source + ")" : ""));
            return nudge;
        }
        if (stale) {
            nudge.addProperty("active", true);
            nudge.addProperty("kind", "backup_stale");
            if (ageDays != null) {
                nudge.addProperty("age_days", ageDays);
            }
            nudge.addProperty("warn_days", backupWarnDays);
            String path = str(lastBackup, "path");
            nudge.addProperty("message", String.format(Locale.US,
                    "Newest backup is %s days old (warn > %d days)%s.",
                    ageDays != null ? String.format(Locale.US, "%.1f", ageDays) : "?",
                    backupWarnDays,
                    path != null ? ": " + path : ""));
        }
        return nudge;
    }

    private static JsonObject inactiveNudge(String domain) {
        JsonObject nudge = new JsonObject();
        nudge.addProperty("active", false);
        nudge.addProperty("domain", domain);
        return nudge;
    }

    private static Double jsonDouble(JsonObject o, String key) {
        if (o == null || !o.has(key) || o.get(key).isJsonNull()) {
            return null;
        }
        return o.get(key).getAsDouble();
    }

    private static String str(JsonObject o, String key) {
        if (o == null || !o.has(key) || o.get(key).isJsonNull()) {
            return null;
        }
        return o.get(key).getAsString();
    }

    private static boolean bool(JsonObject o, String key, boolean defaultValue) {
        if (o == null || !o.has(key) || o.get(key).isJsonNull()) {
            return defaultValue;
        }
        return o.get(key).getAsBoolean();
    }
}
