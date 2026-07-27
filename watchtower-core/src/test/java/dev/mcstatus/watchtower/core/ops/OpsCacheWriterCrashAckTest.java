package dev.mcstatus.watchtower.core.ops;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.report.StateManager;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;
import java.time.Instant;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class OpsCacheWriterCrashAckTest {

    @TempDir
    Path temp;

    @Test
    void applyCrashAcks_updatesUnreviewedFromState() throws Exception {
        Path ops = temp.resolve("ops-cache.json");
        Path state = temp.resolve(".watchtower-state.json");

        JsonObject crashes = new JsonObject();
        crashes.addProperty(OpsCacheSchema.CRASHES_UNREVIEWED, 2);
        JsonArray entries = new JsonArray();
        entries.add(crashRow("crash-a.txt", false));
        entries.add(crashRow("crash-b.txt", false));
        crashes.add(OpsCacheSchema.CRASHES_ENTRIES, entries);

        JsonObject seed = new JsonObject();
        seed.add(OpsCacheSchema.CRASHES, crashes);
        OpsCacheWriter.writeAtomic(ops, seed);

        StateManager.acknowledgeCrash(state, "crash-a.txt", Instant.now(), "test", null, null);

        JsonObject updated = OpsCacheWriter.applyCrashAcks(ops, state);
        JsonObject block = updated.getAsJsonObject(OpsCacheSchema.CRASHES);
        assertEquals(1, block.get(OpsCacheSchema.CRASHES_UNREVIEWED).getAsInt());

        JsonArray next = block.getAsJsonArray(OpsCacheSchema.CRASHES_ENTRIES);
        assertTrue(next.get(0).getAsJsonObject().get("acknowledged").getAsBoolean());
        assertFalse(next.get(1).getAsJsonObject().get("acknowledged").getAsBoolean());
        assertEquals("crash-b.txt",
                block.getAsJsonObject("latest_unreviewed").get(OpsCacheSchema.ENTRY_FILE).getAsString());
    }

    private static JsonObject crashRow(String file, boolean acked) {
        JsonObject row = new JsonObject();
        row.addProperty(OpsCacheSchema.ENTRY_FILE, file);
        row.addProperty(OpsCacheSchema.ENTRY_MTIME, 1_700_000_000L);
        row.addProperty("acknowledged", acked);
        return row;
    }
}
