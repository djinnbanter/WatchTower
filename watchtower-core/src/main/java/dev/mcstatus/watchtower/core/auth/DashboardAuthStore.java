package dev.mcstatus.watchtower.core.auth;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Objects;

/** Load/save dashboard-auth.json and credential operations. */
public final class DashboardAuthStore {
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();

    private final Path authPath;
    private final AuthKeyStore keyStore;
    private final TotpService totpService;
    private DashboardAuthRecord record;

    public DashboardAuthStore(Path authPath, AuthKeyStore keyStore) throws IOException {
        this.authPath = authPath;
        this.keyStore = keyStore;
        this.totpService = new TotpService(keyStore);
        this.record = loadOrNull();
    }

    public boolean exists() {
        return record != null;
    }

    public DashboardAuthRecord getRecord() {
        return record;
    }

    public TotpService totpService() {
        return totpService;
    }

    public GeneratedCredentials ensureDefaultAccount() throws IOException {
        if (record != null) {
            return null;
        }
        String password = DashboardAuthRecord.DEFAULT_INITIAL_PASSWORD;
        PasswordHasher.HashRecord hash = PasswordHasher.hashPassword(password.toCharArray());
        record = DashboardAuthRecord.freshDefault(DashboardAuthRecord.DEFAULT_USERNAME, hash);
        save();
        return new GeneratedCredentials(record.username, password);
    }

    public GeneratedCredentials resetPassword(boolean clear2fa) throws IOException {
        Objects.requireNonNull(record, "No dashboard account");
        String password = DashboardAuthRecord.DEFAULT_INITIAL_PASSWORD;
        record.password = PasswordHasher.hashPassword(password.toCharArray());
        record.must_change_password = true;
        record.password_changed_at = null;
        if (clear2fa) {
            record.totp_enabled = false;
            record.totp_secret_enc = null;
            record.recovery_code_hashes = new ArrayList<>();
        }
        save();
        return new GeneratedCredentials(record.username, password);
    }

    public boolean verifyPassword(char[] password) {
        if (record == null || record.password == null) {
            return false;
        }
        return PasswordHasher.verify(password, record.password);
    }

    public void setPassword(char[] newPassword) throws IOException {
        Objects.requireNonNull(record, "No dashboard account");
        record.password = PasswordHasher.hashPassword(newPassword);
        record.must_change_password = false;
        record.password_changed_at = Instant.now().toString();
        save();
    }

    public void changeUsername(String newUsername) throws IOException {
        Objects.requireNonNull(record, "No dashboard account");
        String trimmed = newUsername != null ? newUsername.trim() : "";
        if (trimmed.length() < 3 || trimmed.length() > 32) {
            throw new IllegalArgumentException("Username must be 3-32 characters");
        }
        if (!trimmed.matches("[a-zA-Z0-9_-]+")) {
            throw new IllegalArgumentException("Username may only contain letters, numbers, _ and -");
        }
        record.username = trimmed;
        save();
    }

    public String beginTotpSetup() throws IOException {
        Objects.requireNonNull(record, "No dashboard account");
        String secret = totpService.generateSecret();
        record.totp_secret_enc = totpService.encryptSecret(secret);
        record.totp_enabled = false;
        save();
        return secret;
    }

    public RecoveryCodeService.GeneratedCodes confirmTotpSetup(String code) throws IOException {
        Objects.requireNonNull(record, "No dashboard account");
        String secret = totpService.decryptSecret(record.totp_secret_enc);
        if (secret == null || !totpService.verifyCode(secret, code)) {
            throw new IllegalArgumentException("Invalid authenticator code");
        }
        record.totp_enabled = true;
        RecoveryCodeService.GeneratedCodes codes = RecoveryCodeService.generate();
        record.recovery_code_hashes = new ArrayList<>(codes.hashes());
        save();
        return codes;
    }

    public void disableTotp(char[] password, String totpOrRecovery) throws IOException {
        Objects.requireNonNull(record, "No dashboard account");
        if (!verifyPassword(password)) {
            throw new IllegalArgumentException("Invalid password");
        }
        if (!verifyTotpOrRecovery(totpOrRecovery)) {
            throw new IllegalArgumentException("Invalid authenticator or recovery code");
        }
        record.totp_enabled = false;
        record.totp_secret_enc = null;
        record.recovery_code_hashes = new ArrayList<>();
        save();
    }

