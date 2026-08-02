package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import org.junit.jupiter.api.Assumptions;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;

class DimensionStorageScannerTest {

    @TempDir
    Path temp;

    @Test
    void scan_findsVanillaLayout() throws Exception {
        Files.createDirectories(temp.resolve("world"));
        Files.createDirectories(temp.resolve("world/DIM-1"));
        Files.createDirectories(temp.resolve("world/DIM1"));
        Files.writeString(temp.resolve("world/level.dat"), "x".repeat(1024));
        Files.writeString(temp.resolve("world/DIM-1/level.dat"), "x".repeat(512));
        Files.writeString(temp.resolve("world/DIM1/level.dat"), "x".repeat(256));

        JsonObject storage = DimensionStorageScanner.scan(temp.toString(), true);
        Assumptions.assumeTrue(storage.has("by_dimension"),
                "du unavailable on this host — dimension scan requires du");
        JsonArray dims = storage.getAsJsonArray("by_dimension");
        assertFalse(dims.isEmpty());
        boolean hasOverworld = false;
        for (var el : dims) {
            JsonObject d = el.getAsJsonObject();
            if ("overworld".equals(d.get("id").getAsString())) {
                hasOverworld = true;
            }
        }
        assertTrue(hasOverworld);
    }

    @Test
    void scan_respectsDisabledFlag() {
        JsonObject storage = DimensionStorageScanner.scan(temp.toString(), false);
        assertFalse(storage.has("by_dimension"));
    }

    @Test
    void attachCategoryBreakdowns_listsModJarSizes() throws Exception {
        Path mods = temp.resolve("mods");
        Files.createDirectories(mods);
        Files.write(mods.resolve("create-6.0.1.jar"), new byte[2_000_000]);
        Files.write(mods.resolve("jei-19.jar"), new byte[500_000]);
        Files.write(mods.resolve("readme.txt"), "not a jar".getBytes());

        JsonObject result = new JsonObject();
        DimensionStorageScanner.attachCategoryBreakdowns(temp, result);

        assertTrue(result.has("by_mods"), "by_mods should list jar sizes without requiring du");
        assertTrue(result.has("mods_gb") || result.has("mods_bytes"));
        JsonArray byMods = result.getAsJsonArray("by_mods");
        assertEquals(2, byMods.size());
        assertEquals("create-6.0.1.jar", byMods.get(0).getAsJsonObject().get("label").getAsString());
        assertTrue(byMods.get(0).getAsJsonObject().get("gb").getAsDouble()
                >= byMods.get(1).getAsJsonObject().get("gb").getAsDouble());
    }
}
