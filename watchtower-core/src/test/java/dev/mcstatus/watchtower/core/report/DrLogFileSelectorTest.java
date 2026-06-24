package dev.mcstatus.watchtower.core.report;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.FileTime;
import java.time.Instant;

import static org.junit.jupiter.api.Assertions.*;

class DrLogFileSelectorTest {

    @TempDir
    Path serverDir;

    @Test
    void selectsAllLogsInLookbackWindow() throws Exception {
        long now = Instant.now().getEpochSecond();
        Path logs = serverDir.resolve("logs");
        Path crashes = serverDir.resolve("crash-reports");
        Files.createDirectories(logs);
        Files.createDirectories(crashes);

        Path latest = logs.resolve("latest.log");
        Files.writeString(latest, "ERROR fail\n", StandardCharsets.UTF_8);
        setMtime(latest, now - 60);

        Path gz1 = logs.resolve("2026-06-18-1.log.gz");
        Files.write(gz1, new byte[]{1, 2, 3});
        setMtime(gz1, now - 120);

        Path gzOld = logs.resolve("2026-06-17-1.log.gz");
        Files.write(gzOld, new byte[]{1});
        setMtime(gzOld, now - 7200);

        Path debug = logs.resolve("debug.log");
        Files.writeString(debug, "DEBUG\n", StandardCharsets.UTF_8);
        setMtime(debug, now - 30);

        Path crash = crashes.resolve("crash-test.txt");
        Files.writeString(crash, "Time: 2026-06-18 12:00:00\n", StandardCharsets.UTF_8);
        setMtime(crash, now - 90);

        DrLogFileSelector.DrLogSelection sel = DrLogFileSelector.select(serverDir, 30);

        assertEquals(2, sel.regular().size());
        assertEquals(1, sel.debug().size());
        assertEquals(1, sel.crash().size());
        assertTrue(sel.regular().stream().anyMatch(f -> f.zipEntryPath().endsWith("latest.log")));
        assertFalse(sel.regular().stream().anyMatch(f -> f.sourcePath().equals(gzOld)));
    }

    private static void setMtime(Path path, long epochSec) throws Exception {
        Files.setLastModifiedTime(path, FileTime.from(Instant.ofEpochSecond(epochSec)));
    }
}
