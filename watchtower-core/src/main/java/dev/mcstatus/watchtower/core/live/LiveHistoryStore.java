package dev.mcstatus.watchtower.core.live;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.locks.ReentrantReadWriteLock;

/**
 * In-memory live metric history with tiered retention and periodic disk flush.
 */
public final class LiveHistoryStore {

    public static final int SCHEMA = 1;
    public static final int MAX_SERIES_POINTS = 150_000;

    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();

    private final ReentrantReadWriteLock lock = new ReentrantReadWriteLock();
    private final List<LiveSeriesRetention.Point> msptSeries = new ArrayList<>();
    private final List<LiveSeriesRetention.Point> tpsSeries = new ArrayList<>();
    private final List<LiveSeriesRetention.Point> hostCpuSeries = new ArrayList<>();
    private final List<LiveSeriesRetention.Point> playersSeries = new ArrayList<>();
    private final List<LiveSeriesRetention.Point> heapMbSeries = new ArrayList<>();
    private final List<LiveSeriesRetention.Point> memAvailableSeries = new ArrayList<>();
    private final List<LiveSeriesRetention.Point> memUsedSeries = new ArrayList<>();
    private final List<LiveSeriesRetention.Point> memTotalSeries = new ArrayList<>();
    private final List<LiveSeriesRetention.Point> diskUseSeries = new ArrayList<>();
    private final List<LiveSeriesRetention.Point> netRxMbpsSeries = new ArrayList<>();
    private final List<LiveSeriesRetention.Point> netTxMbpsSeries = new ArrayList<>();
    private final List<LiveSeriesRetention.Point> diskReadMbSSeries = new ArrayList<>();
    private final List<LiveSeriesRetention.Point> diskWriteMbSSeries = new ArrayList<>();

    private JsonObject latest = new JsonObject();
    private int sampleIntervalSec = 1;
    private int retentionHours = 24;
    private Path diskPath;
    private long lastFlushEpochSec;
    private int flushIntervalSec = 30;

    public void configure(int sampleIntervalSec, int retentionHours, int flushIntervalSec, Path diskPath) {
        lock.writeLock().lock();
        try {
            this.sampleIntervalSec = sampleIntervalSec;
            this.retentionHours = retentionHours;
            this.flushIntervalSec = flushIntervalSec;
            this.diskPath = diskPath;
        } finally {
            lock.writeLock().unlock();
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
            if (root.has("sample_interval_sec")) {
                sampleIntervalSec = root.get("sample_interval_sec").getAsInt();
            }
            if (root.has("retention_hours")) {
                retentionHours = root.get("retention_hours").getAsInt();
            }
            if (root.has("latest")) {
                latest = root.getAsJsonObject("latest").deepCopy();
            }
            JsonObject series = root.getAsJsonObject("series");
            loadSeries(series, "mspt", msptSeries);
            loadSeries(series, "tps", tpsSeries);
            loadSeries(series, "host_cpu", hostCpuSeries);
            loadSeries(series, "players", playersSeries);
            loadSeries(series, "heap_mb", heapMbSeries);
            loadSeries(series, "mem_available_gb", memAvailableSeries);
            loadSeries(series, "mem_used_gb", memUsedSeries);
            loadSeries(series, "mem_total_gb", memTotalSeries);
            loadSeries(series, "disk_use_pct", diskUseSeries);
            loadSeries(series, "net_rx_mbps", netRxMbpsSeries);
            loadSeries(series, "net_tx_mbps", netTxMbpsSeries);
            loadSeries(series, "disk_read_mb_s", diskReadMbSSeries);
            loadSeries(series, "disk_write_mb_s", diskWriteMbSSeries);
        } finally {
            lock.writeLock().unlock();
        }
    }

    private static void loadSeries(JsonObject series, String key, List<LiveSeriesRetention.Point> target) {
        target.clear();
        if (series == null || !series.has(key)) {
            return;
        }
        JsonArray arr = series.getAsJsonArray(key);
        for (var el : arr) {
            JsonObject o = el.getAsJsonObject();
            long t = Instant.parse(o.get("t").getAsString()).getEpochSecond();
            double v = o.get("v").getAsDouble();
            target.add(new LiveSeriesRetention.Point(t, v));
        }
    }

