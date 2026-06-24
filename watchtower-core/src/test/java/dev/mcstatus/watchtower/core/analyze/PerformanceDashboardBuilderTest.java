package dev.mcstatus.watchtower.core.analyze;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import dev.mcstatus.watchtower.core.ops.OpsCacheSchema;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PerformanceDashboardBuilderTest {

    @Test
    void hourOfWeekBucketsDiurnalData() {
        ZonedDateTime weekStart = ZonedDateTime.now(ZoneOffset.UTC).minusDays(7).truncatedTo(ChronoUnit.DAYS);
        List<JsonObject> rows = new ArrayList<>();
        for (int d = 0; d < 7; d++) {
            for (int h = 0; h < 24; h++) {
                for (int m = 0; m < 12; m++) {
                    ZonedDateTime ts = weekStart.plusDays(d).plusHours(h).plusMinutes(m);
                    boolean busy = h >= 18 || h <= 1;
                    JsonObject row = new JsonObject();
                    row.addProperty("ts", ts.toInstant().toString());
                    row.addProperty("players_max", busy ? 6 : 1);
                    row.addProperty("mspt_avg", busy ? 22.0 : 8.0);
                    row.addProperty("tps_avg", 19.5);
                    rows.add(row);
                }
            }
        }
        JsonArray heat = PerformanceInsightEngine.buildHourOfWeek(rows);
        assertFalse(heat.isEmpty());
        boolean hasBusyCell = false;
        for (int i = 0; i < heat.size(); i++) {
            JsonObject cell = heat.get(i).getAsJsonObject();
            if (cell.get("hour_utc").getAsInt() == 19 && cell.get("avg_players").getAsDouble() >= 5) {
                hasBusyCell = true;
            }
        }
        assertTrue(hasBusyCell);
    }

    @Test
    void periodCompareShowsDelta() {
        Instant now = Instant.now();
        List<JsonObject> all = new ArrayList<>();
        int totalMinutes = 14 * 24 * 60;
        for (int i = 0; i < totalMinutes; i++) {
            JsonObject row = new JsonObject();
            row.addProperty("ts", now.minus(totalMinutes - 1L - i, ChronoUnit.MINUTES).toString());
            boolean currentWeek = i >= 7 * 24 * 60;
            row.addProperty("mspt_avg", currentWeek ? 30.0 : 10.0);
            row.addProperty("players_max", 2);
            row.addProperty("tps_avg", 19.0);
            all.add(row);
        }
        JsonObject dash = PerformanceDashboardBuilder.build(all, "7d", 50, 19.5, null);
        JsonObject compare = dash.getAsJsonObject("period_compare");
        assertTrue(compare.has("deltas"));
        JsonObject msptDelta = compare.getAsJsonObject("deltas").getAsJsonObject("mspt_avg");
        assertTrue(msptDelta != null && msptDelta.get("delta").getAsDouble() > 0);
    }

    @Test
    void relatedEventsFromOpsCache() {
        JsonObject ops = new JsonObject();
        JsonObject activity = new JsonObject();
        JsonArray events = new JsonArray();
        JsonObject spike = new JsonObject();
        spike.addProperty(OpsCacheSchema.EVENT_TIME, Instant.now().minus(1, ChronoUnit.HOURS).toString());
        spike.addProperty(OpsCacheSchema.EVENT_TYPE, "performance_spike");
        spike.addProperty(OpsCacheSchema.EVENT_DETAIL, "Sticky lag");
        events.add(spike);
        activity.add(OpsCacheSchema.ACTIVITY_EVENTS, events);
        ops.add(OpsCacheSchema.ACTIVITY, activity);

        long start = Instant.now().minus(7, ChronoUnit.DAYS).getEpochSecond();
        PerformanceContext ctx = new PerformanceContext(ops, List.of(), null, start);
        JsonArray related = PerformanceContextMerger.buildRelatedEvents(ctx);
        assertFalse(related.isEmpty());
        assertTrue("performance_spike".equals(related.get(0).getAsJsonObject().get("type").getAsString()));
    }

    @Test
    void goldenDashboardFromFixture() throws Exception {
        Path fixture = Path.of("samples/fixtures/performance-insights/l1-week-normal.json");
        if (!Files.isRegularFile(fixture)) {
            fixture = Path.of("../samples/fixtures/performance-insights/l1-week-normal.json");
        }
        if (!Files.isRegularFile(fixture)) {
            return;
        }
        JsonObject root = JsonParser.parseString(Files.readString(fixture, StandardCharsets.UTF_8)).getAsJsonObject();
        List<JsonObject> rows = new ArrayList<>();
        for (var el : root.getAsJsonArray("rows")) {
            rows.add(el.getAsJsonObject());
        }
        JsonObject dash = PerformanceDashboardBuilder.build(rows, "7d", 50, 19.5, null);
        assertTrue(dash.getAsJsonArray("hour_of_week").size() > 0);
        assertTrue(dash.getAsJsonArray("insights").size() > 0);
        assertTrue(dash.has("summary_extended"));
    }

    @Test
    void periodCompareIncludesPlayersPeak() {
        Instant now = Instant.now();
        List<JsonObject> all = new ArrayList<>();
        int totalMinutes = 14 * 24 * 60;
        for (int i = 0; i < totalMinutes; i++) {
            JsonObject row = new JsonObject();
            row.addProperty("ts", now.minus(totalMinutes - 1L - i, ChronoUnit.MINUTES).toString());
            boolean currentWeek = i >= 7 * 24 * 60;
            row.addProperty("mspt_avg", 12.0);
            row.addProperty("players_max", currentWeek ? 8 : 2);
            row.addProperty("tps_avg", 19.0);
            all.add(row);
        }
        JsonObject dash = PerformanceDashboardBuilder.build(all, "7d", 50, 19.5, null);
        JsonObject peakDelta = dash.getAsJsonObject("period_compare")
                .getAsJsonObject("deltas")
                .getAsJsonObject("players_peak");
        assertTrue(peakDelta != null && peakDelta.get("delta").getAsDouble() > 0);
    }

    @Test
    void outlierMinutesIncludeMemWhenPresent() {
        Instant now = Instant.now();
        List<JsonObject> rows = new ArrayList<>();
        for (int i = 0; i < 7 * 24 * 60; i++) {
            JsonObject row = new JsonObject();
            row.addProperty("ts", now.minus(7L * 24 * 60 - i, ChronoUnit.MINUTES).toString());
            row.addProperty("players_max", 0);
            row.addProperty("mspt_avg", i == 100 ? 72.0 : 8.0);
            row.addProperty("tps_avg", 19.0);
            if (i == 100) {
                row.addProperty("mem_used_gb_avg", 14.1);
            }
            rows.add(row);
        }
        JsonObject dash = PerformanceDashboardBuilder.build(rows, "7d", 50, 19.5, null);
        JsonArray outliers = dash.getAsJsonArray("outlier_minutes");
        assertFalse(outliers.isEmpty());
        boolean hasMem = false;
        for (int i = 0; i < outliers.size(); i++) {
            JsonObject o = outliers.get(i).getAsJsonObject();
            if (o.has("mem_used_gb_avg")) {
                hasMem = true;
                assertEquals(14.1, o.get("mem_used_gb_avg").getAsDouble(), 0.01);
            }
        }
        assertTrue(hasMem);
    }

    @Test
    void lagEventsClusterInBusyHourCorrelation() {
        ZonedDateTime weekStart = ZonedDateTime.now(ZoneOffset.UTC).minusDays(14).truncatedTo(ChronoUnit.DAYS);
        List<JsonObject> rows = new ArrayList<>();
        for (int d = 0; d < 14; d++) {
            for (int h = 0; h < 24; h++) {
                for (int m = 0; m < 60; m++) {
                    ZonedDateTime ts = weekStart.plusDays(d).plusHours(h).plusMinutes(m);
                    JsonObject row = new JsonObject();
                    row.addProperty("ts", ts.toInstant().toString());
                    row.addProperty("players_max", h >= 18 ? 6 : 1);
                    row.addProperty("mspt_avg", h >= 18 ? 22.0 : 8.0);
                    row.addProperty("tps_avg", 19.5);
                    rows.add(row);
                }
            }
        }

        JsonObject ops = new JsonObject();
        JsonObject activity = new JsonObject();
        JsonArray events = new JsonArray();
        Instant lagAt = weekStart.plusDays(10).plusHours(19).plusMinutes(5).toInstant();
        for (int i = 0; i < 3; i++) {
            JsonObject lag = new JsonObject();
            lag.addProperty(OpsCacheSchema.EVENT_TIME, lagAt.minus(i, ChronoUnit.MINUTES).toString());
            lag.addProperty(OpsCacheSchema.EVENT_TYPE, "tick_lag");
            lag.addProperty(OpsCacheSchema.EVENT_DETAIL, "Can't keep up!");
            events.add(lag);
        }
        activity.add(OpsCacheSchema.ACTIVITY_EVENTS, events);
        ops.add(OpsCacheSchema.ACTIVITY, activity);

        long windowStart = Instant.now().minus(7, ChronoUnit.DAYS).getEpochSecond();
        PerformanceContext ctx = new PerformanceContext(ops, List.of(), null, windowStart);
        JsonObject dash = PerformanceDashboardBuilder.build(rows, "7d", 50, 19.5, ctx);

        JsonArray correlations = dash.getAsJsonArray("correlations");
        boolean found = false;
        for (int i = 0; i < correlations.size(); i++) {
            if ("lag_busy_hours".equals(correlations.get(i).getAsJsonObject().get("id").getAsString())) {
                found = true;
            }
        }
        assertTrue(found);
    }
}
