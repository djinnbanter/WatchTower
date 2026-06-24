package dev.mcstatus.watchtower.core.analyze;

import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.report.ReportConfig;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class BackupStatusResolverTest {

    @Test
    void suppressLocalNotFoundWhenExternalFresh() {
        JsonObject local = new JsonObject();
        local.addProperty("status", "not_found");

        JsonObject external = new JsonObject();
        external.addProperty("configured", true);
        external.addProperty("status", "success");
        external.addProperty("stale", false);

        ReportConfig config = ReportConfig.builder()
                .backupDirs("/backups")
                .backupSuppressLocalMissing(true)
                .build();

        BackupStatusResolver.Resolved r = BackupStatusResolver.resolve(local, external, config);
        assertEquals(BackupStatusResolver.Mode.HYBRID, r.mode());
        assertTrue(r.suppressLocalNotFound());
        assertTrue(r.overallOk());
    }

    @Test
    void externalOnlyMode() {
        JsonObject external = new JsonObject();
        external.addProperty("configured", true);
        external.addProperty("status", "success");
        external.addProperty("stale", false);

        ReportConfig config = ReportConfig.builder()
                .backupWebhookToken("tok")
                .build();

        BackupStatusResolver.Resolved r = BackupStatusResolver.resolve(null, external, config);
        assertEquals(BackupStatusResolver.Mode.EXTERNAL_ONLY, r.mode());
        assertTrue(r.overallOk());
    }

    @Test
    void noneModeUnconfigured() {
        ReportConfig config = ReportConfig.builder()
                .backupExternalMarker("")
                .build();
        BackupStatusResolver.Resolved r = BackupStatusResolver.resolve(null, null, config);
        assertEquals(BackupStatusResolver.Mode.NONE, r.mode());
        assertEquals("unconfigured", r.overallStatus());
    }

    @Test
    void hybridStaleWhenEitherStale() {
        JsonObject local = new JsonObject();
        local.addProperty("status", "success");
        local.addProperty("stale", false);

        JsonObject external = new JsonObject();
        external.addProperty("configured", true);
        external.addProperty("status", "stale");
        external.addProperty("stale", true);

        ReportConfig config = ReportConfig.builder()
                .backupDirs("/backups")
                .backupWebhookToken("tok")
                .build();

        BackupStatusResolver.Resolved r = BackupStatusResolver.resolve(local, external, config);
        assertTrue(r.overallStale());
    }
}
