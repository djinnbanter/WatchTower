package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.report.ReportConfig;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

class ModrinthLookupServiceTest {

    @AfterEach
    void tearDown() {
        ModrinthLookupService.resetForTests();
    }

    @Test
    void disabledConfigReturnsEmptyAndCreatesNoHttpClient(@TempDir Path dir) throws Exception {
        Path jar = dir.resolve("mod.jar");
        Files.writeString(jar, "dummy");
        ReportConfig config = ReportConfig.builder().modrinthLookup(false).build();
        Map<String, ModrinthLookupService.SideInfo> out = ModrinthLookupService.lookup(
                List.of(new ModrinthLookupService.Candidate("mod", jar)),
                dir.resolve("cache.json"),
                config);
        assertTrue(out.isEmpty());
        assertEquals(0, ModrinthLookupService.httpClientCreationsForTests());
    }

    @Test
    void disasterRecoveryReturnsEmpty(@TempDir Path dir) throws Exception {
        Path jar = dir.resolve("mod.jar");
        Files.writeString(jar, "dummy");
        ReportConfig config = ReportConfig.builder()
                .modrinthLookup(true)
                .reportMode("dr")
                .build();
        Map<String, ModrinthLookupService.SideInfo> out = ModrinthLookupService.lookup(
                List.of(new ModrinthLookupService.Candidate("mod", jar)),
                dir.resolve("cache.json"),
                config);
        assertTrue(out.isEmpty());
        assertEquals(0, ModrinthLookupService.httpClientCreationsForTests());
    }

    @Test
    void cacheRoundTripPreservesVersionFields(@TempDir Path dir) throws Exception {
        Path jar = dir.resolve("mod.jar");
        Files.write(jar, "payload".getBytes(StandardCharsets.UTF_8));
        String hash = ModrinthLookupService.sha512Hex(jar);
        Path cache = dir.resolve("modrinth-cache.json");

        ModrinthLookupService.seedTransportForTests(new ModrinthLookupService.HttpTransport() {
            @Override
            public String postJson(String url, String body) {
                return "{\"" + hash + "\":{\"project_id\":\"abc\",\"id\":\"ver1\",\"version_number\":\"1.2.3\"}}";
            }

            @Override
            public String getJson(String url) {
                return "[{\"id\":\"abc\",\"slug\":\"testmod\",\"client_side\":\"required\","
                        + "\"server_side\":\"unsupported\",\"title\":\"Test Mod\"}]";
            }
        });

        ReportConfig config = ReportConfig.builder().modrinthLookup(true).build();
        Map<String, ModrinthLookupService.SideInfo> first = ModrinthLookupService.lookup(
                List.of(new ModrinthLookupService.Candidate("testmod", jar)),
                cache,
                config);
        assertEquals(1, first.size());
        ModrinthLookupService.SideInfo info = first.get(hash);
        assertEquals("required", info.clientSide());
        assertEquals("ver1", info.versionId());
        assertEquals("1.2.3", info.versionNumber());
        assertEquals("https://modrinth.com/mod/testmod", info.projectUrl());
        assertEquals("https://modrinth.com/mod/testmod/version/ver1", info.versionUrl());
        assertTrue(Files.isRegularFile(cache));

        ModrinthLookupService.resetForTests();
        Map<String, ModrinthLookupService.SideInfo> second = ModrinthLookupService.lookup(
                List.of(new ModrinthLookupService.Candidate("testmod", jar)),
                cache,
                config);
        assertEquals("required", second.get(hash).clientSide());
        assertEquals("ver1", second.get(hash).versionId());
        assertEquals(0, ModrinthLookupService.httpClientCreationsForTests());
    }

    @Test
    void applyIdentityWritesModrinthUrl() {
        JsonArray mods = new JsonArray();
        JsonObject mod = new JsonObject();
        mod.addProperty("id", "testmod");
        mods.add(mod);
        Map<String, ModrinthLookupService.SideInfo> byId = new HashMap<>();
        byId.put("testmod", new ModrinthLookupService.SideInfo(
                "abc", "testmod", "required", "unsupported", "Test Mod", false,
                "ver1", "1.2.3", false, null, null, null));
        ModrinthLookupService.applyIdentityToMods(mods, byId);
        JsonObject out = mods.get(0).getAsJsonObject();
        assertEquals("testmod", out.get("modrinth_slug").getAsString());
        assertEquals("https://modrinth.com/mod/testmod", out.get("modrinth_url").getAsString());
        assertEquals("https://modrinth.com/mod/testmod/version/ver1",
                out.get("modrinth_version_url").getAsString());
    }

    @Test
    void enrichCompatibleMarksOutdatedWhenHashDiffers(@TempDir Path dir) throws Exception {
        Path jar = dir.resolve("create.jar");
        Files.write(jar, "old-create".getBytes(StandardCharsets.UTF_8));
        String installedHash = ModrinthLookupService.sha512Hex(jar);

        ModrinthLookupService.seedTransportForTests(new ModrinthLookupService.HttpTransport() {
            @Override
            public String postJson(String url, String body) {
                return "{}";
            }

            @Override
            public String getJson(String url) {
                return "[{\"id\":\"newver\",\"version_number\":\"6.0.1\","
                        + "\"files\":[{\"primary\":true,\"hashes\":{\"sha512\":\"deadbeef\"}}]}]";
            }
        });

        Map<String, ModrinthLookupService.SideInfo> byId = new HashMap<>();
        byId.put("create", new ModrinthLookupService.SideInfo(
                "proj", "create", "optional", "required", "Create", false,
                "oldver", "6.0.0", false, null, null, null));
        Map<String, String> hashes = Map.of("create", installedHash);
        ModrinthLookupService.enrichCompatibleUpdates(
                byId, hashes, Set.of("create"), "neoforge", "1.21.1", 10);
        ModrinthLookupService.SideInfo updated = byId.get("create");
        assertTrue(updated.outdated());
        assertEquals("newver", updated.compatibleVersionId());
        assertEquals("6.0.1", updated.compatibleVersionNumber());
        assertTrue(updated.compatibleUrl().contains("/version/newver"));
    }
}
