package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import dev.mcstatus.watchtower.core.report.ReportConfig;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Golden fixture parity for Layer-1 {@link ModSideScorer} (no Modrinth / jar scan).
 * Fixture: {@code samples/fixtures/mod-intelligence/mods-scoring-basic.json}.
 */
class ModSideScorerGoldenTest {

    @Test
    void modsScoringBasicMatchesGoldenExpectations() throws Exception {
        Path fixture = resolveFixture();
        assertTrue(Files.isRegularFile(fixture), "missing fixture: " + fixture);

        JsonObject root = JsonParser.parseString(Files.readString(fixture, StandardCharsets.UTF_8))
                .getAsJsonObject();
        JsonObject input = root.getAsJsonObject("input");
        JsonObject optional = new JsonObject();
        optional.add("mods", deepCopyArray(input.getAsJsonArray("mods")));
        if (input.has("client_class_warnings_by_mod")) {
            optional.add("client_class_warnings_by_mod",
                    deepCopyArray(input.getAsJsonArray("client_class_warnings_by_mod")));
        }
        if (input.has("ignored_client_mods")) {
            optional.add("ignored_client_mods", input.getAsJsonObject("ignored_client_mods").deepCopy());
        }

        ModSideScorer.apply(optional, ReportConfig.builder().build(), "");

        JsonObject expectedScores = root.getAsJsonObject("expected_side_scores");
        for (Map.Entry<String, JsonElement> e : expectedScores.entrySet()) {
            String id = e.getKey();
            String want = e.getValue().getAsString();
            assertEquals(want, sideScore(optional, id), "side_score for " + id);
        }

        Set<String> clientIds = clientOnlyIds(optional);
        List<String> expectedClient = stringList(root.getAsJsonArray("expected_client_only_mod_ids"));
        assertEquals(new HashSet<>(expectedClient), clientIds,
                "client_only_mods ids");

        for (String id : stringList(root.getAsJsonArray("expected_excluded_from_client_only"))) {
            assertFalse(clientIds.contains(id), id + " should be excluded from client_only_mods");
        }
    }

    private static Path resolveFixture() {
        Path cwd = Path.of(System.getProperty("user.dir")).toAbsolutePath().normalize();
        Path[] candidates = {
                cwd.resolve("samples/fixtures/mod-intelligence/mods-scoring-basic.json"),
                cwd.resolve("../samples/fixtures/mod-intelligence/mods-scoring-basic.json"),
                cwd.resolve("../../samples/fixtures/mod-intelligence/mods-scoring-basic.json"),
        };
        for (Path p : candidates) {
            if (Files.isRegularFile(p)) {
                return p.normalize();
            }
        }
        Path walked = walkUpToRepoRoot(cwd);
        if (walked != null) {
            return walked.resolve("samples/fixtures/mod-intelligence/mods-scoring-basic.json");
        }
        return candidates[0];
    }

    private static Path walkUpToRepoRoot(Path start) {
        Path cur = start;
        for (int i = 0; i < 8 && cur != null; i++) {
            if (Files.isDirectory(cur.resolve("samples/fixtures"))) {
                return cur;
            }
            cur = cur.getParent();
        }
        return null;
    }

    private static JsonArray deepCopyArray(JsonArray src) {
        JsonArray out = new JsonArray();
        if (src == null) {
            return out;
        }
        for (JsonElement el : src) {
            out.add(el.deepCopy());
        }
        return out;
    }

    private static List<String> stringList(JsonArray arr) {
        List<String> out = new ArrayList<>();
        if (arr == null) {
            return out;
        }
        for (JsonElement el : arr) {
            out.add(el.getAsString());
        }
        return out;
    }

    private static Set<String> clientOnlyIds(JsonObject optional) {
        Set<String> ids = new HashSet<>();
        if (!optional.has("client_only_mods")) {
            return ids;
        }
        for (JsonElement el : optional.getAsJsonArray("client_only_mods")) {
            ids.add(el.getAsJsonObject().get("mod_id").getAsString());
        }
        return ids;
    }

    private static String sideScore(JsonObject optional, String id) {
        for (JsonElement el : optional.getAsJsonArray("mods")) {
            JsonObject m = el.getAsJsonObject();
            if (id.equals(m.get("id").getAsString())) {
                return m.has("side_score") ? m.get("side_score").getAsString() : null;
            }
        }
        return null;
    }
}