    public void append(JsonObject snapshot) {
        long epoch = Instant.now().getEpochSecond();
        lock.writeLock().lock();
        try {
            latest = snapshot.deepCopy();
            double mspt = snapshot.has("mspt") ? snapshot.get("mspt").getAsDouble() : 0;
            LiveSeriesRetention.appendPoint(msptSeries, epoch, mspt, retentionHours, MAX_SERIES_POINTS);
            if (snapshot.has("tps") && !snapshot.get("tps").isJsonNull()) {
                LiveSeriesRetention.appendPoint(tpsSeries, epoch,
                        snapshot.get("tps").getAsDouble(), retentionHours, MAX_SERIES_POINTS);
            }
            if (snapshot.has("host_cpu_pct") && !snapshot.get("host_cpu_pct").isJsonNull()) {
                LiveSeriesRetention.appendPoint(hostCpuSeries, epoch,
                        snapshot.get("host_cpu_pct").getAsDouble(), retentionHours, MAX_SERIES_POINTS);
            }
            if (snapshot.has("players_online")) {
                LiveSeriesRetention.appendPoint(playersSeries, epoch,
                        snapshot.get("players_online").getAsInt(), retentionHours, MAX_SERIES_POINTS);
            }
            if (snapshot.has("heap_mb") && snapshot.get("heap_mb").isJsonObject()) {
                JsonObject heap = snapshot.getAsJsonObject("heap_mb");
                if (heap.has("used")) {
                    LiveSeriesRetention.appendPoint(heapMbSeries, epoch,
                            heap.get("used").getAsDouble(), retentionHours, MAX_SERIES_POINTS);
                }
            }
            if (snapshot.has("mem_available_gb") && !snapshot.get("mem_available_gb").isJsonNull()) {
                LiveSeriesRetention.appendPoint(memAvailableSeries, epoch,
                        snapshot.get("mem_available_gb").getAsDouble(), retentionHours, MAX_SERIES_POINTS);
            }
            if (snapshot.has("mem_used_gb") && !snapshot.get("mem_used_gb").isJsonNull()) {
                LiveSeriesRetention.appendPoint(memUsedSeries, epoch,
                        snapshot.get("mem_used_gb").getAsDouble(), retentionHours, MAX_SERIES_POINTS);
            }
            if (snapshot.has("mem_total_gb") && !snapshot.get("mem_total_gb").isJsonNull()) {
                LiveSeriesRetention.appendPoint(memTotalSeries, epoch,
                        snapshot.get("mem_total_gb").getAsDouble(), retentionHours, MAX_SERIES_POINTS);
            }
            if (snapshot.has("disk_use_pct") && !snapshot.get("disk_use_pct").isJsonNull()) {
                LiveSeriesRetention.appendPoint(diskUseSeries, epoch,
                        snapshot.get("disk_use_pct").getAsDouble(), retentionHours, MAX_SERIES_POINTS);
            }
            appendOptionalPoint(snapshot, "net_rx_mbps", netRxMbpsSeries, epoch);
            appendOptionalPoint(snapshot, "net_tx_mbps", netTxMbpsSeries, epoch);
            appendOptionalPoint(snapshot, "disk_read_mb_s", diskReadMbSSeries, epoch);
            appendOptionalPoint(snapshot, "disk_write_mb_s", diskWriteMbSSeries, epoch);
            maybeFlush(epoch);
        } finally {
            lock.writeLock().unlock();
        }
    }

    /**
     * Record network and disk I/O rates (sampled ~every 30s on the server).
     */
    public void appendIoMetrics(long epoch, Double rxMbps, Double txMbps, Double readMbS, Double writeMbS) {
        lock.writeLock().lock();
        try {
            if (rxMbps != null) {
                LiveSeriesRetention.appendPoint(netRxMbpsSeries, epoch, rxMbps, retentionHours, MAX_SERIES_POINTS);
            }
            if (txMbps != null) {
                LiveSeriesRetention.appendPoint(netTxMbpsSeries, epoch, txMbps, retentionHours, MAX_SERIES_POINTS);
            }
            if (readMbS != null) {
                LiveSeriesRetention.appendPoint(diskReadMbSSeries, epoch, readMbS, retentionHours, MAX_SERIES_POINTS);
            }
            if (writeMbS != null) {
                LiveSeriesRetention.appendPoint(diskWriteMbSSeries, epoch, writeMbS, retentionHours, MAX_SERIES_POINTS);
            }
            maybeFlush(epoch);
        } finally {
            lock.writeLock().unlock();
        }
    }

    private void appendOptionalPoint(JsonObject snapshot, String key, List<LiveSeriesRetention.Point> series, long epoch) {
        if (snapshot.has(key) && !snapshot.get(key).isJsonNull()) {
            LiveSeriesRetention.appendPoint(series, epoch, snapshot.get(key).getAsDouble(), retentionHours, MAX_SERIES_POINTS);
        }
    }

    private void maybeFlush(long epoch) {
        if (diskPath == null) {
            return;
        }
        if (epoch - lastFlushEpochSec < flushIntervalSec) {
            return;
        }
        lastFlushEpochSec = epoch;
        try {
            flushToDiskUnlocked();
        } catch (IOException ignored) {
        }
    }

    public void flushToDisk() throws IOException {
        lock.writeLock().lock();
        try {
            flushToDiskUnlocked();
            lastFlushEpochSec = Instant.now().getEpochSecond();
        } finally {
            lock.writeLock().unlock();
        }
    }

