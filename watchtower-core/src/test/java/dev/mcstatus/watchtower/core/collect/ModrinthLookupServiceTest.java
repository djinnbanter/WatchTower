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
import java.time.Instant;
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
    void minecraftVersionFromServerDirReadsSnapshotThenPlatform(@TempDir Path dir) throws Exception {
        Path wt = dir.resolve("watchtower");
        Files.createDirectories(wt);
        Files.writeString(wt.resolve("snapshot.json"), """
                {"source":"watchtower","minecraft_version":"1.21.1","overworld":{"tps":20,"mspt":1}}
                """);
        assertEquals("1.21.1", ModrinthLookupService.minecraftVersionFromServerDir(dir.toString()));

        Files.delete(wt.resolve("snapshot.json"));
        Files.writeString(wt.resolve("platform.json"), """
                {"loader":"neoforge","minecraft_version":"1.21.1"}
                """);
        assertEquals("1.21.1", ModrinthLookupService.minecraftVersionFromServerDir(dir.toString()));
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
    void minecraftVersionFromFactsPrefersPatchOverParentMcTag() {
        JsonObject facts = JsonParser.parseString("""
                {
                  "optional": {
                    "mods": [
                      { "id": "appleskin", "version": "3.0.9+mc1.21", "jar_file": "appleskin-neoforge-mc1.21-3.0.9.jar" },
                      { "id": "farmersdelight", "version": "1.3.2", "jar_file": "FarmersDelight-1.21.1-1.3.2.jar",
                        "modrinth_version_number": "1.21.1-1.3.2" },
                      { "id": "create", "version": "6.0.0", "jar_file": "create-1.21.1-6.0.0.jar" },
                      { "id": "yungs", "version": "1.21.1-NeoForge-5.1.1", "jar_file": "Yungs-1.21.1-NeoForge-5.1.1.jar" }
                    ]
                  }
                }
                """).getAsJsonObject();
        assertEquals("1.21.1", ModrinthLookupService.minecraftVersionFromFacts(facts));
    }

    @Test
    void enrichCrashSuspectsDoesNotCallEnrichWithEmptyByIdWhenPriorImpactExists() {
        JsonObject optional = new JsonObject();
        JsonArray mods = new JsonArray();
        JsonObject create = new JsonObject();
        create.addProperty("id", "create");
        create.addProperty("version", "6.0.0");
        create.addProperty("modrinth_outdated", true);
        create.addProperty("modrinth_compatible_version", "6.0.1");
        mods.add(create);
        optional.add("mods", mods);

        JsonArray prior = new JsonArray();
        JsonObject priorRow = new JsonObject();
        priorRow.addProperty("mod_id", "create");
        priorRow.addProperty("latest_compatible", "6.0.1");
        priorRow.addProperty("impact_verdict", "break");
        JsonArray blockers = new JsonArray();
        JsonObject b = new JsonObject();
        b.addProperty("kind", "need_install");
        b.addProperty("mod_id", "flywheel");
        blockers.add(b);
        priorRow.add("blockers", blockers);
        prior.add(priorRow);
        optional.add("modrinth_updates", prior);

        ModrinthLookupService.enrichCrashSuspects(optional, null, null);

        JsonObject out = optional.getAsJsonArray("modrinth_updates").get(0).getAsJsonObject();
        assertEquals("break", out.get("impact_verdict").getAsString());
        assertEquals("need_install",
                out.getAsJsonArray("blockers").get(0).getAsJsonObject().get("kind").getAsString());
    }

    @Test
    void minecraftVersionPrefersSnapshotOverJarSuffixHeuristic(@TempDir Path serverDir) throws Exception {
        Path watchtower = serverDir.resolve("watchtower");
        Files.createDirectories(watchtower);
        Files.writeString(watchtower.resolve("snapshot.json"),
                "{\"minecraft_version\":\"1.21.1\"}", StandardCharsets.UTF_8);

        JsonObject facts = new JsonObject();
        facts.add("meta", new JsonObject());
        JsonObject optional = new JsonObject();
        JsonArray mods = new JsonArray();
        for (int i = 0; i < 5; i++) {
            JsonObject m = new JsonObject();
            m.addProperty("id", "mod" + i);
            m.addProperty("version", "1.0.0+mc1.21");
            mods.add(m);
        }
        optional.add("mods", mods);
        facts.add("optional", optional);

        String fromFactsOnly = ModrinthLookupService.minecraftVersionFromFacts(facts);
        String resolved = ModrinthLookupService.resolveMinecraftVersion(facts, serverDir.toString());
        assertEquals("1.21.1", resolved,
                "snapshot/platform MC must beat coarse jar-suffix heuristic; factsAlone=" + fromFactsOnly);
    }

    @Test
    void pickBestMinecraftVotePrefersSpecificityThenCount() {
        Map<String, Integer> votes = new HashMap<>();
        votes.put("1.21", 50);
        votes.put("1.21.1", 10);
        assertEquals("1.21.1", ModrinthLookupService.pickBestMinecraftVote(votes));
    }

    @Test
    void compareMcTaggedVersionsRejectsParentLineDowngrade() {
        assertTrue(ModrinthLookupService.compareMcTaggedVersions("1.21.1-1.3.2", "1.21-1.2.4") > 0);
        assertTrue(ModrinthLookupService.compareMcTaggedVersions("1.21-1.2.4", "1.21.1-1.3.2") < 0);
        assertTrue(ModrinthLookupService.compareMcTaggedVersions("1.21.1-1.3.2", "1.21.1-1.3.1") > 0);
    }

    @Test
    void enrichCompatibleIgnoresOlderParentMcRelease(@TempDir Path dir) throws Exception {
        Path jar = dir.resolve("farmersdelight.jar");
        Files.write(jar, "fd-installed".getBytes(StandardCharsets.UTF_8));
        String installedHash = ModrinthLookupService.sha512Hex(jar);

        ModrinthLookupService.seedTransportForTests(new ModrinthLookupService.HttpTransport() {
            @Override
            public String postJson(String url, String body) {
                return "{}";
            }

            @Override
            public String getJson(String url) {
                // Wrong-line "newest" for game_versions=["1.21"] — older than installed 1.21.1-1.3.2
                return "[{\"id\":\"ovSzG9pc\",\"version_number\":\"1.21-1.2.4\","
                        + "\"files\":[{\"primary\":true,\"hashes\":{\"sha512\":\"oldparent\"}}]}]";
            }
        });

        Map<String, ModrinthLookupService.SideInfo> byId = new HashMap<>();
        byId.put("farmersdelight", new ModrinthLookupService.SideInfo(
                "R2OftAxM", "farmers-delight", "optional", "required", "Farmer's Delight", false,
                "GbNuOZ4S", "1.21.1-1.3.2", false, null, null, null));
        ModrinthLookupService.enrichCompatibleUpdates(
                byId, Map.of("farmersdelight", installedHash), Set.of("farmersdelight"),
                "neoforge", "1.21", 10);
        ModrinthLookupService.SideInfo updated = byId.get("farmersdelight");
        assertFalse(updated.outdated());
        assertNull(updated.compatibleVersionId());
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

    @Test
    void persistAfterCompatEnrichPreservesFetchedAtAndDeps(@TempDir Path dir) throws Exception {
        Path jar = dir.resolve("create.jar");
        Files.write(jar, "create-payload".getBytes(StandardCharsets.UTF_8));
        String hash = ModrinthLookupService.sha512Hex(jar);
        Path cache = dir.resolve("modrinth-cache.json");

        ModrinthLookupService.seedTransportForTests(new ModrinthLookupService.HttpTransport() {
            @Override
            public String postJson(String url, String body) {
                return "{\"" + hash + "\":{\"project_id\":\"proj\",\"id\":\"oldver\",\"version_number\":\"6.0.0\"}}";
            }

            @Override
            public String getJson(String url) {
                if (url.contains("/version_files") || url.contains("version_files")) {
                    return "{}";
                }
                if (url.contains("/projects")) {
                    return "[{\"id\":\"proj\",\"slug\":\"create\",\"client_side\":\"optional\","
                            + "\"server_side\":\"required\",\"title\":\"Create\"}]";
                }
                // project versions / version detail
                return "[{\"id\":\"newver\",\"version_number\":\"6.0.1\","
                        + "\"dependencies\":[{\"project_id\":\"flywheelproj\",\"dependency_type\":\"required\"}],"
                        + "\"files\":[{\"primary\":true,\"hashes\":{\"sha512\":\"deadbeef\"}}]}]";
            }
        });

        ReportConfig config = ReportConfig.builder().modrinthLookup(true).build();
        Map<String, ModrinthLookupService.SideInfo> byHash = ModrinthLookupService.lookup(
                List.of(new ModrinthLookupService.Candidate("create", jar)),
                cache,
                config);
        assertNotNull(byHash.get(hash));
        assertNotNull(byHash.get(hash).fetchedAt());
        Instant stamped = byHash.get(hash).fetchedAt();

        Map<String, ModrinthLookupService.SideInfo> byId = new HashMap<>();
        byId.put("create", byHash.get(hash));
        ModrinthLookupService.enrichCompatibleUpdates(
                byId, Map.of("create", hash), Set.of("create"), "neoforge", "1.21.1", 10);
        ModrinthLookupService.SideInfo enriched = byId.get("create");
        assertTrue(enriched.outdated());
        assertEquals(1, enriched.compatibleDependencies().size());
        assertEquals(stamped, enriched.fetchedAt());

        byHash.put(hash, enriched);
        ModrinthLookupService.persistCache(cache, byHash);

        ModrinthLookupService.resetForTests();
        Map<String, ModrinthLookupService.SideInfo> reloaded =
                ModrinthLookupService.lookupCacheOnly(
                        List.of(new ModrinthLookupService.Candidate("create", jar)), cache);
        ModrinthLookupService.SideInfo again = reloaded.get(hash);
        assertNotNull(again, "cache entry must survive reload after compat enrich");
        assertFalse(again.fetchedAtOrEpoch().equals(java.time.Instant.EPOCH));
        assertEquals(stamped, again.fetchedAt());
        assertEquals(1, again.compatibleDependencies().size());
        assertEquals("flywheelproj", again.compatibleDependencies().get(0).projectId());
        assertTrue(ModrinthLookupService.isFresh(again, java.time.Instant.now()));
    }

    @Test
    void isFreshRespectsHitAndMissTtl() {
        java.time.Instant now = java.time.Instant.parse("2026-07-21T12:00:00Z");
        ModrinthLookupService.SideInfo freshHit = new ModrinthLookupService.SideInfo(
                "p", "s", "required", "required", "T", false)
                .withFetchedAt(now.minusSeconds(3600));
        assertTrue(ModrinthLookupService.isFresh(freshHit, now));

        ModrinthLookupService.SideInfo staleHit = new ModrinthLookupService.SideInfo(
                "p", "s", "required", "required", "T", false)
                .withFetchedAt(java.time.Instant.EPOCH);
        assertFalse(ModrinthLookupService.isFresh(staleHit, now));

        ModrinthLookupService.SideInfo freshMiss = ModrinthLookupService.SideInfo.missInfo()
                .withFetchedAt(now.minusSeconds(3600));
        assertTrue(ModrinthLookupService.isFresh(freshMiss, now));

        ModrinthLookupService.SideInfo staleMiss = ModrinthLookupService.SideInfo.missInfo()
                .withFetchedAt(now.minusSeconds(8L * 24 * 3600));
        assertFalse(ModrinthLookupService.isFresh(staleMiss, now));
    }

    @Test
    void normalizeLoaderKeepsPlainForgeAndDisplayNames() {
        assertEquals("forge", ModrinthLookupService.normalizeLoader("forge"));
        assertEquals("forge", ModrinthLookupService.normalizeLoader("Forge"));
        assertEquals("neoforge", ModrinthLookupService.normalizeLoader("neoforge"));
        assertEquals("neoforge", ModrinthLookupService.normalizeLoader("NeoForge"));
        assertEquals("fabric", ModrinthLookupService.normalizeLoader("fabric"));
        assertEquals("Forge", ModrinthLookupService.loaderDisplayName("forge"));
        assertEquals("Fabric", ModrinthLookupService.loaderDisplayName("fabric"));
        assertEquals("NeoForge", ModrinthLookupService.loaderDisplayName("neoforge"));
    }

    @Test
    void applyIdentityUsesLoaderDisplayName() {
        JsonArray mods = new JsonArray();
        JsonObject mod = new JsonObject();
        mod.addProperty("id", "testmod");
        mods.add(mod);
        Map<String, ModrinthLookupService.SideInfo> byId = new HashMap<>();
        byId.put("testmod", new ModrinthLookupService.SideInfo(
                "abc", "testmod", "required", "unsupported", "Test Mod", false,
                "ver1", "1.0.0", true, "ver2", "1.1.0",
                "https://modrinth.com/mod/testmod/version/ver2"));
        ModrinthLookupService.applyIdentityToMods(mods, byId, "fabric");
        assertEquals("Fabric build 1.1.0 available",
                mods.get(0).getAsJsonObject().get("modrinth_update_label").getAsString());
    }
}
