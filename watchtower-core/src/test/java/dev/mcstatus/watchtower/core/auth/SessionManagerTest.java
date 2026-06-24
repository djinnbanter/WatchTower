package dev.mcstatus.watchtower.core.auth;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

class SessionManagerTest {

    @TempDir
    Path tempDir;

    @Test
    void issueValidateAndRevoke() throws Exception {
        AuthKeyStore keys = new AuthKeyStore(tempDir.resolve(".auth-key"));
        SessionManager sessions = new SessionManager(keys);

        SessionManager.SessionState state = sessions.createSession("watchtower", false, true, 3600);
        assertNotNull(state);
        String cookie = sessions.cookieValue(state);
        assertNotNull(cookie);

        SessionManager.SessionState resolved = sessions.resolveCookie(cookie);
        assertNotNull(resolved);
        assertEquals("watchtower", resolved.username());

        sessions.revoke(state.sessionId());
        assertNull(sessions.resolveCookie(cookie));
    }

    @Test
    void tamperedCookieRejected() throws Exception {
        AuthKeyStore keys = new AuthKeyStore(tempDir.resolve(".auth-key"));
        SessionManager sessions = new SessionManager(keys);
        SessionManager.SessionState state = sessions.createSession("watchtower", false, true, 3600);
        assertNull(sessions.resolveCookie(state.sessionId() + ".bad-signature"));
    }
}
