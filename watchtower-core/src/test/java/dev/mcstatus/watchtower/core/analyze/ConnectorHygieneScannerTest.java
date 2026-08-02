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
    void warnsWhenConnectorPresent() throws Exception {
        JsonArray mods = JsonParser.parseString(Files.readString(fixture("connector-sodium.json")))
                .getAsJsonObject().getAsJsonArray("mods");
        JsonArray warnings = ConnectorHygieneScanner.scan(mods);
        assertEquals(1, warnings.size());
        JsonObject row = warnings.get(0).getAsJsonObject();
        assertEquals("connector", row.get("mod_id").getAsString());
        assertEquals("connector_present", row.get("kind").getAsString());
        assertTrue(row.get("boot_only").getAsBoolean());
        assertFalse(row.get("blocking").getAsBoolean());
        assertTrue(row.get("message").getAsString().toLowerCase().contains("unstable"));
        assertFalse(row.has("analogue_name"));
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
