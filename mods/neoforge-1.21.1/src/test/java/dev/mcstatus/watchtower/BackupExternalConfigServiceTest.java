package dev.mcstatus.watchtower;

import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.WatchtowerFiles;
import dev.mcstatus.watchtower.core.collect.ExternalBackupDetector;
import dev.mcstatus.watchtower.core.report.ReportConfig;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class BackupExternalConfigServiceTest {

    @TempDir
    Path temp;

    @Test
    void trackingModeOffClearsExternalKeys() throws Exception {
        Path conf = temp.resolve(WatchtowerFiles.CONF_FILENAME);
        Files.writeString(conf, """
                BACKUP_WEBHOOK_TOKEN=old-token
                BACKUP_EXTERNAL_MARKER=watchtower/backup-heartbeat.json
                """);

        JsonObject req = new JsonObject();
        req.addProperty("trackingMode", "off");
        BackupExternalConfigService.apply(conf, req);

        Map<String, String> map = WatchtowerConfWriter.readMap(conf);
        assertEquals("", map.get(BackupExternalConfigService.KEY_MARKER));
        assertEquals("", map.get(BackupExternalConfigService.KEY_WEBHOOK_TOKEN));
        ReportConfig config = ReportConfig.fromMap(map);
        assertFalse(config.isExternalBackupConfigured());
        assertEquals(BackupExternalConfigService.MODE_OFF, BackupExternalConfigService.deriveTrackingMode(config));
    }

    @Test
    void generateWebhookTokenReturnedOnce() throws Exception {
        Path conf = temp.resolve(WatchtowerFiles.CONF_FILENAME);
        Files.writeString(conf, "LOOKBACK_HOURS=24\n");

        JsonObject req = new JsonObject();
        req.addProperty("trackingMode", "webhook");
        req.addProperty("generateWebhookToken", true);
        BackupExternalConfigService.ApplyResult result = BackupExternalConfigService.apply(conf, req);

        assertTrue(result.hasGeneratedToken());
        assertNotNull(result.generatedToken());
        Map<String, String> map = WatchtowerConfWriter.readMap(conf);
        assertEquals(result.generatedToken(), map.get(BackupExternalConfigService.KEY_WEBHOOK_TOKEN));
        assertEquals("", map.get(BackupExternalConfigService.KEY_MARKER));
    }

    @Test
    void markerModeSetsDefaultPath() throws Exception {
        Path conf = temp.resolve(WatchtowerFiles.CONF_FILENAME);
        Files.writeString(conf, "BACKUP_WEBHOOK_TOKEN=tok\n");

        JsonObject req = new JsonObject();
        req.addProperty("trackingMode", "marker");
        BackupExternalConfigService.apply(conf, req);

        Map<String, String> map = WatchtowerConfWriter.readMap(conf);
        assertEquals(ExternalBackupDetector.DEFAULT_MARKER_REL, map.get(BackupExternalConfigService.KEY_MARKER));
        assertEquals("", map.get(BackupExternalConfigService.KEY_WEBHOOK_TOKEN));
        ReportConfig config = ReportConfig.fromMap(map);
        assertEquals(BackupExternalConfigService.MODE_MARKER, BackupExternalConfigService.deriveTrackingMode(config));
    }

    @Test
    void bothModeSetsMarkerAndGeneratesToken() throws Exception {
        Path conf = temp.resolve(WatchtowerFiles.CONF_FILENAME);

        JsonObject req = new JsonObject();
        req.addProperty("trackingMode", "both");
        req.addProperty("generateWebhookToken", true);
        req.addProperty("backupExternalMarker", "watchtower/custom-heartbeat.json");
        BackupExternalConfigService.ApplyResult result = BackupExternalConfigService.apply(conf, req);

        assertTrue(result.hasGeneratedToken());
        Map<String, String> map = WatchtowerConfWriter.readMap(conf);
        assertEquals("watchtower/custom-heartbeat.json", map.get(BackupExternalConfigService.KEY_MARKER));
        assertEquals(result.generatedToken(), map.get(BackupExternalConfigService.KEY_WEBHOOK_TOKEN));
    }

    @Test
    void suppressLocalMissingPersisted() throws Exception {
        Path conf = temp.resolve(WatchtowerFiles.CONF_FILENAME);

        JsonObject req = new JsonObject();
        req.addProperty("backupSuppressLocalMissing", false);
        BackupExternalConfigService.apply(conf, req);

        Map<String, String> map = WatchtowerConfWriter.readMap(conf);
        assertEquals("false", map.get(BackupExternalConfigService.KEY_SUPPRESS_LOCAL_MISSING));
    }

    @Test
    void generateWebhookTokenIsNonEmptyAndDistinct() {
        String a = BackupExternalConfigService.generateWebhookToken();
        String b = BackupExternalConfigService.generateWebhookToken();
        assertNotNull(a);
        assertFalse(a.isBlank());
        assertNotEquals(a, b);
        assertTrue(a.length() >= 32);
    }

    @Test
    void generateWebhookTokenIsUrlSafeBase64() {
        String token = BackupExternalConfigService.generateWebhookToken();
        assertTrue(token.matches("^[A-Za-z0-9_-]+$"));
    }

    @Test
    void deriveTrackingModeWebhookMarkerBothAndOff() {
        assertEquals(BackupExternalConfigService.MODE_OFF,
                BackupExternalConfigService.deriveTrackingMode(ReportConfig.builder()
                        .backupExternalMarker("")
                        .backupWebhookToken("")
                        .build()));
        assertEquals(BackupExternalConfigService.MODE_WEBHOOK,
                BackupExternalConfigService.deriveTrackingMode(ReportConfig.builder()
                        .backupExternalMarker("")
                        .backupWebhookToken("tok")
                        .build()));
        assertEquals(BackupExternalConfigService.MODE_MARKER,
                BackupExternalConfigService.deriveTrackingMode(ReportConfig.builder()
                        .backupExternalMarker("watchtower/backup-heartbeat.json")
                        .backupWebhookToken("")
                        .build()));
        assertEquals(BackupExternalConfigService.MODE_BOTH,
                BackupExternalConfigService.deriveTrackingMode(ReportConfig.builder()
                        .backupWebhookToken("tok")
                        .backupExternalMarker("watchtower/backup-heartbeat.json")
                        .build()));
    }
}
