package dev.mcstatus.watchtower;

import dev.mcstatus.watchtower.runtime.ModRuntime;

import dev.mcstatus.watchtower.runtime.ServerContext;

import dev.mcstatus.watchtower.core.auth.AuthKeyStore;
import dev.mcstatus.watchtower.core.auth.DashboardAuthRecord;
import dev.mcstatus.watchtower.core.auth.DashboardAuthStore;
import dev.mcstatus.watchtower.core.auth.GeneratedCredentials;
import dev.mcstatus.watchtower.core.auth.LoginRateLimiter;
import dev.mcstatus.watchtower.core.auth.SessionManager;

import java.io.IOException;

/** Per-server dashboard auth services (initialized on server start). */
public final class DashboardAuthServices {
    private static DashboardAuthStore authStore;
    private static AuthKeyStore keyStore;
    private static SessionManager sessionManager;
    private static LoginRateLimiter rateLimiter;
    private static boolean freshAccountCreated;

    private DashboardAuthServices() {
    }

    public static void init(ServerContext server) throws IOException {
        freshAccountCreated = false;
        keyStore = new AuthKeyStore(WatchtowerPaths.authKeyPath(server));
        authStore = new DashboardAuthStore(WatchtowerPaths.dashboardAuthPath(server), keyStore);
        sessionManager = new SessionManager(keyStore);
        rateLimiter = new LoginRateLimiter();

        if (authStore.alignPendingDefaultPassword()) {
            ModRuntime.logger().info(
                    "[Watchtower] Dashboard pending first-login account aligned to default password (user: {}, password: {})",
                    authStore.username(),
                    DashboardAuthRecord.DEFAULT_INITIAL_PASSWORD
            );
        }

        if (!authStore.exists()) {
            GeneratedCredentials creds = authStore.ensureDefaultAccount();
            if (creds != null) {
                freshAccountCreated = true;
                ModRuntime.logger().info(
                        "[Watchtower] Dashboard login — user: {} password: {} (change on first login)",
                        creds.username(),
                        creds.password()
                );
            }
        }

        String legacyToken = ModRuntime.config().dashboardAuthToken();
        if (legacyToken != null && !legacyToken.isBlank()) {
            ModRuntime.logger().warn(
                    "dashboardAuthToken is deprecated since 1.0.0 — use username/password login instead"
            );
        }
    }

    public static void shutdown() {
        if (sessionManager != null) {
            sessionManager.revokeAll();
        }
        authStore = null;
        keyStore = null;
        sessionManager = null;
        rateLimiter = null;
        freshAccountCreated = false;
    }

    public static DashboardAuthStore store() {
        return authStore;
    }

    public static SessionManager sessions() {
        return sessionManager;
    }

    public static LoginRateLimiter rateLimiter() {
        return rateLimiter;
    }

    public static boolean wasFreshAccountCreated() {
        return freshAccountCreated;
    }

    public static void invalidateAllSessions() {
        if (sessionManager != null) {
            sessionManager.revokeAll();
        }
    }
}
