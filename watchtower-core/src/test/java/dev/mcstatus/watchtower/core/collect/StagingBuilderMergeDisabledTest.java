package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class StagingBuilderMergeDisabledTest {

    @TempDir
    Path temp;

    @Test
    void updatesRunningRowWhenJarRenamedToDisabled() throws Exception {
        Path mods = temp.resolve("mods");
        Files.createDirectories(mods);
        Path jar = mods.resolve("dimmod-1.0.jar.disabled");
        try (ZipOutputStream zos = new ZipOutputStream(Files.newOutputStream(jar))) {
            zos.putNextEntry(new ZipEntry("META-INF/neoforge.mods.toml"));
            zos.write("""
                    modLoader="javafml"
                    loaderVersion="[1,)"
                    license="ARR"

                    [[mods]]
                    modId="dimmod"
                    version="1.0"
                    displayName="DimMod"
                    """.getBytes(StandardCharsets.UTF_8));
            zos.closeEntry();
        }

        JsonArray running = new JsonArray();
        JsonObject live = new JsonObject();
        live.addProperty("id", "dimmod");
        live.addProperty("display_name", "DimMod");
        live.addProperty("jar_file", "dimmod-1.0.jar");
        running.add(live);

        StagingBuilder.mergeDisabledJarsFromDisk(running, temp.toString());

        assertEquals(1, running.size(), "must not duplicate the mod id");
        JsonObject row = running.get(0).getAsJsonObject();
        assertEquals("dimmod-1.0.jar.disabled", row.get("jar_file").getAsString());
        assertTrue(row.get("disabled").getAsBoolean());
    }

    @Test
    void updatesRunningRowWhenDiskIdHasMandatoryCommentJunk() throws Exception {
        Path mods = temp.resolve("mods");
        Files.createDirectories(mods);
        Path jar = mods.resolve("AI-Improvements-1.21-0.5.3.jar.disabled");
        try (ZipOutputStream zos = new ZipOutputStream(Files.newOutputStream(jar))) {
            zos.putNextEntry(new ZipEntry("META-INF/neoforge.mods.toml"));
            zos.write("""
                    [[mods]]
                    modId="aiimprovements" #mandatory
                    version="${file.jarVersion}" #mandatory
                    displayName="AI-Improvements" #mandatory
                    """.getBytes(StandardCharsets.UTF_8));
            zos.closeEntry();
        }

        JsonArray running = new JsonArray();
        JsonObject live = new JsonObject();
        live.addProperty("id", "aiimprovements");
        live.addProperty("display_name", "AI Improvements");
        live.addProperty("version", "0.5.3");
        live.addProperty("jar_file", "AI-Improvements-1.21-0.5.3.jar");
        running.add(live);

        StagingBuilder.mergeDisabledJarsFromDisk(running, temp.toString());

        assertEquals(1, running.size(), "must not append a dirty-id twin");
        JsonObject row = running.get(0).getAsJsonObject();
        assertEquals("aiimprovements", row.get("id").getAsString());
        assertEquals("AI-Improvements-1.21-0.5.3.jar.disabled", row.get("jar_file").getAsString());
        assertTrue(row.get("disabled").getAsBoolean());
        assertEquals("AI Improvements", row.get("display_name").getAsString());
    }
}
