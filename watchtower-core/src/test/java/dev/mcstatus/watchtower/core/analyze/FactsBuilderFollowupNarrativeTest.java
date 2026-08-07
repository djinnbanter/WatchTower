package dev.mcstatus.watchtower.core.analyze;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class FactsBuilderFollowupNarrativeTest {

    @Test
    void refreshFollowupNarrativesRewritesPregenStaleCopy() {
        JsonArray summaries = new JsonArray();

        JsonObject primary = new JsonObject();
        primary.addProperty("file", "crash-create.txt");
        primary.addProperty("time", "2026-06-03T15:00:00+01:00");
        primary.addProperty("failure_kind", CrashClassifier.FK_MOD_RUNTIME);
        primary.addProperty("category", "mod");
        primary.addProperty("exception", "java.lang.NullPointerException");
        primary.addProperty("primary_mod_id", "create");
        summaries.add(primary);

        JsonObject watchdog = new JsonObject();
        watchdog.addProperty("file", "crash-wd.txt");
        watchdog.addProperty("time", "2026-06-03T15:00:45+01:00");
        watchdog.addProperty("failure_kind", CrashClassifier.FK_WATCHDOG);
        watchdog.addProperty("stall_mod_id", "chunky");
        watchdog.addProperty("watchdog_tick_ms", 60000);
        watchdog.addProperty("exception",
                "java.lang.Error: ServerHangWatchdog detected that a single server tick took 60.00 seconds");
        watchdog.addProperty("plain_english",
                "Server tick hang — chunky blocked while Chunky pregen was active (~60s).");
        watchdog.addProperty("likely_cause", "Tick hang / pregen contention");
        summaries.add(watchdog);

        IncidentChainBuilder.link(summaries);
        assertEquals(CrashClassifier.FK_WATCHDOG_FOLLOWUP, watchdog.get("failure_kind").getAsString());

        FactsBuilder.refreshFollowupNarratives(summaries, new JsonArray(),
                new CrashClassifier.ClassifyContext(new JsonArray(), null, true));

        assertEquals("Server hung", watchdog.get("likely_cause").getAsString());
        assertFalse(watchdog.get("plain_english").getAsString().toLowerCase().contains("chunky pregen"));
        assertEquals(primary.get("file").getAsString(),
                watchdog.get("paired_primary_file").getAsString());
    }
}
