package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.report.ReportConfig;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.jar.JarOutputStream;
import java.util.zip.ZipEntry;

import static org.junit.jupiter.api.Assertions.*;

class ModsDeepAnalyzerTest {

    @TempDir
    Path tmp;

    @Test
    void seedBuildsIndexAndLedgerShape() throws Exception {
        Path mods = tmp.resolve("mods");
        Files.createDirectories(mods);
        Path jar = mods.resolve("alpha-1.0.jar");
        writeJarWithClass(jar, "com/example/Alpha.class");

        ReportConfig config = ReportConfig.builder()
                .serverDir(tmp.toString())
                .modForensicsScan(true)
                .modsDeepOnJarChange(true)
                .forensicsCorruptJarWalk(false)
                .build();

        JsonObject first = ModsDeepAnalyzer.analyze(tmp.toString(), config, "boot_seed");
        assertEquals("ok", first.get("status").getAsString());
        assertTrue(first.has("class_index"));
        assertEquals(1, first.getAsJsonObject("class_index").get("jars_rebuilt").getAsInt());

        // Second pass should reuse fingerprint cache (0 rebuilt if unchanged).
        JsonObject second = ModsDeepAnalyzer.analyze(tmp.toString(), config, "jar_change");
        assertEquals("ok", second.get("status").getAsString());
        assertEquals(0, second.getAsJsonObject("class_index").get("jars_rebuilt").getAsInt());
        assertTrue(second.getAsJsonObject("class_index").get("jars_reused").getAsInt() >= 1
                || second.getAsJsonObject("class_index").get("from_cache").getAsBoolean());
    }

    @Test
    void killSwitchSkipsWhenForensicsOff() {
        ReportConfig config = ReportConfig.builder()
                .serverDir(tmp.toString())
                .modForensicsScan(false)
                .build();
        JsonObject out = ModsDeepAnalyzer.analyze(tmp.toString(), config, "jar_change");
        assertEquals("skipped", out.get("status").getAsString());
    }

    private static void writeJarWithClass(Path jar, String classPath) throws Exception {
        try (OutputStream os = Files.newOutputStream(jar);
             JarOutputStream jos = new JarOutputStream(os)) {
            jos.putNextEntry(new ZipEntry(classPath));
            jos.write(new byte[]{(byte) 0xCA, (byte) 0xFE, (byte) 0xBA, (byte) 0xBE});
            jos.closeEntry();
        }
    }
}
