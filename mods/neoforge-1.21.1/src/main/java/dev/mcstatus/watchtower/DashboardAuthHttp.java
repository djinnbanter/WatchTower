package dev.mcstatus.watchtower;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.sun.net.httpserver.Headers;
import com.sun.net.httpserver.HttpExchange;
import dev.mcstatus.watchtower.core.auth.DashboardAuthStore;
import dev.mcstatus.watchtower.core.auth.GeneratedCredentials;
import dev.mcstatus.watchtower.core.auth.RecoveryCodeService;
import dev.mcstatus.watchtower.core.auth.SessionManager;
import dev.mcstatus.watchtower.core.auth.TotpService;
import dev.samstevens.totp.qr.QrData;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.util.List;

/** Dashboard session auth HTTP handlers and middleware. */
public final class DashboardAuthHttp {
    private static final Gson GSON = new Gson();

    private DashboardAuthHttp() {
    }

    public static void applySecurityHeaders(Headers headers) {
        headers.set("X-Frame-Options", "DENY");
        headers.set("X-Content-Type-Options", "nosniff");
        headers.set("Content-Security-Policy",
                "default-src 'self'; script-src 'self'; img-src 'self' data: https://crafthead.net; "
                        + "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
                        + "font-src 'self' https://fonts.gstatic.com");
    }

    public static void handleSession(HttpExchange ex, String hostname) throws IOException {
        if (!"GET".equalsIgnoreCase(ex.getRequestMethod())) {
            sendText(ex, 405, "Method not allowed");
            return;
        }
        JsonObject out = buildSessionJson(resolveSession(ex), hostname);
        sendJson(ex, 200, out);
    }

    public static void handleLogin(HttpExchange ex) throws IOException {
        if (!"POST".equalsIgnoreCase(ex.getRequestMethod())) {
            sendText(ex, 405, "Method not allowed");
            return;
        }
        String ip = clientIp(ex);
        if (DashboardAuthServices.rateLimiter().isBlocked(ip)) {
            sendJson(ex, 429, errorJson("too_many_attempts", "Too many login attempts. Try again later."));
            return;
        }
        JsonObject body = parseBody(ex);
        String username = text(body, "username");
        String password = text(body, "password");
        boolean remember = body.has("remember") && body.get("remember").getAsBoolean();

        DashboardAuthStore store = DashboardAuthServices.store();
        if (store == null || !store.verifyUsername(username) || !store.verifyPassword(password.toCharArray())) {
            DashboardAuthServices.rateLimiter().recordFailure(ip);
            sendJson(ex, 401, errorJson("invalid_credentials", "Invalid username or password"));
            return;
        }
        DashboardAuthServices.rateLimiter().recordSuccess(ip);

        boolean totpEnabled = store.totpEnabled();
        boolean mustChange = store.mustChangePassword();
        long ttl = remember ? SessionManager.REMEMBER_TTL_SECONDS : SessionManager.DEFAULT_TTL_SECONDS;
        SessionManager.SessionState session = DashboardAuthServices.sessions().createSession(
                store.username(),
                mustChange,
                !totpEnabled,
                ttl
        );
        setSessionCookie(ex, session, remember, secureCookie(ex));

        JsonObject out = new JsonObject();
        out.addProperty("ok", true);
        out.addProperty("username", store.username());
        out.addProperty("must_change_password", mustChange);
        out.addProperty("totp_required", totpEnabled && !mustChange);
        sendJson(ex, 200, out);
    }

    public static void handleTotp(HttpExchange ex) throws IOException {
        if (!"POST".equalsIgnoreCase(ex.getRequestMethod())) {
            sendText(ex, 405, "Method not allowed");
            return;
        }
        SessionManager.SessionState session = requireSession(ex, true, true);
        if (session == null) {
            return;
        }
        DashboardAuthStore store = DashboardAuthServices.store();
        if (store == null || !store.totpEnabled()) {
            sendJson(ex, 400, errorJson("totp_not_enabled", "2FA is not enabled"));
            return;
        }
        JsonObject body = parseBody(ex);
        String code = text(body, "code");
        boolean recovery = body.has("recovery") && body.get("recovery").getAsBoolean();

        boolean ok = recovery ? store.verifyTotpOrRecovery(code) : store.verifyTotpCode(code);
        if (!ok) {
            sendJson(ex, 401, errorJson("invalid_code", "Invalid authenticator or recovery code"));
            return;
        }
        SessionManager.SessionState updated = DashboardAuthServices.sessions().markTotpVerified(session.sessionId());
        if (updated == null) {
            sendJson(ex, 401, errorJson("session_expired", "Session expired — sign in again"));
            return;
        }
        JsonObject out = new JsonObject();
        out.addProperty("ok", true);
        out.addProperty("username", updated.username());
        out.addProperty("must_change_password", updated.mustChangePassword());
        sendJson(ex, 200, out);
    }

