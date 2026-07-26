package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.report.ReportConfig;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Locale;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

class SparkFixtureAuditTest {

    private static final Path REPO = Path.of("..").toAbsolutePath().normalize();

    @Test
    void parsesTrackedFixturesWithExpectedShape() throws Exception {
        List<Path> fixtures = SparkFixtureAuditor.listFixtures(REPO);
        assumeFixturesPresent(fixtures);

        ReportConfig config = ReportConfig.builder().sparkFreshHours(24 * 365).build();
        for (Path fixture : fixtures) {
            JsonObject profile = SparkFixtureAuditor.parseFixture(fixture, config);
            assertNotNull(profile, "profile null for " + fixture.getFileName());

            String key = SparkFixtureAuditor.fixtureKey(fixture.getFileName().toString());
            assertTrue(profile.getAsJsonArray("top_methods").size() >= 3, key + " top_methods");
            assertTrue(profile.getAsJsonArray("timeline").size() >= 1, key + " timeline");
            assertTrue(profile.has("system"), key + " system");
            assertTrue(profile.has("capture"), key + " capture");
            assertTrue(profile.getAsJsonObject("deep").getAsJsonArray("top_methods").size() >= 10, key + " deep");

            JsonObject ctx = profile.getAsJsonObject("context");
            assertTrue(ctx.get("tps_1m").getAsDouble() > 0, key + " tps");
            assertTrue(ctx.get("mspt_p95_1m").getAsDouble() > 0, key + " mspt");

            if (key.matches("^[a-z0-9]{10}$")) {
                assertTrue(profile.has("spark_viewer_url"), key + " viewer url");
            }

            assertFixtureCharacter(key, profile);
        }
    }

    @Test
    void goldenFilesMatchParserWhenPresent() throws Exception {
        List<Path> fixtures = SparkFixtureAuditor.listFixtures(REPO);
        assumeFixturesPresent(fixtures);

        ReportConfig config = ReportConfig.builder().sparkFreshHours(24 * 365).build();
        for (Path fixture : fixtures) {
            String key = SparkFixtureAuditor.fixtureKey(fixture.getFileName().toString());
            var golden = SparkFixtureAuditor.loadGolden(REPO, key);
            if (golden.isEmpty()) {
                continue;
            }
            JsonObject parsed = SparkFixtureAuditor.parseFixture(fixture, config);
            assertEquals(
                    golden.get().getAsJsonObject("verdict").get("grade").getAsString(),
                    parsed.getAsJsonObject("verdict").get("grade").getAsString(),
                    key + " grade");
            assertEquals(
                    golden.get().getAsJsonArray("top_methods").size(),
                    parsed.getAsJsonArray("top_methods").size(),
                    key + " top_methods count");
        }
    }

