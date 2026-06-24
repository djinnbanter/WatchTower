package dev.mcstatus.watchtower.core;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.analyze.ModErrorCategory;
import dev.mcstatus.watchtower.core.analyze.ModIssueAdvisor;
import dev.mcstatus.watchtower.core.analyze.ReportPipeline;
import dev.mcstatus.watchtower.core.brief.BriefFormatters;
import dev.mcstatus.watchtower.core.collect.ClientModDetector;
import dev.mcstatus.watchtower.core.collect.CrashDetails;
import dev.mcstatus.watchtower.core.collect.ModLogAnalyzer;
import dev.mcstatus.watchtower.core.report.ReportConfig;
import dev.mcstatus.watchtower.core.report.ReportEngine;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;

class ModHealthTest {

    @Test
    void crashLabelPrefersExceptionOverWatchingServer() {
        String label = CrashDetails.formatLabel(
                "java.lang.Error: ServerHangWatchdog detected that a single server tick took 6000",
                "java.lang.Error",
                "Watching Server");
        assertTrue(label.contains("ServerHangWatchdog"));
        assertFalse(label.endsWith("(java.lang.Error)"));
    }

    @Test
    void modCorruptFromProvidedByMod() {
        String line = "[main/ERROR] [net.neoforged.fml.loading.moddiscovery.ModFile/LOADING]: "
                + "Access transformer file META-INF/accesstransformer.cfg provided by mod pride does not exist!";
        ModErrorCategory.Hit hit = ModErrorCategory.classify(line);
        assertNotNull(hit);
        assertEquals(ModErrorCategory.MOD_CORRUPT, hit.category());
        assertEquals("pride", hit.primaryMod());
    }

    @Test
    void recipeParseAttributesOwnerMod() {
        String line = "[main/ERROR] [minecraft/RecipeManager]: Parsing error loading recipe "
                + "farmersdelight:cutting/echo_trapdoor: com.google.gson.JsonParseException: Unknown item 'deeperdarker:echo_planks'";
        ModLogAnalyzer analyzer = new ModLogAnalyzer();
        analyzer.processLine(line);
        JsonArray arr = analyzer.toJsonArray();
        assertFalse(arr.isEmpty());
        boolean found = false;
        for (var el : arr) {
            String modId = el.getAsJsonObject().get("mod_id").getAsString();
            if ("farmersdelight".equals(modId) || "deeperdarker".equals(modId)) {
                found = true;
            }
        }
        assertTrue(found);
    }

    @Test
    void unknownItemRecipeMissingItem() {
        String line = "com.google.gson.JsonSyntaxException: Unknown item 'biomesoplenty:cherry_log'";
        ModErrorCategory.Hit hit = ModErrorCategory.classify(line);
        assertNotNull(hit);
        assertEquals(ModErrorCategory.RECIPE_MISSING_ITEM, hit.category());
        assertEquals("biomesoplenty", hit.primaryMod());
    }

    @Test
    void recipeCompatRecommendationHasActionFields() {
        ModLogAnalyzer analyzer = new ModLogAnalyzer();
        analyzer.processLine("Parsing error loading recipe connector:recipes/integration/emi/test_recipe");
        JsonObject optional = new JsonObject();
        optional.add("mod_log_errors", analyzer.toJsonArray());
        ModIssueAdvisor.AdvisorResult result = ModIssueAdvisor.analyze(optional);
        assertFalse(result.recommendations().isEmpty());
        JsonObject rec = result.recommendations().get(0).getAsJsonObject();
        assertEquals("recipe_compat", rec.get("category").getAsString());
        assertEquals("pair_update", rec.get("action").getAsString());
        assertTrue(rec.get("action_detail").getAsString().contains("Update both"));
    }

    @Test
    void modCorruptRecommendationHasWorryMetadata() {
        ModLogAnalyzer analyzer = new ModLogAnalyzer();
        analyzer.processLine("[main/ERROR] provided by mod pride does not exist");
        JsonObject optional = new JsonObject();
        optional.add("mod_log_errors", analyzer.toJsonArray());
        ModIssueAdvisor.AdvisorResult result = ModIssueAdvisor.analyze(optional);
        assertFalse(result.recommendations().isEmpty());
        JsonObject rec = result.recommendations().get(0).getAsJsonObject();
        assertEquals("action", rec.get("worry_level").getAsString());
        assertTrue(rec.get("action_needed").getAsBoolean());
        assertTrue(rec.has("should_worry"));
        assertTrue(rec.has("explanation"));
        assertTrue(rec.has("fix_steps"));
        JsonArray steps = rec.getAsJsonArray("fix_steps");
        assertEquals(4, steps.size());
        assertTrue(steps.get(0).getAsString().contains("Remove pride"));
        assertFalse(rec.has("install_hint"));
    }

    @Test
    void modLogErrorRowHasCategoryLabel() {
        ModLogAnalyzer analyzer = new ModLogAnalyzer();
        analyzer.processLine("[main/ERROR] provided by mod pride does not exist");
        JsonObject row = analyzer.toJsonArray().get(0).getAsJsonObject();
        assertEquals("mod_corrupt", row.get("top_category").getAsString());
        assertEquals("corrupt jar", row.get("category_label").getAsString());
    }

