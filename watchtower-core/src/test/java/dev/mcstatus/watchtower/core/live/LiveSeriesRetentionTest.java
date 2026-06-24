package dev.mcstatus.watchtower.core.live;

import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class LiveSeriesRetentionTest {

    @Test
    void pruneRemovesPointsOutsideRetentionWindow() {
        long now = Instant.now().getEpochSecond();
        List<LiveSeriesRetention.Point> points = new ArrayList<>();
        points.add(new LiveSeriesRetention.Point(now - 48 * 3600, 1.0));
        points.add(new LiveSeriesRetention.Point(now - 3600, 2.0));
        points.add(new LiveSeriesRetention.Point(now - 60, 3.0));

        List<LiveSeriesRetention.Point> pruned = LiveSeriesRetention.pruneAndDownsample(points, 24, 150_000);

        assertEquals(2, pruned.size());
        assertTrue(pruned.get(0).epochSec() >= now - 24 * 3600);
    }

    @Test
    void downsampleBucketsOlderThanOneDay() {
        long now = Instant.now().getEpochSecond();
        List<LiveSeriesRetention.Point> points = new ArrayList<>();
        for (int i = 0; i < 120; i++) {
            long t = now - 2 * 24 * 3600 + i * 30L;
            points.add(new LiveSeriesRetention.Point(t, i));
        }

        List<LiveSeriesRetention.Point> out = LiveSeriesRetention.downsample(points, now);

        assertTrue(out.size() < points.size());
        assertTrue(out.size() >= 1);
    }

    @Test
    void appendPointCapsAtMaxPoints() {
        long now = Instant.now().getEpochSecond();
        List<LiveSeriesRetention.Point> series = new ArrayList<>();
        for (int i = 0; i < 200; i++) {
            LiveSeriesRetention.appendPoint(series, now - i, i, 24, 50);
        }
        assertTrue(series.size() <= 50);
    }
}
