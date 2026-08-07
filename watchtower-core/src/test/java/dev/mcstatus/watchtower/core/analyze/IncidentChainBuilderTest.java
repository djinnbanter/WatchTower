package dev.mcstatus.watchtower.core.analyze;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class IncidentChainBuilderTest {

    @Test
    void pairsCreateNpeWithWatchdogWithin120s() {
        JsonArray summaries = new JsonArray();

        JsonObject create = new JsonObject();
        create.addProperty("file", "crash-2026-06-03_15.00.00-server.txt");
        create.addProperty("time", "2026-06-03T15:00:00+01:00");
        create.addProperty("failure_kind", CrashClassifier.FK_MOD_RUNTIME);
        create.addProperty("category", "mod");
        create.addProperty("exception", "java.lang.NullPointerException: Cannot invoke \"Object.hashCode()\"");
        create.addProperty("primary_mod_id", "create");
        summaries.add(create);

        JsonObject watchdog = new JsonObject();
        watchdog.addProperty("file", "crash-2026-06-03_15.01.02-server.txt");
        watchdog.addProperty("time", "2026-06-03T15:01:02+01:00");
        watchdog.addProperty("failure_kind", CrashClassifier.FK_WATCHDOG);
        watchdog.addProperty("category", "watchdog");
        watchdog.addProperty("exception",
                "java.lang.Error: ServerHangWatchdog detected that a single server tick took 62.00 seconds");
        summaries.add(watchdog);

        IncidentChainBuilder.link(summaries);

        assertEquals(create.get("incident_id").getAsString(), watchdog.get("incident_id").getAsString());
        assertTrue(create.get("incident_id").getAsString().startsWith("inc-"));
        assertEquals(CrashClassifier.FK_WATCHDOG_FOLLOWUP, watchdog.get("failure_kind").getAsString());
        assertEquals(create.get("file").getAsString(), watchdog.get("paired_primary_file").getAsString());
    }

    @Test
    void doesNotPairWhenOutside120sWindow() {
        JsonArray summaries = new JsonArray();

        JsonObject create = new JsonObject();
        create.addProperty("file", "crash-a.txt");
        create.addProperty("time", "2026-06-03T15:00:00+01:00");
        create.addProperty("failure_kind", CrashClassifier.FK_MOD_RUNTIME);
        create.addProperty("category", "mod");
        summaries.add(create);

        JsonObject watchdog = new JsonObject();
        watchdog.addProperty("file", "crash-b.txt");
        watchdog.addProperty("time", "2026-06-03T15:03:00+01:00");
        watchdog.addProperty("failure_kind", CrashClassifier.FK_WATCHDOG);
        watchdog.addProperty("exception", "java.lang.Error: ServerHangWatchdog");
        summaries.add(watchdog);

        IncidentChainBuilder.link(summaries);

        assertFalse(create.has("incident_id"));
        assertFalse(watchdog.has("incident_id"));
        assertEquals(CrashClassifier.FK_WATCHDOG, watchdog.get("failure_kind").getAsString());
    }

    @Test
    void doesNotPairCategoryModWithoutModRuntimeKind() {
        JsonArray summaries = new JsonArray();

        JsonObject primary = new JsonObject();
        primary.addProperty("file", "crash-modload.txt");
        primary.addProperty("time", "2026-06-03T15:00:00+01:00");
        primary.addProperty("failure_kind", CrashClassifier.FK_MOD_LOAD_DEPENDENCY);
        primary.addProperty("category", "mod");
        summaries.add(primary);

        JsonObject watchdog = new JsonObject();
        watchdog.addProperty("file", "crash-wd.txt");
        watchdog.addProperty("time", "2026-06-03T15:00:30+01:00");
        watchdog.addProperty("failure_kind", CrashClassifier.FK_WATCHDOG);
        watchdog.addProperty("exception", "java.lang.Error: ServerHangWatchdog");
        summaries.add(watchdog);

        IncidentChainBuilder.link(summaries);

        assertFalse(primary.has("incident_id"));
        assertFalse(watchdog.has("incident_id"));
        assertEquals(CrashClassifier.FK_WATCHDOG, watchdog.get("failure_kind").getAsString());
        assertFalse(watchdog.has("paired_primary_file"));
    }
}
