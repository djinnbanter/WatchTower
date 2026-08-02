package dev.mcstatus.watchtower.core.analyze;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class WorldPressureAnalyzerTest {

    @Test
    void itemStormRaisesOnlyAfterSustainedScans() throws Exception {
        JsonObject fixture = load("item-storm.json");
        JsonObject census = fixture.getAsJsonObject("census");
        JsonObject baseline = richBaseline();
        JsonObject streaks = new JsonObject();

        WorldPressureAnalyzer.ClassifyResult r1 = WorldPressureAnalyzer.classify(
                census, baseline, streaks, false, false);
        assertEquals(0, r1.classifiers().size(), "scan 1 should not emit yet");
        streaks = r1.streaks();

        WorldPressureAnalyzer.ClassifyResult r2 = WorldPressureAnalyzer.classify(
                census, baseline, streaks, false, false);
        assertEquals(0, r2.classifiers().size(), "scan 2 should not emit yet");
        streaks = r2.streaks();

        WorldPressureAnalyzer.ClassifyResult r3 = WorldPressureAnalyzer.classify(
                census, baseline, streaks, false, false);
        assertTrue(r3.classifiers().size() >= 1);
        assertTrue(hasKind(r3.classifiers(), "item_storm"));
        assertFalse(detailMentionsModId(r3.classifiers()));
    }

    @Test
    void busyBaselineUsesBusyHourRows() {
        // Hours 18-20: high players + high entities; hours 3-5: low players + low entities
        List<JsonObject> rows = new ArrayList<>();
        for (int day = 0; day < 2; day++) {
            for (int hour = 0; hour < 24; hour++) {
                for (int m = 0; m < 30; m++) {
                    JsonObject row = new JsonObject();
                    row.addProperty("ts", String.format("2026-07-%02dT%02d:%02d:00Z", 27 + day, hour, m));
                    boolean busy = hour >= 18 && hour <= 20;
                    row.addProperty("players_max", busy ? 12 : 1);
                    row.addProperty("mspt_avg", busy ? 40.0 : 20.0);
                    row.addProperty("entities_max", busy ? 5000 : 800);
                    row.addProperty("chunks_max", busy ? 900 : 200);
                    rows.add(row);
                }
            }
        }
        JsonObject busy = WorldPressureAnalyzer.busyBaseline(rows);
        assertTrue(busy.get("sample_minutes").getAsInt() > 0);
        assertEquals(5000.0, busy.get("entities_p95").getAsDouble(), 0.1);
        assertTrue(busy.has("hours_utc"));
        assertTrue(busy.getAsJsonArray("hours_utc").size() > 0);

        JsonObject quiet = WorldPressureAnalyzer.quietBaseline(rows);
        assertTrue(quiet.get("entities_p95").getAsDouble() < busy.get("entities_p95").getAsDouble());
    }

    @Test
    void windowPeakTracksMaxEntitiesAndChunks() {
        List<JsonObject> rows = new ArrayList<>();
        JsonObject low = new JsonObject();
        low.addProperty("ts", "2026-07-28T10:00:00Z");
        low.addProperty("entities_max", 100);
        low.addProperty("chunks_max", 50);
        rows.add(low);
        JsonObject peakE = new JsonObject();
        peakE.addProperty("ts", "2026-07-28T18:30:00Z");
        peakE.addProperty("entities_max", 7777);
        peakE.addProperty("chunks_max", 100);
        rows.add(peakE);
        JsonObject peakC = new JsonObject();
        peakC.addProperty("ts", "2026-07-28T19:00:00Z");
        peakC.addProperty("entities_max", 200);
        peakC.addProperty("chunks_max", 888);
        rows.add(peakC);

        JsonObject peak = WorldPressureAnalyzer.windowPeak(rows);
        assertEquals(7777.0, peak.get("entities_max").getAsDouble(), 0.1);
        assertEquals("2026-07-28T18:30:00Z", peak.get("entities_at").getAsString());
        assertEquals(888.0, peak.get("chunks_max").getAsDouble(), 0.1);
        assertEquals("2026-07-28T19:00:00Z", peak.get("chunks_at").getAsString());
    }

    @Test
    void compareBaselinesIncludesQuietBusyPeakAndLabelsWindow() {
        List<JsonObject> rows = new ArrayList<>();
        for (int i = 0; i < 120; i++) {
            JsonObject row = new JsonObject();
            row.addProperty("ts", String.format("2026-07-28T%02d:00:00Z", i % 24));
            row.addProperty("players_max", i % 24 >= 18 ? 10 : 1);
            row.addProperty("mspt_avg", 25.0);
            row.addProperty("entities_max", 1000 + i);
            row.addProperty("chunks_max", 300);
            rows.add(row);
        }
        JsonObject cmp = WorldPressureAnalyzer.compareBaselines(rows, "30d");
        assertEquals("30d", cmp.get("window").getAsString());
        assertTrue(cmp.has("quiet"));
        assertTrue(cmp.has("busy"));
        assertTrue(cmp.has("peak"));
        assertTrue(cmp.get("method").getAsString().contains("quiet=p95"));
        assertEquals(1000 + 119, cmp.getAsJsonObject("peak").get("entities_max").getAsDouble(), 0.1);
    }

    @Test
    void quietNormalRaisesNothing() throws Exception {
        JsonObject fixture = load("quiet-normal.json");
        JsonObject census = fixture.getAsJsonObject("census");
        JsonObject baseline = richBaseline();
        JsonObject streaks = new JsonObject();
        for (int i = 0; i < 5; i++) {
            WorldPressureAnalyzer.ClassifyResult r = WorldPressureAnalyzer.classify(
                    census, baseline, streaks, false, false);
            streaks = r.streaks();
            assertEquals(0, r.classifiers().size(), "quiet normal must not classify");
        }
    }

    @Test
    void unattendedChunksDoNotRaiseClassifier() throws Exception {
        JsonObject fixture = load("unattended-chunks.json");
        JsonObject census = fixture.getAsJsonObject("census");
        JsonObject baseline = richBaseline();
        JsonObject streaks = new JsonObject();
        WorldPressureAnalyzer.ClassifyResult last = null;
        for (int i = 0; i < 5; i++) {
            last = WorldPressureAnalyzer.classify(census, baseline, streaks, false, false);
            streaks = last.streaks();
        }
        assertNotNull(last);
        assertFalse(hasKind(last.classifiers(), "unattended_chunk_pressure"));
        assertEquals(0, last.classifiers().size());
    }

    @Test
    void learningSuppressesMobSpike() throws Exception {
        JsonObject fixture = load("mob-spike.json");
        JsonObject census = fixture.getAsJsonObject("census");
        JsonObject thin = new JsonObject();
        thin.addProperty("entities_p50", 500);
        thin.addProperty("entities_p95", 800);
        thin.addProperty("chunks_p95", 200);
        thin.addProperty("sample_minutes", 40); // < LEARNING_MIN_MINUTES
        JsonObject streaks = new JsonObject();
        WorldPressureAnalyzer.ClassifyResult last = null;
        for (int i = 0; i < 5; i++) {
            last = WorldPressureAnalyzer.classify(census, thin, streaks, true, false);
            streaks = last.streaks();
        }
        assertNotNull(last);
        assertFalse(hasKind(last.classifiers(), "mob_spike"));
    }

    @Test
    void correlationFalseWhenEntitiesRiseWithoutMspt() {
        List<JsonObject> rows = new ArrayList<>();
        for (int i = 0; i < 240; i++) {
            JsonObject row = new JsonObject();
            row.addProperty("ts", "2026-07-28T" + String.format("%02d", i % 24) + ":00:00Z");
            row.addProperty("entities_max", i < 60 ? 200 : (i >= 180 ? 5000 : 1000));
            row.addProperty("mspt_p95", 25.0); // flat MSPT
            rows.add(row);
        }
        JsonObject corr = WorldPressureAnalyzer.correlation(rows, 40.0);
        assertFalse(corr.get("correlated").getAsBoolean());
    }

    @Test
    void analyzeSetsLearningWhenThinRollups() throws Exception {
        JsonObject fixture = load("item-storm.json");
        JsonObject out = WorldPressureAnalyzer.analyze(
                fixture.getAsJsonObject("census"), List.of(), null, 40.0);
        assertTrue(out.get("learning").getAsBoolean());
        assertTrue(out.has("dimensions"));
        assertTrue(out.has("classifiers"));
    }

    @Test
    void dimensionLabels() {
        assertEquals("Overworld", WorldPressureAnalyzer.dimensionLabel("minecraft:overworld"));
        assertEquals("Nether", WorldPressureAnalyzer.dimensionLabel("minecraft:the_nether"));
        assertEquals("The End", WorldPressureAnalyzer.dimensionLabel("minecraft:the_end"));
        assertEquals("Mining", WorldPressureAnalyzer.dimensionLabel("create:mining"));
    }

    private static JsonObject richBaseline() {
        JsonObject b = new JsonObject();
        b.addProperty("entities_p50", 1200);
        b.addProperty("entities_p95", 1900);
        b.addProperty("chunks_p95", 320);
        b.addProperty("sample_minutes", 640);
        return b;
    }

    private static boolean hasKind(JsonArray classifiers, String kind) {
        for (JsonElement el : classifiers) {
            if (el.isJsonObject() && kind.equals(el.getAsJsonObject().get("kind").getAsString())) {
                return true;
            }
        }
        return false;
    }

    private static boolean detailMentionsModId(JsonArray classifiers) {
        for (JsonElement el : classifiers) {
            if (!el.isJsonObject()) {
                continue;
            }
            JsonObject c = el.getAsJsonObject();
            String detail = c.has("detail") ? c.get("detail").getAsString() : "";
            String headline = c.has("headline") ? c.get("headline").getAsString() : "";
            // Copy must not blame a random mod id (e.g. "create:" as a culprit)
            if (detail.matches("(?i).*\\bmod\\s+id\\b.*") || headline.matches("(?i).*blame.*mod.*")) {
                return true;
            }
        }
        return false;
    }

    private static JsonObject load(String name) throws Exception {
        Path cwd = Path.of("").toAbsolutePath();
        Path[] candidates = {
                cwd.resolve("samples/fixtures/world-pressure").resolve(name),
                cwd.resolve("../samples/fixtures/world-pressure").resolve(name),
                cwd.resolve("../../samples/fixtures/world-pressure").resolve(name),
        };
        for (Path c : candidates) {
            if (Files.isRegularFile(c)) {
                return JsonParser.parseString(Files.readString(c)).getAsJsonObject();
            }
        }
        throw new IllegalStateException("Fixture not found: " + name + " (cwd=" + cwd + ")");
    }
}
