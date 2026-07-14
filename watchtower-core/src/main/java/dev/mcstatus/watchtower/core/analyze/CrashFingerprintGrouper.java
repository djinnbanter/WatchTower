package dev.mcstatus.watchtower.core.analyze;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonNull;
import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.report.StateManager;
import dev.mcstatus.watchtower.core.util.TimeParse;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Fingerprint: {@code {failure_kind}|{stall_or_primary_or_-}|{exception_class_or_-}|{top_transformer_mods_csv}}
 *
 * <p>Groups crash summaries for the Crashes inbox (G-12). Cap: merge to ≤12 groups when possible;
 * if still &gt;15 after same-kind merges, fold across kinds into {@code other|other|-|-}.
 */
public final class CrashFingerprintGrouper {

    private static final int TARGET_MAX_GROUPS = 12;
    private static final int HARD_MAX_GROUPS = 15;
    private static final Pattern EXCEPTION_OR_ERROR =
            Pattern.compile("\\b([\\w.$]*(?:Exception|Error))\\b");

    private CrashFingerprintGrouper() {
    }

    /**
     * Group crash summaries by fingerprint.
     *
     * @param summaries           crash_summaries (or ops-cache entries with the same fields)
     * @param acknowledgedCrashes {@code acknowledged_crashes} map from state (may be null/empty)
     * @return {@code { groups, count, unreviewed, unreviewed_groups }}
     */
    public static JsonObject group(JsonArray summaries, JsonObject acknowledgedCrashes) {
        JsonObject acks = acknowledgedCrashes != null ? acknowledgedCrashes : new JsonObject();
        Map<String, MutableGroup> byFp = new LinkedHashMap<>();

        if (summaries != null) {
            for (JsonElement el : summaries) {
                if (!el.isJsonObject()) {
                    continue;
                }
                JsonObject row = el.getAsJsonObject();
                String fingerprint = fingerprintOf(row);
                MutableGroup g = byFp.computeIfAbsent(fingerprint, fp -> new MutableGroup(fp, row));
                g.addMember(row, acks);
            }
        }

        List<MutableGroup> groups = new ArrayList<>(byFp.values());
        enforceCap(groups);

        groups.sort(Comparator
                .comparingLong((MutableGroup g) -> epoch(g.lastAt)).reversed()
                .thenComparing(g -> g.fingerprint));

        JsonArray outGroups = new JsonArray();
        int totalCount = 0;
        int totalUnreviewed = 0;
        int unreviewedGroups = 0;
        for (MutableGroup g : groups) {
            g.members.sort(Comparator
                    .comparingLong((Member m) -> epoch(m.time)).reversed()
                    .thenComparing(m -> m.file != null ? m.file : ""));
            JsonObject obj = g.toJson();
            outGroups.add(obj);
            totalCount += g.count;
            totalUnreviewed += g.unreviewed;
            if (g.unreviewed > 0) {
                unreviewedGroups++;
            }
        }

        JsonObject result = new JsonObject();
        result.add("groups", outGroups);
        result.addProperty("count", totalCount);
        result.addProperty("unreviewed", totalUnreviewed);
        result.addProperty("unreviewed_groups", unreviewedGroups);
        return result;
    }

    static String fingerprintOf(JsonObject row) {
        String kind = strOr(row, "failure_kind", "unknown");
        String stallOrPrimary = stallOrPrimary(row);
        String exceptionClass = exceptionClass(str(row, "exception"));
        String transformers = topTransformerMods(row);
        return kind + "|" + stallOrPrimary + "|" + exceptionClass + "|" + transformers;
    }

    static String stallOrPrimary(JsonObject row) {
        String stall = str(row, "stall_mod_id");
        if (stall != null && !stall.isBlank()) {
            return stall;
        }
        String primary = str(row, "primary_mod_id");
        if (primary != null && !primary.isBlank()) {
            return primary;
        }
        return "-";
    }

