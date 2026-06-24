package dev.mcstatus.watchtower.core.analyze;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Rule-based mod fix / install recommendations from log error aggregates.
 */
public final class ModIssueAdvisor {

    private static final int MAX_RECOMMENDATIONS = 12;

    private ModIssueAdvisor() {
    }

    public record AdvisorResult(JsonArray recommendations, List<SevereModIssue> severeIssues) {
    }

    public record SevereModIssue(String modId, String message, ModErrorCategory category) {
    }

    public static AdvisorResult analyze(JsonObject optional) {
        return analyze(optional, null);
    }

    public static AdvisorResult analyze(JsonObject optional, JsonObject meta) {
        JsonArray recommendations = new JsonArray();
        List<SevereModIssue> severe = new ArrayList<>();
        if (optional == null || !optional.has("mod_log_errors")) {
            checkCrashSummaries(optional, meta, recommendations, severe);
            return new AdvisorResult(recommendations, severe);
        }
        JsonArray errors = optional.getAsJsonArray("mod_log_errors");
        Set<String> seen = new HashSet<>();
        List<JsonObject> ranked = new ArrayList<>();
        for (JsonElement el : errors) {
            if (el.isJsonObject()) {
                ranked.add(el.getAsJsonObject());
            }
        }
        ranked.sort(Comparator.comparingInt((JsonObject o) ->
                o.has("total") ? o.get("total").getAsInt() : 0).reversed());

        for (JsonObject row : ranked) {
            if (recommendations.size() >= MAX_RECOMMENDATIONS) {
                break;
            }
            String modId = str(row, "mod_id");
            if (modId == null || modId.isBlank()) {
                continue;
            }
            int total = row.has("total") ? row.get("total").getAsInt() : 0;
            JsonObject cats = row.has("by_category") ? row.getAsJsonObject("by_category") : new JsonObject();
            ModErrorCategory topCat = topCategory(cats);
            if (topCat == null) {
                continue;
            }
            String key = modId + ":" + topCat.id();
            if (!seen.add(key)) {
                continue;
            }
            JsonObject rec = buildRecommendation(modId, topCat, total, cats, row);
            recommendations.add(rec);
            if (topCat.severityRank() >= 4 && total > 0) {
                severe.add(new SevereModIssue(modId, rec.get("fix").getAsString(), topCat));
            }
        }
        checkCrashSummaries(optional, meta, recommendations, severe);
        return new AdvisorResult(recommendations, severe);
    }

    private static void checkCrashSummaries(
            JsonObject optional,
            JsonObject meta,
            JsonArray recommendations,
            List<SevereModIssue> severe) {
        if (optional == null || !optional.has("crash_summaries")) {
            return;
        }
        if (watchtowerInstallSufficient(meta, optional)) {
            return;
        }
        for (JsonElement el : optional.getAsJsonArray("crash_summaries")) {
            JsonObject c = el.getAsJsonObject();
            if (bool(c, "historical", false)) {
                continue;
            }
            String exception = str(c, "exception");
            if (exception != null && exception.contains("dev.mcstatus.watchtower.core.report.ReportEngine")) {
                JsonObject rec = new JsonObject();
                rec.addProperty("mod_id", "watchtower");
                rec.addProperty("category", ModErrorCategory.ENGINE_PACKAGING.id());
                rec.addProperty("severity", "warning");
                rec.addProperty("why", "Watchtower report engine classes were missing from the mod JAR.");
                rec.addProperty("fix", "Install watchtower-neoforge 2.0.6+ (engine 4.0.6+) and restart the server.");
                rec.addProperty("install_hint", "Replace the Watchtower JAR in mods/ with the latest build.");
                rec.addProperty("count", 1);
                if (exception != null && !exception.isBlank()) {
                    rec.addProperty("sample_line", exception);
                }
                recommendations.add(rec);
                severe.add(new SevereModIssue("watchtower",
                        "Install watchtower-neoforge 2.0.6+ (engine 4.0.6+).", ModErrorCategory.ENGINE_PACKAGING));
                return;
            }
        }
    }

    static boolean watchtowerInstallSufficient(JsonObject meta, JsonObject optional) {
        String engine = meta != null ? str(meta, "engine_version") : null;
        if (engine == null || compareVersions(engine, "4.0.5") < 0) {
            return false;
        }
        String modVer = findWatchtowerModVersion(optional);
        return modVer != null && compareVersions(modVer, "2.0.5") >= 0;
    }

