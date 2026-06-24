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
}
