package dev.mcstatus.watchtower.core.analyze;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class CrashNarratorTest {

    @Test
    void narratesWatchdogWithHighConfidence() {
        JsonObject crash = new JsonObject();
        crash.addProperty("exception",
                "java.lang.Error: ServerHangWatchdog detected that a single server tick took 60000.00 seconds");
        crash.addProperty("summary", "Watching Server");
        crash.addProperty("watchdog_tick_ms", 60000);

        CrashNarrator.Narrative n = CrashNarrator.narrate(crash, new JsonArray());
        assertEquals("high", n.confidence());
        assertFalse(n.manualReview());
        assertTrue(n.plainEnglish().contains("tick watchdog"));
        assertEquals("Server hung", n.likelyCause());
    }

    @Test
    void narratesModLoadFailure() {
        JsonObject crash = new JsonObject();
        crash.addProperty("exception", "Mod loading has failed");
        crash.addProperty("mod_file", "sable-neoforge-1.21.1");
        crash.addProperty("failure_message", "Mod sable has failed to load");

        CrashNarrator.Narrative n = CrashNarrator.narrate(crash, new JsonArray());
        assertFalse(n.manualReview());
        assertTrue(n.plainEnglish().toLowerCase().contains("loading"));
        assertEquals("Mod failed to load", n.likelyCause());
    }

    @Test
    void unknownCrashSetsManualReview() {
        JsonObject crash = new JsonObject();
        crash.addProperty("file", "crash-2026-06-16_test.txt");
        crash.addProperty("time", "2026-06-16T12:00:00+01:00");
        crash.addProperty("summary", "Something odd happened");

        CrashNarrator.Narrative n = CrashNarrator.narrate(crash, new JsonArray());
        assertTrue(n.manualReview());
        assertEquals("low", n.confidence());
        assertFalse(n.fixHints().isEmpty());
    }
}
