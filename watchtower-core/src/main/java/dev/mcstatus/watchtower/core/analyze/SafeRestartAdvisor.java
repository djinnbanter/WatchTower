package dev.mcstatus.watchtower.core.analyze;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.util.TimeParse;

import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

/**
 * Safe-to-restart checklist (1.1.2). Pure evaluation over existing signals — informational only.
 */
public final class SafeRestartAdvisor {

    public static final String VERDICT_SAFE = "safe";
    public static final String VERDICT_CAUTION = "caution";
    public static final String VERDICT_WAIT = "wait";

    public static final String SEV_PASS = "pass";
    public static final String SEV_INFO = "info";
    public static final String SEV_CAUTION = "caution";
    public static final String SEV_BLOCKER = "blocker";

    public static final double DISK_UI_WARN_PCT = 75.0;
    public static final double BACKUP_SOFT_MULT = 1.5;

    private static final int MAX_REASONS = 5;

    private SafeRestartAdvisor() {
    }

    /**
     * Evaluate restart safety. Input bag fields (all optional except defaults):
     * last_backup, backup_external, backups_live, chunky_pregen, dh_pregen,
     * players_online, disk_use_pct, disk_nudge, crashes {unreviewed, latest_at},
     * scorecard_grade, health_status, backup_warn_days, disk_warn_pct, lookback_hours,
     * backup_tracking_enabled, now (ISO instant for tests).
     */
    public static JsonObject evaluate(JsonObject input) {
        if (input == null) {
            input = new JsonObject();
        }
        Instant now = parseNow(input);
        int warnDays = (int) dbl(input, "backup_warn_days", 7);
        double diskWarnPct = dbl(input, "disk_warn_pct", 85);
        double lookbackHours = dbl(input, "lookback_hours", 24);
        boolean tracking = bool(input, "backup_tracking_enabled", true);

        List<Reason> reasons = new ArrayList<>();

        BackupAge backup = resolveBackupAge(input);
        evaluateBackup(reasons, backup, warnDays, tracking, input);

        boolean pregenActive = false;
        boolean pregenPaused = false;
        JsonObject chunky = obj(input, "chunky_pregen");
        JsonObject dh = obj(input, "dh_pregen");
        if (chunky != null) {
            if (bool(chunky, "pregen_active", false)) {
                pregenActive = true;
            }
            if (bool(chunky, "pregen_paused", false)) {
                pregenPaused = true;
            }
        }
        if (dh != null) {
            if (bool(dh, "pregen_active", false)) {
                pregenActive = true;
            }
            if (bool(dh, "pregen_paused", false)) {
                pregenPaused = true;
            }
        }
        if (pregenActive) {
            reasons.add(reason("pregen_active", SEV_BLOCKER, "Pregen running",
                    "Chunky or Distant Horizons is mid-run — a restart would waste progress.",
                    "live", null));
        } else if (pregenPaused) {
            reasons.add(reason("pregen_paused", SEV_CAUTION, "Pregen paused",
                    "A pregen job is paused. Confirm before restarting if you meant to resume it.",
                    "live", null));
        }

        int players = (int) dbl(input, "players_online", 0);
        if (players > 0) {
            reasons.add(reason("players_online", SEV_INFO,
                    players == 1 ? "1 player online" : players + " players online",
                    players == 1
                            ? "1 player will be disconnected on restart."
                            : players + " players will be disconnected on restart.",
                    "session", null));
        }

        Double diskPct = jsonDouble(input, "disk_use_pct");
        JsonObject diskNudge = obj(input, "disk_nudge");
        boolean diskNudgeActive = diskNudge != null && bool(diskNudge, "active", false);
        if (diskNudgeActive || (diskPct != null && diskPct >= diskWarnPct)) {
            String detail = diskNudgeActive && diskNudge.has("message")
                    ? diskNudge.get("message").getAsString()
                    : String.format(Locale.US, "Disk is %.0f%% full (warn at %.0f%%).",
                    diskPct != null ? diskPct : diskWarnPct, diskWarnPct);
            reasons.add(reason("disk_critical", SEV_BLOCKER, "Disk too full", detail, "insights", null));
        } else if (diskPct != null && diskPct >= DISK_UI_WARN_PCT) {
            reasons.add(reason("disk_warn", SEV_CAUTION, "Disk getting full",
                    String.format(Locale.US, "Disk is %.0f%% full.", diskPct),
                    "insights", null));
        }

        JsonObject crashes = obj(input, "crashes");
        int unreviewed = crashes != null ? (int) dbl(crashes, "unreviewed", 0) : 0;
        String latestCrashAt = crashes != null ? str(crashes, "latest_unreviewed_at") : null;
        if (latestCrashAt == null && crashes != null) {
            // Do not fall back to latest_at — that may be an acknowledged crash.
            latestCrashAt = null;
        }
        if (unreviewed > 0 && latestCrashAt != null) {
            Instant crashAt = parseInstant(latestCrashAt);
            if (crashAt != null) {
                double hoursAgo = Duration.between(crashAt, now).toMinutes() / 60.0;
                if (hoursAgo >= 0 && hoursAgo <= lookbackHours) {
                    reasons.add(reason("recent_crash", SEV_CAUTION, "Recent unreviewed crash",
                            String.format(Locale.US, "Unreviewed crash about %.0fh ago — review before restarting if unsure.",
                                    (double) Math.max(0, Math.round(hoursAgo))),
                            "crashes", null));
                } else if (hoursAgo > lookbackHours) {
                    reasons.add(reason("unreviewed_crashes", SEV_CAUTION, "Unreviewed crashes",
                            "There are unreviewed crashes older than the lookback window — review before restarting if unsure.",
                            "crashes", null));
                }
            }
        } else if (unreviewed > 0) {
            reasons.add(reason("unreviewed_crashes", SEV_CAUTION, "Unreviewed crashes",
                    "There are unreviewed crashes — review them on Crashes before restarting if unsure.",
                    "crashes", null));
        }

        String grade = str(input, "scorecard_grade");
        String health = str(input, "health_status");
        if ("critical".equalsIgnoreCase(grade)
                || "critical".equalsIgnoreCase(health)
                || "F".equalsIgnoreCase(grade)) {
            reasons.add(reason("health_critical", SEV_CAUTION, "Server health critical",
                    "Overview health is critical — check Issues before you restart.",
                    "issues", null));
        }

        String verdict = VERDICT_SAFE;
        for (Reason r : reasons) {
            if (SEV_BLOCKER.equals(r.severity)) {
                verdict = VERDICT_WAIT;
                break;
            }
            if (SEV_CAUTION.equals(r.severity)) {
                verdict = VERDICT_CAUTION;
            }
        }

        reasons.sort(Comparator.comparingInt(SafeRestartAdvisor::severityRank));

        List<Reason> visible = new ArrayList<>();
        for (Reason r : reasons) {
            if (!SEV_PASS.equals(r.severity)) {
                visible.add(r);
            }
        }
        if (VERDICT_SAFE.equals(verdict)) {
            // Keep card useful when everything is clear.
            if (backup.ageHours != null && tracking) {
                visible.add(0, reason("backup_ok", SEV_PASS, "Fresh backup",
                        formatBackupAgeDetail(backup.ageHours, warnDays),
                        "backups", null));
            }
            if (!pregenActive) {
                visible.add(reason("pregen_clear", SEV_PASS, "No active pregen",
                        "Chunky / Distant Horizons are not mid-run.",
                        "live", null));
            }
        }

        if (visible.size() > MAX_REASONS) {
            visible = new ArrayList<>(visible.subList(0, MAX_REASONS));
        }

        String headline;
        String summary;
        Reason lead = firstNonPass(reasons);
        if (VERDICT_WAIT.equals(verdict)) {
            headline = "Wait before restarting";
            summary = lead != null ? lead.label + " — " + lead.detail : "Something Watchtower watches says wait.";
        } else if (VERDICT_CAUTION.equals(verdict)) {
            headline = "Restart with caution";
            summary = lead != null ? lead.label + " — " + lead.detail : "You can restart, but check the notes first.";
        } else {
            headline = "Safe to restart";
            summary = "Nothing Watchtower watches is blocking a restart.";
        }

        JsonObject out = new JsonObject();
        out.addProperty("verdict", verdict);
        out.addProperty("headline", headline);
        out.addProperty("summary", summary);

        // Preserve checked_at when the checklist is unchanged so Overview freshness
        // badges don't reset to "just now" on every meta poll.
        String checkedAt = now.toString();
        JsonObject previous = obj(input, "previous");
        if (previous != null
                && verdict.equals(str(previous, "verdict"))
                && headline.equals(str(previous, "headline"))
                && summary.equals(str(previous, "summary"))
                && reasonsFingerprint(visible).equals(reasonsFingerprint(previousReasons(previous)))) {
            String prevAt = str(previous, "checked_at");
            if (prevAt != null && !prevAt.isBlank()) {
                checkedAt = prevAt;
            }
        }
        out.addProperty("checked_at", checkedAt);

        JsonArray arr = new JsonArray();
        for (Reason r : visible) {
            arr.add(r.toJson());
        }
        out.add("reasons", arr);

        JsonObject context = new JsonObject();
        context.addProperty("players_online", players);
        if (backup.ageHours != null) {
            context.addProperty("backup_age_hours", round1(backup.ageHours));
        }
        if (diskPct != null) {
            context.addProperty("disk_use_pct", diskPct);
        }
        context.addProperty("pregen_active", pregenActive);
        if (latestCrashAt != null) {
            context.addProperty("latest_crash_at", latestCrashAt);
        }
        out.add("context", context);
        return out;
    }

