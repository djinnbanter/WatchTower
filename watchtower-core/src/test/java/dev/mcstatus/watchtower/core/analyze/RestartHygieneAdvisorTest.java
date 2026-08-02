package dev.mcstatus.watchtower.core.analyze;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class RestartHygieneAdvisorTest {

    private static final String NOW = "2026-07-28T19:00:00Z";

    @Test
    void lowUptimeIsSuppressed() {
        JsonObject out = RestartHygieneAdvisor.evaluate(baseInput(20 * 3600, risingGcStats(), priorGcStats(), quietHours()));
        assertFalse(out.get("active").getAsBoolean());
        assertEquals("low_uptime", out.get("suppressed_reason").getAsString());
    }

    @Test
    void healthyLongUptimeIsSuppressed() {
        JsonObject cur = stats(720, 2.0, 60.0);
        JsonObject prior = stats(720, 2.1, 59.0);
        JsonObject out = RestartHygieneAdvisor.evaluate(baseInput(40 * 3600, cur, prior, quietHours()));
        assertFalse(out.get("active").getAsBoolean());
        assertEquals("healthy_metrics", out.get("suppressed_reason").getAsString());
    }

    @Test
    void risingGcSuggestsRestart() {
        JsonObject out = RestartHygieneAdvisor.evaluate(
                baseInput(38 * 3600, risingGcStats(), priorGcStats(), quietHours()));
        assertTrue(out.get("active").getAsBoolean());
        assertEquals("info", out.get("severity").getAsString());
        assertEquals("Consider a maintenance restart", out.get("headline").getAsString());
        assertTrue(out.has("quiet_window"));
        assertTrue(out.getAsJsonArray("signals").size() > 0);
        String json = out.toString().toLowerCase();
        assertFalse(json.contains("will restart") || json.contains("auto-restart")
                || json.contains("restarting now"));
    }

    @Test
    void highHeapSuggestsRestart() {
        JsonObject cur = stats(720, 2.0, 88.0);
        JsonObject prior = stats(720, 2.0, 70.0);
        JsonObject out = RestartHygieneAdvisor.evaluate(baseInput(40 * 3600, cur, prior, quietHours()));
        assertTrue(out.get("active").getAsBoolean());
        assertEquals("info", out.get("severity").getAsString());
    }

    @Test
    void risingHeapWithoutSoftThresholdSuggests() {
        JsonObject cur = stats(720, 2.0, 75.0);
        JsonObject prior = stats(720, 2.0, 60.0);
        JsonObject out = RestartHygieneAdvisor.evaluate(baseInput(40 * 3600, cur, prior, quietHours()));
        assertTrue(out.get("active").getAsBoolean());
    }

    @Test
    void warningWhenGcOrHeapSevere() {
        JsonObject cur = stats(720, 12.0, 70.0);
        JsonObject prior = stats(720, 5.0, 68.0);
        JsonObject out = RestartHygieneAdvisor.evaluate(baseInput(40 * 3600, cur, prior, quietHours()));
        assertTrue(out.get("active").getAsBoolean());
        assertEquals("warning", out.get("severity").getAsString());
    }

    @Test
    void adjacentQuietPairPreferred() {
        JsonArray hours = new JsonArray();
        // Tuesday=2 in ISO (getValue%7): 2026-07-28 is Tuesday -> ISO 2 % 7 = 2
        // Wednesday=3 for next day 03:00–05:00
        hours.add(cell(3, 3, 0.1, 20, 40));
        hours.add(cell(3, 4, 0.2, 22, 40));
        hours.add(cell(3, 5, 5.0, 40, 40));
        JsonObject quiet = RestartHygieneAdvisor.findNextQuietWindow(
                hours, java.time.Instant.parse(NOW));
        assertEquals("2026-07-29T03:00:00Z", quiet.get("next_start_at").getAsString());
        assertEquals("2026-07-29T05:00:00Z", quiet.get("next_end_at").getAsString());
    }

    @Test
    void singleHourFallbackWhenNoAdjacentPair() {
        JsonArray hours = new JsonArray();
        hours.add(cell(3, 3, 0.1, 20, 40));
        hours.add(cell(3, 6, 0.5, 22, 40));
        JsonObject quiet = RestartHygieneAdvisor.findNextQuietWindow(
                hours, java.time.Instant.parse(NOW));
        assertEquals("2026-07-29T03:00:00Z", quiet.get("next_start_at").getAsString());
        assertEquals("2026-07-29T04:00:00Z", quiet.get("next_end_at").getAsString());
    }

    @Test
    void nextWeekRollover() {
        // Now Friday 23:00; only Sunday hour available
        JsonArray hours = new JsonArray();
        hours.add(cell(0, 4, 0.1, 18, 30)); // Sunday UTC
        JsonObject quiet = RestartHygieneAdvisor.findNextQuietWindow(
                hours, java.time.Instant.parse("2026-07-31T23:00:00Z"));
        assertEquals("2026-08-02T04:00:00Z", quiet.get("next_start_at").getAsString());
    }

    @Test
    void insufficientSamplesSuppress() {
        JsonObject cur = stats(50, 5.0, 90.0);
        JsonObject prior = stats(50, 2.0, 60.0);
        JsonObject out = RestartHygieneAdvisor.evaluate(baseInput(40 * 3600, cur, prior, quietHours()));
        assertFalse(out.get("active").getAsBoolean());
        assertEquals("insufficient_metrics", out.get("suppressed_reason").getAsString());
    }

    @Test
    void disabledSuppress() {
        JsonObject in = baseInput(40 * 3600, risingGcStats(), priorGcStats(), quietHours());
        in.addProperty("enabled", false);
        JsonObject out = RestartHygieneAdvisor.evaluate(in);
        assertEquals("disabled", out.get("suppressed_reason").getAsString());
    }

    private static JsonObject baseInput(long uptimeSec, JsonObject cur, JsonObject prior, JsonArray hours) {
        JsonObject in = new JsonObject();
        in.addProperty("enabled", true);
        in.addProperty("now", NOW);
        in.addProperty("uptime_sec", uptimeSec);
        in.add("current_stats", cur);
        in.add("prior_stats", prior);
        in.add("hour_of_week", hours);
        return in;
    }

    private static JsonObject stats(int samples, double gc, double heapP95) {
        JsonObject o = new JsonObject();
        o.addProperty("sample_minutes", samples);
        o.addProperty("gc_pause_pct_avg", gc);
        o.addProperty("heap_pressure_pct_p95", heapP95);
        return o;
    }

    private static JsonObject risingGcStats() {
        return stats(720, 4.2, 71.0);
    }

    private static JsonObject priorGcStats() {
        return stats(720, 2.8, 69.0);
    }

    private static JsonArray quietHours() {
        JsonArray a = new JsonArray();
        a.add(cell(3, 3, 0.2, 24.0, 42));
        a.add(cell(3, 4, 0.2, 24.0, 42));
        return a;
    }

    private static JsonObject cell(int dow, int hour, double players, double mspt, int samples) {
        JsonObject o = new JsonObject();
        o.addProperty("dow", dow);
        o.addProperty("hour_utc", hour);
        o.addProperty("avg_players", players);
        o.addProperty("avg_mspt", mspt);
        o.addProperty("sample_minutes", samples);
        return o;
    }
}
