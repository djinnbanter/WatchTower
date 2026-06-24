package dev.mcstatus.watchtower.core.ops;

import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.report.StateManager;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Locale;

import static org.junit.jupiter.api.Assertions.*;

class ActivityLedgerScannerTest {

    private static final DateTimeFormatter LOG_TS = DateTimeFormatter.ofPattern("dMMMyyyy HH:mm:ss", Locale.ENGLISH);

    @TempDir
    Path temp;

    private static String logLine(String message) {
        String ts = LocalDateTime.now(ZoneId.systemDefault()).format(LOG_TS);
        return "[" + ts + "] [Server thread/INFO]: " + message;
    }

    @Test
    void scanTail_detectsJoinLeaveCommandAndTickLag() throws Exception {
        Path server = temp.resolve("server");
        Path logs = server.resolve("logs");
        Files.createDirectories(logs);
        Path log = logs.resolve("latest.log");
        Files.writeString(log, String.join("\n",
                logLine("Steve joined the game"),
                logLine("Admin issued server command: /chunky continue"),
                logLine("Can't keep up! Is the server overloaded? Running 5000ms or 100 ticks behind"),
                logLine("Alex left the game"),
                logLine("[+] BracketJoin"),
                logLine("[-] BracketLeave")
        ) + "\n", StandardCharsets.UTF_8);

        ActivityLedgerScanner.ScanResult result = ActivityLedgerScanner.scanTail(server.toString(), 200, 50);
        assertTrue(result.newCount() >= 4, "expected join, command, tick_lag, leave events");
        assertTrue(result.events().stream().anyMatch(e -> "player_join".equals(str(e, "type"))));
        assertTrue(result.events().stream().anyMatch(e -> "command".equals(str(e, "type"))));
        assertTrue(result.events().stream().anyMatch(e -> "tick_lag".equals(str(e, "type"))));
        assertTrue(result.events().stream().anyMatch(e -> "player_leave".equals(str(e, "type"))));
        assertNotNull(result.context());
        assertTrue(result.context().has("recent_commands"));
    }

    @Test
    void scanIncremental_updatesOffsetAndDedupes() throws Exception {
        Path server = temp.resolve("server");
        Path logs = server.resolve("logs");
        Files.createDirectories(logs);
        Path log = logs.resolve("latest.log");
        Path statePath = temp.resolve("state.json");

        Files.writeString(log, logLine("Steve joined the game") + "\n", StandardCharsets.UTF_8);
        ActivityLedgerScanner.ScanResult first = ActivityLedgerScanner.scanIncremental(
                server.toString(), statePath, 50);
        assertEquals(1, first.newCount());

        ActivityLedgerScanner.ScanResult second = ActivityLedgerScanner.scanIncremental(
                server.toString(), statePath, 50);
        assertEquals(0, second.newCount());

        Files.writeString(log, logLine("Steve joined the game") + "\n"
                + logLine("Alex joined the game") + "\n", StandardCharsets.UTF_8, java.nio.file.StandardOpenOption.APPEND);
        ActivityLedgerScanner.ScanResult third = ActivityLedgerScanner.scanIncremental(
                server.toString(), statePath, 50);
        assertEquals(1, third.newCount());
        assertEquals("Alex", str(third.events().get(0), "detail"));

        JsonObject offset = StateManager.getActivityLogOffset(statePath);
        assertTrue(offset.has("byte_offset"));
    }

    private static String str(JsonObject o, String key) {
        return o.has(key) ? o.get(key).getAsString() : null;
    }
}