    private void flushToDiskUnlocked() throws IOException {
        if (diskPath == null) {
            return;
        }
        Files.createDirectories(diskPath.getParent());
        Files.writeString(diskPath, GSON.toJson(toJsonUnlocked()) + System.lineSeparator(), StandardCharsets.UTF_8);
    }

    public JsonObject getLatestWithMeta() {
        lock.readLock().lock();
        try {
            JsonObject out = new JsonObject();
            out.addProperty("schema", SCHEMA);
            out.addProperty("sample_interval_sec", sampleIntervalSec);
            out.addProperty("retention_hours", retentionHours);
            out.add("latest", latest.deepCopy());
            return out;
        } finally {
            lock.readLock().unlock();
        }
    }

    public JsonObject getSamples(int hours) {
        return getSamplesForWindow((long) hours * 3600L, hours, null, 2000);
    }

    public JsonObject getSamples(int hours, int maxPoints) {
        return getSamplesForWindow((long) hours * 3600L, hours, null, maxPoints);
    }

    public JsonObject getSamplesForMinutes(int minutes) {
        return getSamplesForWindow((long) minutes * 60L, null, minutes, 2000);
    }

    public JsonObject getSamplesForMinutes(int minutes, int maxPoints) {
        return getSamplesForWindow((long) minutes * 60L, null, minutes, maxPoints);
    }

    private JsonObject getSamplesForWindow(long windowSec, Integer hoursLabel, Integer minutesLabel, int maxPoints) {
        long cutoff = Instant.now().getEpochSecond() - windowSec;
        lock.readLock().lock();
        try {
            JsonObject out = new JsonObject();
            int cap = Math.max(100, Math.min(5000, maxPoints));
            out.add("mspt", cappedSeriesArray(msptSeries, cutoff, cap));
            out.add("tps", cappedSeriesArray(tpsSeries, cutoff, cap));
            out.add("host_cpu", cappedSeriesArray(hostCpuSeries, cutoff, cap));
            out.add("players", cappedSeriesArray(playersSeries, cutoff, cap));
            out.add("heap_mb", cappedSeriesArray(heapMbSeries, cutoff, cap));
            out.add("mem_available_gb", cappedSeriesArray(memAvailableSeries, cutoff, cap));
            out.add("mem_used_gb", cappedSeriesArray(memUsedSeries, cutoff, cap));
            out.add("mem_total_gb", cappedSeriesArray(memTotalSeries, cutoff, cap));
            out.add("disk_use_pct", cappedSeriesArray(diskUseSeries, cutoff, cap));
            out.add("net_rx_mbps", cappedSeriesArray(netRxMbpsSeries, cutoff, cap));
            out.add("net_tx_mbps", cappedSeriesArray(netTxMbpsSeries, cutoff, cap));
            out.add("disk_read_mb_s", cappedSeriesArray(diskReadMbSSeries, cutoff, cap));
            out.add("disk_write_mb_s", cappedSeriesArray(diskWriteMbSSeries, cutoff, cap));
            out.addProperty("max_points", cap);
            if (minutesLabel != null) {
                out.addProperty("minutes", minutesLabel);
            }
            if (hoursLabel != null) {
                out.addProperty("hours", hoursLabel);
            }
            return out;
        } finally {
            lock.readLock().unlock();
        }
    }

    /**
     * Slice live series in {@code [endEpoch - minutes, endEpoch]} for pre-crash context.
     */
    public JsonObject getWindowBefore(long endEpochSec, int minutes) {
        long startEpoch = endEpochSec - (long) minutes * 60L;
        lock.readLock().lock();
        try {
            JsonObject out = new JsonObject();
            out.addProperty("window_minutes", minutes);
            out.addProperty("retention_hours", retentionHours);
            JsonObject tps = windowSeriesStats(tpsSeries, startEpoch, endEpochSec, 60, true);
            JsonObject mspt = windowSeriesStats(msptSeries, startEpoch, endEpochSec, 0, false);
            JsonObject players = windowLastStats(playersSeries, startEpoch, endEpochSec);
            out.add("tps", tps);
            out.add("mspt", mspt);
            out.add("players", players);
            boolean hasSamples = tps.has("points") && tps.getAsJsonArray("points").size() > 0;
            if (!hasSamples) {
                out.addProperty("unavailable_reason", "no_live_samples");
            }
            return out;
        } finally {
            lock.readLock().unlock();
        }
    }

