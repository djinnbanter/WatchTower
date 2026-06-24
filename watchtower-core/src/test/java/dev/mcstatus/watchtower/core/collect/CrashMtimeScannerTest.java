package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonObject;
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
}
