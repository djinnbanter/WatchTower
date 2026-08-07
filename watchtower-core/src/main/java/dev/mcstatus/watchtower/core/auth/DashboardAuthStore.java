package dev.mcstatus.watchtower.core.auth;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonObject;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.UUID;

/** Load/save dashboard-auth.json (schema 2 multi-account store) and credential operations. */
public final class DashboardAuthStore {
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();

    private final Path authPath;
    private final AuthKeyStore keyStore;
    private final TotpService totpService;
    private DashboardAuthFile file;
    private IOException migrationWriteFailed;

    public DashboardAuthStore(Path authPath, AuthKeyStore keyStore) throws IOException {
        this.authPath = authPath;
        this.keyStore = keyStore;
        this.totpService = new TotpService(keyStore);
        this.file = loadOrNull();
    }

    public boolean exists() {
        return file != null;
    }

    public TotpService totpService() {
        return totpService;
    }

    public IOException migrationWriteFailure() {
        return migrationWriteFailed;
    }

    public DashboardAuthRecord findByUsername(String username) {
        if (file == null || username == null) {
            return null;
        }
        String target = username.trim();
        for (DashboardAuthRecord r : file.accounts) {
            if (!r.disabled && r.username.equalsIgnoreCase(target)) {
                return r;
            }
        }
        return null;
    }

    public DashboardAuthRecord findById(String accountId) {
        if (file == null || accountId == null) {
            return null;
        }
        for (DashboardAuthRecord r : file.accounts) {
            if (accountId.equals(r.id)) {
                return r;
            }
        }
        return null;
    }

    /** Unmodifiable snapshot of all accounts, owner accounts first. */
    public List<DashboardAuthRecord> accounts() {
        if (file == null) {
            return List.of();
        }
        List<DashboardAuthRecord> sorted = new ArrayList<>(file.accounts);
        sorted.sort(Comparator.comparingInt(
                r -> AccountRole.fromWire(r.role) == AccountRole.OWNER ? 0 : 1));
        return Collections.unmodifiableList(sorted);
    }

    public DashboardAuthRecord ownerAccount() {
        if (file == null) {
            return null;
        }
        for (DashboardAuthRecord r : file.accounts) {
            if (!r.disabled && AccountRole.fromWire(r.role) == AccountRole.OWNER) {
                return r;
            }
        }
        return null;
    }

    public GeneratedCredentials ensureDefaultAccount() throws IOException {
        if (file != null) {
            return null;
        }
        String password = DashboardAuthRecord.DEFAULT_INITIAL_PASSWORD;
        PasswordHasher.HashRecord hash = PasswordHasher.hashPassword(password.toCharArray());
        DashboardAuthRecord owner = DashboardAuthRecord.freshDefault(DashboardAuthRecord.DEFAULT_USERNAME, hash);
        normalize(owner);
        file = new DashboardAuthFile();
        file.accounts.add(owner);
        save();
        return new GeneratedCredentials(owner.username, password);
    }

    public GeneratedCredentials createAccount(String username, AccountRole role, String createdByAccountId) throws IOException {
        Objects.requireNonNull(file, "No dashboard accounts");
        String trimmed = validateUsername(username);
        if (findAnyByUsername(trimmed) != null) {
            throw new IllegalArgumentException("Username already in use");
        }
        String password = PasswordHasher.generatePassword(16);
        PasswordHasher.HashRecord hash = PasswordHasher.hashPassword(password.toCharArray());
        DashboardAuthRecord created = DashboardAuthRecord.newAccount(trimmed, role, hash, createdByAccountId);
        file.accounts.add(created);
        save();
        return new GeneratedCredentials(trimmed, password);
    }

    public void setRole(String accountId, AccountRole role) throws IOException {
        guardLastOwner(accountId);
        DashboardAuthRecord r = requireAccount(accountId);
        r.role = role.wire();
        if (role == AccountRole.OWNER) {
            r.capabilities = new ArrayList<>();
        } else if (r.capabilities == null) {
            r.capabilities = new ArrayList<>();
        }
        save();
    }

