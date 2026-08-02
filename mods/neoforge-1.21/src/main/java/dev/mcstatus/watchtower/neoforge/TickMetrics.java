package dev.mcstatus.watchtower.neoforge;

import net.neoforged.bus.api.SubscribeEvent;
import net.neoforged.fml.common.EventBusSubscriber;
import net.neoforged.neoforge.event.tick.ServerTickEvent;

import dev.mcstatus.watchtower.core.analyze.SoftHangDetector;
import dev.mcstatus.watchtower.runtime.WatchtowerSample;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Tracks smoothed MSPT from server tick duration and session min/max/avg/p95.
 * Also stamps last-tick wall clock + tick counter for soft-hang detection.
 */
@EventBusSubscriber(modid = WatchtowerMod.MOD_ID)
public final class TickMetrics {
    private static final int MAX_SAMPLES = 288;

    private static long tickStartNanos;
    private static double smoothedMspt = 50.0;
    private static boolean initialized;
    private static Instant sessionSince;
    private static final List<Double> sessionSamples = new ArrayList<>();

    private static volatile long lastTickAtMs;
    private static volatile long lastTickCount;
    private static volatile String phase = "unknown";

    private TickMetrics() {
    }

    @SubscribeEvent
    public static void onTickPre(ServerTickEvent.Pre event) {
        tickStartNanos = System.nanoTime();
    }

    @SubscribeEvent
    public static void onTickPost(ServerTickEvent.Post event) {
        long elapsedNs = System.nanoTime() - tickStartNanos;
        double mspt = Math.max(0.0, elapsedNs / 1_000_000.0);
        if (!initialized) {
            smoothedMspt = mspt;
            initialized = true;
            sessionSince = Instant.now();
        } else {
            smoothedMspt = smoothedMspt * 0.9 + mspt * 0.1;
        }
        sessionSamples.add(mspt);
        if (sessionSamples.size() > MAX_SAMPLES) {
            sessionSamples.remove(0);
        }
        lastTickAtMs = System.currentTimeMillis();
        lastTickCount++;
        if ("starting".equals(phase) || "loading_world".equals(phase)) {
            phase = "ticking";
        }
    }

    public static long lastTickAtMs() {
        return lastTickAtMs;
    }

    public static long lastTickCount() {
        return lastTickCount;
    }

    public static String phase() {
        return phase;
    }

    public static void setPhase(String p) {
        phase = p != null && !p.isBlank() ? p : "unknown";
    }

    public static SoftHangDetector.TickStamp stamp() {
        return new SoftHangDetector.TickStamp(lastTickAtMs, lastTickCount, phase);
    }

    public static double smoothedMspt() {
        return initialized ? smoothedMspt : 50.0;
    }

    public static WatchtowerSample.SessionMspt sessionMspt() {
        if (sessionSamples.isEmpty()) {
            return new WatchtowerSample.SessionMspt(0, 0, 0, 0, sessionSince);
        }
        double min = Double.MAX_VALUE;
        double max = 0;
        double sum = 0;
        for (double v : sessionSamples) {
            min = Math.min(min, v);
            max = Math.max(max, v);
            sum += v;
        }
        double avg = sum / sessionSamples.size();
        List<Double> sorted = new ArrayList<>(sessionSamples);
        Collections.sort(sorted);
        int p95Index = Math.min(sorted.size() - 1, (int) Math.ceil(sorted.size() * 0.95) - 1);
        double p95 = sorted.get(Math.max(0, p95Index));
        return new WatchtowerSample.SessionMspt(min, max, avg, p95, sessionSince);
    }

    public static void reset() {
        initialized = false;
        smoothedMspt = 50.0;
        sessionSamples.clear();
        sessionSince = Instant.now();
        lastTickAtMs = System.currentTimeMillis();
        lastTickCount = 0L;
        phase = "starting";
    }
}
