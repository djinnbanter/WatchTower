package dev.mcstatus.watchtower;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class LiveMetricsServiceRollupTest {

    @Test
    void floorMinuteEpochAlignsToMinuteStart() {
        assertEquals(1_700_000_040L, LiveMetricsService.floorMinuteEpoch(1_700_000_040L));
        assertEquals(1_700_000_040L, LiveMetricsService.floorMinuteEpoch(1_700_000_059L));
        assertEquals(1_699_999_980L, LiveMetricsService.floorMinuteEpoch(1_700_000_000L));
        assertEquals(1_699_999_980L, LiveMetricsService.floorMinuteEpoch(1_699_999_980L));
        assertEquals(0L, LiveMetricsService.floorMinuteEpoch(0L));
    }

    @Test
    void unbindServerSourceDoesNotFlushRawEpoch() throws Exception {
        String text = java.nio.file.Files.readString(
                java.nio.file.Path.of("src/main/java/dev/mcstatus/watchtower/LiveMetricsService.java"));
        int unbind = text.indexOf("public void unbindServer()");
        assertTrue(unbind >= 0);
        String body = text.substring(unbind, Math.min(text.length(), unbind + 500));
        assertFalse(body.contains("flushOpenRollupMinute(Instant.now().getEpochSecond())"),
                "unbind must not flush with raw epoch seconds");
        assertTrue(body.contains("floorMinuteEpoch") || body.contains("openRollupMinuteEpoch"),
                "unbind must flush floored or open minute");
    }
}
