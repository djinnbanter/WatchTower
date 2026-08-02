package dev.mcstatus.watchtower.core.analyze;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Set;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import static org.junit.jupiter.api.Assertions.*;

class WorldRiskAnalyzerTest {

    @Test
    void worldDimensionFolderIsHighRisk(@TempDir Path server) throws IOException {
        Path dim = server.resolve("world/dimensions/dimmod/foo");
        Files.createDirectories(dim);
        Files.writeString(dim.resolve("dummy.txt"), "x");
        JsonObject risk = WorldRiskAnalyzer.evaluateMod("dimmod", server, null, Set.of());
        assertEquals("high", risk.get("level").getAsString());
        String reasons = risk.getAsJsonArray("reasons").toString();
        assertTrue(reasons.contains("world_dimension_folders"));
        assertTrue(risk.getAsJsonArray("not_checked").toString().contains("block_entity_nbt_scan"));
    }

    @Test
    void jarDimensionDataIsHighRisk(@TempDir Path server) throws IOException {
        Path mods = server.resolve("mods");
        Files.createDirectories(mods);
        Path jar = mods.resolve("dimmod-1.0.jar");
        try (ZipOutputStream zos = new ZipOutputStream(Files.newOutputStream(jar))) {
            zos.putNextEntry(new ZipEntry("META-INF/neoforge.mods.toml"));
            zos.write("""
                    [[mods]]
                    modId="dimmod"
                    version="1.0"
                    """.getBytes(StandardCharsets.UTF_8));
            zos.closeEntry();
            zos.putNextEntry(new ZipEntry("data/dimmod/dimension/bar.json"));
            zos.write("{}".getBytes(StandardCharsets.UTF_8));
            zos.closeEntry();
        }
        JsonObject risk = WorldRiskAnalyzer.evaluateMod("dimmod", server, jar, Set.of());
        assertEquals("high", risk.get("level").getAsString());
        assertTrue(risk.getAsJsonArray("reasons").toString().contains("declares_dimension_data"));
    }

    @Test
    void liveDimensionNamespaceIsHighRisk(@TempDir Path server) {
        JsonObject risk = WorldRiskAnalyzer.evaluateMod(
                "rftoolsdim", server, null, Set.of("rftoolsdim:empty"));
        assertEquals("high", risk.get("level").getAsString());
        assertTrue(risk.getAsJsonArray("reasons").toString().contains("live_dimension"));
    }

    @Test
    void plainModIsNone(@TempDir Path server) throws IOException {
        Files.createDirectories(server.resolve("world"));
        JsonObject risk = WorldRiskAnalyzer.evaluateMod("appleskin", server, null, Set.of());
        assertEquals("none", risk.get("level").getAsString());
        assertEquals(0, risk.getAsJsonArray("reasons").size());
    }

    @Test
    void attachToModsMutatesArray(@TempDir Path server) throws IOException {
        Path dim = server.resolve("world/dimensions/dimmod/foo");
        Files.createDirectories(dim);
        JsonArray mods = new JsonArray();
        JsonObject mod = new JsonObject();
        mod.addProperty("id", "dimmod");
        mod.addProperty("jar_file", "dimmod-1.0.jar");
        mods.add(mod);
        WorldRiskAnalyzer.attachToMods(mods, server, Set.of());
        assertTrue(mods.get(0).getAsJsonObject().has("world_risk"));
        assertEquals("high",
                mods.get(0).getAsJsonObject().getAsJsonObject("world_risk").get("level").getAsString());
    }
}