    public static void handleLogout(HttpExchange ex) throws IOException {
        if (!"POST".equalsIgnoreCase(ex.getRequestMethod())) {
            sendText(ex, 405, "Method not allowed");
            return;
        }
        SessionManager.SessionState session = resolveSession(ex);
        if (session != null) {
            DashboardAuthServices.sessions().revoke(session.sessionId());
        }
        clearSessionCookie(ex, secureCookie(ex));
        JsonObject out = new JsonObject();
        out.addProperty("ok", true);
        sendJson(ex, 200, out);
    }

    public static void handleChangePassword(HttpExchange ex) throws IOException {
        if (!"POST".equalsIgnoreCase(ex.getRequestMethod())) {
            sendText(ex, 405, "Method not allowed");
            return;
        }
        SessionManager.SessionState session = requireSession(ex, true, true);
        if (session == null) {
            return;
        }
        JsonObject body = parseBody(ex);
        String current = text(body, "current_password");
        String newPassword = text(body, "new_password");
        if (newPassword.length() < 8) {
            sendJson(ex, 400, errorJson("weak_password", "Password must be at least 8 characters"));
            return;
        }
        DashboardAuthStore store = DashboardAuthServices.store();
        if (!store.verifyPassword(current.toCharArray())) {
            sendJson(ex, 401, errorJson("invalid_password", "Current password is incorrect"));
            return;
        }
        store.setPassword(newPassword.toCharArray());
        DashboardAuthServices.sessions().markPasswordChanged(session.sessionId());
        JsonObject out = new JsonObject();
        out.addProperty("ok", true);
        sendJson(ex, 200, out);
    }

    public static void handleChangeUsername(HttpExchange ex) throws IOException {
        if (!"POST".equalsIgnoreCase(ex.getRequestMethod())) {
            sendText(ex, 405, "Method not allowed");
            return;
        }
        SessionManager.SessionState session = requireFullSession(ex);
        if (session == null) {
            return;
        }
        JsonObject body = parseBody(ex);
        String newUsername = text(body, "username");
        try {
            DashboardAuthServices.store().changeUsername(newUsername);
        } catch (IllegalArgumentException e) {
            sendJson(ex, 400, errorJson("invalid_username", e.getMessage()));
            return;
        }
        JsonObject out = new JsonObject();
        out.addProperty("ok", true);
        out.addProperty("username", DashboardAuthServices.store().username());
        sendJson(ex, 200, out);
    }

    public static void handleTotpSetup(HttpExchange ex, String issuer) throws IOException {
        if (!"POST".equalsIgnoreCase(ex.getRequestMethod())) {
            sendText(ex, 405, "Method not allowed");
            return;
        }
        SessionManager.SessionState session = requireFullSession(ex);
        if (session == null) {
            return;
        }
        DashboardAuthStore store = DashboardAuthServices.store();
        String secret = store.beginTotpSetup();
        TotpService totp = store.totpService();
        QrData qrData = totp.buildQrData(issuer, store.username(), secret);
        JsonObject out = new JsonObject();
        out.addProperty("ok", true);
        out.addProperty("secret", secret);
        out.addProperty("otpauth_uri", qrData.getUri());
        try {
            out.addProperty("qr_data_url", totp.qrPngDataUrl(qrData));
        } catch (Exception e) {
            out.addProperty("qr_data_url", "");
        }
        sendJson(ex, 200, out);
    }

