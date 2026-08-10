package dev.mcstatus.watchtower;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.collect.SparkProfileEntry;
import dev.mcstatus.watchtower.core.report.ReportConfig;
import dev.mcstatus.watchtower.core.report.StateManager;
import dev.mcstatus.watchtower.runtime.OnlinePlayerView;
import dev.mcstatus.watchtower.runtime.ServerContext;
import dev.mcstatus.watchtower.runtime.WatchtowerSample;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.junit.jupiter.api.Assertions.*;

class SparkAutoCaptureTriggerTest {

    @TempDir
    Path temp;

    Path statePath;
    Path opsCachePath;
    Path incidentsDir;

    @BeforeEach
    void setUp() throws Exception {
        Path wt = temp.resolve("watchtower");
        Files.createDirectories(wt);
        statePath = wt.resolve("state.json");
        opsCachePath = wt.resolve("ops-cache.json");
        incidentsDir = wt.resolve("incidents");
        Files.createDirectories(incidentsDir);
        Files.writeString(statePath, "{}");
        Files.writeString(opsCachePath, "{\"schema_version\":1}");
        SparkAutoCaptureTrigger.get().resetInFlightForTests();
    }

    @AfterEach
    void tearDown() {
        SparkAutoCaptureTrigger.get().resetInFlightForTests();
    }

    @Test
    void topNonVanillaMods_skipsVanillaAndLimits() {
        JsonObject profile = new JsonObject();
        JsonArray rollups = new JsonArray();
        rollups.add(modRow("minecraft", 50));
        rollups.add(modRow("neoforge", 20));
        rollups.add(modRow("create", 34.2));
        rollups.add(modRow("jei", 12));
        rollups.add(modRow("forge", 5));
        rollups.add(modRow("botania", 8));
        profile.add("mod_rollups", rollups);

        JsonArray top = SparkAutoCaptureTrigger.topNonVanillaMods(profile, 3);
        assertEquals(3, top.size());
        assertEquals("create", top.get(0).getAsJsonObject().get("mod_id").getAsString());
        assertEquals("jei", top.get(1).getAsJsonObject().get("mod_id").getAsString());
        assertEquals("botania", top.get(2).getAsJsonObject().get("mod_id").getAsString());
    }

    @Test
    void topNonVanillaMods_sortsByPctWhenUnsorted() {
        JsonObject profile = new JsonObject();
        JsonArray rollups = new JsonArray();
        rollups.add(modRow("botania", 8));
        rollups.add(modRow("create", 34.2));
        rollups.add(modRow("jei", 12));
        profile.add("mod_rollups", rollups);

        JsonArray top = SparkAutoCaptureTrigger.topNonVanillaMods(profile, 2);
        assertEquals(2, top.size());
        assertEquals("create", top.get(0).getAsJsonObject().get("mod_id").getAsString());
        assertEquals("jei", top.get(1).getAsJsonObject().get("mod_id").getAsString());
    }

    @Test
    void schedule_noopWhenToggleOff() {
        FakeServer server = new FakeServer(temp, true);
        ReportConfig config = ReportConfig.builder()
                .sparkEnabled(true)
                .sparkAutoCaptureOnLag(false)
                .build();

        SparkAutoCaptureTrigger.schedule(server, "inc-1", config, statePath, opsCachePath, incidentsDir);
        assertTrue(server.commands.isEmpty());
    }

    @Test
    void schedule_noopWhenSparkNotLoaded() {
        FakeServer server = new FakeServer(temp, false);
        ReportConfig config = ReportConfig.builder()
                .sparkEnabled(true)
                .sparkAutoCaptureOnLag(true)
                .build();

        SparkAutoCaptureTrigger.schedule(server, "inc-1", config, statePath, opsCachePath, incidentsDir);
        assertTrue(server.commands.isEmpty());
    }

    @Test
    void schedule_respectsCooldown() throws Exception {
        FakeServer server = new FakeServer(temp, true);
        ReportConfig config = ReportConfig.builder()
                .sparkEnabled(true)
                .sparkAutoCaptureOnLag(true)
                .sparkAutoCaptureCooldownSec(900)
                .build();
        StateManager.setLastSparkAutoCaptureAt(statePath, java.time.Instant.now().getEpochSecond());

        SparkAutoCaptureTrigger.schedule(server, "inc-1", config, statePath, opsCachePath, incidentsDir);
        assertTrue(server.commands.isEmpty());
    }