    public RecoveryCodeService.GeneratedCodes regenerateRecoveryCodes(char[] password, String totpCode) throws IOException {
        Objects.requireNonNull(record, "No dashboard account");
        if (!record.totp_enabled) {
            throw new IllegalStateException("2FA is not enabled");
        }
        if (!verifyPassword(password)) {
            throw new IllegalArgumentException("Invalid password");
        }
        String secret = totpService.decryptSecret(record.totp_secret_enc);
        if (secret == null || !totpService.verifyCode(secret, totpCode)) {
            throw new IllegalArgumentException("Invalid authenticator code");
        }
        RecoveryCodeService.GeneratedCodes codes = RecoveryCodeService.generate();
        record.recovery_code_hashes = new ArrayList<>(codes.hashes());
        save();
        return codes;
    }

    public boolean verifyTotpCode(String code) {
        if (record == null || !record.totp_enabled) {
            return false;
        }
        String secret = totpService.decryptSecret(record.totp_secret_enc);
        return totpService.verifyCode(secret, code);
    }

    public boolean verifyTotpOrRecovery(String code) {
        if (record == null) {
            return false;
        }
        if (record.totp_enabled) {
            if (verifyTotpCode(code)) {
                return true;
            }
            List<String> hashes = new ArrayList<>(record.recovery_code_hashes);
            if (RecoveryCodeService.verifyAndConsume(code, hashes)) {
                record.recovery_code_hashes = hashes;
                try {
                    save();
                } catch (IOException e) {
                    return false;
                }
                return true;
            }
            return false;
        }
        return true;
    }

    public boolean consumeRecoveryCode(String code) throws IOException {
        if (record == null || record.recovery_code_hashes == null) {
            return false;
        }
        List<String> hashes = new ArrayList<>(record.recovery_code_hashes);
        if (!RecoveryCodeService.verifyAndConsume(code, hashes)) {
            return false;
        }
        record.recovery_code_hashes = hashes;
        save();
        return true;
    }

    public String username() {
        return record != null ? record.username : null;
    }

    public boolean mustChangePassword() {
        return record != null && record.must_change_password;
    }

    public boolean totpEnabled() {
        return record != null && record.totp_enabled;
    }

    /**
     * Accounts that never completed first login may still have a legacy random password hash.
     * Align them to the documented default so operators can sign in with watchtower/password.
     */
    public boolean alignPendingDefaultPassword() throws IOException {
        if (record == null || !record.must_change_password || record.password_changed_at != null) {
            return false;
        }
        char[] defaultPassword = DashboardAuthRecord.DEFAULT_INITIAL_PASSWORD.toCharArray();
        try {
            if (verifyPassword(defaultPassword)) {
                return false;
            }
            record.password = PasswordHasher.hashPassword(defaultPassword);
            save();
            return true;
        } finally {
            java.util.Arrays.fill(defaultPassword, '\0');
        }
    }

    private DashboardAuthRecord loadOrNull() throws IOException {
        if (!Files.isRegularFile(authPath)) {
            return null;
        }
        String text = Files.readString(authPath, StandardCharsets.UTF_8);
        if (text.isBlank()) {
            return null;
        }
        DashboardAuthRecord loaded = GSON.fromJson(text, DashboardAuthRecord.class);
        if (loaded == null || loaded.password == null) {
            throw new IOException("Invalid dashboard-auth.json");
        }
        if (loaded.recovery_code_hashes == null) {
            loaded.recovery_code_hashes = new ArrayList<>();
        }
        return loaded;
    }

    private void save() throws IOException {
        Files.createDirectories(authPath.getParent());
        Path temp = authPath.resolveSibling(authPath.getFileName() + ".tmp");
        Files.writeString(temp, GSON.toJson(record) + System.lineSeparator(), StandardCharsets.UTF_8);
        Files.move(temp, authPath, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
        AuthFilePermissions.restrictToOwner(authPath);
    }

    public String buildOtpAuthUri(String issuer) {
        String secret = totpService.decryptSecret(record.totp_secret_enc);
        if (secret == null) {
            return null;
        }
        return totpService.buildOtpAuthUri(issuer, record.username, secret);
    }

    public boolean verifyUsername(String username) {
        if (record == null || username == null) {
            return false;
        }
        return record.username.equalsIgnoreCase(username.trim());
    }
}