    public static void handleTotpConfirm(HttpExchange ex) throws IOException {
        if (!"POST".equalsIgnoreCase(ex.getRequestMethod())) {
            sendText(ex, 405, "Method not allowed");
            return;
        }
        SessionManager.SessionState session = requireFullSession(ex);
        if (session == null) {
            return;
        }
        JsonObject body = parseBody(ex);
        String code = text(body, "code");
        try {
            RecoveryCodeService.GeneratedCodes codes = DashboardAuthServices.store().confirmTotpSetup(code);
            JsonObject out = new JsonObject();
            out.addProperty("ok", true);
            JsonArray plain = new JsonArray();
            for (String c : codes.plainCodes()) {
                plain.add(c);
            }
            out.add("recovery_codes", plain);
            sendJson(ex, 200, out);
        } catch (IllegalArgumentException e) {
            sendJson(ex, 400, errorJson("invalid_code", e.getMessage()));
        }
    }

    public static void handleTotpDisable(HttpExchange ex) throws IOException {
        if (!"POST".equalsIgnoreCase(ex.getRequestMethod())) {
            sendText(ex, 405, "Method not allowed");
            return;
        }
        SessionManager.SessionState session = requireFullSession(ex);
        if (session == null) {
            return;
        }
        JsonObject body = parseBody(ex);
        try {
            DashboardAuthServices.store().disableTotp(
                    text(body, "password").toCharArray(),
                    text(body, "code")
            );
            JsonObject out = new JsonObject();
            out.addProperty("ok", true);
            sendJson(ex, 200, out);
        } catch (IllegalArgumentException e) {
            sendJson(ex, 400, errorJson("disable_failed", e.getMessage()));
        }
    }

    public static void handleRecoveryRegenerate(HttpExchange ex) throws IOException {
        if (!"POST".equalsIgnoreCase(ex.getRequestMethod())) {
            sendText(ex, 405, "Method not allowed");
            return;
        }
        SessionManager.SessionState session = requireFullSession(ex);
        if (session == null) {
            return;
        }
        JsonObject body = parseBody(ex);
        try {
            RecoveryCodeService.GeneratedCodes codes = DashboardAuthServices.store().regenerateRecoveryCodes(
                    text(body, "password").toCharArray(),
                    text(body, "code")
            );
            JsonObject out = new JsonObject();
            out.addProperty("ok", true);
            JsonArray plain = new JsonArray();
            for (String c : codes.plainCodes()) {
                plain.add(c);
            }
            out.add("recovery_codes", plain);
            sendJson(ex, 200, out);
        } catch (Exception e) {
            sendJson(ex, 400, errorJson("regenerate_failed", e.getMessage()));
        }
    }

    public static SessionManager.SessionState requireFullSession(HttpExchange ex) throws IOException {
        return requireSession(ex, false, false);
    }

    public static SessionManager.SessionState requireSession(
            HttpExchange ex,
            boolean allowMustChange,
            boolean allowTotpPending
    ) throws IOException {
        SessionManager.SessionState session = resolveSession(ex);
        if (session == null) {
            sendJson(ex, 401, errorJson("unauthorized", "Unauthorized"));
            return null;
        }
        DashboardAuthStore store = DashboardAuthServices.store();
        boolean totpEnabled = store != null && store.totpEnabled();
        if (!allowMustChange && session.mustChangePassword()) {
            sendJson(ex, 403, errorJson("password_change_required", "Password change required"));
            return null;
        }
        if (!allowTotpPending && totpEnabled && !session.totpVerified()) {
            sendJson(ex, 403, errorJson("totp_required", "Authenticator code required"));
            return null;
        }
        return session;
    }

    public static SessionManager.SessionState resolveSession(HttpExchange ex) {
        String cookie = cookieValue(ex, SessionManager.COOKIE_NAME);
        if (cookie == null) {
            return null;
        }
        return DashboardAuthServices.sessions().resolveCookie(cookie);
    }

    public static JsonObject buildSessionJson(SessionManager.SessionState session, String hostname) {
        DashboardAuthStore store = DashboardAuthServices.store();
        JsonObject out = new JsonObject();
        String bindHost = WatchtowerConfig.DASHBOARD_BIND_HOST.get();
        out.addProperty("auth_required", true);
        out.addProperty("dashboard_bind_host", bindHost);
        out.addProperty("bind_exposed", "0.0.0.0".equals(bindHost));
        out.addProperty("security_update", DashboardAuthServices.wasFreshAccountCreated());
        if (store != null) {
            out.addProperty("totp_enabled", store.totpEnabled());
        }
        if (session == null) {
            out.addProperty("authenticated", false);
            return out;
        }
        boolean totpEnabled = store != null && store.totpEnabled();
        out.addProperty("authenticated", true);
        out.addProperty("username", session.username());
        out.addProperty("must_change_password", session.mustChangePassword());
        out.addProperty("totp_required", totpEnabled && !session.totpVerified() && !session.mustChangePassword());
        out.addProperty("fully_authenticated", session.isFullyAuthenticated(totpEnabled));
        if (hostname != null) {
            out.addProperty("hostname", hostname);
        }
        return out;
    }

