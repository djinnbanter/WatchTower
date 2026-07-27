package dev.mcstatus.watchtower.core.ops;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.util.TimeParse;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Correlates lag, crash, mod-change, and backup signals into plain-English incident stories.
 * Neutral “preceded” language by default; one causal rule for backup-after-downtime.
 */
public final class IncidentStoryBuilder {

    public static final String RULE_BACKUP_AFTER_DOWNTIME = "backup_after_downtime";

    public static final String TYPE_LAG_SPIKE = "lag_spike";
    public static final String TYPE_CRASH = "crash";
    public static final String TYPE_MOD_CHANGE = "mod_change";
    public static final String TYPE_BACKUP_FAILED = "backup_failed";
    public static final String TYPE_SERVER_DOWN = "server_down";

    public static final String DOMAIN_LAG = "lag";
    public static final String DOMAIN_CRASH = "crash";
    public static final String DOMAIN_MOD = "mod";
    public static final String DOMAIN_BACKUP = "backup";
    public static final String DOMAIN_LIFECYCLE = "lifecycle";

    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_OFFSET_DATE_TIME;
    private static final DateTimeFormatter CLOCK = DateTimeFormatter.ofPattern("HH:mm");

    private IncidentStoryBuilder() {
    }

    public record Settings(
            boolean enabled,
            int windowMin,
            int lookbackHours,
            int maxStories
    ) {
        public static Settings defaults() {
            return new Settings(true, 30, 48, 10);
        }

        public Settings sanitized() {
            return new Settings(
                    enabled,
                    Math.max(1, windowMin),
                    Math.max(1, lookbackHours),
                    Math.max(1, maxStories)
            );
        }
    }

    /**
     * Build incident stories from an ops-cache object plus optional facts {@code events[]} backfill.
     */
    public static JsonArray build(JsonObject opsCache, JsonArray factsEvents, Settings settings) {
        return build(opsCache, factsEvents, settings, Instant.now());
    }

    /**
     * Same as {@link #build(JsonObject, JsonArray, Settings)} with an injectable clock for tests/fixtures.
     */
    public static JsonArray build(JsonObject opsCache, JsonArray factsEvents, Settings settings, Instant now) {
        Settings cfg = settings != null ? settings.sanitized() : Settings.defaults();
        if (!cfg.enabled()) {
            return new JsonArray();
        }
        Instant clock = now != null ? now : Instant.now();
        long nowEpoch = clock.getEpochSecond();
        long cutoff = nowEpoch - (long) cfg.lookbackHours() * 3600L;
        long windowSec = (long) cfg.windowMin() * 60L;

        List<Candidate> candidates = collectCandidates(opsCache, factsEvents, cutoff);
        candidates.sort(Comparator.comparingLong(c -> c.epoch));

        List<List<Candidate>> clusters = cluster(candidates, windowSec);
        List<JsonObject> stories = new ArrayList<>();
        for (List<Candidate> cluster : clusters) {
            JsonObject story = toStory(cluster);
            if (story != null) {
                stories.add(story);
            }
        }

        stories = dedupe(stories);
        stories.sort((a, b) -> Long.compare(storyEpoch(b, "started_at"), storyEpoch(a, "started_at")));
        if (stories.size() > cfg.maxStories()) {
            stories = new ArrayList<>(stories.subList(0, cfg.maxStories()));
        }

        JsonArray out = new JsonArray();
        stories.forEach(out::add);
        return out;
    }

