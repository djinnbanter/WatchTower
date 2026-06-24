package dev.mcstatus.watchtower.core.report;

import dev.mcstatus.watchtower.core.collect.CollectSupport;
import dev.mcstatus.watchtower.core.collect.GzipLineReader;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.concurrent.atomic.AtomicReference;
import java.util.stream.Stream;

/**
 * Finds the last successful Minecraft server start ({@code Done (} … {@code /INFO]}) in regular logs.
 */
public final class DrLogAnchorFinder {

    public static final String POLICY_SINCE_LAST_START = "since_last_successful_start";

    private DrLogAnchorFinder() {
    }

    public enum AnchorStatus {
        found,
        not_found
    }

    public record LogAnchor(
            boolean found,
            AnchorStatus status,
            Instant anchorTime,
            Path sourcePath,
            String zipEntryPath,
            int line,
            String quote
    ) {
        public long anchorEpochSec() {
            return anchorTime != null ? anchorTime.getEpochSecond() : 0L;
        }

        public static LogAnchor notFound() {
            return new LogAnchor(false, AnchorStatus.not_found, null, null, null, 0, null);
        }
    }

    public record AnchorSelection(
            LogAnchor anchor,
            Instant windowStart,
            int fallbackMinutes,
            Instant safetyCapStart
    ) {
    }

    /**
     * Resolve window start from last successful start, capped by {@code fallbackMinutes}.
     */
    public static AnchorSelection resolve(Path serverDir, int fallbackMinutes) {
        LogAnchor anchor = findLastSuccessfulStart(serverDir);
        long nowSec = Instant.now().getEpochSecond();
        long capStartSec = nowSec - (long) fallbackMinutes * 60L;
        Instant safetyCapStart = Instant.ofEpochSecond(capStartSec);

        Instant windowStart;
        if (anchor.found()) {
            long anchorSec = anchor.anchorEpochSec();
            long effectiveSec = Math.max(anchorSec, capStartSec);
            windowStart = Instant.ofEpochSecond(effectiveSec);
        } else {
            windowStart = safetyCapStart;
        }
        return new AnchorSelection(anchor, windowStart, fallbackMinutes, safetyCapStart);
    }

    public static LogAnchor findLastSuccessfulStart(Path serverDir) {
        Path logsDir = serverDir.resolve("logs");
        if (!Files.isDirectory(logsDir)) {
            return LogAnchor.notFound();
        }

        List<Path> candidates = new ArrayList<>();
        Path latest = logsDir.resolve("latest.log");
        if (Files.isRegularFile(latest)) {
            candidates.add(latest);
        }
        try (Stream<Path> stream = Files.list(logsDir)) {
            stream.filter(Files::isRegularFile)
                    .filter(p -> p.getFileName().toString().endsWith(".log.gz"))
                    .filter(p -> !p.getFileName().toString().startsWith("debug"))
                    .sorted(Comparator.comparingLong(DrLogFileSelector::mtimeSec).reversed())
                    .forEach(candidates::add);
        } catch (IOException ignored) {
        }

        LogAnchor best = LogAnchor.notFound();
        for (Path logPath : candidates) {
            LogAnchor found = scanFileForLastSuccess(logPath, zipEntryFor(logPath));
            if (found.found()) {
                if (!best.found() || found.anchorEpochSec() > best.anchorEpochSec()) {
                    best = found;
                }
            }
        }
        return best;
    }

    private static LogAnchor scanFileForLastSuccess(Path logPath, String zipEntry) {
        AtomicReference<LogAnchor> last = new AtomicReference<>(LogAnchor.notFound());
        try {
            GzipLineReader.forEachLine(logPath, (lineNo, line) -> {
                String stripped = line.strip();
                if (!stripped.contains("Done (") || !stripped.contains("/INFO]")) {
                    return;
                }
                ZonedDateTime ts = CollectSupport.parseLogTs(line);
                Instant instant = ts != null ? ts.toInstant() : Instant.ofEpochSecond(DrLogFileSelector.mtimeSec(logPath));
                String quote = stripped.length() > 200 ? stripped.substring(0, 200) : stripped;
                last.set(new LogAnchor(true, AnchorStatus.found, instant, logPath, zipEntry, lineNo, quote));
            });
        } catch (IOException ignored) {
        }
        return last.get();
    }

    static String zipEntryFor(Path logPath) {
        String name = logPath.getFileName().toString();
        if ("latest.log".equals(name)) {
            return "logs/regular/latest.log";
        }
        return "logs/regular/" + name;
    }
}
