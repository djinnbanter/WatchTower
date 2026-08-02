package dev.mcstatus.watchtower.core.analyze;

import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class HangDumpAnalyzerTest {

    @Test
    void phaseOnlyTickingMapsToEntityTickLow() {
        HangDumpAnalyzer.Result r = HangDumpAnalyzer.analyze(null, "ticking");
        assertEquals("entity_tick", r.likelyCause());
        assertEquals("low", r.likelyCauseConfidence());
        assertNull(r.suspectMod());
        assertTrue(r.likelyCauseSummary().toLowerCase().contains("entit"));
    }

    @Test
    void phaseOnlySaving() {
        assertEquals("saving", HangDumpAnalyzer.analyze("", "saving").likelyCause());
    }

    @Test
    void phaseOnlyLoadingWorld() {
        assertEquals("world_gen", HangDumpAnalyzer.analyze(null, "loading_world").likelyCause());
    }

    @Test
    void blankDumpFallsBackToPhase() {
        HangDumpAnalyzer.Result r = HangDumpAnalyzer.analyze("   ", "saving");
        assertEquals("saving", r.likelyCause());
        assertEquals("low", r.likelyCauseConfidence());
        assertNull(r.suspectMod());
    }

    @Test
    void dumpEntityTickIsMedium() throws Exception {
        String text = Files.readString(fixture("entity-tick-server-thread.txt"));
        HangDumpAnalyzer.Result r = HangDumpAnalyzer.analyze(text, "ticking");
        assertEquals("entity_tick", r.likelyCause());
        assertEquals("medium", r.likelyCauseConfidence());
    }

    @Test
    void dumpSaving() throws Exception {
        String text = Files.readString(fixture("saving-server-thread.txt"));
        assertEquals("saving", HangDumpAnalyzer.analyze(text, "unknown").likelyCause());
    }

    @Test
    void dumpNetwork() throws Exception {
        String text = Files.readString(fixture("network-server-thread.txt"));
        HangDumpAnalyzer.Result r = HangDumpAnalyzer.analyze(text, "ticking");
        assertEquals("network", r.likelyCause());
        assertEquals("medium", r.likelyCauseConfidence());
    }

    @Test
    void dumpDeadlock() throws Exception {
        String text = Files.readString(fixture("deadlock.txt"));
        HangDumpAnalyzer.Result r = HangDumpAnalyzer.analyze(text, "unknown");
        assertEquals("deadlock", r.likelyCause());
        assertEquals("medium", r.likelyCauseConfidence());
    }

    @Test
    void noServerThreadFallsBackToPhase() throws Exception {
        String text = Files.readString(fixture("no-server-thread.txt"));
        HangDumpAnalyzer.Result r = HangDumpAnalyzer.analyze(text, "ticking");
        assertEquals("entity_tick", r.likelyCause());
        assertEquals("low", r.likelyCauseConfidence());
    }

    @Test
    void suspectModFromNonVanillaFrame() throws Exception {
        String text = Files.readString(fixture("suspect-mod.txt"));
        HangDumpAnalyzer.Result r = HangDumpAnalyzer.analyze(text, "ticking");
        assertNotNull(r.suspectMod());
        assertTrue(r.suspectMod().toLowerCase().contains("example")
                || r.suspectMod().toLowerCase().contains("laggy"));
        assertEquals(HangDumpAnalyzer.NOTE_HINT, r.suspectModNote());
        assertNotEquals("high", r.likelyCauseConfidence());
    }

    private static Path fixture(String name) {
        Path cwd = Path.of("").toAbsolutePath();
        for (Path p : new Path[] {
                cwd.resolve("samples/fixtures/soft-hang").resolve(name),
                cwd.resolve("../samples/fixtures/soft-hang").resolve(name),
                cwd.resolve("../../samples/fixtures/soft-hang").resolve(name)
        }) {
            if (Files.isRegularFile(p)) {
                return p;
            }
        }
        throw new IllegalStateException("missing fixture soft-hang/" + name);
    }
}
