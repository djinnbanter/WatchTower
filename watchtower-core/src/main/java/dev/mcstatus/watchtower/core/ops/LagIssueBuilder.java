package dev.mcstatus.watchtower.core.ops;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.collect.SparkProfileFacts;

import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Builds live lag issue peek entries and narratives from incident snapshots.
 */
public final class LagIssueBuilder {

    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_OFFSET_DATE_TIME;
    private static final Set<String> VANILLA_MODS = Set.of("minecraft", "neoforge", "forge");
    /** Default matches {@code SPARK_FRESH_HOURS} when callers omit config. */
    public static final int DEFAULT_SPARK_FRESH_HOURS = 24;
    /** Max minutes between lag pin and Spark capture for correlation. */
    public static final int SPARK_CORRELATION_WINDOW_MIN = 60;

    private LagIssueBuilder() {
    }

    public static JsonObject buildPeekEntry(JsonObject incident) {
        return buildPeekEntry(incident, null, DEFAULT_SPARK_FRESH_HOURS);
    }

    public static JsonObject buildPeekEntry(JsonObject incident, JsonObject sparkProfile) {
        return buildPeekEntry(incident, sparkProfile, DEFAULT_SPARK_FRESH_HOURS);
    }

    public static JsonObject buildPeekEntry(JsonObject incident, JsonObject sparkProfile, int sparkFreshHours) {
        String id = incident.has("id") ? incident.get("id").getAsString() : "unknown";
        JsonObject entry = new JsonObject();
        entry.addProperty("id", "LAG-" + id);
        entry.addProperty("incident_id", id);
        entry.addProperty("severity", incident.has("severity") ? incident.get("severity").getAsString() : "warning");
        entry.addProperty("time", incident.has("pinned_at") ? incident.get("pinned_at").getAsString()
                : ZonedDateTime.now(ZoneId.systemDefault()).format(ISO));
        double mspt = incident.has("mspt") ? incident.get("mspt").getAsDouble() : 0;
        double tps = incident.has("tps") ? incident.get("tps").getAsDouble() : 20;
        entry.addProperty("title", String.format(Locale.US, "Lag spike — MSPT %.0fms · TPS %.1f", mspt, tps));
        entry.addProperty("narrative", buildNarrative(incident));
        JsonArray hints = new JsonArray();
        buildHints(incident, sparkProfile, sparkFreshHours).forEach(hints::add);
        entry.add("hints", hints);
        entry.add("findings", buildFindings(incident, sparkProfile, sparkFreshHours));
        String suspect = primarySuspect(incident, sparkProfile, sparkFreshHours);
        if (suspect != null) {
            entry.addProperty("primary_suspect", suspect);
        }

        JsonObject metrics = new JsonObject();
        metrics.addProperty("tps", tps);
        metrics.addProperty("mspt", mspt);
        if (incident.has("players_online")) {
            metrics.addProperty("players_online", incident.get("players_online").getAsInt());
        }
        entry.add("metrics", metrics);

        JsonArray players = new JsonArray();
        if (incident.has("players") && incident.get("players").isJsonArray()) {
            for (JsonElement el : incident.getAsJsonArray("players")) {
                if (el.isJsonObject() && el.getAsJsonObject().has("name")) {
                    players.add(el.getAsJsonObject().get("name").getAsString());
                }
            }
        }
        entry.add("players", players);
        entry.addProperty("resolved", false);

        JsonArray attachedTop = attachedTopMods(incident);
        if (attachedTop != null) {
            entry.add("top_mods", attachedTop.deepCopy());
        }
        String profilePath = attachedSparkPath(incident);
        if (profilePath != null) {
            entry.addProperty("spark_profile_path", profilePath);
        }
        String autoStatus = attachedAutoStatus(incident);
        if (autoStatus != null) {
            entry.addProperty("spark_auto_capture_status", autoStatus);
        }
        return entry;
    }

    public static String buildNarrative(JsonObject incident) {
        double mspt = incident.has("mspt") ? incident.get("mspt").getAsDouble() : 0;
        double tps = incident.has("tps") ? incident.get("tps").getAsDouble() : 20;
        int players = incident.has("players_online") ? incident.get("players_online").getAsInt() : 0;
        StringBuilder sb = new StringBuilder();
        sb.append(String.format(Locale.US, "MSPT hit %.0fms with TPS %.1f", mspt, tps));
        if (players > 0) {
            sb.append(String.format(Locale.US, " and %d player%s online", players, players == 1 ? "" : "s"));
        }
        sb.append(".");

        JsonObject ctx = incident.has("context") ? incident.getAsJsonObject("context") : null;
        if (ctx != null && ctx.has("background_jobs") && ctx.getAsJsonArray("background_jobs").size() > 0) {
            sb.append(" World pregen was active.");
        }
        if (ctx != null && ctx.has("recent_commands") && ctx.getAsJsonArray("recent_commands").size() > 0) {
            JsonObject last = ctx.getAsJsonArray("recent_commands")
                    .get(ctx.getAsJsonArray("recent_commands").size() - 1).getAsJsonObject();
            if (last.has("command")) {
                sb.append(" Last command: ").append(last.get("command").getAsString()).append(".");
            }
        }
        return sb.toString();
    }

