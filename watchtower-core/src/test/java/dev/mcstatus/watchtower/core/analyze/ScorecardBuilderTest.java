package dev.mcstatus.watchtower.core.analyze;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

import static org.junit.jupiter.api.Assertions.*;

class ScorecardBuilderTest {

    @Test
    void build_degradedWhenLowTpsSpikes() throws Exception {
        Instant recent = Instant.now().truncatedTo(ChronoUnit.MINUTES);
        String t0 = recent.minus(30, ChronoUnit.MINUTES).toString();
        String t1 = recent.minus(29, ChronoUnit.MINUTES).toString();
        Path rollups = Files.createTempFile("rollups", ".json");
        Files.writeString(rollups, """
                {"retention_days":90,"rows":[
                  {"ts":"%s","low_tps_flag":true,"mspt_p95":55,"mspt_jitter_max":12},
                  {"ts":"%s","low_tps_flag":true,"mspt_p95":48,"mspt_jitter_max":10}
                ]}
                """.formatted(t0, t1));

        JsonObject facts = new JsonObject();
        JsonObject health = new JsonObject();
        health.addProperty("status", "ok");
        facts.add("health", health);

        JsonObject opsCache = JsonParser.parseString("""
                {"crashes":{"unreviewed":0,"latest":{"file":"c.txt","display_label":"Test"}}}
                """).getAsJsonObject();

        JsonObject scorecard = ScorecardBuilder.build(facts, opsCache, rollups, 19.5, 50.0, 1);
        assertEquals("degraded", scorecard.get("grade").getAsString());
        assertTrue(scorecard.getAsJsonObject("performance").get("low_tps_minutes_24h").getAsInt() >= 2);
        Files.deleteIfExists(rollups);
    }

    @Test
    void build_criticalWhenUnreviewedCrashes() {
        JsonObject facts = new JsonObject();
        JsonObject health = new JsonObject();
        health.addProperty("status", "ok");
        facts.add("health", health);

        JsonObject opsCache = JsonParser.parseString("""
                {"crashes":{"unreviewed":2,"latest":{"file":"c.txt","display_label":"Watchdog"}}}
                """).getAsJsonObject();

        JsonObject scorecard = ScorecardBuilder.build(facts, opsCache, Path.of("nonexistent.json"), 19.5, 50.0, 5);
        assertEquals("critical", scorecard.get("grade").getAsString());
        assertEquals(2, scorecard.getAsJsonObject("crashes").get("unreviewed").getAsInt());
    }
}
