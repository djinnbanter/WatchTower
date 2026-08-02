package dev.mcstatus.watchtower.core.analyze;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import dev.mcstatus.watchtower.core.collect.KernelOomProbe;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ExternalKillDetectorTest {

    @TempDir
    Path tempDir;

    @Test
    void oomJournalFixtureYieldsHighConfidenceOom() throws Exception {
        JsonObject fixture = loadFixture("oom-journal.json");
        JsonObject verdict = detectFromFixture(fixture, null);
        assertTrue(ExternalKillDetector.isVerdict(verdict));
        JsonObject expected = fixture.getAsJsonObject("expected");
        assertEquals(expected.get("subtype").getAsString(), verdict.get("subtype").getAsString());
        assertEquals(expected.get("confidence").getAsString(), verdict.get("confidence").getAsString());
        assertEquals(expected.get("failure_kind").getAsString(), verdict.get("failure_kind").getAsString());
        assertTrue(verdict.get("kernel_log_readable").getAsBoolean());
        assertTrue(verdict.getAsJsonArray("fix_hints").size() > 0);
    }

    @Test
    void panelWatchdogNoEvidenceFixtureYieldsMediumPanel() throws Exception {
        JsonObject fixture = loadFixture("panel-watchdog-no-evidence.json");
        JsonObject verdict = detectFromFixture(fixture, null);
        assertTrue(ExternalKillDetector.isVerdict(verdict));
        assertEquals("panel_watchdog", verdict.get("subtype").getAsString());
        assertEquals("medium", verdict.get("confidence").getAsString());
    }

    @Test
    void crashReportInWindowYieldsEmptyVerdict() throws Exception {
        JsonObject fixture = loadFixture("crash-report-present.json");
        Path serverDir = tempDir.resolve("server");
        Path crashDir = serverDir.resolve("crash-reports");
        Files.createDirectories(crashDir);
        Instant killed = Instant.parse(fixture.getAsJsonObject("prev_session").get("last_alive_at").getAsString());
        Path crash = crashDir.resolve("crash-2026-07-28_09.00.05-server.txt");
        Files.writeString(crash, "java.lang.NullPointerException\n", StandardCharsets.UTF_8);
        Files.setLastModifiedTime(crash, java.nio.file.attribute.FileTime.from(killed));

        JsonObject verdict = detectFromFixture(fixture, serverDir);
        assertFalse(ExternalKillDetector.isVerdict(verdict));
        assertEquals(0, verdict.size());
    }

    @Test
    void cleanStopYieldsEmptyVerdict() {
        JsonObject session = baseSession();
        session.addProperty("clean_stop_at", "2026-07-28T21:14:05Z");
        JsonObject verdict = ExternalKillDetector.detect(
                session, null, new KernelOomProbe.Result(true, new JsonArray()),
                0, new JsonArray(), "2026-07-28T21:20:00Z");
        assertFalse(ExternalKillDetector.isVerdict(verdict));
        assertEquals(0, verdict.size());
    }

    @Test
    void alreadyPostmortemedYieldsEmptyVerdict() {
        JsonObject session = baseSession();
        session.addProperty("postmortem_for", session.get("boot_at").getAsString());
        JsonObject verdict = ExternalKillDetector.detect(
                session, null, new KernelOomProbe.Result(true, new JsonArray()),
                0, new JsonArray(), "2026-07-28T21:20:00Z");
        assertFalse(ExternalKillDetector.isVerdict(verdict));
    }

    @Test
    void unreadableKernelYieldsLowConfidencePanel() {
        JsonObject session = baseSession();
        JsonObject verdict = ExternalKillDetector.detect(
                session, null, KernelOomProbe.Result.empty(),
                0, new JsonArray(), "2026-07-28T21:20:00Z");
        assertTrue(ExternalKillDetector.isVerdict(verdict));
        assertEquals("panel_watchdog", verdict.get("subtype").getAsString());
        assertEquals("low", verdict.get("confidence").getAsString());
        assertFalse(verdict.get("kernel_log_readable").getAsBoolean());
        String hints = verdict.getAsJsonArray("fix_hints").toString();
        assertTrue(hints.toLowerCase().contains("memory") || hints.toLowerCase().contains("out-of-memory")
                || hints.toLowerCase().contains("kernel"));
    }

    @Test
    void cgroupCounterIncreaseYieldsOomEvenWhenKernelUnreadable() {
        JsonObject session = baseSession();
        session.addProperty("cgroup_oom_kill", 1);
        JsonObject verdict = ExternalKillDetector.detect(
                session, null, KernelOomProbe.Result.empty(),
                3, new JsonArray(), "2026-07-28T21:20:00Z");
        assertTrue(ExternalKillDetector.isVerdict(verdict));
        assertEquals("oom", verdict.get("subtype").getAsString());
        assertEquals("high", verdict.get("confidence").getAsString());
    }

    private static JsonObject baseSession() {
        JsonObject session = new JsonObject();
        session.addProperty("boot_at", "2026-07-28T18:00:00Z");
        session.addProperty("last_alive_at", "2026-07-28T21:14:00Z");
        session.add("clean_stop_at", null);
        session.addProperty("cgroup_oom_kill", 0);
        return session;
    }

    private static JsonObject detectFromFixture(JsonObject fixture, Path serverDir) {
        JsonObject session = fixture.getAsJsonObject("prev_session");
        JsonObject kernelObj = fixture.getAsJsonObject("kernel");
        boolean readable = kernelObj.has("readable") && kernelObj.get("readable").getAsBoolean();
        JsonArray evidence = kernelObj.has("evidence") && kernelObj.get("evidence").isJsonArray()
                ? kernelObj.getAsJsonArray("evidence") : new JsonArray();
        KernelOomProbe.Result kernel = new KernelOomProbe.Result(readable, evidence);
        long cgroup = fixture.has("cgroup_oom_kill") ? fixture.get("cgroup_oom_kill").getAsLong() : 0;
        JsonArray panel = fixture.has("panel_kill_events") && fixture.get("panel_kill_events").isJsonArray()
                ? fixture.getAsJsonArray("panel_kill_events") : new JsonArray();
        String now = fixture.get("now").getAsString();
        return ExternalKillDetector.detect(session, serverDir, kernel, cgroup, panel, now);
    }

    private static JsonObject loadFixture(String name) throws Exception {
        Path p = resolveFixture(name);
        String json = Files.readString(p, StandardCharsets.UTF_8);
        return JsonParser.parseString(json).getAsJsonObject();
    }

    private static Path resolveFixture(String name) {
        Path cwd = Path.of("").toAbsolutePath();
        Path[] candidates = {
                cwd.resolve("samples/fixtures/external-kill").resolve(name),
                cwd.resolve("../samples/fixtures/external-kill").resolve(name),
                cwd.resolve("../../samples/fixtures/external-kill").resolve(name),
        };
        for (Path c : candidates) {
            if (Files.isRegularFile(c)) {
                return c;
            }
        }
        throw new IllegalStateException("Fixture not found: " + name + " (cwd=" + cwd + ")");
    }
}
