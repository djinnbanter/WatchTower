package dev.mcstatus.watchtower.core.ops;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class LagIssueBuilderTest {

    @Test
    void buildPeekEntry_includesHintsAndNarrative() {
        JsonObject incident = new JsonObject();
        incident.addProperty("id", "2026-06-22T14-03-12Z");
        incident.addProperty("pinned_at", "2026-06-22T14:03:12+00:00");
        incident.addProperty("severity", "critical");
        incident.addProperty("mspt", 120.4);
        incident.addProperty("tps", 8.2);
        incident.addProperty("players_online", 4);
        incident.addProperty("entities", 12400);

        JsonObject ctx = new JsonObject();
        JsonArray jobs = new JsonArray();
        JsonObject job = new JsonObject();
        job.addProperty("type", "chunky_pregen");
        job.addProperty("detail", "overworld 42%");
        jobs.add(job);
        ctx.add("background_jobs", jobs);
        JsonArray cmds = new JsonArray();
        JsonObject cmd = new JsonObject();
        cmd.addProperty("command", "/chunky continue");
        cmds.add(cmd);
        ctx.add("recent_commands", cmds);
        incident.add("context", ctx);

        JsonObject entry = LagIssueBuilder.buildPeekEntry(incident);
        assertEquals("LAG-2026-06-22T14-03-12Z", entry.get("id").getAsString());
        assertFalse(entry.get("resolved").getAsBoolean());
        assertTrue(entry.get("title").getAsString().contains("MSPT"));
        assertTrue(entry.get("narrative").getAsString().contains("pregen"));
        assertTrue(entry.getAsJsonArray("hints").size() >= 2);
        assertTrue(entry.has("findings"));
        assertTrue(entry.getAsJsonArray("findings").size() >= 2);
        assertEquals("World pregen was running — overworld 42%", entry.get("primary_suspect").getAsString());
    }

    @Test
    void buildFindings_tagsConfirmedVsManual() {
        JsonObject incident = new JsonObject();
        incident.addProperty("players_online", 1);
        incident.addProperty("entities", 9000);
        JsonArray findings = LagIssueBuilder.buildFindings(incident);
        boolean hasManual = false;
        boolean hasEntities = false;
        for (JsonElement el : findings) {
            JsonObject f = el.getAsJsonObject();
            if ("manual".equals(f.get("kind").getAsString())) hasManual = true;
            if ("entities".equals(f.get("category").getAsString())) hasEntities = true;
        }
        assertTrue(hasEntities);
        assertTrue(hasManual);
    }

    @Test
    void buildFindings_usesSparkWhenCorrelated() {
        JsonObject incident = new JsonObject();
        incident.addProperty("pinned_at", java.time.ZonedDateTime.now().format(
                java.time.format.DateTimeFormatter.ISO_OFFSET_DATE_TIME));
        incident.addProperty("players_online", 2);

        JsonObject spark = new JsonObject();
        spark.addProperty("fresh", true);
        spark.addProperty("captured_at", java.time.ZonedDateTime.now().format(
                java.time.format.DateTimeFormatter.ISO_OFFSET_DATE_TIME));
        JsonArray hints = new JsonArray();
        JsonObject hint = new JsonObject();
        hint.addProperty("mod_id", "sable");
        hint.addProperty("pct", 21.0);
        hint.addProperty("summary", "SubLevelContainer.tick");
        hints.add(hint);
        spark.add("mod_hints", hints);

        JsonArray findings = LagIssueBuilder.buildFindings(incident, spark);
        boolean hasSpark = false;
        for (JsonElement el : findings) {
            JsonObject f = el.getAsJsonObject();
            if ("spark".equals(f.get("category").getAsString())) {
                hasSpark = true;
                assertEquals("confirmed", f.get("kind").getAsString());
            }
        }
        assertTrue(hasSpark);
        assertTrue(LagIssueBuilder.buildPeekEntry(incident, spark).get("primary_suspect").getAsString()
                .contains("sable"));
    }
}
