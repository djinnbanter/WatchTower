package dev.mcstatus.watchtower.core.analyze;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.live.PerformanceRollupAccumulator;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Derives operator-facing performance insights from L1 minute rollup rows.
 */
public final class PerformanceInsightEngine {

    public static final int STICKY_LAG_MIN_MINUTES = 15;
    public static final int MIN_MINUTES_PER_HOUR_BUCKET = 10;
    public static final int MAX_OUTLIER_MINUTES = 20;
    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_OFFSET_DATE_TIME;

    private PerformanceInsightEngine() {
    }

    public static int windowToHours(String window) {
        if (window != null && window.equalsIgnoreCase("30d")) {
            return 720;
        }
        return 168;
    }

    public static JsonObject analyze(List<JsonObject> rows, String window, double msptWarn, double tpsWarn) {
        String win = window != null && !window.isBlank() ? window : "7d";
        int hours = windowToHours(win);
        JsonObject out = new JsonObject();
        out.addProperty("window", win);
        out.addProperty("hours", hours);
        out.addProperty("generated_at", ZonedDateTime.now(ZoneOffset.UTC).format(ISO));
        out.addProperty("mspt_warn", msptWarn);
        out.addProperty("tps_warn", tpsWarn);
        out.addProperty("enabled", true);
        out.addProperty("sufficient_data", rows != null && rows.size() >= 60);

        List<JsonObject> sorted = sortRowsByTime(rows);
        JsonObject busyQuiet = buildBusyQuiet(sorted);
        JsonArray playerBins = buildPlayerBins(sorted);
        JsonArray outliers = buildOutlierMinutes(sorted, msptWarn);
        JsonArray stickyLag = buildStickyLagEpisodes(sorted, msptWarn);
        JsonArray insights = buildInsights(busyQuiet, playerBins, outliers, stickyLag, win);

        out.add("busy_quiet", busyQuiet);
        out.add("player_bins", playerBins);
        out.add("outlier_minutes", outliers);
        out.add("sticky_lag", stickyLag);
        out.add("insights", insights);
        return out;
    }

    public static String rowsToCsv(List<JsonObject> rows) {
        StringBuilder sb = new StringBuilder();
        sb.append("ts,tps_avg,tps_min,mspt_avg,mspt_p95,mspt_jitter_max,players_max,");
        sb.append("heap_used_gb_avg,mem_used_gb_avg,cpu_pct_avg,low_tps_flag\n");
        for (JsonObject row : sortRowsByTime(rows)) {
            sb.append(csvCell(row, "ts"));
            sb.append(',').append(csvCell(row, "tps_avg"));
            sb.append(',').append(csvCell(row, "tps_min"));
            sb.append(',').append(csvCell(row, "mspt_avg"));
            sb.append(',').append(csvCell(row, "mspt_p95"));
            sb.append(',').append(csvCell(row, "mspt_jitter_max"));
            sb.append(',').append(csvCell(row, "players_max"));
            sb.append(',').append(csvCell(row, "heap_used_gb_avg"));
            sb.append(',').append(csvCell(row, "mem_used_gb_avg"));
            sb.append(',').append(csvCell(row, "cpu_pct_avg"));
            sb.append(',').append(csvCell(row, "low_tps_flag"));
            sb.append('\n');
        }
        return sb.toString();
    }

    private static String csvCell(JsonObject row, String key) {
        if (!row.has(key) || row.get(key).isJsonNull()) {
            return "";
        }
        String v = row.get(key).getAsString();
        if (v.contains(",") || v.contains("\"")) {
            return "\"" + v.replace("\"", "\"\"") + "\"";
        }
        return v;
    }

    private static List<JsonObject> sortRowsByTime(List<JsonObject> rows) {
        List<JsonObject> sorted = new ArrayList<>();
        if (rows == null) {
            return sorted;
        }
        sorted.addAll(rows);
        sorted.sort(Comparator.comparingLong(PerformanceInsightEngine::rowEpoch));
        return sorted;
    }

    private static long rowEpoch(JsonObject row) {
        if (!row.has("ts")) {
            return 0;
        }
        try {
            return Instant.parse(row.get("ts").getAsString()).getEpochSecond();
        } catch (Exception e) {
            return 0;
        }
    }

