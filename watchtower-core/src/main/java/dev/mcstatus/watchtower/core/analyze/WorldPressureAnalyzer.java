package dev.mcstatus.watchtower.core.analyze;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.live.PerformanceRollupAccumulator;

import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * World-pressure census analysis (1.1.9). Pure JSON — no Minecraft types.
 *
 * <p>Classifies sustained entity/chunk pressure against quiet-hours baselines and
 * MSPT correlation. Never kills entities or unloads chunks.
 */
public final class WorldPressureAnalyzer {

    public static final int LEARNING_MIN_MINUTES = 360;
    public static final int ITEM_STORM_MIN_ITEMS = 1200;
    public static final double ITEM_STORM_SHARE = 0.40;
    public static final int ITEM_STORM_CRITICAL_ITEMS = 3000;
    public static final int ITEM_STORM_SUSTAINED = 3;
    public static final int MOB_SPIKE_MIN_LIVING = 900;
    public static final int MOB_SPIKE_SUSTAINED = 3;
    public static final int CORRELATION_MIN_MINUTES = 60;

    private WorldPressureAnalyzer() {
    }

    /**
     * Assemble a full {@code world_pressure} ops-cache block.
     *
     * @param census   JSON from {@code LiveMetricsService.latestWorldCensus()} (dimensions[])
     * @param rows     L1 rollup rows (prefer last 7d for quiet learning / correlation)
     * @param prev     previous ops-cache root (for streak / first_seen carry-forward)
     * @param msptWarn MSPT warn threshold from config
     */
    public static JsonObject analyze(JsonObject census, List<JsonObject> rows, JsonObject prev, double msptWarn) {
        if (census == null) {
            census = new JsonObject();
        }
        JsonObject baseline = quietBaseline(rows);
        JsonObject corr = correlation(rows, msptWarn);
        boolean correlated = corr.has("correlated") && corr.get("correlated").getAsBoolean();
        boolean learning = baseline.has("sample_minutes")
                && baseline.get("sample_minutes").getAsInt() < LEARNING_MIN_MINUTES;

        JsonObject prevStreaks = new JsonObject();
        JsonObject prevBlock = prev != null && prev.has("world_pressure")
                && prev.get("world_pressure").isJsonObject()
                ? prev.getAsJsonObject("world_pressure") : null;
        if (prevBlock != null && prevBlock.has("streaks") && prevBlock.get("streaks").isJsonObject()) {
            prevStreaks = prevBlock.getAsJsonObject("streaks").deepCopy();
        }

        ClassifyResult classified = classify(census, baseline, prevStreaks, learning, correlated);

        JsonObject out = new JsonObject();
        if (census.has("census_at")) {
            out.add("census_at", census.get("census_at"));
        }
        out.addProperty("learning", learning);
        out.addProperty("correlated_with_mspt", correlated);
        out.add("correlation", corr);
        out.add("dimensions", enrichDimensions(census, baseline));
        out.add("classifiers", classified.classifiers);
        out.add("streaks", classified.streaks);
        return out;
    }

    /** Quiet-hour percentiles of entities_max / chunks_max from L1 rows (classifier baseline). */
    public static JsonObject quietBaseline(List<JsonObject> rows) {
        JsonObject busyQuiet = rows == null || rows.isEmpty()
                ? new JsonObject()
                : PerformanceInsightEngine.buildBusyQuiet(rows);
        Set<Integer> quietHours = hourSet(busyQuiet, "quiet_hours");
        JsonObject out = hourFilteredBaseline(rows, quietHours, true);
        JsonArray hoursUtc = new JsonArray();
        for (int h : quietHours) {
            hoursUtc.add(h);
        }
        out.add("hours_utc", hoursUtc);
        return out;
    }

    /** Busy-hour percentiles of entities_max / chunks_max (UI comparison bar). */
    public static JsonObject busyBaseline(List<JsonObject> rows) {
        JsonObject busyQuiet = rows == null || rows.isEmpty()
                ? new JsonObject()
                : PerformanceInsightEngine.buildBusyQuiet(rows);
        Set<Integer> busyHours = hourSet(busyQuiet, "busy_hours");
        JsonObject out = hourFilteredBaseline(rows, busyHours, true);
        JsonArray hoursUtc = new JsonArray();
        for (int h : busyHours) {
            hoursUtc.add(h);
        }
        out.add("hours_utc", hoursUtc);
        return out;
    }

