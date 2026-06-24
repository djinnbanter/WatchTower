package dev.mcstatus.watchtower.core.collect;

import java.util.List;
import java.util.regex.Pattern;

/**
 * Regex patterns ported from mc-status-build-staging.py and mc-status-extras.py.
 */
public final class LogPatterns {

    public static final Pattern ERROR_LINE = Pattern.compile("\\[(ERROR|FATAL)\\]", Pattern.CASE_INSENSITIVE);
    public static final Pattern LOG_TS = Pattern.compile(
            "^\\[(\\d{1,2}[A-Za-z]{3}\\d{4} \\d{2}:\\d{2}:\\d{2}(?:\\.\\d+)?)\\]");
    public static final Pattern PREGEN = Pattern.compile(
            "Generated radius:\\s*([\\d.]+)\\s*/\\s*(\\d+)\\s*chunks\\s*\\((\\d+)\\s*cps(?:,\\s*([\\d.]+)%)?\\)"
                    + "(?:,\\s*ETA:\\s*(.+))?",
            Pattern.CASE_INSENSITIVE);
    public static final Pattern TICK_LAG_MS = Pattern.compile("Running (\\d+)ms or (\\d+) ticks behind");
    public static final Pattern OOM_LOG = Pattern.compile("OutOfMemoryError|Java heap space", Pattern.CASE_INSENSITIVE);
    public static final Pattern KERNEL_OOM = Pattern.compile(
            "oom-killer|out of memory|invoked oom|killed process .*java|"
                    + "Killed process .*java|Memory cgroup out of memory",
            Pattern.CASE_INSENSITIVE);
    public static final Pattern REBOOT_LINE = Pattern.compile(
            "system will reboot|reboot:\\s*system boot|systemd-logind.*reboot|"
                    + "watchdog.*reboot|rebooted by",
            Pattern.CASE_INSENSITIVE);
    public static final Pattern SESSION_SSHD = Pattern.compile("sshd.*session closed for user", Pattern.CASE_INSENSITIVE);
    public static final Pattern SESSION_SU_CRAFTY = Pattern.compile(
            "pam_unix\\(su:session\\).*session closed", Pattern.CASE_INSENSITIVE);
    public static final Pattern SESSION_SUDO = Pattern.compile("pam_unix\\(sudo:session\\)", Pattern.CASE_INSENSITIVE);
    public static final Pattern CRON_SESSION = Pattern.compile("cron:session\\).*session closed", Pattern.CASE_INSENSITIVE);
    public static final Pattern PLAYER_JOIN = Pattern.compile("\\]:\\s+(\\S+)\\s+joined the game\\s*$");
    public static final Pattern PLAYER_JOIN_BRACKET = Pattern.compile("\\[\\+]\\s+(\\S+)\\s*$");
    public static final Pattern PLAYER_JOIN_ENTITY = Pattern.compile(
            "(\\S+)\\s+logged in with entity id", Pattern.CASE_INSENSITIVE);
    public static final Pattern PLAYER_LEAVE = Pattern.compile("\\]:\\s+(\\S+)\\s+left the game\\s*$");
    public static final Pattern PLAYER_LEAVE_BRACKET = Pattern.compile("\\[-\\]\\s+(\\S+)\\s*$");
    public static final Pattern COMMAND_ISSUED = Pattern.compile(
            "(?:\\]:\\s+)?(?:\\S+\\s+)?issued server command:\\s*(/.+)$", Pattern.CASE_INSENSITIVE);
    public static final Pattern CONSOLE_COMMAND = Pattern.compile(
            "\\]:\\s*Running command\\s+(.+)$", Pattern.CASE_INSENSITIVE);
    public static final Pattern CHUNKY_PROGRESS = Pattern.compile(
            "Chunky.*?(\\d+(?:\\.\\d+)?)\\s*%", Pattern.CASE_INSENSITIVE);
    public static final Pattern CHUNKY_TASK = Pattern.compile(
            "\\[Chunky\\] Task running for (\\S+)\\. Processed: (\\d+) chunks \\((\\d+(?:\\.\\d+)?)%\\), "
                    + "ETA: ([^,]+), Rate: (\\d+(?:\\.\\d+)?) cps",
            Pattern.CASE_INSENSITIVE);
    public static final Pattern CHUNKY_PAUSED = Pattern.compile(
            "\\[Chunky\\].*(?:Task paused|paused task)", Pattern.CASE_INSENSITIVE);
    public static final Pattern CHUNK_GEN_FAILURE = Pattern.compile(
            "Failed to load chunk|Error upgrading chunk", Pattern.CASE_INSENSITIVE);
    public static final Pattern ENTITY_COUNT = Pattern.compile("(?<n>\\d[\\d,]*)\\s+entit", Pattern.CASE_INSENSITIVE);
    public static final Pattern CHUNK_COUNT = Pattern.compile("(?<n>\\d[\\d,]*)\\s+chunk", Pattern.CASE_INSENSITIVE);
    public static final Pattern MC_AUTH_FAIL = Pattern.compile(
            "(?:Failed to verify username|disconnect\\.|lost connection:.*auth|UUID of player)",
            Pattern.CASE_INSENSITIVE);
    public static final Pattern SSH_FAIL = Pattern.compile("Failed password|Invalid user", Pattern.CASE_INSENSITIVE);
    public static final Pattern IPV4 = Pattern.compile("\\b(\\d{1,3}(?:\\.\\d{1,3}){3})\\b");
    public static final Pattern KUBEJS_ERROR = Pattern.compile(
            "\\[KubeJS(?:\\s+Server)?/\\].*(?:ERROR|Exception|Error|failed)",
            Pattern.CASE_INSENSITIVE);
    public static final Pattern BACKUP_JOB_START = Pattern.compile(
            "(?:backup (?:started|starting|running)|Starting backup|Backup job|"
                    + "FTB Backups.*(?:start|creat)|\\[Crafty\\].*backup)",
            Pattern.CASE_INSENSITIVE);
    public static final Pattern RESTART_SCHEDULED = Pattern.compile(
            "(?:restart_server|scheduled restart|Server will restart|restarting the server)",
            Pattern.CASE_INSENSITIVE);
    public static final Pattern RESTART_SOON = Pattern.compile(
            "(?:restart(?:ing)? in \\d+|server stopping in \\d+)",
            Pattern.CASE_INSENSITIVE);

    public static final List<String> BACKUP_SUFFIXES = List.of(".tar.gz", ".tgz", ".tar", ".zip", ".7z");

    public static final List<String> HOST_LOG_FALLBACKS = List.of(
            "/var/log/auth.log",
            "/var/log/auth.log.1",
            "/var/log/syslog",
            "/var/log/kern.log");

    private LogPatterns() {
    }
}
