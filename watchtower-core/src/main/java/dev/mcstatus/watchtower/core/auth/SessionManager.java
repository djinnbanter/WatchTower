package dev.mcstatus.watchtower.core.auth;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Iterator;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/** In-memory signed dashboard sessions. */
public final class SessionManager {
    public static final String COOKIE_NAME = "watchtower_session";
    public static final long DEFAULT_TTL_SECONDS = 24 * 60 * 60;
    public static final long REMEMBER_TTL_SECONDS = 7 * 24 * 60 * 60;

    public record SessionState(
            String sessionId,
            String username,
            long issuedAtEpochSec,
            long expiresAtEpochSec,
            boolean totpVerified,
            boolean mustChangePassword
    ) {
        public boolean isExpired(long nowEpochSec) {
            return nowEpochSec >= expiresAtEpochSec;
        }

        public boolean isFullyAuthenticated(boolean totpEnabled) {
            if (mustChangePassword) {
                return false;
            }
            if (totpEnabled && !totpVerified) {
                return false;
            }
            return true;
        }
    }

    private final AuthKeyStore keyStore;
    private final Map<String, SessionState> sessions = new ConcurrentHashMap<>();

    public SessionManager(AuthKeyStore keyStore) {
        this.keyStore = keyStore;
    }

    public SessionState createSession(String username, boolean mustChangePassword, boolean totpVerified, long ttlSeconds) {
        String id = UUID.randomUUID().toString();
        long now = Instant.now().getEpochSecond();
        SessionState state = new SessionState(id, username, now, now + ttlSeconds, totpVerified, mustChangePassword);
        sessions.put(id, state);
        return state;
    }

    public SessionState get(String sessionId) {
        if (sessionId == null) {
            return null;
        }
        SessionState state = sessions.get(sessionId);
        if (state == null) {
            return null;
        }
        if (state.isExpired(Instant.now().getEpochSecond())) {
            sessions.remove(sessionId);
            return null;
        }
        return state;
    }

    public SessionState resolveCookie(String cookieValue) {
        String sessionId = keyStore.parseSessionId(cookieValue);
        return get(sessionId);
    }

    public String cookieValue(SessionState state) {
        return keyStore.formatCookieValue(state.sessionId());
    }

    public SessionState markTotpVerified(String sessionId) {
        SessionState current = get(sessionId);
        if (current == null) {
            return null;
        }
        SessionState updated = new SessionState(
                current.sessionId(),
                current.username(),
                current.issuedAtEpochSec(),
                current.expiresAtEpochSec(),
                true,
                current.mustChangePassword()
        );
        sessions.put(sessionId, updated);
        return updated;
    }

    public SessionState markPasswordChanged(String sessionId) {
        SessionState current = get(sessionId);
        if (current == null) {
            return null;
        }
        SessionState updated = new SessionState(
                current.sessionId(),
                current.username(),
                current.issuedAtEpochSec(),
                current.expiresAtEpochSec(),
                current.totpVerified(),
                false
        );
        sessions.put(sessionId, updated);
        return updated;
    }

    public void revoke(String sessionId) {
        if (sessionId != null) {
            sessions.remove(sessionId);
        }
    }

    public void revokeAll() {
        sessions.clear();
    }

    public int fullyAuthenticatedCount(boolean totpEnabled) {
        long now = Instant.now().getEpochSecond();
        int count = 0;
        for (Iterator<Map.Entry<String, SessionState>> it = sessions.entrySet().iterator(); it.hasNext(); ) {
            Map.Entry<String, SessionState> e = it.next();
            if (e.getValue().isExpired(now)) {
                it.remove();
            } else if (e.getValue().isFullyAuthenticated(totpEnabled)) {
                count++;
            }
        }
        return count;
    }
}
