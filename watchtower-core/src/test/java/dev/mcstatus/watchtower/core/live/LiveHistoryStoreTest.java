package dev.mcstatus.watchtower.core.live;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;
import java.time.Instant;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class LiveHistoryStoreTest {

    @TempDir
    Path tempDir;

    @Test
    void appendRecordsExtendedSeries() throws Exception {
        LiveHistoryStore store = new LiveHistoryStore();
        Path disk = tempDir.resolve("live-history.json");
        store.configure(1, 24, 30, disk);

        JsonObject snap = new JsonObject();
        snap.addProperty("tps", 19.8);
        snap.addProperty("mspt", 2.5);
        snap.addProperty("host_cpu_pct", 42.0);
        snap.addProperty("players_online", 3);
        snap.addProperty("mem_available_gb", 8.5);
        snap.addProperty("disk_use_pct", 12.0);
        JsonObject heap = new JsonObject();
        heap.addProperty("used", 4096);
        heap.addProperty("max", 8192);
        snap.add("heap_mb", heap);

        store.append(snap);
        store.flushToDisk();

        JsonObject samples = store.getSamples(1);
        assertEquals(1, samples.getAsJsonArray("tps").size());
        assertEquals(1, samples.getAsJsonArray("heap_mb").size());
        assertEquals(1, samples.getAsJsonArray("mem_available_gb").size());
        assertEquals(1, samples.getAsJsonArray("disk_use_pct").size());

        store.loadFromDisk();
        JsonObject reloaded = store.getSamples(1);
        assertTrue(reloaded.getAsJsonArray("tps").size() >= 1);
    }

    @Test
    void appendIoMetricsPersistsNetworkAndDiskSeries() throws Exception {
        LiveHistoryStore store = new LiveHistoryStore();
        Path disk = tempDir.resolve("live-history-io.json");
        store.configure(1, 24, 30, disk);

        long epoch = Instant.now().getEpochSecond();
        store.appendIoMetrics(epoch, 12.5, 3.2, 4.1, 0.8);
        store.flushToDisk();

        JsonObject samples = store.getSamples(1);
        assertEquals(1, samples.getAsJsonArray("net_rx_mbps").size());
        assertEquals(1, samples.getAsJsonArray("net_tx_mbps").size());
        assertEquals(1, samples.getAsJsonArray("disk_read_mb_s").size());
        assertEquals(1, samples.getAsJsonArray("disk_write_mb_s").size());

        store.loadFromDisk();
        JsonObject reloaded = store.getSamples(1);
        assertTrue(reloaded.getAsJsonArray("net_rx_mbps").size() >= 1);
        assertTrue(reloaded.getAsJsonArray("disk_read_mb_s").size() >= 1);
    }

    @Test
    void getSamplesForMinutesUsesSubHourWindow() throws Exception {
        LiveHistoryStore store = new LiveHistoryStore();
        store.configure(1, 24, 30, tempDir.resolve("live-history-minutes.json"));

        JsonObject snap = new JsonObject();
        snap.addProperty("tps", 20.0);
        snap.addProperty("mspt", 1.0);
        store.append(snap);

        JsonObject tenMin = store.getSamplesForMinutes(10);
        assertEquals(1, tenMin.getAsJsonArray("tps").size());
        assertEquals(10, tenMin.get("minutes").getAsInt());
    }

    @Test
    void getSamplesSupportsLongRetentionWindow() throws Exception {
        LiveHistoryStore store = new LiveHistoryStore();
        store.configure(1, 2160, 30, tempDir.resolve("live-history-long.json"));

        JsonObject snap = new JsonObject();
        snap.addProperty("tps", 19.0);
        snap.addProperty("mspt", 2.0);
        store.append(snap);

        JsonObject week = store.getSamples(168);
        assertEquals(1, week.getAsJsonArray("tps").size());
        assertEquals(168, week.get("hours").getAsInt());
    }

    @Test
    void getSamplesForMinutesRespectsMaxPointsCap() throws Exception {
        LiveHistoryStore store = new LiveHistoryStore();
        store.configure(1, 24, 30, tempDir.resolve("live-history-cap.json"));

        for (int i = 0; i < 5; i++) {
            JsonObject snap = new JsonObject();
            snap.addProperty("tps", 18.0 + i * 0.2);
            snap.addProperty("mspt", 1.0 + i);
            store.append(snap);
        }

        JsonObject capped = store.getSamplesForMinutes(60, 100);
        JsonArray tps = capped.getAsJsonArray("tps");
        assertTrue(tps.size() >= 1);
        assertEquals(100, capped.get("max_points").getAsInt());
    }

    @Test
    void getWindowBeforeSlicesSeriesEndingAtCrash() throws Exception {
        LiveHistoryStore store = new LiveHistoryStore();
        store.configure(1, 24, 30, tempDir.resolve("live-history-window.json"));

        long end = Instant.now().getEpochSecond();
        for (int i = 0; i < 5; i++) {
            JsonObject snap = new JsonObject();
            snap.addProperty("tps", 19.0 + i * 0.1);
            snap.addProperty("mspt", 10.0 + i);
            store.append(snap);
        }

        JsonObject window = store.getWindowBefore(end, 10);
        JsonObject tps = window.getAsJsonObject("tps");
        assertTrue(tps.getAsJsonArray("points").size() > 0);
        assertTrue(tps.has("min"));
        assertTrue(tps.has("max"));
        assertEquals(10, window.get("window_minutes").getAsInt());
    }
}
