package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class SparkRecommendationBuilderTest {

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
}