    private static JsonObject buildBusyQuiet(List<JsonObject> rows) {
        Map<Integer, HourBucket> buckets = new HashMap<>();
        for (JsonObject row : rows) {
            if (!row.has("ts")) {
                continue;
            }
            int hour;
            try {
                hour = Instant.parse(row.get("ts").getAsString()).atZone(ZoneOffset.UTC).getHour();
            } catch (Exception e) {
                continue;
            }
            HourBucket b = buckets.computeIfAbsent(hour, k -> new HourBucket());
            b.minutes++;
            if (row.has("players_max")) {
                b.playersSum += row.get("players_max").getAsInt();
            }
            if (row.has("mspt_avg")) {
                b.msptSum += row.get("mspt_avg").getAsDouble();
            }
        }

        List<HourBucket> ranked = new ArrayList<>();
        for (Map.Entry<Integer, HourBucket> e : buckets.entrySet()) {
            if (e.getValue().minutes >= MIN_MINUTES_PER_HOUR_BUCKET) {
                e.getValue().hourUtc = e.getKey();
                ranked.add(e.getValue());
            }
        }
        ranked.sort((a, b) -> {
            double ap = a.avgPlayers();
            double bp = b.avgPlayers();
            if (Double.compare(bp, ap) != 0) {
                return Double.compare(bp, ap);
            }
            return Double.compare(b.avgMspt(), a.avgMspt());
        });

        JsonObject out = new JsonObject();
        JsonArray busy = new JsonArray();
        JsonArray quiet = new JsonArray();
        for (int i = 0; i < Math.min(3, ranked.size()); i++) {
            busy.add(ranked.get(i).toJson(true));
        }
        for (int i = ranked.size() - 1; i >= Math.max(0, ranked.size() - 3); i--) {
            quiet.add(ranked.get(i).toJson(false));
        }
        out.add("busy_hours", busy);
        out.add("quiet_hours", quiet);
        return out;
    }

    private static JsonArray buildPlayerBins(List<JsonObject> rows) {
        String[] labels = {"0", "1-2", "3-5", "6+"};
        BinAccumulator[] bins = {
                new BinAccumulator(labels[0]),
                new BinAccumulator(labels[1]),
                new BinAccumulator(labels[2]),
                new BinAccumulator(labels[3])
        };
        for (JsonObject row : rows) {
            int players = row.has("players_max") ? row.get("players_max").getAsInt() : 0;
            int idx = players == 0 ? 0 : players <= 2 ? 1 : players <= 5 ? 2 : 3;
            bins[idx].add(row);
        }
        JsonArray arr = new JsonArray();
        for (BinAccumulator bin : bins) {
            if (bin.minutes > 0) {
                arr.add(bin.toJson());
            }
        }
        return arr;
    }

    private static JsonArray buildOutlierMinutes(List<JsonObject> rows, double msptWarn) {
        double[] hourMedian = hourOfDayMedianMspt(rows);
        List<JsonObject> outliers = new ArrayList<>();
        for (JsonObject row : rows) {
            if (!row.has("mspt_avg")) {
                continue;
            }
            double mspt = row.get("mspt_avg").getAsDouble();
            if (mspt < msptWarn) {
                continue;
            }
            int players = row.has("players_max") ? row.get("players_max").getAsInt() : 0;
            int hour = hourUtc(row);
            double median = hour >= 0 && hour < 24 ? hourMedian[hour] : 0;
            boolean idle = players == 0;
            boolean spike = median > 0 && mspt > median * 1.5;
            if (!idle && !spike) {
                continue;
            }
            JsonObject o = new JsonObject();
            o.addProperty("ts", row.get("ts").getAsString());
            o.addProperty("players_max", players);
            o.addProperty("mspt_avg", mspt);
            if (row.has("mem_used_gb_avg")) {
                o.addProperty("mem_used_gb_avg", row.get("mem_used_gb_avg").getAsDouble());
            }
            o.addProperty("reason", idle ? "high_mspt_idle" : "high_mspt_vs_hour_median");
            outliers.add(o);
        }
        outliers.sort((a, b) -> Long.compare(rowEpoch(b), rowEpoch(a)));
        JsonArray arr = new JsonArray();
        for (int i = 0; i < Math.min(MAX_OUTLIER_MINUTES, outliers.size()); i++) {
            arr.add(outliers.get(i));
        }
        return arr;
    }

