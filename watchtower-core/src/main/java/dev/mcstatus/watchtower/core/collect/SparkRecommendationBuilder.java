package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Rule-based recommendations and key findings for Spark profiler reports.
 */
public final class SparkRecommendationBuilder {

    private SparkRecommendationBuilder() {
    }

    public static void enrich(JsonObject profile) {
        if (profile == null) {
            return;
        }
        boolean allocation = SparkProfileFacts.isAllocation(profile);
        List<JsonObject> findings = new ArrayList<>();
        List<JsonObject> recommendations = new ArrayList<>();

        JsonObject ctx = profile.has("context") ? profile.getAsJsonObject("context") : new JsonObject();
        double tps = ctx.has("tps_1m") ? ctx.get("tps_1m").getAsDouble() : 20;
        double mspt = ctx.has("mspt_p95_1m") ? ctx.get("mspt_p95_1m").getAsDouble() : 0;
        int players = ctx.has("players") ? ctx.get("players").getAsInt() : 0;
        int entities = ctx.has("world_entities") ? ctx.get("world_entities").getAsInt() : 0;

        String shareLabel = allocation ? "of sample allocations" : "of Server thread";

        JsonObject topMod = firstModRollup(profile);
        if (topMod != null) {
            String modId = topMod.get("mod_id").getAsString();
            double pct = topMod.get("pct").getAsDouble();
            if (pct >= 15 && !isVanillaMod(modId)) {
                findings.add(finding("mod_dominant", "critical",
                        modId + " used ~" + Math.round(pct) + "% " + shareLabel,
                        topMod.get("top_label").getAsString() + (allocation
                                ? " was the hottest allocation path"
                                : " was the hottest path")));
                recommendations.add(rec("critical", "mod",
                        "Investigate " + modId,
                        allocation
                                ? "This mod had the highest allocation share during the capture. Check configs and heap-heavy features."
                                : "This mod dominated tick time during the capture. Check recent updates, configs, or temporarily disable to confirm.",
                        List.of(
                                "Review " + modId + " configs and recent changes",
                                "Update or roll back " + modId + " if lag started after a mod pack change",
                                allocation
                                        ? "Capture an execution profile too if tick lag persists"
                                        : "Capture another profile after changes to compare"
                        ),
                        modId));
            } else if (pct >= 8 && !isVanillaMod(modId)) {
                findings.add(finding("mod_dominant", "warn",
                        modId + " contributed ~" + Math.round(pct) + "% " + shareLabel,
                        allocation
                                ? "Not the only allocator — check heap and other mods too"
                                : "Not the only factor — check entities and other mods too"));
            }
        }

        if (!allocation) {
            if (tps < 12 || mspt > 100) {
                findings.add(finding("vanilla_tick", "critical",
                        "Severe tick lag during capture",
                        String.format(Locale.US, "TPS %.1f · MSPT p95 %.0fms", tps, mspt)));
                recommendations.add(rec("critical", "config",
                        "Address severe tick lag",
                        "Profiler ran while the server was struggling. Fix sim distance, entity pressure, and heavy mods.",
                        List.of(
                                "Lower simulation distance and view distance if MSPT is high",
                                "Profile while lag is active (30–60s sample)",
                                "Pause world pregen during peak player hours"
                        ),
                        null));
            } else if (tps < 17 || mspt > 60) {
                findings.add(finding("vanilla_tick", "warn",
                        "Moderate tick stress during capture",
                        String.format(Locale.US, "TPS %.1f · MSPT p95 %.0fms", tps, mspt)));
            } else {
                findings.add(finding("healthy", "info",
                        "Server tick health looked acceptable",
                        String.format(Locale.US, "TPS %.1f · MSPT p95 %.0fms during sample", tps, mspt)));
            }
        } else {
            findings.add(finding("allocation_mode", "info",
                    "Allocation profiler sample",
                    "Percentages show memory allocation during the sample, not tick time. Pair with an execution profile for tick diagnosis."));
        }

        if (ctx.has("top_entities")) {
            for (var el : ctx.getAsJsonArray("top_entities")) {
                JsonObject ent = el.getAsJsonObject();
                String id = ent.get("id").getAsString();
                int count = ent.get("count").getAsInt();
                if (id.contains("experience_orb") && count > 500) {
                    findings.add(finding("entity_pressure", "warn",
                            "High experience orb count (" + count + ")",
                            "XP orbs add entity tick cost"));
                    recommendations.add(rec("warn", "entities",
                            "Clear excess XP orbs",
                            count + " experience orbs were present — common farm leak.",
                            List.of(
                                    "Clear orbs near farms: /kill @e[type=minecraft:experience_orb,distance=..64]",
                                    "Fix mob farm XP collection (hopper, vacuum, etc.)"
                            ),
                            null));
                }
                if (id.contains("create:") && count > 200) {
                    findings.add(finding("entity_pressure", "warn",
                            "Elevated " + id + " (" + count + ")",
                            "Create contraptions or glue may be loaded"));
                    recommendations.add(rec("warn", "entities",
                            "Review Create contraptions",
                            id + " count was high during capture.",
                            List.of(
                                    "Inspect active Create contraptions and super glue blocks",
                                    "Reduce loaded chunk count for heavy Create builds"
                            ),
                            "create"));
                }
            }
        }

        if (entities > 5000) {
            findings.add(finding("entity_pressure", "warn",
                    "High total entity count (" + entities + ")",
                    "Entity tick cost scales with mob farms and dropped items"));
            recommendations.add(rec("warn", "entities",
                    "Audit entity sources",
                    "Total world entities were elevated during capture.",
                    List.of(
                            "Check mob farms, item entities, and minecarts",
                            "Use /forge entity list or similar to find hotspots"
                    ),
                    null));
        }

        if (!allocation && players >= 4 && (tps < 17 || mspt > 60)) {
            findings.add(finding("players", "info",
                    players + " players online during lag",
                    "Player-driven chunk loading may contribute"));
            recommendations.add(rec("info", "players",
                    "Consider player-driven lag",
                    players + " players were online — chunk loading and player entities add cost.",
                    List.of(
                            "Check per-player loaded chunks and bases",
                            "Spread large builds across dimensions if possible"
                    ),
                    null));
        }

        if (topMod == null || isVanillaMod(topMod.get("mod_id").getAsString()) || topMod.get("pct").getAsDouble() < 8) {
            if (!allocation && tps >= 17 && mspt <= 60) {
                recommendations.add(rec("info", "workflow",
                        "Keep this profile as a baseline",
                        "No dominant mod culprit — useful reference for the next incident.",
                        List.of(
                                "Re-run profiler when lag returns to compare",
                                "Save with /spark profiler stop --save-to-file"
                        ),
                        null));
            }
        }

        recommendations.add(rec("info", "workflow",
                "Refresh this report",
                "Capture a new profile while lagging, then run a Watchtower report.",
                List.of(
                        "/spark profiler start → wait 30–60s → /spark profiler stop --save-to-file",
                        "Optional: copy .sparkprofile to watchtower/spark-upload/",
                        "Run report from dashboard or /watchtower run"
                ),
                null));

        JsonArray findingsArr = new JsonArray();
        findings.forEach(findingsArr::add);
        JsonArray recsArr = new JsonArray();
        recommendations.forEach(recsArr::add);
        profile.add("key_findings", findingsArr);
        profile.add("recommendations", recsArr);
    }

