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

    @Test
    void scanTailDetectsSilentFailsAndDedupes() throws Exception {
        Path serverDir = temp.resolve("server3");
        Path logs = serverDir.resolve("logs");
        Files.createDirectories(logs);
        Path log = logs.resolve("latest.log");

        String kube = "[12Jun2024 10:00:01] [Server thread/ERROR] [KubeJS Server/]: Error running event handler "
                + "(kubejs/server_scripts/machines.js:42): thermal:machine_furnace is not a valid recipe\n";
        String datapack = "[12Jun2024 10:00:02] [Server thread/ERROR] [minecraft/SimpleJsonResourceReloadListener]: "
                + "Couldn't parse data file 'create:machine_furnace' from data pack 'file/create'\n";
        Files.writeString(log, kube + datapack + kube, StandardCharsets.UTF_8);

        OpsLogTailScanner.ScanResult scan = OpsLogTailScanner.scanTail(serverDir.toString(), 200, 100);
        assertEquals(2, scan.silentFails().size());
        assertTrue(scan.silentFails().stream().anyMatch(r ->
                "kubejs".equals(r.get("kind").getAsString())
                        && "kubejs/server_scripts/machines.js".equals(r.get("path").getAsString())
                        && r.get("line").getAsInt() == 42));
        assertTrue(scan.silentFails().stream().anyMatch(r ->
                "datapack_json".equals(r.get("kind").getAsString())
                        && "create:machine_furnace".equals(r.get("path").getAsString())));
        assertTrue(scan.hadNewData());
    }

    @Test
    void scanTailCapturesJoinRejection() throws Exception {
        Path server = temp.resolve("server-join");
        Files.createDirectories(server.resolve("logs"));
        Files.writeString(server.resolve("logs/latest.log"),
                "[29Jul2026 20:15:01] [Server thread/INFO]: FriendName lost connection: "
                        + "Failed to connect to server: Incompatible mod set: mismatched channels: [create:main]\n",
                StandardCharsets.UTF_8);
        OpsLogTailScanner.ScanResult r = OpsLogTailScanner.scanTail(server.toString(), 50, 0);
        assertEquals(1, r.joinRejections().size());
        assertEquals("mismatched_channel", r.joinRejections().get(0).get("kind").getAsString());
    }

    @Test
    void scanTailIgnoresOrdinaryTimeout() throws Exception {
        Path server = temp.resolve("server-timeout");
        Files.createDirectories(server.resolve("logs"));
        Files.writeString(server.resolve("logs/latest.log"),
                "[29Jul2026 20:18:04] [Server thread/INFO]: IdlePlayer lost connection: Timed out\n",
                StandardCharsets.UTF_8);
        OpsLogTailScanner.ScanResult r = OpsLogTailScanner.scanTail(server.toString(), 50, 0);
        assertTrue(r.joinRejections().isEmpty());
    }
}