    private static String findWatchtowerModVersion(JsonObject optional) {
        if (optional == null) {
            return null;
        }
        String fromNative = modVersionIn(optional, "watchtower_native");
        if (fromNative != null) {
            return fromNative;
        }
        return modVersionIn(optional, "mods");
    }

    private static String modVersionIn(JsonObject optional, String key) {
        if (!optional.has(key)) {
            return null;
        }
        JsonElement el = optional.get(key);
        JsonArray mods;
        if (el.isJsonObject() && el.getAsJsonObject().has("mods")) {
            mods = el.getAsJsonObject().getAsJsonArray("mods");
        } else if (el.isJsonArray()) {
            mods = el.getAsJsonArray();
        } else {
            return null;
        }
        for (JsonElement m : mods) {
            if (!m.isJsonObject()) {
                continue;
            }
            JsonObject mod = m.getAsJsonObject();
            if ("watchtower".equals(str(mod, "id"))) {
                return str(mod, "version");
            }
        }
        return null;
    }

    static int compareVersions(String a, String b) {
        String[] pa = a.split("[^0-9]+");
        String[] pb = b.split("[^0-9]+");
        int len = Math.max(pa.length, pb.length);
        for (int i = 0; i < len; i++) {
            int va = i < pa.length && !pa[i].isEmpty() ? Integer.parseInt(pa[i]) : 0;
            int vb = i < pb.length && !pb[i].isEmpty() ? Integer.parseInt(pb[i]) : 0;
            if (va != vb) {
                return Integer.compare(va, vb);
            }
        }
        return 0;
    }

