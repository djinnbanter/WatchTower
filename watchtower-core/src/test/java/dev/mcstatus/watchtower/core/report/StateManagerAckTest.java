package dev.mcstatus.watchtower.core.report;

import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.WatchtowerFiles;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;

import static org.junit.jupiter.api.Assertions.*;

class StateManagerAckTest {

    @TempDir
    Path temp;

    @Test
    void acknowledgeCrashPersistsInState() throws Exception {
        Path statePath = temp.resolve(WatchtowerFiles.STATE_FILENAME);
        Instant when = Instant.parse("2026-06-16T21:00:00Z");

        StateManager.acknowledgeCrash(statePath, "crash-reports/foo.txt", when);

        String json = Files.readString(statePath);
        assertTrue(json.contains("acknowledged_crashes"));
        assertTrue(json.contains("foo.txt"));
    }

    @Test
    void richAckRecordStoredWithNormalization() throws Exception {
        Path statePath = temp.resolve(WatchtowerFiles.STATE_FILENAME);
        StateManager.acknowledgeCrash(
                statePath,
                "crash-reports/crash-test.txt",
                Instant.parse("2026-06-16T21:00:00Z"),
                "dashboard",
                "mod",
                "NeoForge failed while loading sable.");

        JsonObject acks = StateManager.getAcknowledgedCrashes(statePath);
        assertTrue(acks.has("crash-test.txt"));
        JsonObject record = acks.getAsJsonObject("crash-test.txt");
        assertEquals("dashboard", record.get("by").getAsString());
        assertTrue(record.has("plain_english"));
        assertTrue(acks.has("crash-reports/crash-test.txt"));
    }

    @Test
    void unacknowledgeRemovesBothKeys() throws Exception {
        Path statePath = temp.resolve(WatchtowerFiles.STATE_FILENAME);
        StateManager.acknowledgeCrash(statePath, "crash-test.txt", Instant.now());
        StateManager.unacknowledgeCrash(statePath, "crash-reports/crash-test.txt");

        JsonObject acks = StateManager.getAcknowledgedCrashes(statePath);
        assertFalse(acks.has("crash-test.txt"));
        assertFalse(acks.has("crash-reports/crash-test.txt"));
    }

    @Test
    void dismissInboxItemPersists() throws Exception {
        Path statePath = temp.resolve(WatchtowerFiles.STATE_FILENAME);
        Instant when = Instant.parse("2026-06-16T21:00:00Z");

        StateManager.dismissInboxItem(statePath, "crash:watchdog|-|java.lang.Error|-", when, "dashboard");

        JsonObject dismissals = StateManager.getInboxDismissals(statePath);
        assertTrue(dismissals.has("crash:watchdog|-|java.lang.Error|-"));
        assertEquals("dashboard", dismissals.getAsJsonObject("crash:watchdog|-|java.lang.Error|-").get("by").getAsString());
    }

    @Test
    void acknowledgeIssuePersistsAndUnacks() throws Exception {
        Path statePath = temp.resolve(WatchtowerFiles.STATE_FILENAME);
        Instant when = Instant.parse("2026-07-13T14:00:00Z");

        StateManager.acknowledgeIssue(statePath, "issue:DISK_HIGH", when, "dashboard");
        StateManager.acknowledgeAllIssues(
                statePath,
                java.util.List.of("lag:inc-1", "mod:create", "issue:DISK_HIGH"),
                when,
                "dashboard");

        JsonObject acks = StateManager.getAcknowledgedIssues(statePath);
        assertTrue(acks.has("issue:DISK_HIGH"));
        assertTrue(acks.has("lag:inc-1"));
        assertTrue(acks.has("mod:create"));
        assertEquals("dashboard", acks.getAsJsonObject("mod:create").get("by").getAsString());

        StateManager.unacknowledgeIssue(statePath, "lag:inc-1");
        JsonObject after = StateManager.getAcknowledgedIssues(statePath);
        assertFalse(after.has("lag:inc-1"));
        assertTrue(after.has("issue:DISK_HIGH"));
    }

    @Test
    void acknowledgeAllCrashesPersistsEachFile() throws Exception {
        Path statePath = temp.resolve(WatchtowerFiles.STATE_FILENAME);
        Instant when = Instant.parse("2026-06-16T21:00:00Z");

        StateManager.acknowledgeAllCrashes(
                statePath,
                java.util.List.of("crash-a.txt", "crash-reports/crash-b.txt"),
                when,
                "dashboard");

        JsonObject acks = StateManager.getAcknowledgedCrashes(statePath);
        assertTrue(acks.has("crash-a.txt"));
        assertTrue(acks.has("crash-reports/crash-a.txt"));
        assertTrue(acks.has("crash-b.txt"));
        assertTrue(acks.has("crash-reports/crash-b.txt"));
    }

    @Test
    void ignoreClientModPersistsInState() throws Exception {
        Path statePath = temp.resolve(WatchtowerFiles.STATE_FILENAME);
        Instant when = Instant.parse("2026-06-16T21:00:00Z");

        StateManager.ignoreClientMod(statePath, "jei", when, "dashboard", "needed for recipe sync");

        String json = Files.readString(statePath);
        assertTrue(json.contains("ignored_client_mods"));
        assertTrue(json.contains("jei"));
        JsonObject ignores = StateManager.getIgnoredClientMods(statePath);
        assertTrue(ignores.has("jei"));
        assertEquals("dashboard", ignores.getAsJsonObject("jei").get("by").getAsString());
    }

    @Test
    void unignoreClientModRemovesEntry() throws Exception {
        Path statePath = temp.resolve(WatchtowerFiles.STATE_FILENAME);
        StateManager.ignoreClientMod(statePath, "jei", Instant.now());
        StateManager.unignoreClientMod(statePath, "jei");

        JsonObject ignores = StateManager.getIgnoredClientMods(statePath);
        assertFalse(ignores.has("jei"));
    }

    @Test
    void reportConfigHonorsLookbackOverride() {
        var config = ReportConfig.fromMap(java.util.Map.of(
                "SERVER_DIR", "/srv",
                "LOOKBACK_HOURS", "48"
        ));
        assertEquals(48, config.lookbackHours());
    }

    @Test
    void modSideScanDefaultsFalse() {
        var config = ReportConfig.fromMap(java.util.Map.of("SERVER_DIR", "/srv"));
        assertFalse(config.modSideScan());
        assertEquals(50, config.modSideScanMaxJars());
    }
}
