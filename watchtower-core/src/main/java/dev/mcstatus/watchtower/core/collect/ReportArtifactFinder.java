package dev.mcstatus.watchtower.core.collect;

import dev.mcstatus.watchtower.core.WatchtowerFiles;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Comparator;
import java.util.List;

/**
 * Locates newest on-disk Watchtower report artifacts under {@code watchtower/}.
 */
public final class ReportArtifactFinder {

    private ReportArtifactFinder() {
    }

    public static Path findLatestFacts(Path reportDir) throws IOException {
        return findLatest(reportDir, WatchtowerFiles.FACTS_PREFIX, ".json", true);
    }

    public static Path findLatestBrief(Path reportDir) throws IOException {
        return findLatest(reportDir, WatchtowerFiles.BRIEF_PREFIX, ".txt", true);
    }

    public static List<Path> listFactsFiles(Path reportDir) throws IOException {
        if (!Files.isDirectory(reportDir)) {
            return List.of();
        }
        try (var stream = Files.list(reportDir)) {
            return stream
                    .filter(p -> {
                        String name = p.getFileName().toString();
                        return name.startsWith(WatchtowerFiles.FACTS_PREFIX)
                                && name.endsWith(".json")
                                && !isSupportArtifact(name);
                    })
                    .sorted(Comparator.comparingLong(ReportArtifactFinder::mtimeMillis).reversed())
                    .toList();
        }
    }

    private static Path findLatest(Path reportDir, String prefix, String suffix, boolean excludeSupport) throws IOException {
        if (!Files.isDirectory(reportDir)) {
            return null;
        }
        try (var stream = Files.list(reportDir)) {
            return stream
                    .filter(p -> {
                        String name = p.getFileName().toString();
                        if (!name.startsWith(prefix) || !name.endsWith(suffix)) {
                            return false;
                        }
                        return !excludeSupport || !isSupportArtifact(name);
                    })
                    .max(Comparator.comparingLong(ReportArtifactFinder::mtimeMillis))
                    .orElse(null);
        }
    }

    /** True for Support-compose artifacts ({@code *-support-*}), excluded from BAU report indexes. */
    public static boolean isSupportArtifact(String fileName) {
        return fileName != null && fileName.contains(WatchtowerFiles.SUPPORT_FACTS_INFIX);
    }

    private static Path findLatest(Path reportDir, String prefix, String suffix) throws IOException {
        return findLatest(reportDir, prefix, suffix, false);
    }

    private static long mtimeMillis(Path p) {
        try {
            return Files.getLastModifiedTime(p).toMillis();
        } catch (IOException e) {
            return 0L;
        }
    }
}
