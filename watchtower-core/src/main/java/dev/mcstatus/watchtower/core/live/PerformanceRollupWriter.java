package dev.mcstatus.watchtower.core.live;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.locks.ReentrantReadWriteLock;

/**
 * Persists L1 minute performance rollups and serves tail/summary for the dashboard API.
 */
public final class PerformanceRollupWriter {

    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();

    private final ReentrantReadWriteLock lock = new ReentrantReadWriteLock();
    private final List<JsonObject> rows = new ArrayList<>();
    private Path diskPath;
    private int retentionDays = 90;
    private boolean enabled = true;

    public void configure(Path diskPath, int retentionDays, boolean enabled) {
        lock.writeLock().lock();
        try {
            this.diskPath = diskPath;
            this.retentionDays = Math.max(1, retentionDays);
            this.enabled = enabled;
        } finally {
            lock.writeLock().unlock();
        }
    }

    public boolean enabled() {
        lock.readLock().lock();
        try {
            return enabled;
        } finally {
            lock.readLock().unlock();
        }
    }

    public void loadFromDisk() throws IOException {
        if (diskPath == null || !Files.isRegularFile(diskPath)) {
            return;
        }
        String text = Files.readString(diskPath, StandardCharsets.UTF_8);
        JsonObject root = JsonParser.parseString(text).getAsJsonObject();
        lock.writeLock().lock();
        try {
            rows.clear();
            if (root.has("rows")) {
                for (JsonElement el : root.getAsJsonArray("rows")) {
                    rows.add(el.getAsJsonObject().deepCopy());
                }
            }
        } finally {
            lock.writeLock().unlock();
        }
    }

    public void flushToDisk() throws IOException {
        lock.readLock().lock();
        JsonObject root;
        try {
            root = toJsonUnlocked();
        } finally {
            lock.readLock().unlock();
        }
        if (diskPath == null) {
            return;
        }
        Files.createDirectories(diskPath.getParent());
        Files.writeString(diskPath, GSON.toJson(root) + System.lineSeparator(), StandardCharsets.UTF_8);
    }

    private JsonObject toJsonUnlocked() {
        JsonObject root = new JsonObject();
        root.addProperty("schema", L1RollupSchema.SCHEMA);
        root.addProperty("interval_sec", L1RollupSchema.INTERVAL_SEC);
        root.addProperty("retention_days", retentionDays);
        JsonArray arr = new JsonArray();
        for (JsonObject row : rows) {
            arr.add(row.deepCopy());
        }
        root.add("rows", arr);
        return root;
    }

    public void appendRow(JsonObject row) {
        if (!enabled || row == null) {
            return;
        }
        lock.writeLock().lock();
        try {
            String ts = row.has("ts") ? row.get("ts").getAsString() : null;
            if (ts != null) {
                rows.removeIf(existing -> ts.equals(existing.has("ts") ? existing.get("ts").getAsString() : null));
            }
            rows.add(row.deepCopy());
            trimUnlocked();
        } finally {
            lock.writeLock().unlock();
        }
    }

    private void trimUnlocked() {
        long cutoff = Instant.now().getEpochSecond() - (long) retentionDays * 86400L;
        rows.removeIf(row -> {
            if (!row.has("ts")) {
                return false;
            }
            try {
                return Instant.parse(row.get("ts").getAsString()).getEpochSecond() < cutoff;
            } catch (Exception e) {
                return false;
            }
        });
    }

    public boolean isEmpty() {
        lock.readLock().lock();
        try {
            return rows.isEmpty();
        } finally {
            lock.readLock().unlock();
        }
    }

    /**
     * Idempotent backfill from L0 {@code live-history.json} content.
     *
     * @return number of rows added
     */
    public int backfillFromLiveHistory(JsonObject liveHistory, double tpsWarn) {
        if (liveHistory == null || !liveHistory.has("series")) {
            return 0;
        }
        JsonObject series = liveHistory.getAsJsonObject("series");
        Map<Long, MinuteBucket> buckets = new HashMap<>();

        mergeSeries(buckets, series, "tps", SeriesKind.TPS);
        mergeSeries(buckets, series, "mspt", SeriesKind.MSPT);
        mergeSeries(buckets, series, "players", SeriesKind.PLAYERS);
        mergeSeries(buckets, series, "heap_mb", SeriesKind.HEAP_MB);
        mergeSeries(buckets, series, "host_cpu", SeriesKind.CPU);
        mergeSeries(buckets, series, "mem_used_gb", SeriesKind.MEM);

        Set<String> existingTs = new HashSet<>();
        lock.readLock().lock();
        try {
            for (JsonObject row : rows) {
                if (row.has("ts")) {
                    existingTs.add(row.get("ts").getAsString());
                }
            }
        } finally {
            lock.readLock().unlock();
        }

        List<Long> minutes = new ArrayList<>(buckets.keySet());
        minutes.sort(Long::compareTo);
        int added = 0;
        for (Long minute : minutes) {
            PerformanceRollupAccumulator acc = buckets.get(minute).toAccumulator(tpsWarn);
            if (acc.isEmpty()) {
                continue;
            }
            JsonObject row = acc.finalizeRow(minute);
            String ts = row.get("ts").getAsString();
            if (existingTs.contains(ts)) {
                continue;
            }
            appendRow(row);
            added++;
        }
        return added;
    }

