package dev.mcstatus.watchtower;

import dev.mcstatus.watchtower.runtime.ModRuntime;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.sun.net.httpserver.Headers;
import com.sun.net.httpserver.HttpExchange;
import dev.mcstatus.watchtower.core.audit.AuditEvent;
import dev.mcstatus.watchtower.core.audit.AuditLog;
import dev.mcstatus.watchtower.core.auth.AccountRole;
import dev.mcstatus.watchtower.core.auth.DashboardAuthRecord;
import dev.mcstatus.watchtower.core.auth.DashboardAuthStore;
import dev.mcstatus.watchtower.core.auth.GeneratedCredentials;
import dev.mcstatus.watchtower.core.auth.RecoveryCodeService;
import dev.mcstatus.watchtower.core.auth.SessionManager;
import dev.mcstatus.watchtower.core.auth.TotpService;
import dev.samstevens.totp.qr.QrData;

import java.io.IOException;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Path;
import java.util.List;
import java.util.Locale;

/** Dashboard session auth HTTP handlers and middleware. */
public final class DashboardAuthHttp {
    private static final Gson GSON = new Gson();

    private DashboardAuthHttp() {
    }

    public static void applySecurityHeaders(Headers headers) {
        headers.set("X-Frame-Options", "DENY");
        headers.set("X-Content-Type-Options", "nosniff");
        headers.set("Content-Security-Policy",
                "default-src 'self'; script-src 'self'; "
                        + "img-src 'self' data: https://crafthead.net https://cdn.modrinth.com; "
                        + "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
                        + "font-src 'self' https://fonts.gstatic.com");
    }

