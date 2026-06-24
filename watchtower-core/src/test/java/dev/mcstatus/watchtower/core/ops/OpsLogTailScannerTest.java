package dev.mcstatus.watchtower.core.ops;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.report.StateManager;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class OpsLogTailScannerTest {

    private static final DateTimeFormatter LOG_TS = DateTimeFormatter.ofPattern("dMMMyyyy HH:mm:ss", Locale.ENGLISH);

    @TempDir
    Path temp;

    private static String logLine(String message) {
        String ts = LocalDateTime.now(ZoneId.systemDefault()).format(LOG_TS);
        return "[" + ts + "] [Server thread/INFO]: " + message;
    }

    @Test
    void scanIncrementalParsesModJoinAndKubejs() throws Exception {
        Path serverDir = temp.resolve("server");
        Path logs = serverDir.resolve("logs");
        Files.createDirectories(logs);
        Path statePath = temp.resolve("watchtower").resolve(".watchtower-state.json");
        Files.createDirectories(statePath.getParent());
        Path log = logs.resolve("latest.log");

        String line1 = logLine("Steve joined the game") + "\n";
        String line2 = "[12Jun2024 10:00:01] [Render thread/ERROR] [KubeJS Server/]: Error in script startup: missing item\n";
        String line3 = "[12Jun2024 10:00:02] [Render thread/ERROR] [minecraft/]: Parsing error loading recipe create:foo\n";
        Files.writeString(log, line1 + line2 + line3, StandardCharsets.UTF_8);

        OpsLogTailScanner.ScanResult first = OpsLogTailScanner.scanIncremental(serverDir.toString(), statePath, 100);
        assertEquals(1, first.newActivityCount());
        assertFalse(first.kubejsFailures().isEmpty());
        JsonArray mods = first.modLogErrors();
        assertTrue(mods.size() >= 1);

        Files.writeString(log, logLine("Steve joined the game") + "\n"
                + logLine("Alex joined the game") + "\n", StandardCharsets.UTF_8, StandardOpenOption.APPEND);
        OpsLogTailScanner.ScanResult second = OpsLogTailScanner.scanIncremental(serverDir.toString(), statePath, 100);
        assertEquals(1, second.newActivityCount());
        assertEquals("Alex", second.activityEvents().get(0).get("detail").getAsString());
        JsonObject offset = StateManager.getOpsLogOffset(statePath);
        assertTrue(offset.has("byte_offset"));
        assertEquals(Files.size(log), offset.get("byte_offset").getAsLong());
    }

    @Test
    void scanIncrementalDetectsBackupAndRestartJobs() throws Exception {
        Path serverDir = temp.resolve("server2");
        Path logs = serverDir.resolve("logs");
        Files.createDirectories(logs);
        Path statePath = temp.resolve("watchtower2").resolve(".watchtower-state.json");
        Files.createDirectories(statePath.getParent());
        Path log = logs.resolve("latest.log");

        String backupLine = logLine("[Crafty] Starting backup for Example Server") + "\n";
        String restartLine = logLine("Server will restart in 5 minutes") + "\n";
        Files.writeString(log, backupLine + restartLine, StandardCharsets.UTF_8);

        OpsLogTailScanner.ScanResult scan = OpsLogTailScanner.scanIncremental(serverDir.toString(), statePath, 100);
        assertEquals(2, scan.newActivityCount());
        assertEquals(2, scan.backgroundJobs().size());
        assertTrue(scan.backgroundJobs().stream().anyMatch(j -> "backup_job".equals(j.get("type").getAsString())));
        assertTrue(scan.backgroundJobs().stream().anyMatch(j -> "restart_scheduled".equals(j.get("type").getAsString())));
        assertTrue(scan.activityEvents().stream().anyMatch(e -> "backup_job".equals(e.get("type").getAsString())));
        assertTrue(scan.activityEvents().stream().anyMatch(e -> "restart_scheduled".equals(e.get("type").getAsString())));
    }
}