    public void setDisabled(String accountId, boolean disabled) throws IOException {
        if (disabled) {
            guardLastOwner(accountId);
        }
        DashboardAuthRecord r = requireAccount(accountId);
        r.disabled = disabled;
        save();
    }

    public void deleteAccount(String accountId) throws IOException {
        guardLastOwner(accountId);
        DashboardAuthRecord r = requireAccount(accountId);
        file.accounts.remove(r);
        save();
    }

    public GeneratedCredentials resetAccountPassword(String accountId, boolean clear2fa) throws IOException {
        DashboardAuthRecord r = requireAccount(accountId);
        String password = DashboardAuthRecord.DEFAULT_INITIAL_PASSWORD;
        r.password = PasswordHasher.hashPassword(password.toCharArray());
        r.must_change_password = true;
        r.password_changed_at = null;
        if (clear2fa) {
            r.totp_enabled = false;
            r.totp_secret_enc = null;
            r.recovery_code_hashes = new ArrayList<>();
        }
        save();
        return new GeneratedCredentials(r.username, password);
    }

    public void recordLogin(String accountId) throws IOException {
        DashboardAuthRecord r = requireAccount(accountId);
        r.last_login_at = Instant.now().toString();
        save();
    }

    public boolean verifyPassword(String accountId, char[] password) {
        DashboardAuthRecord r = findById(accountId);
        if (r == null || r.password == null) {
            return false;
        }
        return PasswordHasher.verify(password, r.password);
    }

    public void setPassword(String accountId, char[] newPassword) throws IOException {
        DashboardAuthRecord r = requireAccount(accountId);
        r.password = PasswordHasher.hashPassword(newPassword);
        r.must_change_password = false;
        r.password_changed_at = Instant.now().toString();
        save();
    }

    public void changeUsername(String accountId, String newUsername) throws IOException {
        DashboardAuthRecord r = requireAccount(accountId);
        String trimmed = validateUsername(newUsername);
        DashboardAuthRecord existing = findAnyByUsername(trimmed);
        if (existing != null && !existing.id.equals(accountId)) {
            throw new IllegalArgumentException("Username already in use");
        }
        r.username = trimmed;
        save();
    }

    public void setMinecraftLink(String accountId, String uuid, String name) throws IOException {
        DashboardAuthRecord r = requireAccount(accountId);
        String normalizedUuid = normalizeMinecraftUuid(uuid);
        String trimmedName = validateMinecraftName(name);
        for (DashboardAuthRecord other : file.accounts) {
            if (other.disabled || other.id.equals(accountId)) {
                continue;
            }
            if (normalizedUuid.equalsIgnoreCase(nullToEmpty(other.minecraft_uuid))) {
                throw new IllegalArgumentException("Minecraft player already linked to another account");
            }
        }
        r.minecraft_uuid = normalizedUuid;
        r.minecraft_name = trimmedName;
        save();
    }

    public void clearMinecraftLink(String accountId) throws IOException {
        DashboardAuthRecord r = requireAccount(accountId);
        r.minecraft_uuid = null;
        r.minecraft_name = null;
        save();
    }

    /** Persist dashboard appearance prefs for an account. */
    public void updateAppearance(String accountId, String theme, String accent) throws IOException {
        DashboardAuthRecord r = requireAccount(accountId);
        r.ui_theme = normalizeUiTheme(theme);
        r.ui_accent = normalizeUiAccent(accent);
        save();
    }

    static String normalizeUiTheme(String theme) {
        if (theme == null || theme.isBlank()) {
            throw new IllegalArgumentException("theme required");
        }
        String t = theme.trim().toLowerCase();
        if (!t.equals("light") && !t.equals("dark") && !t.equals("black") && !t.equals("system")) {
            throw new IllegalArgumentException("invalid theme: " + theme);
        }
        return t;
    }

