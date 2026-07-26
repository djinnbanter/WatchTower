package dev.mcstatus.watchtower.core.collect;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.FileTime;
import java.time.Instant;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ReportArtifactFinderSupportTest {

    @TempDir
    Path temp;

    @Test
    void findLatestFactsSkipsSupportComposeArtifacts() throws Exception {
        Files.writeString(temp.resolve("watchtower-facts-support-2026-01-01.json"), "{}");
        Files.writeString(temp.resolve("watchtower-facts-2020-06-01.json"), "{}");

        Path latest = ReportArtifactFinder.findLatestFacts(temp);
        assertTrue(latest != null && latest.getFileName().toString().equals("watchtower-facts-2020-06-01.json"));
    }

    @Test
    void onlySupportArtifactsReturnsNull() throws Exception {
        Files.writeString(temp.resolve("watchtower-facts-support-2026-01-01.json"), "{}");
        assertNull(ReportArtifactFinder.findLatestFacts(temp));
    }

    @Test
    void listFactsFilesExcludesSupportComposeArtifacts() throws Exception {
        Path support = temp.resolve("watchtower-facts-support-2026-01-01.json");
        Path older = temp.resolve("watchtower-facts-2019-01-01.json");
        Path newer = temp.resolve("watchtower-facts-2020-06-01.json");
        Files.writeString(support, "{}");
        Files.writeString(older, "{}");
        Files.writeString(newer, "{}");
        Files.setLastModifiedTime(older, FileTime.from(Instant.parse("2019-01-01T00:00:00Z")));
        Files.setLastModifiedTime(newer, FileTime.from(Instant.parse("2020-06-01T00:00:00Z")));
        Files.setLastModifiedTime(support, FileTime.from(Instant.parse("2026-01-01T00:00:00Z")));

        var listed = ReportArtifactFinder.listFactsFiles(temp);
        assertEquals(2, listed.size());
        assertTrue(listed.stream().noneMatch(p ->
                ReportArtifactFinder.isSupportArtifact(p.getFileName().toString())));
        assertEquals("watchtower-facts-2020-06-01.json", listed.get(0).getFileName().toString());
    }

    @Test
    void findLatestBriefSkipsSupportComposeArtifacts() throws Exception {
        Files.writeString(temp.resolve("watchtower-brief-support-2026-01-01.txt"), "support");
        Files.writeString(temp.resolve("watchtower-brief-2020-06-01.txt"), "legacy");
        Path latest = ReportArtifactFinder.findLatestBrief(temp);
        assertTrue(latest != null && latest.getFileName().toString().equals("watchtower-brief-2020-06-01.txt"));
    }
}
