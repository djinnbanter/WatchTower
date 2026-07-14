package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.jar.JarOutputStream;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import static org.junit.jupiter.api.Assertions.*;

class JarClassIndexTest {

    @TempDir
    Path tmp;

    @Test
    void findsClassByFqnAndSimpleName() throws Exception {
        Path mods = tmp.resolve("mods");
        Files.createDirectories(mods);
        Path jar = mods.resolve("create-6.0.4.jar");
        writeJarWithClass(jar, "com/simibubi/create/content/kinetics/ContraptionHandler.class");

        JsonArray modsJson = new JsonArray();
        JsonObject create = new JsonObject();
        create.addProperty("id", "create");
        create.addProperty("jar_file", "create-6.0.4.jar");
        modsJson.add(create);

        Path cache = tmp.resolve("watchtower").resolve("forensics-cache.json");
        JarClassIndex index = JarClassIndex.build(mods, modsJson, cache);
        assertFalse(index.stats().fromCache());
        assertEquals(1, index.stats().jarCount());
        assertTrue(index.stats().entryCount() >= 1);

        List<JarClassIndex.Match> byFqn = index.findClass(
                "com.simibubi.create.content.kinetics.ContraptionHandler", true);
        assertEquals(1, byFqn.size());
        assertEquals("create", byFqn.get(0).modId());
        assertEquals("create-6.0.4.jar", byFqn.get(0).jar());

        List<JarClassIndex.Match> bySimple = index.findClass("ContraptionHandler", true);
        assertFalse(bySimple.isEmpty());
        assertEquals("create", bySimple.get(0).modId());

        // cache hit
        JarClassIndex cached = JarClassIndex.build(mods, modsJson, cache);
        assertTrue(cached.stats().fromCache());
        assertEquals(1, cached.findClass("com/simibubi/create/content/kinetics/ContraptionHandler", true).size());
        assertEquals(1, JarClassIndex.loadCached(mods, cache).stats().jarCount());
        assertNotNull(JarClassIndex.peekCacheStats(cache));
    }

    @Test
    void findsNestedJarClassOneLevel() throws Exception {
        Path mods = tmp.resolve("mods");
        Files.createDirectories(mods);
        Path jar = mods.resolve("wrapper-1.0.jar");
        try (JarOutputStream jos = new JarOutputStream(Files.newOutputStream(jar))) {
            jos.putNextEntry(new ZipEntry("META-INF/jarjar/inner.jar"));
            byte[] nested = nestedJarBytes("com/example/InnerClass.class");
            jos.write(nested);
            jos.closeEntry();
        }
        JsonArray modsJson = new JsonArray();
        JsonObject mod = new JsonObject();
        mod.addProperty("id", "wrapper");
        mod.addProperty("jar_file", "wrapper-1.0.jar");
        modsJson.add(mod);

        JarClassIndex index = JarClassIndex.build(mods, modsJson, null);
        List<JarClassIndex.Match> matches = index.findClass("com.example.InnerClass", true);
        assertFalse(matches.isEmpty());
        assertTrue(matches.get(0).innerPath().contains("!/"));
        assertTrue(matches.get(0).innerPath().contains("inner.jar"));

        assertTrue(index.findClass("com.example.InnerClass", false).isEmpty(),
                "include_nested=false must hide nested matches");
    }

    @Test
    void packagePrefixLookup() throws Exception {
        Path mods = tmp.resolve("mods");
        Files.createDirectories(mods);
        writeJarWithClass(mods.resolve("example-1.jar"), "com/example/mod/Foo.class");
        JsonArray modsJson = new JsonArray();
        JsonObject mod = new JsonObject();
        mod.addProperty("id", "example");
        mod.addProperty("jar_file", "example-1.jar");
        modsJson.add(mod);
        JarClassIndex index = JarClassIndex.build(mods, modsJson, null);
        assertFalse(index.findPackage("com.example", "prefix").isEmpty());
        assertFalse(index.findPackage("com/example/mod", "exact_package").isEmpty());
    }

    private static void writeJarWithClass(Path jar, String classEntry) throws Exception {
        try (JarOutputStream jos = new JarOutputStream(Files.newOutputStream(jar))) {
            jos.putNextEntry(new ZipEntry(classEntry));
            jos.write(new byte[] {(byte) 0xCA, (byte) 0xFE, (byte) 0xBA, (byte) 0xBE});
            jos.closeEntry();
        }
    }

    private static byte[] nestedJarBytes(String classEntry) throws Exception {
        Path nested = Files.createTempFile("nested", ".jar");
        try {
            writeJarWithClass(nested, classEntry);
            return Files.readAllBytes(nested);
        } finally {
            Files.deleteIfExists(nested);
        }
    }
}
