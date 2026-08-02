package dev.mcstatus.watchtower.core.ops;

/**
 * L2.5 ops cache field names and version constant.
 */
public final class OpsCacheSchema {

    public static final int SCHEMA_VERSION = 3;

    public static final String SCHEMA_VERSION_KEY = "schema_version";
    public static final String UPDATED_AT = "updated_at";
    public static final String REPORT_RECONCILE_AT = "report_reconcile_at";
    public static final String OPS_CACHE_SEQ = "ops_cache_seq";
    public static final String LEDGER_SEQ = "ledger_seq";
    public static final String CRASHES = "crashes";
    public static final String SCORECARD = "scorecard";
    public static final String ACTIVITY = "activity";
    public static final String LAG_ISSUES = "lag_issues";
    public static final String MOD_LOG_ERRORS = "mod_log_errors";
    public static final String RUNNING_MODS = "running_mods";
    public static final String MOD_ISSUES = "mod_issues";
    public static final String SILENT_FAILS = "silent_fails";
    public static final String JOIN_CLINIC = "join_clinic";
    public static final String WORLD_PRESSURE = "world_pressure";
    public static final String RIGHT_NOW = "right_now";
    public static final String LOG_STALE = "log_stale";
    public static final String BACKUPS_LIVE = "backups_live";
    public static final String BACKUP_EXTERNAL = "backup_external";
    public static final String MODS_INVENTORY = "mods_inventory";
    public static final String DISK_JUMP = "disk_jump";
    public static final String DISK_PROJECTION = "disk_projection";
    public static final String INCIDENT_STORIES = "incident_stories";
    public static final String WEEKLY_DIGEST = "weekly_digest";
    public static final String WEEKLY_DIGEST_HISTORY = "history";
    /** Continuous Mods deep / forensics ledger (fingerprint delta job). */
    public static final String MODS_DEEP = "mods_deep";
    /** Continuous Modrinth scan results when no legacy facts file exists. */
    public static final String MODRINTH_SCAN = "modrinth_scan";
    /** ISO timestamp of last Support compose (zip). */
    public static final String LAST_SUPPORT_COMPOSE_AT = "last_support_compose_at";
    public static final String ISSUES_LIVE = IssuesLiveSchema.ISSUES_LIVE;
    public static final String ISSUES_LIVE_UPDATED_AT = IssuesLiveSchema.ISSUES_LIVE_UPDATED_AT;

    public static final String MOD_LOG_SCANNED_AT = "scanned_at";
    public static final String MOD_LOG_NEW_COUNT = "new_count";
    public static final String MOD_LOG_ENTRIES = "entries";

    public static final String RUNNING_MODS_SCANNED_AT = "scanned_at";
    public static final String RUNNING_MODS_COUNT = "count";
    public static final String RUNNING_MODS_MODS = "mods";

    public static final String MOD_ISSUES_UPDATED_AT = "updated_at";
    public static final String MOD_ISSUES_ACTIVE_COUNT = "active_count";
    public static final String MOD_ISSUES_ENTRIES = "entries";

    public static final String SILENT_FAILS_SCANNED_AT = "scanned_at";
    public static final String SILENT_FAILS_NEW_COUNT = "new_count";
    public static final String SILENT_FAILS_ENTRIES = "entries";

    public static final String JOIN_CLINIC_SCANNED_AT = "scanned_at";
    public static final String JOIN_CLINIC_NEW_COUNT = "new_count";
    public static final String JOIN_CLINIC_ENTRIES = "entries";

    public static final String WORLD_PRESSURE_SCANNED_AT = "scanned_at";
    public static final String WORLD_PRESSURE_DIMENSIONS = "dimensions";
    public static final String WORLD_PRESSURE_CLASSIFIERS = "classifiers";
    public static final String WORLD_PRESSURE_STREAKS = "streaks";
    public static final String WORLD_PRESSURE_METERS = "meters";

    public static final String RIGHT_NOW_UPDATED_AT = "updated_at";
    public static final String RIGHT_NOW_SIGNALS = "signals";

    public static final int MOD_ERROR_RETENTION_DAYS = 7;
    public static final int SILENT_FAIL_RETENTION_DAYS = 7;

    public static final String ACTIVITY_SCANNED_AT = "scanned_at";
    public static final String ACTIVITY_NEW_COUNT = "new_count";
    public static final String ACTIVITY_EVENTS = "events";

    public static final String LAG_ISSUES_UPDATED_AT = "updated_at";
    public static final String LAG_ISSUES_ACTIVE_COUNT = "active_count";
    public static final String LAG_ISSUES_ENTRIES = "entries";

    public static final String EVENT_TIME = "time";
    public static final String EVENT_TYPE = "type";
    public static final String EVENT_DETAIL = "detail";
    public static final String EVENT_SOURCE = "source";
    public static final String EVENT_INCIDENT_ID = "incident_id";

    public static final String CRASHES_SCANNED_AT = "scanned_at";
    public static final String CRASHES_COUNT = "count";
    public static final String CRASHES_UNREVIEWED = "unreviewed";
    public static final String CRASHES_LATEST = "latest";
    public static final String CRASHES_ENTRIES = "entries";

    /** Post-mortem external kill verdict (OOM / panel watchdog). */
    public static final String EXTERNAL_KILL = "external_kill";
    public static final String EXTERNAL_KILL_SUBTYPE = "subtype";
    public static final String EXTERNAL_KILL_KILLED_AT = "killed_at";
    public static final String EXTERNAL_KILL_CONFIDENCE = "confidence";
    public static final String EXTERNAL_KILL_RECENT = "recent";

    /** Soft hang / freeze peek (1.1.22). */
    public static final String SOFT_HANG = "soft_hang";
    public static final String SOFT_HANG_ACTIVE = "active";
    public static final String SOFT_HANG_PHASE = "phase";
    public static final String SOFT_HANG_STALL_SECONDS = "stall_seconds";
    public static final String SOFT_HANG_EFFECTIVE_THRESHOLD_SECONDS = "effective_threshold_seconds";
    public static final String SOFT_HANG_MAX_TICK_TIME_MS = "max_tick_time_ms";
    public static final String SOFT_HANG_STARTED_AT = "started_at";
    public static final String SOFT_HANG_LAST_TICK_AT = "last_tick_at";
    public static final String SOFT_HANG_TICK_COUNT = "tick_count";
    public static final String SOFT_HANG_DUMP_PATH = "dump_path";
    public static final String SOFT_HANG_RECOVERED_AT = "recovered_at";
    public static final String SOFT_HANG_LIKELY_CAUSE = "likely_cause";
    public static final String SOFT_HANG_LIKELY_CAUSE_SUMMARY = "likely_cause_summary";
    public static final String SOFT_HANG_LIKELY_CAUSE_CONFIDENCE = "likely_cause_confidence";
    public static final String SOFT_HANG_SUSPECT_MOD = "suspect_mod";
    public static final String SOFT_HANG_SUSPECT_MOD_NOTE = "suspect_mod_note";

    public static final String ENTRY_FILE = "file";
    public static final String ENTRY_MTIME = "mtime";
    public static final String ENTRY_SIZE = "size";
    public static final String ENTRY_DISPLAY_LABEL = "display_label";
    public static final String ENTRY_SOURCE = "source";

    public static final String SOURCE_SCAN = "scan";
    public static final String SOURCE_REPORT = "report";

    private OpsCacheSchema() {
    }
}
