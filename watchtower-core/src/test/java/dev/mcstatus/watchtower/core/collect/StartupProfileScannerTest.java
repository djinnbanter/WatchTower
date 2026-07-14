package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class StartupProfileScannerTest {

    private static final Path FIXTURES = Path.of("..", "samples", "fixtures", "crash-intelligence");

    @Test
    void bootLootProfile() throws Exception {
        List<String> lines = Files.readAllLines(resolve("boot-loot.log"));
        JsonObject profile = StartupProfileScanner.scan(lines);
        assertEquals(142.3, profile.get("total_sec").getAsDouble(), 0.05);
        assertEquals("warnings", profile.get("status").getAsString());
        assertTrue(profile.has("phases"));
        assertTrue(profile.has("slowest"));
        assertTrue(profile.getAsJsonArray("warnings").size() > 0);

        JsonArray errors = profile.getAsJsonArray("errors");
        boolean foundPride = false;
        for (var el : errors) {
            JsonObject e = el.getAsJsonObject();
            if ("pride".equals(e.get("mod_id").getAsString())) {
                foundPride = true;
                assertFalse(e.get("blocking").getAsBoolean(), "pride should be non-blocking after Done");
            }
        }
        assertTrue(foundPride, "expected pride boot error");
    }

    @Test
    void compareToLastBoot() throws Exception {
        List<String> lines = Files.readAllLines(resolve("boot-loot.log"));
        JsonObject profile = StartupProfileScanner.scan(lines, 130.0);
        assertTrue(profile.has("compare_to_last_boot"));
        JsonObject cmp = profile.getAsJsonObject("compare_to_last_boot");
        assertEquals("slower", cmp.get("direction").getAsString());
        assertEquals(12.3, cmp.get("delta_sec").getAsDouble(), 0.1);
    }

    @Test
    void extractLastBootIgnoresPostDoneNoise() throws Exception {
        List<String> boot = Files.readAllLines(resolve("boot-loot.log"));
        List<String> synthetic = new ArrayList<>(boot);
        synthetic.add("[13Jul2026 22:10:00.000] [Server thread/INFO] [net.minecraft.server.MinecraftServer/]: Someone said hello");
        synthetic.add("[13Jul2026 22:11:00.000] [Server thread/ERROR] [net.minecraft.world.item.ItemStack/]: Tried to load invalid item");
        List<String> window = StartupProfileScanner.extractLastBootWindow(synthetic);
        assertFalse(window.isEmpty());
        assertTrue(StartupProfileScanner.isDoneBootLine(window.get(window.size() - 1)));
        JsonObject profile = StartupProfileScanner.scan(window);
        assertNotEquals("failed", profile.get("status").getAsString());
        assertTrue(profile.has("total_sec"));
    }

    @Test
    void noDoneYieldsUnknownNotFailed() {
        List<String> lines = List.of(
                "[13Jul2026 22:10:00.000] [Server thread/INFO] [net.minecraft.server.MinecraftServer/]: Preparing spawn area",
                "[13Jul2026 22:11:00.000] [Server thread/INFO] [net.minecraft.server.MinecraftServer/]: Loading properties"
        );
        JsonObject profile = StartupProfileScanner.scan(lines);
        assertEquals("unknown", profile.get("status").getAsString());
        assertTrue(StartupProfileScanner.extractLastBootWindow(lines).isEmpty());
    }

    private static Path resolve(String name) {
        Path p = FIXTURES.resolve(name);
        if (!Files.isRegularFile(p)) {
            p = Path.of("samples", "fixtures", "crash-intelligence", name);
        }
        assertTrue(Files.isRegularFile(p), "missing fixture: " + name);
        return p;
    }
}
