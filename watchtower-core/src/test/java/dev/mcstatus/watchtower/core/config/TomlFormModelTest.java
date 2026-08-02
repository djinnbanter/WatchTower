package dev.mcstatus.watchtower.core.config;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonPrimitive;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class TomlFormModelTest {

    private static Path fixture(String name) {
        Path cwd = Path.of("").toAbsolutePath();
        for (Path p : new Path[]{
                cwd.resolve("samples/fixtures/mod-config-form").resolve(name),
                cwd.resolve("../samples/fixtures/mod-config-form").resolve(name),
                cwd.resolve("../../samples/fixtures/mod-config-form").resolve(name)
        }) {
            if (Files.isRegularFile(p)) {
                return p;
            }
        }
        throw new IllegalStateException("fixture missing: " + name);
    }

    private static JsonObject findByPath(JsonArray fields, String path) {
        for (JsonElement el : fields) {
            JsonObject o = el.getAsJsonObject();
            if (path.equals(o.get("path").getAsString())) {
                return o;
            }
            if (o.has("children") && o.get("children").isJsonArray()) {
                JsonObject nested = findByPath(o.getAsJsonArray("children"), path);
                if (nested != null) {
                    return nested;
                }
            }
        }
        return null;
    }

    private static Map<String, String> leafValues(JsonArray fields) {
        Map<String, String> out = new HashMap<>();
        collectLeaves(fields, out);
        return out;
    }

    private static void collectLeaves(JsonArray fields, Map<String, String> out) {
        for (JsonElement el : fields) {
            JsonObject o = el.getAsJsonObject();
            String kind = o.get("kind").getAsString();
            if ("table".equals(kind)) {
                collectLeaves(o.getAsJsonArray("children"), out);
            } else {
                out.put(o.get("path").getAsString(), o.get("value").toString());
            }
        }
    }

    @Test
    void parseSimpleOffersForm() throws Exception {
        String toml = Files.readString(fixture("simple.toml"));
        var r = TomlFormModel.parse(toml);
        assertTrue(r.formOk());
        assertFalse(r.fields().isEmpty());
        assertEquals("true", leafValues(r.fields()).get("enabled"));
    }

    @Test
    void badTomlFallsBack() throws Exception {
        String toml = Files.readString(fixture("bad.toml"));
        var r = TomlFormModel.parse(toml);
        assertFalse(r.formOk());
        assertFalse(r.warnings().isEmpty());
    }

    @Test
    void roundTripNestedValues() {
        String toml = """
                [recipes]
                bulkPressing = false
                maxFireworkIngredientsInCrafter = 9
                """;
        var r = TomlFormModel.parse(toml);
        assertTrue(r.formOk());
        String out = TomlFormModel.serialize(r.fields());
        var again = TomlFormModel.parse(out);
        assertTrue(again.formOk());
        assertEquals(leafValues(r.fields()), leafValues(again.fields()));
    }

    @Test
    void hintsFromDefaultComment() {
        String toml = """
                # Default: 20
                # Range: > 5
                tickrateSyncTimer = 20
                """;
        var r = TomlFormModel.parse(toml);
        assertTrue(r.formOk());
        JsonObject leaf = findByPath(r.fields(), "tickrateSyncTimer");
        assertTrue(leaf != null);
        assertTrue(leaf.get("hint").getAsString().contains("Default"));
    }

    @Test
    void nestedCommentsFixtureParses() throws Exception {
        String toml = Files.readString(fixture("nested-comments.toml"));
        var r = TomlFormModel.parse(toml);
        assertTrue(r.formOk());
        JsonObject leaf = findByPath(r.fields(), "recipes.maxFireworkIngredientsInCrafter");
        assertTrue(leaf != null);
        assertEquals(9, leaf.get("value").getAsInt());
        assertTrue(leaf.has("hint") && leaf.get("hint").getAsString().contains("Default"));
    }
}