    /**
     * Highest single-minute entities_max / chunks_max in the row window.
     * Includes {@code entities_at} / {@code chunks_at} ISO timestamps when present.
     */
    public static JsonObject windowPeak(List<JsonObject> rows) {
        JsonObject out = new JsonObject();
        out.addProperty("entities_max", 0);
        out.addProperty("chunks_max", 0);
        if (rows == null || rows.isEmpty()) {
            return out;
        }
        double peakEntities = 0;
        double peakChunks = 0;
        String entitiesAt = null;
        String chunksAt = null;
        for (JsonObject row : rows) {
            if (row.has("entities_max") && !row.get("entities_max").isJsonNull()) {
                double v = row.get("entities_max").getAsDouble();
                if (v >= peakEntities) {
                    peakEntities = v;
                    entitiesAt = row.has("ts") && !row.get("ts").isJsonNull()
                            ? row.get("ts").getAsString() : null;
                }
            }
            if (row.has("chunks_max") && !row.get("chunks_max").isJsonNull()) {
                double v = row.get("chunks_max").getAsDouble();
                if (v >= peakChunks) {
                    peakChunks = v;
                    chunksAt = row.has("ts") && !row.get("ts").isJsonNull()
                            ? row.get("ts").getAsString() : null;
                }
            }
        }
        out.addProperty("entities_max", round1(peakEntities));
        out.addProperty("chunks_max", round1(peakChunks));
        if (entitiesAt != null) {
            out.addProperty("entities_at", entitiesAt);
        }
        if (chunksAt != null) {
            out.addProperty("chunks_at", chunksAt);
        }
        return out;
    }

    /**
     * Dashboard comparison payload: quiet-hours p95, busy-hours p95, and window peak
     * for the selected Insights window.
     */
    public static JsonObject compareBaselines(List<JsonObject> rows, String windowLabel) {
        String win = windowLabel != null && !windowLabel.isBlank() ? windowLabel : "7d";
        JsonObject out = new JsonObject();
        out.addProperty("window", win);
        out.add("quiet", quietBaseline(rows));
        out.add("busy", busyBaseline(rows));
        out.add("peak", windowPeak(rows));
        out.addProperty("method",
                "quiet=p95 during Schedule quiet hours; busy=p95 during busy hours; peak=max minute in window");
        return out;
    }

    /**
     * Percentiles of entities_max / chunks_max, optionally filtered to a set of UTC hours.
     * When {@code fallbackAll} is true and the hour filter yields nothing, uses all entity rows.
     */
    static JsonObject hourFilteredBaseline(List<JsonObject> rows, Set<Integer> hours, boolean fallbackAll) {
        JsonObject out = new JsonObject();
        List<Double> entities = new ArrayList<>();
        List<Double> chunks = new ArrayList<>();
        if (rows == null || rows.isEmpty()) {
            out.addProperty("entities_p50", 0);
            out.addProperty("entities_p95", 0);
            out.addProperty("chunks_p95", 0);
            out.addProperty("sample_minutes", 0);
            return out;
        }

        for (JsonObject row : rows) {
            if (!row.has("ts") || !row.has("entities_max")) {
                continue;
            }
            int hour;
            try {
                hour = Instant.parse(row.get("ts").getAsString()).atZone(ZoneOffset.UTC).getHour();
            } catch (Exception e) {
                continue;
            }
            if (hours != null && !hours.isEmpty() && !hours.contains(hour)) {
                continue;
            }
            entities.add(row.get("entities_max").getAsDouble());
            if (row.has("chunks_max")) {
                chunks.add(row.get("chunks_max").getAsDouble());
            }
        }

        if (entities.isEmpty() && fallbackAll) {
            for (JsonObject row : rows) {
                if (!row.has("entities_max")) {
                    continue;
                }
                entities.add(row.get("entities_max").getAsDouble());
                if (row.has("chunks_max")) {
                    chunks.add(row.get("chunks_max").getAsDouble());
                }
            }
        }

        out.addProperty("entities_p50", round1(PerformanceRollupAccumulator.percentile(entities, 0.50)));
        out.addProperty("entities_p95", round1(PerformanceRollupAccumulator.percentile(entities, 0.95)));
        out.addProperty("chunks_p95", round1(PerformanceRollupAccumulator.percentile(chunks, 0.95)));
        out.addProperty("sample_minutes", entities.size());
        return out;
    }

