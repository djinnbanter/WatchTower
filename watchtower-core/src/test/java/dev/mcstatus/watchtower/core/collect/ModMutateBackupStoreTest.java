package dev.mcstatus.watchtower.core.collect;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ModMutateBackupStoreTest {

    @TempDir
    Path temp;

    @Test
    void createAndRestoreRoundTrip() throws Exception {
        Path mods = temp.resolve("mods");
        Path backups = temp.resolve("mod-backups");
        Files.createDirectories(mods);
        Files.writeString(mods.resolve("foo-1.0.jar"), "original-bytes");

        ModMutateBackupStore store = new ModMutateBackupStore(backups);
        var created = store.createBackup(mods, "foo", "foo-1.0.jar",
                "1.0", "1.1", "mut_1", "acc_1", "owner", "swap");
        assertTrue(created.ok(), created.message());
        assertTrue(Files.exists(backups.resolve("index.json")));

        Files.writeString(mods.resolve("foo-1.0.jar"), "replaced");
        var restored = store.restore(mods, created.record().backup_id);
        assertTrue(restored.ok(), restored.message());
        assertEquals("original-bytes", Files.readString(mods.resolve("foo-1.0.jar")));
    }

    @Test
    void pruneKeepsLastFivePerMod() throws Exception {
        Path mods = temp.resolve("mods");
        Path backups = temp.resolve("mod-backups");
        Files.createDirectories(mods);
        Files.writeString(mods.resolve("foo-1.0.jar"), "v0");

        ModMutateBackupStore store = new ModMutateBackupStore(backups);
        for (int i = 0; i < 7; i++) {
            Files.writeString(mods.resolve("foo-1.0.jar"), "v" + i);
            // distinct created_at via sleep-free: mutate file content; createBackup uses Instant.now
            // Ensure ordering by sleeping briefly when Instant resolution is coarse on Windows
            Thread.sleep(5);
            var r = store.createBackup(mods, "foo", "foo-1.0.jar",
                    "v" + i, "v" + (i + 1), "mut_" + i, "acc", "a", "swap");
            assertTrue(r.ok(), r.message());
        }
        assertEquals(5, store.listBackups("foo").size());
    }

    @Test
    void pruneNeverRemovesProtectedBackup() throws Exception {
        Path mods = temp.resolve("mods");
        Path backups = temp.resolve("mod-backups");
        Files.createDirectories(mods);
        Files.writeString(mods.resolve("foo-1.0.jar"), "x");

        ModMutateBackupStore store = new ModMutateBackupStore(backups);
        String firstId = null;
        for (int i = 0; i < 6; i++) {
            Thread.sleep(5);
            Set<String> protect = firstId != null ? Set.of(firstId) : Set.of();
            var r = store.createBackup(mods, "foo", "foo-1.0.jar",
                    "a", "b", "mut_" + i, "acc", "a", "swap", protect);
            assertTrue(r.ok(), r.message());
            if (i == 0) {
                firstId = r.record().backup_id;
            }
        }
        final String protectId = firstId;
        // Newest 5 + protected oldest that fell outside the window
        assertTrue(store.listBackups("foo").size() >= 5);
        assertTrue(store.listBackups("foo").stream().anyMatch(b -> protectId.equals(b.backup_id)));
    }

    @Test
    void pathEscapeFails() {
        Path mods = temp.resolve("mods");
        Path backups = temp.resolve("mod-backups");
        ModMutateBackupStore store = new ModMutateBackupStore(backups);
        var r = store.createBackup(mods, "foo", "../secrets.jar",
                "a", "b", "mut", "acc", "a", "swap");
        assertFalse(r.ok());
        assertEquals("invalid_jar", r.errorCode());

        var badMod = store.createBackup(mods, "../evil", "foo.jar",
                "a", "b", "mut", "acc", "a", "swap");
        assertFalse(badMod.ok());
        assertEquals("invalid_mod_id", badMod.errorCode());
    }
}
