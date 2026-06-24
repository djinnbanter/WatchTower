package dev.mcstatus.watchtower.core;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.analyze.ReportPipeline;
import dev.mcstatus.watchtower.core.collect.CrashDetails;
import dev.mcstatus.watchtower.core.collect.ModChangeDetector;
import dev.mcstatus.watchtower.core.collect.RconTpsParser;
import dev.mcstatus.watchtower.core.collect.StartupWarnings;
import dev.mcstatus.watchtower.core.report.ReportConfig;
import dev.mcstatus.watchtower.core.report.ReportEngine;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class ReportEnrichmentTest {

    @Test
    void crashSummariesInFacts() {
        JsonObject staging = ValidatePocTest.baseStagingPublic();
        JsonObject mc = staging.getAsJsonObject("minecraft");
        JsonArray crashes = new JsonArray();
        JsonObject crash = new JsonObject();
        crash.addProperty("file", "crash-2026.txt");
        crash.addProperty("time", "2026-06-16T15:27:17+01:00");
        crash.addProperty("summary", "Exception in server tick loop");
        crash.addProperty("exception", "java.lang.ClassCastException: particle_effects");
        crash.addProperty("mod_file", "particle_effects");
        crashes.add(crash);
        mc.add("new_crash_reports", crashes);

        JsonObject facts = ReportPipeline.buildFacts(staging);
        JsonArray summaries = facts.getAsJsonObject("optional").getAsJsonArray("crash_summaries");
        assertEquals(1, summaries.size());
        assertEquals("particle_effects", summaries.get(0).getAsJsonObject().get("mod_file").getAsString());
        String brief = ReportPipeline.writeBrief(facts);
        assertTrue(brief.contains("PLAYER ACTIVITY"));
        assertTrue(brief.contains("Players: 0 online"));
    }

    @Test
    void playersOnlineInBrief() {
        JsonObject staging = ValidatePocTest.baseStagingPublic();
        JsonObject mc = staging.getAsJsonObject("minecraft");
        mc.addProperty("players_online_now", 2);
        JsonArray names = new JsonArray();
        names.add("Alice");
        names.add("Bob");
        mc.add("players_online_names", names);

        String brief = ReportPipeline.writeBrief(ReportPipeline.buildFacts(staging));
        assertTrue(brief.contains("Players: 2 online (Alice, Bob)"));
    }

    @Test
    void sourcePathsComplete() throws Exception {
        Path tmp = Files.createTempDirectory("wt-source-paths");
        Path serverDir = tmp.resolve("server");
        Files.createDirectories(serverDir);
        ReportConfig config = ReportConfig.builder()
                .serverDir(serverDir.toString())
                .lookbackHours(24)
                .craftyApp("/crafty")
                .stateFile(tmp.resolve("state.json").toString())
                .build();
        JsonObject sp = ReportEngine.buildSourcePaths(config, tmp.resolve("reports"));
        assertTrue(sp.has("snapshot"));
        assertTrue(sp.has("state"));
        assertTrue(sp.has("reports_dir"));
        assertTrue(sp.has("journal"));
        assertTrue(sp.get("journal").getAsString().contains("journalctl"));
    }

    @Test
    void startupWarningsCounted() {
        Map<String, Integer> counts = StartupWarnings.newCounter();
        StartupWarnings.countLine("[INFO] Parsing error loading recipe foo", counts);
        StartupWarnings.countLine("[INFO] Parsing error loading recipe bar", counts);
        StartupWarnings.countLine("[WARN] block is not found from registry", counts);
        JsonArray arr = StartupWarnings.toJsonArray(counts);
        assertEquals(2, arr.size());
    }

    @Test
    void crashIssueEvidenceUsesDisplayLabel() {
        JsonObject staging = ValidatePocTest.baseStagingPublic();
        JsonObject mc = staging.getAsJsonObject("minecraft");
        JsonArray crashes = new JsonArray();
        JsonObject crash = new JsonObject();
        crash.addProperty("file", "crash-watchdog.txt");
        crash.addProperty("time", "2026-06-16T15:27:17+01:00");
        crash.addProperty("summary", "Watching Server");
        crash.addProperty("exception",
                "java.lang.Error: ServerHangWatchdog detected that a single server tick took 6000");
        crashes.add(crash);
        mc.add("new_crash_reports", crashes);

        JsonObject facts = ReportPipeline.buildFacts(staging);
        JsonArray issues = facts.getAsJsonArray("issues");
        boolean found = false;
        for (var el : issues) {
            JsonObject issue = el.getAsJsonObject();
            if ("CRASH_REPORT".equals(issue.get("id").getAsString())) {
                JsonArray evidence = issue.getAsJsonArray("evidence");
                String quote = evidence.get(0).getAsJsonObject().get("quote").getAsString();
                assertTrue(quote.contains("ServerHangWatchdog"));
                found = true;
            }
        }
        assertTrue(found);
    }

    @Test
    void modDeltaDetected() {
        JsonObject optional = new JsonObject();
        JsonObject nativeBlob = new JsonObject();
        JsonArray mods = new JsonArray();
        JsonObject a = new JsonObject();
        a.addProperty("id", "a");
        JsonObject c = new JsonObject();
        c.addProperty("id", "c");
        mods.add(a);
        mods.add(c);
        nativeBlob.add("mods", mods);
        JsonObject state = new JsonObject();
        JsonArray prev = new JsonArray();
        prev.add("a");
        prev.add("b");
        state.add("mod_ids", prev);
        state.addProperty("mod_ids_full", true);
        ModChangeDetector.apply(optional, nativeBlob, state);
        JsonObject changes = optional.getAsJsonObject("mod_changes");
        assertEquals(1, changes.getAsJsonArray("added").size());
        assertEquals("c", changes.getAsJsonArray("added").get(0).getAsString());
        assertEquals(1, changes.getAsJsonArray("removed").size());
        assertEquals("b", changes.getAsJsonArray("removed").get(0).getAsString());
    }

    @Test
    void collectionWarningsInMeta() {
        JsonObject staging = ValidatePocTest.baseStagingPublic();
        JsonArray warnings = new JsonArray();
        warnings.add("Crafty audit.log not readable");
        staging.add("collection_warnings", warnings);
        JsonObject facts = ReportPipeline.buildFacts(staging);
        assertTrue(facts.getAsJsonObject("meta").has("collection_warnings"));
        String brief = ReportPipeline.writeBrief(facts);
        assertTrue(brief.contains("collection warning"));
    }

    @Test
    void rconTpsParser() {
        String sample = """
                minecraft:overworld: 18.0 TPS, 72.0 ms
                minecraft:the_nether: 20.0 TPS, 45.0 ms
                """;
        JsonObject parsed = RconTpsParser.parse(sample);
        assertTrue(RconTpsParser.hasMetrics(parsed));
        assertEquals(18.0, parsed.getAsJsonObject("overworld").get("tps").getAsDouble(), 0.01);
        assertEquals(72.0, parsed.getAsJsonObject("overworld").get("mspt").getAsDouble(), 0.01);
    }

    @Test
    void crashDetailsParse() {
        String text = """
                ---- Minecraft Crash Report ----
                Description: Exception in server tick loop
                Mod File: particle_effects-1.0.jar
                Caused by: java.lang.ClassCastException: particle_effects
                """;
        CrashDetails details = CrashDetails.parse(text);
        assertTrue(details.summary().contains("server tick"));
        assertEquals("particle_effects", details.modFile());
        assertTrue(details.exception().contains("ClassCastException"));
        assertTrue(details.displayLabel().contains("particle_effects"));
    }
}
