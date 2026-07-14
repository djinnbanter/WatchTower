package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;

class FmlIssueParserTest {

    private static final Path CRASH_INTEL = Path.of("..", "samples", "fixtures", "crash-intelligence");
    private static final Path CA_PARITY = Path.of("..", "samples", "fixtures", "ca-parity");

    @Test
    void parsesFmlMultiblockFixture() throws Exception {
        String text = readFixture(CRASH_INTEL, "fml-multiblock.log");
        JsonArray issues = FmlIssueParser.parse(text);
        assertEquals(3, issues.size());
        JsonObject first = issues.get(0).getAsJsonObject();
        assertEquals("mod_load_dependency", first.get("kind").getAsString());
        assertTrue(first.has("mod_id"));
        boolean hasCorrupt = false;
        for (var el : issues) {
            if ("mod_corrupt".equals(el.getAsJsonObject().get("kind").getAsString())) {
                hasCorrupt = true;
            }
        }
        assertTrue(hasCorrupt);
    }

    @Test
    void parsesDependencyBannerWithModIds() throws Exception {
        String text = readFixture(CA_PARITY, "fml-dependency-banner.log");
        JsonArray issues = FmlIssueParser.parse(text);
        assertFalse(issues.isEmpty());
        JsonObject banner = null;
        for (var el : issues) {
            JsonObject row = el.getAsJsonObject();
            if (row.has("banner") && row.get("banner").getAsBoolean()) {
                banner = row;
                break;
            }
        }
        assertNotNull(banner);
        assertEquals("mod_load_dependency", banner.get("kind").getAsString());
        assertEquals(1, banner.get("rank").getAsInt());
        assertTrue(banner.has("mod_ids"));
        JsonArray modIds = banner.getAsJsonArray("mod_ids");
        assertTrue(modIds.size() >= 2);
        boolean hasCloth = false;
        boolean hasExample = false;
        for (var el : modIds) {
            String id = el.getAsString();
            if ("cloth_config".equals(id)) {
                hasCloth = true;
            }
            if ("examplemod".equals(id)) {
                hasExample = true;
            }
        }
        assertTrue(hasCloth);
        assertTrue(hasExample);

        JsonArray hits = FmlIssueParser.parseKnownPatternHits(text);
        assertFalse(hits.isEmpty());
        JsonObject hit = hits.get(0).getAsJsonObject();
        assertEquals("fml_missing_unsupported_dependencies", hit.get("id").getAsString());
        assertTrue(hit.get("priority").getAsInt() >= 80);
        assertTrue(hit.getAsJsonArray("mod_ids").size() >= 2);
    }

    @Test
    void optionalDependencyBannerIsRankTwo() {
        String text = """
                [main/WARN] [neoforge/]: Unsupported installed optional dependencies:
                \tMod ID: 'optionalmod', Requested by: 'hostmod', Actual version: '[MISSING]'
                """;
        JsonArray issues = FmlIssueParser.parse(text);
        assertFalse(issues.isEmpty());
        JsonObject banner = issues.get(0).getAsJsonObject();
        assertTrue(banner.get("banner").getAsBoolean());
        assertEquals(2, banner.get("rank").getAsInt());
        JsonArray hits = FmlIssueParser.parseKnownPatternHits(text);
        assertEquals(1, hits.size());
        assertTrue(hits.get(0).getAsJsonObject().get("priority").getAsInt() < 80);
    }

    private static String readFixture(Path base, String name) throws Exception {
        Path p = base.resolve(name);
        if (!Files.isRegularFile(p)) {
            String folder = base.getFileName().toString();
            p = Path.of("samples", "fixtures", folder, name);
        }
        assertTrue(Files.isRegularFile(p), "missing fixture: " + name);
        return Files.readString(p);
    }
}