    public static List<String> buildHints(JsonObject incident) {
        return buildHints(incident, null, DEFAULT_SPARK_FRESH_HOURS);
    }

    public static List<String> buildHints(JsonObject incident, JsonObject sparkProfile) {
        return buildHints(incident, sparkProfile, DEFAULT_SPARK_FRESH_HOURS);
    }

    public static List<String> buildHints(JsonObject incident, JsonObject sparkProfile, int sparkFreshHours) {
        List<String> hints = new ArrayList<>();
        int players = incident.has("players_online") ? incident.get("players_online").getAsInt() : 0;
        if (players >= 3) {
            hints.add(players + " players online — lag may be player-driven (entities, chunk loading)");
        } else if (players > 0) {
            hints.add(players + " player(s) online — check player activity and loaded chunks");
        }

        JsonObject ctx = incident.has("context") ? incident.getAsJsonObject("context") : null;
        if (ctx != null && ctx.has("background_jobs")) {
            for (JsonElement el : ctx.getAsJsonArray("background_jobs")) {
                JsonObject job = el.getAsJsonObject();
                String type = job.has("type") ? job.get("type").getAsString() : "job";
                if (type.contains("chunky") || type.contains("pregen")) {
                    hints.add("World pregen running — competes with tick time; consider pausing during peak hours");
                    break;
                }
            }
        }

        if (ctx != null && ctx.has("recent_commands")) {
            for (JsonElement el : ctx.getAsJsonArray("recent_commands")) {
                JsonObject cmd = el.getAsJsonObject();
                if (!cmd.has("command")) {
                    continue;
                }
                String c = cmd.get("command").getAsString().toLowerCase(Locale.ROOT);
                if (c.contains("/fill") || c.contains("/summon") || c.contains("/spreadplayers")
                        || c.contains("/execute")) {
                    hints.add("Heavy command in last 2 min: " + cmd.get("command").getAsString());
                    break;
                }
            }
        }

        if (incident.has("entities") && incident.get("entities").getAsLong() > 8000) {
            hints.add("Entity count elevated (" + incident.get("entities").getAsLong()
                    + ") — check farms / mob caps");
        }

        if (incident.has("heap_used_gb") && incident.has("heap_max_gb")) {
            double used = incident.get("heap_used_gb").getAsDouble();
            double max = incident.get("heap_max_gb").getAsDouble();
            if (max > 0 && used / max > 0.85) {
                hints.add("JVM heap nearly full — GC pauses can spike MSPT");
            }
        }

        JsonObject attachedTop = firstAttachedTopMod(incident);
        if (attachedTop != null) {
            String label = attachedModLabel(attachedTop);
            hints.add(label + " ~" + Math.round(attachedTop.get("pct").getAsDouble())
                    + "% (auto-profiled) — open Spark tab for full report");
        } else if (sparkProfile != null && sparkCorrelates(incident, sparkProfile, sparkFreshHours)) {
            JsonObject topMod = firstModHint(sparkProfile);
            if (topMod != null) {
                hints.add("Spark profile: " + topMod.get("mod_id").getAsString()
                        + " ~" + Math.round(topMod.get("pct").getAsDouble())
                        + "% on Server thread — open Spark tab for full report");
            } else {
                hints.add("Spark profile available — open Spark tab for tick attribution");
            }
        } else if (hints.isEmpty()) {
            hints.add("No single smoking gun — run Spark profiler and open Spark tab after your next report");
        }
        return hints;
    }

    public static JsonArray buildFindings(JsonObject incident) {
        return buildFindings(incident, null, DEFAULT_SPARK_FRESH_HOURS);
    }

    public static JsonArray buildFindings(JsonObject incident, JsonObject sparkProfile) {
        return buildFindings(incident, sparkProfile, DEFAULT_SPARK_FRESH_HOURS);
    }

