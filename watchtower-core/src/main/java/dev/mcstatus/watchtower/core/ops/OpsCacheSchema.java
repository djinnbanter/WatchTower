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
    public static final String RIGHT_NOW = "right_now";
    public static final String LOG_STALE = "log_stale";
    public static final String BACKUPS_LIVE = "backups_live";
    public static final String BACKUP_EXTERNAL = "backup_external";
    public static final String MODS_INVENTORY = "mods_inventory";
    public static final String DISK_JUMP = "disk_jump";

    public static final String MOD_LOG_SCANNED_AT = "scanned_at";
    public static final String MOD_LOG_NEW_COUNT = "new_count";
    public static final String MOD_LOG_ENTRIES = "entries";

    public static final String RUNNING_MODS_SCANNED_AT = "scanned_at";
    public static final String RUNNING_MODS_COUNT = "count";
    public static final String RUNNING_MODS_MODS = "mods";

    public static final String MOD_ISSUES_UPDATED_AT = "updated_at";
    public static final String MOD_ISSUES_ACTIVE_COUNT = "active_count";
    public static final String MOD_ISSUES_ENTRIES = "entries";

    public static final String RIGHT_NOW_UPDATED_AT = "updated_at";
    public static final String RIGHT_NOW_SIGNALS = "signals";

    public static final int MOD_ERROR_RETENTION_DAYS = 7;

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
