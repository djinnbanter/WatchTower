package dev.mcstatus.watchtower.core.analyze;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import dev.mcstatus.watchtower.core.live.PerformanceRollupWriter;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.temporal.ChronoUnit;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PerformanceInsightEngineTest {

    private static final Gson GSON = new Gson();

    @Test
    void busyQuietHoursFromDiurnalRows() {
        ZonedDateTime weekStart = ZonedDateTime.now(ZoneOffset.UTC)
                .minusDays(7)
                .truncatedTo(ChronoUnit.DAYS);
        List<JsonObject> rows = new java.util.ArrayList<>();
        for (int d = 0; d < 7; d++) {
            for (int h = 0; h < 24; h++) {
                for (int m = 0; m < 12; m++) {
                    ZonedDateTime ts = weekStart.plusDays(d).plusHours(h).plusMinutes(m);
                    boolean busy = h >= 18 || h <= 1;
                    JsonObject row = new JsonObject();
                    row.addProperty("ts", ts.toInstant().toString());
                    row.addProperty("players_max", busy ? 6 : 1);
                    row.addProperty("mspt_avg", busy ? 22.0 : 8.0);
                    row.addProperty("tps_avg", busy ? 18.5 : 19.8);
                    rows.add(row);
                }
            }
        }
        JsonObject out = PerformanceInsightEngine.analyze(rows, "7d", 50, 19.5);
        JsonArray busy = out.getAsJsonObject("busy_quiet").getAsJsonArray("busy_hours");
        assertFalse(busy.isEmpty());
        int topHour = busy.get(0).getAsJsonObject().get("hour_utc").getAsInt();
        assertTrue(topHour >= 18 || topHour <= 1, "expected evening busy hour, got " + topHour);
    }

    @Test
    void stickyLagEpisodeDetected() throws Exception {
        Instant start = Instant.now().minus(2, ChronoUnit.HOURS);
        List<JsonObject> rows = new java.util.ArrayList<>();
        for (int i = 0; i < 30; i++) {
            JsonObject row = new JsonObject();
            row.addProperty("ts", start.plus(i, ChronoUnit.MINUTES).toString());
            row.addProperty("players_max", i < 5 ? 2 : 0);
            row.addProperty("mspt_avg", i < 5 ? 12.0 : 65.0);
            rows.add(row);
        }
        JsonObject out = PerformanceInsightEngine.analyze(rows, "7d", 50, 19.5);
        JsonArray sticky = out.getAsJsonArray("sticky_lag");
        assertFalse(sticky.isEmpty());
        assertTrue(out.getAsJsonArray("insights").size() > 0);
    }

    @Test
    void outlierMinutesWhenIdleAndHighMspt() {
        Instant now = Instant.now();
        List<JsonObject> rows = new java.util.ArrayList<>();
        for (int i = 0; i < 120; i++) {
            JsonObject row = new JsonObject();
            row.addProperty("ts", now.minus(120 - i, ChronoUnit.MINUTES).toString());
            row.addProperty("players_max", 0);
            row.addProperty("mspt_avg", i == 119 ? 80.0 : 6.0);
            rows.add(row);
        }
        JsonObject out = PerformanceInsightEngine.analyze(rows, "7d", 50, 19.5);
        JsonArray outliers = out.getAsJsonArray("outlier_minutes");
        assertFalse(outliers.isEmpty());
        assertTrue(outliers.get(0).getAsJsonObject().get("mspt_avg").getAsDouble() >= 50);
    }

    @Test
    void csvExportIncludesHeaders() {
        JsonObject row = new JsonObject();
        row.addProperty("ts", Instant.now().toString());
        row.addProperty("mspt_avg", 10.5);
        row.addProperty("players_max", 2);
        row.addProperty("low_tps_flag", false);
        String csv = PerformanceInsightEngine.rowsToCsv(List.of(row));
        assertTrue(csv.startsWith("ts,tps_avg,tps_min,mspt_avg"));
        assertTrue(csv.contains("10.5"));
    }

    @Test
    void goldenWeekNormalFixtureLoads() throws Exception {
        Path fixture = Path.of("samples/fixtures/performance-insights/l1-week-normal.json");
        if (!Files.isRegularFile(fixture)) {
            fixture = Path.of("../samples/fixtures/performance-insights/l1-week-normal.json");
        }
        if (!Files.isRegularFile(fixture)) {
            return;
        }
        JsonObject root = JsonParser.parseString(Files.readString(fixture, StandardCharsets.UTF_8)).getAsJsonObject();
        List<JsonObject> rows = new java.util.ArrayList<>();
        for (var el : root.getAsJsonArray("rows")) {
            rows.add(el.getAsJsonObject());
        }
        JsonObject out = PerformanceInsightEngine.analyze(rows, "7d", 50, 19.5);
        assertTrue(out.getAsJsonObject("busy_quiet").getAsJsonArray("busy_hours").size() > 0);
    }

    @Test
    void loadRowsFromFileRoundTrip() throws Exception {
        Path temp = Files.createTempFile("rollups", ".json");
        JsonObject root = new JsonObject();
        root.addProperty("schema", 1);
        root.addProperty("retention_days", 90);
        JsonArray rows = new JsonArray();
        JsonObject row = new JsonObject();
        row.addProperty("ts", Instant.now().toString());
        row.addProperty("mspt_avg", 5.0);
        rows.add(row);
        root.add("rows", rows);
        Files.writeString(temp, GSON.toJson(root), StandardCharsets.UTF_8);
        List<JsonObject> loaded = PerformanceRollupWriter.loadRowsFromFile(temp, 24);
        assertFalse(loaded.isEmpty());
        Files.deleteIfExists(temp);
    }
}