    private static List<Candidate> collectCandidates(JsonObject opsCache, JsonArray factsEvents, long cutoff) {
        List<Candidate> out = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        Set<String> lagIncidentIds = new HashSet<>();

        if (opsCache != null && opsCache.has(OpsCacheSchema.LAG_ISSUES)) {
            JsonObject lagIssues = opsCache.getAsJsonObject(OpsCacheSchema.LAG_ISSUES);
            if (lagIssues.has(OpsCacheSchema.LAG_ISSUES_ENTRIES)) {
                for (JsonElement el : lagIssues.getAsJsonArray(OpsCacheSchema.LAG_ISSUES_ENTRIES)) {
                    if (!el.isJsonObject()) {
                        continue;
                    }
                    JsonObject entry = el.getAsJsonObject();
                    Instant t = TimeParse.parseTime(str(entry, "time"));
                    if (t == null || t.getEpochSecond() < cutoff) {
                        continue;
                    }
                    String incidentId = str(entry, "incident_id");
                    if (incidentId != null) {
                        lagIncidentIds.add(incidentId);
                    }
                    String detail = lagDetail(entry);
                    Candidate c = candidate(TYPE_LAG_SPIKE, DOMAIN_LAG, t, detail, "issues", incidentId, null);
                    addUnique(out, seen, c);
                }
            }
        }

        if (opsCache != null && opsCache.has(OpsCacheSchema.ACTIVITY)) {
            JsonObject activity = opsCache.getAsJsonObject(OpsCacheSchema.ACTIVITY);
            if (activity.has(OpsCacheSchema.ACTIVITY_EVENTS)) {
                for (JsonElement el : activity.getAsJsonArray(OpsCacheSchema.ACTIVITY_EVENTS)) {
                    if (!el.isJsonObject()) {
                        continue;
                    }
                    JsonObject ev = el.getAsJsonObject();
                    String type = str(ev, OpsCacheSchema.EVENT_TYPE);
                    Instant t = TimeParse.parseTime(str(ev, OpsCacheSchema.EVENT_TIME));
                    if (t == null || t.getEpochSecond() < cutoff || type == null) {
                        continue;
                    }
                    if ("lag_incident".equals(type) || "performance_spike".equals(type) || "tick_lag".equals(type)) {
                        String incidentId = str(ev, OpsCacheSchema.EVENT_INCIDENT_ID);
                        if (incidentId != null && lagIncidentIds.contains(incidentId)) {
                            continue;
                        }
                        if ("tick_lag".equals(type) && !lagIncidentIds.isEmpty()) {
                            // Prefer structured lag_issues when any exist in window.
                            continue;
                        }
                        String detail = str(ev, OpsCacheSchema.EVENT_DETAIL);
                        if (detail == null || detail.isBlank()) {
                            detail = "Lag spike";
                        }
                        String tab = incidentId != null ? "issues" : "activity";
                        addUnique(out, seen, candidate(TYPE_LAG_SPIKE, DOMAIN_LAG, t, detail, tab, incidentId, null));
                    } else if ("clean_stop".equals(type)) {
                        String detail = str(ev, OpsCacheSchema.EVENT_DETAIL);
                        if (detail == null || detail.isBlank()) {
                            detail = "Clean stop";
                        }
                        addUnique(out, seen, candidate(TYPE_SERVER_DOWN, DOMAIN_LIFECYCLE, t, detail, "activity", null, null));
                    }
                }
            }
        }

        if (opsCache != null && opsCache.has(OpsCacheSchema.CRASHES)) {
            JsonObject crashes = opsCache.getAsJsonObject(OpsCacheSchema.CRASHES);
            if (crashes.has(OpsCacheSchema.CRASHES_ENTRIES)) {
                for (JsonElement el : crashes.getAsJsonArray(OpsCacheSchema.CRASHES_ENTRIES)) {
                    if (!el.isJsonObject()) {
                        continue;
                    }
                    JsonObject entry = el.getAsJsonObject();
                    Instant t = crashTime(entry);
                    if (t == null || t.getEpochSecond() < cutoff) {
                        continue;
                    }
                    String detail = str(entry, OpsCacheSchema.ENTRY_DISPLAY_LABEL);
                    if (detail == null || detail.isBlank()) {
                        detail = str(entry, OpsCacheSchema.ENTRY_FILE);
                    }
                    if (detail == null || detail.isBlank()) {
                        detail = "Crash report";
                    }
                    String file = str(entry, OpsCacheSchema.ENTRY_FILE);
                    addUnique(out, seen, candidate(TYPE_CRASH, DOMAIN_CRASH, t, detail, "crashes", null, file));
                }
            }
        }

        if (factsEvents != null) {
            for (JsonElement el : factsEvents) {
                if (!el.isJsonObject()) {
                    continue;
                }
                JsonObject ev = el.getAsJsonObject();
                String type = str(ev, "type");
                Instant t = TimeParse.parseTime(str(ev, "time"));
                if (t == null || t.getEpochSecond() < cutoff || type == null) {
                    continue;
                }
                if ("crash_report".equals(type) || "kernel_oom".equals(type) || "crash".equals(type)) {
                    String detail = str(ev, "detail");
                    if (detail == null || detail.isBlank()) {
                        detail = "crash_report".equals(type) ? "Crash report" : type;
                    }
                    String file = str(ev, "file");
                    if (file == null) {
                        file = str(ev, "path");
                    }
                    addUnique(out, seen, candidate(TYPE_CRASH, DOMAIN_CRASH, t, detail, "crashes", null, file));
                } else if ("clean_stop".equals(type)) {
                    String detail = str(ev, "detail");
                    if (detail == null || detail.isBlank()) {
                        detail = "Clean stop";
                    }
                    addUnique(out, seen, candidate(TYPE_SERVER_DOWN, DOMAIN_LIFECYCLE, t, detail, "activity", null, null));
                }
            }
        }

        addModChangeCandidate(opsCache, cutoff, out, seen);
        addBackupCandidates(opsCache, cutoff, out, seen);

        return out;
    }