    private static double[] hourOfDayMedianMspt(List<JsonObject> rows) {
        Map<Integer, List<Double>> byHour = new HashMap<>();
        for (JsonObject row : rows) {
            if (!row.has("mspt_avg") || !row.has("ts")) {
                continue;
            }
            int hour = hourUtc(row);
            if (hour < 0) {
                continue;
            }
            byHour.computeIfAbsent(hour, k -> new ArrayList<>())
                    .add(row.get("mspt_avg").getAsDouble());
        }
        double[] medians = new double[24];
        for (int h = 0; h < 24; h++) {
            List<Double> vals = byHour.get(h);
            if (vals == null || vals.isEmpty()) {
                continue;
            }
            vals.sort(Double::compareTo);
            int idx = vals.size() / 2;
            medians[h] = vals.get(idx);
        }
        return medians;
    }

    private static int hourUtc(JsonObject row) {
        try {
            return Instant.parse(row.get("ts").getAsString()).atZone(ZoneOffset.UTC).getHour();
        } catch (Exception e) {
            return -1;
        }
    }

    private static JsonArray buildStickyLagEpisodes(List<JsonObject> rows, double msptWarn) {
        JsonArray episodes = new JsonArray();
        boolean hadPlayers = false;
        int idleHighMsptStreak = 0;
        long episodeStart = 0;
        double peakMspt = 0;

        for (JsonObject row : rows) {
            int players = row.has("players_max") ? row.get("players_max").getAsInt() : 0;
            double mspt = row.has("mspt_avg") ? row.get("mspt_avg").getAsDouble() : 0;
            long epoch = rowEpoch(row);

            if (players > 0) {
                if (idleHighMsptStreak >= STICKY_LAG_MIN_MINUTES) {
                    episodes.add(stickyEpisode(episodeStart, epoch, idleHighMsptStreak, peakMspt));
                }
                hadPlayers = true;
                idleHighMsptStreak = 0;
                peakMspt = 0;
                continue;
            }
            if (!hadPlayers) {
                continue;
            }
            if (mspt >= msptWarn) {
                if (idleHighMsptStreak == 0) {
                    episodeStart = epoch;
                }
                idleHighMsptStreak++;
                peakMspt = Math.max(peakMspt, mspt);
            } else if (idleHighMsptStreak >= STICKY_LAG_MIN_MINUTES) {
                episodes.add(stickyEpisode(episodeStart, epoch, idleHighMsptStreak, peakMspt));
                idleHighMsptStreak = 0;
                peakMspt = 0;
            } else {
                idleHighMsptStreak = 0;
                peakMspt = 0;
            }
        }
        if (idleHighMsptStreak >= STICKY_LAG_MIN_MINUTES) {
            long end = rows.isEmpty() ? episodeStart : rowEpoch(rows.get(rows.size() - 1));
            episodes.add(stickyEpisode(episodeStart, end, idleHighMsptStreak, peakMspt));
        }
        return episodes;
    }

    private static JsonObject stickyEpisode(long startEpoch, long endEpoch, int durationMin, double peakMspt) {
        JsonObject ep = new JsonObject();
        ep.addProperty("started_at", Instant.ofEpochSecond(startEpoch).toString());
        ep.addProperty("ended_at", Instant.ofEpochSecond(endEpoch).toString());
        ep.addProperty("duration_min", durationMin);
        ep.addProperty("peak_mspt", PerformanceRollupAccumulator.round1(peakMspt));
        ep.addProperty("narrative", String.format(Locale.US,
                "MSPT stayed above threshold for %d min after players left (peak %.0f ms)",
                durationMin, peakMspt));
        return ep;
    }

    private static JsonArray buildInsights(
            JsonObject busyQuiet,
            JsonArray playerBins,
            JsonArray outliers,
            JsonArray stickyLag,
            String window
    ) {
        List<JsonObject> insights = collectInsights(busyQuiet, playerBins, outliers, stickyLag, window);
        JsonArray arr = new JsonArray();
        for (int i = 0; i < Math.min(5, insights.size()); i++) {
            arr.add(insights.get(i));
        }
        return arr;
    }

    /** Full insight list for Performance tab (no 5-item cap). */
    static JsonArray buildInsightsFull(
            JsonObject busyQuiet,
            JsonArray playerBins,
            JsonArray outliers,
            JsonArray stickyLag,
            String window
    ) {
        List<JsonObject> insights = collectInsights(busyQuiet, playerBins, outliers, stickyLag, window);
        JsonArray arr = new JsonArray();
        insights.forEach(arr::add);
        return arr;
    }

