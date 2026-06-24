package dev.mcstatus.watchtower.core.report;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.FileTime;
import java.time.Instant;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;

import static org.junit.jupiter.api.Assertions.*;

class DrLogAnchorFinderTest {

    private static final DateTimeFormatter LOG_TS =
            DateTimeFormatter.ofPattern("ddMMMyyyy HH:mm:ss.SSS");

    @TempDir
    Path serverDir;

    @Test
    void findsLastSuccessfulStartInLatestLog() throws Exception {
        Path logs = serverDir.resolve("logs");
        Files.createDirectories(logs);
        String ts = ZonedDateTime.now().minusMinutes(10).format(LOG_TS);
        String log = """
                [%s] [Server thread/INFO] [minecraft/DedicatedServer]: Done (3.456s)! For help, type "help"
                [%s] [main/ERROR] Mod loading has failed
                """.formatted(ts, ZonedDateTime.now().format(LOG_TS));
        Files.writeString(logs.resolve("latest.log"), log, StandardCharsets.UTF_8);

        DrLogAnchorFinder.LogAnchor anchor = DrLogAnchorFinder.findLastSuccessfulStart(serverDir);
        assertTrue(anchor.found());
        assertEquals("logs/regular/latest.log", anchor.zipEntryPath());
        assertTrue(anchor.line() >= 1);
    }

    @Test
    void notFoundUsesFallbackWindow() throws Exception {
        Path logs = serverDir.resolve("logs");
        Files.createDirectories(logs);
        Files.writeString(logs.resolve("latest.log"), "no start here\n", StandardCharsets.UTF_8);

        DrLogAnchorFinder.AnchorSelection sel = DrLogAnchorFinder.resolve(serverDir, 1440);
        assertFalse(sel.anchor().found());
        assertEquals(DrLogAnchorFinder.AnchorStatus.not_found, sel.anchor().status());
    }

    @Test
    void selectsLogsAfterAnchor() throws Exception {
        Path logs = serverDir.resolve("logs");
        Files.createDirectories(logs);
        long now = Instant.now().getEpochSecond();
        String ts = ZonedDateTime.now().minusMinutes(5).format(LOG_TS);
        Files.writeString(logs.resolve("latest.log"),
                "[%s] [Server thread/INFO] [minecraft/DedicatedServer]: Done (1.0s)! For help, type \"help\"\n"
                        + "[%s] [main/ERROR] Mod loading has failed\n".formatted(ts, ZonedDateTime.now().format(LOG_TS)),
                StandardCharsets.UTF_8);
        Files.setLastModifiedTime(logs.resolve("latest.log"), FileTime.from(Instant.ofEpochSecond(now)));

        DrLogFileSelector.DrLogSelection selection = DrLogFileSelector.select(serverDir, 1440);
        assertEquals(DrLogAnchorFinder.POLICY_SINCE_LAST_START, selection.selectionPolicy());
        assertTrue(selection.anchor().found());
        assertFalse(selection.regular().isEmpty());
    }
}