    /**
     * Merges log-based {@code mod_recommendations} into an enriched spark profile (facts-time second pass).
     */
    public static void mergeModRecommendations(JsonObject profile, JsonArray modRecs) {
        if (profile == null || modRecs == null || modRecs.isEmpty()) {
            return;
        }
        if (!profile.has("recommendations")) {
            return;
        }
        Set<String> suspectMods = collectSuspectMods(profile);
        if (suspectMods.isEmpty()) {
            return;
        }

        JsonArray recommendations = profile.getAsJsonArray("recommendations");
        JsonArray findings = profile.has("key_findings")
                ? profile.getAsJsonArray("key_findings")
                : new JsonArray();

        for (String modId : suspectMods) {
            JsonObject modRec = findModRec(modRecs, modId);
            if (modRec == null) {
                continue;
            }
            JsonObject sparkRec = findSparkModRec(recommendations, modId);
            if (sparkRec != null) {
                mergeIntoRecommendation(sparkRec, modRec);
            } else if (isSevereModRec(modRec)) {
                recommendations.add(buildFromModRec(modRec));
            }
            addLogFinding(findings, modRec);
        }

        profile.add("key_findings", findings);
        profile.add("recommendations", recommendations);
    }

    private static Set<String> collectSuspectMods(JsonObject profile) {
        Set<String> mods = new LinkedHashSet<>();
        if (profile.has("mod_hints")) {
            for (JsonElement el : profile.getAsJsonArray("mod_hints")) {
                if (el.isJsonObject() && el.getAsJsonObject().has("mod_id")) {
                    String modId = el.getAsJsonObject().get("mod_id").getAsString();
                    if (!isVanillaMod(modId)) {
                        mods.add(modId);
                    }
                }
            }
        }
        if (profile.has("mod_rollups")) {
            for (JsonElement el : profile.getAsJsonArray("mod_rollups")) {
                if (!el.isJsonObject()) {
                    continue;
                }
                JsonObject row = el.getAsJsonObject();
                String modId = row.has("mod_id") ? row.get("mod_id").getAsString() : null;
                double pct = row.has("pct") ? row.get("pct").getAsDouble() : 0;
                if (modId != null && pct >= 8 && !isVanillaMod(modId)) {
                    mods.add(modId);
                }
            }
        }
        return mods;
    }

    private static JsonObject findModRec(JsonArray modRecs, String modId) {
        for (JsonElement el : modRecs) {
            if (!el.isJsonObject()) {
                continue;
            }
            JsonObject rec = el.getAsJsonObject();
            if (modId.equals(str(rec, "mod_id"))) {
                return rec;
            }
        }
        return null;
    }

