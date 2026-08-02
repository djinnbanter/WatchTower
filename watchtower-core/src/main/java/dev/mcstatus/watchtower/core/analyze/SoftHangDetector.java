package dev.mcstatus.watchtower.core.analyze;

/**
 * Pure hung/recovered decision from tick stamps (wall clock + tick count).
 */
public final class SoftHangDetector {

    public record TickStamp(long lastTickAtMs, long tickCount, String phase) {}

    public record PollState(long previousTickCount, boolean wasActive, long hangStartedAtMs) {}

    public record Decision(
            boolean active,
            long stallSeconds,
            long hangStartedAtMs,
            String phase,
            boolean newlyActive,
            boolean newlyRecovered
    ) {}

    private SoftHangDetector() {
    }

    public static Decision evaluate(
            TickStamp stamp,
            PollState prev,
            long nowMs,
            int effectiveThresholdSec
    ) {
        if (stamp == null) {
            stamp = new TickStamp(0L, 0L, "unknown");
        }
        if (prev == null) {
            prev = new PollState(Long.MIN_VALUE, false, 0L);
        }
        int threshold = Math.max(1, effectiveThresholdSec);
        long stallSeconds = Math.max(0L, (nowMs - stamp.lastTickAtMs()) / 1000L);
        boolean hasPriorPoll = prev.previousTickCount() != Long.MIN_VALUE;
        boolean tickStuck = hasPriorPoll && stamp.tickCount() == prev.previousTickCount();
        boolean shouldBeActive = stallSeconds >= threshold && tickStuck;
        String phase = stamp.phase() != null && !stamp.phase().isBlank() ? stamp.phase() : "unknown";

        boolean newlyActive = shouldBeActive && !prev.wasActive();
        boolean newlyRecovered = !shouldBeActive && prev.wasActive();
        long hangStartedAtMs;
        if (shouldBeActive) {
            hangStartedAtMs = newlyActive
                    ? nowMs - stallSeconds * 1000L
                    : (prev.hangStartedAtMs() > 0 ? prev.hangStartedAtMs() : nowMs - stallSeconds * 1000L);
        } else {
            hangStartedAtMs = 0L;
        }
        return new Decision(shouldBeActive, stallSeconds, hangStartedAtMs, phase, newlyActive, newlyRecovered);
    }
}
