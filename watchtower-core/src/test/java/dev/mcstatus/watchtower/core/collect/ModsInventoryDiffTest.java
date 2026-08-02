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
        assertEquals(2, diff.getAsJsonArray("added").get(0).getAsJsonObject().get("mtime").getAsLong());
        assertEquals(1, diff.getAsJsonArray("removed").get(0).getAsJsonObject().get("mtime").getAsLong());
        assertEquals("1 added, 1 removed since last report", ModsInventoryDiff.summarizeTldr(diff));
    }

    @Test
    void diffDetectsVersionBumpAsChangedWithPrevVersion() {
        JsonArray baseline = new JsonArray();
        JsonObject oldJar = new JsonObject();
        oldJar.addProperty("jar", "create-6.0.0.jar");
        oldJar.addProperty("mod_id", "create");
        oldJar.addProperty("display_name", "Create");
        oldJar.addProperty("version", "6.0.0");
        oldJar.addProperty("size", 100);
        oldJar.addProperty("mtime", 1);
        baseline.add(oldJar);

        JsonArray current = new JsonArray();
        JsonObject newJar = new JsonObject();
        newJar.addProperty("jar", "create-6.0.1.jar");
        newJar.addProperty("mod_id", "create");
        newJar.addProperty("display_name", "Create");
        newJar.addProperty("version", "6.0.1");
        newJar.addProperty("size", 120);
        newJar.addProperty("mtime", 2);
        current.add(newJar);

        JsonObject diff = ModsInventoryDiff.diff(current, baseline);
        assertTrue(diff.get("has_changes").getAsBoolean());
        assertEquals(0, diff.get("added_count").getAsInt());
        assertEquals(0, diff.get("removed_count").getAsInt());
        assertEquals(1, diff.get("changed_count").getAsInt());
        JsonObject row = diff.getAsJsonArray("changed").get(0).getAsJsonObject();
        assertEquals("6.0.0", row.get("prev_version").getAsString());
        assertEquals("6.0.1", row.get("version").getAsString());
        assertEquals("create-6.0.0.jar", row.get("prev_jar").getAsString());
        assertEquals("create-6.0.1.jar", row.get("jar").getAsString());
        assertEquals("1 updated since last report", ModsInventoryDiff.summarizeTldr(diff));
    }

    @Test
    void sameJarEmitsPrevVersionWhenMetadataChanges() {
        JsonArray baseline = new JsonArray();
        JsonObject oldJar = new JsonObject();
        oldJar.addProperty("jar", "jei.jar");
        oldJar.addProperty("mod_id", "jei");
        oldJar.addProperty("version", "19.0.0");
        oldJar.addProperty("size", 50);
        oldJar.addProperty("mtime", 1);
        baseline.add(oldJar);

        JsonArray current = new JsonArray();
        JsonObject newJar = new JsonObject();
        newJar.addProperty("jar", "jei.jar");
        newJar.addProperty("mod_id", "jei");
        newJar.addProperty("version", "19.1.0");
        newJar.addProperty("size", 55);
        newJar.addProperty("mtime", 2);
        current.add(newJar);

        JsonObject row = ModsInventoryDiff.diff(current, baseline)
                .getAsJsonArray("changed").get(0).getAsJsonObject();
        assertEquals("19.0.0", row.get("prev_version").getAsString());
        assertEquals("19.1.0", row.get("version").getAsString());
    }

    @Test
    void sameJarVersionDifferentHashIsDrift() {
        JsonArray baseline = new JsonArray();
        JsonObject oldJar = new JsonObject();
        oldJar.addProperty("jar", "create.jar");
        oldJar.addProperty("mod_id", "create");
        oldJar.addProperty("version", "6.0.0");
        oldJar.addProperty("size", 100);
        oldJar.addProperty("mtime", 1);
        oldJar.addProperty("sha512", "aaa");
        baseline.add(oldJar);

        JsonArray current = new JsonArray();
        JsonObject newJar = new JsonObject();
        newJar.addProperty("jar", "create.jar");
        newJar.addProperty("mod_id", "create");
        newJar.addProperty("version", "6.0.0");
        newJar.addProperty("size", 100);
        newJar.addProperty("mtime", 1);
        newJar.addProperty("sha512", "bbb");
        current.add(newJar);

        JsonObject diff = ModsInventoryDiff.diff(current, baseline);
        assertTrue(diff.get("has_changes").getAsBoolean());
        assertEquals(0, diff.get("changed_count").getAsInt());
        assertEquals(1, diff.get("drift_count").getAsInt());
        JsonObject drift = diff.getAsJsonArray("drift").get(0).getAsJsonObject();
        assertEquals("create.jar", drift.get("jar").getAsString());
        assertEquals("aaa", drift.get("prev_sha512").getAsString());
        assertEquals("bbb", drift.get("sha512").getAsString());
        assertEquals("drift", drift.get("change").getAsString());
        assertEquals("1 drifted since last report", ModsInventoryDiff.summarizeTldr(diff));
    }

    @Test
    void versionBumpIsNotDriftEvenWhenHashChanges() {
        JsonArray baseline = new JsonArray();
        JsonObject oldJar = new JsonObject();
        oldJar.addProperty("jar", "create.jar");
        oldJar.addProperty("mod_id", "create");
        oldJar.addProperty("version", "6.0.0");
        oldJar.addProperty("size", 100);
        oldJar.addProperty("mtime", 1);
        oldJar.addProperty("sha512", "aaa");
        baseline.add(oldJar);

        JsonArray current = new JsonArray();
        JsonObject newJar = new JsonObject();
        newJar.addProperty("jar", "create.jar");
        newJar.addProperty("mod_id", "create");
        newJar.addProperty("version", "6.0.1");
        newJar.addProperty("size", 110);
        newJar.addProperty("mtime", 2);
        newJar.addProperty("sha512", "bbb");
        current.add(newJar);

        JsonObject diff = ModsInventoryDiff.diff(current, baseline);
        assertEquals(1, diff.get("changed_count").getAsInt());
        assertEquals(0, diff.get("drift_count").getAsInt());
        assertTrue(diff.getAsJsonArray("drift").isEmpty());
    }

    @Test
    void emptyBaselineSeedsWithoutDrift() {
        JsonArray current = new JsonArray();
        JsonObject jar = new JsonObject();
        jar.addProperty("jar", "create.jar");
        jar.addProperty("version", "1.0");
        jar.addProperty("sha512", "abc");
        current.add(jar);
        JsonObject diff = ModsInventoryDiff.diff(current, new JsonArray());
        assertEquals(0, diff.get("drift_count").getAsInt());
        assertEquals(1, diff.get("added_count").getAsInt());
    }
}