    private static List<JsonObject> collectInsights(
            JsonObject busyQuiet,
            JsonArray playerBins,
            JsonArray outliers,
            JsonArray stickyLag,
            String window
    ) {
        List<JsonObject> insights = new ArrayList<>();

        if (stickyLag.size() > 0) {
            JsonObject latest = stickyLag.get(stickyLag.size() - 1).getAsJsonObject();
            insights.add(insight("sticky_lag", "warning",
                    "Sticky lag after players left",
                    latest.has("narrative") ? latest.get("narrative").getAsString() : "Elevated MSPT continued with no players online.",
                    "performance"));
        }

        JsonArray busy = busyQuiet.getAsJsonArray("busy_hours");
        if (busy.size() > 0) {
            StringBuilder detail = new StringBuilder();
            for (int i = 0; i < busy.size(); i++) {
                JsonObject h = busy.get(i).getAsJsonObject();
                if (!detail.isEmpty()) {
                    detail.append("; ");
                }
                detail.append(h.get("label").getAsString());
                if (h.has("avg_players")) {
                    detail.append(" (avg ").append(String.format(Locale.US, "%.1f", h.get("avg_players").getAsDouble()))
                            .append(" players)");
                }
            }
            insights.add(insight("busy_hours", "info",
                    "Typically busy hours (" + window + ")",
                    detail.toString(),
                    "performance"));
        }

        JsonArray quiet = busyQuiet.getAsJsonArray("quiet_hours");
        if (quiet.size() > 0 && busy.size() > 0) {
            JsonObject q = quiet.get(0).getAsJsonObject();
            insights.add(insight("quiet_hours", "info",
                    "Quietest hour",
                    q.get("label").getAsString() + (q.has("avg_players")
                            ? " (avg " + String.format(Locale.US, "%.1f", q.get("avg_players").getAsDouble()) + " players)"
                            : ""),
                    "performance"));
        }

        long idleOutliers = 0;
        for (int i = 0; i < outliers.size(); i++) {
            JsonObject o = outliers.get(i).getAsJsonObject();
            if (o.has("reason") && "high_mspt_idle".equals(o.get("reason").getAsString())) {
                idleOutliers++;
            }
        }
        if (idleOutliers > 0) {
            insights.add(insight("outlier_idle", "warning",
                    "High MSPT with no players",
                    idleOutliers + " minute(s) in window had elevated MSPT while idle — check farms, chunk loaders, or background jobs.",
                    "issues"));
        }

        if (playerBins.size() >= 2) {
            double idleMspt = -1;
            double busyMspt = -1;
            for (int i = 0; i < playerBins.size(); i++) {
                JsonObject b = playerBins.get(i).getAsJsonObject();
                String band = b.get("players_band").getAsString();
                if ("0".equals(band)) {
                    idleMspt = b.get("mspt_avg").getAsDouble();
                } else if ("6+".equals(band) || "3-5".equals(band)) {
                    busyMspt = Math.max(busyMspt, b.get("mspt_avg").getAsDouble());
                }
            }
            if (idleMspt >= 0 && busyMspt >= 0 && busyMspt > idleMspt * 1.2) {
                insights.add(insight("player_correlation", "info",
                        "Lag scales with player count",
                        String.format(Locale.US, "Avg MSPT %.0f ms idle vs %.0f ms with more players online.", idleMspt, busyMspt),
                        "performance"));
            }
        }

        insights.sort((a, b) -> severityRank(a) - severityRank(b));
        return insights;
    }

    private static int severityRank(JsonObject insight) {
        String sev = insight.has("severity") ? insight.get("severity").getAsString() : "info";
        return switch (sev) {
            case "critical" -> 0;
            case "warning" -> 1;
            default -> 2;
        };
    }

