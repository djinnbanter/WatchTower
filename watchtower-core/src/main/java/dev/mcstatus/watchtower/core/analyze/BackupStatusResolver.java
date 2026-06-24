package dev.mcstatus.watchtower.core.analyze;

import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.collect.ExternalBackupDetector;
import dev.mcstatus.watchtower.core.report.ReportConfig;

/**
 * Combines local disk backup scan results with external heartbeat signals.
 */
public final class BackupStatusResolver {

    public enum Mode {
        NONE,
        LOCAL_ONLY,
        EXTERNAL_ONLY,
        HYBRID
    }

    public record Resolved(
            Mode mode,
            boolean localConfigured,
            boolean externalConfigured,
            boolean suppressLocalNotFound,
            boolean overallOk,
            boolean overallStale,
            boolean overallMissing,
            String overallStatus
    ) {
    }

    private BackupStatusResolver() {
    }

    public static Resolved resolve(JsonObject lastBackup, JsonObject backupExternal, ReportConfig config) {
        boolean localConfigured = hasLocalDirs(config);
        boolean externalConfigured = isExternalActive(backupExternal, config);
        boolean suppress = config != null && config.backupSuppressLocalMissing();
        return resolveInternal(lastBackup, backupExternal, localConfigured, externalConfigured, suppress);
    }

    public static Resolved resolve(
            JsonObject lastBackup,
            JsonObject backupExternal,
            boolean localConfigured,
            boolean externalConfigured,
            boolean suppressLocalMissing
    ) {
        return resolveInternal(lastBackup, backupExternal, localConfigured, externalConfigured, suppressLocalMissing);
    }

    private static Resolved resolveInternal(
            JsonObject lastBackup,
            JsonObject backupExternal,
            boolean localConfigured,
            boolean externalConfigured,
            boolean suppress
    ) {
        Mode mode = resolveMode(localConfigured, externalConfigured);

        suppress = suppress && externalConfigured && isExternalFresh(backupExternal);

        boolean localNotFound = lastBackup != null && "not_found".equals(str(lastBackup, "status"));
        boolean localStale = lastBackup != null && (bool(lastBackup, "stale", false) || "stale".equals(str(lastBackup, "status")));
        boolean localOk = lastBackup != null && "success".equals(str(lastBackup, "status")) && !localStale;

        boolean extStale = backupExternal != null && bool(backupExternal, "stale", false);
        boolean extMissing = backupExternal != null && "missing".equals(str(backupExternal, "status"));
        boolean extFailed = backupExternal != null && "failed".equals(str(backupExternal, "status"));
        boolean extRunning = backupExternal != null && "running".equals(str(backupExternal, "status"));
        boolean extOk = backupExternal != null && "success".equals(str(backupExternal, "status")) && !extStale;

        boolean overallOk;
        boolean overallStale;
        boolean overallMissing;

        switch (mode) {
            case EXTERNAL_ONLY -> {
                overallOk = extOk || extRunning;
                overallStale = extStale || ("stale".equals(str(backupExternal, "status")));
                overallMissing = extMissing && !extRunning;
            }
            case LOCAL_ONLY -> {
                overallOk = localOk;
                overallStale = localStale;
                overallMissing = localNotFound;
            }
            case HYBRID -> {
                overallOk = extOk || extRunning || localOk;
                overallStale = extStale || localStale
                        || ("stale".equals(str(backupExternal, "status")));
                overallMissing = !suppress && localNotFound && !extOk && !extRunning;
                if (extMissing && !localOk) {
                    overallMissing = true;
                }
            }
            default -> {
                overallOk = false;
                overallStale = false;
                overallMissing = false;
            }
        }

        if (extFailed) {
            overallOk = false;
            overallStale = true;
        }

        String overallStatus;
        if (mode == Mode.NONE) {
            overallStatus = "unconfigured";
        } else if (overallOk) {
            overallStatus = "success";
        } else if (overallStale || extFailed) {
            overallStatus = "stale";
        } else if (overallMissing || localNotFound && !suppress) {
            overallStatus = "not_found";
        } else if (extRunning) {
            overallStatus = "running";
        } else {
            overallStatus = "unknown";
        }

        return new Resolved(
                mode,
                localConfigured,
                externalConfigured,
                suppress && localNotFound,
                overallOk,
                overallStale,
                overallMissing,
                overallStatus
        );
    }

    public static Mode resolveMode(boolean localConfigured, boolean externalConfigured) {
        if (localConfigured && externalConfigured) {
            return Mode.HYBRID;
        }
        if (externalConfigured) {
            return Mode.EXTERNAL_ONLY;
        }
        if (localConfigured) {
            return Mode.LOCAL_ONLY;
        }
        return Mode.NONE;
    }

    public static String modeId(Mode mode) {
        return switch (mode) {
            case EXTERNAL_ONLY -> "external_only";
            case LOCAL_ONLY -> "local_only";
            case HYBRID -> "hybrid";
            default -> "none";
        };
    }

    private static boolean hasLocalDirs(ReportConfig config) {
        return config != null && config.hasBackupDirs();
    }

    private static boolean isExternalActive(JsonObject backupExternal, ReportConfig config) {
        if (backupExternal != null && backupExternal.has("configured")) {
            return backupExternal.get("configured").getAsBoolean();
        }
        return config != null && ExternalBackupDetector.isConfigured(config);
    }

    private static boolean isExternalFresh(JsonObject backupExternal) {
        if (backupExternal == null) {
            return false;
        }
        String status = str(backupExternal, "status");
        return ("success".equals(status) || "running".equals(status)) && !bool(backupExternal, "stale", false);
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