    public static void handleSession(HttpExchange ex, String hostname) throws IOException {
        if (!"GET".equalsIgnoreCase(ex.getRequestMethod())) {
            sendText(ex, 405, "Method not allowed");
            return;
        }
        if (rejectWhenAuthUnavailable(ex)) {
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
        if (rejectWhenAuthUnavailable(ex)) {
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
        DashboardAuthRecord account = store != null ? store.findByUsername(username) : null;
        if (account == null || !store.verifyPassword(account.id, password.toCharArray())) {
            DashboardAuthServices.rateLimiter().recordFailure(ip);
            DashboardAudit.recordAnonymous("login_failed", username, null, ip, AuditEvent.FAILED);
            sendJson(ex, 401, errorJson("invalid_credentials", "Invalid username or password"));
            return;
        }
        DashboardAuthServices.rateLimiter().recordSuccess(ip);

        boolean totpEnabled = store.totpEnabled(account.id);
        boolean mustChange = store.mustChangePassword(account.id);
        AccountRole role = AccountRole.fromWire(account.role);
        long ttl = remember ? SessionManager.REMEMBER_TTL_SECONDS : SessionManager.DEFAULT_TTL_SECONDS;
        SessionManager.SessionState session = DashboardAuthServices.sessions().createSession(
                account.id, account.username, role, mustChange, totpEnabled, !totpEnabled, ttl);
        store.recordLogin(account.id);
        DashboardAudit.record("login_ok", session, null, remember ? "remember=true" : null, ip);
        setSessionCookie(ex, session, remember, secureCookie(ex));

        JsonObject out = new JsonObject();
        out.addProperty("ok", true);
        out.addProperty("username", account.username);
        out.addProperty("role", role.wire());
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
        if (store == null || !store.totpEnabled(session.accountId())) {
            sendJson(ex, 400, errorJson("totp_not_enabled", "2FA is not enabled"));
            return;
        }
        JsonObject body = parseBody(ex);
        String code = text(body, "code");
        boolean recovery = body.has("recovery") && body.get("recovery").getAsBoolean();

        boolean ok = recovery
                ? store.verifyTotpOrRecovery(session.accountId(), code)
                : store.verifyTotpCode(session.accountId(), code);
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
            DashboardAudit.record("logout", session, null, null, clientIp(ex));
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
        String newUsername = text(body, "username");
        if (newPassword.length() < 8) {
            sendJson(ex, 400, errorJson("weak_password", "Password must be at least 8 characters"));
            return;
        }
        DashboardAuthStore store = DashboardAuthServices.store();
        if (store == null || !store.verifyPassword(session.accountId(), current.toCharArray())) {
            sendJson(ex, 401, errorJson("invalid_password", "Current password is incorrect"));
            return;
        }

        boolean mustChange = session.mustChangePassword();
        String resolvedUsername = null;
        if (mustChange) {
            String trimmed = newUsername != null ? newUsername.trim() : "";
            if (trimmed.isEmpty()) {
                sendJson(ex, 400, errorJson("username_required", "Choose a new username"));
                return;
            }
            if (trimmed.equalsIgnoreCase(DashboardAuthRecord.DEFAULT_USERNAME)) {
                sendJson(ex, 400, errorJson("username_default",
                        "Choose a username other than the default (watchtower)"));
                return;
            }
            try {
                store.changeUsername(session.accountId(), trimmed);
                resolvedUsername = trimmed;
            } catch (IllegalArgumentException e) {
                sendJson(ex, 400, errorJson("invalid_username", e.getMessage()));
                return;
            }
        } else if (newUsername != null && !newUsername.isBlank()) {
            try {
                store.changeUsername(session.accountId(), newUsername);
                resolvedUsername = store.findById(session.accountId()).username;
            } catch (IllegalArgumentException e) {
                sendJson(ex, 400, errorJson("invalid_username", e.getMessage()));
                return;
            }
        }

        store.setPassword(session.accountId(), newPassword.toCharArray());
        DashboardAudit.record("password_changed", session, null, null, clientIp(ex));
        SessionManager.SessionState updated = DashboardAuthServices.sessions()
                .markAccountSetup(session.sessionId(), resolvedUsername);
        JsonObject out = new JsonObject();
        out.addProperty("ok", true);
        if (updated != null) {
            out.addProperty("username", updated.username());
        } else if (resolvedUsername != null) {
            out.addProperty("username", resolvedUsername);
        }
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
            DashboardAuthServices.store().changeUsername(session.accountId(), newUsername);
        } catch (IllegalArgumentException e) {
            sendJson(ex, 400, errorJson("invalid_username", e.getMessage()));
            return;
        }
        JsonObject out = new JsonObject();
        out.addProperty("ok", true);
        out.addProperty("username", DashboardAuthServices.store().findById(session.accountId()).username);
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
        String secret = store.beginTotpSetup(session.accountId());
        TotpService totp = store.totpService();
        QrData qrData = totp.buildQrData(issuer, session.username(), secret);
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
            RecoveryCodeService.GeneratedCodes codes =
                    DashboardAuthServices.store().confirmTotpSetup(session.accountId(), code);
            DashboardAudit.record("totp_enabled", session, null, null, clientIp(ex));
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
                    session.accountId(),
                    text(body, "password").toCharArray(),
                    text(body, "code")
            );
            DashboardAudit.record("totp_disabled", session, null, null, clientIp(ex));
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
            RecoveryCodeService.GeneratedCodes codes =
                    DashboardAuthServices.store().regenerateRecoveryCodes(
                            session.accountId(),
                            text(body, "password").toCharArray(),
                            text(body, "code")
                    );
            DashboardAudit.record("recovery_codes_regenerated", session, null, null, clientIp(ex));
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

    /** GET lists accounts; POST creates one. Owner only. */
    public static void handleAccounts(HttpExchange ex) throws IOException {
        String method = ex.getRequestMethod();
        if ("GET".equalsIgnoreCase(method)) {
            handleAccountsList(ex);
            return;
        }
        if ("POST".equalsIgnoreCase(method)) {
            handleAccountCreate(ex);
            return;
        }
        sendText(ex, 405, "Method not allowed");
    }

    private static void handleAccountsList(HttpExchange ex) throws IOException {
        SessionManager.SessionState session = sessionOf(ex);
        if (!requireOwner(ex, session)) {
            return;
        }
        DashboardAuthStore store = DashboardAuthServices.store();
        JsonArray accounts = new JsonArray();
        if (store != null) {
            for (DashboardAuthRecord r : store.accounts()) {
                JsonObject row = new JsonObject();
                row.addProperty("id", r.id);
                row.addProperty("username", r.username);
                row.addProperty("role", AccountRole.fromWire(r.role).wire());
                row.addProperty("disabled", r.disabled);
                row.addProperty("totp_enabled", r.totp_enabled);
                row.addProperty("created_at", r.created_at);
                row.addProperty("last_login_at", r.last_login_at);
                row.addProperty("is_you", session != null && session.accountId().equals(r.id));
                putMinecraftLink(row, r);
                accounts.add(row);
            }
        }
        JsonObject out = new JsonObject();
        out.add("accounts", accounts);
        sendJson(ex, 200, out);
    }

    private static void handleAccountCreate(HttpExchange ex) throws IOException {
        SessionManager.SessionState session = sessionOf(ex);
        if (!requireOwner(ex, session)) {
            return;
        }
        JsonObject body = parseBody(ex);
        String username = text(body, "username");
        String roleRaw = text(body, "role");
        AccountRole role = AccountRole.fromWire(roleRaw);
        try {
            GeneratedCredentials creds = DashboardAuthServices.store()
                    .createAccount(username, role, session.accountId());
            DashboardAuthRecord created = DashboardAuthServices.store().findByUsername(creds.username());
            DashboardAudit.record("account_created", session, creds.username(),
                    "role=" + role.wire(), clientIp(ex));
            JsonObject out = new JsonObject();
            out.addProperty("ok", true);
            if (created != null) {
                out.addProperty("id", created.id);
            }
            out.addProperty("username", creds.username());
            out.addProperty("role", role.wire());
            out.addProperty("temp_password", creds.password());
            sendJson(ex, 200, out);
        } catch (IllegalArgumentException e) {
            sendJson(ex, 400, errorJson("invalid_account", e.getMessage()));
        }
    }

    public static void handleAccountUpdate(HttpExchange ex) throws IOException {
        if (!"POST".equalsIgnoreCase(ex.getRequestMethod())) {
            sendText(ex, 405, "Method not allowed");
            return;
        }
        SessionManager.SessionState session = sessionOf(ex);
        if (!requireOwner(ex, session)) {
            return;
        }
        JsonObject body = parseBody(ex);
        String id = text(body, "id");
        if (id.isBlank()) {
            sendJson(ex, 400, errorJson("invalid_account", "Missing id"));
            return;
        }
        DashboardAuthStore store = DashboardAuthServices.store();
        DashboardAuthRecord existing = store != null ? store.findById(id) : null;
        if (existing == null) {
            sendJson(ex, 400, errorJson("invalid_account", "Unknown account"));
            return;
        }
        boolean hasRole = body.has("role") && !body.get("role").isJsonNull();
        boolean hasDisabled = body.has("disabled") && !body.get("disabled").isJsonNull();
        boolean hasMinecraft = body.has("minecraft_uuid") || body.has("clear_minecraft");
        String ip = clientIp(ex);
        try {
            boolean roleChanged = false;
            boolean newlyDisabled = false;
            if (hasRole) {
                AccountRole newRole = AccountRole.fromWire(text(body, "role"));
                AccountRole oldRole = AccountRole.fromWire(existing.role);
                if (newRole != oldRole) {
                    store.setRole(id, newRole);
                    roleChanged = true;
                    DashboardAudit.record("account_role_changed", session, existing.username,
                            oldRole.wire() + " -> " + newRole.wire(), ip);
                }
            }
            if (hasDisabled) {
                boolean disabled = body.get("disabled").getAsBoolean();
                if (disabled != existing.disabled) {
                    store.setDisabled(id, disabled);
                    newlyDisabled = disabled;
                    DashboardAudit.record(disabled ? "account_disabled" : "account_enabled",
                            session, existing.username, null, ip);
                }
            }
            if (hasMinecraft) {
                boolean clear = body.has("clear_minecraft")
                        && !body.get("clear_minecraft").isJsonNull()
                        && body.get("clear_minecraft").getAsBoolean();
                String uuid = text(body, "minecraft_uuid");
                if (clear || uuid.isBlank()) {
                    store.clearMinecraftLink(id);
                    DashboardAudit.record("account_minecraft_unlink", session, existing.username, null, ip);
                } else {
                    String name = text(body, "minecraft_name");
                    store.setMinecraftLink(id, uuid, name);
                    DashboardAudit.record("account_minecraft_link", session, existing.username,
                            name + " " + uuid, ip);
                }
            }
            if (roleChanged || newlyDisabled) {
                DashboardAuthServices.sessions().revokeForAccount(id);
            }
            JsonObject out = new JsonObject();
            out.addProperty("ok", true);
            sendJson(ex, 200, out);
        } catch (IllegalStateException e) {
            sendJson(ex, 409, errorJson("last_owner", e.getMessage()));
        } catch (IllegalArgumentException e) {
            sendJson(ex, 400, errorJson("invalid_account", e.getMessage()));
        }
    }

    /** Any fully authenticated user may link/unlink their own Minecraft player. */
    public static void handleMyMinecraftLink(HttpExchange ex) throws IOException {
        if (!"POST".equalsIgnoreCase(ex.getRequestMethod())) {
            sendText(ex, 405, "Method not allowed");
            return;
        }
        SessionManager.SessionState session = requireSession(ex, false, false);
        if (session == null) {
            return;
        }
        JsonObject body = parseBody(ex);
        String ip = clientIp(ex);
        DashboardAuthStore store = DashboardAuthServices.store();
        if (store == null) {
            sendJson(ex, 503, errorJson("auth_unavailable", "Accounts unavailable"));
            return;
        }
        try {
            boolean clear = body.has("clear") && !body.get("clear").isJsonNull()
                    && body.get("clear").getAsBoolean();
            if (clear) {
                store.clearMinecraftLink(session.accountId());
                DashboardAudit.record("account_minecraft_unlink", session, session.username(), null, ip);
            } else {
                String uuid = text(body, "uuid");
                String name = text(body, "name");
                store.setMinecraftLink(session.accountId(), uuid, name);
                DashboardAudit.record("account_minecraft_link", session, session.username(),
                        name + " " + uuid, ip);
            }
            JsonObject out = new JsonObject();
            out.addProperty("ok", true);
            putMinecraftLink(out, store.findById(session.accountId()));
            sendJson(ex, 200, out);
        } catch (IllegalArgumentException e) {
            sendJson(ex, 400, errorJson("invalid_minecraft_link", e.getMessage()));
        }
    }

    /** Any fully authenticated user may save their own theme/accent prefs. */
    public static void handleMyAppearance(HttpExchange ex) throws IOException {
        if (!"PUT".equalsIgnoreCase(ex.getRequestMethod())) {
            sendText(ex, 405, "Method not allowed");
            return;
        }
        SessionManager.SessionState session = requireSession(ex, false, false);
        if (session == null) {
            return;
        }
        JsonObject body = parseBody(ex);
        String ip = clientIp(ex);
        DashboardAuthStore store = DashboardAuthServices.store();
        if (store == null) {
            sendJson(ex, 503, errorJson("auth_unavailable", "Accounts unavailable"));
            return;
        }
        try {
            String theme = text(body, "theme");
            String accent = text(body, "accent");
            store.updateAppearance(session.accountId(), theme, accent);
            DashboardAuthRecord account = store.findById(session.accountId());
            DashboardAudit.record("appearance_saved", session, session.username(),
                    theme + "/" + accent, ip);
            JsonObject out = new JsonObject();
            out.addProperty("ok", true);
            if (account != null) {
                out.addProperty("ui_theme", account.ui_theme);
                out.addProperty("ui_accent", account.ui_accent);
            }
            sendJson(ex, 200, out);
        } catch (IllegalArgumentException e) {
            sendJson(ex, 400, errorJson("invalid_appearance", e.getMessage()));
        }
    }

    private static void putMinecraftLink(JsonObject out, DashboardAuthRecord account) {
        if (account == null) {
            return;
        }
        if (account.minecraft_uuid != null && !account.minecraft_uuid.isBlank()) {
            out.addProperty("minecraft_uuid", account.minecraft_uuid);
            out.addProperty("minecraft_name",
                    account.minecraft_name != null ? account.minecraft_name : "");
        }
    }

    public static void handleAccountResetPassword(HttpExchange ex) throws IOException {
        if (!"POST".equalsIgnoreCase(ex.getRequestMethod())) {
            sendText(ex, 405, "Method not allowed");
            return;
        }
        SessionManager.SessionState session = sessionOf(ex);
        if (!requireOwner(ex, session)) {
            return;
        }
        JsonObject body = parseBody(ex);
        String id = text(body, "id");
        if (id.isBlank()) {
            sendJson(ex, 400, errorJson("invalid_account", "Missing id"));
            return;
        }
        boolean clear2fa = body.has("clear_2fa") && !body.get("clear_2fa").isJsonNull()
                && body.get("clear_2fa").getAsBoolean();
        try {
            DashboardAuthRecord target = DashboardAuthServices.store().findById(id);
            GeneratedCredentials creds = DashboardAuthServices.store().resetAccountPassword(id, clear2fa);
            DashboardAuthServices.sessions().revokeForAccount(id);
            DashboardAudit.record("account_password_reset", session,
                    target != null ? target.username : id,
                    clear2fa ? "clear_2fa=true" : null, clientIp(ex));
            JsonObject out = new JsonObject();
            out.addProperty("ok", true);
            out.addProperty("temp_password", creds.password());
            sendJson(ex, 200, out);
        } catch (IllegalArgumentException e) {
            sendJson(ex, 400, errorJson("invalid_account", e.getMessage()));
        }
    }

    public static void handleAccountDelete(HttpExchange ex) throws IOException {
        if (!"POST".equalsIgnoreCase(ex.getRequestMethod())) {
            sendText(ex, 405, "Method not allowed");
            return;
        }
        SessionManager.SessionState session = sessionOf(ex);
        if (!requireOwner(ex, session)) {
            return;
        }
        JsonObject body = parseBody(ex);
        String id = text(body, "id");
        if (id.isBlank()) {
            sendJson(ex, 400, errorJson("invalid_account", "Missing id"));
            return;
        }
        if (id.equals(session.accountId())) {
            sendJson(ex, 400, errorJson("cannot_delete_self", "You cannot delete your own account"));
            return;
        }
        try {
            DashboardAuthRecord target = DashboardAuthServices.store().findById(id);
            String username = target != null ? target.username : id;
            DashboardAuthServices.store().deleteAccount(id);
            DashboardAuthServices.sessions().revokeForAccount(id);
            DashboardAudit.record("account_deleted", session, username, null, clientIp(ex));
            JsonObject out = new JsonObject();
            out.addProperty("ok", true);
            sendJson(ex, 200, out);
        } catch (IllegalStateException e) {
            sendJson(ex, 409, errorJson("last_owner", e.getMessage()));
        } catch (IllegalArgumentException e) {
            sendJson(ex, 400, errorJson("invalid_account", e.getMessage()));
        }
    }

    public static void handleAuditLog(HttpExchange ex) throws IOException {
        if (!"GET".equalsIgnoreCase(ex.getRequestMethod())) {
            sendText(ex, 405, "Method not allowed");
            return;
        }
        SessionManager.SessionState session = sessionOf(ex);
        if (session == null || !session.role().canWrite()) {
            sendReadOnly(ex);
            return;
        }
        int limit = clampInt(parseQueryLimit(ex), 200, 1, AuditLog.MAX_ENTRIES);
        Path auditPath = DashboardAuthServices.auditPath();
        List<AuditEvent> probe = AuditLog.read(auditPath, limit + 1);
        boolean truncated = probe.size() > limit;
        List<AuditEvent> entries = truncated ? probe.subList(0, limit) : probe;
        JsonArray arr = new JsonArray();
        for (AuditEvent row : entries) {
            arr.add(GSON.toJsonTree(row));
        }
        JsonObject out = new JsonObject();
        out.add("entries", arr);
        out.addProperty("truncated", truncated);
        out.addProperty("retention_days", AuditLog.RETENTION_DAYS);
        out.addProperty("max_entries", AuditLog.MAX_ENTRIES);
        sendJson(ex, 200, out);
    }

    private static int parseQueryLimit(HttpExchange ex) {
        String query = ex.getRequestURI().getQuery();
        if (query == null) {
            return 200;
        }
        for (String part : query.split("&")) {
            if (part.startsWith("limit=")) {
                try {
                    return Integer.parseInt(part.substring(6));
                } catch (NumberFormatException ignored) {
                    return 200;
                }
            }
        }
        return 200;
    }

    private static int clampInt(int value, int fallback, int min, int max) {
        int v = value > 0 ? value : fallback;
        if (v < min) {
            return min;
        }
        if (v > max) {
            return max;
        }
        return v;
    }

    public static SessionManager.SessionState requireFullSession(HttpExchange ex) throws IOException {
        return requireSession(ex, false, false);
    }

    public static SessionManager.SessionState requireSession(
            HttpExchange ex,
            boolean allowMustChange,
            boolean allowTotpPending
    ) throws IOException {
        if (rejectWhenAuthUnavailable(ex)) {
            return null;
        }
        SessionManager.SessionState session = resolveSession(ex);
        if (session == null) {
            sendJson(ex, 401, errorJson("unauthorized", "Unauthorized"));
            return null;
        }
        if (!allowMustChange && session.mustChangePassword()) {
            sendJson(ex, 403, errorJson("password_change_required", "Password change required"));
            return null;
        }
        if (!allowTotpPending && session.totpRequired() && !session.totpVerified()) {
            sendJson(ex, 403, errorJson("totp_required", "Authenticator code required"));
            return null;
        }
        ex.setAttribute("wt.session", session);
        return session;
    }

    public static SessionManager.SessionState sessionOf(HttpExchange ex) {
        Object attr = ex.getAttribute("wt.session");
        return attr instanceof SessionManager.SessionState s ? s : null;
    }

    /** Actor name for state records; falls back to the legacy literal when no session is attached. */
    public static String actorOf(HttpExchange ex) {
        SessionManager.SessionState s = sessionOf(ex);
        return s != null ? s.username() : "dashboard";
    }

    public static void sendReadOnly(HttpExchange ex) throws IOException {
        sendJson(ex, 403, errorJson("read_only_account",
                "Your account can view Watchtower but not change it"));
    }

    public static boolean requireOwner(HttpExchange ex, SessionManager.SessionState session) throws IOException {
        if (session != null && session.role().canManageAccounts()) {
            return true;
        }
        DashboardAudit.recordDenied(session, requestTarget(ex), clientIp(ex));
        sendJson(ex, 403, errorJson("owner_required", "Only an owner can manage accounts"));
        return false;
    }

    public static String requestTarget(HttpExchange ex) {
        return ex.getRequestMethod().toUpperCase(Locale.ROOT) + " " + ex.getRequestURI().getPath();
    }

    public static SessionManager.SessionState resolveSession(HttpExchange ex) {
        if (DashboardAuthServices.sessions() == null) {
            return null;
        }
        String cookie = cookieValue(ex, SessionManager.COOKIE_NAME);
        if (cookie == null) {
            return null;
        }
        return DashboardAuthServices.sessions().resolveCookie(cookie);
    }

    public static JsonObject buildSessionJson(SessionManager.SessionState session, String hostname) {
        DashboardAuthStore store = DashboardAuthServices.store();
        JsonObject out = new JsonObject();
        String bindHost = ModRuntime.config().dashboardBindHost();
        out.addProperty("auth_required", true);
        out.addProperty("dashboard_bind_host", bindHost);
        out.addProperty("bind_exposed", "0.0.0.0".equals(bindHost));
        out.addProperty("security_update", DashboardAuthServices.wasFreshAccountCreated());
        if (session == null) {
            out.addProperty("authenticated", false);
            return out;
        }
        DashboardAuthRecord account = store != null ? store.findById(session.accountId()) : null;
        out.addProperty("authenticated", true);
        out.addProperty("username", session.username());
        out.addProperty("must_change_password", session.mustChangePassword());
        out.addProperty("totp_enabled", account != null && account.totp_enabled);
        out.addProperty("totp_required",
                session.totpRequired() && !session.totpVerified() && !session.mustChangePassword());
        out.addProperty("role", session.role().wire());
        out.addProperty("can_write", session.role().canWrite());
        out.addProperty("can_manage_accounts", session.role().canManageAccounts());
        out.addProperty("fully_authenticated", session.isFullyAuthenticated());
        putMinecraftLink(out, account);
        if (account != null) {
            if (account.ui_theme != null && !account.ui_theme.isBlank()) {
                out.addProperty("ui_theme", account.ui_theme);
            }
            if (account.ui_accent != null && !account.ui_accent.isBlank()) {
                out.addProperty("ui_accent", account.ui_accent);
            }
        }
        if (hostname != null) {
            out.addProperty("hostname", hostname);
        }
        return out;
    }

    private static boolean rejectWhenAuthUnavailable(HttpExchange ex) throws IOException {
        if (!DashboardAuthServices.isUnavailable()) {
            return false;
        }
        sendJson(ex, 503, errorJson("auth_unavailable",
                "Dashboard accounts could not be loaded. Check the server log, then run "
                        + "/watchtower dashboard reset-password to rebuild the owner account."));
        return true;
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
