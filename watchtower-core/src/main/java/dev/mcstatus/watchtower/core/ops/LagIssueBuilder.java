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

/**
 * Builds live lag issue peek entries and narratives from incident snapshots.
 */
public final class LagIssueBuilder {

    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_OFFSET_DATE_TIME;

    private LagIssueBuilder() {
    }

    public static JsonObject buildPeekEntry(JsonObject incident) {
        return buildPeekEntry(incident, null);
    }

    public static JsonObject buildPeekEntry(JsonObject incident, JsonObject sparkProfile) {
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
        buildHints(incident, sparkProfile).forEach(hints::add);
        entry.add("hints", hints);
        entry.add("findings", buildFindings(incident, sparkProfile));
        String suspect = primarySuspect(incident, sparkProfile);
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
        return buildHints(incident, null);
    }

    public static List<String> buildHints(JsonObject incident, JsonObject sparkProfile) {
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

        if (sparkProfile != null && sparkCorrelates(incident, sparkProfile)) {
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
        return buildFindings(incident, null);
    }

    public static JsonArray buildFindings(JsonObject incident, JsonObject sparkProfile) {
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

        if (ctx != null && ctx.has("host_cpu_pct")) {
            double cpu = ctx.get("host_cpu_pct").getAsDouble();
            if (cpu >= 85) {
                findings.add(finding("confirmed", "host_cpu",
                        String.format(Locale.US, "Host CPU elevated (%.0f%%)", cpu)));
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

        if (sparkProfile != null && sparkCorrelates(incident, sparkProfile)) {
            JsonObject topMod = firstModHint(sparkProfile);
            if (topMod != null && topMod.get("pct").getAsDouble() >= 8) {
                findings.add(finding("confirmed", "spark",
                        "Spark profiler: " + topMod.get("mod_id").getAsString()
                                + " ~" + Math.round(topMod.get("pct").getAsDouble())
                                + "% of Server thread (" + topMod.get("summary").getAsString() + ")"));
                hasConfirmedCause = true;
            } else {
                findings.add(finding("confirmed", "spark",
                        "Spark profiler captured tick attribution — see Spark tab"));
            }
        } else if (!hasConfirmedCause) {
            findings.add(finding("manual", "attribution",
                    "No single mod/chunk/entity culprit from logs — run Spark profiler and check Spark tab"));
        }

        return findings;
    }

    public static String primarySuspect(JsonObject incident) {
        return primarySuspect(incident, null);
    }

    public static String primarySuspect(JsonObject incident, JsonObject sparkProfile) {
        if (sparkProfile != null && sparkCorrelates(incident, sparkProfile)) {
            JsonObject topMod = firstModHint(sparkProfile);
            if (topMod != null && topMod.get("pct").getAsDouble() >= 8) {
                return "Spark: " + topMod.get("mod_id").getAsString()
                        + " ~" + Math.round(topMod.get("pct").getAsDouble()) + "% Server thread";
            }
        }
        JsonArray findings = buildFindings(incident, sparkProfile);
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

    private static boolean sparkCorrelates(JsonObject incident, JsonObject sparkProfile) {
        if (sparkProfile == null || !SparkProfileFacts.isFresh(sparkProfile, 24)) {
            return false;
        }
        Instant incidentAt = parseIncidentTime(incident);
        Instant captured = SparkProfileFacts.parseCapturedAt(sparkProfile);
        if (incidentAt == null || captured == null) {
            return true;
        }
        long diffMin = Math.abs(java.time.Duration.between(incidentAt, captured).toMinutes());
        return diffMin <= 5;
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
        if (!sparkProfile.has("mod_hints")) {
            return null;
        }
        JsonArray hints = sparkProfile.getAsJsonArray("mod_hints");
        if (hints.isEmpty()) {
            return null;
        }
        return hints.get(0).getAsJsonObject();
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