    static String exceptionClass(String exception) {
        if (exception == null || exception.isBlank()) {
            return "-";
        }
        String s = exception.strip();
        int colon = s.indexOf(':');
        if (colon > 0) {
            String before = s.substring(0, colon).trim();
            String token = before.contains(" ") ? before.substring(before.lastIndexOf(' ') + 1) : before;
            if (!token.isBlank()) {
                return token;
            }
        }
        Matcher m = EXCEPTION_OR_ERROR.matcher(s);
        if (m.find()) {
            return m.group(1);
        }
        return "-";
    }

    static String topTransformerMods(JsonObject row) {
        if (row == null || !row.has("stack_frames") || !row.get("stack_frames").isJsonArray()) {
            return "-";
        }
        Set<String> unique = new TreeSet<>();
        for (JsonElement el : row.getAsJsonArray("stack_frames")) {
            if (!el.isJsonObject()) {
                continue;
            }
            String modId = str(el.getAsJsonObject(), "mod_id");
            if (modId != null && !modId.isBlank()) {
                unique.add(modId);
            }
        }
        if (unique.isEmpty()) {
            return "-";
        }
        List<String> list = new ArrayList<>(unique);
        if (list.size() > 3) {
            list = list.subList(0, 3);
        }
        return String.join(",", list);
    }

    static String labelFor(String failureKind, String stallOrPrimary, String fingerprint) {
        if (fingerprint != null && ("other|other|-|-".equals(fingerprint) || fingerprint.endsWith("|other|-|-"))) {
            if ("other|other|-|-".equals(fingerprint)) {
                return "Other crashes";
            }
            String kind = failureKind != null ? failureKind : fingerprint.split("\\|", 2)[0];
            return "Other " + humanize(kind);
        }
        if (CrashClassifier.FK_WATCHDOG.equals(failureKind)
                || CrashClassifier.FK_WATCHDOG_FOLLOWUP.equals(failureKind)) {
            return "Generic tick stall";
        }
        if (CrashClassifier.FK_WATCHDOG_PREGEN.equals(failureKind)) {
            if (stallOrPrimary != null && !stallOrPrimary.isBlank() && !"-".equals(stallOrPrimary)) {
                return "Pregen / map stall (" + stallOrPrimary + ")";
            }
            return "Pregen / map stall";
        }
        if (CrashClassifier.FK_MOD_RUNTIME.equals(failureKind)) {
            if (stallOrPrimary != null && !stallOrPrimary.isBlank() && !"-".equals(stallOrPrimary)) {
                return "Mod crash (" + stallOrPrimary + ")";
            }
            return "Mod crash";
        }
        if (CrashClassifier.FK_WORLD_NBT_CORRUPT.equals(failureKind)) {
            return "Corrupt world NBT";
        }
        return humanize(failureKind != null ? failureKind : "unknown");
    }

    private static String humanize(String failureKind) {
        if (failureKind == null || failureKind.isBlank()) {
            return "Unknown";
        }
        String spaced = failureKind.replace('_', ' ').trim();
        if (spaced.isEmpty()) {
            return "Unknown";
        }
        return Character.toUpperCase(spaced.charAt(0)) + spaced.substring(1);
    }

    private static void enforceCap(List<MutableGroup> groups) {
        while (groups.size() > TARGET_MAX_GROUPS) {
            if (!mergeSmallestSameKind(groups)) {
                break;
            }
        }
        while (groups.size() > HARD_MAX_GROUPS) {
            if (!mergeSmallestCrossKind(groups)) {
                break;
            }
        }
    }

