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
    void playerBinsScaleToObservedPeakMedium() {
        Instant now = Instant.now();
        List<JsonObject> rows = new java.util.ArrayList<>();
        int[] counts = {0, 0, 1, 2, 3, 4, 5, 6, 7};
        for (int i = 0; i < counts.length; i++) {
            JsonObject row = new JsonObject();
            row.addProperty("ts", now.minus(counts.length - i, ChronoUnit.MINUTES).toString());
            row.addProperty("players_max", counts[i]);
            row.addProperty("mspt_avg", 8.0 + counts[i] * 2);
            row.addProperty("tps_avg", 20.0 - counts[i] * 0.1);
            rows.add(row);
        }
        JsonObject out = PerformanceInsightEngine.analyze(rows, "7d", 50, 19.5);
        assertTrue(out.get("players_band_scale").getAsInt() == 7);
        assertTrue("observed_peak".equals(out.get("players_band_scale_source").getAsString()));
        JsonArray bins = out.getAsJsonArray("player_bins");
        java.util.Set<String> labels = new java.util.LinkedHashSet<>();
        for (var el : bins) {
            labels.add(el.getAsJsonObject().get("players_band").getAsString());
        }
        assertTrue(labels.contains("0"));
        assertTrue(labels.contains("1-2"));
        assertTrue(labels.contains("3-4"));
        assertTrue(labels.contains("5-7"));
        assertFalse(labels.contains("6+"));
    }

    @Test
    void playerBinsScaleToObservedPeakLarge() {
        int[][] ranges = PerformanceInsightEngine.occupiedPlayerRanges(40);
        assertTrue(ranges.length == 3);
        assertTrue(ranges[0][0] == 1 && ranges[0][1] == 13);
        assertTrue(ranges[1][0] == 14 && ranges[1][1] == 26);
        assertTrue(ranges[2][0] == 27 && ranges[2][1] == 40);

        Instant now = Instant.now();
        List<JsonObject> rows = new java.util.ArrayList<>();
        for (int p : new int[]{0, 5, 20, 40}) {
            JsonObject row = new JsonObject();
            row.addProperty("ts", now.minus(p + 1, ChronoUnit.MINUTES).toString());
            row.addProperty("players_max", p);
            row.addProperty("mspt_avg", 10.0 + p);
            row.addProperty("tps_avg", 19.5);
            rows.add(row);
        }
        JsonObject out = PerformanceInsightEngine.analyze(rows, "7d", 50, 19.5);
        assertTrue(out.get("players_band_scale").getAsInt() == 40);
        JsonArray bins = out.getAsJsonArray("player_bins");
        java.util.Set<String> labels = new java.util.LinkedHashSet<>();
        for (var el : bins) {
            labels.add(el.getAsJsonObject().get("players_band").getAsString());
        }
        assertTrue(labels.contains("0"));
        assertTrue(labels.contains("1-13"));
        assertTrue(labels.contains("14-26"));
        assertTrue(labels.contains("27-40"));
    }

    @Test
    void playerBinsCollapseForTinyPeaks() {
        int[][] one = PerformanceInsightEngine.occupiedPlayerRanges(1);
        assertTrue(one.length == 1 && one[0][0] == 1 && one[0][1] == 1);
        int[][] two = PerformanceInsightEngine.occupiedPlayerRanges(2);
        assertTrue(two.length == 2);

        Instant now = Instant.now();
        List<JsonObject> rows = new java.util.ArrayList<>();
        for (int p : new int[]{0, 1, 1}) {
            JsonObject row = new JsonObject();
            row.addProperty("ts", now.minus(p + 1, ChronoUnit.MINUTES).toString());
            row.addProperty("players_max", p);
            row.addProperty("mspt_avg", p == 0 ? 5.0 : 12.0);
            row.addProperty("tps_avg", 20.0);
            rows.add(row);
        }
        JsonObject out = PerformanceInsightEngine.analyze(rows, "7d", 50, 19.5);
        assertTrue(out.get("players_band_scale").getAsInt() == 1);
        JsonArray bins = out.getAsJsonArray("player_bins");
        assertTrue(bins.size() == 2);
        assertTrue("0".equals(bins.get(0).getAsJsonObject().get("players_band").getAsString()));
        assertTrue("1".equals(bins.get(1).getAsJsonObject().get("players_band").getAsString()));
    }

    @Test
    void playerBinsAllIdleOnlyEmptyBand() {
        Instant now = Instant.now();
        List<JsonObject> rows = new java.util.ArrayList<>();
        for (int i = 0; i < 10; i++) {
            JsonObject row = new JsonObject();
            row.addProperty("ts", now.minus(10 - i, ChronoUnit.MINUTES).toString());
            row.addProperty("players_max", 0);
            row.addProperty("mspt_avg", 6.0);
            row.addProperty("tps_avg", 20.0);
            rows.add(row);
        }
        JsonObject out = PerformanceInsightEngine.analyze(rows, "7d", 50, 19.5);
        assertTrue(out.get("players_band_scale").getAsInt() == 0);
        JsonArray bins = out.getAsJsonArray("player_bins");
        assertTrue(bins.size() == 1);
        assertTrue("0".equals(bins.get(0).getAsJsonObject().get("players_band").getAsString()));
    }

    @Test
    void playerCorrelationUsesHighestOccupiedBand() {
        Instant now = Instant.now();
        List<JsonObject> rows = new java.util.ArrayList<>();
        // idle minutes
        for (int i = 0; i < 5; i++) {
            JsonObject row = new JsonObject();
            row.addProperty("ts", now.minus(20 - i, ChronoUnit.MINUTES).toString());
            row.addProperty("players_max", 0);
            row.addProperty("mspt_avg", 10.0);
            row.addProperty("tps_avg", 20.0);
            rows.add(row);
        }
        // busy peak-7 minutes
        for (int i = 0; i < 5; i++) {
            JsonObject row = new JsonObject();
            row.addProperty("ts", now.minus(10 - i, ChronoUnit.MINUTES).toString());
            row.addProperty("players_max", 7);
            row.addProperty("mspt_avg", 30.0);
            row.addProperty("tps_avg", 18.0);
            rows.add(row);
        }
        JsonObject out = PerformanceInsightEngine.analyze(rows, "7d", 50, 19.5);
        boolean found = false;
        for (var el : out.getAsJsonArray("insights")) {
            JsonObject insight = el.getAsJsonObject();
            if ("player_correlation".equals(insight.get("id").getAsString())) {
                found = true;
                assertTrue(insight.get("detail").getAsString().contains("10"));
                assertTrue(insight.get("detail").getAsString().contains("30"));
            }
        }
        assertTrue(found, "expected player_correlation insight");
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