    private static void evaluateBackup(
            List<Reason> reasons, BackupAge backup, int warnDays, boolean tracking, JsonObject input) {
        if (!tracking) {
            return;
        }
        double warnHours = warnDays * 24.0;
        double softHours = warnHours * BACKUP_SOFT_MULT;

        String status = backup.status;
        boolean unconfigured = "unconfigured".equals(status);
        boolean missing = "not_found".equals(status) || "missing".equals(status) || "failed".equals(status);

        if (backup.ageHours == null) {
            boolean externalConfigured = false;
            JsonObject ext = obj(input, "backup_external");
            if (ext != null && bool(ext, "configured", false)) {
                externalConfigured = true;
            }
            if (unconfigured && !externalConfigured) {
                reasons.add(reason("backup_missing", SEV_BLOCKER, "No usable backup",
                        "Backup tracking is on but no backup folder is configured.",
                        "settings", panelBackupsParams()));
                return;
            }
            if (missing || status == null || unconfigured) {
                reasons.add(reason("backup_missing", SEV_BLOCKER, "No usable backup",
                        missing && "failed".equals(status)
                                ? "Backup is missing or failed."
                                : "No backup archive found in the configured search paths.",
                        unconfigured ? "settings" : "backups",
                        unconfigured ? panelBackupsParams() : null));
            }
            return;
        }

        if (backup.stale || backup.ageHours >= softHours || "stale".equals(status)) {
            reasons.add(reason("backup_stale", SEV_BLOCKER, "Backup too old",
                    formatBackupAgeDetail(backup.ageHours, warnDays),
                    "backups", null));
        } else if (backup.ageHours > warnHours) {
            reasons.add(reason("backup_aging", SEV_CAUTION, "Backup getting old",
                    formatBackupAgeDetail(backup.ageHours, warnDays),
                    "backups", null));
        }
    }