    private static void addModChangeCandidate(JsonObject opsCache, long cutoff, List<Candidate> out, Set<String> seen) {
        if (opsCache == null || !opsCache.has(OpsCacheSchema.MODS_INVENTORY)) {
            return;
        }
        JsonObject block = opsCache.getAsJsonObject(OpsCacheSchema.MODS_INVENTORY);
        if (!block.has("diff") || !block.get("diff").isJsonObject()) {
            return;
        }
        JsonObject diff = block.getAsJsonObject("diff");
        if (diff.has("baseline_refresh") && diff.get("baseline_refresh").getAsBoolean()) {
            return;
        }
        if (!diff.has("has_changes") || !diff.get("has_changes").getAsBoolean()) {
            return;
        }
        long maxMtime = maxJarMtime(diff);
        Instant t;
        if (maxMtime > 0) {
            t = Instant.ofEpochSecond(maxMtime);
        } else {
            t = TimeParse.parseTime(str(block, "scanned_at"));
        }
        if (t == null || t.getEpochSecond() < cutoff) {
            return;
        }
        String detail = str(block, "tldr");
        if (detail == null || detail.isBlank()) {
            detail = summarizeModDiff(diff);
        }
        addUnique(out, seen, candidate(TYPE_MOD_CHANGE, DOMAIN_MOD, t, detail, "mods", null, null));
    }

    private static void addBackupCandidates(JsonObject opsCache, long cutoff, List<Candidate> out, Set<String> seen) {
        if (opsCache == null) {
            return;
        }
        if (opsCache.has(OpsCacheSchema.BACKUP_EXTERNAL)
                && opsCache.get(OpsCacheSchema.BACKUP_EXTERNAL).isJsonObject()) {
            JsonObject ext = opsCache.getAsJsonObject(OpsCacheSchema.BACKUP_EXTERNAL);
            if ("failed".equals(str(ext, "status"))) {
                Instant t = TimeParse.parseTime(str(ext, "updated_at"));
                if (t == null) {
                    t = TimeParse.parseTime(str(ext, "checked_at"));
                }
                if (t == null) {
                    t = TimeParse.parseTime(str(ext, "last_success_at"));
                }
                if (t != null && t.getEpochSecond() >= cutoff) {
                    String detail = str(ext, "detail");
                    if (detail == null || detail.isBlank()) {
                        detail = "External backup failed";
                    }
                    addUnique(out, seen, candidate(TYPE_BACKUP_FAILED, DOMAIN_BACKUP, t, detail, "backups", null, null));
                }
            }
        }

        if (opsCache.has(OpsCacheSchema.BACKUPS_LIVE)
                && opsCache.get(OpsCacheSchema.BACKUPS_LIVE).isJsonObject()) {
            JsonObject live = opsCache.getAsJsonObject(OpsCacheSchema.BACKUPS_LIVE);
            if (live.has("last_backup") && live.get("last_backup").isJsonObject()) {
                JsonObject lb = live.getAsJsonObject("last_backup");
                String status = str(lb, "status");
                boolean stale = bool(lb, "stale", false) || "stale".equals(status);
                boolean missing = "not_found".equals(status) || "missing".equals(status);
                if (stale || missing) {
                    Instant t = TimeParse.parseTime(str(lb, "mtime_iso"));
                    if (t == null) {
                        t = TimeParse.parseTime(str(lb, "time"));
                    }
                    if (t == null && lb.has("mtime") && lb.get("mtime").isJsonPrimitive()) {
                        try {
                            t = Instant.ofEpochSecond(lb.get("mtime").getAsLong());
                        } catch (Exception ignored) {
                            t = null;
                        }
                    }
                    if (t == null) {
                        t = TimeParse.parseTime(str(live, "scanned_at"));
                    }
                    if (t != null && t.getEpochSecond() >= cutoff) {
                        String detail = stale ? "Backup stale" : "Backup not found";
                        // Mark as backup_failed candidate; causal narrative only when clustered with downtime.
                        addUnique(out, seen, candidate(TYPE_BACKUP_FAILED, DOMAIN_BACKUP, t, detail, "backups", null, null));
                    }
                }
            }
        }
    }