    static JsonArray buildHourOfWeek(List<JsonObject> rows) {
        WeekCell[][] grid = new WeekCell[7][24];
        for (int d = 0; d < 7; d++) {
            for (int h = 0; h < 24; h++) {
                grid[d][h] = new WeekCell(d, h);
            }
        }
        for (JsonObject row : rows) {
            if (!row.has("ts")) {
                continue;
            }
            try {
                var zdt = Instant.parse(row.get("ts").getAsString()).atZone(ZoneOffset.UTC);
                int dow = zdt.getDayOfWeek().getValue() % 7;
                int hour = zdt.getHour();
                WeekCell cell = grid[dow][hour];
                cell.minutes++;
                if (row.has("players_max")) {
                    cell.playersSum += row.get("players_max").getAsInt();
                }
                if (row.has("mspt_avg")) {
                    cell.msptSum += row.get("mspt_avg").getAsDouble();
                }
                if (row.has("tps_avg")) {
                    cell.tpsSum += row.get("tps_avg").getAsDouble();
                }
                if (row.has("low_tps_flag") && row.get("low_tps_flag").getAsBoolean()) {
                    cell.lowTps++;
                }
            } catch (Exception ignored) {
            }
        }
        JsonArray cells = new JsonArray();
        for (int d = 0; d < 7; d++) {
            for (int h = 0; h < 24; h++) {
                if (grid[d][h].minutes > 0) {
                    cells.add(grid[d][h].toJson());
                }
            }
        }
        return cells;
    }

    static JsonArray buildDailySeries(List<JsonObject> rows) {
        Map<String, DayBucket> byDay = new HashMap<>();
        for (JsonObject row : rows) {
            if (!row.has("ts")) {
                continue;
            }
            try {
                var zdt = Instant.parse(row.get("ts").getAsString()).atZone(ZoneOffset.UTC);
                String day = zdt.toLocalDate().toString();
                DayBucket b = byDay.computeIfAbsent(day, k -> new DayBucket(day));
                b.add(row);
            } catch (Exception ignored) {
            }
        }
        List<DayBucket> sorted = new ArrayList<>(byDay.values());
        sorted.sort(Comparator.comparing(b -> b.date));
        JsonArray arr = new JsonArray();
        sorted.forEach(b -> arr.add(b.toJson()));
        return arr;
    }

    static JsonObject buildPeriodCompare(
            List<JsonObject> currentRows,
            List<JsonObject> priorRows,
            JsonArray currentSticky,
            JsonArray priorSticky,
            JsonArray currentOutliers,
            JsonArray priorOutliers,
            String window
    ) {
        JsonObject out = new JsonObject();
        out.addProperty("window", window);
        out.add("current", periodStats(currentRows, currentSticky, currentOutliers));
        out.add("prior", periodStats(priorRows, priorSticky, priorOutliers));
        JsonObject deltas = new JsonObject();
        JsonObject cur = out.getAsJsonObject("current");
        JsonObject pri = out.getAsJsonObject("prior");
        addDelta(deltas, "mspt_avg", cur, pri);
        addDelta(deltas, "low_tps_minutes", cur, pri);
        addDelta(deltas, "players_peak", cur, pri);
        addDelta(deltas, "sticky_episode_count", cur, pri);
        addDelta(deltas, "outlier_count", cur, pri);
        out.add("deltas", deltas);
        return out;
    }

