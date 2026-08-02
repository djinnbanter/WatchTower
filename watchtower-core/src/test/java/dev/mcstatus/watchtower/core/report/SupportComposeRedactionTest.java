package dev.mcstatus.watchtower.core.report;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Enumeration;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SupportComposeRedactionTest {

    @TempDir
    Path temp;

    @Test
    void factsBriefAndOpsCacheShareRedactionAndPopulateSystem() throws Exception {
        Path serverDir = temp.resolve("server");
        Path watchtower = serverDir.resolve("watchtower");
        Files.createDirectories(watchtower);
        Files.createDirectories(serverDir.resolve("logs"));
        Files.writeString(serverDir.resolve("logs/latest.log"),
                "[28Jul2026 14:16:32.036] [main/INFO] hello\n", StandardCharsets.UTF_8);
        Files.writeString(watchtower.resolve("ops-cache.json"), """
                {
                  "schema_version": 3,
                  "activity": { "events": [
                    { "time": "2026-07-27T19:21:26.395+01:00", "type": "player_join", "detail": "DJINNBANTER" },
                    { "time": "2026-07-27T19:21:26.395+01:00", "type": "player_join",
                      "detail": "DJINNBANTER[/192.168.0.235:64169]" },
                    { "time": "2026-07-27T01:04:27,072", "type": "panel_command",
                      "detail": "restart_server for server X with ID: f208f13f-03b8-42f4-b07e-02f1dff6f964" }
                  ] },
                  "disk_jump": { "active": true, "disk_use_pct": 57.0, "disk_free_gb": 364.43 },
                  "player_directory": { "players": [
                    { "name": "Apollo951", "uuid": "44dcbd82531f4ca9b3676c78948c4415", "online": false }
                  ], "online_count": 0, "known_count": 1 },
                  "issues_live": [],
                  "crashes": { "entries": [], "unreviewed": 0 }
                }
                """, StandardCharsets.UTF_8);
        Files.writeString(watchtower.resolve("performance-rollups.json"), "{}", StandardCharsets.UTF_8);

        SupportComposer.ComposeResult result = SupportComposer.compose(new SupportComposer.ComposeRequest(
                watchtower,
                serverDir,
                watchtower.resolve("ops-cache.json"),
                watchtower.resolve("performance-rollups.json"),
                "test-host",
                "neoforge",
                "crafty",
                true,
                15,
                SupportComposeOptions.quickDefaults(),
                new SupportEnvironmentBuilder.Context("1.2.0", "1.21.1", "neoforge", null,
                        "test-host", "crafty", true, "Linux", "amd64"),
                null,
                "1.2.0",
                "1.21.1",
                null));

        String factsText = Files.readString(result.factsPath(), StandardCharsets.UTF_8);
        String briefText = Files.readString(result.briefPath(), StandardCharsets.UTF_8);
        assertFalse(factsText.contains("192.168.0.235"));
        assertFalse(factsText.contains("f208f13f-03b8-42f4-b07e-02f1dff6f964"));
        assertFalse(briefText.contains("192.168.0.235"));
        assertFalse(briefText.contains("f208f13f-03b8-42f4-b07e-02f1dff6f964"));
        assertFalse(factsText.contains("44dcbd82531f4ca9b3676c78948c4415"));
        assertTrue(factsText.contains("44dcbd82..."));

        JsonObject facts = JsonParser.parseString(factsText).getAsJsonObject();
        assertEquals(2, facts.getAsJsonArray("events").size());
        assertTrue(facts.has("system"));
        assertTrue(briefText.contains("Disk used: 57"));
        assertFalse(briefText.contains("Disk used: ?%"));
        assertFalse(briefText.contains("Machine uptime: 0.0 hours"));
        assertTrue(briefText.contains("Panel: unknown"));
        assertFalse(briefText.contains("Panel: DOWN"));

        try (ZipFile zip = new ZipFile(result.zipPath().toFile())) {
            String ops = readEntry(zip, "watchtower/ops-cache.json");
            assertFalse(ops.contains("192.168.0.235"));
            assertFalse(ops.contains("f208f13f-03b8-42f4-b07e-02f1dff6f964"));
            String log = findLogTail(zip);
            assertTrue(log != null);
            assertTrue(log.contains("14:16:32.036"), "timestamp must survive: " + log);
        }
    }

    @Test
    void craftyPanelRunningShowsRunning() throws Exception {
        Path serverDir = temp.resolve("server2");
        Path watchtower = serverDir.resolve("watchtower");
        Files.createDirectories(watchtower);
        Files.createDirectories(serverDir.resolve("logs"));
        Files.writeString(serverDir.resolve("logs/latest.log"), "x\n", StandardCharsets.UTF_8);
        Files.writeString(watchtower.resolve("ops-cache.json"), """
                {
                  "schema_version": 3,
                  "activity": { "events": [] },
                  "disk_jump": { "disk_use_pct": 10.0, "disk_free_gb": 100.0 },
                  "issues_live": [],
                  "crashes": { "entries": [], "unreviewed": 0 }
                }
                """, StandardCharsets.UTF_8);
        Files.writeString(watchtower.resolve("performance-rollups.json"), "{}", StandardCharsets.UTF_8);

        SupportComposer.ComposeResult result = SupportComposer.compose(new SupportComposer.ComposeRequest(
                watchtower,
                serverDir,
                watchtower.resolve("ops-cache.json"),
                watchtower.resolve("performance-rollups.json"),
                "test-host",
                "neoforge",
                "crafty",
                true,
                15,
                SupportComposeOptions.quickDefaults(),
                null,
                null,
                "1.2.0",
                "1.21.1",
                true));

        String briefText = Files.readString(result.briefPath(), StandardCharsets.UTF_8);
        assertTrue(briefText.contains("Panel: RUNNING"));
        assertFalse(briefText.contains("Panel: DOWN"));
    }

    @Test
    void windowLiveHistoryUnderstandsSeriesShape() throws Exception {
        Path live = temp.resolve("live-history.json");
        Files.writeString(live, """
                {
                  "schema": 1,
                  "latest": { "polled_at": "2026-07-28T12:00:00Z" },
                  "series": {
                    "disk_use_pct": [
                      { "t": "2020-01-01T00:00:00Z", "v": 1.0 },
                      { "t": "2099-01-01T00:00:00Z", "v": 57.0 }
                    ]
                  }
                }
                """, StandardCharsets.UTF_8);

        // Use reflection-free path: FULL with minutes>0 via options and include live history compose
        Path serverDir = temp.resolve("server3");
        Path watchtower = serverDir.resolve("watchtower");
        Files.createDirectories(watchtower);
        Files.createDirectories(serverDir.resolve("logs"));
        Files.writeString(serverDir.resolve("logs/latest.log"), "x\n", StandardCharsets.UTF_8);
        Files.writeString(watchtower.resolve("ops-cache.json"),
                "{\"schema_version\":3,\"activity\":{\"events\":[]},\"issues_live\":[],\"crashes\":{\"entries\":[],\"unreviewed\":0}}",
                StandardCharsets.UTF_8);
        Files.writeString(watchtower.resolve("performance-rollups.json"), "{}", StandardCharsets.UTF_8);
        Files.writeString(watchtower.resolve("live-history.json"),
                Files.readString(live, StandardCharsets.UTF_8), StandardCharsets.UTF_8);

        SupportComposeOptions opts = SupportComposeOptions.forPreset(SupportComposeOptions.Preset.FULL_EVIDENCE)
                .toBuilder()
                .liveHistoryMinutes(60)
                .includeSpark(false)
                .includeCrashes(false)
                .build();

        SupportComposer.ComposeResult result = SupportComposer.compose(new SupportComposer.ComposeRequest(
                watchtower,
                serverDir,
                watchtower.resolve("ops-cache.json"),
                watchtower.resolve("performance-rollups.json"),
                "test-host",
                "neoforge",
                "none",
                true,
                15,
                opts,
                null,
                null,
                "1.2.0",
                "1.21.1",
                null));

        try (ZipFile zip = new ZipFile(result.zipPath().toFile())) {
            String windowed = readEntry(zip, "performance/live-history-window.json");
            assertTrue(windowed.contains("window_minutes"));
            assertFalse(windowed.contains("2020-01-01"));
            assertTrue(windowed.contains("2099-01-01"));
        }
    }

    private static String readEntry(ZipFile zip, String name) throws Exception {
        ZipEntry e = zip.getEntry(name);
        assertTrue(e != null, "missing " + name);
        return new String(zip.getInputStream(e).readAllBytes(), StandardCharsets.UTF_8);
    }

    private static String findLogTail(ZipFile zip) throws Exception {
        Enumeration<? extends ZipEntry> en = zip.entries();
        while (en.hasMoreElements()) {
            ZipEntry e = en.nextElement();
            if (e.getName().contains("latest.log") || e.getName().startsWith("evidence/logs/")) {
                return new String(zip.getInputStream(e).readAllBytes(), StandardCharsets.UTF_8);
            }
        }
        return null;
    }
}
