package dev.mcstatus.watchtower.core.analyze;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class JoinClinicAnalyzerTest {

    private static JsonObject load(String name) throws Exception {
        Path cwd = Path.of("").toAbsolutePath();
        for (Path c : List.of(
                cwd.resolve("samples/fixtures/join-clinic").resolve(name),
                cwd.resolve("../samples/fixtures/join-clinic").resolve(name),
                cwd.resolve("../../samples/fixtures/join-clinic").resolve(name))) {
            if (Files.isRegularFile(c)) {
                return JsonParser.parseString(Files.readString(c)).getAsJsonObject();
            }
        }
        throw new IllegalStateException("fixture not found: " + name);
    }

    @Test
    void missingModsLabeledAgainstRunningMods() throws Exception {
        JsonObject fixture = load("analyze-missing-vs-server.json");
        JsonObject block = JoinClinicAnalyzer.analyze(
                List.of(fixture.getAsJsonObject("raw")),
                fixture.getAsJsonObject("cache"),
                null);
        JsonObject entry = block.getAsJsonArray("entries").get(0).getAsJsonObject();
        assertTrue(entry.getAsJsonArray("missing").size() >= 1);
        assertEquals("create", entry.getAsJsonArray("missing").get(0).getAsJsonObject().get("mod_id").getAsString());
    }

    @Test
    void clientOnlyExtraIsSuppressed() throws Exception {
        JsonObject fixture = load("analyze-client-only-suppressed.json");
        JsonObject block = JoinClinicAnalyzer.analyze(
                List.of(fixture.getAsJsonObject("raw")),
                fixture.getAsJsonObject("cache"),
                null);
        JsonObject entry = block.getAsJsonArray("entries").get(0).getAsJsonObject();
        assertEquals(0, entry.getAsJsonArray("extra").size());
        assertTrue(entry.getAsJsonArray("suppressed_client_only").size() >= 1);
    }

    @Test
    void playerSafeCopyHasNoIp() {
        JsonObject entry = new JsonObject();
        entry.addProperty("player", "Friend");
        entry.addProperty("kind", "missing_mod");
        entry.addProperty("reason", "see 203.0.113.10 for help");
        JsonArray missing = new JsonArray();
        JsonObject m = new JsonObject();
        m.addProperty("mod_id", "create");
        m.addProperty("server_version", "6.0.0");
        missing.add(m);
        entry.add("missing", missing);
        entry.add("extra", new JsonArray());
        entry.add("wrong_version", new JsonArray());
        String copy = JoinClinicAnalyzer.buildPlayerSafeCopy(entry);
        assertFalse(copy.contains("203.0.113.10"));
        assertTrue(copy.contains("create"));
    }
}
