package dev.mcstatus.watchtower.core;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.collect.ModChangeDetector;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class ModChangeDetectorTest {

    @Test
    void baselineRefreshSuppressesFullAddedList() {
        JsonObject optional = new JsonObject();
        JsonObject nativeBlob = new JsonObject();
        JsonArray mods = new JsonArray();
        for (int i = 0; i < 50; i++) {
            JsonObject m = new JsonObject();
            m.addProperty("id", "mod_" + i);
            mods.add(m);
        }
        nativeBlob.add("mods", mods);

        JsonObject state = new JsonObject();
        JsonArray prev = new JsonArray();
        prev.add("mod_0");
        prev.add("mod_1");
        state.add("mod_ids", prev);

        ModChangeDetector.apply(optional, nativeBlob, state);
        JsonObject changes = optional.getAsJsonObject("mod_changes");
        assertTrue(changes.get("baseline_refresh").getAsBoolean());
        assertEquals(48, changes.get("added_count").getAsInt());
        assertFalse(changes.has("added"));
    }

    @Test
    void normalDeltaListsAddedAndRemoved() {
        JsonObject optional = new JsonObject();
        JsonObject nativeBlob = new JsonObject();
        JsonArray mods = new JsonArray();
        JsonObject a = new JsonObject();
        a.addProperty("id", "a");
        JsonObject c = new JsonObject();
        c.addProperty("id", "c");
        mods.add(a);
        mods.add(c);
        nativeBlob.add("mods", mods);

        JsonObject state = new JsonObject();
        JsonArray prev = new JsonArray();
        prev.add("a");
        prev.add("b");
        state.add("mod_ids", prev);
        state.addProperty("mod_ids_full", true);

        ModChangeDetector.apply(optional, nativeBlob, state);
        JsonObject changes = optional.getAsJsonObject("mod_changes");
        assertFalse(changes.has("baseline_refresh"));
        assertEquals("c", changes.getAsJsonArray("added").get(0).getAsString());
        assertEquals("b", changes.getAsJsonArray("removed").get(0).getAsString());
    }
}
