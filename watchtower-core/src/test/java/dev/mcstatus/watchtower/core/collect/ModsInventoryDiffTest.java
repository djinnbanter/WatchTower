package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class ModsInventoryDiffTest {

    @Test
    void diffDetectsAddedAndRemoved() {
        JsonArray baseline = new JsonArray();
        JsonObject oldJar = new JsonObject();
        oldJar.addProperty("jar", "old.jar");
        oldJar.addProperty("mod_id", "oldmod");
        oldJar.addProperty("size", 100);
        oldJar.addProperty("mtime", 1);
        baseline.add(oldJar);

        JsonArray current = new JsonArray();
        JsonObject newJar = new JsonObject();
        newJar.addProperty("jar", "new.jar");
        newJar.addProperty("mod_id", "newmod");
        newJar.addProperty("size", 200);
        newJar.addProperty("mtime", 2);
        current.add(newJar);

        JsonObject diff = ModsInventoryDiff.diff(current, baseline);
        assertTrue(diff.get("has_changes").getAsBoolean());
        assertEquals(1, diff.get("added_count").getAsInt());
        assertEquals(1, diff.get("removed_count").getAsInt());
        assertEquals("1 added, 1 removed since last report", ModsInventoryDiff.summarizeTldr(diff));
    }
}
