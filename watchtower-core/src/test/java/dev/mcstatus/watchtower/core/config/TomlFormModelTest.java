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

    @Test
    void applyValuesPreservesLayoutAndComments() {
        String original = """
                #.
                # NightConfig style header
                #.

                [general]
                # Default: true
                enabled = true # keep me
                name = "alpha"

                [general.limits]
                  max = 10
                """;
        var r = TomlFormModel.parse(original);
        assertTrue(r.formOk());
        JsonObject enabled = findByPath(r.fields(), "general.enabled");
        assertTrue(enabled != null);
        enabled.addProperty("value", false);

        String out = TomlFormModel.applyValues(original, r.fields());
        assertTrue(out.startsWith("#."));
        assertTrue(out.contains("# NightConfig style header"));
        assertTrue(out.contains("enabled = false # keep me"));
        assertTrue(out.contains("name = \"alpha\""));
        assertTrue(out.contains("  max = 10"));
        assertFalse(out.contains("WatchTower form rewrite"));

        String[] a = original.split("\\R", -1);
        String[] b = out.split("\\R", -1);
        assertEquals(a.length, b.length);
        int diffs = 0;
        for (int i = 0; i < a.length; i++) {
            if (!a[i].equals(b[i])) {
                diffs++;
                assertTrue(b[i].contains("enabled = false"));
            }
        }
        assertEquals(1, diffs);
    }

    @Test
    void applyValuesNoOpKeepsBytes() {
        String original = "[x]\ny = 1\n";
        var r = TomlFormModel.parse(original);
        assertTrue(r.formOk());
        assertEquals(original, TomlFormModel.applyValues(original, r.fields()));
    }

    @Test
    void plainValueArraysAreFormEditable() {
        var r = TomlFormModel.parse("tags = [\"a\", \"b\"]\nx = 1\n");
        assertTrue(r.formOk(), "plain arrays must not kill the form editor");
        assertTrue(r.fields().size() >= 1);
    }

    @Test
    void escapeTomlKeepsNewlinesValid() {
        JsonArray fields = new JsonArray();
        JsonObject leaf = new JsonObject();
        leaf.addProperty("kind", "string");
        leaf.addProperty("key", "name");
        leaf.addProperty("path", "name");
        leaf.addProperty("section", "");
        leaf.addProperty("value", "line1\nline2");
        fields.add(leaf);
        String out = TomlFormModel.serialize(fields);
        assertTrue(out.contains("\\n"));
        assertTrue(TomlFormModel.parse(out).formOk());
    }
}