    private static List<List<Candidate>> cluster(List<Candidate> sorted, long windowSec) {
        List<List<Candidate>> clusters = new ArrayList<>();
        List<Candidate> current = null;
        long clusterStart = 0;
        long prevEpoch = 0;
        for (Candidate c : sorted) {
            if (current == null) {
                current = new ArrayList<>();
                current.add(c);
                clusterStart = c.epoch;
                prevEpoch = c.epoch;
                continue;
            }
            boolean withinStart = c.epoch - clusterStart <= windowSec;
            boolean withinPrev = c.epoch - prevEpoch <= windowSec;
            if (withinStart || withinPrev) {
                current.add(c);
                prevEpoch = c.epoch;
            } else {
                clusters.add(current);
                current = new ArrayList<>();
                current.add(c);
                clusterStart = c.epoch;
                prevEpoch = c.epoch;
            }
        }
        if (current != null && !current.isEmpty()) {
            clusters.add(current);
        }
        return clusters;
    }

    private static JsonObject toStory(List<Candidate> cluster) {
        if (cluster == null || cluster.size() < 2) {
            return null;
        }
        Set<String> domains = new LinkedHashSet<>();
        for (Candidate c : cluster) {
            domains.add(c.domain);
        }
        // Lifecycle alone does not count toward eligibility with a single other domain of same story
        // Eligibility: ≥2 domains among lag/crash/mod/backup (lifecycle is supporting only).
        Set<String> primary = new LinkedHashSet<>(domains);
        primary.remove(DOMAIN_LIFECYCLE);
        if (primary.size() < 2) {
            return null;
        }

        boolean hasDowntime = domains.contains(DOMAIN_LIFECYCLE) || domains.contains(DOMAIN_CRASH);
        boolean hasBackup = domains.contains(DOMAIN_BACKUP);
        boolean backupAfterDowntime = hasBackup && hasDowntime;

        List<String> ruleMatches = new ArrayList<>();
        if (backupAfterDowntime) {
            ruleMatches.add(RULE_BACKUP_AFTER_DOWNTIME);
        }

        JsonArray events = new JsonArray();
        List<String> domainList = new ArrayList<>(primary);
        // Include lifecycle in domains list only if present (supporting).
        if (domains.contains(DOMAIN_LIFECYCLE)) {
            domainList.add(DOMAIN_LIFECYCLE);
        }

        for (Candidate c : cluster) {
            // Drop lone lifecycle events from event list when they only support the backup rule;
            // still keep them if we want chronological clarity — plan includes server_down as event type.
            JsonObject ev = new JsonObject();
            ev.addProperty("type", c.type);
            ev.addProperty("at", c.iso);
            ev.addProperty("detail", c.detail);
            ev.addProperty("tab_link", c.tabLink);
            if (c.incidentId != null) {
                ev.addProperty("incident_id", c.incidentId);
            }
            if (c.file != null) {
                ev.addProperty("file", c.file);
            }
            events.add(ev);
        }

        Candidate first = cluster.get(0);
        Candidate last = cluster.get(cluster.size() - 1);
        String narrative = buildNarrative(cluster, backupAfterDowntime);

        JsonObject story = new JsonObject();
        story.addProperty("id", "story-" + sanitizeId(first.iso));
        story.addProperty("started_at", first.iso);
        story.addProperty("ended_at", last.iso);
        JsonArray domainsArr = new JsonArray();
        domainList.forEach(domainsArr::add);
        story.add("domains", domainsArr);
        story.add("events", events);
        story.addProperty("narrative", narrative);
        JsonArray rules = new JsonArray();
        ruleMatches.forEach(rules::add);
        story.add("rule_matches", rules);
        return story;
    }

