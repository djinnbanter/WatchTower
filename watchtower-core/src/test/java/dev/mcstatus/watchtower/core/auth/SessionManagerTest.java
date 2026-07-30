package dev.mcstatus.watchtower.core.auth;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SessionManagerTest {

    @TempDir
    Path tempDir;

    @Test
    void issueValidateAndRevoke() throws Exception {
        AuthKeyStore keys = new AuthKeyStore(tempDir.resolve(".auth-key"));
        SessionManager sessions = new SessionManager(keys);

        SessionManager.SessionState state = sessions.createSession(
                "acc_1", "watchtower", AccountRole.OWNER, false, false, true, 3600);
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
        SessionManager.SessionState state = sessions.createSession(
                "acc_1", "watchtower", AccountRole.OWNER, false, false, true, 3600);
        assertNull(sessions.resolveCookie(state.sessionId() + ".bad-signature"));
    }

    @Test
    void sessionCarriesAccountAndRole() throws Exception {
        SessionManager sessions = new SessionManager(new AuthKeyStore(tempDir.resolve(".auth-key")));
        SessionManager.SessionState s = sessions.createSession(
                "acc_1", "ella", AccountRole.OWNER, false, false, true, 60);

        assertEquals("acc_1", s.accountId());
        assertEquals(AccountRole.OWNER, s.role());
        assertTrue(s.isFullyAuthenticated());
    }

    @Test
    void totpRequiredSessionIsNotFullyAuthenticatedUntilVerified() throws Exception {
        SessionManager sessions = new SessionManager(new AuthKeyStore(tempDir.resolve(".auth-key")));
        SessionManager.SessionState s = sessions.createSession(
                "acc_1", "ella", AccountRole.ADMIN, false, true, false, 60);
        assertFalse(s.isFullyAuthenticated());

        assertTrue(sessions.markTotpVerified(s.sessionId()).isFullyAuthenticated());
        assertEquals(1, sessions.fullyAuthenticatedCount());
    }

    @Test
    void revokeForAccountDropsOnlyThatAccountsSessions() throws Exception {
        SessionManager sessions = new SessionManager(new AuthKeyStore(tempDir.resolve(".auth-key")));
        SessionManager.SessionState mine = sessions.createSession(
                "acc_1", "ella", AccountRole.OWNER, false, false, true, 60);
        SessionManager.SessionState theirs = sessions.createSession(
                "acc_2", "marco", AccountRole.ADMIN, false, false, true, 60);

        sessions.revokeForAccount("acc_2");

        assertNotNull(sessions.get(mine.sessionId()));
        assertNull(sessions.get(theirs.sessionId()));
    }
}