    private static JsonObject panelBackupsParams() {
        JsonObject p = new JsonObject();
        p.addProperty("panel", "backups");
        return p;
    }

    private static String formatBackupAgeDetail(double ageHours, int warnDays) {
        if (ageHours < 48) {
            int hours = (int) Math.max(0, Math.round(ageHours));
            return String.format(Locale.US, "Newest archive is %dh old (warn at %dd).", hours, warnDays);
        }
        return String.format(Locale.US, "Newest archive is %.1f days old (warn at %dd).",
                ageHours / 24.0, warnDays);
    }

    /**
     * Prefer the freshest usable backup across live scan, external heartbeat, and report scan.
     * A fresh external backup wins over a stale local archive (hybrid setups).
     */
    private static BackupAge resolveBackupAge(JsonObject input) {
        Double freshBest = null;
        Double anyBest = null;
        boolean anyStale = false;
        String fallbackStatus = null;

        JsonObject live = obj(input, "backups_live");
        if (live != null) {
            JsonObject lb = obj(live, "last_backup");
            Double hours = lb != null ? jsonDouble(lb, "age_hours") : null;
            if (hours != null) {
                freshBest = minHours(freshBest, hours);
                anyBest = minHours(anyBest, hours);
            }
        }

        JsonObject ext = obj(input, "backup_external");
        if (ext != null && bool(ext, "configured", false)) {
            String extStatus = str(ext, "status");
            boolean extStale = bool(ext, "stale", false) || "stale".equals(extStatus);
            boolean extUsable = ("success".equals(extStatus) || "running".equals(extStatus)) && !extStale;
            Double hours = ageHoursOf(ext);
            if (extUsable && hours != null) {
                freshBest = minHours(freshBest, hours);
                anyBest = minHours(anyBest, hours);
            } else if (hours != null) {
                anyBest = minHours(anyBest, hours);
                anyStale = true;
                if (fallbackStatus == null) {
                    fallbackStatus = extStale ? "stale" : extStatus;
                }
            } else if ("missing".equals(extStatus) || "failed".equals(extStatus)) {
                if (fallbackStatus == null) {
                    fallbackStatus = extStatus;
                }
            }
        }

        JsonObject last = obj(input, "last_backup");
        if (last != null) {
            String status = str(last, "status");
            boolean stale = bool(last, "stale", false) || "stale".equals(status);
            boolean missing = "not_found".equals(status) || "missing".equals(status);
            boolean unconfigured = "unconfigured".equals(status);
            Double hours = ageHoursOf(last);
            if (hours != null && !missing && !unconfigured && !stale) {
                freshBest = minHours(freshBest, hours);
                anyBest = minHours(anyBest, hours);
            } else if (hours != null && !missing && !unconfigured) {
                anyBest = minHours(anyBest, hours);
                anyStale = true;
                if (fallbackStatus == null) {
                    fallbackStatus = "stale";
                }
            } else if (fallbackStatus == null) {
                if (unconfigured) {
                    fallbackStatus = "unconfigured";
                } else if (missing) {
                    fallbackStatus = status != null ? status : "not_found";
                } else if (stale) {
                    fallbackStatus = "stale";
                } else if (status != null) {
                    fallbackStatus = status;
                }
            }
        }

        if (freshBest != null) {
            return new BackupAge(freshBest, "success", false);
        }
        if (anyBest != null) {
            return new BackupAge(anyBest, anyStale ? "stale" : "success", anyStale);
        }
        return new BackupAge(null, fallbackStatus, false);
    }

