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
                versionRange="[21.0,)"
                """);
        var entries = ModJarMetadataReader.readJar(jar);
        assertEquals(1, entries.size());
        assertFalse(entries.get(0).dependencies().isEmpty());
        var dep = entries.get(0).dependencies().get(0);
        assertEquals("neoforge", dep.modId());
        assertEquals("[21.0,)", dep.versionRange());
        JsonObject json = ModJarMetadataReader.toJson(entries.get(0));
        assertEquals("[21.0,)", json.getAsJsonArray("dependencies").get(0).getAsJsonObject()
                .get("versionRange").getAsString());
    }

    @Test
    void detectsMcreatorAndJarFile(@TempDir Path modsDir) throws IOException {
        Path jar = modsDir.resolve("mymod-1.0.jar");
        try (ZipOutputStream zos = new ZipOutputStream(Files.newOutputStream(jar))) {
            zos.putNextEntry(new ZipEntry("META-INF/neoforge.mods.toml"));
            zos.write("""
                    [[mods]]
                    modId="mymod"
                    version="1.0"
                    """.getBytes(StandardCharsets.UTF_8));
            zos.closeEntry();
            zos.putNextEntry(new ZipEntry("net/mcreator/mymod/Foo.class"));
            zos.write(new byte[] {1, 2, 3});
            zos.closeEntry();
        }
        var entries = ModJarMetadataReader.readJar(jar);
        assertEquals(1, entries.size());
        assertTrue(entries.get(0).mcreator());
        assertEquals("mymod-1.0.jar", entries.get(0).jarFile());
        JsonObject json = ModJarMetadataReader.toJson(entries.get(0));
        assertTrue(json.get("is_mcreator").getAsBoolean());
        assertEquals("mymod-1.0.jar", json.get("jar_file").getAsString());
    }

    @Test
    void detectsFabricInNeoForgeJar(@TempDir Path modsDir) throws IOException {
        Path jar = modsDir.resolve("fabriconly-1.0.jar");
        try (ZipOutputStream zos = new ZipOutputStream(Files.newOutputStream(jar))) {
            zos.putNextEntry(new ZipEntry("fabric.mod.json"));
            zos.write("{\"id\":\"fabriconly\"}".getBytes(StandardCharsets.UTF_8));
            zos.closeEntry();
        }
        var entries = ModJarMetadataReader.readJar(jar);
        assertEquals(1, entries.size());
        assertEquals("fabric_in_neoforge_jar", entries.get(0).loaderHint());
        assertEquals("fabric_in_neoforge_jar",
                ModJarMetadataReader.toJson(entries.get(0)).get("loader_hint").getAsString());
    }

    @Test
    void normalNeoJarHasNoSpecialFlags(@TempDir Path modsDir) throws IOException {
        Path jar = modsDir.resolve("normal-1.0.jar");
        writeJar(jar, """
                [[mods]]
                modId="normal"
                version="1.0"
                """);
        var entries = ModJarMetadataReader.readJar(jar);
        assertFalse(entries.get(0).mcreator());
        assertNull(entries.get(0).loaderHint());
        assertEquals("normal-1.0.jar", entries.get(0).jarFile());
    }

    @Test
    void extractsMixinConfigsFromJar(@TempDir Path modsDir) throws IOException {
        Path jar = modsDir.resolve("create-6.0.0.jar");
        try (ZipOutputStream zos = new ZipOutputStream(Files.newOutputStream(jar))) {
            zos.putNextEntry(new ZipEntry("META-INF/neoforge.mods.toml"));
            zos.write("""
                    [[mods]]
                    modId="create"
                    version="6.0.0"
                    [[mixins]]
                    config="create.mixins.json"
                    """.getBytes(StandardCharsets.UTF_8));
            zos.closeEntry();
            zos.putNextEntry(new ZipEntry("create.mixins.json"));
            zos.write("{\"required\":true}".getBytes(StandardCharsets.UTF_8));
            zos.closeEntry();
            zos.putNextEntry(new ZipEntry("data/create/mixins_fake.json"));
            zos.write("{}".getBytes(StandardCharsets.UTF_8));
            zos.closeEntry();
        }
        var entries = ModJarMetadataReader.readJar(jar);
        assertEquals(1, entries.size());
        assertTrue(entries.get(0).mixinConfigs().contains("create.mixins.json"));
        assertFalse(entries.get(0).mixinConfigs().stream().anyMatch(p -> p.startsWith("data/")));
        JsonObject json = ModJarMetadataReader.toJson(entries.get(0));
        assertTrue(json.has("mixin_configs"));
        assertTrue(json.getAsJsonArray("mixin_configs").size() >= 1);
    }

    @Test
    void jarWithoutMixinsHasEmptyArray(@TempDir Path modsDir) throws IOException {
        Path jar = modsDir.resolve("plain-1.0.jar");
        writeJar(jar, """
                [[mods]]
                modId="plain"
                version="1.0"
                """);
        JsonObject json = ModJarMetadataReader.toJson(ModJarMetadataReader.readJar(jar).get(0));
        assertTrue(json.has("mixin_configs"));
        assertEquals(0, json.getAsJsonArray("mixin_configs").size());
    }

    @Test
    void parsesNestedJarInJarOntoParent(@TempDir Path modsDir) throws IOException {
        Path jar = modsDir.resolve("create-6.0.0.jar");
        byte[] innerToml = """
                [[mods]]
                modId="flywheel"
                version="1.0.2"
                displayName="Flywheel"
                """.getBytes(StandardCharsets.UTF_8);
        byte[] innerJarBytes;
        try (java.io.ByteArrayOutputStream bos = new java.io.ByteArrayOutputStream();
             ZipOutputStream inner = new ZipOutputStream(bos)) {
            inner.putNextEntry(new ZipEntry("META-INF/neoforge.mods.toml"));
            inner.write(innerToml);
            inner.closeEntry();
            inner.finish();
            innerJarBytes = bos.toByteArray();
        }
        try (ZipOutputStream zos = new ZipOutputStream(Files.newOutputStream(jar))) {
            zos.putNextEntry(new ZipEntry("META-INF/neoforge.mods.toml"));
            zos.write("""
                    [[mods]]
                    modId="create"
                    version="6.0.0"
                    displayName="Create"
                    """.getBytes(StandardCharsets.UTF_8));
            zos.closeEntry();
            zos.putNextEntry(new ZipEntry("META-INF/jarjar/flywheel.jar"));
            zos.write(innerJarBytes);
            zos.closeEntry();
        }

        var entries = ModJarMetadataReader.readJar(jar);
        assertEquals(1, entries.size(), "nested jar must not be a top-level ModEntry");
        assertEquals("create", entries.get(0).id());
        assertEquals(1, entries.get(0).jarInJar().size());
        var nested = entries.get(0).jarInJar().get(0);
        assertEquals("flywheel", nested.id());
        assertEquals("Flywheel", nested.displayName());
        assertEquals("META-INF/jarjar/flywheel.jar", nested.nestedPath());

        JsonObject json = ModJarMetadataReader.toJson(entries.get(0));
        assertTrue(json.has("jar_in_jar"));
        assertTrue(json.has("nested_mod_ids"));
        assertEquals("flywheel", json.getAsJsonArray("nested_mod_ids").get(0).getAsString());
        assertEquals("flywheel",
                json.getAsJsonArray("jar_in_jar").get(0).getAsJsonObject().get("id").getAsString());
    }

    @Test
    void listModsFromDirIncludesDisabledJar(@TempDir Path server) throws IOException {
        Path mods = server.resolve("mods");
        Files.createDirectories(mods);
        writeJar(mods.resolve("appleskin-3.0.9.jar.disabled"), """
                [[mods]]
                modId="appleskin"
                version="3.0.9"
                displayName="AppleSkin"
                """);
        JsonArray arr = ModJarMetadataReader.listModsFromDir(server.toString());
        assertEquals(1, arr.size());
        JsonObject mod = arr.get(0).getAsJsonObject();
        assertEquals("appleskin", mod.get("id").getAsString());
        assertEquals("appleskin-3.0.9.jar.disabled", mod.get("jar_file").getAsString());
        assertTrue(mod.get("disabled").getAsBoolean());
    }

    @Test
    void listModsFromDirEnabledHasDisabledFalse(@TempDir Path server) throws IOException {
        Path mods = server.resolve("mods");
        Files.createDirectories(mods);
        writeJar(mods.resolve("appleskin-3.0.9.jar"), """
                [[mods]]
                modId="appleskin"
                version="3.0.9"
                displayName="AppleSkin"
                """);
        JsonObject mod = ModJarMetadataReader.listModsFromDir(server.toString()).get(0).getAsJsonObject();
        assertFalse(mod.get("disabled").getAsBoolean());
    }

    @Test
    void stripsMandatoryCommentsAndPlaceholders(@TempDir Path modsDir) throws IOException {
        Path jar = modsDir.resolve("AI-Improvements-1.21-0.5.3.jar.disabled");
        writeJar(jar, """
                modLoader="javafml" #mandatory
                loaderVersion="[1,)" #mandatory
                license="All Rights Reserved"

                [[mods]]
                modId="aiimprovements" #mandatory
                version="${file.jarVersion}" #mandatory
                displayName="AI-Improvements" #mandatory
                """);
        var entries = ModJarMetadataReader.readJar(jar);
        assertEquals(1, entries.size());
        assertEquals("aiimprovements", entries.get(0).id());
        assertEquals("AI-Improvements", entries.get(0).displayName());
        assertFalse(entries.get(0).version().contains("${"));
        assertFalse(entries.get(0).version().contains("#"));
        JsonObject json = ModJarMetadataReader.toJson(entries.get(0));
        assertTrue(json.get("disabled").getAsBoolean());
    }

    @Test
    void parseTomlScalarStripsInlineComments() {
        assertEquals("aiimprovements", ModJarMetadataReader.parseTomlScalar("\"aiimprovements\" #mandatory"));
        assertEquals("AI-Improvements", ModJarMetadataReader.parseTomlScalar("\"AI-Improvements\" #mandatory"));
        assertEquals("${file.jarVersion}", ModJarMetadataReader.parseTomlScalar("\"${file.jarVersion}\" #mandatory"));
        assertEquals("has # inside", ModJarMetadataReader.parseTomlScalar("\"has # inside\""));
    }

    private static void writeJar(Path jar, String toml) throws IOException {
        try (ZipOutputStream zos = new ZipOutputStream(Files.newOutputStream(jar))) {
            zos.putNextEntry(new ZipEntry("META-INF/neoforge.mods.toml"));
            zos.write(toml.getBytes(StandardCharsets.UTF_8));
            zos.closeEntry();
        }
    }
}
