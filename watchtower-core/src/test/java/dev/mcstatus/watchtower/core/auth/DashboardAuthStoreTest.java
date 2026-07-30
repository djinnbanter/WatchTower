package dev.mcstatus.watchtower.core.auth;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Path;
import java.nio.file.Files;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
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
        String ownerId = store.ownerAccount().id;
        assertTrue(store.verifyPassword(ownerId, creds.password().toCharArray()));
        assertTrue(store.mustChangePassword(ownerId));
    }

    @Test
    void setPasswordClearsMustChange() throws Exception {
        Path authPath = tempDir.resolve("dashboard-auth.json");
        AuthKeyStore keys = new AuthKeyStore(tempDir.resolve(".auth-key"));
        DashboardAuthStore store = new DashboardAuthStore(authPath, keys);
        store.ensureDefaultAccount();
        String ownerId = store.ownerAccount().id;

        store.setPassword(ownerId, "new-password-123".toCharArray());
        assertFalse(store.mustChangePassword(ownerId));
        assertTrue(store.verifyPassword(ownerId, "new-password-123".toCharArray()));
    }

    @Test
    void resetPasswordRegenerates() throws Exception {
        Path authPath = tempDir.resolve("dashboard-auth.json");
        AuthKeyStore keys = new AuthKeyStore(tempDir.resolve(".auth-key"));
        DashboardAuthStore store = new DashboardAuthStore(authPath, keys);
        store.ensureDefaultAccount();
        String ownerId = store.ownerAccount().id;
        store.setPassword(ownerId, "user-chosen-secret".toCharArray());

        GeneratedCredentials reset = store.resetAccountPassword(ownerId, false);
        assertNotNull(reset);
        assertEquals("password", reset.password());
        assertTrue(store.mustChangePassword(ownerId));
        assertTrue(store.verifyPassword(ownerId, "password".toCharArray()));
        assertFalse(store.verifyPassword(ownerId, "user-chosen-secret".toCharArray()));
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
        String ownerId = store.ownerAccount().id;
        assertTrue(store.verifyPassword(ownerId, legacyRandom.toCharArray()));
        assertFalse(store.verifyPassword(ownerId, "password".toCharArray()));

        assertTrue(store.alignPendingDefaultPassword());
        assertTrue(store.verifyPassword(ownerId, "password".toCharArray()));
        assertFalse(store.verifyPassword(ownerId, legacyRandom.toCharArray()));
    }

    @Test
    void totpSetupAndVerify() throws Exception {
        Path authPath = tempDir.resolve("dashboard-auth.json");
        AuthKeyStore keys = new AuthKeyStore(tempDir.resolve(".auth-key"));
        DashboardAuthStore store = new DashboardAuthStore(authPath, keys);
        GeneratedCredentials creds = store.ensureDefaultAccount();
        assertNotNull(creds);
        String ownerId = store.ownerAccount().id;

        String secret = store.beginTotpSetup(ownerId);
        assertNotNull(secret);
        TotpService totp = store.totpService();
        String code = totp.buildOtpAuthUri("Watchtower", store.ownerAccount().username, secret);
        assertTrue(code.startsWith("otpauth://"));

        // Generate current TOTP code using library internals is hard in test;
        // use TimeBasedOneTimePasswordGenerator alternative - we'll verify via dev.samstevens
        dev.samstevens.totp.code.DefaultCodeGenerator gen =
                new dev.samstevens.totp.code.DefaultCodeGenerator(dev.samstevens.totp.code.HashingAlgorithm.SHA1);
        long counter = System.currentTimeMillis() / 1000 / 30;
        String currentCode = gen.generate(secret, counter);

        RecoveryCodeService.GeneratedCodes recovery = store.confirmTotpSetup(ownerId, currentCode);
        assertEquals(8, recovery.plainCodes().size());
        assertTrue(store.totpEnabled(ownerId));
        assertTrue(store.verifyTotpCode(ownerId, currentCode));
    }

    @Test
    void recoveryCodeSingleUse() throws Exception {
        Path authPath = tempDir.resolve("dashboard-auth.json");
        AuthKeyStore keys = new AuthKeyStore(tempDir.resolve(".auth-key"));
        DashboardAuthStore store = new DashboardAuthStore(authPath, keys);
        store.ensureDefaultAccount();
        String ownerId = store.ownerAccount().id;
        String secret = store.beginTotpSetup(ownerId);
        dev.samstevens.totp.code.DefaultCodeGenerator gen =
                new dev.samstevens.totp.code.DefaultCodeGenerator(dev.samstevens.totp.code.HashingAlgorithm.SHA1);
        long counter = System.currentTimeMillis() / 1000 / 30;
        String currentCode = gen.generate(secret, counter);
        RecoveryCodeService.GeneratedCodes recovery = store.confirmTotpSetup(ownerId, currentCode);
        String plain = recovery.plainCodes().get(0);

        assertTrue(store.verifyTotpOrRecovery(ownerId, plain));
        assertFalse(store.verifyTotpOrRecovery(ownerId, plain));
    }

    @Test
    void schema1FileMigratesToOwnerAccount() throws Exception {
        Path authPath = tempDir.resolve("dashboard-auth.json");
        AuthKeyStore keys = new AuthKeyStore(tempDir.resolve(".auth-key"));
        // Legacy schema 1 shape: credential fields at the top level.
        String legacy = "{\"schema\":1,\"username\":\"ella\",\"password\":"
                + new com.google.gson.Gson().toJson(PasswordHasher.hashPassword("keep-this-pw".toCharArray()))
                + ",\"must_change_password\":false,\"totp_enabled\":false,"
                + "\"recovery_code_hashes\":[],\"created_at\":\"2026-01-01T00:00:00Z\"}";
        Files.writeString(authPath, legacy);

        DashboardAuthStore store = new DashboardAuthStore(authPath, keys);

        assertEquals(1, store.accounts().size());
        DashboardAuthRecord owner = store.findByUsername("ella");
        assertNotNull(owner);
        assertEquals(AccountRole.OWNER, AccountRole.fromWire(owner.role));
        assertNotNull(owner.id);
        assertFalse(owner.disabled);
        assertTrue(store.verifyPassword(owner.id, "keep-this-pw".toCharArray()));
        // Migration is persisted, not recomputed each boot.
        assertTrue(Files.readString(authPath).contains("\"accounts\""));
        assertTrue(new DashboardAuthStore(authPath, keys).verifyPassword(owner.id, "keep-this-pw".toCharArray()));
    }

    @Test
    void migrationKeepsForcedPasswordChangeAndDefaultPassword() throws Exception {
        // An install that never completed first login must still sign in with watchtower/password.
        Path authPath = tempDir.resolve("dashboard-auth.json");
        AuthKeyStore keys = new AuthKeyStore(tempDir.resolve(".auth-key"));
        DashboardAuthRecord legacy = DashboardAuthRecord.freshDefault(
                DashboardAuthRecord.DEFAULT_USERNAME,
                PasswordHasher.hashPassword("password".toCharArray()));
        legacy.role = null;
        legacy.id = null;
        Files.writeString(authPath, new com.google.gson.Gson().toJson(legacy));

        DashboardAuthStore store = new DashboardAuthStore(authPath, keys);
        DashboardAuthRecord owner = store.ownerAccount();

        assertNotNull(owner);
        assertEquals(AccountRole.OWNER, AccountRole.fromWire(owner.role));
        assertTrue(store.mustChangePassword(owner.id));
        assertTrue(store.verifyPassword(owner.id, "password".toCharArray()));
        assertFalse(store.alignPendingDefaultPassword());
    }

    @Test
    void migrationKeeps2faAndRecoveryCodesWorking() throws Exception {
        Path authPath = tempDir.resolve("dashboard-auth.json");
        AuthKeyStore keys = new AuthKeyStore(tempDir.resolve(".auth-key"));

        // Build a 2FA-enabled schema 1 file the way 1.1.x wrote it.
        DashboardAuthStore seed = new DashboardAuthStore(authPath, keys);
        seed.ensureDefaultAccount();
        String seedOwner = seed.ownerAccount().id;
        String secret = seed.beginTotpSetup(seedOwner);
        dev.samstevens.totp.code.DefaultCodeGenerator gen =
                new dev.samstevens.totp.code.DefaultCodeGenerator(dev.samstevens.totp.code.HashingAlgorithm.SHA1);
        String code = gen.generate(secret, System.currentTimeMillis() / 1000 / 30);
        RecoveryCodeService.GeneratedCodes codes = seed.confirmTotpSetup(seedOwner, code);
        DashboardAuthRecord flat = seed.ownerAccount();
        flat.id = null;
        flat.role = null;
        Files.writeString(authPath, new com.google.gson.Gson().toJson(flat));

        DashboardAuthStore store = new DashboardAuthStore(authPath, keys);
        String ownerId = store.ownerAccount().id;

        assertTrue(store.totpEnabled(ownerId));
        assertTrue(store.verifyTotpCode(ownerId, gen.generate(secret, System.currentTimeMillis() / 1000 / 30)));
        assertTrue(store.verifyTotpOrRecovery(ownerId, codes.plainCodes().get(0)));
    }

    @Test
    void schema2KeepsLegacyOwnerMirrorSoOlderBuildsStillParse() throws Exception {
        Path authPath = tempDir.resolve("dashboard-auth.json");
        AuthKeyStore keys = new AuthKeyStore(tempDir.resolve(".auth-key"));
        DashboardAuthStore store = new DashboardAuthStore(authPath, keys);
        store.ensureDefaultAccount();
        String ownerId = store.ownerAccount().id;
        store.setPassword(ownerId, "owner-real-pw".toCharArray());
        store.createAccount("marco", AccountRole.ADMIN, ownerId);

        // A pre-1.1.18 build reads the flat top-level fields and ignores "accounts".
        DashboardAuthRecord asOldBuildSeesIt = new com.google.gson.Gson()
                .fromJson(Files.readString(authPath), DashboardAuthRecord.class);
        assertNotNull(asOldBuildSeesIt.password);
        assertEquals(store.ownerAccount().username, asOldBuildSeesIt.username);
        assertTrue(PasswordHasher.verify("owner-real-pw".toCharArray(), asOldBuildSeesIt.password));
        assertFalse(asOldBuildSeesIt.must_change_password);
    }

    @Test
    void migrationWritesOneTimeBackupOfTheOriginalFile() throws Exception {
        Path authPath = tempDir.resolve("dashboard-auth.json");
        Path backup = tempDir.resolve("dashboard-auth.json.pre-1.1.18.bak");
        AuthKeyStore keys = new AuthKeyStore(tempDir.resolve(".auth-key"));
        DashboardAuthRecord legacy = DashboardAuthRecord.freshDefault(
                "ella", PasswordHasher.hashPassword("keep-this-pw".toCharArray()));
        legacy.id = null;
        legacy.role = null;
        String original = new com.google.gson.Gson().toJson(legacy);
        Files.writeString(authPath, original);

        DashboardAuthStore store = new DashboardAuthStore(authPath, keys);
        assertEquals(original, Files.readString(backup).trim());

        // Re-opening an already-migrated file must not overwrite the backup.
        store.setPassword(store.ownerAccount().id, "changed-since".toCharArray());
        new DashboardAuthStore(authPath, keys);
        assertEquals(original, Files.readString(backup).trim());
    }

    @Test
    void createAccountReturnsTempPasswordAndForcesChange() throws Exception {
        DashboardAuthStore store = freshStoreWithOwner();
        String ownerId = store.ownerAccount().id;

        GeneratedCredentials creds = store.createAccount("marco", AccountRole.ADMIN, ownerId);

        assertEquals("marco", creds.username());
        DashboardAuthRecord created = store.findByUsername("marco");
        assertEquals(AccountRole.ADMIN, AccountRole.fromWire(created.role));
        assertTrue(store.mustChangePassword(created.id));
        assertTrue(store.verifyPassword(created.id, creds.password().toCharArray()));
        assertEquals(ownerId, created.created_by);
    }

    @Test
    void duplicateUsernameRejectedCaseInsensitively() throws Exception {
        DashboardAuthStore store = freshStoreWithOwner();
        store.createAccount("marco", AccountRole.ADMIN, store.ownerAccount().id);
        assertThrows(IllegalArgumentException.class,
                () -> store.createAccount("MARCO", AccountRole.VIEWER, store.ownerAccount().id));
    }

    @Test
    void lastEnabledOwnerCannotBeDemotedDisabledOrDeleted() throws Exception {
        DashboardAuthStore store = freshStoreWithOwner();
        String ownerId = store.ownerAccount().id;
        store.createAccount("marco", AccountRole.ADMIN, ownerId);

        assertThrows(IllegalStateException.class, () -> store.setRole(ownerId, AccountRole.VIEWER));
        assertThrows(IllegalStateException.class, () -> store.setDisabled(ownerId, true));
        assertThrows(IllegalStateException.class, () -> store.deleteAccount(ownerId));
    }

    @Test
    void secondOwnerAllowsFirstToStepDown() throws Exception {
        DashboardAuthStore store = freshStoreWithOwner();
        String firstOwner = store.ownerAccount().id;
        GeneratedCredentials second = store.createAccount("nina", AccountRole.OWNER, firstOwner);

        store.setRole(firstOwner, AccountRole.ADMIN);

        assertEquals("nina", store.ownerAccount().username);
        assertEquals(AccountRole.ADMIN, AccountRole.fromWire(store.findById(firstOwner).role));
        assertTrue(store.verifyPassword(store.findByUsername("nina").id, second.password().toCharArray()));
    }

    @Test
    void disabledAccountNotFoundByUsername() throws Exception {
        DashboardAuthStore store = freshStoreWithOwner();
        store.createAccount("marco", AccountRole.ADMIN, store.ownerAccount().id);
        String marcoId = store.findByUsername("marco").id;

        store.setDisabled(marcoId, true);

        assertNull(store.findByUsername("marco"));
        assertNotNull(store.findById(marcoId));
    }

    @Test
    void totpIsPerAccount() throws Exception {
        DashboardAuthStore store = freshStoreWithOwner();
        String ownerId = store.ownerAccount().id;
        store.createAccount("marco", AccountRole.ADMIN, ownerId);
        String marcoId = store.findByUsername("marco").id;

        String secret = store.beginTotpSetup(ownerId);
        dev.samstevens.totp.code.DefaultCodeGenerator gen =
                new dev.samstevens.totp.code.DefaultCodeGenerator(dev.samstevens.totp.code.HashingAlgorithm.SHA1);
        store.confirmTotpSetup(ownerId, gen.generate(secret, System.currentTimeMillis() / 1000 / 30));

        assertTrue(store.totpEnabled(ownerId));
        assertFalse(store.totpEnabled(marcoId));
    }

    @Test
    void resetAccountPasswordForcesChangeAndKeepsOtherAccounts() throws Exception {
        DashboardAuthStore store = freshStoreWithOwner();
        String ownerId = store.ownerAccount().id;
        store.createAccount("marco", AccountRole.ADMIN, ownerId);
        String marcoId = store.findByUsername("marco").id;
        store.setPassword(marcoId, "marco-chosen-pw".toCharArray());

        GeneratedCredentials reset = store.resetAccountPassword(marcoId, false);

        assertTrue(store.verifyPassword(marcoId, reset.password().toCharArray()));
        assertFalse(store.verifyPassword(marcoId, "marco-chosen-pw".toCharArray()));
        assertTrue(store.mustChangePassword(marcoId));
        assertTrue(store.verifyPassword(ownerId, "password".toCharArray()));
    }

    private DashboardAuthStore freshStoreWithOwner() throws Exception {
        Path authPath = tempDir.resolve("dashboard-auth.json");
        AuthKeyStore keys = new AuthKeyStore(tempDir.resolve(".auth-key"));
        DashboardAuthStore store = new DashboardAuthStore(authPath, keys);
        store.ensureDefaultAccount();
        return store;
    }
}