    @Test
    void schedule_startsProfilerWhenEnabled() throws Exception {
        FakeServer server = new FakeServer(temp, true);
        ReportConfig config = ReportConfig.builder()
                .sparkEnabled(true)
                .sparkAutoCaptureOnLag(true)
                .sparkAutoCaptureWindowSec(5)
                .sparkAutoCaptureCooldownSec(1)
                .build();

        SparkAutoCaptureTrigger.schedule(server, "inc-ok", config, statePath, opsCachePath, incidentsDir);

        awaitCommands(server, 1, 2000);
        assertEquals("spark profiler start", server.commands.get(0));
        assertTrue(StateManager.getLastSparkAutoCaptureAt(statePath) > 0);

        SparkAutoCaptureTrigger.get().resetInFlightForTests();
    }

    @Test
    void schedule_skipsWhenInFlight() {
        FakeServer server = new FakeServer(temp, true);
        ReportConfig config = ReportConfig.builder()
                .sparkEnabled(true)
                .sparkAutoCaptureOnLag(true)
                .sparkAutoCaptureWindowSec(5)
                .sparkAutoCaptureCooldownSec(1)
                .build();

        SparkAutoCaptureTrigger.schedule(server, "inc-a", config, statePath, opsCachePath, incidentsDir);
        SparkAutoCaptureTrigger.schedule(server, "inc-b", config, statePath, opsCachePath, incidentsDir);

        awaitCommands(server, 1, 2000);
        assertEquals(1, server.commands.stream().filter(c -> c.contains("start")).count());
        SparkAutoCaptureTrigger.get().resetInFlightForTests();
    }

    @Test
    void schedule_startFailureClearsInFlight() throws Exception {
        FakeServer server = new FakeServer(temp, true);
        server.startOk.set(false);
        ReportConfig config = ReportConfig.builder()
                .sparkEnabled(true)
                .sparkAutoCaptureOnLag(true)
                .sparkAutoCaptureWindowSec(5)
                .sparkAutoCaptureCooldownSec(1)
                .build();

        Path incident = incidentsDir.resolve("inc-fail.json");
        Files.writeString(incident, "{\"id\":\"inc-fail\",\"severity\":\"critical\",\"mspt\":100,\"tps\":10}");

        SparkAutoCaptureTrigger.schedule(server, "inc-fail", config, statePath, opsCachePath, incidentsDir);
        awaitCommands(server, 1, 2000);
        assertEquals("spark profiler start", server.commands.get(0));

        Thread.sleep(150);
        server.commands.clear();
        server.startOk.set(true);
        StateManager.setLastSparkAutoCaptureAt(statePath, 0); // allow immediate retry in test
        SparkAutoCaptureTrigger.schedule(server, "inc-fail-2", config, statePath, opsCachePath, incidentsDir);
        awaitCommands(server, 1, 2000);
        assertEquals("spark profiler start", server.commands.get(0));
        SparkAutoCaptureTrigger.get().resetInFlightForTests();
    }

    @Test
    void schedule_startFailureAppliesShortCooldown() throws Exception {
        FakeServer server = new FakeServer(temp, true);
        server.startOk.set(false);
        ReportConfig config = ReportConfig.builder()
                .sparkEnabled(true)
                .sparkAutoCaptureOnLag(true)
                .sparkAutoCaptureWindowSec(5)
                .sparkAutoCaptureCooldownSec(900)
                .build();

        Path incident = incidentsDir.resolve("inc-fail-cd.json");
        Files.writeString(incident, "{\"id\":\"inc-fail-cd\",\"severity\":\"critical\",\"mspt\":100,\"tps\":10}");

        SparkAutoCaptureTrigger.schedule(server, "inc-fail-cd", config, statePath, opsCachePath, incidentsDir);
        awaitCommands(server, 1, 2000);
        Thread.sleep(200);

        long last = StateManager.getLastSparkAutoCaptureAt(statePath);
        long now = java.time.Instant.now().getEpochSecond();
        // Failure cooldown leaves ~60s remaining against a 900s full cooldown.
        assertTrue(now - last < 900);
        assertTrue(now - last >= SparkAutoCaptureTrigger.FAILURE_COOLDOWN_SEC - 5);

        SparkAutoCaptureTrigger.get().resetInFlightForTests();
    }