    @Test
    void modRecommendationsFromLogErrors() {
        ModLogAnalyzer analyzer = new ModLogAnalyzer();
        analyzer.processLine("provided by mod pride does not exist");
        JsonObject optional = new JsonObject();
        optional.add("mod_log_errors", analyzer.toJsonArray());
        ModIssueAdvisor.AdvisorResult result = ModIssueAdvisor.analyze(optional);
        assertFalse(result.recommendations().isEmpty());
        assertFalse(result.severeIssues().isEmpty());
    }

    @Test
    void historicalWatchtowerCrashSkippedWhenVersionSufficient() {
        JsonObject optional = new JsonObject();
        JsonArray crashes = new JsonArray();
        JsonObject crash = new JsonObject();
        crash.addProperty("historical", true);
        crash.addProperty("exception", "dev.mcstatus.watchtower.core.report.ReportEngine");
        crashes.add(crash);
        optional.add("crash_summaries", crashes);
        JsonArray mods = new JsonArray();
        JsonObject wt = new JsonObject();
        wt.addProperty("id", "watchtower");
        wt.addProperty("version", "2.0.6");
        mods.add(wt);
        optional.add("mods", mods);
        JsonObject meta = new JsonObject();
        meta.addProperty("engine_version", "4.0.6");

        ModIssueAdvisor.AdvisorResult result = ModIssueAdvisor.analyze(optional, meta);
        assertTrue(result.recommendations().isEmpty());
        assertTrue(result.severeIssues().isEmpty());
    }

    @Test
    void modRecommendationActionsIncludeSampleLine() {
        JsonObject optional = new JsonObject();
        JsonArray recs = new JsonArray();
        JsonObject rec = new JsonObject();
        rec.addProperty("mod_id", "pride");
        rec.addProperty("severity", "warning");
        rec.addProperty("count", 7);
        rec.addProperty("fix", "Reinstall pride from the official source or remove the jar from mods/.");
        rec.addProperty("sample_line", "[main/ERROR] provided by mod pride does not exist!");
        JsonObject cats = new JsonObject();
        cats.addProperty("mod_corrupt", 7);
        rec.add("by_category", cats);
        rec.addProperty("category", "mod_corrupt");
        recs.add(rec);
        optional.add("mod_recommendations", recs);

        var lines = BriefFormatters.fmtModRecommendationActions(optional, 8);
        assertFalse(lines.isEmpty());
        assertTrue(lines.get(0).contains("[pride]"));
        assertTrue(lines.get(0).contains("7 error"));
        assertTrue(lines.stream().anyMatch(l -> l.contains(">") && l.contains("pride")));
        assertTrue(BriefFormatters.hasWarningModRecommendations(optional));
    }

    @Test
    void clientModDetectorFlagsLikelyRemovable() {
        JsonObject optional = new JsonObject();
        JsonArray mods = new JsonArray();
        for (String id : new String[]{"modmenu", "appleskin", "xaerominimap", "fabric_api"}) {
            JsonObject m = new JsonObject();
            m.addProperty("id", id);
            m.addProperty("version", "1.0");
            mods.add(m);
        }
        optional.add("mods", mods);
        ClientModDetector.apply(optional);

        assertTrue(optional.has("client_only_mods"));
        String json = optional.getAsJsonArray("client_only_mods").toString();
        assertTrue(json.contains("modmenu"));
        assertTrue(json.contains("appleskin"));
        assertFalse(json.contains("fabric_api"));
    }

    @Test
    void clientNoiseUsesDisplayName() {
        ModLogAnalyzer analyzer = new ModLogAnalyzer();
        analyzer.processLine("[main/ERROR] Attempted to load class net/minecraft/client/Options");
        JsonObject optional = new JsonObject();
        optional.add("mod_log_errors", analyzer.toJsonArray());
        String glance = BriefFormatters.fmtModLogErrorsGlance(optional);
        assertTrue(glance.contains("Client-only") || glance.contains("client"));
    }

    @Test
    void fullModsInBrief() {
        JsonObject staging = ValidatePocTest.baseStagingPublic();
        JsonObject optional = staging.getAsJsonObject("optional");
        JsonArray mods = new JsonArray();
        JsonObject a = new JsonObject();
        a.addProperty("id", "create");
        a.addProperty("version", "6.0.8");
        JsonObject b = new JsonObject();
        b.addProperty("id", "ae2");
        b.addProperty("version", "19.2.0");
        mods.add(a);
        mods.add(b);
        optional.add("mods", mods);
        String brief = ReportPipeline.writeBrief(ReportPipeline.buildFacts(staging));
        assertTrue(brief.contains("MODS"));
        assertTrue(brief.contains("create  6.0.8"));
        assertTrue(brief.contains("ae2  19.2.0"));
    }

    @Test
    void reportsDirAbsolute() throws Exception {
        Path tmp = Files.createTempDirectory("wt-reports");
        Path serverDir = tmp.resolve("server");
        Files.createDirectories(serverDir);
        JsonObject sp = ReportEngine.buildSourcePaths(
                ReportConfig.builder().serverDir(serverDir.toString()).lookbackHours(24).build(),
                tmp.resolve("reports"));
        assertTrue(sp.get("reports_dir").getAsString().contains("watchtower"));
        assertTrue(sp.get("reports_dir").getAsString().contains("server"));
    }
}
