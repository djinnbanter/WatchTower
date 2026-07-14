package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonObject;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class CrashReportParserTest {

    private static final Path FIXTURES = Path.of("..", "samples", "fixtures", "crash-intelligence");

    @Test
    void extractsWatchdogMilliseconds() {
        Integer ms = CrashReportParser.extractWatchdogMs(
                "ServerHangWatchdog detected that a single server tick took 45000 milliseconds");
        assertEquals(45000, ms);
    }

    @Test
    void extractsWatchdogSeconds() {
        Integer ms = CrashReportParser.extractWatchdogMs(
                "ServerHangWatchdog detected that a single server tick took 60.00 seconds");
        assertEquals(60000, ms);
    }

    @Test
    void clampsCorruptWatchdogSecondsCounter() {
        Integer ms = CrashReportParser.extractWatchdogMs(
                "ServerHangWatchdog detected that a single server tick took 60000004.00 seconds");
        assertEquals(60000, ms);
    }

    @Test
    void extractsPrimaryModIdFromTransformerStack() throws Exception {
        String text = readFixture("create-npe.txt");
        CrashReportParser.ParsedCrash parsed = CrashReportParser.parse(text, List.of("create"));
        assertEquals("create", parsed.primaryModId());
        assertTrue(parsed.modFile() == null || parsed.modFile().isBlank());
    }

    @Test
    void parsesWatchdogSecondsFixture() throws Exception {
        String text = readFixture("watchdog-seconds.txt");
        CrashReportParser.ParsedCrash parsed = CrashReportParser.parse(text, List.of());
        assertEquals(60000, parsed.watchdogTickMs());
    }

    @Test
    void parsesWatchdogPregenFixture() throws Exception {
        String text = readFixture("watchdog-pregen.txt");
        CrashReportParser.ParsedCrash parsed = CrashReportParser.parse(text, List.of("squaremap"));
        assertEquals("squaremap", parsed.primaryModId());
        assertEquals(60000, parsed.watchdogTickMs());
        JsonObject report = new JsonObject();
        parsed.applyTo(report);
        assertEquals("squaremap", report.get("primary_mod_id").getAsString());
        assertEquals(60000, report.get("watchdog_tick_ms").getAsInt());
    }

    private static String readFixture(String name) throws Exception {
        Path p = FIXTURES.resolve(name);
        if (!Files.isRegularFile(p)) {
            p = Path.of("samples", "fixtures", "crash-intelligence", name);
        }
        assertTrue(Files.isRegularFile(p), "missing fixture: " + name);
        return Files.readString(p);
    }
}
