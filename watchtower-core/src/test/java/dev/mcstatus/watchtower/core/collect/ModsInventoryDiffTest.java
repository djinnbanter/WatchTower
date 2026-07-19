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

    @Test
    void loadOpsBaselineReadsLastModsOpsSnapshot() {
        JsonObject state = new JsonObject();
        assertEquals(0, ModsInventoryDiff.loadOpsBaseline(state).size());
        JsonArray snap = new JsonArray();
        JsonObject row = new JsonObject();
        row.addProperty("jar", "a.jar");
        snap.add(row);
        state.add("last_mods_ops_snapshot", snap);
        JsonArray loaded = ModsInventoryDiff.loadOpsBaseline(state);
        assertEquals(1, loaded.size());
        assertEquals("a.jar", loaded.get(0).getAsJsonObject().get("jar").getAsString());
    }
}
