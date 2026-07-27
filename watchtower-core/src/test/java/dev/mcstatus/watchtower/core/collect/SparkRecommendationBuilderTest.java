package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class SparkRecommendationBuilderTest {

    @Test
    void enrichIsDeterministicAndEvidenceRich() {
        JsonObject profile = new JsonObject();
        profile.addProperty("mode", "execution");
        JsonObject context = new JsonObject();
        context.addProperty("tps_1m", 14.5);
        context.addProperty("mspt_p95_1m", 78.0);
        context.addProperty("players", 4);
        profile.add("context", context);
        JsonArray rollups = new JsonArray();
        JsonObject rollup = new JsonObject();
        rollup.addProperty("mod_id", "examplemod");
        rollup.addProperty("own_pct", 16.25);
        rollup.addProperty("pct", 16.25);
        rollup.addProperty("top_label", "ExampleTicker.tick");
        rollups.add(rollup);
        profile.add("mod_rollups", rollups);

        SparkRecommendationBuilder.enrich(profile);
        String first = profile.toString();
        SparkRecommendationBuilder.enrich(profile);
        assertEquals(first, profile.toString());

        for (var element : profile.getAsJsonArray("key_findings")) {
            assertEvidenceSchema(element.getAsJsonObject());
        }
        for (var element : profile.getAsJsonArray("recommendations")) {
            JsonObject recommendation = element.getAsJsonObject();
            assertEvidenceSchema(recommendation);
            assertTrue(recommendation.has("reversible_actions"));
        }
        assertFalse(first.toLowerCase().contains("projected gain"));
        assertFalse(first.toLowerCase().contains("will improve"));
        assertTrue(profile.has("evidence_summary"));
        assertTrue(profile.getAsJsonObject("evidence_summary").has("what_this_cannot_prove"));
        for (var finding : profile.getAsJsonArray("key_findings")) {
            for (var evidence : finding.getAsJsonObject().getAsJsonArray("evidence")) {
                assertTrue(evidence.getAsJsonObject().has("path"));
            }
        }
    }

    @Test
    void emitsTickFilterTimelineCpuAndGcContextWithoutCausalClaims() {
        JsonObject profile = new JsonObject();
        profile.addProperty("mode", "execution");
        profile.addProperty("fresh", true);
        JsonObject context = new JsonObject();
        context.addProperty("target_tps", 20);
        context.addProperty("target_mspt", 50);
        profile.add("context", context);
        JsonObject window = new JsonObject();
        window.addProperty("duration_sec", 15);
        profile.add("window", window);
        JsonObject settings = new JsonObject();
        settings.addProperty("tick_length_threshold", 100);
        settings.addProperty("included_ticks", 3);
        JsonObject capture = new JsonObject();
        capture.add("profiler_settings", settings);
        profile.add("capture", capture);
        JsonArray timeline = new JsonArray();
        timeline.add(windowRow(19.8, 42, 1000, 2000));
        timeline.add(windowRow(10, 140, 1300, 2400));
        profile.add("timeline", timeline);
        JsonObject cpu = new JsonObject();
        cpu.addProperty("process_1m", 62);
        cpu.addProperty("system_1m", 94);
        JsonObject gc = new JsonObject();
        gc.addProperty("total_collections", 12);
        JsonObject system = new JsonObject();
        system.add("cpu", cpu);
        system.add("gc", gc);
        profile.add("system", system);
        profile.add("mod_rollups", new JsonArray());

        SparkRecommendationBuilder.enrich(profile);

        String json = profile.getAsJsonArray("key_findings").toString();
        assertTrue(json.contains("spark.quality.short_capture"));
        assertTrue(json.contains("spark.quality.tick_filtered"));
        assertTrue(json.contains("spark.timeline.isolated_lag"));
        assertTrue(json.contains("spark.system.cpu_pressure"));
        assertTrue(json.contains("spark.system.gc_context"));
        assertFalse(json.toLowerCase().contains("will improve"));
        assertFalse(json.toLowerCase().contains("root cause is"));
    }

    @Test
    void emitsEntityCompositionAndSwapWithoutCausalClaims() {
        JsonObject profile = new JsonObject();
        profile.addProperty("mode", "execution");
        JsonObject context = new JsonObject();
        context.addProperty("tps_1m", 10.0);
        context.addProperty("mspt_p95_1m", 120.0);
        JsonObject composition = new JsonObject();
        composition.addProperty("xp_orbs", 633);
        composition.addProperty("items", 545);
        composition.addProperty("glue_family", 446);
        composition.addProperty("xp_items_share_pct", 52.5);
        composition.addProperty("glue_share_pct", 19.9);
        composition.addProperty("automation_share_pct", 72.4);
        composition.addProperty("total_entities", 2244);
        context.add("entity_composition", composition);
        JsonObject concentration = new JsonObject();
        concentration.addProperty("chunks_with_entities", 537);
        JsonObject topShare = new JsonObject();
        topShare.addProperty("20", 45.7);
        concentration.add("top_n_share_pct", topShare);
        context.add("entity_concentration", concentration);
        JsonArray hotspots = new JsonArray();
        JsonObject hotspot = new JsonObject();
        hotspot.addProperty("dimension", "overworld");
        hotspot.addProperty("chunk_x", -102);
        hotspot.addProperty("chunk_z", -17);
        hotspot.addProperty("block_x_min", -1632);
        hotspot.addProperty("block_z_min", -272);
        hotspot.addProperty("total_entities", 180);
        hotspot.addProperty("top_type", "minecraft:experience_orb");
        hotspot.addProperty("top_count", 180);
        hotspot.addProperty("nearest_player_chunk_distance", 63);
        hotspots.add(hotspot);
        context.add("entity_hotspots", hotspots);
        profile.add("context", context);
        JsonObject memory = new JsonObject();
        memory.addProperty("swap_used_gb", 44.66);
        memory.addProperty("swap_total_gb", 98.81);
        JsonObject cpu = new JsonObject();
        cpu.addProperty("process_1m", 25.2);
        cpu.addProperty("system_1m", 25.2);
        JsonObject system = new JsonObject();
        system.add("memory", memory);
        system.add("cpu", cpu);
        profile.add("system", system);
        JsonObject selected = new JsonObject();
        selected.addProperty("view-distance", 20);
        selected.addProperty("player-idle-timeout", 0);
        JsonObject capture = new JsonObject();
        capture.add("selected_server_properties", selected);
        profile.add("capture", capture);
        profile.add("mod_rollups", new JsonArray());
        profile.add("source_rollups", new JsonArray());

        SparkRecommendationBuilder.enrich(profile);
        String json = profile.getAsJsonArray("key_findings").toString();
        assertTrue(json.contains("spark.entity.composition"));
        assertTrue(json.contains("spark.entity.hotspots"));
        assertTrue(json.contains("spark.entity.concentration"));
        assertTrue(json.contains("spark.system.swap_pressure"));
        assertTrue(json.contains("spark.system.tick_vs_cpu"));
        assertFalse(json.toLowerCase().contains("root cause"));
        assertFalse(json.toLowerCase().contains("will improve"));
        assertFalse(json.toLowerCase().contains("caused the lag"));
    }

    @Test
    void emitsUnattendedDimensionHotspotsWhenNoSameDimensionPlayers() {
        JsonObject profile = new JsonObject();
        profile.addProperty("mode", "execution");
        JsonObject context = new JsonObject();
        context.addProperty("tps_1m", 18.0);
        context.addProperty("mspt_p95_1m", 55.0);
        JsonArray hotspots = new JsonArray();
        JsonObject hotspot = new JsonObject();
        hotspot.addProperty("dimension", "the_nether");
        hotspot.addProperty("chunk_x", 200);
        hotspot.addProperty("chunk_z", 180);
        hotspot.addProperty("total_entities", 340);
        hotspot.addProperty("top_type", "minecraft:experience_orb");
        hotspot.addProperty("top_count", 330);
        hotspot.addProperty("same_dimension_players", 0);
        hotspots.add(hotspot);
        context.add("entity_hotspots", hotspots);
        profile.add("context", context);
        profile.add("system", new JsonObject());
        profile.add("capture", new JsonObject());
        profile.add("mod_rollups", new JsonArray());
        profile.add("source_rollups", new JsonArray());

        SparkRecommendationBuilder.enrich(profile);
        String json = profile.getAsJsonArray("key_findings").toString();
        assertTrue(json.contains("spark.entity.unattended_hotspots"));
        assertTrue(json.contains("the_nether"));
        assertFalse(json.toLowerCase().contains("root cause"));
    }

    @Test
    void neverTreatsJvmAsNonPlatformSourceFinding() {
        JsonObject profile = new JsonObject();
        profile.addProperty("mode", "execution");
        JsonObject context = new JsonObject();
        context.addProperty("tps_1m", 18.0);
        context.addProperty("mspt_p95_1m", 55.0);
        profile.add("context", context);
        profile.add("system", new JsonObject());
        profile.add("capture", new JsonObject());
        JsonArray rollups = new JsonArray();
        JsonObject minecraft = new JsonObject();
        minecraft.addProperty("mod_id", "minecraft");
        minecraft.addProperty("own_pct", 30.0);
        minecraft.addProperty("pct", 30.0);
        JsonObject jvm = new JsonObject();
        jvm.addProperty("mod_id", "jvm");
        jvm.addProperty("own_pct", 18.0);
        jvm.addProperty("pct", 18.0);
        JsonObject create = new JsonObject();
        create.addProperty("mod_id", "create");
        create.addProperty("own_pct", 16.0);
        create.addProperty("pct", 16.0);
        create.addProperty("top_label", "ContinuousOBBCollider.collideMany");
        rollups.add(minecraft);
        rollups.add(jvm);
        rollups.add(create);
        profile.add("mod_rollups", rollups);
        profile.add("source_rollups", rollups.deepCopy());

        SparkRecommendationBuilder.enrich(profile);
        String findings = profile.getAsJsonArray("key_findings").toString();
        String recommendations = profile.getAsJsonArray("recommendations").toString();
        assertFalse(findings.contains("spark.source.jvm"));
        assertFalse(recommendations.toLowerCase().contains("compare jvm"));
        assertTrue(findings.contains("spark.source.create.own_share"));
        assertFalse(profile.getAsJsonObject("evidence_summary")
                .get("why_watchtower_says_this").getAsString().toLowerCase().contains("exclusive profiler"));
    }

    @Test
    void hotspotFindingRequiresDenseHotspotNotJustComposition() {
        JsonObject profile = new JsonObject();
        profile.addProperty("mode", "execution");
        JsonObject context = new JsonObject();
        context.addProperty("tps_1m", 18.0);
        context.addProperty("mspt_p95_1m", 55.0);
        JsonObject composition = new JsonObject();
        composition.addProperty("glue_share_pct", 16.0);
        composition.addProperty("xp_items_share_pct", 10.0);
        composition.addProperty("automation_share_pct", 26.0);
        composition.addProperty("total_entities", 1200);
        context.add("entity_composition", composition);
        JsonArray hotspots = new JsonArray();
        JsonObject hotspot = new JsonObject();
        hotspot.addProperty("dimension", "overworld");
        hotspot.addProperty("chunk_x", 1);
        hotspot.addProperty("chunk_z", 1);
        hotspot.addProperty("total_entities", 80);
        hotspot.addProperty("top_count", 70);
        hotspot.addProperty("top_type", "create:super_glue");
        hotspots.add(hotspot);
        context.add("entity_hotspots", hotspots);
        profile.add("context", context);
        profile.add("system", new JsonObject());
        profile.add("capture", new JsonObject());
        profile.add("mod_rollups", new JsonArray());
        profile.add("source_rollups", new JsonArray());

        SparkRecommendationBuilder.enrich(profile);
        String json = profile.getAsJsonArray("key_findings").toString();
        assertTrue(json.contains("spark.entity.composition"));
        assertFalse(json.contains("spark.entity.hotspots"));
    }

    @Test
    void tickHealthIncludesMeanAndStallMax() {
        JsonObject profile = new JsonObject();
        profile.addProperty("mode", "execution");
        JsonObject context = new JsonObject();
        context.addProperty("tps_1m", 19.2);
        context.addProperty("mspt_mean_1m", 51.3);
        context.addProperty("mspt_p95_1m", 61.9);
        context.addProperty("mspt_max_1m", 180.0);
        context.addProperty("mspt_max_5m", 5021.0);
        profile.add("context", context);
        profile.add("system", new JsonObject());
        profile.add("capture", new JsonObject());
        profile.add("mod_rollups", new JsonArray());
        profile.add("source_rollups", new JsonArray());

        SparkRecommendationBuilder.enrich(profile);
        JsonObject tick = null;
        for (var el : profile.getAsJsonArray("key_findings")) {
            if (el.isJsonObject() && "spark.tick.health".equals(el.getAsJsonObject().get("id").getAsString())) {
                tick = el.getAsJsonObject();
                break;
            }
        }
        assertNotNull(tick);
        assertEquals("critical", tick.get("severity").getAsString());
        assertTrue(tick.get("detail").getAsString().contains("typical tick"));
        assertTrue(tick.get("detail").getAsString().toLowerCase().contains("hitch")
                || tick.get("detail").getAsString().contains("5 min"));
    }

    private static JsonObject windowRow(double tps, double mspt, int entities, int chunks) {
        JsonObject row = new JsonObject();
        row.addProperty("tps", tps);
        row.addProperty("mspt_max", mspt);
        row.addProperty("entities", entities);
        row.addProperty("chunks", chunks);
        return row;
    }

    @Test
    void mergeModRecommendationsAppendsFixStepsToMatchingModRec() {
        JsonObject profile = new JsonObject();
        JsonArray hints = new JsonArray();
        JsonObject hint = new JsonObject();
        hint.addProperty("mod_id", "sable");
        hint.addProperty("pct", 21.0);
        hints.add(hint);
        profile.add("mod_hints", hints);
        JsonArray rollups = new JsonArray();
        JsonObject rollup = new JsonObject();
        rollup.addProperty("mod_id", "sable");
        rollup.addProperty("pct", 21.0);
        rollup.addProperty("top_label", "ServerSubLevelContainer.tick");
        rollups.add(rollup);
        profile.add("mod_rollups", rollups);

        JsonObject modRec = new JsonObject();
        modRec.addProperty("mod_id", "sable");
        modRec.addProperty("severity", "warning");
        modRec.addProperty("category", "registry_missing");
        modRec.addProperty("count", 3);
        modRec.addProperty("why", "Registry entries missing at runtime.");
        modRec.addProperty("fix", "Update sable to match pack version.");
        JsonArray steps = new JsonArray();
        steps.add("Check sable version in mods/");
        steps.add("Restart after update");
        modRec.add("fix_steps", steps);
        JsonArray modRecs = new JsonArray();
        modRecs.add(modRec);

        SparkRecommendationBuilder.enrich(profile);
        SparkRecommendationBuilder.mergeModRecommendations(profile, modRecs);

        JsonArray recs = profile.getAsJsonArray("recommendations");
        JsonObject sableRec = null;
        for (int i = 0; i < recs.size(); i++) {
            JsonObject r = recs.get(i).getAsJsonObject();
            if (!r.has("mod_id") || !r.has("category")) {
                continue;
            }
            if ("sable".equals(r.get("mod_id").getAsString()) && "mod".equals(r.get("category").getAsString())) {
                sableRec = r;
                break;
            }
        }
        assertNotNull(sableRec);
        assertTrue(sableRec.get("linked_mod_rec").getAsBoolean());
        JsonArray actions = sableRec.getAsJsonArray("actions");
        assertTrue(actions.size() >= 3);
        assertTrue(profile.getAsJsonArray("key_findings").toString().contains("Also in logs"));
    }

    @Test
    void mergeModRecommendationsIsIdempotentForActions() {
        JsonObject profile = new JsonObject();
        JsonArray hints = new JsonArray();
        JsonObject hint = new JsonObject();
        hint.addProperty("mod_id", "create");
        hints.add(hint);
        profile.add("mod_hints", hints);
        JsonArray rollups = new JsonArray();
        JsonObject rollup = new JsonObject();
        rollup.addProperty("mod_id", "create");
        rollup.addProperty("pct", 12.0);
        rollup.addProperty("top_label", "FluidManipulationBehaviour.tick");
        rollups.add(rollup);
        profile.add("mod_rollups", rollups);

        JsonObject modRec = new JsonObject();
        modRec.addProperty("mod_id", "create");
        modRec.addProperty("severity", "critical");
        modRec.addProperty("fix", "Fix create config");
        JsonArray steps = new JsonArray();
        steps.add("Step one");
        modRec.add("fix_steps", steps);
        JsonArray modRecs = new JsonArray();
        modRecs.add(modRec);

        SparkRecommendationBuilder.enrich(profile);
        SparkRecommendationBuilder.mergeModRecommendations(profile, modRecs);
        JsonObject createRec = findCreateModRec(profile);
        int firstSize = createRec.getAsJsonArray("actions").size();
        SparkRecommendationBuilder.mergeModRecommendations(profile, modRecs);
        int secondSize = findCreateModRec(profile).getAsJsonArray("actions").size();
        assertEquals(firstSize, secondSize);
    }

    private static JsonObject findCreateModRec(JsonObject profile) {
        for (var el : profile.getAsJsonArray("recommendations")) {
            JsonObject r = el.getAsJsonObject();
            if (r.has("mod_id") && "create".equals(r.get("mod_id").getAsString())) {
                return r;
            }
        }
        fail("create rec missing");
        return null;
    }

    private static void assertEvidenceSchema(JsonObject item) {
        assertTrue(item.has("id"));
        assertTrue(item.has("confidence"));
        assertTrue(item.has("evidence"));
        assertTrue(item.has("limitations"));
        String confidence = item.get("confidence").getAsString();
        assertTrue(confidence.equals("observed")
                || confidence.equals("correlated")
                || confidence.equals("contextual"));
    }
}
