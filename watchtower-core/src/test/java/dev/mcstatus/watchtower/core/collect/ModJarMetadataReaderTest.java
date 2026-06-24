package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import static org.junit.jupiter.api.Assertions.*;

class ModJarMetadataReaderTest {

    @Test
    void readsTomlFromJar(@TempDir Path modsDir) throws IOException {
        Path jar = modsDir.resolve("testmod-1.0.0.jar");
        writeJar(jar, """
                [[mods]]
                modId="testmod"
                version="1.0.0"
                displayName="Test Mod"
                description="Minimap for client"
                """);
        var entries = ModJarMetadataReader.readJar(jar);
        assertEquals(1, entries.size());
        assertEquals("testmod", entries.get(0).id());
        assertEquals("Test Mod", entries.get(0).displayName());
    }

    @Test
    void listModsFromDirUsesToml(@TempDir Path server) throws IOException {
        Path mods = server.resolve("mods");
        Files.createDirectories(mods);
        writeJar(mods.resolve("appleskin-3.0.9.jar"), """
                [[mods]]
                modId="appleskin"
                version="3.0.9"
                displayName="AppleSkin"
                """);
        JsonArray arr = ModJarMetadataReader.listModsFromDir(server.toString());
        assertEquals(1, arr.size());
        JsonObject mod = arr.get(0).getAsJsonObject();
        assertEquals("appleskin", mod.get("id").getAsString());
        assertEquals("AppleSkin", mod.get("display_name").getAsString());
    }

    @Test
    void parseTomlModsExtractsDependencies(@TempDir Path modsDir) throws IOException {
        Path jar = modsDir.resolve("mymod-1.0.jar");
        writeJar(jar, """
                [[mods]]
                modId="mymod"
                version="1.0"
                [[dependencies.mymod]]
                modId="neoforge"
                type="required"
                mandatory=true
                """);
        var entries = ModJarMetadataReader.readJar(jar);
        assertEquals(1, entries.size());
        assertFalse(entries.get(0).dependencies().isEmpty());
        assertEquals("neoforge", entries.get(0).dependencies().get(0).modId());
    }

    private static void writeJar(Path jar, String toml) throws IOException {
        try (ZipOutputStream zos = new ZipOutputStream(Files.newOutputStream(jar))) {
            zos.putNextEntry(new ZipEntry("META-INF/neoforge.mods.toml"));
            zos.write(toml.getBytes(StandardCharsets.UTF_8));
            zos.closeEntry();
        }
    }
}