    private static JsonObject buildRecommendation(
            String modId,
            ModErrorCategory category,
            int total,
            JsonObject cats,
            JsonObject row) {
        JsonObject rec = new JsonObject();
        rec.addProperty("mod_id", modId);
        rec.addProperty("category", category.id());
        rec.addProperty("count", total);
        String severity = category.severityRank() >= 4 ? "warning"
                : category.severityRank() >= 2 ? "info" : "low";
        rec.addProperty("severity", severity);
        rec.add("by_category", cats.deepCopy());

        copySampleFields(row, rec);

        List<String> related = relatedMods(cats, modId);
        JsonArray relatedArr = new JsonArray();
        related.forEach(relatedArr::add);
        if (!related.isEmpty()) {
            rec.add("related_mods", relatedArr);
        }

        switch (category) {
            case RECIPE_MISSING_ITEM -> {
                rec.addProperty("why", "Recipes or tags reference items/blocks from " + modId
                        + " that are not registered at load time.");
                rec.addProperty("fix", "Install or update mod '" + modId
                        + "', or remove datapacks/recipes referencing " + modId + ":*. "
                        + "Often caused by version mismatch between integration mods.");
                rec.addProperty("install_hint", "Ensure '" + modId + "' is installed and matches your pack versions.");
            }
            case RECIPE_COMPAT -> {
                String partner = related.isEmpty() ? "the integration mod" : related.get(0);
                rec.addProperty("why", "Integration recipes between " + modId + " and " + partner
                        + " reference missing items or serializers.");
                rec.addProperty("fix", "Update both " + modId + " and " + partner
                        + " to versions tested together, or ignore if the server runs normally.");
                rec.addProperty("install_hint", "Check mod issue trackers for compat fixes between these mods.");
            }
            case RECIPE_FORMAT -> {
                rec.addProperty("why", "Recipe JSON or ingredient serializers for " + modId
                        + " do not match the NeoForge/Minecraft version.");
                rec.addProperty("fix", "Update " + modId + " to a build for your Minecraft/NeoForge version.");
                rec.addProperty("install_hint", "Recipe format errors are usually fixed in a mod update.");
            }
            case REGISTRY_MISSING -> {
                rec.addProperty("why", "Items, blocks, or fluids from " + modId
                        + " are referenced but not registered.");
                rec.addProperty("fix", "Install/update " + modId + " or remove content referencing "
                        + modId + ":* from datapacks.");
                rec.addProperty("install_hint", "Install mod '" + modId + "' if it should be in this pack.");
            }
            case LOOT_PARSE -> {
                rec.addProperty("why", "Loot tables referencing " + modId + " resources failed to parse.");
                rec.addProperty("fix", "Update " + modId + " or remove broken loot/datapack overrides.");
                rec.addProperty("install_hint", "Loot parse errors are usually harmless if the server runs.");
            }
            case MOD_CORRUPT -> {
                rec.addProperty("why", "Mod jar for " + modId + " appears corrupt or incomplete on disk.");
                rec.addProperty("fix", modId + " may be a bad download — confirm by removing it and testing startup.");
                rec.add("fix_steps", modDrFixSteps(modId, "mod_corrupt"));
            }
            case MOD_LOAD_FAILED -> {
                rec.addProperty("why", modId + " failed to load (dependency, mixin, or corrupt jar).");
                rec.addProperty("fix", "Test whether " + modId + " is the blocker — remove it and try starting the server.");
                rec.add("fix_steps", modDrFixSteps(modId, "mod_load_failed"));
            }
            case CLIENT_ON_SERVER -> {
                rec.addProperty("display_name", ModErrorCategory.CLIENT_ON_SERVER_DISPLAY);
                rec.addProperty("why", ModErrorCategory.CLIENT_ON_SERVER_WHAT);
                rec.addProperty("fix", ModErrorCategory.CLIENT_ON_SERVER_WORRY);
                rec.addProperty("install_hint",
                        "Remove client-only mods from server mods/ (see CLIENT-ONLY MODS ON SERVER) or update mods.");
                rec.addProperty("severity", "info");
                rec.addProperty("worry_level", "informational");
                rec.addProperty("action_needed", false);
                rec.addProperty("should_worry", ModErrorCategory.CLIENT_ON_SERVER_WORRY);
            }
            case ENGINE_PACKAGING -> {
                rec.addProperty("why", "Watchtower engine classes missing from mod packaging.");
                rec.addProperty("fix", "Install watchtower-neoforge 2.0.6+.");
                rec.addProperty("install_hint", "Replace Watchtower JAR in mods/.");
            }
            default -> {
                rec.addProperty("why", modId + " logged " + total + " error(s) in the lookback window.");
                rec.addProperty("fix", "Review sample lines in MOD LOG HEALTH and latest.log.");
                rec.addProperty("install_hint", "Update " + modId + " if errors persist.");
            }
        }

        if (row.has("top_recipes") && row.getAsJsonArray("top_recipes").size() > 0) {
            rec.add("top_recipes", row.getAsJsonArray("top_recipes").deepCopy());
        }
        if (category != ModErrorCategory.CLIENT_ON_SERVER) {
            applyWorryMetadata(rec, category);
        }
        applyUpdateAction(rec, category, modId, related);
        String sample = row.has("sample_line") ? row.get("sample_line").getAsString() : null;
        JsonObject hintBundle = ModHintEngine.buildHintBundle(modId, category.id(), sample);
        if (hintBundle.has("fix_steps") && !rec.has("fix_steps")) {
            rec.add("fix_steps", hintBundle.getAsJsonArray("fix_steps").deepCopy());
        }
        if (hintBundle.has("doc_url")) {
            rec.addProperty("doc_url", hintBundle.get("doc_url").getAsString());
        }
        if (hintBundle.has("tech_hint_id")) {
            rec.addProperty("tech_hint_id", hintBundle.get("tech_hint_id").getAsString());
        }
        return rec;
    }

    private static void applyUpdateAction(
            JsonObject rec,
            ModErrorCategory category,
            String modId,
            List<String> related) {
        switch (category) {
            case RECIPE_COMPAT -> {
                String partner = related.isEmpty() ? "the paired mod" : related.get(0);
                rec.addProperty("action", "pair_update");
                rec.addProperty("action_detail",
                        "Update both " + modId + " and " + partner + " to versions tested on your Minecraft version.");
            }
            case RECIPE_MISSING_ITEM, REGISTRY_MISSING -> {
                rec.addProperty("action", "install");
                rec.addProperty("action_detail",
                        "Install or update " + modId + " to match your pack's Minecraft/NeoForge version.");
            }
            case MOD_LOAD_FAILED -> {
                rec.addProperty("action", "update");
                rec.addProperty("action_detail",
                        "Remove " + modId + ", test startup, then reinstall if the server boots without it.");
            }
            case MOD_CORRUPT -> {
                rec.addProperty("action", "remove");
                rec.addProperty("action_detail",
                        "Confirm " + modId + " is the problem by removing it, testing startup, then reinstalling if needed.");
            }
            case RECIPE_FORMAT -> {
                rec.addProperty("action", "update");
                rec.addProperty("action_detail",
                        "Update " + modId + " to a build for your Minecraft/NeoForge version.");
            }
            default -> {
            }
        }
    }

