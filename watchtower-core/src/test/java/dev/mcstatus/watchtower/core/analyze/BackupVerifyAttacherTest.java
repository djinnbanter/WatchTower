package dev.mcstatus.watchtower.core.analyze;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class BackupVerifyAttacherTest {

    @Test
    void mergePreservingKeepsPriorVerifyOnSamePath() {
        JsonObject priorLive = new JsonObject();
        JsonArray priorInv = new JsonArray();
        JsonObject oldRow = new JsonObject();
        oldRow.addProperty("path", "D:/backups/world.zip");
        oldRow.addProperty("filename", "world.zip");
        JsonObject verify = new JsonObject();
        verify.addProperty("status", "verified");
        verify.addProperty("mode", "light");
        oldRow.add("verify", verify);
        priorInv.add(oldRow);
        priorLive.add("inventory", priorInv);

        JsonArray fresh = new JsonArray();
        JsonObject newRow = new JsonObject();
        newRow.addProperty("path", "D:/backups/world.zip");
        newRow.addProperty("filename", "world.zip");
        newRow.addProperty("size_gb", 1.2);
        fresh.add(newRow);

        JsonArray merged = BackupVerifyAttacher.mergePreserving(fresh, priorLive);
        assertEquals(1, merged.size());
        assertTrue(merged.get(0).getAsJsonObject().has("verify"));
        assertEquals("verified",
                merged.get(0).getAsJsonObject().getAsJsonObject("verify").get("status").getAsString());
        assertEquals(1.2, merged.get(0).getAsJsonObject().get("size_gb").getAsDouble());
    }

    @Test
    void attachWritesVerifyByPath() {
        JsonArray inv = new JsonArray();
        JsonObject row = new JsonObject();
        row.addProperty("path", "/srv/backups/a.zip");
        inv.add(row);
        JsonObject v = new JsonObject();
        v.addProperty("status", "suspicious");
        BackupVerifyAttacher.attach(inv, Map.of("/srv/backups/a.zip", v));
        assertEquals("suspicious",
                inv.get(0).getAsJsonObject().getAsJsonObject("verify").get("status").getAsString());
    }

    @Test
    void freshVerifyNotOverwrittenByPrior() {
        JsonObject priorLive = new JsonObject();
        JsonArray priorInv = new JsonArray();
        JsonObject oldRow = new JsonObject();
        oldRow.addProperty("path", "/b/world.zip");
        JsonObject oldV = new JsonObject();
        oldV.addProperty("status", "broken");
        oldRow.add("verify", oldV);
        priorInv.add(oldRow);
        priorLive.add("inventory", priorInv);

        JsonArray fresh = new JsonArray();
        JsonObject newRow = new JsonObject();
        newRow.addProperty("path", "/b/world.zip");
        JsonObject newV = new JsonObject();
        newV.addProperty("status", "verified");
        newRow.add("verify", newV);
        fresh.add(newRow);

        JsonArray merged = BackupVerifyAttacher.mergePreserving(fresh, priorLive);
        assertEquals("verified",
                merged.get(0).getAsJsonObject().getAsJsonObject("verify").get("status").getAsString());
    }
}