    public static JsonArray buildFindings(JsonObject incident, JsonObject sparkProfile, int sparkFreshHours) {
        JsonArray findings = new JsonArray();
        JsonObject ctx = incident.has("context") ? incident.getAsJsonObject("context") : null;

        int players = incident.has("players_online") ? incident.get("players_online").getAsInt() : 0;
        if (players > 0) {
            findings.add(finding("confirmed", "players",
                    players + " player(s) online at spike time"));
        }

        if (ctx != null && ctx.has("background_jobs")) {
            for (JsonElement el : ctx.getAsJsonArray("background_jobs")) {
                JsonObject job = el.getAsJsonObject();
                String detail = job.has("detail") ? job.get("detail").getAsString() : "active";
                String type = job.has("type") ? job.get("type").getAsString() : "job";
                if (type.contains("chunky") || type.contains("pregen")) {
                    findings.add(finding("confirmed", "pregen",
                            "World pregen was running — " + detail));
                    break;
                }
            }
        }

        if (ctx != null && ctx.has("recent_commands")) {
            for (JsonElement el : ctx.getAsJsonArray("recent_commands")) {
                JsonObject cmd = el.getAsJsonObject();
                if (!cmd.has("command")) {
                    continue;
                }
                String c = cmd.get("command").getAsString();
                String lower = c.toLowerCase(Locale.ROOT);
                if (lower.contains("/fill") || lower.contains("/summon") || lower.contains("/spreadplayers")
                        || lower.contains("/execute") || lower.contains("/chunky") || lower.contains("/forceload")) {
                    String who = cmd.has("player") ? cmd.get("player").getAsString() + ": " : "";
                    findings.add(finding("confirmed", "command",
                            "Recent heavy command — " + who + c));
                    break;
                }
            }
        }

        if (incident.has("entities") && incident.get("entities").getAsLong() > 8000) {
            findings.add(finding("confirmed", "entities",
                    "Entity count elevated (" + incident.get("entities").getAsLong() + ")"));
        }

        if (incident.has("heap_used_gb") && incident.has("heap_max_gb")) {
            double used = incident.get("heap_used_gb").getAsDouble();
            double max = incident.get("heap_max_gb").getAsDouble();
            if (max > 0 && used / max > 0.85) {
                findings.add(finding("confirmed", "heap",
                        String.format(Locale.US, "JVM heap nearly full (%.1f / %.1f GB)", used, max)));
            }
        }

        if (ctx != null) {
            Double coresUsed = ctx.has("cpu_cores_used") && !ctx.get("cpu_cores_used").isJsonNull()
                    ? ctx.get("cpu_cores_used").getAsDouble() : null;
            Double limitCores = ctx.has("cpu_limit_cores") && !ctx.get("cpu_limit_cores").isJsonNull()
                    ? ctx.get("cpu_limit_cores").getAsDouble() : null;
            if (coresUsed != null && limitCores != null && limitCores > 0) {
                double ofPlan = 100.0 * coresUsed / limitCores;
                if (ofPlan >= 85) {
                    findings.add(finding("confirmed", "host_cpu",
                            String.format(Locale.US, "CPU high vs plan (%.0f%% of %.1f cores)",
                                    ofPlan, limitCores)));
                }
            } else if (ctx.has("host_cpu_pct") && !ctx.get("host_cpu_pct").isJsonNull()) {
                double cpu = ctx.get("host_cpu_pct").getAsDouble();
                if (cpu >= 85) {
                    findings.add(finding("confirmed", "host_cpu",
                            String.format(Locale.US, "Host CPU elevated (%.0f%%)", cpu)));
                }
            }
        }

        boolean hasConfirmedCause = false;
        for (JsonElement el : findings) {
            String cat = el.getAsJsonObject().has("category")
                    ? el.getAsJsonObject().get("category").getAsString() : "";
            if ("pregen".equals(cat) || "command".equals(cat)) {
                hasConfirmedCause = true;
                break;
            }
        }

        JsonObject attachedTop = firstAttachedTopMod(incident);
        if (attachedTop != null) {
            String label = attachedModLabel(attachedTop);
            double pct = attachedTop.has("pct") ? attachedTop.get("pct").getAsDouble() : 0;
            findings.add(finding("confirmed", "spark",
                    label + " ~" + Math.round(pct) + "% (auto-profiled)"));
            hasConfirmedCause = true;
        } else if (sparkProfile != null && sparkCorrelates(incident, sparkProfile, sparkFreshHours)) {
            JsonObject topMod = firstModHint(sparkProfile);
            if (topMod != null && topMod.get("pct").getAsDouble() >= 8) {
                String summary = topMod.has("summary") ? topMod.get("summary").getAsString() : "Server thread";
                findings.add(finding("confirmed", "spark",
                        "Spark profiler: " + topMod.get("mod_id").getAsString()
                                + " ~" + Math.round(topMod.get("pct").getAsDouble())
                                + "% of Server thread (" + summary + ")"));
                hasConfirmedCause = true;
            } else {
                findings.add(finding("confirmed", "spark",
                        "Spark profiler captured tick attribution — see Spark tab"));
                hasConfirmedCause = true;
            }
        }

        if (!hasConfirmedCause) {
            findings.add(finding("manual", "attribution",
                    "No single mod/chunk/entity culprit from logs — run Spark profiler and check Spark tab"));
        }

        return findings;
    }

