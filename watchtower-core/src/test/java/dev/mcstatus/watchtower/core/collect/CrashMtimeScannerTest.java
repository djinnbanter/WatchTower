package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.analyze.CrashClassifier;
import dev.mcstatus.watchtower.core.report.StateManager;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class CrashMtimeScannerTest {

    @TempDir
    Path temp;

    @Test
    void scan_backgroundBudgetPreferMissingFingerprints() throws IOException {
        Path server = temp.resolve("server");
        Path crashDir = server.resolve("crash-reports");
        Files.createDirectories(crashDir);
        Path statePath = temp.resolve("state.json");

        String fmlBody = """
                ---- Minecraft Crash Report ----
                Description: Mod loading failures have occurred; consult the issue messages for more details
                net.neoforged.neoforge.logging.CrashReportExtender$ModLoadingCrashException: Mod loading has failed
                -- Mod loading issue for: alloyed --
                """;
        // Seed fingerprint ledger with one "already known" crash so boot-seed is off.
        Files.writeString(crashDir.resolve("already-known.txt"), fmlBody, StandardCharsets.UTF_8);
        CrashMtimeScanner.ScanResult seed = CrashMtimeScanner.scan(server.toString(), statePath);
        StateManager.updateCrashMtimeIndex(statePath, seed.updatedIndex());
        StateManager.updateCrashFingerprintIndex(statePath, seed.updatedFingerprints());
        assertFalse(StateManager.getCrashFingerprintIndex(statePath).isEmpty());

        // Add older historical crashes that still need enrichment.
        for (int i = 0; i < 3; i++) {
            Path crash = crashDir.resolve("historical-" + i + ".txt");
            Files.writeString(crash, fmlBody, StandardCharsets.UTF_8);
            Files.setLastModifiedTime(crash, java.nio.file.attribute.FileTime.fromMillis(1_000L * (i + 1)));
        }

        CrashMtimeScanner.ScanResult catchUp = CrashMtimeScanner.scan(server.toString(), statePath);
        long enrichedHistorical = catchUp.entries().stream()
                .filter(e -> e.file().startsWith("historical-"))
                .filter(e -> e.failureKind() != null && !e.failureKind().isBlank()
                        && !"unknown".equalsIgnoreCase(e.failureKind()))
                .count();
        assertEquals(3, enrichedHistorical, "background poll should enrich missing-FP historical crashes first");
    }

    @Test
    void scan_detectsNewCrashAndUpdatesIndex() throws IOException {
        Path server = temp.resolve("server");
        Path crashDir = server.resolve("crash-reports");
        Files.createDirectories(crashDir);
        Path statePath = temp.resolve("state.json");

        Path crash = crashDir.resolve("crash-test.txt");
        Files.writeString(crash, """
                ---- Minecraft Crash Report ----
                Description: Watchdog timeout
                """, StandardCharsets.UTF_8);

        CrashMtimeScanner.ScanResult first = CrashMtimeScanner.scan(server.toString(), statePath);
        assertEquals(1, first.newCount());
        assertEquals(1, first.unreviewed());
        assertEquals(1, first.entries().size());
        assertFalse(first.entries().get(0).displayLabel().isBlank());
        assertNotNull(first.entries().get(0).plainEnglish());
        assertFalse(first.entries().get(0).plainEnglish().isBlank());

        StateManager.updateCrashMtimeIndex(statePath, first.updatedIndex());
        StateManager.updateCrashFingerprintIndex(statePath, first.updatedFingerprints());

        CrashMtimeScanner.ScanResult second = CrashMtimeScanner.scan(server.toString(), statePath);
        assertEquals(0, second.newCount());
        assertEquals(1, second.unreviewed());
        // Unchanged fingerprint → no re-narrate (blank plain_english on this pass; preserve via ops merge)
        assertTrue(second.entries().get(0).plainEnglish() == null
                || second.entries().get(0).plainEnglish().isBlank());

        Map<String, Long> index = StateManager.getCrashMtimeIndex(statePath);
        assertTrue(index.containsKey("crash-test.txt"));
    }

    @Test
    void scan_forceReenrich_reclassifiesUnchangedFingerprints() throws IOException {
        Path server = temp.resolve("server");
        Path crashDir = server.resolve("crash-reports");
        Files.createDirectories(crashDir);
        Path statePath = temp.resolve("state.json");

        Files.writeString(crashDir.resolve("fml-load.txt"), """
                ---- Minecraft Crash Report ----
                Description: Mod loading failures have occurred; consult the issue messages for more details
                net.neoforged.neoforge.logging.CrashReportExtender$ModLoadingCrashException: Mod loading has failed
                -- Mod loading issue for: alloyed --
                """, StandardCharsets.UTF_8);

        CrashMtimeScanner.ScanResult first = CrashMtimeScanner.scan(server.toString(), statePath);
        StateManager.updateCrashMtimeIndex(statePath, first.updatedIndex());
        StateManager.updateCrashFingerprintIndex(statePath, first.updatedFingerprints());

        CrashMtimeScanner.ScanResult forced = CrashMtimeScanner.scan(
                server.toString(), statePath, true, true);
        assertEquals(1, forced.entries().size());
        assertEquals(CrashClassifier.FK_MOD_LOAD_DEPENDENCY, forced.entries().get(0).failureKind());
        assertEquals("alloyed", forced.entries().get(0).primaryModId());
        assertNotNull(forced.entries().get(0).plainEnglish());
        assertFalse(forced.entries().get(0).plainEnglish().isBlank());
    }

    @Test
    void scan_classifiesWatchdogAndModLoadHead() throws IOException {
        Path server = temp.resolve("server");
        Path crashDir = server.resolve("crash-reports");
        Files.createDirectories(crashDir);
        Path statePath = temp.resolve("state.json");

        Files.writeString(crashDir.resolve("watchdog.txt"), """
                ---- Minecraft Crash Report ----
                Description: Watching Server
                java.lang.Error: ServerHangWatchdog detected that a single server tick took 60.00 seconds
                at TRANSFORMER/squaremap@1.3.2/xyz.jpenilla.squaremap.common.util.chunksnapshot.VanillaChunkSnapshotProvider.chunkIfGenerated(VanillaChunkSnapshotProvider.java:97)
                """, StandardCharsets.UTF_8);

        Files.writeString(crashDir.resolve("fml-load.txt"), """
                ---- Minecraft Crash Report ----
                Description: Mod loading failures have occurred; consult the issue messages for more details
                net.neoforged.neoforge.logging.CrashReportExtender$ModLoadingCrashException: Mod loading has failed
                -- Mod loading issue for: alloyed --
                """, StandardCharsets.UTF_8);

        CrashMtimeScanner.ScanResult scan = CrashMtimeScanner.scan(server.toString(), statePath);
        assertEquals(2, scan.entries().size());

        CrashMtimeScanner.CrashEntry watchdog = scan.entries().stream()
                .filter(e -> "watchdog.txt".equals(e.file()))
                .findFirst()
                .orElseThrow();
        assertEquals(CrashClassifier.FK_WATCHDOG_PREGEN, watchdog.failureKind());
        assertEquals("squaremap", watchdog.stallModId());

        CrashMtimeScanner.CrashEntry fml = scan.entries().stream()
                .filter(e -> "fml-load.txt".equals(e.file()))
                .findFirst()
                .orElseThrow();
        assertEquals(CrashClassifier.FK_MOD_LOAD_DEPENDENCY, fml.failureKind());
        assertEquals("alloyed", fml.primaryModId());
    }
}