    private static JsonObject windowSeriesStats(
            List<LiveSeriesRetention.Point> series,
            long startEpoch,
            long endEpoch,
            int maxPoints,
            boolean includeMin) {
        JsonObject out = new JsonObject();
        List<LiveSeriesRetention.Point> window = new ArrayList<>();
        for (LiveSeriesRetention.Point p : series) {
            if (p.epochSec() >= startEpoch && p.epochSec() <= endEpoch) {
                window.add(p);
            }
        }
        if (window.isEmpty()) {
            out.add("points", new JsonArray());
            return out;
        }
        double min = Double.MAX_VALUE;
        double max = Double.MIN_VALUE;
        double last = window.get(window.size() - 1).value();
        for (LiveSeriesRetention.Point p : window) {
            min = Math.min(min, p.value());
            max = Math.max(max, p.value());
        }
        if (includeMin) {
            out.addProperty("min", round2(min));
        }
        out.addProperty("max", round2(max));
        out.addProperty("last", round2(last));
        out.add("points", downsamplePoints(window, maxPoints));
        return out;
    }

    private static JsonObject windowLastStats(
            List<LiveSeriesRetention.Point> series,
            long startEpoch,
            long endEpoch) {
        JsonObject out = new JsonObject();
        LiveSeriesRetention.Point last = null;
        for (LiveSeriesRetention.Point p : series) {
            if (p.epochSec() >= startEpoch && p.epochSec() <= endEpoch) {
                last = p;
            }
        }
        if (last != null) {
            out.addProperty("last", (int) Math.round(last.value()));
        }
        return out;
    }

    private static JsonArray downsamplePoints(List<LiveSeriesRetention.Point> window, int maxPoints) {
        JsonArray arr = new JsonArray();
        if (window.isEmpty()) {
            return arr;
        }
        int step = maxPoints > 0 && window.size() > maxPoints
                ? (int) Math.ceil((double) window.size() / maxPoints) : 1;
        for (int i = 0; i < window.size(); i += step) {
            LiveSeriesRetention.Point p = window.get(i);
            JsonObject o = new JsonObject();
            o.addProperty("t", Instant.ofEpochSecond(p.epochSec()).toString());
            o.addProperty("v", round2(p.value()));
            arr.add(o);
        }
        LiveSeriesRetention.Point tail = window.get(window.size() - 1);
        JsonObject lastObj = arr.size() > 0 ? arr.get(arr.size() - 1).getAsJsonObject() : null;
        String tailT = Instant.ofEpochSecond(tail.epochSec()).toString();
        if (lastObj == null || !tailT.equals(lastObj.get("t").getAsString())) {
            JsonObject o = new JsonObject();
            o.addProperty("t", tailT);
            o.addProperty("v", round2(tail.value()));
            arr.add(o);
        }
        return arr;
    }

    private static double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }

    private static JsonArray cappedSeriesArray(List<LiveSeriesRetention.Point> series, long cutoff, int maxPoints) {
        List<LiveSeriesRetention.Point> window = new ArrayList<>();
        for (LiveSeriesRetention.Point p : series) {
            if (p.epochSec() >= cutoff) {
                window.add(p);
            }
        }
        return downsamplePoints(window, maxPoints);
    }

    private static JsonArray seriesArray(List<LiveSeriesRetention.Point> series, long cutoff) {
        JsonArray arr = new JsonArray();
        for (LiveSeriesRetention.Point p : series) {
            if (p.epochSec() < cutoff) {
                continue;
            }
            JsonObject o = new JsonObject();
            o.addProperty("t", Instant.ofEpochSecond(p.epochSec()).toString());
            o.addProperty("v", Math.round(p.value() * 100.0) / 100.0);
            arr.add(o);
        }
        return arr;
    }

    private JsonObject toJsonUnlocked() {
        JsonObject root = new JsonObject();
        root.addProperty("schema", SCHEMA);
        root.addProperty("sample_interval_sec", sampleIntervalSec);
        root.addProperty("retention_hours", retentionHours);
        root.add("latest", latest.deepCopy());
        JsonObject series = new JsonObject();
        series.add("mspt", seriesArray(msptSeries, 0));
        series.add("tps", seriesArray(tpsSeries, 0));
        series.add("host_cpu", seriesArray(hostCpuSeries, 0));
        series.add("players", seriesArray(playersSeries, 0));
        series.add("heap_mb", seriesArray(heapMbSeries, 0));
        series.add("mem_available_gb", seriesArray(memAvailableSeries, 0));
        series.add("mem_used_gb", seriesArray(memUsedSeries, 0));
        series.add("mem_total_gb", seriesArray(memTotalSeries, 0));
        series.add("disk_use_pct", seriesArray(diskUseSeries, 0));
        series.add("net_rx_mbps", seriesArray(netRxMbpsSeries, 0));
        series.add("net_tx_mbps", seriesArray(netTxMbpsSeries, 0));
        series.add("disk_read_mb_s", seriesArray(diskReadMbSSeries, 0));
        series.add("disk_write_mb_s", seriesArray(diskWriteMbSSeries, 0));
        root.add("series", series);
        return root;
    }
}
