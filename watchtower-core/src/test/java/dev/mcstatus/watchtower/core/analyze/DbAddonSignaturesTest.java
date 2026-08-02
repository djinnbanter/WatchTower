package dev.mcstatus.watchtower.core.analyze;

import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;

class DbAddonSignaturesTest {

    @Test
    void acl1130AttributesGriefLoggerCore() {
        DbAddonSignatures.Hit h = DbAddonSignatures.match(
                "[29Jul2026 15:01:12.171] [modloading-worker-0/ERROR] [com.daqem.grieflogger.GriefLogger/]: "
                        + "Failed to connect to database, disabling GriefLogger... "
                        + "Host '172.19.0.1' is not allowed to connect — Error: 1130-HY000");
        assertNotNull(h);
        assertEquals("grieflogger", h.modId());
        assertEquals("db_addon_acl", h.kind());
    }

    @Test
    void glraConnectionFailAttributesRollbackAddon() {
        DbAddonSignatures.Hit h = DbAddonSignatures.match(
                "[29Jul2026 15:01:13.793] [modloading-worker-0/ERROR] "
                        + "[eu.pankraz01.glra.GriefloggerRollbackAddon/]: "
                        + "[griefloggerrollbackaddon] Database connection failed for type MARIADB");
        assertNotNull(h);
        assertEquals("griefloggerrollbackaddon", h.modId());
        assertEquals("db_addon_connection", h.kind());
    }

    @Test
    void prefersGlraIdWhenBothNamesPresent() {
        DbAddonSignatures.Hit h = DbAddonSignatures.match(
                "[ERROR] grieflogger and griefloggerrollbackaddon Database connection failed for type MARIADB");
        assertNotNull(h);
        assertEquals("griefloggerrollbackaddon", h.modId());
        assertEquals("db_addon_connection", h.kind());
    }

    @Test
    void luckPermsAclAloneDoesNotMatch() {
        assertNull(DbAddonSignatures.match(
                "[luckperms-hikari connection adder/WARN] Error: 1130-HY000: "
                        + "Host '172.19.0.1' is not allowed to connect to this MariaDB server"));
    }

    @Test
    void fixtureContainsMatchableAclAndGlraLines() throws Exception {
        String text = Files.readString(resolveFixture(
                "samples/fixtures/log-intelligence/grieflogger-db-addon/excerpt.log"));
        DbAddonSignatures.Hit acl = null;
        DbAddonSignatures.Hit glra = null;
        for (String line : text.split("\\R")) {
            DbAddonSignatures.Hit h = DbAddonSignatures.match(line);
            if (h == null) {
                continue;
            }
            if ("db_addon_acl".equals(h.kind())) {
                acl = h;
            }
            if ("db_addon_connection".equals(h.kind())) {
                glra = h;
            }
        }
        assertNotNull(acl, "fixture must include a MariaDB ACL line attributable to grieflogger");
        assertEquals("grieflogger", acl.modId());
        assertNotNull(glra, "fixture must include a GLRA Database connection failed line");
        assertEquals("griefloggerrollbackaddon", glra.modId());
    }

    private static Path resolveFixture(String relative) {
        Path path = Path.of(relative);
        if (Files.isRegularFile(path)) {
            return path;
        }
        path = Path.of("..").resolve(relative);
        if (Files.isRegularFile(path)) {
            return path;
        }
        path = Path.of("../..").resolve(relative);
        if (Files.isRegularFile(path)) {
            return path;
        }
        throw new IllegalStateException("fixture not found: " + relative);
    }
}
