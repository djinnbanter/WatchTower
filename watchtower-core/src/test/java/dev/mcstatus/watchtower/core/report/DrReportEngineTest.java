package dev.mcstatus.watchtower.core.report;

import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.WatchtowerFiles;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;

import static org.junit.jupiter.api.Assertions.*;

class DrReportEngineTest {

    private static final DateTimeFormatter LOG_TS =
            DateTimeFormatter.ofPattern("ddMMMyyyy HH:mm:ss.SSS");

    @TempDir
    Path serverDir;

    @TempDir
    Path outDir;

    @Test
    void drModeProducesTaggedFactsAndBriefWithoutMutatingState() throws Exception {
        buildCrashLoopFixture(serverDir);

        Path statePath = serverDir.resolve("watchtower/" + WatchtowerFiles.STATE_FILENAME);
        Files.createDirectories(statePath.getParent());
        String stateBefore = "{\"last_run\":\"2026-06-16T10:00:00+01:00\",\"mod_count\":42}";
        Files.writeString(statePath, stateBefore, StandardCharsets.UTF_8);

        ReportConfig config = ReportConfig.builder()
                .serverDir(serverDir.toAbsolutePath().toString())
                .stateFile(statePath.toAbsolutePath().toString())
                .reportMode("dr")
                .lookbackMinutes(30)
                .lookbackHours(0)
                .incremental(false)
                .javaRunning(false)
                .panelRunning(false)
                .loader("neoforge")
                .build();

        ReportEngine.ReportResult result = ReportEngine.run(config, outDir);

        assertTrue(result.success(), result.message());
        assertNotNull(result.factsPath());
        assertTrue(Files.isRegularFile(result.factsPath()));
        assertTrue(Files.isRegularFile(result.briefPath()));

        JsonObject facts = result.facts();
        assertNotNull(facts);
        JsonObject meta = facts.getAsJsonObject("meta");
        assertEquals("dr", meta.get("report_mode").getAsString());
        assertEquals(30, meta.get("lookback_minutes").getAsInt());

        JsonObject health = facts.getAsJsonObject("health");
        assertFalse(health.get("java_running").getAsBoolean());

        String brief = Files.readString(result.briefPath(), StandardCharsets.UTF_8);
        assertTrue(brief.contains("TL;DR"), "brief should contain TL;DR");
        assertTrue(brief.contains("pride") || brief.contains("Mod") || brief.contains("CRITICAL"),
                "brief should mention mod/crash signal");

        String stateAfter = Files.readString(statePath, StandardCharsets.UTF_8);
        assertEquals(stateBefore, stateAfter, "DR run must not mutate server state file");
    }

    @Test
    void lookbackMinutesOverridesHoursForWindow() {
        ReportConfig minutesConfig = ReportConfig.builder()
                .lookbackMinutes(30)
                .lookbackHours(24)
                .build();
        ReportConfig hoursConfig = ReportConfig.builder()
                .lookbackHours(24)
                .build();

        double minutesEpoch = minutesConfig.windowStartEpoch();
        double hoursEpoch = hoursConfig.windowStartEpoch();

        assertTrue(minutesEpoch > hoursEpoch,
                "30-minute window should start more recently than 24-hour window");
    }

    private static void buildCrashLoopFixture(Path serverDir) throws Exception {
        Path logsDir = serverDir.resolve("logs");
        Path crashDir = serverDir.resolve("crash-reports");
        Files.createDirectories(logsDir);
        Files.createDirectories(crashDir);

        String now = ZonedDateTime.now().format(LOG_TS);
        String log = """
                [%s] [main/INFO] [net.neoforged.fml.loading.FMLLoader/]: NeoForge 21.1.0 loading
                [%s] [main/INFO] [net.minecraft.server.Main/]: Starting minecraft server version 1.21.1
                [%s] [modloading-worker-0/INFO] [pride/]: Initializing pride mod
                [%s] [main/ERROR] [net.neoforged.fml.ModLoader/]: File provided by mod pride does not exist!
                [%s] [main/ERROR] [net.neoforged.fml.ModLoader/]: Mod loading has failed
                [%s] [main/FATAL] [net.neoforged.fml.ModLoader/]: Mod (pride) failed to load correctly
                net.neoforged.fml.ModLoadingException: Mod pride has failed to load correctly
                [%s] [main/ERROR] [net.minecraft.server.Main/]: Failed to start the minecraft server
                """.formatted(now, now, now, now, now, now, now);
        Files.writeString(logsDir.resolve("latest.log"), log, StandardCharsets.UTF_8);

        String crash = """
                ---- Minecraft Crash Report ----
                // I just want to play!

                Time: %s
                Description: Mod loading error has occurred

                java.lang.RuntimeException: Mod loading has failed
                Caused by: net.neoforged.fml.ModLoadingException: Mod File pride failed to load

                Failure message: File provided by mod pride does not exist!

                Mod File: pride-1.0.0.jar
                \tMod ID: pride
                \tMod Version: 1.0.0
                """.formatted(ZonedDateTime.now().format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")));
        Files.writeString(crashDir.resolve("crash-test-server.txt"), crash, StandardCharsets.UTF_8);
    }
}
