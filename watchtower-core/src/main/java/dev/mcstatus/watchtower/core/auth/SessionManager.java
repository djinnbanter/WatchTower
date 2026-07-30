package dev.mcstatus.watchtower.core.auth;

import java.time.Instant;
import java.util.Iterator;
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
            String accountId,
            String username,
            AccountRole role,
            long issuedAtEpochSec,
            long expiresAtEpochSec,
            boolean totpRequired,
            boolean totpVerified,
            boolean mustChangePassword
    ) {
        public boolean isExpired(long nowEpochSec) {
            return nowEpochSec >= expiresAtEpochSec;
        }

        public boolean isFullyAuthenticated() {
            if (mustChangePassword) {
                return false;
            }
            if (totpRequired && !totpVerified) {
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

    public SessionState createSession(String accountId, String username, AccountRole role,
            boolean mustChangePassword, boolean totpRequired, boolean totpVerified, long ttlSeconds) {
        String id = UUID.randomUUID().toString();
        long now = Instant.now().getEpochSecond();
        SessionState state = new SessionState(
                id, accountId, username, role, now, now + ttlSeconds, totpRequired, totpVerified, mustChangePassword);
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
                current.accountId(),
                current.username(),
                current.role(),
                current.issuedAtEpochSec(),
                current.expiresAtEpochSec(),
                current.totpRequired(),
                true,
                current.mustChangePassword()
        );
        sessions.put(sessionId, updated);
        return updated;
    }

    public SessionState markPasswordChanged(String sessionId) {
        return markAccountSetup(sessionId, null);
    }

    /** Clears must-change flag and optionally updates the session username. */
    public SessionState markAccountSetup(String sessionId, String username) {
        SessionState current = get(sessionId);
        if (current == null) {
            return null;
        }
        String nextUser = (username != null && !username.isBlank()) ? username.trim() : current.username();
        SessionState updated = new SessionState(
                current.sessionId(),
                current.accountId(),
                nextUser,
                current.role(),
                current.issuedAtEpochSec(),
                current.expiresAtEpochSec(),
                current.totpRequired(),
                current.totpVerified(),
                false
        );
        sessions.put(sessionId, updated);
        return updated;
    }

    public SessionState markRole(String sessionId, AccountRole role) {
        SessionState current = get(sessionId);
        if (current == null) {
            return null;
        }
        SessionState updated = new SessionState(current.sessionId(), current.accountId(), current.username(),
                role, current.issuedAtEpochSec(), current.expiresAtEpochSec(),
                current.totpRequired(), current.totpVerified(), current.mustChangePassword());
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

    public void revokeForAccount(String accountId) {
        if (accountId == null) {
            return;
        }
        sessions.entrySet().removeIf(e -> accountId.equals(e.getValue().accountId()));
    }

    public int fullyAuthenticatedCount() {
        long now = Instant.now().getEpochSecond();
        int count = 0;
        for (Iterator<Map.Entry<String, SessionState>> it = sessions.entrySet().iterator(); it.hasNext(); ) {
            Map.Entry<String, SessionState> e = it.next();
            if (e.getValue().isExpired(now)) {
                it.remove();
            } else if (e.getValue().isFullyAuthenticated()) {
                count++;
            }
        }
        return count;
    }
}
