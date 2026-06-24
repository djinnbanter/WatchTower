package dev.mcstatus.watchtower.core.collect;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

import static org.junit.jupiter.api.Assertions.*;

class ModJarSideScannerTest {

    @Test
    void countsClientClasses(@TempDir Path temp) throws Exception {
        Path jar = temp.resolve("scanme.jar");
        try (ZipOutputStream zos = new ZipOutputStream(Files.newOutputStream(jar))) {
            zos.putNextEntry(new ZipEntry("net/minecraft/client/Minecraft.class"));
            zos.write(new byte[] { 1, 2, 3 });
            zos.closeEntry();
            zos.putNextEntry(new ZipEntry("com/example/MyMod.class"));
            zos.write(new byte[] { 1, 2 });
            zos.closeEntry();
        }
        ModJarSideScanner.ScanResult result = ModJarSideScanner.scan(jar);
        assertEquals(1, result.clientClasses());
        assertEquals(2, result.totalClasses());
        assertEquals(0.5, result.clientRatio(), 0.01);
    }
}
