package dev.mcstatus.watchtower;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;

/** Wizard discovery count tiles must read the real facts schema. */
class InitialDiscoveryCountsTest {

    @Test
    void fillCountsFromFactsReadsCrashSummariesAndIssuesArray() {
        JsonObject facts = new JsonObject();
        JsonObject optional = new JsonObject();
        JsonArray summaries = new JsonArray();
        summaries.add(new JsonObject());
        summaries.add(new JsonObject());
        optional.add("crash_summaries", summaries);
        JsonArray mods = new JsonArray();
        for (int i = 0; i < 3; i++) {
            mods.add(new JsonObject());
        }
        optional.add("mods", mods);
        facts.add("optional", optional);

        JsonArray issues = new JsonArray();
        JsonObject active = new JsonObject();
        active.addProperty("id", "DISK_FULL");
        active.addProperty("historical", false);
        issues.add(active);
        JsonObject historical = new JsonObject();
        historical.addProperty("id", "OLD");
        historical.addProperty("historical", true);
        issues.add(historical);
        facts.add("issues", issues);

        JsonObject counts = new JsonObject();
        InitialDiscoveryRunner.fillCountsFromFacts(counts, facts);

        assertEquals(2, counts.get("crashes").getAsInt());
        assertEquals(3, counts.get("jars").getAsInt());
        assertEquals(1, counts.get("active_issues").getAsInt());
    }

    @Test
    void fillCountsFromFactsReportsZeroWhenEmpty() {
        JsonObject facts = new JsonObject();
        JsonObject optional = new JsonObject();
        optional.add("crash_summaries", new JsonArray());
        optional.add("mods", new JsonArray());
        facts.add("optional", optional);
        facts.add("issues", new JsonArray());

        JsonObject counts = new JsonObject();
        InitialDiscoveryRunner.fillCountsFromFacts(counts, facts);

        assertEquals(0, counts.get("crashes").getAsInt());
        assertEquals(0, counts.get("jars").getAsInt());
        assertEquals(0, counts.get("active_issues").getAsInt());
    }

    @Test
    void fillCountsFromFactsIgnoresLegacyIssuesObjectShapeWhenArrayAbsent() {
        JsonObject facts = new JsonObject();
        JsonObject issuesObj = new JsonObject();
        JsonArray active = new JsonArray();
        active.add(new JsonObject());
        issuesObj.add("active", active);
        facts.add("issues", issuesObj);

        JsonObject counts = new JsonObject();
        InitialDiscoveryRunner.fillCountsFromFacts(counts, facts);

        assertEquals(1, counts.get("active_issues").getAsInt());
        // No crash payloads → finished baseline reports explicit 0, not missing.
        assertEquals(0, counts.get("crashes").getAsInt());
    }
}
