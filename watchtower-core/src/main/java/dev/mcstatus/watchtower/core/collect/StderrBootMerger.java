package dev.mcstatus.watchtower.core.collect;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

/**
 * CA-31 — read existing stderr log files into the boot timeline (no System.err hijack).
 */
public final class StderrBootMerger {

    private static final int MAX_EXCERPT_LINES = 80;

    private StderrBootMerger() {
    }

    public record Result(List<String> lines, List<String> sources, List<String> excerpt) {
    }

    /**
     * @param serverDir server root
     * @param stderrPathsCsv relative paths from {@code FORENSICS_STDERR_PATHS}
     */
    public static Result merge(Path serverDir, String stderrPathsCsv) {
        List<String> lines = new ArrayList<>();
        List<String> sources = new ArrayList<>();
        List<String> excerpt = new ArrayList<>();
        if (serverDir == null || !Files.isDirectory(serverDir)) {
            return new Result(lines, sources, excerpt);
        }
        String csv = stderrPathsCsv != null && !stderrPathsCsv.isBlank()
                ? stderrPathsCsv
                : "logs/stderr.log,logs/stderr_stream.log";
        for (String part : csv.split(",")) {
            String rel = part.strip();
            if (rel.isEmpty()) {
                continue;
            }
            Path file = serverDir.resolve(rel).normalize();
            if (!file.startsWith(serverDir.toAbsolutePath().normalize())) {
                continue;
            }
            if (!Files.isRegularFile(file)) {
                continue;
            }
            try {
                List<String> fileLines = Files.readAllLines(file, StandardCharsets.UTF_8);
                if (fileLines.isEmpty()) {
                    continue;
                }
                sources.add(rel.replace('\\', '/'));
                for (String line : fileLines) {
                    lines.add("[stderr] " + line);
                }
                int from = Math.max(0, fileLines.size() - MAX_EXCERPT_LINES);
                for (int i = from; i < fileLines.size(); i++) {
                    excerpt.add(fileLines.get(i));
                    if (excerpt.size() >= MAX_EXCERPT_LINES) {
                        break;
                    }
                }
            } catch (IOException ignored) {
                // skip unreadable
            }
        }
        return new Result(lines, sources, excerpt);
    }
}