    public static String cookieValue(HttpExchange ex, String name) {
        List<String> cookies = ex.getRequestHeaders().get("Cookie");
        if (cookies == null) {
            return null;
        }
        String prefix = name + "=";
        for (String header : cookies) {
            for (String part : header.split(";")) {
                String trimmed = part.trim();
                if (trimmed.startsWith(prefix)) {
                    return trimmed.substring(prefix.length());
                }
            }
        }
        return null;
    }

    public static void setSessionCookie(
            HttpExchange ex,
            SessionManager.SessionState session,
            boolean remember,
            boolean secure
    ) {
        String value = DashboardAuthServices.sessions().cookieValue(session);
        long maxAge = remember ? SessionManager.REMEMBER_TTL_SECONDS : SessionManager.DEFAULT_TTL_SECONDS;
        appendCookie(ex, sessionCookieHeader(value, maxAge, secure));
    }

    public static void clearSessionCookie(HttpExchange ex, boolean secure) {
        appendCookie(ex, SessionManager.COOKIE_NAME + "=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0"
                + (secure ? "; Secure" : ""));
    }

    private static String sessionCookieHeader(String value, long maxAge, boolean secure) {
        return SessionManager.COOKIE_NAME + "=" + value
                + "; Path=/; HttpOnly; SameSite=Strict; Max-Age=" + maxAge
                + (secure ? "; Secure" : "");
    }

    private static void appendCookie(HttpExchange ex, String cookie) {
        ex.getResponseHeaders().add("Set-Cookie", cookie);
    }

    public static boolean secureCookie(HttpExchange ex) {
        String forwarded = ex.getRequestHeaders().getFirst("X-Forwarded-Proto");
        if (forwarded != null && forwarded.equalsIgnoreCase("https")) {
            return true;
        }
        return ex.getRequestURI().getScheme() != null && ex.getRequestURI().getScheme().equalsIgnoreCase("https");
    }

    public static String clientIp(HttpExchange ex) {
        String forwarded = ex.getRequestHeaders().getFirst("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            int comma = forwarded.indexOf(',');
            return comma > 0 ? forwarded.substring(0, comma).trim() : forwarded.trim();
        }
        if (ex.getRemoteAddress() != null && ex.getRemoteAddress().getAddress() != null) {
            return ex.getRemoteAddress().getAddress().getHostAddress();
        }
        return "unknown";
    }

    private static JsonObject parseBody(HttpExchange ex) throws IOException {
        String raw = new String(ex.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
        if (raw.isBlank()) {
            return new JsonObject();
        }
        return GSON.fromJson(raw, JsonObject.class);
    }

    private static String text(JsonObject json, String key) {
        if (json == null || !json.has(key) || json.get(key).isJsonNull()) {
            return "";
        }
        return json.get(key).getAsString();
    }

    private static JsonObject errorJson(String code, String message) {
        JsonObject err = new JsonObject();
        err.addProperty("error", code);
        err.addProperty("message", message);
        return err;
    }

    public static void sendJson(HttpExchange ex, int code, JsonObject json) throws IOException {
        byte[] bytes = GSON.toJson(json).getBytes(StandardCharsets.UTF_8);
        Headers h = ex.getResponseHeaders();
        applySecurityHeaders(h);
        h.set("Content-Type", "application/json; charset=utf-8");
        ex.sendResponseHeaders(code, bytes.length);
        try (OutputStream os = ex.getResponseBody()) {
            os.write(bytes);
        }
    }

    public static void sendText(HttpExchange ex, int code, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        Headers h = ex.getResponseHeaders();
        applySecurityHeaders(h);
        h.set("Content-Type", "text/plain; charset=utf-8");
        ex.sendResponseHeaders(code, bytes.length);
        try (OutputStream os = ex.getResponseBody()) {
            os.write(bytes);
        }
    }
}
