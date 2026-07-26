package dev.mcstatus.watchtower.core.ops;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class IncidentStoryBuilderTest {

    private static final Instant FIXTURE_NOW = Instant.parse("2026-07-16T22:30:00Z");
    private static final IncidentStoryBuilder.Settings SETTINGS =
            new IncidentStoryBuilder.Settings(true, 30, 48, 10);

    @Test
    void positiveFixtureProducesCoherentStoryWithCausalBackup() throws Exception {
        JsonObject root = loadFixture("incident-story-positive.json");
        JsonObject cache = stripExpected(root);
        JsonArray stories = IncidentStoryBuilder.build(cache, null, SETTINGS, FIXTURE_NOW);
        JsonObject expected = root.getAsJsonObject("expected");

        assertEquals(expected.get("story_count").getAsInt(), stories.size());
        assertTrue(stories.size() >= 1);
        JsonObject story = stories.get(0).getAsJsonObject();
        assertTrue(story.getAsJsonArray("events").size() >= expected.get("min_events").getAsInt());

        JsonArray rules = story.getAsJsonArray("rule_matches");
        assertTrue(rules.size() >= 1);
        assertEquals(IncidentStoryBuilder.RULE_BACKUP_AFTER_DOWNTIME, rules.get(0).getAsString());

        String narrative = story.get("narrative").getAsString();
        for (JsonElement el : expected.getAsJsonArray("narrative_contains")) {
            assertTrue(narrative.contains(el.getAsString()), "missing '" + el.getAsString() + "' in: " + narrative);
        }

        boolean hasLag = false;
        boolean hasCrash = false;
        boolean hasBackup = false;
        for (JsonElement el : story.getAsJsonArray("events")) {
            String type = el.getAsJsonObject().get("type").getAsString();
            String tab = el.getAsJsonObject().get("tab_link").getAsString();
            if ("lag_spike".equals(type)) {
                hasLag = true;
                assertEquals("issues", tab);
            }
            if ("crash".equals(type)) {
                hasCrash = true;
                assertEquals("crashes", tab);
            }
            if ("backup_failed".equals(type)) {
                hasBackup = true;
                assertEquals("backups", tab);
            }
        }
        assertTrue(hasLag && hasCrash && hasBackup);
    }

    @Test
    void negativeFixtureProducesNoStory() throws Exception {
        JsonObject root = loadFixture("incident-story-negative.json");
        JsonObject cache = stripExpected(root);
        JsonArray stories = IncidentStoryBuilder.build(cache, null, SETTINGS, FIXTURE_NOW);
        assertEquals(0, stories.size());
    }

    @Test
    void disabledYieldsEmpty() {
        JsonObject cache = new JsonObject();
        JsonObject lag = new JsonObject();
        JsonArray entries = new JsonArray();
        JsonObject entry = new JsonObject();
        entry.addProperty("time", "2026-07-16T20:14:00Z");
        entry.addProperty("incident_id", "x");
        entry.addProperty("title", "Lag");
        JsonObject metrics = new JsonObject();
        metrics.addProperty("mspt", 100);
        metrics.addProperty("tps", 10);
        entry.add("metrics", metrics);
        entries.add(entry);
        lag.add("entries", entries);
        cache.add(OpsCacheSchema.LAG_ISSUES, lag);

        JsonObject crashes = new JsonObject();
        JsonArray crashEntries = new JsonArray();
        JsonObject crash = new JsonObject();
        crash.addProperty("file", "crash.txt");
        crash.addProperty("mtime", Instant.parse("2026-07-16T20:16:00Z").getEpochSecond());
        crash.addProperty("display_label", "NPE");
        crashEntries.add(crash);
        crashes.add("entries", crashEntries);
        cache.add(OpsCacheSchema.CRASHES, crashes);

        IncidentStoryBuilder.Settings off = new IncidentStoryBuilder.Settings(false, 30, 48, 10);
        assertEquals(0, IncidentStoryBuilder.build(cache, null, off, FIXTURE_NOW).size());
    }

    @Test
    void maxStoriesCapsOutput() {
        JsonObject cache = new JsonObject();
        JsonObject lag = new JsonObject();
        JsonArray lagEntries = new JsonArray();
        JsonObject crashes = new JsonObject();
        JsonArray crashEntries = new JsonArray();

        for (int i = 0; i < 5; i++) {
            Instant lagAt = Instant.parse("2026-07-16T12:00:00Z").plusSeconds(i * 3600L);
            Instant crashAt = lagAt.plusSeconds(120);
            JsonObject entry = new JsonObject();
            entry.addProperty("time", lagAt.toString());
            entry.addProperty("incident_id", "lag-" + i);
            entry.addProperty("title", "Lag " + i);
            JsonObject metrics = new JsonObject();
            metrics.addProperty("mspt", 200);
            metrics.addProperty("tps", 5);
            entry.add("metrics", metrics);
            lagEntries.add(entry);

            JsonObject crash = new JsonObject();
            crash.addProperty("file", "crash-" + i + ".txt");
            crash.addProperty("mtime", crashAt.getEpochSecond());
            crash.addProperty("display_label", "Crash " + i);
            crashEntries.add(crash);
        }
        lag.add("entries", lagEntries);
        crashes.add("entries", crashEntries);
        cache.add(OpsCacheSchema.LAG_ISSUES, lag);
        cache.add(OpsCacheSchema.CRASHES, crashes);

        IncidentStoryBuilder.Settings capped = new IncidentStoryBuilder.Settings(true, 30, 48, 2);
        JsonArray stories = IncidentStoryBuilder.build(cache, null, capped, FIXTURE_NOW);
        assertEquals(2, stories.size());
    }

    @Test
    void sameDomainOnlyDoesNotCreateStory() {
        JsonObject cache = new JsonObject();
        JsonObject lag = new JsonObject();
        JsonArray entries = new JsonArray();
        for (int i = 0; i < 3; i++) {
            JsonObject entry = new JsonObject();
            entry.addProperty("time", Instant.parse("2026-07-16T20:00:00Z").plusSeconds(i * 60L).toString());
            entry.addProperty("incident_id", "same-" + i);
            entry.addProperty("title", "Lag " + i);
            JsonObject metrics = new JsonObject();
            metrics.addProperty("mspt", 100 + i);
            metrics.addProperty("tps", 10);
            entry.add("metrics", metrics);
            entries.add(entry);
        }
        lag.add("entries", entries);
        cache.add(OpsCacheSchema.LAG_ISSUES, lag);

        assertEquals(0, IncidentStoryBuilder.build(cache, null, SETTINGS, FIXTURE_NOW).size());
    }

    private static JsonObject loadFixture(String name) throws Exception {
        Path path = Path.of("..", "samples", "fixtures", "ops-cache", name);
        if (!Files.isRegularFile(path)) {
            path = Path.of("samples", "fixtures", "ops-cache", name);
        }
        String text = Files.readString(path.toAbsolutePath().normalize(), StandardCharsets.UTF_8);
        return JsonParser.parseString(text).getAsJsonObject();
    }

    private static JsonObject stripExpected(JsonObject root) {
        JsonObject cache = root.deepCopy();
        cache.remove("expected");
        return cache;
    }
}
