package dev.mcstatus.watchtower.core.analyze;

import java.util.Locale;

/**
 * GriefLogger / GLRA MariaDB addon failure signatures (FB-11).
 * Distinguishes host ACL (1130) core-disable from rollback-addon connection fails.
 */
public final class DbAddonSignatures {

    public static final String KIND_ACL = "db_addon_acl";
    public static final String KIND_CONNECTION = "db_addon_connection";
    public static final String MOD_GRIEFLOGGER = "grieflogger";
    public static final String MOD_GLRA = "griefloggerrollbackaddon";
    public static final String ISSUE_ID = "signal_db_addon_fail";

    public record Hit(String kind, String modId, String sampleLine) {
    }

    private DbAddonSignatures() {
    }

    /**
     * Match a single log line. Case-insensitive. Prefers GLRA id when present on connection fails.
     * Returns null when blank or not a GriefLogger/GLRA DB-addon failure.
     */
    public static Hit match(String line) {
        if (line == null || line.isBlank()) {
            return null;
        }
        String lower = line.toLowerCase(Locale.ROOT);
        boolean mentionsGlra = lower.contains(MOD_GLRA) || lower.contains("griefloggerrollback");
        boolean mentionsGriefLogger = lower.contains(MOD_GRIEFLOGGER) || lower.contains("daqem.grieflogger");
        boolean hostAcl = lower.contains("1130")
                || lower.contains("is not allowed to connect");
        boolean connectionFailed = lower.contains("database connection failed")
                || lower.contains("failed to connect to mysql")
                || lower.contains("failed to connect to database");

        // Prefer more specific GLRA id when present on connection-fail evidence.
        if (mentionsGlra && connectionFailed) {
            return new Hit(KIND_CONNECTION, MOD_GLRA, sample(line));
        }

        // Core GriefLogger MariaDB host ACL / disable.
        if (mentionsGriefLogger && hostAcl) {
            return new Hit(KIND_ACL, MOD_GRIEFLOGGER, sample(line));
        }

        return null;
    }

    /** Plain-English fix steps for Issues Live. */
    public static java.util.List<String> fixStepsFor(String kind) {
        if (kind == null || kind.isBlank()) {
            return java.util.List.of(
                    "Check MariaDB host ACL (error 1130) and GriefLogger / GLRA database config.",
                    "Allow the Minecraft server host in MariaDB user grants, or point the mod at a reachable DB.");
        }
        return switch (kind.toLowerCase(Locale.ROOT)) {
            case KIND_ACL -> java.util.List.of(
                    "MariaDB host ACL (error 1130) blocked GriefLogger — the core addon disabled itself.",
                    "Grant the Minecraft server host access in MariaDB (or update GriefLogger DB host/user), then restart.",
                    "Do not rewrite grants automatically — fix the DB allow-list or config by hand.");
            case KIND_CONNECTION -> java.util.List.of(
                    "GriefLogger Rollback Addon (griefloggerrollbackaddon) failed its MariaDB connection.",
                    "Check GLRA database config (host, user, password, database type) against a working MariaDB.",
                    "Core GriefLogger may already be fine — fix the rollback addon config separately.");
            default -> java.util.List.of(
                    "Check MariaDB host ACL (error 1130) and GriefLogger / GLRA database config.",
                    "Allow the Minecraft server host in MariaDB user grants, or point the mod at a reachable DB.");
        };
    }

    private static String sample(String line) {
        String s = line.strip();
        return s.length() > 240 ? s.substring(0, 240) : s;
    }
}
