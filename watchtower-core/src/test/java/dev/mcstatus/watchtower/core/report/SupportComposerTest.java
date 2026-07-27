package dev.mcstatus.watchtower.core.report;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import dev.mcstatus.watchtower.core.collect.ReportArtifactFinder;
import dev.mcstatus.watchtower.core.ops.OpsCacheReader;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SupportComposerTest {

    @TempDir
    Path temp;

    @Test
    void composeBuildsZipAndSupportFactsExcludedFromBauFinder() throws Exception {
        Path serverDir = temp.resolve("server");
        Path watchtower = serverDir.resolve("watchtower");
        Files.createDirectories(watchtower);
        Files.writeString(watchtower.resolve("ops-cache.json"), """
                {
                  "schema_version": 3,
                  "activity": { "events": [] },
                  "issues_live": [],
                  "crashes": { "entries": [], "unreviewed": 0 }
                }
                """, StandardCharsets.UTF_8);
        Files.writeString(watchtower.resolve("performance-rollups.json"), "{}", StandardCharsets.UTF_8);
        Files.createDirectories(serverDir.resolve("logs"));
        Files.writeString(serverDir.resolve("logs/latest.log"), "[01Jan2026 12:00:00] test\n", StandardCharsets.UTF_8);

        SupportComposer.ComposeResult result = SupportComposer.compose(new SupportComposer.ComposeRequest(
                watchtower,
                serverDir,
                watchtower.resolve("ops-cache.json"),
                watchtower.resolve("performance-rollups.json"),
                "test-host",
                "neoforge",
                "none",
                true,
                15));

        assertTrue(Files.isRegularFile(result.zipPath()));
        assertTrue(result.synthesizedFacts());
        assertTrue(Files.isRegularFile(result.factsPath()));
        assertTrue(result.factsPath().getFileName().toString().contains("-support-"));
        assertTrue(Files.isRegularFile(result.briefPath()));

        JsonObject facts = JsonParser.parseString(Files.readString(result.factsPath())).getAsJsonObject();
        assertTrue(facts.has("meta"));
        assertEqualsSupportMode(facts.getAsJsonObject("meta"));

        assertNull(ReportArtifactFinder.findLatestFacts(watchtower));
        Path legacyFacts = watchtower.resolve("watchtower-facts-2020-01-01.json");
        Files.writeString(legacyFacts, "{}", StandardCharsets.UTF_8);
        assertTrue(Files.isRegularFile(ReportArtifactFinder.findLatestFacts(watchtower)));
        assertFalse(ReportArtifactFinder.findLatestFacts(watchtower).getFileName().toString().contains("-support-"));
    }

    @Test
    void mapperBuildsIssuesFromOpsFixture() throws Exception {
        Files.writeString(temp.resolve("ops.json"), """
                {
                  "issues_live": [
                    {
                      "id": "DISK_HIGH",
                      "key": "DISK_HIGH",
                      "severity": "warning",
                      "status": "open",
                      "message": "Disk usage high",
                      "source": "ops"
                    }
                  ],
                  "activity": { "events": [ { "time": "2026-01-01T00:00:00Z", "type": "player_join", "detail": "Steve" } ] }
                }
                """, StandardCharsets.UTF_8);
        JsonObject ops = OpsCacheReader.load(temp.resolve("ops.json"));
        JsonObject facts = SupportFactsMapper.fromOpsCache(ops, new SupportFactsMapper.Context(
                "/srv", "host", "neoforge", "none", true, 15));
        assertTrue(facts.has("issues"));
        assertEquals(1, facts.getAsJsonArray("issues").size());
        assertTrue(facts.has("events"));
    }

    private static void assertEqualsSupportMode(JsonObject meta) {
        assertTrue(meta.has("report_mode"));
        assertTrue(meta.get("report_mode").getAsString().contains("support"));
    }
}