    private static Set<Integer> hourSet(JsonObject busyQuiet, String arrayKey) {
        Set<Integer> hours = new HashSet<>();
        if (busyQuiet == null || !busyQuiet.has(arrayKey) || !busyQuiet.get(arrayKey).isJsonArray()) {
            return hours;
        }
        for (JsonElement el : busyQuiet.getAsJsonArray(arrayKey)) {
            if (el.isJsonObject() && el.getAsJsonObject().has("hour_utc")) {
                hours.add(el.getAsJsonObject().get("hour_utc").getAsInt());
            }
        }
        return hours;
    }

    /**
     * Top vs bottom quartile of entities_max vs mspt_p95 over the last window.
     */
    public static JsonObject correlation(List<JsonObject> rows, double msptWarn) {
        JsonObject out = new JsonObject();
        out.addProperty("correlated", false);
        out.addProperty("minutes", 0);
        if (rows == null || rows.isEmpty()) {
            return out;
        }
        List<JsonObject> withEntities = new ArrayList<>();
        for (JsonObject row : rows) {
            if (row.has("entities_max") && row.has("mspt_p95")) {
                withEntities.add(row);
            } else if (row.has("entities_max") && row.has("mspt_avg")) {
                withEntities.add(row);
            }
        }
        if (withEntities.size() < CORRELATION_MIN_MINUTES * 2) {
            out.addProperty("minutes", withEntities.size());
            return out;
        }
        withEntities.sort((a, b) -> Double.compare(
                a.get("entities_max").getAsDouble(), b.get("entities_max").getAsDouble()));
        int q = withEntities.size() / 4;
        if (q < CORRELATION_MIN_MINUTES) {
            out.addProperty("minutes", withEntities.size());
            return out;
        }
        List<Double> lowMspt = new ArrayList<>();
        List<Double> highMspt = new ArrayList<>();
        for (int i = 0; i < q; i++) {
            lowMspt.add(msptOf(withEntities.get(i)));
        }
        for (int i = withEntities.size() - q; i < withEntities.size(); i++) {
            highMspt.add(msptOf(withEntities.get(i)));
        }
        double lowP95 = PerformanceRollupAccumulator.percentile(lowMspt, 0.95);
        double highP95 = PerformanceRollupAccumulator.percentile(highMspt, 0.95);
        double ratio = lowP95 > 0.01 ? highP95 / lowP95 : (highP95 > 0 ? 99.0 : 1.0);
        boolean correlated = highP95 >= Math.max(lowP95 * 1.5, msptWarn);
        out.addProperty("correlated", correlated);
        out.addProperty("high_entity_mspt_p95", round1(highP95));
        out.addProperty("low_entity_mspt_p95", round1(lowP95));
        out.addProperty("ratio", round1(ratio));
        out.addProperty("minutes", withEntities.size());
        return out;
    }

