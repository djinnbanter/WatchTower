package dev.mcstatus.watchtower.core.auth;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;
import java.nio.file.Files;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DashboardAuthStoreTest {

    @TempDir
    Path tempDir;

    @Test
    void ensureDefaultAccountCreatesFile() throws Exception {
        Path authPath = tempDir.resolve("dashboard-auth.json");
        Path keyPath = tempDir.resolve(".auth-key");
        AuthKeyStore keys = new AuthKeyStore(keyPath);
        DashboardAuthStore store = new DashboardAuthStore(authPath, keys);

        assertFalse(store.exists());
        GeneratedCredentials creds = store.ensureDefaultAccount();
        assertNotNull(creds);
        assertTrue(store.exists());
        assertEquals("password", creds.password());
        assertTrue(store.verifyPassword(creds.password().toCharArray()));
        assertTrue(store.mustChangePassword());
    }

    @Test
    void setPasswordClearsMustChange() throws Exception {
        Path authPath = tempDir.resolve("dashboard-auth.json");
        AuthKeyStore keys = new AuthKeyStore(tempDir.resolve(".auth-key"));
        DashboardAuthStore store = new DashboardAuthStore(authPath, keys);
        store.ensureDefaultAccount();

        store.setPassword("new-password-123".toCharArray());
        assertFalse(store.mustChangePassword());
        assertTrue(store.verifyPassword("new-password-123".toCharArray()));
    }

    @Test
    void resetPasswordRegenerates() throws Exception {
        Path authPath = tempDir.resolve("dashboard-auth.json");
        AuthKeyStore keys = new AuthKeyStore(tempDir.resolve(".auth-key"));
        DashboardAuthStore store = new DashboardAuthStore(authPath, keys);
        store.ensureDefaultAccount();
        store.setPassword("user-chosen-secret".toCharArray());

        GeneratedCredentials reset = store.resetPassword(false);
        assertNotNull(reset);
        assertEquals("password", reset.password());
        assertTrue(store.mustChangePassword());
        assertTrue(store.verifyPassword("password".toCharArray()));
        assertFalse(store.verifyPassword("user-chosen-secret".toCharArray()));
    }

    @Test
    void alignPendingDefaultPasswordMigratesLegacyRandom() throws Exception {
        Path authPath = tempDir.resolve("dashboard-auth.json");
        AuthKeyStore keys = new AuthKeyStore(tempDir.resolve(".auth-key"));
        String legacyRandom = PasswordHasher.generatePassword(20);
        DashboardAuthRecord record = DashboardAuthRecord.freshDefault(
                DashboardAuthRecord.DEFAULT_USERNAME,
                PasswordHasher.hashPassword(legacyRandom.toCharArray())
        );
        Files.writeString(
                authPath,
                new com.google.gson.GsonBuilder().setPrettyPrinting().create().toJson(record)
                        + System.lineSeparator()
        );

        DashboardAuthStore store = new DashboardAuthStore(authPath, keys);
        assertTrue(store.verifyPassword(legacyRandom.toCharArray()));
        assertFalse(store.verifyPassword("password".toCharArray()));

        assertTrue(store.alignPendingDefaultPassword());
        assertTrue(store.verifyPassword("password".toCharArray()));
        assertFalse(store.verifyPassword(legacyRandom.toCharArray()));
    }

    @Test
    void totpSetupAndVerify() throws Exception {
        Path authPath = tempDir.resolve("dashboard-auth.json");
        AuthKeyStore keys = new AuthKeyStore(tempDir.resolve(".auth-key"));
        DashboardAuthStore store = new DashboardAuthStore(authPath, keys);
        GeneratedCredentials creds = store.ensureDefaultAccount();
        assertNotNull(creds);

        String secret = store.beginTotpSetup();
        assertNotNull(secret);
        TotpService totp = store.totpService();
        String code = totp.buildOtpAuthUri("Watchtower", store.username(), secret);
        assertTrue(code.startsWith("otpauth://"));

        // Generate current TOTP code using library internals is hard in test;
        // use TimeBasedOneTimePasswordGenerator alternative - we'll verify via dev.samstevens
        dev.samstevens.totp.code.DefaultCodeGenerator gen =
                new dev.samstevens.totp.code.DefaultCodeGenerator(dev.samstevens.totp.code.HashingAlgorithm.SHA1);
        long counter = System.currentTimeMillis() / 1000 / 30;
        String currentCode = gen.generate(secret, counter);

        RecoveryCodeService.GeneratedCodes recovery = store.confirmTotpSetup(currentCode);
        assertEquals(8, recovery.plainCodes().size());
        assertTrue(store.totpEnabled());
        assertTrue(store.verifyTotpCode(currentCode));
    }

    @Test
    void recoveryCodeSingleUse() throws Exception {
        Path authPath = tempDir.resolve("dashboard-auth.json");
        AuthKeyStore keys = new AuthKeyStore(tempDir.resolve(".auth-key"));
        DashboardAuthStore store = new DashboardAuthStore(authPath, keys);
        store.ensureDefaultAccount();
        String secret = store.beginTotpSetup();
        dev.samstevens.totp.code.DefaultCodeGenerator gen =
                new dev.samstevens.totp.code.DefaultCodeGenerator(dev.samstevens.totp.code.HashingAlgorithm.SHA1);
        long counter = System.currentTimeMillis() / 1000 / 30;
        String currentCode = gen.generate(secret, counter);
        RecoveryCodeService.GeneratedCodes recovery = store.confirmTotpSetup(currentCode);
        String plain = recovery.plainCodes().get(0);

        assertTrue(store.verifyTotpOrRecovery(plain));
        assertFalse(store.verifyTotpOrRecovery(plain));
    }
}