    private static JsonObject findSparkModRec(JsonArray recommendations, String modId) {
        for (JsonElement el : recommendations) {
            if (!el.isJsonObject()) {
                continue;
            }
            JsonObject rec = el.getAsJsonObject();
            if ("mod".equals(str(rec, "category")) && modId.equals(str(rec, "mod_id"))) {
                return rec;
            }
        }
        return null;
    }

    private static void mergeIntoRecommendation(JsonObject sparkRec, JsonObject modRec) {
        sparkRec.addProperty("linked_mod_rec", true);
        String fix = str(modRec, "fix");
        String why = str(modRec, "why");
        String detail = str(sparkRec, "detail");
        StringBuilder detailBuilder = new StringBuilder(detail != null ? detail : "");
        if (why != null && !why.isBlank() && (detail == null || !detail.contains(why))) {
            if (detailBuilder.length() > 0) {
                detailBuilder.append(" ");
            }
            detailBuilder.append(why);
        }
        if (fix != null && !fix.isBlank() && (detail == null || !detail.contains(fix))) {
            if (detailBuilder.length() > 0) {
                detailBuilder.append(" ");
            }
            detailBuilder.append(fix);
        }
        if (detailBuilder.length() > 0) {
            sparkRec.addProperty("detail", detailBuilder.toString().trim());
        }
        JsonArray actions = sparkRec.has("actions") ? sparkRec.getAsJsonArray("actions") : new JsonArray();
        Set<String> seen = new HashSet<>();
        for (JsonElement el : actions) {
            seen.add(el.getAsString());
        }
        if (modRec.has("fix_steps") && modRec.get("fix_steps").isJsonArray()) {
            for (JsonElement step : modRec.getAsJsonArray("fix_steps")) {
                String s = step.getAsString();
                if (seen.add(s)) {
                    actions.add(s);
                }
            }
        }
        sparkRec.add("actions", actions);
    }

    private static boolean isSevereModRec(JsonObject modRec) {
        String severity = str(modRec, "severity");
        return "warning".equals(severity) || "critical".equals(severity);
    }

    private static JsonObject buildFromModRec(JsonObject modRec) {
        String modId = str(modRec, "mod_id");
        String title = str(modRec, "fix");
        if (title == null || title.isBlank()) {
            title = "Address " + modId + " log errors";
        }
        List<String> actions = new ArrayList<>();
        if (modRec.has("fix_steps") && modRec.get("fix_steps").isJsonArray()) {
            for (JsonElement step : modRec.getAsJsonArray("fix_steps")) {
                actions.add(step.getAsString());
            }
        }
        String severity = str(modRec, "severity");
        if ("warning".equals(severity)) {
            severity = "warn";
        }
        if (severity == null) {
            severity = "warn";
        }
        JsonObject rec = rec(severity, "mod", title, strOr(modRec, "why", title), actions, modId);
        rec.addProperty("linked_mod_rec", true);
        return rec;
    }

    private static void addLogFinding(JsonArray findings, JsonObject modRec) {
        int count = modRec.has("count") ? modRec.get("count").getAsInt() : 0;
        if (count <= 0) {
            return;
        }
        String modId = str(modRec, "mod_id");
        String category = str(modRec, "category");
        if (modId == null) {
            return;
        }
        String title = "Also in logs: " + modId;
        String detail = category != null
                ? category.replace('_', ' ') + " (" + count + " hits in report window)"
                : count + " log hits in report window";
        for (JsonElement el : findings) {
            if (el.isJsonObject() && title.equals(str(el.getAsJsonObject(), "title"))) {
                return;
            }
        }
        findings.add(finding("mod_logs", "warn", title, detail));
    }

    private static JsonObject firstModRollup(JsonObject profile) {
        if (!profile.has("mod_rollups")) {
            return null;
        }
        JsonArray rollups = profile.getAsJsonArray("mod_rollups");
        if (rollups.isEmpty()) {
            return null;
        }
        return rollups.get(0).getAsJsonObject();
    }

    private static boolean isVanillaMod(String modId) {
        return "minecraft".equals(modId) || "neoforge".equals(modId) || "forge".equals(modId);
    }

    private static JsonObject finding(String kind, String severity, String title, String detail) {
        JsonObject o = new JsonObject();
        o.addProperty("kind", kind);
        o.addProperty("severity", severity);
        o.addProperty("title", title);
        o.addProperty("detail", detail);
        return o;
    }

    private static JsonObject rec(String severity, String category, String title, String detail,
                                  List<String> actions, String modId) {
        JsonObject o = new JsonObject();
        o.addProperty("severity", severity);
        o.addProperty("category", category);
        o.addProperty("title", title);
        o.addProperty("detail", detail);
        JsonArray arr = new JsonArray();
        actions.forEach(arr::add);
        o.add("actions", arr);
        if (modId != null) {
            o.addProperty("mod_id", modId);
        }
        return o;
    }

    private static String str(JsonObject o, String key) {
        return o.has(key) && !o.get(key).isJsonNull() ? o.get(key).getAsString() : null;
    }

    private static String strOr(JsonObject o, String key, String def) {
        String s = str(o, key);
        return s != null ? s : def;
    }
}
