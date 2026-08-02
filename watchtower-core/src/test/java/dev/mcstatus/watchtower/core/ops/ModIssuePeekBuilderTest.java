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

    @Test
    void distxformAndLootFloodsDoNotBuryRealLoggerErrors() {
        JsonArray errors = new JsonArray();

        JsonObject lootFlood = new JsonObject();
        lootFlood.addProperty("mod_id", "dndecor");
        lootFlood.addProperty("total", 27_272);
        lootFlood.addProperty("top_category", "loot_parse");
        lootFlood.addProperty("category_label", "loot parse");
        lootFlood.addProperty("sample_line",
                "Couldn't parse element ResourceKey[minecraft:root / minecraft:loot_table]:dndecor:blocks/rose_large_fan");
        errors.add(lootFlood);

        JsonObject distxformFlood = new JsonObject();
        distxformFlood.addProperty("mod_id", "c2me_client_uncapvd");
        distxformFlood.addProperty("total", 1_896);
        distxformFlood.addProperty("top_category", "client_on_server");
        distxformFlood.addProperty("category_label", "client-only class blocked");
        distxformFlood.addProperty("sample_line",
                "Attempted to load class net/minecraft/client/Options for invalid dist DEDICATED_SERVER");
        errors.add(distxformFlood);

        JsonObject realError = new JsonObject();
        realError.addProperty("mod_id", "grieflogger");
        realError.addProperty("total", 3);
        realError.addProperty("top_category", "logger_error");
        realError.addProperty("category_label", "error");
        realError.addProperty("sample_line", "[Server thread/ERROR] [grieflogger/]: Database connection failed");
        errors.add(realError);

        JsonArray peek = ModIssuePeekBuilder.buildPeekEntries(errors);
        assertFalse(peek.isEmpty());
        assertEquals("grieflogger", peek.get(0).getAsJsonObject().get("mod_id").getAsString(),
                "real logger_error must outrank DISTXFORM and loot-parse floods");

        int floodSlots = 0;
        for (int i = 0; i < peek.size(); i++) {
            String modId = peek.get(i).getAsJsonObject().get("mod_id").getAsString();
            if ("dndecor".equals(modId) || "c2me_client_uncapvd".equals(modId)) {
                floodSlots++;
            }
        }
        assertTrue(floodSlots <= 1, "at most one boot-noise flood row may remain in peek");
        assertTrue(peek.size() >= 2, "ERROR plus one collapsed flood should both appear when slots remain");
    }
}
