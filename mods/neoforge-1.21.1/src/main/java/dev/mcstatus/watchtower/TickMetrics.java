package dev.mcstatus.watchtower;

import net.neoforged.bus.api.SubscribeEvent;
import net.neoforged.fml.common.EventBusSubscriber;
import net.neoforged.neoforge.event.tick.ServerTickEvent;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Tracks smoothed MSPT from server tick duration and session min/max/avg/p95.
 */
@EventBusSubscriber(modid = WatchtowerMod.MOD_ID)
public final class TickMetrics {
    private static final int MAX_SAMPLES = 288;

    private static long tickStartNanos;
    private static double smoothedMspt = 50.0;
    private static boolean initialized;
    private static Instant sessionSince;
    private static final List<Double> sessionSamples = new ArrayList<>();

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
    }

    public static double smoothedMspt() {
        return initialized ? smoothedMspt : 50.0;
    }

    public static SessionMspt sessionMspt() {
        if (sessionSamples.isEmpty()) {
            return new SessionMspt(0, 0, 0, 0, sessionSince);
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
        return new SessionMspt(min, max, avg, p95, sessionSince);
    }

    public static void reset() {
        initialized = false;
        smoothedMspt = 50.0;
        sessionSamples.clear();
        sessionSince = Instant.now();
    }

    public record SessionMspt(double min, double max, double avg, double p95, Instant since) {
    }
}