    static JsonObject buildSummaryExtended(
            List<JsonObject> rows,
            JsonArray stickyLag,
            JsonArray outliers
    ) {
        JsonObject s = new JsonObject();
        s.addProperty("sample_minutes", rows.size());
        if (rows.isEmpty()) {
            return s;
        }
        List<Double> mspt = new ArrayList<>();
        List<Double> msptP95 = new ArrayList<>();
        List<Double> jitter = new ArrayList<>();
        List<Double> heap = new ArrayList<>();
        List<Double> mem = new ArrayList<>();
        List<Double> cpu = new ArrayList<>();
        List<Double> tps = new ArrayList<>();
        List<Integer> players = new ArrayList<>();
        int lowTps = 0;
        for (JsonObject row : rows) {
            if (row.has("mspt_avg")) {
                mspt.add(row.get("mspt_avg").getAsDouble());
            }
            if (row.has("mspt_p95")) {
                msptP95.add(row.get("mspt_p95").getAsDouble());
            }
            if (row.has("mspt_jitter_max")) {
                jitter.add(row.get("mspt_jitter_max").getAsDouble());
            }
            if (row.has("heap_used_gb_avg")) {
                heap.add(row.get("heap_used_gb_avg").getAsDouble());
            }
            if (row.has("mem_used_gb_avg")) {
                mem.add(row.get("mem_used_gb_avg").getAsDouble());
            }
            if (row.has("cpu_pct_avg")) {
                cpu.add(row.get("cpu_pct_avg").getAsDouble());
            }
            if (row.has("tps_avg")) {
                tps.add(row.get("tps_avg").getAsDouble());
            }
            if (row.has("players_max")) {
                players.add(row.get("players_max").getAsInt());
            }
            if (row.has("low_tps_flag") && row.get("low_tps_flag").getAsBoolean()) {
                lowTps++;
            }
        }
        if (!tps.isEmpty()) {
            s.addProperty("tps_avg", PerformanceRollupAccumulator.round2(PerformanceRollupAccumulator.avg(tps)));
        }
        if (!mspt.isEmpty()) {
            s.addProperty("mspt_avg", PerformanceRollupAccumulator.round1(PerformanceRollupAccumulator.avg(mspt)));
        }
        if (!msptP95.isEmpty()) {
            s.addProperty("mspt_p95", PerformanceRollupAccumulator.round1(PerformanceRollupAccumulator.p95(msptP95)));
        }
        if (!jitter.isEmpty()) {
            s.addProperty("mspt_jitter_max", PerformanceRollupAccumulator.round1(java.util.Collections.max(jitter)));
        }
        if (!heap.isEmpty()) {
            s.addProperty("heap_used_gb_avg", PerformanceRollupAccumulator.round2(PerformanceRollupAccumulator.avg(heap)));
        }
        if (!mem.isEmpty()) {
            s.addProperty("mem_used_gb_avg", PerformanceRollupAccumulator.round2(PerformanceRollupAccumulator.avg(mem)));
        }
        if (!cpu.isEmpty()) {
            s.addProperty("cpu_pct_avg", PerformanceRollupAccumulator.round1(PerformanceRollupAccumulator.avg(cpu)));
        }
        if (!players.isEmpty()) {
            s.addProperty("players_peak", java.util.Collections.max(players));
        }
        s.addProperty("low_tps_minutes", lowTps);
        s.addProperty("sticky_episode_count", stickyLag.size());
        s.addProperty("outlier_count", outliers.size());
        return s;
    }

    static JsonArray buildCorrelations(
            JsonObject busyQuiet,
            JsonArray outliers,
            JsonArray stickyLag,
            JsonObject periodCompare
    ) {
        List<JsonObject> out = new ArrayList<>();

        JsonObject deltas = periodCompare != null && periodCompare.has("deltas")
                ? periodCompare.getAsJsonObject("deltas") : null;
        if (deltas != null && deltas.has("outlier_count")) {
            JsonObject d = deltas.getAsJsonObject("outlier_count");
            if (d.has("delta") && d.get("delta").getAsDouble() > 0 && d.has("prior") && d.get("prior").getAsDouble() > 0) {
                double pct = 100.0 * d.get("delta").getAsDouble() / d.get("prior").getAsDouble();
                out.add(correlationCallout("outliers_up",
                        "warning",
                        "More idle lag minutes than prior period",
                        String.format(Locale.US,
                                "Outlier minutes up %.0f%% vs prior %s window.",
                                pct, periodCompare.get("window").getAsString())));
            }
        }
        if (deltas != null && deltas.has("mspt_avg")) {
            JsonObject d = deltas.getAsJsonObject("mspt_avg");
            if (d.has("delta") && Math.abs(d.get("delta").getAsDouble()) >= 2) {
                String dir = d.get("delta").getAsDouble() > 0 ? "up" : "down";
                out.add(correlationCallout("mspt_trend",
                        d.get("delta").getAsDouble() > 0 ? "warning" : "info",
                        "Average MSPT " + dir + " vs prior period",
                        String.format(Locale.US, "Avg MSPT %.1f ms now vs %.1f ms prior window.",
                                d.get("current").getAsDouble(), d.get("prior").getAsDouble())));
            }
        }

        long idleOutliers = 0;
        for (int i = 0; i < outliers.size(); i++) {
            JsonObject o = outliers.get(i).getAsJsonObject();
            if (o.has("reason") && "high_mspt_idle".equals(o.get("reason").getAsString())) {
                idleOutliers++;
            }
        }
        if (idleOutliers >= 3) {
            out.add(correlationCallout("idle_lag_pattern",
                    "warning",
                    "Repeated idle lag",
                    idleOutliers + " minutes with high MSPT and zero players — background work may be the cause."));
        }
        if (stickyLag.size() > 0) {
            out.add(correlationCallout("sticky_sessions",
                    "warning",
                    "Post-session sticky lag detected",
                    stickyLag.size() + " episode(s) where MSPT stayed high after players left."));
        }

        JsonArray busy = busyQuiet.getAsJsonArray("busy_hours");
        if (busy.size() > 0 && !out.isEmpty()) {
            JsonObject h = busy.get(0).getAsJsonObject();
            if (h.has("avg_mspt") && h.get("avg_mspt").getAsDouble() > 25) {
                out.add(correlationCallout("busy_hour_mspt",
                        "info",
                        "Peak hours carry higher tick cost",
                        "Busiest hour " + h.get("label").getAsString()
                                + " averages " + Math.round(h.get("avg_mspt").getAsDouble()) + " ms MSPT."));
            }
        }

        JsonArray arr = new JsonArray();
        for (int i = 0; i < Math.min(6, out.size()); i++) {
            arr.add(out.get(i));
        }
        return arr;
    }

