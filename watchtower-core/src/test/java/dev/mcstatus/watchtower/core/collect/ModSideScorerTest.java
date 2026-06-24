package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.report.ReportConfig;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import static org.junit.jupiter.api.Assertions.*;

class ModSideScorerTest {

    @Test
    void flagsKnownClientModAsLikelyRemovable() {
        JsonObject optional = new JsonObject();
        JsonArray mods = new JsonArray();
        JsonObject mod = new JsonObject();
        mod.addProperty("id", "modmenu");
        mod.addProperty("version", "1.0");
        mods.add(mod);
        optional.add("mods", mods);

        ModSideScorer.apply(optional, ReportConfig.builder().build(), "");
        JsonObject entry = optional.getAsJsonArray("client_only_mods").get(0).getAsJsonObject();
        assertEquals("likely_removable", entry.get("bucket").getAsString());
        assertEquals("medium", entry.get("confidence").getAsString());
        assertTrue(entry.has("signals"));
    }

    @Test
    void unknownModWithLogWarningsCanScore(@TempDir Path server) throws Exception {
        Path mods = server.resolve("mods");
        Files.createDirectories(mods);
        try (ZipOutputStream zos = new ZipOutputStream(Files.newOutputStream(mods.resolve("mystery-1.0.jar")))) {
            zos.putNextEntry(new ZipEntry("META-INF/neoforge.mods.toml"));
            zos.write("""
                    [[mods]]
                    modId="mystery"
                    version="1.0"
                    displayName="Mystery"
                    description="Client HUD overlay"
                    """.getBytes(StandardCharsets.UTF_8));
            zos.closeEntry();
        }

        JsonObject optional = new JsonObject();
        JsonArray modsArr = ModJarMetadataReader.listModsFromDir(server.toString());
        optional.add("mods", modsArr);

        JsonArray warnings = new JsonArray();
        JsonObject warn = new JsonObject();
        warn.addProperty("mod_id", "mystery");
        warn.addProperty("count", 3);
        optional.add("client_class_warnings_by_mod", warnings);

        ModSideScorer.apply(optional, ReportConfig.builder().build(), server.toString());
        assertTrue(optional.has("client_only_mods"));
    }

    @Test
    void lowSignalModLandsInTestRemove() {
        JsonObject optional = new JsonObject();
        JsonArray mods = new JsonArray();
        JsonObject mod = new JsonObject();
        mod.addProperty("id", "unknownclientmod");
        mod.addProperty("version", "?");
        mods.add(mod);
        optional.add("mods", mods);

        ModSideScorer.apply(optional, ReportConfig.builder().build(), "");
        assertFalse(optional.has("client_only_mods"),
                "Mods with no client signals should not appear in client_only_mods");
    }
}