    static String normalizeUiAccent(String accent) {
        if (accent == null || accent.isBlank()) {
            throw new IllegalArgumentException("accent required");
        }
        String a = accent.trim().toLowerCase();
        switch (a) {
            case "signal", "amber", "teal", "violet", "rose", "green", "coral", "slate" -> {
                return a;
            }
            default -> throw new IllegalArgumentException("invalid accent: " + accent);
        }
    }

    private static String nullToEmpty(String value) {
        return value == null ? "" : value;
    }

    /** Accepts dashed or undashed UUID; stores lowercase dashed form. */
    static String normalizeMinecraftUuid(String uuid) {
        if (uuid == null || uuid.isBlank()) {
            throw new IllegalArgumentException("Minecraft UUID is required");
        }
        String raw = uuid.trim().replace("-", "").toLowerCase();
        if (!raw.matches("[0-9a-f]{32}")) {
            throw new IllegalArgumentException("Invalid Minecraft UUID");
        }
        return raw.substring(0, 8) + "-" + raw.substring(8, 12) + "-" + raw.substring(12, 16)
                + "-" + raw.substring(16, 20) + "-" + raw.substring(20);
    }

    static String validateMinecraftName(String name) {
        String trimmed = name != null ? name.trim() : "";
        if (trimmed.isEmpty() || trimmed.length() > 16) {
            throw new IllegalArgumentException("Minecraft name must be 1-16 characters");
        }
        return trimmed;
    }

    public String beginTotpSetup(String accountId) throws IOException {
        DashboardAuthRecord r = requireAccount(accountId);
        String secret = totpService.generateSecret();
        r.totp_secret_enc = totpService.encryptSecret(secret);
        r.totp_enabled = false;
        save();
        return secret;
    }

    public RecoveryCodeService.GeneratedCodes confirmTotpSetup(String accountId, String code) throws IOException {
        DashboardAuthRecord r = requireAccount(accountId);
        String secret = totpService.decryptSecret(r.totp_secret_enc);
        if (secret == null || !totpService.verifyCode(secret, code)) {
            throw new IllegalArgumentException("Invalid authenticator code");
        }
        r.totp_enabled = true;
        RecoveryCodeService.GeneratedCodes codes = RecoveryCodeService.generate();
        r.recovery_code_hashes = new ArrayList<>(codes.hashes());
        save();
        return codes;
    }

    public void disableTotp(String accountId, char[] password, String totpOrRecovery) throws IOException {
        requireAccount(accountId);
        if (!verifyPassword(accountId, password)) {
            throw new IllegalArgumentException("Invalid password");
        }
        if (!verifyTotpOrRecovery(accountId, totpOrRecovery)) {
            throw new IllegalArgumentException("Invalid authenticator or recovery code");
        }
        DashboardAuthRecord r = requireAccount(accountId);
        r.totp_enabled = false;
        r.totp_secret_enc = null;
        r.recovery_code_hashes = new ArrayList<>();
        save();
    }

    public RecoveryCodeService.GeneratedCodes regenerateRecoveryCodes(String accountId, char[] password, String totpCode) throws IOException {
        DashboardAuthRecord r = requireAccount(accountId);
        if (!r.totp_enabled) {
            throw new IllegalStateException("2FA is not enabled");
        }
        if (!verifyPassword(accountId, password)) {
            throw new IllegalArgumentException("Invalid password");
        }
        String secret = totpService.decryptSecret(r.totp_secret_enc);
        if (secret == null || !totpService.verifyCode(secret, totpCode)) {
            throw new IllegalArgumentException("Invalid authenticator code");
        }
        RecoveryCodeService.GeneratedCodes codes = RecoveryCodeService.generate();
        r.recovery_code_hashes = new ArrayList<>(codes.hashes());
        save();
        return codes;
    }

    public boolean verifyTotpCode(String accountId, String code) {
        DashboardAuthRecord r = findById(accountId);
        if (r == null || !r.totp_enabled) {
            return false;
        }
        String secret = totpService.decryptSecret(r.totp_secret_enc);
        return totpService.verifyCode(secret, code);
    }