    private enum SeriesKind {
        TPS, MSPT, PLAYERS, HEAP_MB, CPU, MEM
    }

    private static void mergeSeries(Map<Long, MinuteBucket> buckets, JsonObject series, String key, SeriesKind kind) {
        if (!series.has(key)) {
            return;
        }
        JsonArray arr = series.getAsJsonArray(key);
        for (JsonElement el : arr) {
            JsonObject pt = el.getAsJsonObject();
            if (!pt.has("t") || !pt.has("v")) {
                continue;
            }
            long epoch;
            try {
                epoch = Instant.parse(pt.get("t").getAsString()).getEpochSecond();
            } catch (Exception e) {
                continue;
            }
            long minute = epoch - (epoch % 60);
            MinuteBucket bucket = buckets.computeIfAbsent(minute, k -> new MinuteBucket());
            double v = pt.get("v").getAsDouble();
            switch (kind) {
                case TPS -> bucket.tps.add(v);
                case MSPT -> bucket.mspt.add(v);
                case PLAYERS -> bucket.players.add((int) Math.round(v));
                case HEAP_MB -> bucket.heapUsedGb.add(v / 1024.0);
                case CPU -> bucket.cpu.add(v);
                case MEM -> bucket.memUsedGb.add(v);
                default -> { }
            }
        }
    }

    private static final class MinuteBucket {
        final List<Double> tps = new ArrayList<>();
        final List<Double> mspt = new ArrayList<>();
        final List<Integer> players = new ArrayList<>();
        final List<Double> heapUsedGb = new ArrayList<>();
        final List<Double> memUsedGb = new ArrayList<>();
        final List<Double> cpu = new ArrayList<>();

        PerformanceRollupAccumulator toAccumulator(double tpsWarn) {
            PerformanceRollupAccumulator acc = new PerformanceRollupAccumulator();
            int n = Math.max(mspt.size(), Math.max(tps.size(), players.size()));
            for (int i = 0; i < n; i++) {
                Double t = i < tps.size() ? tps.get(i) : null;
                Double m = i < mspt.size() ? mspt.get(i) : null;
                int p = i < players.size() ? players.get(i) : 0;
                Double h = i < heapUsedGb.size() ? heapUsedGb.get(i) : null;
                Double mem = i < memUsedGb.size() ? memUsedGb.get(i) : null;
                Double c = i < cpu.size() ? cpu.get(i) : null;
                acc.addSample(t, m, p, h, mem, c, tpsWarn);
            }
            return acc;
        }
    }

    public JsonObject buildApiResponse(int hours) {
        JsonObject out = new JsonObject();
        int cappedHours = Math.max(1, Math.min(hours, retentionDays * 24));
        out.addProperty("enabled", enabled);
        out.addProperty("hours", cappedHours);

        if (!enabled) {
            out.add("summary", emptySummary());
            out.add("rows", new JsonArray());
            return out;
        }

        long cutoff = Instant.now().getEpochSecond() - (long) cappedHours * 3600L;
        List<JsonObject> window = new ArrayList<>();
        lock.readLock().lock();
        try {
            for (JsonObject row : rows) {
                if (!row.has("ts")) {
                    continue;
                }
                try {
                    if (Instant.parse(row.get("ts").getAsString()).getEpochSecond() >= cutoff) {
                        window.add(row);
                    }
                } catch (Exception ignored) {
                    // skip malformed
                }
            }
        } finally {
            lock.readLock().unlock();
        }

        out.add("summary", buildSummary(window));
        JsonArray arr = new JsonArray();
        for (JsonObject row : window) {
            arr.add(row.deepCopy());
        }
        out.add("rows", arr);
        return out;
    }

    private static JsonObject emptySummary() {
        JsonObject s = new JsonObject();
        s.addProperty("sample_minutes", 0);
        return s;
    }

