package dev.mcstatus.watchtower.core.live;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;
import java.time.Instant;

import static org.junit.jupiter.api.Assertions.*;

class PerformanceRollupWriterTest {

    @TempDir
    Path temp;

    @Test
    void backfillFromLiveHistory_bucketsMinutes() throws Exception {
        PerformanceRollupWriter writer = new PerformanceRollupWriter();
        writer.configure(temp.resolve("rollups.json"), 90, true);

        JsonObject live = new JsonObject();
        JsonObject series = new JsonObject();
        JsonArray mspt = new JsonArray();
        JsonArray tps = new JsonArray();
        long base = Instant.now().getEpochSecond() - 120;
        base = base - (base % 60);
        for (int i = 0; i < 120; i++) {
            JsonObject m = new JsonObject();
            m.addProperty("t", Instant.ofEpochSecond(base + i).toString());
            m.addProperty("v", 40.0 + (i % 3));
            mspt.add(m);
            JsonObject t = new JsonObject();
            t.addProperty("t", Instant.ofEpochSecond(base + i).toString());
            t.addProperty("v", 19.0 + (i % 2) * 0.5);
            tps.add(t);
        }
        series.add("mspt", mspt);
        series.add("tps", tps);
        live.add("series", series);

        int added = writer.backfillFromLiveHistory(live, 19.5);
        assertEquals(2, added);
        JsonObject api = writer.buildApiResponse(1);
        assertTrue(api.get("summary").getAsJsonObject().get("sample_minutes").getAsInt() >= 2);
    }

    @Test
    void buildApiResponse_disabledWhenOff() {
        PerformanceRollupWriter writer = new PerformanceRollupWriter();
        writer.configure(null, 90, false);
        JsonObject api = writer.buildApiResponse(24);
        assertFalse(api.get("enabled").getAsBoolean());
    }
}
