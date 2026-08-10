package dev.mcstatus.watchtower.core.collect;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ModJarMetadataCacheTest {

    @AfterEach
    void reset() {
        ModJarMetadataCache.get().resetForTests();
    }

    @Test
    void fingerprint_stable_for_same_jars(@TempDir Path mods) throws Exception {
        Path jar = mods.resolve("a.jar");
        Files.write(jar, new byte[]{1, 2, 3});
        String a = ModJarMetadataCache.fingerprintModsDir(mods);
        String b = ModJarMetadataCache.fingerprintModsDir(mods);
        assertEquals(a, b);
        assertTrue(a.contains("a.jar"));
    }

    @Test
    void cold_snapshot_is_empty_not_null() {
        ModJarMetadataCache.get().resetForTests();
        var s = ModJarMetadataCache.get().snapshot();
        assertFalse(s.ready());
        assertTrue(s.entries().isEmpty());
        assertTrue(ModJarMetadataCache.get().nestedIdToParentJar().isEmpty());
    }

    @Test
    void publish_then_invalidate_keeps_last_good() {
        ModJarMetadataCache cache = ModJarMetadataCache.get();
        cache.resetForTests();
        var nested = List.of(new ModJarMetadataReader.JarInJarEntry(
                "child", "1", "Child", "META-INF/jars/c.jar"));
        var parent = new ModJarMetadataReader.ModEntry(
                "parent", "1", "Parent", null, "neoforge", null, List.of(),
                "parent.jar", false, null, List.of(), nested);
        cache.publish("fp1", List.of(parent));
        assertEquals("parent.jar", cache.nestedIdToParentJar().get("child"));
        cache.invalidate("mutate");
        assertTrue(cache.isDirty());
        assertEquals("parent.jar", cache.nestedIdToParentJar().get("child"));
    }

    @Test
    void nestedIdToParentJar_cold_returns_empty_without_throwing() {
        ModJarMetadataCache.get().resetForTests();
        assertTrue(ModJarMetadataReader.nestedIdToParentJar(
                Path.of("definitely-missing-" + System.nanoTime()).toString()).isEmpty());
    }

    @Test
    void fingerprint_missing_dir_is_empty() {
        assertEquals("", ModJarMetadataCache.fingerprintModsDir(
                Path.of("no-such-mods-" + System.nanoTime())));
    }
}
