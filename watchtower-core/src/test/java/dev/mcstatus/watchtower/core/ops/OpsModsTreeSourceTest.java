package dev.mcstatus.watchtower.core.ops;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class OpsModsTreeSourceTest {

    @Test
    void prefersModsLightOverRunningMods() {
        JsonObject cache = new JsonObject();
        JsonObject light = new JsonObject();
        JsonArray lightMods = new JsonArray();
        JsonObject create = new JsonObject();
        create.addProperty("id", "create");
        lightMods.add(create);
        light.add("mods", lightMods);
        cache.add("mods_light", light);

        JsonObject running = new JsonObject();
        JsonArray runningMods = new JsonArray();
        JsonObject jei = new JsonObject();
        jei.addProperty("id", "jei");
        runningMods.add(jei);
        running.add("mods", runningMods);
        cache.add("running_mods", running);

        JsonArray resolved = OpsModsTreeSource.resolveModsArray(cache);
        assertEquals(1, resolved.size());
        assertEquals("create", resolved.get(0).getAsJsonObject().get("id").getAsString());
    }

    @Test
    void fallsBackToRunningMods() {
        JsonObject cache = new JsonObject();
        JsonObject running = new JsonObject();
        JsonArray mods = new JsonArray();
        JsonObject m = new JsonObject();
        m.addProperty("id", "neoforge");
        mods.add(m);
        running.add("mods", mods);
        cache.add("running_mods", running);

        assertEquals(1, OpsModsTreeSource.resolveModsArray(cache).size());
    }

    @Test
    void normalizesInventoryModId() {
        JsonObject cache = new JsonObject();
        JsonObject inv = new JsonObject();
        JsonArray mods = new JsonArray();
        JsonObject row = new JsonObject();
        row.addProperty("mod_id", "ae2");
        row.addProperty("display_name", "Applied Energistics 2");
        mods.add(row);
        inv.add("mods", mods);
        cache.add("mods_inventory", inv);

        JsonArray resolved = OpsModsTreeSource.resolveModsArray(cache);
        assertEquals(1, resolved.size());
        assertEquals("ae2", resolved.get(0).getAsJsonObject().get("id").getAsString());
    }

    @Test
    void emptyWhenNoModSources() {
        assertTrue(OpsModsTreeSource.resolveModsArray(new JsonObject()).isEmpty());
        assertTrue(OpsModsTreeSource.resolveModsArray(null).isEmpty());
    }
}
