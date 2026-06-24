package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.report.ReportConfig;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ExternalBackupDetectorTest {

    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_OFFSET_DATE_TIME;

    @Test
    void freshHeartbeatIsSuccess(@TempDir Path tmp) throws Exception {
        String lastAt = ZonedDateTime.now(ZoneId.systemDefault()).minusHours(2).format(ISO);
        Path marker = tmp.resolve("heartbeat.json");
        Files.writeString(marker, """
                {"last_at":"%s","source":"bloom.panel","status":"success","detail":"ok"}
                """.formatted(lastAt), StandardCharsets.UTF_8);

        JsonObject block = ExternalBackupDetector.readMarker(marker, 7, "file");
        assertTrue(block.get("configured").getAsBoolean());
        assertEquals("success", block.get("status").getAsString());
        assertFalse(block.get("stale").getAsBoolean());
        assertEquals("bloom.panel", block.get("source").getAsString());
    }

    @Test
    void staleHeartbeat(@TempDir Path tmp) throws Exception {
        String lastAt = ZonedDateTime.now(ZoneId.systemDefault()).minusDays(10).format(ISO);
        Path marker = tmp.resolve("heartbeat.json");
        Files.writeString(marker, "{\"last_at\":\"" + lastAt + "\",\"status\":\"success\"}", StandardCharsets.UTF_8);

        JsonObject block = ExternalBackupDetector.readMarker(marker, 7, "file");
        assertEquals("stale", block.get("status").getAsString());
        assertTrue(block.get("stale").getAsBoolean());
    }

    @Test
    void missingFile(@TempDir Path tmp) {
        Path marker = tmp.resolve("missing.json");
        JsonObject block = ExternalBackupDetector.readMarker(marker, 7, "file");
        assertEquals("missing", block.get("status").getAsString());
        assertTrue(block.get("stale").getAsBoolean());
    }

    @Test
    void runningStatus(@TempDir Path tmp) throws Exception {
        Path marker = tmp.resolve("heartbeat.json");
        Files.writeString(marker, "{\"status\":\"running\",\"detail\":\"backup job\"}", StandardCharsets.UTF_8);
        JsonObject block = ExternalBackupDetector.readMarker(marker, 7, "webhook");
        assertEquals("running", block.get("status").getAsString());
        assertFalse(block.get("stale").getAsBoolean());
    }

    @Test
    void writeMarkerRoundTrip(@TempDir Path tmp) throws Exception {
        Path marker = tmp.resolve("watchtower/backup-heartbeat.json");
        JsonObject payload = new JsonObject();
        payload.addProperty("last_at", ZonedDateTime.now(ZoneId.systemDefault()).format(ISO));
        payload.addProperty("source", "restic");
        ExternalBackupDetector.writeMarker(marker, payload);
        assertTrue(Files.isRegularFile(marker));
        JsonObject read = ExternalBackupDetector.readMarker(marker, 7, "file");
        assertEquals("success", read.get("status").getAsString());
        assertEquals("restic", read.get("source").getAsString());
    }

    @Test
    void isConfiguredWithWebhookToken() {
        ReportConfig config = ReportConfig.builder()
                .backupExternalMarker("")
                .backupWebhookToken("secret")
                .build();
        assertTrue(ExternalBackupDetector.isConfigured(config));
    }
}
