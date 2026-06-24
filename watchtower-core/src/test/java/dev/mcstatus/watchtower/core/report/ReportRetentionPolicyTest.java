package dev.mcstatus.watchtower.core.report;

import dev.mcstatus.watchtower.core.WatchtowerFiles;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.FileTime;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class ReportRetentionPolicyTest {

    @TempDir
    Path reportDir;

    @Test
    void keepsNewestWithinCountAndAge() throws Exception {
        Path keep = writePair("2026-06-03", Instant.parse("2026-06-03T12:00:00Z"));
        Path dropExcess = writePair("2026-06-02", Instant.parse("2026-06-02T12:00:00Z"));
        Path dropOld = writePair("2026-06-01", Instant.parse("2026-01-01T12:00:00Z"));

        int deleted = ReportRetentionPolicy.prune(reportDir, 1, 90);

        assertEquals(2, deleted);
        assertTrue(Files.exists(keep));
        assertFalse(Files.exists(dropOld));
        assertFalse(Files.exists(dropExcess));
        assertFalse(Files.exists(matchingBrief(dropExcess)));
    }

    @Test
    void deletesMatchingBriefPairs() throws Exception {
        Instant old = Instant.now().minus(120, ChronoUnit.DAYS);
        Path facts = writePair("old-report", old);
        Path brief = matchingBrief(facts);

        assertEquals(1, ReportRetentionPolicy.prune(reportDir, 30, 90));
        assertFalse(Files.exists(facts));
        assertFalse(Files.exists(brief));
    }

    @Test
    void returnsZeroWhenDirectoryMissing() throws Exception {
        assertEquals(0, ReportRetentionPolicy.prune(reportDir.resolve("missing"), 30, 90));
    }

    @Test
    void listFactsFilesSortedNewestFirst() throws Exception {
        Path older = writeFacts("a", Instant.parse("2026-06-01T00:00:00Z"));
        Path newer = writeFacts("b", Instant.parse("2026-06-03T00:00:00Z"));

        List<Path> listed = dev.mcstatus.watchtower.core.collect.ReportArtifactFinder.listFactsFiles(reportDir);

        assertEquals(newer, listed.get(0));
        assertEquals(older, listed.get(1));
    }

    private Path writePair(String stamp, Instant mtime) throws Exception {
        Path facts = writeFacts(stamp, mtime);
        Path brief = matchingBrief(facts);
        Files.writeString(brief, "brief", StandardCharsets.UTF_8);
        Files.setLastModifiedTime(brief, FileTime.from(mtime));
        return facts;
    }

    private Path writeFacts(String stamp, Instant mtime) throws Exception {
        Path facts = reportDir.resolve(WatchtowerFiles.FACTS_PREFIX + stamp + ".json");
        Files.writeString(facts, "{}", StandardCharsets.UTF_8);
        Files.setLastModifiedTime(facts, FileTime.from(mtime));
        return facts;
    }

    private static Path matchingBrief(Path facts) {
        return ReportRetentionPolicy.matchingBrief(facts.getParent(), facts);
    }
}