    @Test
    void applyFailureCooldown_allowsRetryAfterFailureWindow() throws Exception {
        ReportConfig config = ReportConfig.builder().sparkAutoCaptureCooldownSec(900).build();
        StateManager.setLastSparkAutoCaptureAt(statePath, java.time.Instant.now().getEpochSecond());
        SparkAutoCaptureTrigger.applyFailureCooldown(statePath, config);
        long last = StateManager.getLastSparkAutoCaptureAt(statePath);
        long now = java.time.Instant.now().getEpochSecond();
        assertTrue(now - last >= 900 - SparkAutoCaptureTrigger.FAILURE_COOLDOWN_SEC - 2);
        assertTrue(now - last < 900);
    }

    @Test
    void copyToUpload_namesAutoFileAndStaysUnderRoot() throws Exception {
        Path upload = temp.resolve("watchtower").resolve("spark-upload");
        Files.createDirectories(upload);
        Path src = upload.resolve("raw.sparkprofile");
        Files.writeString(src, "spark");
        java.time.Instant now = java.time.Instant.now();
        SparkProfileEntry entry = new SparkProfileEntry(
                "watchtower/spark-upload/raw.sparkprofile",
                "raw.sparkprofile",
                "spark_upload",
                now,
                now,
                5L,
                true
        );
        ReportConfig config = ReportConfig.builder().sparkAutoCaptureCopyToUpload(true).build();
        String rel = SparkAutoCaptureTrigger.copyToUpload(temp, config, entry, "2026-07-19T18-15-12Z");
        assertEquals("watchtower/spark-upload/auto-2026-07-19T18-15-12Z.sparkprofile", rel);
        assertTrue(Files.isRegularFile(temp.resolve(rel)));
    }

    private static JsonObject modRow(String id, double pct) {
        JsonObject o = new JsonObject();
        o.addProperty("mod_id", id);
        o.addProperty("pct", pct);
        o.addProperty("display_name", id);
        return o;
    }

    private static void awaitCommands(FakeServer server, int min, long timeoutMs) {
        long deadline = System.currentTimeMillis() + timeoutMs;
        while (System.currentTimeMillis() < deadline) {
            if (server.commands.size() >= min) {
                return;
            }
            try {
                Thread.sleep(25);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                return;
            }
        }
        fail("expected at least " + min + " commands, got " + server.commands);
    }

    /** Minimal ServerContext for trigger guard / start tests. */
    static final class FakeServer implements ServerContext {
        final Path root;
        final boolean sparkLoaded;
        final List<String> commands = new CopyOnWriteArrayList<>();
        final AtomicBoolean startOk = new AtomicBoolean(true);

        FakeServer(Path root, boolean sparkLoaded) {
            this.root = root;
            this.sparkLoaded = sparkLoaded;
        }

        @Override
        public Path serverDirectory() {
            return root;
        }

        @Override
        public void execute(Runnable task) {
            task.run();
        }

        @Override
        public boolean runConsoleCommand(String command) {
            commands.add(command);
            if (command != null && command.contains("start") && !startOk.get()) {
                return false;
            }
            return true;
        }

        @Override
        public boolean isModLoaded(String modId) {
            return sparkLoaded && "spark".equals(modId);
        }

        @Override
        public int playerCount() {
            return 0;
        }

        @Override
        public String modId() {
            return "watchtower";
        }

        @Override
        public String modVersion() {
            return "test";
        }

        @Override
        public String minecraftVersion() {
            return "1.21.1";
        }

        @Override
        public Logger logger() {
            return LoggerFactory.getLogger("SparkAutoCaptureTriggerTest");
        }

        @Override
        public WatchtowerSample.Sample collectSample() {
            return null;
        }

        @Override
        public WatchtowerSample.Sample collectSampleLight() {
            return null;
        }

        @Override
        public List<OnlinePlayerView> onlinePlayers() {
            return new ArrayList<>();
        }

        @Override
        public double smoothedMspt() {
            return 0;
        }

        @Override
        public WatchtowerSample.SessionMspt sessionMspt() {
            return null;
        }
    }
}