    private static boolean mergeSmallestSameKind(List<MutableGroup> groups) {
        Map<String, List<MutableGroup>> byKind = new LinkedHashMap<>();
        for (MutableGroup g : groups) {
            byKind.computeIfAbsent(g.failureKind, k -> new ArrayList<>()).add(g);
        }
        MutableGroup victim = null;
        String kind = null;
        for (Map.Entry<String, List<MutableGroup>> e : byKind.entrySet()) {
            if (e.getValue().size() < 2) {
                continue;
            }
            String otherFp = e.getKey() + "|other|-|-";
            for (MutableGroup g : e.getValue()) {
                if (otherFp.equals(g.fingerprint)) {
                    continue;
                }
                if (victim == null
                        || g.count < victim.count
                        || (g.count == victim.count && g.fingerprint.compareTo(victim.fingerprint) < 0)) {
                    victim = g;
                    kind = e.getKey();
                }
            }
        }
        if (victim == null || kind == null) {
            return false;
        }
        String otherFp = kind + "|other|-|-";
        MutableGroup bucket = findByFingerprint(groups, otherFp);
        if (bucket == null) {
            bucket = MutableGroup.otherBucket(kind);
            groups.add(bucket);
        }
        absorbInto(bucket, victim);
        groups.remove(victim);
        return true;
    }

    private static boolean mergeSmallestCrossKind(List<MutableGroup> groups) {
        String otherFp = "other|other|-|-";
        MutableGroup victim = null;
        for (MutableGroup g : groups) {
            if (otherFp.equals(g.fingerprint)) {
                continue;
            }
            if (victim == null
                    || g.count < victim.count
                    || (g.count == victim.count && g.fingerprint.compareTo(victim.fingerprint) < 0)) {
                victim = g;
            }
        }
        if (victim == null) {
            return false;
        }
        MutableGroup bucket = findByFingerprint(groups, otherFp);
        if (bucket == null) {
            bucket = MutableGroup.crossOtherBucket();
            groups.add(bucket);
        }
        absorbInto(bucket, victim);
        groups.remove(victim);
        return true;
    }

    private static MutableGroup findByFingerprint(List<MutableGroup> groups, String fp) {
        for (MutableGroup g : groups) {
            if (fp.equals(g.fingerprint)) {
                return g;
            }
        }
        return null;
    }

    private static void absorbInto(MutableGroup target, MutableGroup source) {
        if (target == source) {
            return;
        }
        for (Member m : source.members) {
            target.members.add(m);
            target.count++;
            if (!m.acknowledged) {
                target.unreviewed++;
            }
            if (m.incidentId != null && !m.incidentId.isBlank()) {
                target.incidentIds.add(m.incidentId);
            }
            if (target.firstAt == null || compareTime(m.time, target.firstAt) < 0) {
                target.firstAt = m.time;
            }
            if (target.lastAt == null || compareTime(m.time, target.lastAt) > 0) {
                target.lastAt = m.time;
            }
        }
    }

    private static int compareTime(String a, String b) {
        return Long.compare(epoch(a), epoch(b));
    }

    private static long epoch(String time) {
        Instant inst = TimeParse.parseTime(time);
        return inst != null ? inst.getEpochSecond() : 0L;
    }

    private static String str(JsonObject o, String key) {
        if (o == null || !o.has(key) || o.get(key).isJsonNull()) {
            return null;
        }
        JsonElement el = o.get(key);
        if (el.isJsonPrimitive()) {
            return el.getAsString();
        }
        return null;
    }

    private static String strOr(JsonObject o, String key, String def) {
        String s = str(o, key);
        return s != null && !s.isBlank() ? s : def;
    }

    private static final class MutableGroup {
        String fingerprint;
        String label;
        String failureKind;
        String stallModId;
        int count;
        String firstAt;
        String lastAt;
        int unreviewed;
        final Set<String> incidentIds = new LinkedHashSet<>();
        final List<Member> members = new ArrayList<>();

        MutableGroup(String fingerprint, JsonObject seed) {
            this.fingerprint = fingerprint;
            this.failureKind = strOr(seed, "failure_kind", "unknown");
            this.stallModId = str(seed, "stall_mod_id");
            this.label = labelFor(failureKind, stallOrPrimary(seed), fingerprint);
        }

        static MutableGroup otherBucket(String failureKind) {
            MutableGroup g = new MutableGroup();
            g.failureKind = failureKind;
            g.fingerprint = failureKind + "|other|-|-";
            g.label = "Other " + humanize(failureKind);
            return g;
        }