    private static Double ageHoursOf(JsonObject o) {
        Double hours = jsonDouble(o, "age_hours");
        if (hours != null) {
            return hours;
        }
        Double days = jsonDouble(o, "age_days");
        return days != null ? days * 24.0 : null;
    }

    private static Double minHours(Double current, double candidate) {
        if (current == null || candidate < current) {
            return candidate;
        }
        return current;
    }

    private static List<Reason> previousReasons(JsonObject previous) {
        List<Reason> out = new ArrayList<>();
        if (previous == null || !previous.has("reasons") || !previous.get("reasons").isJsonArray()) {
            return out;
        }
        for (var el : previous.getAsJsonArray("reasons")) {
            if (!el.isJsonObject()) {
                continue;
            }
            JsonObject row = el.getAsJsonObject();
            out.add(reason(
                    str(row, "id") != null ? str(row, "id") : "",
                    str(row, "severity") != null ? str(row, "severity") : "",
                    str(row, "label") != null ? str(row, "label") : "",
                    str(row, "detail") != null ? str(row, "detail") : "",
                    str(row, "tab"),
                    null));
        }
        return out;
    }

    private static String reasonsFingerprint(List<Reason> reasons) {
        StringBuilder sb = new StringBuilder();
        for (Reason r : reasons) {
            sb.append(r.id).append('|')
                    .append(r.severity).append('|')
                    .append(r.label).append('|')
                    .append(r.detail).append(';');
        }
        return sb.toString();
    }

