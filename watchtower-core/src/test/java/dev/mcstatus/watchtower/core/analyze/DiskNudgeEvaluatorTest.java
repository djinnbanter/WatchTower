package dev.mcstatus.watchtower.core.analyze;

import com.google.gson.JsonObject;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class DiskNudgeEvaluatorTest {

    @Test
    void diskNudgeWhenFreeSpaceBelowBackupSize() {
        JsonObject backup = new JsonObject();
        backup.addProperty("size_gb", 12.0);

        JsonObject nudge = DiskNudgeEvaluator.evaluateDisk(8.5, backup);
        assertTrue(nudge.get("active").getAsBoolean());
        assertEquals("disk_low", nudge.get("kind").getAsString());
        assertTrue(nudge.get("message").getAsString().contains("8.5"));
    }

    @Test
    void diskNudgeInactiveWhenEnoughSpace() {
        JsonObject backup = new JsonObject();
        backup.addProperty("size_gb", 5.0);

        JsonObject nudge = DiskNudgeEvaluator.evaluateDisk(20.0, backup);
        assertFalse(nudge.get("active").getAsBoolean());
    }

    @Test
    void backupNudgeWhenStale() {
        JsonObject backup = new JsonObject();
        backup.addProperty("status", "success");
        backup.addProperty("stale", true);
        backup.addProperty("age_days", 10.0);
        backup.addProperty("path", "world.zip");

        JsonObject nudge = DiskNudgeEvaluator.evaluateBackup(backup, 7);
        assertTrue(nudge.get("active").getAsBoolean());
        assertEquals("backup_stale", nudge.get("kind").getAsString());
    }

    @Test
    void backupNudgeWhenNotFound() {
        JsonObject backup = new JsonObject();
        backup.addProperty("status", "not_found");

        JsonObject nudge = DiskNudgeEvaluator.evaluateBackup(backup, 7);
        assertTrue(nudge.get("active").getAsBoolean());
        assertEquals("backup_missing", nudge.get("kind").getAsString());
    }

    @Test
    void backupNudgeInactiveWhenFresh() {
        JsonObject backup = new JsonObject();
        backup.addProperty("status", "success");
        backup.addProperty("stale", false);
        backup.addProperty("age_days", 1.0);

        JsonObject nudge = DiskNudgeEvaluator.evaluateBackup(backup, 7);
        assertFalse(nudge.get("active").getAsBoolean());
    }
}
