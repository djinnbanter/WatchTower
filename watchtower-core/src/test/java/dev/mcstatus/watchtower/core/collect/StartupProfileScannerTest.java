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

        double total = profile.get("total_sec").getAsDouble();
        JsonArray phases = profile.getAsJsonArray("phases");
        for (var el : phases) {
            JsonObject p = el.getAsJsonObject();
            if (p.has("sec") && !p.get("sec").isJsonNull()) {
                double sec = p.get("sec").getAsDouble();
                assertTrue(Double.isFinite(sec), "phase sec must be finite: " + p);
                assertTrue(sec <= total * 1.01 + 0.05, "phase sec must not exceed total: " + p);
            }
        }
    }

    @Test
    void unparseablePhaseTimestampDoesNotInventUnixDuration() {
        List<String> lines = List.of(
                "[14Jul2026 11:26:40.000] [main/INFO]: ModLauncher starting: java version 21",
                "[14Jul2026 11:26:50.000] [main/INFO]: Freezing registries",
                "[14Jul2026 11:26:51.000] [main/INFO]: Common setup complete via FMLCommonSetupEvent",
                // No leading MC timestamp — old bug treated line index as epoch → ~1.78e9s
                "Couldn't parse element ResourceKey[minecraft:loot_table / foo]",
                "[14Jul2026 11:27:00.000] [Server thread/INFO]: Starting Minecraft server on *:25565",
                "[14Jul2026 11:27:08.000] [Server thread/INFO]: Done (28.3s)! For help, type \"help\""
        );
        JsonObject profile = StartupProfileScanner.scan(lines);
        assertEquals(28.3, profile.get("total_sec").getAsDouble(), 0.05);

        JsonArray phases = profile.getAsJsonArray("phases");
        assertFalse(phases.isEmpty());
        for (var el : phases) {
            JsonObject p = el.getAsJsonObject();
            if (!p.has("sec") || p.get("sec").isJsonNull()) {
                continue;
            }
            double sec = p.get("sec").getAsDouble();
            assertTrue(sec < 1_000_000, "phase must not use line-index-as-epoch: " + p + " sec=" + sec);
            assertTrue(sec <= 28.3 * 1.01 + 0.05, "phase sec capped by total: " + p);
        }

        boolean foundDatapack = false;
        for (var el : phases) {
            JsonObject p = el.getAsJsonObject();
            if ("datapack_load".equals(p.get("id").getAsString())) {
                foundDatapack = true;
                assertTrue(p.has("sec"), "datapack should get remaining-budget sec");
                assertTrue(p.get("sec").getAsDouble() < 100, "datapack remaining budget must be sane");
            }
        }
        assertTrue(foundDatapack, "expected datapack_load phase");
    }

    @Test
    void constructPhaseFirstHitOnly() {
        List<String> lines = List.of(
                "[14Jul2026 11:26:40.000] [main/INFO]: ModLauncher starting: java version 21",
                "[14Jul2026 11:26:50.000] [main/INFO]: Freezing registries",
                "[14Jul2026 11:26:51.000] [main/INFO]: Common setup complete via FMLCommonSetupEvent",
                "[14Jul2026 11:26:55.000] [modloading-worker-0/INFO]: Still constructing something",
                "[14Jul2026 11:27:00.000] [Server thread/INFO]: Preparing start region for dimension minecraft:overworld",
                "[14Jul2026 11:27:08.000] [Server thread/INFO]: Done (28.3s)! For help, type \"help\""
        );
        JsonObject profile = StartupProfileScanner.scan(lines);
        JsonArray phases = profile.getAsJsonArray("phases");
        int constructCount = 0;
        for (var el : phases) {
            if ("construct".equals(el.getAsJsonObject().get("id").getAsString())) {
                constructCount++;
            }
        }
        assertEquals(1, constructCount, "construct must appear once (first hit wins)");
    }

    @Test
    void stderrPrefixedTimestampStillParsesForPhases() {
        List<String> lines = List.of(
                "[stderr] [14Jul2026 11:26:40.000] [main/INFO]: ModLauncher starting",
                "[14Jul2026 11:26:50.000] [main/INFO]: Freezing registries",
                "[14Jul2026 11:27:00.000] [Server thread/INFO]: Preparing start region for dimension minecraft:overworld",
                "[14Jul2026 11:27:08.000] [Server thread/INFO]: Done (28.0s)! For help, type \"help\""
        );
        JsonObject profile = StartupProfileScanner.scan(lines);
        assertEquals(28.0, profile.get("total_sec").getAsDouble(), 0.05);
        JsonArray phases = profile.getAsJsonArray("phases");
        JsonObject construct = null;
        for (var el : phases) {
            JsonObject p = el.getAsJsonObject();
            if ("construct".equals(p.get("id").getAsString())) {
                construct = p;
            }
        }
        assertNotNull(construct);
        assertTrue(construct.has("sec"));
        assertEquals(10.0, construct.get("sec").getAsDouble(), 0.2);
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
