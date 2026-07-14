package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.analyze.CrashClassifier;
import dev.mcstatus.watchtower.core.report.StateManager;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class CrashMtimeScannerTest {

    @TempDir
    Path temp;

    @Test
    void scan_detectsNewCrashAndUpdatesIndex() throws IOException {
        Path server = temp.resolve("server");
        Path crashDir = server.resolve("crash-reports");
        Files.createDirectories(crashDir);
        Path statePath = temp.resolve("state.json");

        Path crash = crashDir.resolve("crash-test.txt");
        Files.writeString(crash, """
                ---- Minecraft Crash Report ----
                Description: Watchdog timeout
                """, StandardCharsets.UTF_8);

        CrashMtimeScanner.ScanResult first = CrashMtimeScanner.scan(server.toString(), statePath);
        assertEquals(1, first.newCount());
        assertEquals(1, first.unreviewed());
        assertEquals(1, first.entries().size());
        assertFalse(first.entries().get(0).displayLabel().isBlank());

        StateManager.updateCrashMtimeIndex(statePath, first.updatedIndex());

        CrashMtimeScanner.ScanResult second = CrashMtimeScanner.scan(server.toString(), statePath);
        assertEquals(0, second.newCount());
        assertEquals(1, second.unreviewed());

        Map<String, Long> index = StateManager.getCrashMtimeIndex(statePath);
        assertTrue(index.containsKey("crash-test.txt"));
    }

    @Test
    void scan_classifiesWatchdogAndModLoadHead() throws IOException {
        Path server = temp.resolve("server");
        Path crashDir = server.resolve("crash-reports");
        Files.createDirectories(crashDir);
        Path statePath = temp.resolve("state.json");

        Files.writeString(crashDir.resolve("watchdog.txt"), """
                ---- Minecraft Crash Report ----
                Description: Watching Server
                java.lang.Error: ServerHangWatchdog detected that a single server tick took 60.00 seconds
                at TRANSFORMER/squaremap@1.3.2/xyz.jpenilla.squaremap.common.util.chunksnapshot.VanillaChunkSnapshotProvider.chunkIfGenerated(VanillaChunkSnapshotProvider.java:97)
                """, StandardCharsets.UTF_8);

        Files.writeString(crashDir.resolve("fml-load.txt"), """
                ---- Minecraft Crash Report ----
                Description: Mod loading failures have occurred; consult the issue messages for more details
                net.neoforged.neoforge.logging.CrashReportExtender$ModLoadingCrashException: Mod loading has failed
                -- Mod loading issue for: alloyed --
                """, StandardCharsets.UTF_8);

        CrashMtimeScanner.ScanResult scan = CrashMtimeScanner.scan(server.toString(), statePath);
        assertEquals(2, scan.entries().size());

        CrashMtimeScanner.CrashEntry watchdog = scan.entries().stream()
                .filter(e -> "watchdog.txt".equals(e.file()))
                .findFirst()
                .orElseThrow();
        assertEquals(CrashClassifier.FK_WATCHDOG_PREGEN, watchdog.failureKind());
        assertEquals("squaremap", watchdog.stallModId());

        CrashMtimeScanner.CrashEntry fml = scan.entries().stream()
                .filter(e -> "fml-load.txt".equals(e.file()))
                .findFirst()
                .orElseThrow();
        assertEquals(CrashClassifier.FK_MOD_LOAD_DEPENDENCY, fml.failureKind());
        assertEquals("alloyed", fml.primaryModId());
    }
}