    static WindowSplit splitWindowRows(List<JsonObject> allRows, int windowHours) {
        long now = Instant.now().getEpochSecond();
        long currentStart = now - (long) windowHours * 3600L;
        long priorStart = now - (long) windowHours * 2 * 3600L;
        List<JsonObject> current = new ArrayList<>();
        List<JsonObject> prior = new ArrayList<>();
        for (JsonObject row : allRows) {
            long epoch = rowEpoch(row);
            if (epoch >= currentStart) {
                current.add(row);
            } else if (epoch >= priorStart) {
                prior.add(row);
            }
        }
        return new WindowSplit(current, prior, currentStart);
    }

    static long rowEpochPublic(JsonObject row) {
        return rowEpoch(row);
    }

    private static JsonObject periodStats(List<JsonObject> rows, JsonArray sticky, JsonArray outliers) {
        JsonObject s = buildSummaryExtended(rows, sticky, outliers);
        return s;
    }

    private static void addDelta(JsonObject deltas, String key, JsonObject cur, JsonObject pri) {
        if (!cur.has(key) || !pri.has(key)) {
            return;
        }
        double c = cur.get(key).getAsDouble();
        double p = pri.get(key).getAsDouble();
        JsonObject d = new JsonObject();
        d.addProperty("current", c);
        d.addProperty("prior", p);
        d.addProperty("delta", PerformanceRollupAccumulator.round2(c - p));
        deltas.add(key, d);
    }

    private static JsonObject correlationCallout(String id, String severity, String title, String detail) {
        JsonObject o = new JsonObject();
        o.addProperty("id", id);
        o.addProperty("severity", severity);
        o.addProperty("title", title);
        o.addProperty("detail", detail);
        return o;
    }

    static final class WindowSplit {
        final List<JsonObject> current;
        final List<JsonObject> prior;
        final long currentStartEpoch;

        WindowSplit(List<JsonObject> current, List<JsonObject> prior, long currentStartEpoch) {
            this.current = current;
            this.prior = prior;
            this.currentStartEpoch = currentStartEpoch;
        }
    }

    private static final class WeekCell {
        final int dow;
        final int hourUtc;
        int minutes;
        double playersSum;
        double msptSum;
        double tpsSum;
        int lowTps;

        WeekCell(int dow, int hourUtc) {
            this.dow = dow;
            this.hourUtc = hourUtc;
        }

        JsonObject toJson() {
            JsonObject o = new JsonObject();
            o.addProperty("dow", dow);
            o.addProperty("hour_utc", hourUtc);
            o.addProperty("sample_minutes", minutes);
            if (minutes > 0) {
                o.addProperty("avg_players", PerformanceRollupAccumulator.round2(playersSum / minutes));
                o.addProperty("avg_mspt", PerformanceRollupAccumulator.round1(msptSum / minutes));
                if (tpsSum > 0) {
                    o.addProperty("avg_tps", PerformanceRollupAccumulator.round2(tpsSum / minutes));
                }
            }
            o.addProperty("low_tps_minutes", lowTps);
            return o;
        }
    }

    private static final class DayBucket {
        final String date;
        int minutes;
        final List<Double> tps = new ArrayList<>();
        final List<Double> mspt = new ArrayList<>();
        final List<Double> msptP95 = new ArrayList<>();
        final List<Integer> players = new ArrayList<>();
        final List<Double> heap = new ArrayList<>();
        final List<Double> cpu = new ArrayList<>();
        int lowTps;

        DayBucket(String date) {
            this.date = date;
        }

