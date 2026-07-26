package dev.mcstatus.watchtower.core.ops;

import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.report.ReportConfig;
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

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ActivityGapBackfillTest {

    private static final DateTimeFormatter LOG_TS = DateTimeFormatter.ofPattern("dMMMyyyy HH:mm:ss", Locale.ENGLISH);

    @TempDir
    Path temp;

    private static String logLine(String message) {
        String ts = LocalDateTime.now(ZoneId.systemDefault()).format(LOG_TS);
        return "[" + ts + "] [Server thread/INFO]: " + message;
    }

    @Test
    void detectGapWhenCursorLagsFile() throws Exception {
        Path serverDir = temp.resolve("server");
        Path logs = serverDir.resolve("logs");
        Files.createDirectories(logs);
        Path log = logs.resolve("latest.log");
        Path statePath = temp.resolve("state.json");

        StringBuilder content = new StringBuilder();
        for (int i = 0; i < 200; i++) {
            content.append(logLine("Player" + i + " joined the game")).append('\n');
        }
        Files.writeString(log, content.toString(), StandardCharsets.UTF_8);

        JsonObject offset = new JsonObject();
        offset.addProperty("file", log.toString());
        offset.addProperty("byte_offset", 0);
        offset.addProperty("size", 100);
        StateManager.updateOpsLogOffset(statePath, offset);

        long threshold = 1024;
        ActivityGapBackfill.GapStatus gap = ActivityGapBackfill.detectGap(log, offset, threshold);
        assertTrue(gap.needsBackfill());
        assertTrue(gap.gapBytes() > threshold);
    }

    @Test
    void backfillChunkAdvancesCursorAndMergesEvents() throws Exception {
        Path serverDir = temp.resolve("server2");
        Path logs = serverDir.resolve("logs");
        Files.createDirectories(logs);
        Path log = logs.resolve("latest.log");
        Path statePath = temp.resolve("state2.json");
        Path opsCache = temp.resolve("ops-cache.json");
        Files.writeString(opsCache, "{}", StandardCharsets.UTF_8);

        String line1 = logLine("Steve joined the game") + "\n";
        String line2 = logLine("Alex joined the game") + "\n";
        Files.writeString(log, line1 + line2, StandardCharsets.UTF_8);

        ReportConfig config = ReportConfig.builder()
                .activityGapBackfillEnabled(true)
                .activityGapThresholdBytes(1)
                .activityGapChunkBytes(4096)
                .build();

        ActivityGapBackfill.WakeResult result = ActivityGapBackfill.runWake(
                serverDir.toString(), statePath, opsCache, config);

        assertTrue(result.chunksRun() >= 1);
        assertTrue(result.eventsMerged() >= 2);
        assertTrue(result.complete());

        JsonObject after = StateManager.getOpsLogOffset(statePath);
        assertEquals(Files.size(log), after.get("byte_offset").getAsLong());
    }

    @Test
    void scanIncrementalDefersLargeGap() throws Exception {
        Path serverDir = temp.resolve("server3");
        Path logs = serverDir.resolve("logs");
        Files.createDirectories(logs);
        Path statePath = temp.resolve("state3.json");
        Path log = logs.resolve("latest.log");

        StringBuilder content = new StringBuilder();
        for (int i = 0; i < 500; i++) {
            content.append(logLine("Player" + i + " joined the game")).append('\n');
        }
        Files.writeString(log, content.toString(), StandardCharsets.UTF_8);

        JsonObject offset = new JsonObject();
        offset.addProperty("file", log.toString());
        offset.addProperty("byte_offset", 0);
        offset.addProperty("size", 0);
        StateManager.updateOpsLogOffset(statePath, offset);

        long defer = 1024;
        OpsLogTailScanner.ScanResult deferred = OpsLogTailScanner.scanIncremental(
                serverDir.toString(), statePath, 100, defer);
        JsonObject afterOffset = StateManager.getOpsLogOffset(statePath);
        assertEquals(0, afterOffset.get("byte_offset").getAsLong());
        assertFalse(deferred.activityEvents().isEmpty() || deferred.newActivityCount() == 0);
    }
}
