package dev.mcstatus.watchtower.core.analyze;

import com.google.gson.JsonObject;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class PerformanceBaselineTrackerTest {

    @TempDir
    Path tmp;

    @Test
    void percentile_p50_matchesHelper() {
        List<Double> values = List.of(10.0, 20.0, 30.0, 40.0, 100.0);
        assertEquals(30.0, dev.mcstatus.watchtower.core.live.PerformanceRollupAccumulator.p50(new ArrayList<>(values)), 0.01);
    }

    @Test
    void maybeAutoCapture_onlyWhenEmptyAndHealthy() throws Exception {
        Path state = tmp.resolve("state.json");
        List<JsonObject> rows = healthyRows(400, 20.0, 25.0, 40.0);

        assertNull(PerformanceBaselineTracker.maybeAutoCapture(
                state, rows, true, 5, false, 0)); // streak too low

        JsonObject first = PerformanceBaselineTracker.maybeAutoCapture(
                state, rows, true, 400, false, 0);
        assertNotNull(first);
        assertEquals("auto", first.get("source").getAsString());

        JsonObject again = PerformanceBaselineTracker.maybeAutoCapture(
                state, rows, true, 400, false, 0);
        assertNull(again, "must never auto-overwrite an existing baseline");
        assertEquals("auto", PerformanceBaselineTracker.getBaseline(state).get("source").getAsString());
    }

    @Test
    void evaluate_flagsMsptRegressionAtTenPercent() {
        JsonObject baseline = PerformanceBaselineTracker.buildBaselineBlob(
                healthyRows(120, 20.0, 40.0, 50.0), "auto", 24);
        List<JsonObject> degraded = healthyRows(120, 20.0, 48.0, 50.0); // +20% mspt
        JsonObject eval = PerformanceBaselineTracker.evaluate(baseline, degraded, 10.0, null);
        assertTrue(eval.get("active").getAsBoolean());
        assertEquals("mspt_p95", eval.get("worst_metric").getAsString());
        assertTrue(eval.get("worst_delta_pct").getAsDouble() >= 10.0);
    }

    @Test
    void evaluate_quietBelowThreshold() {
        JsonObject baseline = PerformanceBaselineTracker.buildBaselineBlob(
                healthyRows(120, 20.0, 40.0, 50.0), "auto", 24);
        List<JsonObject> mild = healthyRows(120, 20.0, 42.0, 50.0); // +5%
        JsonObject eval = PerformanceBaselineTracker.evaluate(baseline, mild, 10.0, null);
        assertFalse(eval.get("active").getAsBoolean());
    }

    @Test
    void setBaselineNow_setsSourceManual() throws Exception {
        Path state = tmp.resolve("state.json");
        List<JsonObject> rows = healthyRows(100, 20.0, 30.0, 45.0);
        JsonObject saved = PerformanceBaselineTracker.setBaselineNow(state, rows);
        assertEquals("manual", saved.get("source").getAsString());
        assertEquals("manual", PerformanceBaselineTracker.getBaseline(state).get("source").getAsString());
    }

    @Test
    void correlateMods_marksLikelyNearOnset() {
        long onset = Instant.now().minus(3, ChronoUnit.DAYS).getEpochSecond();
        JsonObject inv = new JsonObject();
        JsonObject diff = new JsonObject();
        com.google.gson.JsonArray changed = new com.google.gson.JsonArray();
        JsonObject jar = new JsonObject();
        jar.addProperty("jar", "create-6.0.jar");
        jar.addProperty("mtime", onset);
        changed.add(jar);
        diff.add("changed", changed);
        inv.add("diff", diff);

        JsonObject corr = PerformanceBaselineTracker.correlateMods(
                inv, Instant.ofEpochSecond(onset).toString());
        assertNotNull(corr);
        assertTrue(corr.get("likely").getAsBoolean());
        assertEquals("create-6.0.jar", corr.getAsJsonArray("jars").get(0).getAsString());
    }

    private static List<JsonObject> healthyRows(int minutes, double tps, double mspt, double heap) {
        List<JsonObject> rows = new ArrayList<>();
        Instant now = Instant.now().truncatedTo(ChronoUnit.MINUTES);
        for (int i = minutes - 1; i >= 0; i--) {
            JsonObject row = new JsonObject();
            row.addProperty("ts", now.minus(i, ChronoUnit.MINUTES).toString());
            row.addProperty("tps_avg", tps);
            row.addProperty("mspt_avg", mspt);
            row.addProperty("heap_pressure_pct_avg", heap);
            row.addProperty("players_max", 4);
            rows.add(row);
        }
        return rows;
    }
}
