package dev.mcstatus.watchtower.core.auth;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Instant;
import java.util.Iterator;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Signed dashboard sessions. Kept in memory for speed; optionally mirrored to disk so
 * Remember me (and in-TTL sessions) survive a Minecraft server restart.
 */
public final class SessionManager {
    public static final String COOKIE_NAME = "watchtower_session";
    public static final long DEFAULT_TTL_SECONDS = 24 * 60 * 60;
    public static final long REMEMBER_TTL_SECONDS = 7 * 24 * 60 * 60;

    private static final Gson GSON = new GsonBuilder().create();

    public record SessionState(
            String sessionId,
            String accountId,
            String username,
            AccountRole role,
            long issuedAtEpochSec,
            long expiresAtEpochSec,
            boolean totpRequired,
            boolean totpVerified,
            boolean mustChangePassword,
            boolean remember
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
    private final Path persistPath;
    private final Map<String, SessionState> sessions = new ConcurrentHashMap<>();

    public SessionManager(AuthKeyStore keyStore) {
        this(keyStore, null);
    }

    public SessionManager(AuthKeyStore keyStore, Path persistPath) {
        this.keyStore = keyStore;
        this.persistPath = persistPath;
        loadFromDisk();
    }

    public SessionState createSession(String accountId, String username, AccountRole role,
            boolean mustChangePassword, boolean totpRequired, boolean totpVerified, long ttlSeconds) {
        return createSession(accountId, username, role, mustChangePassword, totpRequired, totpVerified,
                ttlSeconds, false);
    }

    public SessionState createSession(String accountId, String username, AccountRole role,
            boolean mustChangePassword, boolean totpRequired, boolean totpVerified, long ttlSeconds,
            boolean remember) {
        String id = UUID.randomUUID().toString();
        long now = Instant.now().getEpochSecond();
        SessionState state = new SessionState(
                id, accountId, username, role, now, now + ttlSeconds, totpRequired, totpVerified,
                mustChangePassword, remember);
        sessions.put(id, state);
        persist();
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
            persist();
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
        SessionState updated = copy(current, current.totpRequired(), true, current.mustChangePassword(),
                current.username(), current.role());
        sessions.put(sessionId, updated);
        persist();
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
        SessionState updated = copy(current, current.totpRequired(), current.totpVerified(), false,
                nextUser, current.role());
        sessions.put(sessionId, updated);
        persist();
        return updated;
    }

    public SessionState markRole(String sessionId, AccountRole role) {
        SessionState current = get(sessionId);
        if (current == null) {
            return null;
        }
        SessionState updated = copy(current, current.totpRequired(), current.totpVerified(),
                current.mustChangePassword(), current.username(), role);
        sessions.put(sessionId, updated);
        persist();
        return updated;
    }

    public void revoke(String sessionId) {
        if (sessionId != null && sessions.remove(sessionId) != null) {
            persist();
        }
    }

    public void revokeAll() {
        sessions.clear();
        persist();
    }

    public void revokeForAccount(String accountId) {
        if (accountId == null) {
            return;
        }
        boolean changed = sessions.entrySet().removeIf(e -> accountId.equals(e.getValue().accountId()));
        if (changed) {
            persist();
        }
    }

    public int fullyAuthenticatedCount() {
        long now = Instant.now().getEpochSecond();
        int count = 0;
        boolean pruned = false;
        for (Iterator<Map.Entry<String, SessionState>> it = sessions.entrySet().iterator(); it.hasNext(); ) {
            Map.Entry<String, SessionState> e = it.next();
            if (e.getValue().isExpired(now)) {
                it.remove();
                pruned = true;
            } else if (e.getValue().isFullyAuthenticated()) {
                count++;
            }
        }
        if (pruned) {
            persist();
        }
        return count;
    }

    private static SessionState copy(
            SessionState current,
            boolean totpRequired,
            boolean totpVerified,
            boolean mustChangePassword,
            String username,
            AccountRole role
    ) {
        return new SessionState(
                current.sessionId(),
                current.accountId(),
                username,
                role,
                current.issuedAtEpochSec(),
                current.expiresAtEpochSec(),
                totpRequired,
                totpVerified,
                mustChangePassword,
                current.remember()
        );
    }

    private void loadFromDisk() {
        if (persistPath == null || !Files.isRegularFile(persistPath)) {
            return;
        }
        try {
            String raw = Files.readString(persistPath, StandardCharsets.UTF_8);
            JsonObject root = GSON.fromJson(raw, JsonObject.class);
            if (root == null || !root.has("sessions") || !root.get("sessions").isJsonArray()) {
                return;
            }
            long now = Instant.now().getEpochSecond();
            for (var el : root.getAsJsonArray("sessions")) {
                if (!el.isJsonObject()) {
                    continue;
                }
                SessionState state = fromJson(el.getAsJsonObject());
                if (state == null || state.isExpired(now)) {
                    continue;
                }
                sessions.put(state.sessionId(), state);
            }
        } catch (Exception ignored) {
            // Corrupt / unreadable session file — start empty; next persist rewrites.
        }
    }

    private synchronized void persist() {
        if (persistPath == null) {
            return;
        }
        try {
            Files.createDirectories(persistPath.getParent());
            long now = Instant.now().getEpochSecond();
            JsonArray arr = new JsonArray();
            for (SessionState state : sessions.values()) {
                if (state.isExpired(now)) {
                    continue;
                }
                arr.add(toJson(state));
            }
            JsonObject root = new JsonObject();
            root.addProperty("schema", 1);
            root.add("sessions", arr);
            Path tmp = persistPath.resolveSibling(persistPath.getFileName().toString() + ".tmp");
            Files.writeString(tmp, GSON.toJson(root), StandardCharsets.UTF_8);
            AuthFilePermissions.restrictToOwner(tmp);
            Files.move(tmp, persistPath, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
            AuthFilePermissions.restrictToOwner(persistPath);
        } catch (IOException e) {
            try {
                // Fallback if ATOMIC_MOVE unsupported
                JsonArray arr = new JsonArray();
                long now = Instant.now().getEpochSecond();
                for (SessionState state : sessions.values()) {
                    if (!state.isExpired(now)) {
                        arr.add(toJson(state));
                    }
                }
                JsonObject root = new JsonObject();
                root.addProperty("schema", 1);
                root.add("sessions", arr);
                Files.writeString(persistPath, GSON.toJson(root), StandardCharsets.UTF_8);
                AuthFilePermissions.restrictToOwner(persistPath);
            } catch (IOException ignored) {
                // Non-fatal — memory sessions still work this boot.
            }
        }
    }

    private static JsonObject toJson(SessionState state) {
        JsonObject o = new JsonObject();
        o.addProperty("session_id", state.sessionId());
        o.addProperty("account_id", state.accountId());
        o.addProperty("username", state.username());
        o.addProperty("role", state.role().wire());
        o.addProperty("issued_at", state.issuedAtEpochSec());
        o.addProperty("expires_at", state.expiresAtEpochSec());
        o.addProperty("totp_required", state.totpRequired());
        o.addProperty("totp_verified", state.totpVerified());
        o.addProperty("must_change_password", state.mustChangePassword());
        o.addProperty("remember", state.remember());
        return o;
    }

    private static SessionState fromJson(JsonObject o) {
        try {
            String id = o.has("session_id") ? o.get("session_id").getAsString() : null;
            String accountId = o.has("account_id") ? o.get("account_id").getAsString() : null;
            String username = o.has("username") ? o.get("username").getAsString() : null;
            if (id == null || accountId == null || username == null) {
                return null;
            }
            AccountRole role = AccountRole.fromWire(o.has("role") ? o.get("role").getAsString() : "viewer");
            return new SessionState(
                    id,
                    accountId,
                    username,
                    role,
                    o.has("issued_at") ? o.get("issued_at").getAsLong() : 0L,
                    o.has("expires_at") ? o.get("expires_at").getAsLong() : 0L,
                    o.has("totp_required") && o.get("totp_required").getAsBoolean(),
                    o.has("totp_verified") && o.get("totp_verified").getAsBoolean(),
                    o.has("must_change_password") && o.get("must_change_password").getAsBoolean(),
                    o.has("remember") && o.get("remember").getAsBoolean()
            );
        } catch (Exception e) {
            return null;
        }
    }
}