    private static void assertFixtureCharacter(String key, JsonObject profile) {
        JsonObject verdict = profile.getAsJsonObject("verdict");
        String grade = verdict.get("grade").getAsString();
        JsonArray hints = profile.getAsJsonArray("mod_hints");

        switch (key) {
            case "h5bvv4annz", "uurblpnmju" -> {
                assertEquals("critical", grade, key);
                assertTrue(hasModHint(hints, "sable"), key + " should mention sable");
                JsonObject ctx = profile.getAsJsonObject("context");
                assertTrue(ctx.has("entity_composition"), key + " entity_composition");
                assertTrue(ctx.getAsJsonArray("entity_hotspots").size() >= 1, key + " hotspots");
                assertTrue(ctx.has("mspt_max_5m"), key + " mspt_max_5m");
            }
            case "cxrvhrnd1r", "vbk9p8wibc", "zsz5e2hnrb" -> {
                assertTrue(
                        grade.equals("healthy") || grade.equals("degraded") || grade.equals("critical"),
                        key + " grade");
                double maxNonVanillaPct = maxNonVanillaModPct(profile.getAsJsonArray("mod_rollups"));
                assertTrue(maxNonVanillaPct < 20, key + " non-vanilla mod should be <20%, was " + maxNonVanillaPct);
                JsonObject ctx = profile.getAsJsonObject("context");
                assertTrue(ctx.has("entity_composition"), key + " entity_composition");
                assertTrue(ctx.has("entity_hotspots"), key + " entity_hotspots");
                assertTrue(ctx.has("mspt_mean_1m"), key + " mspt_mean_1m");
                assertTrue(ctx.has("mspt_max_5m"), key + " mspt_max_5m");
            }
            case "profile-2026-07-23_20.37.29" -> {
                assertEquals("critical", grade, key);
                assertTrue(hasModHint(hints, "create"), key + " should mention create");
                JsonArray timeline = profile.getAsJsonArray("timeline");
                assertTrue(timeline != null && timeline.size() >= 8, key + " long multi-window timeline");
                JsonObject ctx = profile.getAsJsonObject("context");
                assertTrue(ctx.has("entity_composition"), key + " entity_composition");
                JsonObject composition = ctx.getAsJsonObject("entity_composition");
                assertTrue(composition.has("automation_cluster"), key + " automation_cluster");
                assertTrue(composition.get("automation_share_pct").getAsDouble() >= 40, key + " automation share");
                assertTrue(ctx.has("mspt_max_5m"), key + " mspt_max_5m");
                assertTrue(hasWorld(ctx, "shopping_district"), key + " custom shopping_district world");
            }
            case "homestead-prod_profile-2026-07-13_12.59.52" -> {
                assertEquals("critical", grade, key);
                assertEquals("Fabric", profile.getAsJsonObject("platform").get("loader").getAsString(), key + " Fabric");
                assertEquals("java", profile.getAsJsonObject("platform").get("engine").getAsString(), key + " java engine");
                JsonObject ctx = profile.getAsJsonObject("context");
                assertTrue(hasWorld(ctx, "otherside"), key + " otherside world");
                assertTrue(hasModHint(hints, "create"), key + " create hint preferred over infra");
                assertFalse(hasModHint(hints, "pehkui"), key + " pehkui demoted from hints");
                JsonObject composition = ctx.getAsJsonObject("entity_composition");
                assertTrue(composition.has("dominant_custom_id"), key + " dominant custom");
                assertTrue(composition.get("dominant_custom_id").getAsString().contains("mushling"),
                        key + " mushling dominant");
                assertTrue(ctx.getAsJsonArray("datapacks").size() >= 8, key + " structured datapacks");
            }
            case "homestead-prod_profile-2026-07-13_13.30.25" -> {
                assertTrue(grade.equals("degraded") || grade.equals("critical"), key + " grade");
                assertEquals("Fabric", profile.getAsJsonObject("platform").get("loader").getAsString(), key + " Fabric");
                JsonArray timeline = profile.getAsJsonArray("timeline");
                assertTrue(timeline != null && timeline.size() >= 2, key + " multi-window timeline");
                JsonObject ctx = profile.getAsJsonObject("context");
                assertTrue(hasWorld(ctx, "otherside"), key + " otherside world");
                assertTrue(ctx.has("datapacks"), key + " datapacks");
            }
            case "homestead-staging_profile-2026-07-13_07.25.40" -> {
                assertEquals("healthy", grade, key);
                assertEquals("Fabric", profile.getAsJsonObject("platform").get("loader").getAsString(), key + " Fabric");
                JsonObject ctx = profile.getAsJsonObject("context");
                assertEquals(0, ctx.get("players").getAsInt(), key + " empty players");
                JsonObject composition = ctx.getAsJsonObject("entity_composition");
                assertTrue(composition.get("marker_share_pct").getAsDouble() >= 40, key + " marker share");
                assertFalse(hasFinding(profile, "spark.entity.unattended_hotspots"),
                        key + " suppress unattended on healthy empty");
                String next = profile.getAsJsonObject("evidence_summary").get("do_this_next").getAsString();
                assertFalse(next.toLowerCase(Locale.ROOT).contains("unattended"),
                        key + " next step should not push unattended");
            }
            default -> {
            }
        }
    }

    private static boolean hasModHint(JsonArray hints, String modId) {
        for (int i = 0; i < hints.size(); i++) {
            if (modId.equals(hints.get(i).getAsJsonObject().get("mod_id").getAsString())) {
                return true;
            }
        }
        return false;
    }

    private static boolean hasFinding(JsonObject profile, String findingId) {
        if (!profile.has("key_findings") || !profile.get("key_findings").isJsonArray()) {
            return false;
        }
        JsonArray findings = profile.getAsJsonArray("key_findings");
        for (int i = 0; i < findings.size(); i++) {
            JsonObject row = findings.get(i).getAsJsonObject();
            if (findingId.equals(row.has("id") ? row.get("id").getAsString() : "")) {
                return true;
            }
        }
        return false;
    }

    private static boolean hasWorld(JsonObject ctx, String worldId) {
        if (!ctx.has("worlds") || !ctx.get("worlds").isJsonArray()) {
            return false;
        }
        JsonArray worlds = ctx.getAsJsonArray("worlds");
        for (int i = 0; i < worlds.size(); i++) {
            JsonObject world = worlds.get(i).getAsJsonObject();
            if (worldId.equals(world.has("id") ? world.get("id").getAsString() : "")) {
                return true;
            }
        }
        return false;
    }

    private static double maxNonVanillaModPct(JsonArray rollups) {
        double max = 0;
        for (int i = 0; i < rollups.size(); i++) {
            JsonObject row = rollups.get(i).getAsJsonObject();
            String modId = row.get("mod_id").getAsString();
            if (Set.of("minecraft", "neoforge", "forge", "jvm", "native", "unknown").contains(modId)) {
                continue;
            }
            max = Math.max(max, row.get("pct").getAsDouble());
        }
        return max;
    }

    private static void assumeFixturesPresent(List<Path> fixtures) {
        org.junit.jupiter.api.Assumptions.assumeFalse(
                fixtures.isEmpty(),
                "no spark fixtures in fixtures/spark/examples or samples/fixtures/spark");
    }
}
