package dev.mcstatus.watchtower.core.live;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;

/**
 * Prune and downsample live metric series for long retention windows.
 */
public final class LiveSeriesRetention {

    public record Point(long epochSec, double value) {
    }

    private static final long HOUR = 3600L;
    private static final long DAY = 24 * HOUR;

    private LiveSeriesRetention() {
    }

    public static List<Point> pruneAndDownsample(List<Point> points, int retentionHours, int maxPoints) {
        if (points == null || points.isEmpty()) {
            return List.of();
        }
        long now = Instant.now().getEpochSecond();
        long cutoff = now - (long) retentionHours * HOUR;
        List<Point> inWindow = new ArrayList<>();
        for (Point p : points) {
            if (p.epochSec() >= cutoff) {
                inWindow.add(p);
            }
        }
        if (inWindow.isEmpty()) {
            return List.of();
        }
        List<Point> downsampled = downsample(inWindow, now);
        if (downsampled.size() > maxPoints) {
            return downsampled.subList(downsampled.size() - maxPoints, downsampled.size());
        }
        return downsampled;
    }

    static List<Point> downsample(List<Point> sorted, long nowSec) {
        long rawCutoff = nowSec - DAY;
        long midCutoff = nowSec - 7 * DAY;

        List<Point> raw = new ArrayList<>();
        List<Point> mid = new ArrayList<>();
        List<Point> old = new ArrayList<>();

        for (Point p : sorted) {
            if (p.epochSec() >= rawCutoff) {
                raw.add(p);
            } else if (p.epochSec() >= midCutoff) {
                mid.add(p);
            } else {
                old.add(p);
            }
        }

        List<Point> out = new ArrayList<>(raw);
        out.addAll(bucket(mid, 60));
        out.addAll(bucket(old, 300));
        out.sort((a, b) -> Long.compare(a.epochSec(), b.epochSec()));
        return out;
    }

    private static List<Point> bucket(List<Point> points, long bucketSec) {
        if (points.isEmpty()) {
            return List.of();
        }
        List<Point> out = new ArrayList<>();
        long bucketStart = -1;
        double sum = 0;
        int count = 0;
        for (Point p : points) {
            long b = (p.epochSec() / bucketSec) * bucketSec;
            if (bucketStart < 0) {
                bucketStart = b;
            }
            if (b != bucketStart) {
                out.add(new Point(bucketStart, sum / count));
                bucketStart = b;
                sum = p.value();
                count = 1;
            } else {
                sum += p.value();
                count++;
            }
        }
        if (count > 0) {
            out.add(new Point(bucketStart, sum / count));
        }
        return out;
    }

    public static void appendPoint(List<Point> series, long epochSec, double value, int retentionHours, int maxPoints) {
        series.add(new Point(epochSec, value));
        series.sort((a, b) -> Long.compare(a.epochSec(), b.epochSec()));
        List<Point> pruned = pruneAndDownsample(series, retentionHours, maxPoints);
        series.clear();
        series.addAll(pruned);
    }
}
