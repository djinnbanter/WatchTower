package dev.mcstatus.watchtower.core.ops;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ModIssuePeekBuilderTest {

    @Test
    void excludesClientNoiseAndSortsBySeverity() {
        JsonArray errors = new JsonArray();
        JsonObject noise = new JsonObject();
        noise.addProperty("mod_id", "client_noise");
        noise.addProperty("total", 50);
        errors.add(noise);

        JsonObject critical = new JsonObject();
        critical.addProperty("mod_id", "broken_mod");
        critical.addProperty("total", 2);
        critical.addProperty("top_category", "mod_load_failed");
        errors.add(critical);

        JsonObject minor = new JsonObject();
        minor.addProperty("mod_id", "noisy_mod");
        minor.addProperty("total", 20);
        minor.addProperty("top_category", "logger_error");
        errors.add(minor);

        JsonArray peek = ModIssuePeekBuilder.buildPeekEntries(errors);
        assertEquals(2, peek.size());
        assertEquals("broken_mod", peek.get(0).getAsJsonObject().get("mod_id").getAsString());
        assertFalse(peek.get(0).getAsJsonObject().get("id").getAsString().contains("client_noise"));
    }

    @Test
    void recipeWarnFloodsDoNotBuryRealLoggerErrors() {
        JsonArray errors = new JsonArray();

        JsonObject createfood = new JsonObject();
        createfood.addProperty("mod_id", "createfood");
        createfood.addProperty("total", 50_000);
        createfood.addProperty("top_category", "recipe_parse");
        createfood.addProperty("category_label", "recipe parse");
        errors.add(createfood);

        JsonObject kubejs = new JsonObject();
        kubejs.addProperty("mod_id", "kubejs");
        kubejs.addProperty("total", 1_000);
        kubejs.addProperty("top_category", "recipe_parse");
        kubejs.addProperty("category_label", "recipe parse");
        errors.add(kubejs);

        JsonObject othermod = new JsonObject();
        othermod.addProperty("mod_id", "othermod");
        othermod.addProperty("total", 3);
        othermod.addProperty("top_category", "logger_error");
        othermod.addProperty("category_label", "error");
        errors.add(othermod);

        JsonArray peek = ModIssuePeekBuilder.buildPeekEntries(errors);
        assertFalse(peek.isEmpty());
        assertEquals("othermod", peek.get(0).getAsJsonObject().get("mod_id").getAsString(),
                "real logger_error must outrank recipe WARN floods");

        int floodSlots = 0;
        for (int i = 0; i < peek.size(); i++) {
            String modId = peek.get(i).getAsJsonObject().get("mod_id").getAsString();
            if ("createfood".equals(modId) || "kubejs".equals(modId)) {
                floodSlots++;
            }
        }
        assertTrue(floodSlots <= 1, "at most one recipe flood row may remain in peek");
        assertTrue(peek.size() >= 2, "ERROR plus one collapsed flood should both appear when slots remain");
    }
}