    /**
     * Apply sustained classifiers. Returns classifiers + updated streaks.
     */
    public static ClassifyResult classify(
            JsonObject census,
            JsonObject baseline,
            JsonObject prevStreaks,
            boolean learning,
            boolean correlatedWithMspt) {
        JsonArray classifiers = new JsonArray();
        JsonObject streaks = prevStreaks != null ? prevStreaks.deepCopy() : new JsonObject();
        Set<String> activeKeys = new HashSet<>();

        double entitiesP95 = dbl(baseline, "entities_p95", 0);

        JsonArray dims = census.has("dimensions") && census.get("dimensions").isJsonArray()
                ? census.getAsJsonArray("dimensions") : new JsonArray();
        for (JsonElement el : dims) {
            if (!el.isJsonObject()) {
                continue;
            }
            JsonObject d = el.getAsJsonObject();
            String dimId = str(d, "id", "unknown");
            String label = dimensionLabel(dimId);
            long entities = (long) dbl(d, "entities", 0);
            long items = (long) dbl(d, "items", 0);
            long living = (long) dbl(d, "living", 0);
            long loadedChunks = (long) dbl(d, "loaded_chunks", 0);
            long forcedChunks = (long) dbl(d, "forced_chunks", 0);

            // item_storm
            boolean itemAbs = items >= ITEM_STORM_MIN_ITEMS
                    && (entities > 0 && (double) items / entities >= ITEM_STORM_SHARE
                    || (!learning && entitiesP95 > 0 && entities >= entitiesP95 * 2));
            // Absolute share path also works while learning
            if (!itemAbs && items >= ITEM_STORM_MIN_ITEMS && entities > 0
                    && (double) items / entities >= ITEM_STORM_SHARE) {
                itemAbs = true;
            }
            maybeEmit(classifiers, streaks, activeKeys, "item_storm", dimId, label, itemAbs,
                    ITEM_STORM_SUSTAINED,
                    items >= ITEM_STORM_CRITICAL_ITEMS || correlatedWithMspt ? "critical" : "warning",
                    "Item storm in " + label,
                    itemStormDetail(items, entities, label, entitiesP95, learning),
                    items, entities, loadedChunks, forcedChunks,
                    List.of(
                            "Fly to the busiest chunks in " + label + " and check hoppers/void filters on item farms",
                            "Look for broken item vacuum or overflow near forced chunks",
                            "Capture a Spark profile and open World → busy chunks for a precise hotspot"));

            // mob_spike — baseline-gated; silent while learning
            boolean mobAbs = !learning
                    && living >= MOB_SPIKE_MIN_LIVING
                    && entitiesP95 > 0
                    && entities >= entitiesP95 * 2;
            maybeEmit(classifiers, streaks, activeKeys, "mob_spike", dimId, label, mobAbs,
                    MOB_SPIKE_SUSTAINED, "warning",
                    "Mob spike in " + label,
                    String.format(Locale.US,
                            "%,d living entities in %s — total load is %.1fx the quiet-hours normal.",
                            living, label, entitiesP95 > 0 ? entities / entitiesP95 : 0),
                    items, entities, loadedChunks, forcedChunks,
                    List.of(
                            "Check spawners, farms, and mob grinders in " + label,
                            "Confirm entity cramming / despawn settings are intentional",
                            "Capture a Spark profile for entity type hotspots"));
        }

        // Decay streaks not active this scan
        List<String> toRemove = new ArrayList<>();
        for (Map.Entry<String, JsonElement> e : streaks.entrySet()) {
            if (!activeKeys.contains(e.getKey())) {
                toRemove.add(e.getKey());
            }
        }
        for (String k : toRemove) {
            streaks.remove(k);
        }

        return new ClassifyResult(classifiers, streaks);
    }

    public static String dimensionLabel(String id) {
        if (id == null || id.isBlank()) {
            return "Unknown";
        }
        return switch (id) {
            case "minecraft:overworld" -> "Overworld";
            case "minecraft:the_nether" -> "Nether";
            case "minecraft:the_end" -> "The End";
            default -> {
                String leaf = id.contains(":") ? id.substring(id.indexOf(':') + 1) : id;
                String[] parts = leaf.replace('_', ' ').replace('-', ' ').split("\\s+");
                StringBuilder sb = new StringBuilder();
                for (String p : parts) {
                    if (p.isEmpty()) {
                        continue;
                    }
                    if (sb.length() > 0) {
                        sb.append(' ');
                    }
                    sb.append(Character.toUpperCase(p.charAt(0)));
                    if (p.length() > 1) {
                        sb.append(p.substring(1));
                    }
                }
                yield sb.length() > 0 ? sb.toString() : id;
            }
        };
    }

    public record ClassifyResult(JsonArray classifiers, JsonObject streaks) {
    }