    public boolean verifyTotpOrRecovery(String accountId, String code) throws IOException {
        DashboardAuthRecord r = findById(accountId);
        if (r == null) {
            return false;
        }
        if (r.totp_enabled) {
            if (verifyTotpCode(accountId, code)) {
                return true;
            }
            List<String> hashes = new ArrayList<>(r.recovery_code_hashes);
            if (RecoveryCodeService.verifyAndConsume(code, hashes)) {
                r.recovery_code_hashes = hashes;
                save();
                return true;
            }
            return false;
        }
        return true;
    }

    public boolean totpEnabled(String accountId) {
        DashboardAuthRecord r = findById(accountId);
        return r != null && r.totp_enabled;
    }

    public boolean mustChangePassword(String accountId) {
        DashboardAuthRecord r = findById(accountId);
        return r != null && r.must_change_password;
    }

    public String buildOtpAuthUri(String issuer, String accountId) {
        DashboardAuthRecord r = findById(accountId);
        if (r == null) {
            return null;
        }
        String secret = totpService.decryptSecret(r.totp_secret_enc);
        if (secret == null) {
            return null;
        }
        return totpService.buildOtpAuthUri(issuer, r.username, secret);
    }

    /**
     * Accounts that never completed first login may still have a legacy random password hash.
     * Align the owner to the documented default so operators can sign in with watchtower/password.
     */
    public boolean alignPendingDefaultPassword() throws IOException {
        DashboardAuthRecord owner = ownerAccount();
        if (owner == null || !owner.must_change_password || owner.password_changed_at != null) {
            return false;
        }
        char[] defaultPassword = DashboardAuthRecord.DEFAULT_INITIAL_PASSWORD.toCharArray();
        try {
            if (verifyPassword(owner.id, defaultPassword)) {
                return false;
            }
            owner.password = PasswordHasher.hashPassword(defaultPassword);
            save();
            return true;
        } finally {
            Arrays.fill(defaultPassword, '\0');
        }
    }

    /** Refuses changes that would leave the install with no usable owner. */
    private void guardLastOwner(String accountId) {
        DashboardAuthRecord target = requireAccount(accountId);
        if (AccountRole.fromWire(target.role) != AccountRole.OWNER || target.disabled) {
            return;
        }
        long remaining = file.accounts.stream()
                .filter(r -> !r.id.equals(accountId))
                .filter(r -> !r.disabled)
                .filter(r -> AccountRole.fromWire(r.role) == AccountRole.OWNER)
                .count();
        if (remaining == 0) {
            throw new IllegalStateException("This is the only owner \u2014 promote someone else first");
        }
    }

    private DashboardAuthRecord requireAccount(String accountId) {
        DashboardAuthRecord r = findById(accountId);
        if (r == null) {
            throw new IllegalArgumentException("Unknown account");
        }
        return r;
    }

    private DashboardAuthRecord findAnyByUsername(String username) {
        if (file == null || username == null) {
            return null;
        }
        String target = username.trim();
        for (DashboardAuthRecord r : file.accounts) {
            if (r.username.equalsIgnoreCase(target)) {
                return r;
            }
        }
        return null;
    }

    private static String validateUsername(String username) {
        String trimmed = username != null ? username.trim() : "";
        if (trimmed.length() < 3 || trimmed.length() > 32) {
            throw new IllegalArgumentException("Username must be 3-32 characters");
        }
        if (!trimmed.matches("[a-zA-Z0-9_-]+")) {
            throw new IllegalArgumentException("Username may only contain letters, numbers, _ and -");
        }
        return trimmed;
    }

    private DashboardAuthFile loadOrNull() throws IOException {
        if (!Files.isRegularFile(authPath)) {
            return null;
        }
        String text = Files.readString(authPath, StandardCharsets.UTF_8);
        if (text.isBlank()) {
            return null;
        }
        JsonObject root = GSON.fromJson(text, JsonObject.class);
        if (root == null) {
            throw new IOException("Invalid dashboard-auth.json");
        }
        if (root.has("accounts")) {
            DashboardAuthFile loaded = GSON.fromJson(root, DashboardAuthFile.class);
            if (loaded.accounts == null || loaded.accounts.isEmpty()) {
                throw new IOException("Invalid dashboard-auth.json: no accounts");
            }
            loaded.accounts.forEach(DashboardAuthStore::normalize);
            return loaded;
        }
        return migrateSchema1(text, root);
    }

