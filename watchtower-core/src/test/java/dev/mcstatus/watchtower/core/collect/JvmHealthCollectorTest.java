package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonObject;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class JvmHealthCollectorTest {

    @BeforeEach
    void reset() {
        JvmHealthCollector.resetDeltaStateForTests();
    }

    @Test
    void sampleLiveIncludesGcHeapAndFlags() {
        JsonObject live = JvmHealthCollector.sampleLive();
        assertTrue(live.has("jvm_gc"));
        assertTrue(live.has("heap"));
        assertTrue(live.has("flags"));
        assertTrue(live.has("java_major"));
        assertTrue(live.getAsJsonObject("heap").has("pressure_pct")
                || live.getAsJsonObject("heap").has("used_mb"));
        assertTrue(live.getAsJsonObject("jvm_gc").has("pause_pct_of_wall"));
        assertTrue(live.getAsJsonObject("flags").has("flags_profile"));
    }

    @Test
    void secondSampleCanComputeDelta() throws InterruptedException {
        JvmHealthCollector.sampleLive();
        Thread.sleep(50);
        JsonObject second = JvmHealthCollector.sampleLive();
        assertEquals("delta", second.getAsJsonObject("jvm_gc").get("pause_source").getAsString());
        double pct = second.getAsJsonObject("jvm_gc").get("pause_pct_of_wall").getAsDouble();
        assertTrue(pct >= 0 && pct <= 100);
    }

    @Test
    void sampleReportDoesNotUseWarmupDeltaSource() {
        JvmHealthCollector.resetDeltaStateForTests();
        JsonObject report = JvmHealthCollector.sampleReport(null, 8.0);
        assertEquals("uptime_cumulative",
                report.getAsJsonObject("jvm_gc").get("pause_source").getAsString());
        assertTrue(report.has("flags"));
        assertTrue(report.has("heap"));
    }

    @Test
    void averageL1JvmHealthAveragesRows() throws Exception {
        Path tmp = Files.createTempFile("wt-rollups", ".json");
        try {
            String json = """
                    {
                      "retention_days": 90,
                      "rows": [
                        {"ts":"%s","heap_pressure_pct_avg":80.0,"gc_pause_pct_avg":4.0},
                        {"ts":"%s","heap_pressure_pct_avg":90.0,"gc_pause_pct_avg":6.0}
                      ]
                    }
                    """.formatted(
                    Instant.now().minusSeconds(120).toString(),
                    Instant.now().minusSeconds(60).toString());
            Files.writeString(tmp, json);
            JsonObject avg = JvmHealthCollector.averageL1JvmHealth(tmp, 1);
            assertEquals(85.0, avg.get("heap_pressure_pct_avg").getAsDouble(), 0.01);
            assertEquals(5.0, avg.get("gc_pause_pct_avg").getAsDouble(), 0.01);
            assertEquals(2, avg.get("sample_minutes").getAsInt());
        } finally {
            Files.deleteIfExists(tmp);
        }
    }

    @Test
    void looksLikeServerJvmArgs() {
        assertTrue(JvmHealthCollector.looksLikeServerJvmArgs(List.of("-Xmx8G", "-XX:+UseG1GC")));
        assertFalse(JvmHealthCollector.looksLikeServerJvmArgs(List.of("-cp", "cli.jar")));
        assertFalse(JvmHealthCollector.looksLikeServerJvmArgs(List.of()));
    }

    @Test
    void parseJavaMajor() {
        assertEquals(21, JvmHealthCollector.parseJavaMajor("21", "21.0.2"));
        assertEquals(17, JvmHealthCollector.parseJavaMajor("17", "17.0.9"));
        assertEquals(8, JvmHealthCollector.parseJavaMajor("1.8", "1.8.0_392"));
    }
}