    private static JsonArray enrichDimensions(JsonObject census, JsonObject baseline) {
        JsonArray out = new JsonArray();
        JsonArray dims = census.has("dimensions") && census.get("dimensions").isJsonArray()
                ? census.getAsJsonArray("dimensions") : new JsonArray();
        for (JsonElement el : dims) {
            if (!el.isJsonObject()) {
                continue;
            }
            JsonObject d = el.getAsJsonObject().deepCopy();
            String id = str(d, "id", "unknown");
            d.addProperty("label", dimensionLabel(id));
            if (!d.has("unattended")) {
                d.addProperty("unattended",
                        (int) dbl(d, "players", 0) == 0 && dbl(d, "loaded_chunks", 0) > 0);
            }
            JsonObject b = new JsonObject();
            b.addProperty("entities_p50", dbl(baseline, "entities_p50", 0));
            b.addProperty("entities_p95", dbl(baseline, "entities_p95", 0));
            b.addProperty("chunks_p95", dbl(baseline, "chunks_p95", 0));
            b.addProperty("sample_minutes", (int) dbl(baseline, "sample_minutes", 0));
            d.add("baseline", b);
            out.add(d);
        }
        return out;
    }

    private static void maybeEmit(
            JsonArray classifiers,
            JsonObject streaks,
            Set<String> activeKeys,
            String kind,
            String dimId,
            String label,
            boolean absoluteHit,
            int sustainedNeed,
            String severity,
            String headline,
            String detail,
            long items,
            long entities,
            long loadedChunks,
            long forcedChunks,
            List<String> nextSteps) {
        String key = kind + ":" + dimId;
        int streak = streaks.has(key) ? streaks.get(key).getAsInt() : 0;
        if (absoluteHit) {
            streak++;
            streaks.addProperty(key, streak);
            activeKeys.add(key);
        } else {
            return;
        }
        if (streak < sustainedNeed) {
            return;
        }
        JsonObject c = new JsonObject();
        c.addProperty("kind", kind);
        c.addProperty("dimension", dimId);
        c.addProperty("severity", severity);
        c.addProperty("sustained_scans", streak);
        c.addProperty("headline", headline);
        c.addProperty("detail", detail);
        JsonObject evidence = new JsonObject();
        evidence.addProperty("items", items);
        evidence.addProperty("entities", entities);
        evidence.addProperty("loaded_chunks", loadedChunks);
        evidence.addProperty("forced_chunks", forcedChunks);
        c.add("evidence", evidence);
        JsonArray steps = new JsonArray();
        for (String s : nextSteps) {
            steps.add(s);
        }
        c.add("next_steps", steps);
        classifiers.add(c);
    }

    private static String itemStormDetail(long items, long entities, String label, double entitiesP95, boolean learning) {
        double share = entities > 0 ? (100.0 * items / entities) : 0;
        if (learning || entitiesP95 <= 0) {
            return String.format(Locale.US,
                    "%,d item entities in %s — %.0f%% of entities there.",
                    items, label, share);
        }
        return String.format(Locale.US,
                "%,d item entities in %s — %.0f%% of entities there; total load is %.1fx quiet-hours normal.",
                items, label, share, entities / entitiesP95);
    }

    private static double msptOf(JsonObject row) {
        if (row.has("mspt_p95") && !row.get("mspt_p95").isJsonNull()) {
            return row.get("mspt_p95").getAsDouble();
        }
        if (row.has("mspt_avg") && !row.get("mspt_avg").isJsonNull()) {
            return row.get("mspt_avg").getAsDouble();
        }
        return 0;
    }

    private static double dbl(JsonObject o, String key, double def) {
        if (o == null || !o.has(key) || o.get(key).isJsonNull()) {
            return def;
        }
        try {
            return o.get(key).getAsDouble();
        } catch (Exception e) {
            return def;
        }
    }

    private static String str(JsonObject o, String key, String def) {
        if (o == null || !o.has(key) || o.get(key).isJsonNull()) {
            return def;
        }
        return o.get(key).getAsString();
    }

    private static double round1(double v) {
        return Math.round(v * 10.0) / 10.0;
    }
}
