package dev.mcstatus.watchtower.core.report;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import dev.mcstatus.watchtower.core.WatchtowerFiles;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.FileTime;
import java.time.Instant;
import java.util.zip.ZipFile;

import static org.junit.jupiter.api.Assertions.*;

class DrBundlePackagerTest {

    @TempDir
    Path serverDir;

    @TempDir
    Path outDir;

    @Test
    void packagesBundleWithWindowMatchedLogs() throws Exception {
        long now = Instant.now().getEpochSecond();
        Path logs = serverDir.resolve("logs");
        Files.createDirectories(logs);
        Path latest = logs.resolve("latest.log");
        Files.writeString(latest, "FATAL Mod loading has failed\n", StandardCharsets.UTF_8);
        Files.setLastModifiedTime(latest, FileTime.from(Instant.ofEpochSecond(now - 30)));

        Path factsPath = outDir.resolve(WatchtowerFiles.FACTS_PREFIX + "test.json");
        Path briefPath = outDir.resolve(WatchtowerFiles.BRIEF_PREFIX + "test.txt");
        Files.writeString(factsPath, "{\"meta\":{\"report_mode\":\"dr\"},\"health\":{},\"issues\":[]}\n",
                StandardCharsets.UTF_8);
        Files.writeString(briefPath, "Watchtower DR test brief\n", StandardCharsets.UTF_8);

        Path incidentsDir = serverDir.resolve("watchtower").resolve("incidents");
        Files.createDirectories(incidentsDir);
        Files.writeString(incidentsDir.resolve("2026-06-22T14-03-12Z.json"),
                "{\"id\":\"2026-06-22T14-03-12Z\",\"source\":\"auto\",\"narrative\":\"test\"}\n",
                StandardCharsets.UTF_8);

        JsonObject facts = JsonParser.parseString(Files.readString(factsPath)).getAsJsonObject();
        DrLogFileSelector.DrLogSelection selection = DrLogFileSelector.select(serverDir, 30);
        DrLogCorrelation.CorrelationResult correlation = DrLogCorrelation.correlate(selection);

        DrBundlePackager.BundleResult result = DrBundlePackager.packageBundle(
                outDir, serverDir, factsPath, briefPath, facts, selection, correlation);

        DrModListDiffAnalyzer.ModDiffResult modDiff = DrModListDiffAnalyzer.analyze(selection);

        DrBundlePackager.enrichFacts(facts, selection, correlation, modDiff, result.zipPath(), result.warnings());
        DrBundlePackager.rewriteFacts(factsPath, facts);

        assertTrue(Files.isRegularFile(result.zipPath()));
        assertTrue(result.sizeBytes() > 0);
        try (ZipFile zip = new ZipFile(result.zipPath().toFile())) {
            assertNotNull(zip.getEntry("incidents/2026-06-22T14-03-12Z.json"));
        }
        assertEquals(1, selection.regular().size());
        assertFalse(correlation.attempts().isEmpty());

        JsonObject enriched = JsonParser.parseString(Files.readString(factsPath)).getAsJsonObject();
        assertTrue(enriched.getAsJsonObject("meta").has("dr_bundle"), "facts should include meta.dr_bundle");
        assertTrue(enriched.getAsJsonObject("optional").has("dr_log_correlation"),
                "facts should include optional.dr_log_correlation");
    }
}
