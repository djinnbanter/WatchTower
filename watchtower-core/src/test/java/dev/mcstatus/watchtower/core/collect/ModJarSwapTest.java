package dev.mcstatus.watchtower.core.collect;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ModJarSwapTest {

    @TempDir
    Path temp;

    @Test
    void applySwapReplacesLiveKeepingBasename() throws Exception {
        Path mods = temp.resolve("mods");
        Path backups = temp.resolve("mod-backups");
        Path staging = temp.resolve("staging");
        Files.createDirectories(mods);
        Files.createDirectories(staging);
        Files.writeString(mods.resolve("foo-1.0.jar"), "old-bytes");
        Files.writeString(staging.resolve("new.jar"), "new-bytes");

        var r = ModJarSwap.applySwap(
                mods, backups, staging.resolve("new.jar"),
                "foo", "foo-1.0.jar",
                new ModJarSwap.SwapMeta("1.0", "2.0", "mut_1", "acc", "owner", "new.jar"));
        assertTrue(r.ok(), r.message());
        assertEquals("new-bytes", Files.readString(mods.resolve("foo-1.0.jar")));
        assertTrue(Files.exists(backups.resolve("index.json")));
        assertTrue(r.backupId() != null && !r.backupId().isBlank());
    }

    @Test
    void undoRoundTrip() throws Exception {
        Path mods = temp.resolve("mods");
        Path backups = temp.resolve("mod-backups");
        Path staging = temp.resolve("staging");
        Files.createDirectories(mods);
        Files.createDirectories(staging);
        Files.writeString(mods.resolve("foo-1.0.jar"), "old-bytes");
        Files.writeString(staging.resolve("new.jar"), "new-bytes");

        var swap = ModJarSwap.applySwap(
                mods, backups, staging.resolve("new.jar"),
                "foo", "foo-1.0.jar",
                new ModJarSwap.SwapMeta("1.0", "2.0", "mut_1", "acc", "owner", null));
        assertTrue(swap.ok(), swap.message());

        var undo = ModJarSwap.undo(mods, backups, swap.backupId());
        assertTrue(undo.ok(), undo.message());
        assertEquals("old-bytes", Files.readString(mods.resolve("foo-1.0.jar")));
    }

    @Test
    void quarantineMovesJarOutOfMods() throws Exception {
        Path mods = temp.resolve("mods");
        Path backups = temp.resolve("mod-backups");
        Files.createDirectories(mods);
        Files.writeString(mods.resolve("foo-1.0.jar"), "live");

        var r = ModJarSwap.quarantine(
                mods, backups, "foo", "foo-1.0.jar",
                new ModJarSwap.SwapMeta("1.0", null, "mut_q", "acc", "owner", null));
        assertTrue(r.ok(), r.message());
        assertFalse(Files.exists(mods.resolve("foo-1.0.jar")));
        assertTrue(Files.exists(backups.resolve("index.json")));

        var undo = ModJarSwap.undo(mods, backups, r.backupId());
        assertTrue(undo.ok(), undo.message());
        assertEquals("live", Files.readString(mods.resolve("foo-1.0.jar")));
    }

    @Test
    void pathEscapeRejected() throws Exception {
        Path mods = temp.resolve("mods");
        Path backups = temp.resolve("mod-backups");
        Path staging = temp.resolve("staging");
        Files.createDirectories(mods);
        Files.createDirectories(staging);
        Files.writeString(staging.resolve("new.jar"), "x");
        var r = ModJarSwap.applySwap(
                mods, backups, staging.resolve("new.jar"),
                "foo", "../evil.jar", null);
        assertFalse(r.ok());
        assertEquals("invalid_jar", r.errorCode());
    }
}
