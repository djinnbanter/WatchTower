package dev.mcstatus.watchtower.core.report;

import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.ops.OpsLogTailScanner;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class StateManagerPackChangeSnapshotTest {

    @TempDir
    Path temp;

    @Test
    void packChangeSnapshotRoundTrip() throws Exception {
        Path state = temp.resolve(".watchtower-state.json");
        assertNull(StateManager.getPackChangeSnapshot(state));

        JsonObject snap = new JsonObject();
        snap.addProperty("captured_at_epoch", 42L);
        JsonObject mods = new JsonObject();
        JsonObject row = new JsonObject();
        row.addProperty("size", 10);
        row.addProperty("mtime", 20);
        row.addProperty("disabled", false);
        mods.add("a.jar", row);
        snap.add("mods", mods);

        StateManager.setPackChangeSnapshot(state, snap);
        JsonObject loaded = StateManager.getPackChangeSnapshot(state);
        assertTrue(loaded.has("mods"));
        assertTrue(loaded.getAsJsonObject("mods").has("a.jar"));
        assertEquals(42L, loaded.get("captured_at_epoch").getAsLong());
    }

    @Test
    void activityLedgerCapIs1500() {
        assertEquals(1500, OpsLogTailScanner.MAX_LEDGER_EVENTS);
    }
}
