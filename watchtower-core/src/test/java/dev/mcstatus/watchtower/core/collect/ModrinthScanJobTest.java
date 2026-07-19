package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import dev.mcstatus.watchtower.core.report.ReportConfig;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class ModrinthScanJobTest {
    @AfterEach
    void reset() {
        ModrinthLookupService.resetForTests();
    }

    @Test
    void disabledGateFailsWithoutHttp(@TempDir Path dir) throws Exception {
        Path reports = Files.createDirectories(dir.resolve("reports"));
        writeFacts(reports, "testmod", "test.jar");

        ModrinthScanJob.ScanResult result = ModrinthScanJob.run(dir.toString(),
                ReportConfig.builder().modrinthLookup(false).build(), reports, null);

        assertFalse(result.success());
        assertEquals(0, ModrinthLookupService.httpClientCreationsForTests());
    }

    @Test
    void writesStatusAndEmitsScanStages(@TempDir Path dir) throws Exception {
        Path mods = Files.createDirectories(dir.resolve("mods"));
        Path jar = mods.resolve("test.jar");
        Files.writeString(jar, "test mod", StandardCharsets.UTF_8);
        String hash = ModrinthLookupService.sha512Hex(jar);
        Path reports = Files.createDirectories(dir.resolve("reports"));
        Path facts = writeFacts(reports, "testmod", "test.jar");
        List<String> stages = new ArrayList<>();
        List<String> batches = new ArrayList<>();
        ModrinthLookupService.seedTransportForTests(new ModrinthLookupService.HttpTransport() {
            public String postJson(String url, String body) {
                return "{\"" + hash + "\":{\"project_id\":\"p1\",\"id\":\"v1\",\"version_number\":\"1.0\"}}";
            }
            public String getJson(String url) {
                return "[{\"id\":\"p1\",\"slug\":\"testmod\",\"client_side\":\"required\","
                        + "\"server_side\":\"unsupported\",\"title\":\"Test Mod\"}]";
            }
        });
        ModrinthScanProgress progress = new ModrinthScanProgress() {
            public void stage(String id, String label) { stages.add(id); }
            public void batch(int index, int count, int size) { batches.add(index + "/" + count + "/" + size); }
        };

        ModrinthScanJob.ScanResult result = ModrinthScanJob.run(dir.toString(),
                ReportConfig.builder().modrinthLookup(true).build(), reports, progress);

        assertTrue(result.success(), result.message());
        assertTrue(Files.isRegularFile(dir.resolve("watchtower").resolve(ModrinthScanJob.STATUS_FILENAME)));
        assertTrue(stages.contains("prepare"));
        assertTrue(stages.contains("hash"));
        assertTrue(stages.contains("cache"));
        assertTrue(stages.contains("version_files"));
        assertTrue(stages.contains("projects"));
        assertTrue(stages.contains("compat"));
        assertTrue(stages.contains("persist"));
        assertTrue(stages.contains("done"));
        assertEquals(List.of("1/1/1", "1/1/1"), batches);
        JsonObject patched = JsonParser.parseString(Files.readString(facts)).getAsJsonObject();
        assertEquals("testmod", patched.getAsJsonObject("optional").getAsJsonArray("mods")
                .get(0).getAsJsonObject().get("modrinth_slug").getAsString());
    }

    private static Path writeFacts(Path reports, String id, String jar) throws Exception {
        JsonObject root = new JsonObject();
        JsonObject meta = new JsonObject();
        meta.addProperty("loader", "neoforge");
        meta.addProperty("minecraft_version", "1.21.1");
        root.add("meta", meta);
        JsonObject optional = new JsonObject();
        JsonArray mods = new JsonArray();
        JsonObject mod = new JsonObject();
        mod.addProperty("id", id);
        mod.addProperty("version", "1.0");
        mod.addProperty("jar_file", jar);
        mods.add(mod);
        optional.add("mods", mods);
        root.add("optional", optional);
        Path facts = reports.resolve("watchtower-facts-test.json");
        Files.writeString(facts, root.toString());
        return facts;
    }
}
