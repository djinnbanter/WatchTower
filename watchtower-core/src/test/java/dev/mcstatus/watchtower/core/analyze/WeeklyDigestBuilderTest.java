package dev.mcstatus.watchtower.core.analyze;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import dev.mcstatus.watchtower.core.ops.OpsCacheSchema;
import dev.mcstatus.watchtower.core.ops.OpsCacheWriter;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class WeeklyDigestBuilderTest {

    private static final Instant FIXTURE_NOW = Instant.parse("2026-07-28T15:00:00Z");
    private static final WeeklyDigestBuilder.Settings SETTINGS =
            new WeeklyDigestBuilder.Settings(true, 7, 8);

    @TempDir
    Path tempDir;

    @Test
    void positiveFixtureProducesExpectedDigest() throws Exception {
        JsonObject root = loadFixture("weekly-digest-positive.json");
        JsonObject expected = root.getAsJsonObject("expected");
        JsonObject scorecard = root.getAsJsonObject("scorecard");
        List<JsonObject> rows = extractRows(root);
        JsonArray priorHistory = priorHistory(root);
        JsonObject cache = stripMeta(root);

        JsonObject entry = WeeklyDigestBuilder.build(
                cache, scorecard, rows, priorHistory, "auto", SETTINGS, FIXTURE_NOW);
        assertNotNull(entry);

        assertEquals(expected.get("grade").getAsString(), entry.get("grade").getAsString());
        assertEquals(expected.get("grade_trend").getAsString(), entry.get("grade_trend").getAsString());
        assertEquals(
                expected.get("performance_trend").getAsString(),
                entry.getAsJsonObject("performance").get("trend").getAsString());
        assertEquals(expected.get("crash_count").getAsInt(),
                entry.getAsJsonObject("crashes").get("count").getAsInt());
        assertEquals(expected.get("top_mod_id").getAsString(),
                entry.getAsJsonObject("crashes").get("top_mod_id").getAsString());
        assertEquals(expected.get("top_mod_count").getAsInt(),
                entry.getAsJsonObject("crashes").get("top_mod_count").getAsInt());

        String summary = entry.get("summary").getAsString();
        for (JsonElement el : expected.getAsJsonArray("summary_contains")) {
            assertTrue(summary.contains(el.getAsString()),
                    "missing '" + el.getAsString() + "' in: " + summary);
        }
        assertEquals("auto", entry.get("trigger").getAsString());
        assertFalse(entry.get("top_action").isJsonNull());
    }

    @Test
    void sparseFixtureYieldsInsufficientTrendAndNullTopAction() throws Exception {
        JsonObject root = loadFixture("weekly-digest-sparse.json");
        JsonObject expected = root.getAsJsonObject("expected");
        JsonObject scorecard = root.getAsJsonObject("scorecard");
        List<JsonObject> rows = extractRows(root);
        JsonObject cache = stripMeta(root);

        JsonObject entry = WeeklyDigestBuilder.build(
                cache, scorecard, rows, null, "auto", SETTINGS, FIXTURE_NOW);
        assertNotNull(entry);

        assertEquals(expected.get("grade").getAsString(), entry.get("grade").getAsString());
        assertEquals(expected.get("grade_trend").getAsString(), entry.get("grade_trend").getAsString());
        assertEquals(
                expected.get("performance_trend").getAsString(),
                entry.getAsJsonObject("performance").get("trend").getAsString());
        assertEquals(0, entry.getAsJsonObject("crashes").get("count").getAsInt());
        assertTrue(entry.get("top_action").isJsonNull());

        String summary = entry.get("summary").getAsString();
        for (JsonElement el : expected.getAsJsonArray("summary_contains")) {
            assertTrue(summary.contains(el.getAsString()),
                    "missing '" + el.getAsString() + "' in: " + summary);
        }
        if (expected.has("summary_excludes")) {
            for (JsonElement el : expected.getAsJsonArray("summary_excludes")) {
                assertFalse(summary.contains(el.getAsString()),
                        "unexpected '" + el.getAsString() + "' in: " + summary);
            }
        }
    }

    @Test
    void disabledYieldsNull() {
        JsonObject scorecard = new JsonObject();
        scorecard.addProperty("grade", "healthy");
        scorecard.addProperty("grade_word", "Healthy");
        WeeklyDigestBuilder.Settings disabled = new WeeklyDigestBuilder.Settings(false, 7, 8);
        assertNull(WeeklyDigestBuilder.build(
                new JsonObject(), scorecard, List.of(), null, "auto", disabled, FIXTURE_NOW));
    }

    @Test
    void applyWeeklyDigestCapsHistoryNewestFirst() throws Exception {
        Path opsCache = tempDir.resolve("ops-cache.json");
        Path state = tempDir.resolve("state.json");
        Files.writeString(opsCache, "{}\n", StandardCharsets.UTF_8);
        Files.writeString(state, "{}\n", StandardCharsets.UTF_8);

        int historyMax = 3;
        for (int i = 0; i < historyMax + 3; i++) {
            JsonObject entry = new JsonObject();
            entry.addProperty("id", "digest-" + i);
            entry.addProperty("generated_at", Instant.parse("2026-07-0" + (i + 1) + "T15:00:00Z").toString());
            entry.addProperty("summary", "entry " + i);
            OpsCacheWriter.applyWeeklyDigest(opsCache, state, entry, historyMax);
        }

        JsonObject cache = JsonParser.parseString(
                Files.readString(opsCache, StandardCharsets.UTF_8)).getAsJsonObject();
        JsonArray history = cache.getAsJsonObject(OpsCacheSchema.WEEKLY_DIGEST)
                .getAsJsonArray(OpsCacheSchema.WEEKLY_DIGEST_HISTORY);
        assertEquals(historyMax, history.size());
        assertEquals("digest-5", history.get(0).getAsJsonObject().get("id").getAsString());
        assertEquals("digest-4", history.get(1).getAsJsonObject().get("id").getAsString());
        assertEquals("digest-3", history.get(2).getAsJsonObject().get("id").getAsString());
    }

    @Test
    void manualAndAutoTriggersMatchApartFromTrigger() throws Exception {
        JsonObject root = loadFixture("weekly-digest-positive.json");
        JsonObject scorecard = root.getAsJsonObject("scorecard");
        List<JsonObject> rows = extractRows(root);
        JsonArray priorHistory = priorHistory(root);
        JsonObject cache = stripMeta(root);

        JsonObject auto = WeeklyDigestBuilder.build(
                cache, scorecard, rows, priorHistory, "auto", SETTINGS, FIXTURE_NOW);
        JsonObject manual = WeeklyDigestBuilder.build(
                cache, scorecard, rows, priorHistory, "manual", SETTINGS, FIXTURE_NOW);
        assertNotNull(auto);
        assertNotNull(manual);
        assertEquals("auto", auto.get("trigger").getAsString());
        assertEquals("manual", manual.get("trigger").getAsString());

        auto.remove("trigger");
        manual.remove("trigger");
        assertEquals(auto, manual);
    }

    private static JsonObject loadFixture(String name) throws Exception {
        Path path = Path.of("..", "samples", "fixtures", "ops-cache", name);
        if (!Files.isRegularFile(path)) {
            path = Path.of("samples", "fixtures", "ops-cache", name);
        }
        String text = Files.readString(path.toAbsolutePath().normalize(), StandardCharsets.UTF_8);
        return JsonParser.parseString(text).getAsJsonObject();
    }

    private static JsonObject stripMeta(JsonObject root) {
        JsonObject cache = root.deepCopy();
        cache.remove("expected");
        cache.remove("scorecard");
        cache.remove("rollup_rows");
        return cache;
    }

    private static List<JsonObject> extractRows(JsonObject root) {
        List<JsonObject> rows = new ArrayList<>();
        if (root.has("rollup_rows") && root.get("rollup_rows").isJsonArray()) {
            for (JsonElement el : root.getAsJsonArray("rollup_rows")) {
                if (el.isJsonObject()) {
                    rows.add(el.getAsJsonObject());
                }
            }
        }
        return rows;
    }

    private static JsonArray priorHistory(JsonObject root) {
        if (root.has(OpsCacheSchema.WEEKLY_DIGEST)
                && root.get(OpsCacheSchema.WEEKLY_DIGEST).isJsonObject()) {
            JsonObject block = root.getAsJsonObject(OpsCacheSchema.WEEKLY_DIGEST);
            if (block.has(OpsCacheSchema.WEEKLY_DIGEST_HISTORY)
                    && block.get(OpsCacheSchema.WEEKLY_DIGEST_HISTORY).isJsonArray()) {
                return block.getAsJsonArray(OpsCacheSchema.WEEKLY_DIGEST_HISTORY);
            }
        }
        return new JsonArray();
    }
}