    private static JsonObject buildSummary(List<JsonObject> window) {
        JsonObject s = new JsonObject();
        s.addProperty("sample_minutes", window.size());
        if (window.isEmpty()) {
            return s;
        }

        List<Double> tpsAvg = new ArrayList<>();
        List<Double> tpsMin = new ArrayList<>();
        List<Double> msptAvg = new ArrayList<>();
        List<Double> msptP95 = new ArrayList<>();
        List<Integer> playersMax = new ArrayList<>();
        int lowTpsMinutes = 0;

        for (JsonObject row : window) {
            if (row.has("tps_avg")) {
                tpsAvg.add(row.get("tps_avg").getAsDouble());
            }
            if (row.has("tps_min")) {
                tpsMin.add(row.get("tps_min").getAsDouble());
            }
            if (row.has("mspt_avg")) {
                msptAvg.add(row.get("mspt_avg").getAsDouble());
            }
            if (row.has("mspt_p95")) {
                msptP95.add(row.get("mspt_p95").getAsDouble());
            }
            if (row.has("players_max")) {
                playersMax.add(row.get("players_max").getAsInt());
            }
            if (row.has("low_tps_flag") && row.get("low_tps_flag").getAsBoolean()) {
                lowTpsMinutes++;
            }
        }

        if (!tpsAvg.isEmpty()) {
            s.addProperty("tps_avg", PerformanceRollupAccumulator.round2(PerformanceRollupAccumulator.avg(tpsAvg)));
        }
        if (!tpsMin.isEmpty()) {
            s.addProperty("tps_min", PerformanceRollupAccumulator.round2(java.util.Collections.min(tpsMin)));
        }
        if (!msptAvg.isEmpty()) {
            s.addProperty("mspt_avg", PerformanceRollupAccumulator.round1(PerformanceRollupAccumulator.avg(msptAvg)));
        }
        if (!msptP95.isEmpty()) {
            s.addProperty("mspt_p95", PerformanceRollupAccumulator.round1(PerformanceRollupAccumulator.p95(msptP95)));
        }
        if (!playersMax.isEmpty()) {
            s.addProperty("players_max", java.util.Collections.max(playersMax));
        }
        s.addProperty("low_tps_minutes", lowTpsMinutes);
        return s;
    }

    /**
     * Read rollups from disk and build a summary for the given hour window (no live writer instance required).
     */
    public static JsonObject summarizeFromFile(Path diskPath, int hours) {
        if (diskPath == null || !Files.isRegularFile(diskPath)) {
            return emptySummary();
        }
        try {
            String text = Files.readString(diskPath, StandardCharsets.UTF_8);
            JsonObject root = JsonParser.parseString(text).getAsJsonObject();
            int retentionDays = root.has("retention_days") ? root.get("retention_days").getAsInt() : 90;
            int cappedHours = Math.max(1, Math.min(hours, retentionDays * 24));
            long cutoff = Instant.now().getEpochSecond() - (long) cappedHours * 3600L;
            List<JsonObject> window = new ArrayList<>();
            if (root.has("rows")) {
                for (JsonElement el : root.getAsJsonArray("rows")) {
                    JsonObject row = el.getAsJsonObject();
                    if (!row.has("ts")) {
                        continue;
                    }
                    try {
                        if (Instant.parse(row.get("ts").getAsString()).getEpochSecond() >= cutoff) {
                            window.add(row);
                        }
                    } catch (Exception ignored) {
                        // skip malformed
                    }
                }
            }
            return buildSummaryWithJitter(window);
        } catch (IOException | RuntimeException e) {
            return emptySummary();
        }
    }

    private static JsonObject buildSummaryWithJitter(List<JsonObject> window) {
        JsonObject s = buildSummary(window);
        double jitterMax = 0;
        for (JsonObject row : window) {
            if (row.has("mspt_jitter_max")) {
                jitterMax = Math.max(jitterMax, row.get("mspt_jitter_max").getAsDouble());
            }
        }
        if (jitterMax > 0) {
            s.addProperty("mspt_jitter_max_24h", PerformanceRollupAccumulator.round1(jitterMax));
        }
        return s;
    }

    /**
     * Load minute rollup rows from disk for the given hour window (newest-first sort not applied).
     */
    public static List<JsonObject> loadRowsFromFile(Path diskPath, int hours) {
        List<JsonObject> window = new ArrayList<>();
        if (diskPath == null || !Files.isRegularFile(diskPath)) {
            return window;
        }
        try {
            String text = Files.readString(diskPath, StandardCharsets.UTF_8);
            JsonObject root = JsonParser.parseString(text).getAsJsonObject();
            int retentionDays = root.has("retention_days") ? root.get("retention_days").getAsInt() : 90;
            int cappedHours = Math.max(1, Math.min(hours, retentionDays * 24));
            long cutoff = Instant.now().getEpochSecond() - (long) cappedHours * 3600L;
            if (root.has("rows")) {
                for (JsonElement el : root.getAsJsonArray("rows")) {
                    JsonObject row = el.getAsJsonObject();
                    if (!row.has("ts")) {
                        continue;
                    }
                    try {
                        if (Instant.parse(row.get("ts").getAsString()).getEpochSecond() >= cutoff) {
                            window.add(row.deepCopy());
                        }
                    } catch (Exception ignored) {
                        // skip malformed
                    }
                }
            }
        } catch (IOException | RuntimeException ignored) {
        }
        return window;
    }

    /**
     * Load rows from an in-memory writer instance for the given hour window.
     */
    public List<JsonObject> loadRowsForHours(int hours) {
        int cappedHours = Math.max(1, Math.min(hours, retentionDays * 24));
        long cutoff = Instant.now().getEpochSecond() - (long) cappedHours * 3600L;
        List<JsonObject> window = new ArrayList<>();
        lock.readLock().lock();
        try {
            for (JsonObject row : rows) {
                if (!row.has("ts")) {
                    continue;
                }
                try {
                    if (Instant.parse(row.get("ts").getAsString()).getEpochSecond() >= cutoff) {
                        window.add(row.deepCopy());
                    }
                } catch (Exception ignored) {
                    // skip malformed
                }
            }
        } finally {
            lock.readLock().unlock();
        }
        return window;
    }
}