    public static String primarySuspect(JsonObject incident) {
        return primarySuspect(incident, null, DEFAULT_SPARK_FRESH_HOURS);
    }

    public static String primarySuspect(JsonObject incident, JsonObject sparkProfile) {
        return primarySuspect(incident, sparkProfile, DEFAULT_SPARK_FRESH_HOURS);
    }

    public static String primarySuspect(JsonObject incident, JsonObject sparkProfile, int sparkFreshHours) {
        JsonObject attachedTop = firstAttachedTopMod(incident);
        if (attachedTop != null) {
            String label = attachedModLabel(attachedTop);
            double pct = attachedTop.has("pct") ? attachedTop.get("pct").getAsDouble() : 0;
            return label + " ~" + Math.round(pct) + "% (auto-profiled)";
        }
        if (sparkProfile != null && sparkCorrelates(incident, sparkProfile, sparkFreshHours)) {
            JsonObject topMod = firstModHint(sparkProfile);
            if (topMod != null && topMod.get("pct").getAsDouble() >= 8) {
                return "Spark: " + topMod.get("mod_id").getAsString()
                        + " ~" + Math.round(topMod.get("pct").getAsDouble()) + "% Server thread";
            }
        }
        JsonArray findings = buildFindings(incident, sparkProfile, sparkFreshHours);
        for (JsonElement el : findings) {
            JsonObject f = el.getAsJsonObject();
            if (!"confirmed".equals(str(f, "kind"))) {
                continue;
            }
            String cat = str(f, "category");
            if ("pregen".equals(cat) || "command".equals(cat) || "entities".equals(cat) || "heap".equals(cat)) {
                return str(f, "text");
            }
        }
        return null;
    }

    /** Package-visible for tests. */
    static boolean sparkCorrelates(JsonObject incident, JsonObject sparkProfile) {
        return sparkCorrelates(incident, sparkProfile, DEFAULT_SPARK_FRESH_HOURS);
    }

    static boolean sparkCorrelates(JsonObject incident, JsonObject sparkProfile, int sparkFreshHours) {
        if (sparkProfile == null || !SparkProfileFacts.isFresh(sparkProfile, sparkFreshHours)) {
            return false;
        }
        Instant incidentAt = parseIncidentTime(incident);
        Instant captured = SparkProfileFacts.parseCapturedAt(sparkProfile);
        // Missing times: do not guess — auto-attach path already preferred via firstAttachedTopMod.
        if (incidentAt == null || captured == null) {
            return false;
        }
        long diffMin = Math.abs(java.time.Duration.between(incidentAt, captured).toMinutes());
        return diffMin <= SPARK_CORRELATION_WINDOW_MIN;
    }

    private static Instant parseIncidentTime(JsonObject incident) {
        if (!incident.has("pinned_at")) {
            return null;
        }
        try {
            return ZonedDateTime.parse(incident.get("pinned_at").getAsString()).toInstant();
        } catch (Exception e) {
            return null;
        }
    }

    private static JsonObject firstModHint(JsonObject sparkProfile) {
        if (sparkProfile == null || !sparkProfile.has("mod_hints")) {
            return null;
        }
        JsonArray hints = sparkProfile.getAsJsonArray("mod_hints");
        for (JsonElement el : hints) {
            if (!el.isJsonObject()) {
                continue;
            }
            JsonObject hint = el.getAsJsonObject();
            String modId = hint.has("mod_id") ? hint.get("mod_id").getAsString() : "";
            if (modId.isBlank() || isVanillaMod(modId)) {
                continue;
            }
            return hint;
        }
        return null;
    }