    /** Schema 1 kept one credential at the top level; it becomes the owner account. */
    private DashboardAuthFile migrateSchema1(String originalText, JsonObject legacyRoot) throws IOException {
        DashboardAuthRecord legacy = GSON.fromJson(legacyRoot, DashboardAuthRecord.class);
        if (legacy == null || legacy.password == null) {
            throw new IOException("Invalid dashboard-auth.json");
        }
        legacy.role = AccountRole.OWNER.wire();
        legacy.disabled = false;
        normalize(legacy);
        DashboardAuthFile migrated = new DashboardAuthFile();
        migrated.accounts.add(legacy);
        this.file = migrated;
        backupOnce(originalText);
        try {
            save();
        } catch (IOException e) {
            // Run this boot on the in-memory result rather than locking the operator out.
            migrationWriteFailed = e;
        }
        return migrated;
    }

    /** One-time copy of the pre-1.1.18 file, never overwritten once it exists. */
    private void backupOnce(String originalText) {
        Path backup = authPath.resolveSibling(authPath.getFileName() + ".pre-1.1.18.bak");
        try {
            if (Files.exists(backup)) {
                return;
            }
            Files.writeString(backup, originalText, StandardCharsets.UTF_8);
            AuthFilePermissions.restrictToOwner(backup);
        } catch (IOException | RuntimeException ignored) {
            // A missing backup must not stop the upgrade.
        }
    }

    /**
     * Persist capability flags for an account. Owner accounts always clear extras
     * (Owner has every known capability implicitly; {@code mods.mutate} is never required on disk).
     */
    public void setCapabilities(String accountId, List<String> capabilities) throws IOException {
        DashboardAuthRecord r = requireAccount(accountId);
        if (AccountRole.fromWire(r.role) == AccountRole.OWNER) {
            r.capabilities = new ArrayList<>();
        } else {
            r.capabilities = AccountCapabilities.normalize(capabilities);
        }
        save();
    }

    private static void normalize(DashboardAuthRecord r) {
        if (r.id == null || r.id.isBlank()) {
            r.id = "acc_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        }
        if (r.role == null || r.role.isBlank()) {
            r.role = AccountRole.VIEWER.wire();
        }
        if (r.recovery_code_hashes == null) {
            r.recovery_code_hashes = new ArrayList<>();
        }
        if (AccountRole.fromWire(r.role) == AccountRole.OWNER) {
            r.capabilities = new ArrayList<>();
        } else {
            r.capabilities = AccountCapabilities.normalize(r.capabilities);
        }
    }

    private void save() throws IOException {
        syncLegacyMirror();
        Files.createDirectories(authPath.getParent());
        Path temp = authPath.resolveSibling(authPath.getFileName() + ".tmp");
        Files.writeString(temp, GSON.toJson(file) + System.lineSeparator(), StandardCharsets.UTF_8);
        Files.move(temp, authPath, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
        AuthFilePermissions.restrictToOwner(authPath);
    }

    /** Keeps the schema 1 shaped owner fields in step so pre-1.1.18 builds can still read the file. */
    private void syncLegacyMirror() {
        DashboardAuthRecord owner = ownerAccount();
        if (owner == null) {
            return;
        }
        file.username = owner.username;
        file.password = owner.password;
        file.must_change_password = owner.must_change_password;
        file.totp_enabled = owner.totp_enabled;
        file.totp_secret_enc = owner.totp_secret_enc;
        file.recovery_code_hashes = owner.recovery_code_hashes != null
                ? new ArrayList<>(owner.recovery_code_hashes)
                : new ArrayList<>();
    }
}
