package dev.mcstatus.watchtower.core.analyze;

import com.google.gson.JsonObject;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class RamSizingAdvisorTest {

    @Test
    void insufficientDataUnderSevenDays() {
        JsonObject stats = new JsonObject();
        stats.addProperty("sufficient_data", false);
        stats.addProperty("span_days", 3.0);
        stats.addProperty("sample_minutes", 100);
        JsonObject out = RamSizingAdvisor.evaluate("7d", stats, 12.0, "live", GcAdvisor.VERDICT_HEALTHY);
        assertEquals(RamSizingAdvisor.VERDICT_INSUFFICIENT, out.get("verdict").getAsString());
        assertFalse(out.get("ram_upgrade_blocked").getAsBoolean());
    }

    @Test
    void overProvisionedWhenClearlyIdle() {
        JsonObject stats = baseStats(5.0, 30.0);
        JsonObject out = RamSizingAdvisor.evaluate("7d", stats, 12.0, "live", GcAdvisor.VERDICT_HEALTHY);
        assertEquals(RamSizingAdvisor.VERDICT_OVER, out.get("verdict").getAsString());
        assertTrue(out.has("suggested_xmx_gb_min"));
        assertTrue(out.get("advice").getAsString().contains("busy week"));
    }

    @Test
    void borderlineStaysRightSized() {
        // peak 7 of 12 (~58%) — above conservative 50% bar
        JsonObject stats = baseStats(7.0, 40.0);
        JsonObject out = RamSizingAdvisor.evaluate("7d", stats, 12.0, "live", GcAdvisor.VERDICT_HEALTHY);
        assertEquals(RamSizingAdvisor.VERDICT_RIGHT, out.get("verdict").getAsString());
        assertFalse(out.has("suggested_xmx_gb_min"));
    }

    @Test
    void underProvisionedOnHighPressure() {
        JsonObject stats = baseStats(11.0, 92.0);
        JsonObject out = RamSizingAdvisor.evaluate("7d", stats, 12.0, "live", GcAdvisor.VERDICT_HEAP_BOUND);
        assertEquals(RamSizingAdvisor.VERDICT_UNDER, out.get("verdict").getAsString());
        assertTrue(out.has("suggested_xmx_gb_min"));
    }

    @Test
    void singleThreadBlocksRamUpgrade() {
        JsonObject stats = baseStats(11.0, 92.0);
        JsonObject out = RamSizingAdvisor.evaluate(
                "7d", stats, 12.0, "live", GcAdvisor.VERDICT_SINGLE_THREAD);
        assertTrue(out.get("ram_upgrade_blocked").getAsBoolean());
        assertEquals(RamSizingAdvisor.VERDICT_RIGHT, out.get("verdict").getAsString());
        assertFalse(out.has("suggested_xmx_gb_min"));
        assertTrue(out.get("advice").getAsString().toLowerCase().contains("more ram will not"));
    }

    @Test
    void gcBoundBlocksRamUpgradeWhenHeapNotFull() {
        JsonObject stats = baseStats(6.0, 40.0);
        JsonObject out = RamSizingAdvisor.evaluate(
                "7d", stats, 12.0, "live", GcAdvisor.VERDICT_GC_BOUND);
        assertTrue(out.get("ram_upgrade_blocked").getAsBoolean());
        assertFalse(out.has("suggested_xmx_gb_min"));
        assertTrue(out.get("advice").getAsString().contains("Configs"));
    }

    @Test
    void buildRamSizingStatsMarksSufficientAfterSevenDays() {
        Instant now = Instant.now();
        List<JsonObject> rows = new ArrayList<>();
        for (int i = 0; i < 8 * 24 * 60; i += 30) {
            JsonObject row = new JsonObject();
            row.addProperty("ts", now.minus(8L * 24 * 60 - i, ChronoUnit.MINUTES).toString());
            row.addProperty("heap_used_gb_avg", 5.0);
            row.addProperty("heap_used_gb_max", 5.5);
            row.addProperty("heap_pressure_pct_avg", 40.0);
            row.addProperty("mspt_avg", 20.0);
            rows.add(row);
        }
        JsonObject stats = PerformanceInsightEngine.buildRamSizingStats(rows);
        assertTrue(stats.get("sufficient_data").getAsBoolean());
        assertTrue(stats.get("span_days").getAsDouble() >= 7.0);
        assertEquals(5.5, stats.get("heap_used_gb_peak").getAsDouble(), 0.01);
    }

    @Test
    void dashboardIncludesRamSizingWithLiveXmx() {
        Instant now = Instant.now();
        List<JsonObject> rows = new ArrayList<>();
        // 10 days so the 7d window split still has ≥7d span
        for (int i = 0; i < 10 * 24 * 60; i += 60) {
            JsonObject row = new JsonObject();
            row.addProperty("ts", now.minus(10L * 24 * 60 - i, ChronoUnit.MINUTES).toString());
            row.addProperty("heap_used_gb_avg", 4.0);
            row.addProperty("heap_used_gb_max", 4.5);
            row.addProperty("heap_pressure_pct_avg", 28.0);
            row.addProperty("heap_pressure_pct_max", 32.0);
            row.addProperty("gc_pause_pct_avg", 1.0);
            row.addProperty("mspt_avg", 18.0);
            row.addProperty("mspt_p95", 22.0);
            row.addProperty("tps_avg", 20.0);
            row.addProperty("players_max", 2);
            rows.add(row);
        }
        PerformanceContext ctx = new PerformanceContext(null, List.of(), null, 0, 12.0, "live");
        JsonObject dash = PerformanceDashboardBuilder.build(rows, "7d", 50, 19.5, ctx);
        assertTrue(dash.has("ram_sizing"));
        JsonObject ram = dash.getAsJsonObject("ram_sizing");
        assertEquals("live", ram.get("xmx_source").getAsString());
        assertEquals(12.0, ram.get("xmx_gb").getAsDouble(), 0.01);
        assertEquals("window", ram.get("gc_verdict_source").getAsString());
        assertTrue(ram.get("sufficient_data").getAsBoolean(),
                "span_days=" + ram.get("span_days"));
        assertEquals(RamSizingAdvisor.VERDICT_OVER, ram.get("verdict").getAsString());
    }

    private static JsonObject baseStats(double peakGb, double pressureP95) {
        JsonObject stats = new JsonObject();
        stats.addProperty("sufficient_data", true);
        stats.addProperty("span_days", 7.5);
        stats.addProperty("sample_minutes", 10000);
        stats.addProperty("heap_used_gb_avg", peakGb * 0.9);
        stats.addProperty("heap_used_gb_p95", peakGb);
        stats.addProperty("heap_used_gb_peak", peakGb);
        stats.addProperty("heap_pressure_pct_avg", pressureP95 * 0.9);
        stats.addProperty("heap_pressure_pct_p95", pressureP95);
        return stats;
    }
}
