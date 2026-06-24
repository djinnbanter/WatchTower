package dev.mcstatus.watchtower.core.report;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;

import static org.junit.jupiter.api.Assertions.*;

class DrModListDiffAnalyzerTest {

    private static final DateTimeFormatter LOG_TS =
            DateTimeFormatter.ofPattern("ddMMMyyyy HH:mm:ss.SSS");

    @TempDir
    Path serverDir;

    @Test
    void detectsAddedModSinceBaseline() throws Exception {
        Path logs = serverDir.resolve("logs");
        Files.createDirectories(logs);

        String baseTs = ZonedDateTime.now().minusHours(1).format(LOG_TS);
        String baseline = """
                [%s] [Server thread/INFO] [minecraft/DedicatedServer]: Done (1.0s)! For help, type "help"
                [%s] [create/INFO]: Initializing create mod
                """.formatted(baseTs, baseTs);
        Path baseFile = logs.resolve("2026-06-16-1.log.gz");
        // write as plain file for test simplicity — parser uses GzipLineReader which handles non-gz
        Files.writeString(logs.resolve("baseline.log"), baseline, StandardCharsets.UTF_8);

        String now = ZonedDateTime.now().format(LOG_TS);
        String latest = """
                [%s] [pride/INFO]: Initializing pride mod
                [%s] [main/ERROR] Mod loading has failed
                """.formatted(now, now);
        Files.writeString(logs.resolve("latest.log"), latest, StandardCharsets.UTF_8);

        DrLogAnchorFinder.LogAnchor anchor = new DrLogAnchorFinder.LogAnchor(
                true,
                DrLogAnchorFinder.AnchorStatus.found,
                java.time.Instant.now().minusSeconds(3600),
                logs.resolve("baseline.log"),
                "logs/regular/baseline.log",
                1,
                "Done");

        DrLogFileSelector.DrLogSelection selection = new DrLogFileSelector.DrLogSelection(
                java.util.List.of(new DrLogFileSelector.SelectedLogFile(
                        logs.resolve("latest.log"), "logs/regular/latest.log", "regular",
                        java.time.Instant.now().getEpochSecond())),
                java.util.List.of(),
                java.util.List.of(),
                java.time.Instant.now().minusSeconds(3600),
                1440,
                DrLogAnchorFinder.POLICY_SINCE_LAST_START,
                anchor,
                DrLogAnchorFinder.AnchorStatus.found);

        DrModListFromLogParser.ParsedModList baselineParsed =
                DrModListFromLogParser.parse(logs.resolve("baseline.log"), "logs/regular/baseline.log");
        assertTrue(baselineParsed.mods().containsKey("create"));

        DrModListDiffAnalyzer.ModDiffResult diff = DrModListDiffAnalyzer.analyze(selection);
        assertTrue(diff.latest().mods().containsKey("pride"));
    }
}
