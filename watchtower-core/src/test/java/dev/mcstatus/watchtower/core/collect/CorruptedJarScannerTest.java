package dev.mcstatus.watchtower.core.collect;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.jar.JarOutputStream;
import java.util.zip.ZipEntry;

import static org.junit.jupiter.api.Assertions.*;

class CorruptedJarScannerTest {

    @TempDir
    Path tmp;

    @Test
    void detectsZipEndHeaderInLog() throws Exception {
        Path fixture = Path.of("samples", "fixtures", "forensics", "corrupt-zip-boot.log");
        if (!Files.isRegularFile(fixture)) {
            fixture = Path.of("..", "samples", "fixtures", "forensics", "corrupt-zip-boot.log");
        }
        String text = Files.readString(fixture);
        List<CorruptedJarScanner.Hit> hits = CorruptedJarScanner.scanLogs(text);
        assertFalse(hits.isEmpty());
        assertEquals("zip_error", hits.get(0).reason());
        assertEquals("log_pattern", hits.get(0).source());
        assertNotNull(hits.get(0).path());
        assertTrue(hits.get(0).path().endsWith(".jar"));
    }

    @Test
    void validJarNotFlaggedByZipWalk() throws Exception {
        Path mods = tmp.resolve("mods");
        Files.createDirectories(mods);
        Path jar = mods.resolve("ok-1.0.jar");
        try (JarOutputStream jos = new JarOutputStream(Files.newOutputStream(jar))) {
            jos.putNextEntry(new ZipEntry("META-INF/MANIFEST.MF"));
            jos.write("Manifest-Version: 1.0\n".getBytes());
            jos.closeEntry();
        }
        assertTrue(CorruptedJarScanner.scanModsDir(mods).isEmpty());
    }

    @Test
    void emptyJarFlagged() throws Exception {
        Path mods = tmp.resolve("mods");
        Files.createDirectories(mods);
        Path empty = mods.resolve("broken-1.0.jar");
        Files.write(empty, new byte[0]);
        List<CorruptedJarScanner.Hit> hits = CorruptedJarScanner.scanModsDir(mods);
        assertEquals(1, hits.size());
        assertEquals("empty", hits.get(0).reason());
    }
}
