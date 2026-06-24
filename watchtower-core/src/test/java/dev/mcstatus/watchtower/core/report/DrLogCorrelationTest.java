package dev.mcstatus.watchtower.core.report;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.FileTime;
import java.time.Instant;

import static org.junit.jupiter.api.Assertions.*;

class DrLogCorrelationTest {

    @TempDir
    Path serverDir;

    @Test
    void logsOnlyWhenNoCrashReport() throws Exception {
        long now = Instant.now().getEpochSecond();
        Path logs = serverDir.resolve("logs");
        Files.createDirectories(logs);
        Path latest = logs.resolve("latest.log");
        Files.writeString(latest, "FATAL Mod loading has failed\n", StandardCharsets.UTF_8);
        Files.setLastModifiedTime(latest, FileTime.from(Instant.ofEpochSecond(now)));

        DrLogFileSelector.DrLogSelection sel = DrLogFileSelector.select(serverDir, 30);
        DrLogCorrelation.CorrelationResult result = DrLogCorrelation.correlate(sel);

        assertEquals(1, result.attempts().size());
        assertEquals(DrLogCorrelation.CorrelationStatus.logs_only, result.attempts().get(0).status());
        assertTrue(result.attempts().get(0).userMessage().contains("no crash report"));
    }
}