        static MutableGroup crossOtherBucket() {
            MutableGroup g = new MutableGroup();
            g.failureKind = "other";
            g.fingerprint = "other|other|-|-";
            g.label = "Other crashes";
            return g;
        }

        private MutableGroup() {
        }

        void addMember(JsonObject row, JsonObject acks) {
            String file = strOr(row, "file", "");
            boolean acked = StateManager.isCrashAcked(acks, file);
            String time = str(row, "time");
            String incidentId = str(row, "incident_id");
            Member m = Member.from(row, file, time, incidentId, acked);
            members.add(m);
            count++;
            if (!acked) {
                unreviewed++;
            }
            if (incidentId != null && !incidentId.isBlank()) {
                incidentIds.add(incidentId);
            }
            if (firstAt == null || compareTime(time, firstAt) < 0) {
                firstAt = time;
            }
            if (lastAt == null || compareTime(time, lastAt) > 0) {
                lastAt = time;
            }
            if (stallModId == null) {
                stallModId = str(row, "stall_mod_id");
            }
        }

        JsonObject toJson() {
            JsonObject o = new JsonObject();
            o.addProperty("fingerprint", fingerprint);
            o.addProperty("label", label);
            o.addProperty("failure_kind", failureKind);
            if (stallModId != null) {
                o.addProperty("stall_mod_id", stallModId);
            } else {
                o.add("stall_mod_id", JsonNull.INSTANCE);
            }
            o.addProperty("count", count);
            if (firstAt != null) {
                o.addProperty("first_at", firstAt);
            }
            if (lastAt != null) {
                o.addProperty("last_at", lastAt);
            }
            o.addProperty("unreviewed", unreviewed);
            JsonArray ids = new JsonArray();
            for (String id : incidentIds) {
                ids.add(id);
            }
            o.add("incident_ids", ids);
            JsonArray mem = new JsonArray();
            for (Member m : members) {
                mem.add(m.toJson());
            }
            o.add("members", mem);
            return o;
        }
    }

    private static final class Member {
        final String file;
        final String time;
        final String incidentId;
        final boolean acknowledged;
        final String displayLabel;
        final JsonObject extras;

        Member(String file, String time, String incidentId, boolean acknowledged,
               String displayLabel, JsonObject extras) {
            this.file = file;
            this.time = time;
            this.incidentId = incidentId;
            this.acknowledged = acknowledged;
            this.displayLabel = displayLabel;
            this.extras = extras;
        }

        static Member from(JsonObject row, String file, String time, String incidentId, boolean acked) {
            JsonObject extras = new JsonObject();
            copyOpt(row, extras, "exception");
            copyOpt(row, extras, "primary_mod_id");
            copyOpt(row, extras, "plain_english");
            copyOpt(row, extras, "fix_hints");
            copyOpt(row, extras, "mod_fix");
            copyOpt(row, extras, "category");
            copyOpt(row, extras, "failure_kind");
            copyOpt(row, extras, "watchdog_tick_ms");
            copyOpt(row, extras, "suspect_mod_id");
            copyOpt(row, extras, "stall_mod_id");
            copyOpt(row, extras, "matched_rule_id");
            copyOpt(row, extras, "matched_pack_id");
            return new Member(file, time, incidentId, acked, str(row, "display_label"), extras);
        }

        JsonObject toJson() {
            JsonObject o = new JsonObject();
            o.addProperty("file", file);
            if (time != null) {
                o.addProperty("time", time);
            }
            if (incidentId != null) {
                o.addProperty("incident_id", incidentId);
            }
            o.addProperty("acknowledged", acknowledged);
            if (displayLabel != null) {
                o.addProperty("display_label", displayLabel);
            }
            for (String key : extras.keySet()) {
                o.add(key, extras.get(key));
            }
            return o;
        }

        private static void copyOpt(JsonObject from, JsonObject to, String key) {
            if (from.has(key) && !from.get(key).isJsonNull()) {
                to.add(key, from.get(key));
            }
        }
    }
}
