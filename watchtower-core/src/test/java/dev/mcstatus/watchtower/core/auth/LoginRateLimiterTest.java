package dev.mcstatus.watchtower.core.auth;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class LoginRateLimiterTest {

    @Test
    void blocksAfterMaxFailures() {
        LoginRateLimiter limiter = new LoginRateLimiter();
        String ip = "127.0.0.1";
        for (int i = 0; i < LoginRateLimiter.MAX_FAILURES - 1; i++) {
            limiter.recordFailure(ip);
            assertFalse(limiter.isBlocked(ip));
        }
        limiter.recordFailure(ip);
        assertTrue(limiter.isBlocked(ip));
        limiter.recordSuccess(ip);
        assertFalse(limiter.isBlocked(ip));
    }
}
