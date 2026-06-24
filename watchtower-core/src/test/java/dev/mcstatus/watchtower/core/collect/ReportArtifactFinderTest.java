package dev.mcstatus.watchtower.core.collect;

import dev.mcstatus.watchtower.core.WatchtowerFiles;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.FileTime;
import java.time.Instant;

import static org.junit.jupiter.api.Assertions.*;

class ReportArtifactFinderTest {

    @TempDir
    Path reportDir;

    @Test
    void findsNewestFactsByMtime() throws Exception {
        Path older = reportDir.resolve(WatchtowerFiles.FACTS_PREFIX + "2026-06-01.json");
        Path newer = reportDir.resolve(WatchtowerFiles.FACTS_PREFIX + "2026-06-02.json");
        Files.writeString(older, "{}", StandardCharsets.UTF_8);
        Files.writeString(newer, "{}", StandardCharsets.UTF_8);
        Files.setLastModifiedTime(older, FileTime.from(Instant.parse("2026-06-01T00:00:00Z")));
        Files.setLastModifiedTime(newer, FileTime.from(Instant.parse("2026-06-02T00:00:00Z")));

        assertEquals(newer, ReportArtifactFinder.findLatestFacts(reportDir));
    }

    @Test
    void findsNewestBriefByMtime() throws Exception {
        Path older = reportDir.resolve(WatchtowerFiles.BRIEF_PREFIX + "old.txt");
        Path newer = reportDir.resolve(WatchtowerFiles.BRIEF_PREFIX + "new.txt");
        Files.writeString(older, "old", StandardCharsets.UTF_8);
        Files.writeString(newer, "new", StandardCharsets.UTF_8);
        Files.setLastModifiedTime(older, FileTime.from(Instant.parse("2026-06-01T00:00:00Z")));
        Files.setLastModifiedTime(newer, FileTime.from(Instant.parse("2026-06-03T00:00:00Z")));

        assertEquals(newer, ReportArtifactFinder.findLatestBrief(reportDir));
    }

    @Test
    void returnsNullWhenDirectoryMissing() throws Exception {
        Path missing = reportDir.resolve("missing");
        assertNull(ReportArtifactFinder.findLatestFacts(missing));
    }
}
