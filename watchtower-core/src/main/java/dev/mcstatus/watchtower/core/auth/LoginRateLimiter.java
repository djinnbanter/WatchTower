package dev.mcstatus.watchtower.core.auth;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/** Per-IP login attempt rate limiting. */
public final class LoginRateLimiter {
    public static final int MAX_FAILURES = 5;
    public static final long WINDOW_SECONDS = 15 * 60;

    private final Map<String, List<Long>> failuresByIp = new ConcurrentHashMap<>();

    public boolean isBlocked(String ip) {
        if (ip == null || ip.isBlank()) {
            return false;
        }
        prune(ip, Instant.now().getEpochSecond());
        List<Long> failures = failuresByIp.get(ip);
        return failures != null && failures.size() >= MAX_FAILURES;
    }

    public void recordFailure(String ip) {
        if (ip == null || ip.isBlank()) {
            return;
        }
        long now = Instant.now().getEpochSecond();
        failuresByIp.compute(ip, (key, list) -> {
            List<Long> failures = list != null ? list : new ArrayList<>();
            pruneList(failures, now);
            failures.add(now);
            return failures;
        });
    }

    public void recordSuccess(String ip) {
        if (ip != null) {
            failuresByIp.remove(ip);
        }
    }

    private void prune(String ip, long now) {
        List<Long> failures = failuresByIp.get(ip);
        if (failures == null) {
            return;
        }
        pruneList(failures, now);
        if (failures.isEmpty()) {
            failuresByIp.remove(ip);
        }
    }

    private static void pruneList(List<Long> failures, long now) {
        long cutoff = now - WINDOW_SECONDS;
        for (Iterator<Long> it = failures.iterator(); it.hasNext(); ) {
            if (it.next() < cutoff) {
                it.remove();
            }
        }
    }
}
