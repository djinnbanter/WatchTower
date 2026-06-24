package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.report.ReportConfig;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

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
            }
            case "cxrvhrnd1r", "vbk9p8wibc", "zsz5e2hnrb" -> {
                assertTrue(grade.equals("healthy") || grade.equals("degraded"), key + " grade");
                double maxNonVanillaPct = maxNonVanillaModPct(profile.getAsJsonArray("mod_rollups"));
                assertTrue(maxNonVanillaPct < 20, key + " non-vanilla mod should be <20%, was " + maxNonVanillaPct);
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

    private static double maxNonVanillaModPct(JsonArray rollups) {
        double max = 0;
        for (int i = 0; i < rollups.size(); i++) {
            JsonObject row = rollups.get(i).getAsJsonObject();
            String modId = row.get("mod_id").getAsString();
            if ("minecraft".equals(modId) || "neoforge".equals(modId)) {
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
