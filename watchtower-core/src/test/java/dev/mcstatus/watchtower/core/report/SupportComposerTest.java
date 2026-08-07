package dev.mcstatus.watchtower.core.report;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import dev.mcstatus.watchtower.core.brief.BriefWriter;
import dev.mcstatus.watchtower.core.collect.ReportArtifactFinder;
import dev.mcstatus.watchtower.core.ops.OpsCacheReader;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;

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

    @Test
    void mapperIssueCountsSeparatesOpenAndReviewed() throws Exception {
        Files.writeString(temp.resolve("ops-counts.json"), """
                {
                  "issues_live": [
                    {
                      "id": "DISK_HIGH",
                      "key": "DISK_HIGH",
                      "severity": "warning",
                      "status": "open",
                      "message": "Disk usage high",
                      "source": "ops"
                    },
                    {
                      "id": "LAG_SPIKE",
                      "key": "LAG_SPIKE",
                      "severity": "critical",
                      "status": "reviewed",
                      "message": "Lag spike reviewed",
                      "source": "ops"
                    }
                  ]
                }
                """, StandardCharsets.UTF_8);
        JsonObject ops = OpsCacheReader.load(temp.resolve("ops-counts.json"));
        JsonObject facts = SupportFactsMapper.fromOpsCache(ops, new SupportFactsMapper.Context(
                "/srv", "host", "neoforge", "none", true, 15));
        assertEquals(1, facts.getAsJsonArray("issues").size());
        JsonObject counts = facts.getAsJsonObject("issue_counts");
        assertEquals(0, counts.get("open_critical").getAsInt());
        assertEquals(1, counts.get("open_warning").getAsInt());
        assertEquals(1, counts.get("reviewed_critical").getAsInt());
        assertEquals(0, counts.get("reviewed_warning").getAsInt());
        assertEquals("warning", facts.getAsJsonObject("health").get("status").getAsString());
    }

    @Test
    void briefIssuesLineShowsOpenAndReviewedSplit() throws Exception {
        Files.writeString(temp.resolve("ops-brief-issues.json"), """
                {
                  "issues_live": [
                    {"id":"DISK_HIGH","key":"DISK_HIGH","severity":"warning","status":"open","message":"Disk","source":"ops"},
                    {"id":"LAG_SPIKE","key":"LAG_SPIKE","severity":"critical","status":"reviewed","message":"Lag","source":"ops"}
                  ]
                }
                """, StandardCharsets.UTF_8);
        JsonObject ops = OpsCacheReader.load(temp.resolve("ops-brief-issues.json"));
        JsonObject facts = SupportFactsMapper.fromOpsCache(ops, new SupportFactsMapper.Context(
                "/srv", "host", "neoforge", "none", true, 15));
        String brief = BriefWriter.writeBrief(facts);
        assertTrue(brief.contains("open 0 critical / 1 warning"), brief);
        assertTrue(brief.contains("reviewed 1 critical / 0 warning"), brief);
        assertTrue(brief.contains("not Overview scorecard grade"), brief);
    }

    @Test
    void shouldOmitHangForBudgetUsesHardOnly() {
        // Small budgets (not SOFT_BUDGET_BYTES) — brief says avoid multi-MiB fixtures
        SupportEvidenceCollector.BudgetState softPast = new SupportEvidenceCollector.BudgetState(
                100_000 + 10,
                100_000,
                250_000,
                new ArrayList<>());
        assertTrue(softPast.softExceeded());
        assertFalse(SupportComposer.shouldOmitHangForBudget(softPast, 50));
        assertTrue(SupportComposer.shouldOmitHangForBudget(softPast, 200_000));

        SupportEvidenceCollector.BudgetState underSoft = new SupportEvidenceCollector.BudgetState(
                0,
                100_000,
                250_000,
                new ArrayList<>());
        assertFalse(underSoft.softExceeded());
        assertFalse(SupportComposer.shouldOmitHangForBudget(underSoft, 50));
    }

    @Test
    void composeEmbedsQualityGateInManifest() throws Exception {
        Path serverDir = temp.resolve("server-gate");
        Path watchtower = serverDir.resolve("watchtower");
        Files.createDirectories(watchtower);
        Files.writeString(watchtower.resolve("ops-cache.json"), """
                {
                  "schema_version": 3,
                  "activity": { "events": [] },
                  "issues_live": [],
                  "crashes": { "entries": [], "unreviewed": 0 },
                  "mods_light": { "mods": [{ "id": "jei" }] },
                  "server": { "loader": "neoforge" }
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
        try (java.util.zip.ZipFile zip = new java.util.zip.ZipFile(result.zipPath().toFile())) {
            var entry = zip.getEntry("manifest.json");
            assertNotNull(entry);
            String text = new String(zip.getInputStream(entry).readAllBytes(), StandardCharsets.UTF_8);
            JsonObject manifest = JsonParser.parseString(text).getAsJsonObject();
            assertTrue(manifest.has("quality_gate"));
            JsonObject gate = manifest.getAsJsonObject("quality_gate");
            assertTrue(gate.get("checks").isJsonArray());
            assertTrue(gate.getAsJsonArray("checks").size() > 0);
            assertFalse(gate.get("override").getAsBoolean());
        }
    }

    private static void assertEqualsSupportMode(JsonObject meta) {
        assertTrue(meta.has("report_mode"));
        assertTrue(meta.get("report_mode").getAsString().contains("support"));
    }
}
