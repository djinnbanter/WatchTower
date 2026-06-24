package dev.mcstatus.watchtower.core.report;

import dev.mcstatus.watchtower.core.WatchtowerFiles;
import dev.mcstatus.watchtower.core.collect.ReportArtifactFinder;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

/**
 * Prunes on-disk facts/brief report pairs under {@code watchtower/}.
 * A file is kept only when it is among the newest N <em>and</em> younger than N days.
 */
public final class ReportRetentionPolicy {

    public static final int DEFAULT_RETENTION_COUNT = 30;
    public static final int DEFAULT_RETENTION_DAYS = 90;

    private ReportRetentionPolicy() {
    }

    /**
     * @return number of facts files deleted (matching brief files are removed too)
     */
    public static int prune(Path reportDir, int retentionCount, int retentionDays) throws IOException {
        if (!Files.isDirectory(reportDir)) {
            return 0;
        }
        List<Path> facts = ReportArtifactFinder.listFactsFiles(reportDir);
        if (facts.isEmpty()) {
            return 0;
        }
        int keepCount = Math.max(1, retentionCount);
        int keepDays = Math.max(1, retentionDays);
        long cutoffMillis = Instant.now().minus(keepDays, ChronoUnit.DAYS).toEpochMilli();

        int deleted = 0;
        for (int i = 0; i < facts.size(); i++) {
            Path factsPath = facts.get(i);
            boolean inTopN = i < keepCount;
            long mtime = mtimeMillis(factsPath);
            boolean youngEnough = mtime >= cutoffMillis;
            if (inTopN && youngEnough) {
                continue;
            }
            if (Files.deleteIfExists(factsPath)) {
                deleted++;
            }
            Path brief = matchingBrief(reportDir, factsPath);
            if (brief != null) {
                Files.deleteIfExists(brief);
            }
        }
        return deleted;
    }

    static Path matchingBrief(Path reportDir, Path factsPath) {
        String name = factsPath.getFileName().toString();
        if (!name.startsWith(WatchtowerFiles.FACTS_PREFIX) || !name.endsWith(".json")) {
            return null;
        }
        String suffix = name.substring(WatchtowerFiles.FACTS_PREFIX.length(), name.length() - ".json".length());
        return reportDir.resolve(WatchtowerFiles.BRIEF_PREFIX + suffix + ".txt");
    }

    private static long mtimeMillis(Path path) {
        try {
            return Files.getLastModifiedTime(path).toMillis();
        } catch (IOException e) {
            return 0L;
        }
    }
}