    private static JsonArray attachedTopMods(JsonObject incident) {
        if (incident == null) {
            return null;
        }
        if (incident.has("top_mods") && incident.get("top_mods").isJsonArray()
                && incident.getAsJsonArray("top_mods").size() > 0) {
            return incident.getAsJsonArray("top_mods");
        }
        if (incident.has("spark_auto_capture") && incident.get("spark_auto_capture").isJsonObject()) {
            JsonObject auto = incident.getAsJsonObject("spark_auto_capture");
            if (auto.has("top_mods") && auto.get("top_mods").isJsonArray()
                    && auto.getAsJsonArray("top_mods").size() > 0) {
                return auto.getAsJsonArray("top_mods");
            }
        }
        return null;
    }

    private static JsonObject firstAttachedTopMod(JsonObject incident) {
        JsonArray tops = attachedTopMods(incident);
        if (tops == null) {
            return null;
        }
        for (JsonElement el : tops) {
            if (!el.isJsonObject()) {
                continue;
            }
            JsonObject row = el.getAsJsonObject();
            String modId = row.has("mod_id") ? row.get("mod_id").getAsString() : "";
            if (modId.isBlank() || isVanillaMod(modId)) {
                continue;
            }
            return row;
        }
        return null;
    }

    private static String attachedSparkPath(JsonObject incident) {
        if (incident == null) {
            return null;
        }
        if (incident.has("spark_profile_path") && !incident.get("spark_profile_path").isJsonNull()) {
            String p = incident.get("spark_profile_path").getAsString();
            if (p != null && !p.isBlank()) {
                return p;
            }
        }
        if (incident.has("spark_auto_capture") && incident.get("spark_auto_capture").isJsonObject()) {
            JsonObject auto = incident.getAsJsonObject("spark_auto_capture");
            if (auto.has("spark_profile_path") && !auto.get("spark_profile_path").isJsonNull()) {
                String p = auto.get("spark_profile_path").getAsString();
                if (p != null && !p.isBlank()) {
                    return p;
                }
            }
        }
        return null;
    }

    private static String attachedAutoStatus(JsonObject incident) {
        if (incident == null || !incident.has("spark_auto_capture")
                || !incident.get("spark_auto_capture").isJsonObject()) {
            return null;
        }
        JsonObject auto = incident.getAsJsonObject("spark_auto_capture");
        return auto.has("status") && !auto.get("status").isJsonNull()
                ? auto.get("status").getAsString() : null;
    }

    private static String attachedModLabel(JsonObject row) {
        if (row.has("display_name") && !row.get("display_name").isJsonNull()) {
            String name = row.get("display_name").getAsString();
            if (name != null && !name.isBlank()) {
                return name;
            }
        }
        return row.has("mod_id") ? row.get("mod_id").getAsString() : "mod";
    }

    private static boolean isVanillaMod(String modId) {
        return VANILLA_MODS.contains(modId.toLowerCase(Locale.ROOT));
    }

    private static JsonObject finding(String kind, String category, String text) {
        JsonObject o = new JsonObject();
        o.addProperty("kind", kind);
        o.addProperty("category", category);
        o.addProperty("text", text);
        return o;
    }

    private static String str(JsonObject o, String key) {
        return o.has(key) && !o.get(key).isJsonNull() ? o.get(key).getAsString() : null;
    }

    public static JsonObject updateResolvedFlags(JsonObject lagIssuesBlock, double tps, double mspt,
                                                  double tpsWarn, double msptWarn, long nowEpoch) {
        if (lagIssuesBlock == null || !lagIssuesBlock.has(OpsCacheSchema.LAG_ISSUES_ENTRIES)) {
            return lagIssuesBlock;
        }
        JsonArray entries = lagIssuesBlock.getAsJsonArray(OpsCacheSchema.LAG_ISSUES_ENTRIES);
        int active = 0;
        boolean healthy = tps >= tpsWarn && mspt <= msptWarn;
        for (JsonElement el : entries) {
            JsonObject entry = el.getAsJsonObject();
            if (entry.has("resolved") && entry.get("resolved").getAsBoolean()) {
                continue;
            }
            if (healthy) {
                long resolvedAt = entry.has("resolved_at_epoch") ? entry.get("resolved_at_epoch").getAsLong() : 0;
                if (resolvedAt == 0) {
                    entry.addProperty("resolved_at_epoch", nowEpoch);
                } else if (nowEpoch - resolvedAt >= 60) {
                    entry.addProperty("resolved", true);
                }
            } else {
                entry.remove("resolved_at_epoch");
                active++;
            }
        }
        lagIssuesBlock.addProperty(OpsCacheSchema.LAG_ISSUES_ACTIVE_COUNT, active);
        lagIssuesBlock.addProperty(OpsCacheSchema.LAG_ISSUES_UPDATED_AT,
                ZonedDateTime.now(ZoneId.systemDefault()).format(ISO));
        return lagIssuesBlock;
    }
}
