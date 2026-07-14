package dev.mcstatus.watchtower.core.analyze;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;

class ConnectorHygieneScannerTest {

    @Test
    void warnsWhenConnectorPlusSodium() throws Exception {
        JsonArray mods = JsonParser.parseString(Files.readString(fixture("connector-sodium.json")))
                .getAsJsonObject().getAsJsonArray("mods");
        JsonArray warnings = ConnectorHygieneScanner.scan(mods);
        assertFalse(warnings.isEmpty());
        boolean hasSodium = false;
        for (var el : warnings) {
            if ("sodium".equals(el.getAsJsonObject().get("mod_id").getAsString())) {
                hasSodium = true;
            }
        }
        assertTrue(hasSodium);
        assertEquals("embeddium", warnings.get(0).getAsJsonObject().get("analogue_id").getAsString());
        assertEquals("Embeddium", warnings.get(0).getAsJsonObject().get("analogue_name").getAsString());
        assertTrue(warnings.get(0).getAsJsonObject().get("boot_only").getAsBoolean());
    }

    @Test
    void silentWithoutConnector() {
        JsonArray mods = new JsonArray();
        mods.add(mod("sodium", "0.5.8"));
        assertTrue(ConnectorHygieneScanner.scan(mods).isEmpty());
    }

    @Test
    void g05_doesNotChangeWatchdogClassification() {
        JsonArray mods = new JsonArray();
        mods.add(mod("connector", "1.0"));
        mods.add(mod("iris", "1.7"));
        JsonObject crash = new JsonObject();
        crash.addProperty("exception",
                "java.lang.Error: ServerHangWatchdog detected that a single server tick took 60.00 seconds");
        CrashClassifier.Classification c = CrashClassifier.classify(crash,
                new CrashClassifier.ClassifyContext(mods, null, false));
        assertEquals(CrashClassifier.FK_WATCHDOG, c.failureKind());
        assertFalse(ConnectorHygieneScanner.scan(mods).isEmpty());
    }

    private static JsonObject mod(String id, String version) {
        JsonObject o = new JsonObject();
        o.addProperty("id", id);
        o.addProperty("version", version);
        return o;
    }

    private static Path fixture(String name) {
        Path p = Path.of("..", "samples", "fixtures", "ca-parity", name);
        if (!Files.isRegularFile(p)) {
            p = Path.of("samples", "fixtures", "ca-parity", name);
        }
        return p;
    }
}