    private static Reason firstNonPass(List<Reason> reasons) {
        for (Reason r : reasons) {
            if (SEV_BLOCKER.equals(r.severity) || SEV_CAUTION.equals(r.severity)) {
                return r;
            }
        }
        for (Reason r : reasons) {
            if (SEV_INFO.equals(r.severity)) {
                return r;
            }
        }
        return null;
    }

    private static int severityRank(Reason r) {
        return switch (r.severity) {
            case SEV_BLOCKER -> 0;
            case SEV_CAUTION -> 1;
            case SEV_INFO -> 2;
            default -> 3;
        };
    }

    private static Reason reason(
            String id, String severity, String label, String detail, String tab, JsonObject tabParams) {
        return new Reason(id, severity, label, detail, tab, tabParams);
    }

    private static Instant parseNow(JsonObject input) {
        String raw = str(input, "now");
        if (raw != null) {
            Instant parsed = parseInstant(raw);
            if (parsed != null) {
                return parsed;
            }
        }
        return Instant.now();
    }

    private static Instant parseInstant(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        Instant fromUtil = TimeParse.parseTime(raw);
        if (fromUtil != null) {
            return fromUtil;
        }
        try {
            return Instant.parse(raw);
        } catch (Exception ignored) {
            return null;
        }
    }

    private static double round1(double v) {
        return Math.round(v * 10.0) / 10.0;
    }

    private static JsonObject obj(JsonObject o, String key) {
        if (o == null || !o.has(key) || !o.get(key).isJsonObject()) {
            return null;
        }
        return o.getAsJsonObject(key);
    }

    private static String str(JsonObject o, String key) {
        if (o == null || !o.has(key) || o.get(key).isJsonNull()) {
            return null;
        }
        try {
            return o.get(key).getAsString();
        } catch (Exception e) {
            return null;
        }
    }

    private static boolean bool(JsonObject o, String key, boolean def) {
        if (o == null || !o.has(key) || o.get(key).isJsonNull()) {
            return def;
        }
        try {
            return o.get(key).getAsBoolean();
        } catch (Exception e) {
            return def;
        }
    }

    private static double dbl(JsonObject o, String key, double def) {
        Double v = jsonDouble(o, key);
        return v != null ? v : def;
    }

    private static Double jsonDouble(JsonObject o, String key) {
        if (o == null || !o.has(key) || o.get(key).isJsonNull()) {
            return null;
        }
        try {
            return o.get(key).getAsDouble();
        } catch (Exception e) {
            return null;
        }
    }

    private static final class BackupAge {
        final Double ageHours;
        final String status;
        final boolean stale;

        BackupAge(Double ageHours, String status, boolean stale) {
            this.ageHours = ageHours;
            this.status = status;
            this.stale = stale;
        }
    }

    private static final class Reason {
        final String id;
        final String severity;
        final String label;
        final String detail;
        final String tab;
        final JsonObject tabParams;

        Reason(String id, String severity, String label, String detail, String tab, JsonObject tabParams) {
            this.id = id;
            this.severity = severity;
            this.label = label;
            this.detail = detail;
            this.tab = tab;
            this.tabParams = tabParams;
        }

        JsonObject toJson() {
            JsonObject o = new JsonObject();
            o.addProperty("id", id);
            o.addProperty("severity", severity);
            o.addProperty("label", label);
            o.addProperty("detail", detail);
            o.addProperty("tab", tab);
            if (tabParams != null) {
                o.add("tab_params", tabParams);
            } else {
                o.add("tab_params", com.google.gson.JsonNull.INSTANCE);
            }
            return o;
        }
    }
}