    private static String buildNarrative(List<Candidate> cluster, boolean backupAfterDowntime) {
        List<Candidate> primary = new ArrayList<>();
        for (Candidate c : cluster) {
            if (!TYPE_SERVER_DOWN.equals(c.type)) {
                primary.add(c);
            }
        }
        if (primary.isEmpty()) {
            primary = cluster;
        }

        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < primary.size(); i++) {
            Candidate c = primary.get(i);
            String clock = clockLabel(c.iso);
            String piece = phraseFor(c, clock, backupAfterDowntime && TYPE_BACKUP_FAILED.equals(c.type));
            if (i == 0) {
                sb.append(capitalize(piece));
            } else if (i == primary.size() - 1 && primary.size() > 1) {
                if (backupAfterDowntime && TYPE_BACKUP_FAILED.equals(c.type)) {
                    sb.append("; ").append(piece);
                } else {
                    sb.append(" preceded ").append(piece);
                }
            } else {
                sb.append(" preceded ").append(piece);
            }
        }
        if (!sb.toString().endsWith(".")) {
            sb.append(".");
        }
        return sb.toString();
    }

    private static String phraseFor(Candidate c, String clock, boolean causalBackup) {
        return switch (c.type) {
            case TYPE_LAG_SPIKE -> "Lag spike at " + clock
                    + (c.detail != null && !c.detail.isBlank() && !c.detail.equalsIgnoreCase("Lag spike")
                    ? " (" + shorten(c.detail) + ")" : "");
            case TYPE_CRASH -> {
                String d = shorten(c.detail);
                yield "a " + (d != null && !d.isBlank() ? d : "crash") + " at " + clock;
            }
            case TYPE_MOD_CHANGE -> "a mod change at " + clock
                    + (c.detail != null ? " (" + shorten(c.detail) + ")" : "");
            case TYPE_BACKUP_FAILED -> {
                if (causalBackup) {
                    yield "the scheduled backup at " + clock + " failed because the server was down";
                }
                yield "a backup failure at " + clock
                        + (c.detail != null ? " (" + shorten(c.detail) + ")" : "");
            }
            case TYPE_SERVER_DOWN -> "a server stop at " + clock;
            default -> c.type + " at " + clock;
        };
    }

    private static List<JsonObject> dedupe(List<JsonObject> stories) {
        List<JsonObject> kept = new ArrayList<>();
        for (JsonObject story : stories) {
            Set<String> keys = eventKeys(story);
            boolean absorbed = false;
            for (int i = 0; i < kept.size(); i++) {
                JsonObject other = kept.get(i);
                Set<String> otherKeys = eventKeys(other);
                double overlap = jaccard(keys, otherKeys);
                if (overlap >= 0.8) {
                    if (keys.size() > otherKeys.size()
                            || (keys.size() == otherKeys.size()
                            && storyEpoch(story, "started_at") > storyEpoch(other, "started_at"))) {
                        kept.set(i, story);
                    }
                    absorbed = true;
                    break;
                }
            }
            if (!absorbed) {
                kept.add(story);
            }
        }
        return kept;
    }

    private static Set<String> eventKeys(JsonObject story) {
        Set<String> keys = new HashSet<>();
        if (story == null || !story.has("events")) {
            return keys;
        }
        for (JsonElement el : story.getAsJsonArray("events")) {
            if (!el.isJsonObject()) {
                continue;
            }
            JsonObject ev = el.getAsJsonObject();
            keys.add(str(ev, "type") + "|" + str(ev, "at") + "|" + str(ev, "detail"));
        }
        return keys;
    }

    private static double jaccard(Set<String> a, Set<String> b) {
        if (a.isEmpty() && b.isEmpty()) {
            return 1.0;
        }
        Set<String> inter = new HashSet<>(a);
        inter.retainAll(b);
        Set<String> union = new HashSet<>(a);
        union.addAll(b);
        if (union.isEmpty()) {
            return 0;
        }
        return (double) inter.size() / (double) union.size();
    }

    private static Candidate candidate(
            String type,
            String domain,
            Instant t,
            String detail,
            String tabLink,
            String incidentId,
            String file
    ) {
        String iso = ZonedDateTime.ofInstant(t, ZoneOffset.UTC).format(ISO);
        return new Candidate(type, domain, t.getEpochSecond(), iso, detail, tabLink, incidentId, file);
    }

    private static void addUnique(List<Candidate> out, Set<String> seen, Candidate c) {
        if (c == null) {
            return;
        }
        String key = c.type + "|" + c.iso + "|" + c.detail;
        if (seen.add(key)) {
            out.add(c);
        }
    }

    private static Instant crashTime(JsonObject entry) {
        if (entry.has(OpsCacheSchema.ENTRY_MTIME) && entry.get(OpsCacheSchema.ENTRY_MTIME).isJsonPrimitive()) {
            try {
                return Instant.ofEpochSecond(entry.get(OpsCacheSchema.ENTRY_MTIME).getAsLong());
            } catch (Exception ignored) {
                // fall through
            }
        }
        return TimeParse.parseTime(str(entry, "time"));
    }

    private static String lagDetail(JsonObject entry) {
        if (entry.has("metrics") && entry.get("metrics").isJsonObject()) {
            JsonObject m = entry.getAsJsonObject("metrics");
            Double mspt = num(m, "mspt");
            Double tps = num(m, "tps");
            if (mspt != null && tps != null) {
                return String.format(Locale.US, "MSPT %.0fms · TPS %.1f", mspt, tps);
            }
            if (mspt != null) {
                return String.format(Locale.US, "MSPT %.0fms", mspt);
            }
        }
        String title = str(entry, "title");
        if (title != null && !title.isBlank()) {
            return title;
        }
        String narrative = str(entry, "narrative");
        if (narrative != null && !narrative.isBlank()) {
            return shorten(narrative);
        }
        return "Lag spike";
    }

    private static long maxJarMtime(JsonObject diff) {
        long max = 0;
        for (String key : List.of("added", "removed", "changed")) {
            if (!diff.has(key) || !diff.get(key).isJsonArray()) {
                continue;
            }
            for (JsonElement el : diff.getAsJsonArray(key)) {
                if (!el.isJsonObject()) {
                    continue;
                }
                JsonObject row = el.getAsJsonObject();
                if (row.has("mtime") && row.get("mtime").isJsonPrimitive()) {
                    try {
                        max = Math.max(max, row.get("mtime").getAsLong());
                    } catch (Exception ignored) {
                        // skip
                    }
                }
            }
        }
        return max;
    }

    private static String summarizeModDiff(JsonObject diff) {
        int added = intOr(diff, "added_count", 0);
        int removed = intOr(diff, "removed_count", 0);
        int changed = intOr(diff, "changed_count", 0);
        List<String> parts = new ArrayList<>();
        if (added > 0) {
            parts.add(added + " added");
        }
        if (removed > 0) {
            parts.add(removed + " removed");
        }
        if (changed > 0) {
            parts.add(changed + " updated");
        }
        return parts.isEmpty() ? "Mod jars changed" : String.join(", ", parts);
    }

    private static String clockLabel(String iso) {
        Instant t = TimeParse.parseTime(iso);
        if (t == null) {
            return iso;
        }
        return ZonedDateTime.ofInstant(t, ZoneOffset.UTC).format(CLOCK);
    }

    private static String sanitizeId(String iso) {
        if (iso == null) {
            return "unknown";
        }
        return iso.replaceAll("[^a-zA-Z0-9._-]", "-");
    }

    private static String shorten(String s) {
        if (s == null) {
            return "";
        }
        String t = s.trim();
        if (t.length() > 80) {
            return t.substring(0, 77) + "…";
        }
        return t;
    }

    private static String capitalize(String s) {
        if (s == null || s.isEmpty()) {
            return s;
        }
        return Character.toUpperCase(s.charAt(0)) + s.substring(1);
    }

    private static long storyEpoch(JsonObject story, String key) {
        Instant t = TimeParse.parseTime(str(story, key));
        return t != null ? t.getEpochSecond() : 0;
    }

    private static String str(JsonObject o, String key) {
        if (o == null || key == null || !o.has(key) || o.get(key).isJsonNull()) {
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

    private static Double num(JsonObject o, String key) {
        if (o == null || !o.has(key) || o.get(key).isJsonNull()) {
            return null;
        }
        try {
            return o.get(key).getAsDouble();
        } catch (Exception e) {
            return null;
        }
    }

    private static int intOr(JsonObject o, String key, int def) {
        if (o == null || !o.has(key) || o.get(key).isJsonNull()) {
            return def;
        }
        try {
            return o.get(key).getAsInt();
        } catch (Exception e) {
            return def;
        }
    }

    private record Candidate(
            String type,
            String domain,
            long epoch,
            String iso,
            String detail,
            String tabLink,
            String incidentId,
            String file
    ) {
    }
}
