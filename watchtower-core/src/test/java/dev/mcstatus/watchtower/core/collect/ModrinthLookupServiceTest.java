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
                "ver1", "1.2.3", false, null, null, null,
                "https://wiki.example", "https://src.example", "https://issues.example",
                "https://discord.gg/example", "https://cdn.modrinth.com/icon.png",
                "A short description"));
        ModrinthLookupService.applyIdentityToMods(mods, byId);
        JsonObject out = mods.get(0).getAsJsonObject();
        assertEquals("testmod", out.get("modrinth_slug").getAsString());
        assertEquals("https://modrinth.com/mod/testmod", out.get("modrinth_url").getAsString());
        assertEquals("https://modrinth.com/mod/testmod/version/ver1",
                out.get("modrinth_version_url").getAsString());
        assertEquals("https://wiki.example", out.get("modrinth_wiki_url").getAsString());
        assertEquals("https://src.example", out.get("modrinth_source_url").getAsString());
        assertEquals("https://issues.example", out.get("modrinth_issues_url").getAsString());
        assertEquals("https://discord.gg/example", out.get("modrinth_discord_url").getAsString());
        assertEquals("https://cdn.modrinth.com/icon.png", out.get("modrinth_icon_url").getAsString());
        assertEquals("A short description", out.get("modrinth_description").getAsString());
    }

    @Test
    void lookupParsesProjectLinkFieldsAndCaches(@TempDir Path dir) throws Exception {
        Path jar = dir.resolve("linked.jar");
        Files.write(jar, "linked-payload".getBytes(StandardCharsets.UTF_8));
        String hash = ModrinthLookupService.sha512Hex(jar);
        Path cache = dir.resolve("modrinth-cache.json");

        ModrinthLookupService.seedTransportForTests(new ModrinthLookupService.HttpTransport() {
            @Override
            public String postJson(String url, String body) {
                return "{\"" + hash + "\":{\"project_id\":\"proj1\",\"id\":\"ver9\",\"version_number\":\"9.9.9\"}}";
            }

            @Override
            public String getJson(String url) {
                return "[{\"id\":\"proj1\",\"slug\":\"linkedmod\",\"client_side\":\"optional\","
                        + "\"server_side\":\"required\",\"title\":\"Linked Mod\","
                        + "\"wiki_url\":\"https://wiki.linked\",\"source_url\":\"https://github.com/linked\","
                        + "\"issues_url\":\"https://github.com/linked/issues\","
                        + "\"discord_url\":\"https://discord.gg/linked\","
                        + "\"icon_url\":\"https://cdn.modrinth.com/data/proj1/icon.png\","
                        + "\"description\":\"Linked mod description text\"}]";
            }
        });

        ReportConfig config = ReportConfig.builder().modrinthLookup(true).build();
        Map<String, ModrinthLookupService.SideInfo> first = ModrinthLookupService.lookup(
                List.of(new ModrinthLookupService.Candidate("linkedmod", jar)),
                cache,
                config);
        ModrinthLookupService.SideInfo info = first.get(hash);
        assertEquals("https://wiki.linked", info.wikiUrl());
        assertEquals("https://github.com/linked", info.sourceUrl());
        assertEquals("https://github.com/linked/issues", info.issuesUrl());
        assertEquals("https://discord.gg/linked", info.discordUrl());
        assertEquals("https://cdn.modrinth.com/data/proj1/icon.png", info.iconUrl());
        assertEquals("Linked mod description text", info.description());

        ModrinthLookupService.resetForTests();
        Map<String, ModrinthLookupService.SideInfo> second = ModrinthLookupService.lookup(
                List.of(new ModrinthLookupService.Candidate("linkedmod", jar)),
                cache,
                config);
        assertEquals("https://wiki.linked", second.get(hash).wikiUrl());
        assertEquals(0, ModrinthLookupService.httpClientCreationsForTests());
    }

    @Test
    void maxJarsPerReportIs512() {
        assertEquals(512, ModrinthLookupService.maxJarsPerReport());
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
                        + "\"dependencies\":[{\"project_id\":\"flywheelproj\",\"dependency_type\":\"required\"}],"
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
        assertEquals(1, updated.compatibleDependencies().size());
        assertEquals("required", updated.compatibleDependencies().get(0).dependencyType());
        assertEquals("flywheelproj", updated.compatibleDependencies().get(0).projectId());
    }

    @Test
    void minecraftVersionFromFactsUsesSparkWhenModsOmitMinecraft() {
        JsonObject facts = JsonParser.parseString("""
                {
                  "meta": { "loader": "neoforge" },
                  "optional": {
                    "mods": [{ "id": "create", "version": "6.0.0" }],
                    "spark_profile": {
                      "platform": { "minecraft": "1.21.1", "loader": "NeoForge" }
                    }
                  }
                }
                """).getAsJsonObject();
        assertEquals("1.21.1", ModrinthLookupService.minecraftVersionFromFacts(facts));
    }

    @Test
    void minecraftVersionFromFactsMapsNeoForgeVersion() {
        JsonObject facts = JsonParser.parseString("""
                {
                  "optional": {
                    "mods": [{ "id": "neoforge", "version": "21.1.233" }]
                  }
                }
                """).getAsJsonObject();
        assertEquals("1.21.1", ModrinthLookupService.minecraftVersionFromFacts(facts));
    }

    @Test
    void neoForgeVersionToMinecraftMapsMajorMinor() {
        assertEquals("1.21.1", ModrinthLookupService.neoForgeVersionToMinecraft("21.1.233"));
        assertEquals("1.20.1", ModrinthLookupService.neoForgeVersionToMinecraft("20.1.0"));
        assertNull(ModrinthLookupService.neoForgeVersionToMinecraft(""));
    }

    @Test
    void preferMatchingGameVersionKeepsExactThenParent() {
        JsonArray versions = JsonParser.parseString("""
                [
                  {"id":"other","game_versions":["1.20.1"]},
                  {"id":"parent","game_versions":["1.21"]},
                  {"id":"exact","game_versions":["1.21.1"]}
                ]
                """).getAsJsonArray();
        JsonArray preferred = ModrinthLookupService.preferMatchingGameVersion(versions, "1.21.1");
        assertEquals(1, preferred.size());
        assertEquals("exact", preferred.get(0).getAsJsonObject().get("id").getAsString());

        JsonArray parentOnly = JsonParser.parseString("""
                [
                  {"id":"other","game_versions":["1.20.1"]},
                  {"id":"parent","game_versions":["1.21"]}
                ]
                """).getAsJsonArray();
        JsonArray parentHit = ModrinthLookupService.preferMatchingGameVersion(parentOnly, "1.21.1");
        assertEquals(1, parentHit.size());
        assertEquals("parent", parentHit.get(0).getAsJsonObject().get("id").getAsString());
    }

    @Test
    void parseVersionDependenciesReadsTypes() {
        com.google.gson.JsonObject version = com.google.gson.JsonParser.parseString("""
                {
                  "dependencies": [
                    {"project_id":"a","dependency_type":"required"},
                    {"project_id":"b","dependency_type":"incompatible"},
                    {"project_id":"c","dependency_type":"optional"},
                    {"version_id":"v1","dependency_type":"embedded"}
                  ]
                }
                """).getAsJsonObject();
        var deps = ModrinthLookupService.parseVersionDependencies(version);
        assertEquals(4, deps.size());
        assertEquals("required", deps.get(0).dependencyType());
        assertEquals("incompatible", deps.get(1).dependencyType());
    }
}
