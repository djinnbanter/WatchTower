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
    void modernFixFullLoadPreferredOverVanillaDone() {
        List<String> lines = List.of(
                "[26Jul2026 16:40:11.870] [main/INFO] [cpw.mods.modlauncher.Launcher/MODLAUNCHER]: ModLauncher starting: java version 21",
                "[26Jul2026 16:40:36.537] [Server thread/INFO] [net.minecraft.server.dedicated.DedicatedServer/]: Starting minecraft server version 1.21.1",
                "[26Jul2026 16:40:37.209] [Server thread/INFO] [net.minecraft.server.dedicated.DedicatedServer/]: Preparing level \"world\"",
                "[26Jul2026 16:41:06.849] [Server thread/INFO] [net.minecraft.server.dedicated.DedicatedServer/]: Done (30.183s)! For help, type \"help\"",
                "[26Jul2026 16:41:39.339] [Server thread/WARN] [ModernFix/]: Dedicated server took 91.574 seconds to load"
        );
        List<String> window = StartupProfileScanner.extractLastBootWindow(lines);
        assertTrue(window.stream().anyMatch(StartupProfileScanner::isModernFixFullLoadLine));

        JsonObject profile = StartupProfileScanner.scan(window);
        assertEquals(91.6, profile.get("total_sec").getAsDouble(), 0.05);
        assertEquals("modernfix", profile.get("total_source").getAsString());
        assertEquals(30.2, profile.get("vanilla_done_sec").getAsDouble(), 0.05);
        assertEquals(91.6, profile.get("modernfix_sec").getAsDouble(), 0.05);
        // ModLauncher → Done wall clock (~55s), used for phase budget not headline when ModernFix exists
        assertTrue(profile.get("wall_clock_sec").getAsDouble() > 50.0);
        assertTrue(profile.get("wall_clock_sec").getAsDouble() < 60.0);
    }

    @Test
    void wallClockPreferredWhenVanillaDoneOmitsModLoading() {
        List<String> lines = List.of(
                "[26Jul2026 16:40:11.870] [main/INFO]: ModLauncher starting: java version 21",
                "[26Jul2026 16:40:36.537] [Server thread/INFO]: Starting minecraft server version 1.21.1",
                "[26Jul2026 16:40:37.209] [Server thread/INFO]: Preparing level \"world\"",
                "[26Jul2026 16:41:06.849] [Server thread/INFO]: Done (30.183s)! For help, type \"help\""
        );
        JsonObject profile = StartupProfileScanner.scan(lines);
        assertEquals("wall_clock", profile.get("total_source").getAsString());
        assertTrue(profile.get("total_sec").getAsDouble() > 50.0);
        assertEquals(30.2, profile.get("vanilla_done_sec").getAsDouble(), 0.05);
    }

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

    @Test
    void attachBootHistoryRollsAndCaps() {
        JsonObject prev = new JsonObject();
        prev.addProperty("total_sec", 120.0);
        prev.addProperty("done_at", "2026-07-01T10:00:00Z");
        prev.addProperty("status", "ok");

        JsonObject next = new JsonObject();
        next.addProperty("total_sec", 130.0);
        next.addProperty("done_at", "2026-07-02T10:00:00Z");
        next.addProperty("status", "warnings");

        StartupProfileScanner.attachBootHistory(next, prev);
        assertTrue(next.has("boot_history"));
        assertEquals(2, next.getAsJsonArray("boot_history").size());
        assertEquals(130.0, next.getAsJsonArray("boot_history").get(1).getAsJsonObject().get("total_sec").getAsDouble(), 0.01);

        JsonObject third = new JsonObject();
        third.addProperty("total_sec", 140.0);
        third.addProperty("done_at", "2026-07-03T10:00:00Z");
        third.addProperty("status", "ok");
        StartupProfileScanner.attachBootHistory(third, next);
        assertEquals(3, third.getAsJsonArray("boot_history").size());

        JsonObject withPhases = new JsonObject();
        withPhases.addProperty("total_sec", 100.0);
        withPhases.addProperty("done_at", "2026-07-04T10:00:00Z");
        withPhases.addProperty("status", "ok");
        JsonArray phases = new JsonArray();
        JsonObject phase = new JsonObject();
        phase.addProperty("id", "mod_init");
        phase.addProperty("label", "Mod initialization");
        phase.addProperty("sec", 40.0);
        phases.add(phase);
        withPhases.add("phases", phases);
        StartupProfileScanner.attachBootHistory(withPhases, third);
        JsonObject last = withPhases.getAsJsonArray("boot_history")
                .get(withPhases.getAsJsonArray("boot_history").size() - 1)
                .getAsJsonObject();
        assertTrue(last.has("phases"));
        assertEquals(1, last.getAsJsonArray("phases").size());
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