        void add(JsonObject row) {
            minutes++;
            if (row.has("tps_avg")) {
                tps.add(row.get("tps_avg").getAsDouble());
            }
            if (row.has("mspt_avg")) {
                mspt.add(row.get("mspt_avg").getAsDouble());
            }
            if (row.has("mspt_p95")) {
                msptP95.add(row.get("mspt_p95").getAsDouble());
            }
            if (row.has("players_max")) {
                players.add(row.get("players_max").getAsInt());
            }
            if (row.has("heap_used_gb_avg")) {
                heap.add(row.get("heap_used_gb_avg").getAsDouble());
            }
            if (row.has("cpu_pct_avg")) {
                cpu.add(row.get("cpu_pct_avg").getAsDouble());
            }
            if (row.has("low_tps_flag") && row.get("low_tps_flag").getAsBoolean()) {
                lowTps++;
            }
        }

        JsonObject toJson() {
            JsonObject o = new JsonObject();
            o.addProperty("date", date);
            o.addProperty("minutes", minutes);
            if (!tps.isEmpty()) {
                o.addProperty("tps_avg", PerformanceRollupAccumulator.round2(PerformanceRollupAccumulator.avg(tps)));
            }
            if (!mspt.isEmpty()) {
                o.addProperty("mspt_avg", PerformanceRollupAccumulator.round1(PerformanceRollupAccumulator.avg(mspt)));
            }
            if (!msptP95.isEmpty()) {
                o.addProperty("mspt_p95", PerformanceRollupAccumulator.round1(PerformanceRollupAccumulator.p95(msptP95)));
            }
            if (!players.isEmpty()) {
                o.addProperty("players_peak", java.util.Collections.max(players));
            }
            if (!heap.isEmpty()) {
                o.addProperty("heap_avg", PerformanceRollupAccumulator.round2(PerformanceRollupAccumulator.avg(heap)));
            }
            if (!cpu.isEmpty()) {
                o.addProperty("cpu_avg", PerformanceRollupAccumulator.round1(PerformanceRollupAccumulator.avg(cpu)));
            }
            o.addProperty("low_tps_minutes", lowTps);
            return o;
        }
    }

    private static JsonObject insight(String id, String severity, String title, String detail, String tab) {
        JsonObject o = new JsonObject();
        o.addProperty("id", id);
        o.addProperty("severity", severity);
        o.addProperty("title", title);
        o.addProperty("detail", detail);
        o.addProperty("tab", tab);
        return o;
    }

    private static final class HourBucket {
        int hourUtc;
        int minutes;
        double playersSum;
        double msptSum;

        double avgPlayers() {
            return minutes == 0 ? 0 : playersSum / minutes;
        }

        double avgMspt() {
            return minutes == 0 ? 0 : msptSum / minutes;
        }

        JsonObject toJson(boolean busy) {
            JsonObject o = new JsonObject();
            o.addProperty("hour_utc", hourUtc);
            o.addProperty("label", String.format(Locale.US, "%02d:00–%02d:00 UTC", hourUtc, (hourUtc + 1) % 24));
            o.addProperty("avg_players", PerformanceRollupAccumulator.round2(avgPlayers()));
            o.addProperty("avg_mspt", PerformanceRollupAccumulator.round1(avgMspt()));
            o.addProperty("sample_minutes", minutes);
            o.addProperty("busy", busy);
            return o;
        }
    }

    private static final class BinAccumulator {
        final String band;
        int minutes;
        final List<Double> mspt = new ArrayList<>();
        final List<Double> tps = new ArrayList<>();

        BinAccumulator(String band) {
            this.band = band;
        }

        void add(JsonObject row) {
            minutes++;
            if (row.has("mspt_avg")) {
                mspt.add(row.get("mspt_avg").getAsDouble());
            }
            if (row.has("tps_avg")) {
                tps.add(row.get("tps_avg").getAsDouble());
            }
        }

        JsonObject toJson() {
            JsonObject o = new JsonObject();
            o.addProperty("players_band", band);
            o.addProperty("minutes", minutes);
            if (!mspt.isEmpty()) {
                o.addProperty("mspt_avg", PerformanceRollupAccumulator.round1(PerformanceRollupAccumulator.avg(mspt)));
            }
            if (!tps.isEmpty()) {
                o.addProperty("tps_avg", PerformanceRollupAccumulator.round2(PerformanceRollupAccumulator.avg(tps)));
            }
            return o;
        }
    }
}
