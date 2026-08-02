package dev.mcstatus.watchtower.core.analyze;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import static org.junit.jupiter.api.Assertions.*;

class BackupTestRestoreTest {

    @Test
    void refuseZipSlip(@TempDir Path server) throws Exception {
        Path dest = BackupTestRestore.sandboxForId(server, "t1");
        Files.createDirectories(dest);
        assertThrows(Exception.class, () -> BackupTestRestore.resolveZipSlip(dest, "../escape.txt"));
        assertThrows(Exception.class, () -> BackupTestRestore.resolveZipSlip(dest, "/etc/passwd"));
    }

    @Test
    void extractZipAndVerify(@TempDir Path server) throws Exception {
        Path backups = server.resolve("backups");
        Files.createDirectories(backups);
        Path zip = backups.resolve("ok.zip");
        try (ZipOutputStream zos = new ZipOutputStream(Files.newOutputStream(zip))) {
            zos.putNextEntry(new ZipEntry("world/level.dat"));
            zos.write("x".getBytes(StandardCharsets.UTF_8));
            zos.closeEntry();
            zos.putNextEntry(new ZipEntry("world/region/r.0.0.mca"));
            zos.write("c".getBytes(StandardCharsets.UTF_8));
            zos.closeEntry();
        }
        Path dest = BackupTestRestore.sandboxForId(server, "job1");
        var result = BackupTestRestore.extract(zip, dest, null);
        assertEquals(BackupVerifier.STATUS_VERIFIED, result.get("status").getAsString());
        assertTrue(Files.isRegularFile(dest.resolve("world/level.dat")));
        assertTrue(BackupTestRestore.isInsideRestoreRoot(server, dest));
        BackupTestRestore.deleteSandbox(server, "job1");
        assertFalse(Files.exists(dest));
    }

    @Test
    void sandboxMustStayUnderRestoreRoot(@TempDir Path server) {
        Path outside = server.resolve("world");
        assertFalse(BackupTestRestore.isInsideRestoreRoot(server, outside));
    }
}
