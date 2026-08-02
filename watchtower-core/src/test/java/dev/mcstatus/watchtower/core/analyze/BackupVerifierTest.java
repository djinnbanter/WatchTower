package dev.mcstatus.watchtower.core.analyze;

import com.google.gson.JsonObject;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import static org.junit.jupiter.api.Assertions.*;

class BackupVerifierTest {

    @Test
    void intactZipIsVerified(@TempDir Path dir) throws IOException {
        Path zip = dir.resolve("world-ok.zip");
        writeZip(zip,
                "world/level.dat", "x",
                "world/region/r.0.0.mca", "chunk");
        JsonObject r = BackupVerifier.lightVerify(zip);
        assertEquals(BackupVerifier.STATUS_VERIFIED, r.get("status").getAsString());
        assertEquals("light", r.get("mode").getAsString());
        assertTrue(r.getAsJsonArray("findings").toString().contains("archive_ok"));
        assertTrue(r.has("checked_at"));
    }

    @Test
    void zipMissingRegionIsSuspicious(@TempDir Path dir) throws IOException {
        Path zip = dir.resolve("world-noregion.zip");
        writeZip(zip, "world/level.dat", "x");
        JsonObject r = BackupVerifier.lightVerify(zip);
        assertEquals(BackupVerifier.STATUS_SUSPICIOUS, r.get("status").getAsString());
        assertTrue(r.getAsJsonArray("findings").toString().contains("missing:region_mca"));
    }

    @Test
    void garbageBytesAreBroken(@TempDir Path dir) throws IOException {
        Path zip = dir.resolve("broken.zip");
        Files.writeString(zip, "not-a-zip");
        JsonObject r = BackupVerifier.lightVerify(zip);
        assertEquals(BackupVerifier.STATUS_BROKEN, r.get("status").getAsString());
        assertTrue(r.getAsJsonArray("findings").toString().contains("truncated_or_unreadable")
                || r.getAsJsonArray("findings").toString().contains("unreadable"));
    }

    @Test
    void sevenZipIsNotChecked(@TempDir Path dir) throws IOException {
        Path archive = dir.resolve("world.7z");
        Files.writeString(archive, "fake");
        JsonObject r = BackupVerifier.lightVerify(archive);
        assertEquals(BackupVerifier.STATUS_NOT_CHECKED, r.get("status").getAsString());
        assertTrue(r.getAsJsonArray("findings").toString().contains("unsupported_format"));
    }

    @Test
    void folderBackupIsVerified(@TempDir Path dir) throws IOException {
        Path folder = dir.resolve("backup-folder");
        Files.createDirectories(folder.resolve("world/region"));
        Files.writeString(folder.resolve("world/level.dat"), "x");
        Files.writeString(folder.resolve("world/region/r.0.0.mca"), "c");
        JsonObject r = BackupVerifier.lightVerify(folder);
        assertEquals(BackupVerifier.STATUS_VERIFIED, r.get("status").getAsString());
    }

    @Test
    void levelDatOldCounts(@TempDir Path dir) throws IOException {
        Path zip = dir.resolve("old-level.zip");
        writeZip(zip,
                "world/level.dat_old", "x",
                "DIM-1/region/r.0.0.mca", "n");
        JsonObject r = BackupVerifier.lightVerify(zip);
        assertEquals(BackupVerifier.STATUS_VERIFIED, r.get("status").getAsString());
    }

    private static void writeZip(Path zip, String... pathAndContent) throws IOException {
        try (ZipOutputStream zos = new ZipOutputStream(Files.newOutputStream(zip))) {
            for (int i = 0; i < pathAndContent.length; i += 2) {
                zos.putNextEntry(new ZipEntry(pathAndContent[i]));
                zos.write(pathAndContent[i + 1].getBytes(StandardCharsets.UTF_8));
                zos.closeEntry();
            }
        }
    }
}
