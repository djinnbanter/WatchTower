package dev.mcstatus.watchtower.core.auth;

import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Release-gate tests against committed schema 1 install fixtures.
 * Gradle runs watchtower-core tests with cwd = watchtower-core, so fixtures live at
 * {@code ../samples/fixtures/dashboard-auth}.
 */
class DashboardAuthUpgradeFixtureTest {
    @TempDir
    Path tempDir;

    private static final Path FIXTURES = Path.of("..", "samples", "fixtures", "dashboard-auth");

    @Test
    void plainSchema1InstallUpgradesToOwner() throws Exception {
        DashboardAuthStore store = openFixture("schema1-plain.json", null);
        DashboardAuthRecord owner = store.ownerAccount();

        assertNotNull(owner);
        assertEquals(AccountRole.OWNER, AccountRole.fromWire(owner.role));
        assertEquals("ella", owner.username);
        assertEquals(1, store.accounts().size());
        assertFalse(store.mustChangePassword(owner.id));
    }

    @Test
    void defaultPasswordInstallStillForcesFirstLoginChange() throws Exception {
        DashboardAuthStore store = openFixture("schema1-default-password.json", null);
        DashboardAuthRecord owner = store.ownerAccount();

        assertEquals(DashboardAuthRecord.DEFAULT_USERNAME, owner.username);
        assertTrue(store.verifyPassword(owner.id, "password".toCharArray()));
        assertTrue(store.mustChangePassword(owner.id));
    }

    @Test
    void twoFactorInstallKeepsItsAuthenticator() throws Exception {
        Path keyFixture = FIXTURES.resolve("schema1-with-2fa.auth-key");
        Assumptions.assumeTrue(Files.isRegularFile(keyFixture),
                "schema1-with-2fa.auth-key missing — skip 2FA upgrade fixture");

        DashboardAuthStore store = openFixture("schema1-with-2fa.json", "schema1-with-2fa.auth-key");
        DashboardAuthRecord owner = store.ownerAccount();

        assertTrue(store.totpEnabled(owner.id));
        assertFalse(owner.recovery_code_hashes.isEmpty());
        // Secret decrypts with the same key file, which is the part a broken migration would lose.
        assertNotNull(store.buildOtpAuthUri("Watchtower", owner.id));
    }

    @Test
    void migratedFileStaysReadableByOlderBuilds() throws Exception {
        DashboardAuthStore store = openFixture("schema1-plain.json", null);
        Path authPath = tempDir.resolve("dashboard-auth.json");

        DashboardAuthRecord flat = new com.google.gson.Gson()
                .fromJson(Files.readString(authPath), DashboardAuthRecord.class);

        assertNotNull(flat.password);
        assertEquals(store.ownerAccount().username, flat.username);
    }

    private DashboardAuthStore openFixture(String fixtureName, String keyFixtureName) throws Exception {
        Path fixture = FIXTURES.resolve(fixtureName);
        Assumptions.assumeTrue(Files.isRegularFile(fixture), "missing fixture: " + fixture.toAbsolutePath());

        Path authPath = tempDir.resolve("dashboard-auth.json");
        Files.copy(fixture, authPath);
        Path keyPath = tempDir.resolve(".auth-key");
        if (keyFixtureName != null) {
            Files.copy(FIXTURES.resolve(keyFixtureName), keyPath);
        }
        return new DashboardAuthStore(authPath, new AuthKeyStore(keyPath));
    }
}