    private static void applyWorryMetadata(JsonObject rec, ModErrorCategory category) {
        if (rec.has("why")) {
            rec.addProperty("explanation", rec.get("why").getAsString());
        }
        int rank = category.severityRank();
        if (rank >= 5) {
            rec.addProperty("worry_level", "critical");
            rec.addProperty("action_needed", true);
            rec.addProperty("should_worry",
                    "Server may not start reliably or players may be blocked — fix before opening.");
        } else if (rank >= 4) {
            rec.addProperty("worry_level", "action");
            rec.addProperty("action_needed", true);
            rec.addProperty("should_worry",
                    "Broken jar can cause load failures or subtle bugs — reinstall recommended.");
        } else if (rank >= 3) {
            rec.addProperty("worry_level", "monitor");
            rec.addProperty("action_needed", false);
            rec.addProperty("should_worry",
                    "Missing recipes or items may affect gameplay; fix if players notice gaps.");
        } else if (rank >= 2) {
            rec.addProperty("worry_level", "monitor");
            rec.addProperty("action_needed", false);
            rec.addProperty("should_worry",
                    "Often harmless if the server runs; fix if players report missing items or recipes.");
        } else if (rank >= 1) {
            rec.addProperty("worry_level", "low");
            rec.addProperty("action_needed", false);
            rec.addProperty("should_worry",
                    "Log noise unless you see crashes or missing content.");
        }
        if (category == ModErrorCategory.CLIENT_ON_SERVER) {
            rec.addProperty("worry_level", "informational");
            rec.addProperty("action_needed", false);
            rec.addProperty("should_worry", ModErrorCategory.CLIENT_ON_SERVER_WORRY);
        }
    }

    private static void copySampleFields(JsonObject row, JsonObject rec) {
        if (row.has("sample_line")) {
            rec.addProperty("sample_line", row.get("sample_line").getAsString());
        }
        if (row.has("sample_lines") && row.get("sample_lines").isJsonArray()) {
            rec.add("sample_lines", row.getAsJsonArray("sample_lines").deepCopy());
        }
    }

    private static ModErrorCategory topCategory(JsonObject cats) {
        ModErrorCategory best = null;
        int bestCount = 0;
        for (String key : cats.keySet()) {
            int count = cats.get(key).getAsInt();
            ModErrorCategory cat = categoryFromId(key);
            if (cat == null) {
                continue;
            }
            if (best == null || count > bestCount
                    || (count == bestCount && cat.severityRank() > best.severityRank())) {
                best = cat;
                bestCount = count;
            }
        }
        return best;
    }

    private static ModErrorCategory categoryFromId(String id) {
        for (ModErrorCategory c : ModErrorCategory.values()) {
            if (c.id().equals(id)) {
                return c;
            }
        }
        return null;
    }

    private static List<String> relatedMods(JsonObject cats, String primary) {
        List<String> out = new ArrayList<>();
        if (cats.has("recipe_compat")) {
            for (String key : cats.keySet()) {
                if (!key.equals("recipe_compat") && !primary.equals(key)) {
                    // related from integration - use second highest if recipe_compat present
                }
            }
        }
        return out;
    }

    private static boolean bool(JsonObject o, String key, boolean def) {
        if (o == null || !o.has(key) || o.get(key).isJsonNull()) {
            return def;
        }
        return o.get(key).getAsBoolean();
    }

    private static String str(JsonObject o, String key) {
        if (o == null || !o.has(key) || o.get(key).isJsonNull()) {
            return null;
        }
        return o.get(key).getAsString();
    }

    private static JsonArray modDrFixSteps(String modId, String category) {
        JsonArray steps = new JsonArray();
        if (!"mod_corrupt".equals(category) && !"mod_load_failed".equals(category)) {
            return steps;
        }
        String jar = modId + ".jar";
        steps.add("Remove " + modId + " (" + jar + ") from your server mods/ folder.");
        steps.add("Start the server and wait for \"Done!\" — if it boots, that mod was blocking startup.");
        steps.add("Re-download " + modId + " from the official source (Modrinth/CurseForge) and put the jar back in mods/.");
        steps.add("Start again — if it fails the same way, leave the mod out or try a different version; "
                + "you have confirmed the culprit.");
        return steps;
    }
}
