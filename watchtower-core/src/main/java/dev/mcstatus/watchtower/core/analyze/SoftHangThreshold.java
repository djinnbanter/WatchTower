package dev.mcstatus.watchtower.core.analyze;

/**
 * Effective soft-hang stall threshold vs vanilla {@code max-tick-time}.
 */
public final class SoftHangThreshold {

    public static final int FLOOR_SECONDS = 30;
    public static final int WATCHDOG_LEAD_SECONDS = 15;

    private SoftHangThreshold() {
    }

    /**
     * @param maxTickTimeMs from server.properties; use -1 when disabled; missing → treat as 60000 at call site
     * @param softHangSeconds conf base when watchdog is disabled
     */
    public static int effectiveSeconds(long maxTickTimeMs, int softHangSeconds) {
        int base = Math.max(1, softHangSeconds);
        if (maxTickTimeMs < 0) {
            return base;
        }
        long sec = maxTickTimeMs / 1000L;
        long adjusted = sec - WATCHDOG_LEAD_SECONDS;
        return (int) Math.max(FLOOR_SECONDS, adjusted);
    }
}
