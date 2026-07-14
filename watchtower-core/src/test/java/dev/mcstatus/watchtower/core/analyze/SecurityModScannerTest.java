package dev.mcstatus.watchtower.core.analyze;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;

class SecurityModScannerTest {

    @Test
    void flagsIrlandaCore() throws Exception {
        JsonArray mods = JsonParser.parseString(Files.readString(fixture("irlandacore-present.json")))
                .getAsJsonObject().getAsJsonArray("mods");
        JsonArray flags = SecurityModScanner.scan(mods);
        assertEquals(1, flags.size());
        assertEquals("irlandacore", flags.get(0).getAsJsonObject().get("mod_id").getAsString());
        assertEquals("SECURITY_BACKDOOR_MOD", flags.get(0).getAsJsonObject().get("flag").getAsString());
        assertEquals("critical", flags.get(0).getAsJsonObject().get("severity").getAsString());
    }

    @Test
    void emptyWhenClean() {
        JsonArray mods = new JsonArray();
        JsonObject m = new JsonObject();
        m.addProperty("id", "create");
        mods.add(m);
        assertTrue(SecurityModScanner.scan(mods).isEmpty());
    }

    @Test
    void securityDoesNotReplaceWatchdogKind() throws Exception {
        JsonArray mods = JsonParser.parseString(Files.readString(fixture("irlandacore-present.json")))
                .getAsJsonObject().getAsJsonArray("mods");
        JsonObject crash = new JsonObject();
        crash.addProperty("exception",
                "java.lang.Error: ServerHangWatchdog detected that a single server tick took 60.00 seconds");
        CrashClassifier.Classification c = CrashClassifier.classify(crash,
                new CrashClassifier.ClassifyContext(mods, null, false));
        assertEquals(CrashClassifier.FK_WATCHDOG, c.failureKind());
        assertFalse(SecurityModScanner.scan(mods).isEmpty());
    }

    private static Path fixture(String name) {
        Path p = Path.of("..", "samples", "fixtures", "ca-parity", name);
        if (!Files.isRegularFile(p)) {
            p = Path.of("samples", "fixtures", "ca-parity", name);
        }
        return p;
    }
}
