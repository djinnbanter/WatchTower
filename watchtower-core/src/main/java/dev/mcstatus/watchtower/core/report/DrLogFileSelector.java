package dev.mcstatus.watchtower.core.report;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.stream.Stream;

/**
 * Selects regular, debug, and crash log files since last successful server start (with safety cap).
 */
public final class DrLogFileSelector {

    private DrLogFileSelector() {
    }

    public record SelectedLogFile(
            Path sourcePath,
            String zipEntryPath,
            String category,
            long mtimeEpochSec
    ) {
    }

    public record DrLogSelection(
            List<SelectedLogFile> regular,
            List<SelectedLogFile> debug,
            List<SelectedLogFile> crash,
            Instant windowStart,
            int fallbackMinutes,
            String selectionPolicy,
            DrLogAnchorFinder.LogAnchor anchor,
            DrLogAnchorFinder.AnchorStatus anchorStatus
    ) {
        public int totalCount() {
            return regular.size() + debug.size() + crash.size();
        }

        /** @deprecated use {@link #fallbackMinutes()} */
        public int lookbackMinutes() {
            return fallbackMinutes;
        }
    }

    public static DrLogSelection select(Path serverDir, int fallbackMinutes) {
        DrLogAnchorFinder.AnchorSelection anchorSel = DrLogAnchorFinder.resolve(serverDir, fallbackMinutes);
        long windowStartSec = anchorSel.windowStart().getEpochSecond();
        long capStartSec = anchorSel.safetyCapStart().getEpochSecond();

        Path logsDir = serverDir.resolve("logs");
        Path crashDir = serverDir.resolve("crash-reports");

        List<SelectedLogFile> regular = new ArrayList<>();
        List<SelectedLogFile> debug = new ArrayList<>();
        List<SelectedLogFile> crash = new ArrayList<>();
        Set<String> seenRegular = new HashSet<>();
        Set<String> seenDebug = new HashSet<>();
        Set<String> seenCrash = new HashSet<>();

        DrLogAnchorFinder.LogAnchor anchor = anchorSel.anchor();
        if (anchor.found() && anchor.sourcePath() != null) {
            addRegular(regular, seenRegular, anchor.sourcePath(), anchor.zipEntryPath());
        }

        if (Files.isDirectory(logsDir)) {
            Path latest = logsDir.resolve("latest.log");
            if (Files.isRegularFile(latest)) {
                addRegular(regular, seenRegular, latest, "logs/regular/latest.log");
            }
            Path debugLog = logsDir.resolve("debug.log");
            if (Files.isRegularFile(debugLog)) {
                addDebug(debug, seenDebug, debugLog, "logs/debug/debug.log");
            }

            try (Stream<Path> stream = Files.list(logsDir)) {
                List<Path> gzFiles = stream
                        .filter(Files::isRegularFile)
                        .filter(p -> p.getFileName().toString().endsWith(".log.gz"))
                        .sorted(Comparator.comparingLong(DrLogFileSelector::mtimeSec))
                        .toList();
                for (Path p : gzFiles) {
                    if (mtimeSec(p) < windowStartSec && mtimeSec(p) < capStartSec) {
                        continue;
                    }
                    if (mtimeSec(p) < windowStartSec && !isBaselineFile(p, anchor)) {
                        continue;
                    }
                    String name = p.getFileName().toString();
                    if (name.startsWith("debug")) {
                        addDebug(debug, seenDebug, p, "logs/debug/" + name);
                    } else {
                        addRegular(regular, seenRegular, p, "logs/regular/" + name);
                    }
                }
            } catch (IOException ignored) {
            }
        }

        if (Files.isDirectory(crashDir)) {
            try (Stream<Path> stream = Files.list(crashDir)) {
                stream.filter(Files::isRegularFile)
                        .filter(p -> p.getFileName().toString().endsWith(".txt"))
                        .filter(p -> mtimeSec(p) >= windowStartSec)
                        .sorted(Comparator.comparingLong(DrLogFileSelector::mtimeSec))
                        .forEach(p -> addCrash(crash, seenCrash, p));
            } catch (IOException ignored) {
            }
        }

        regular.sort(Comparator.comparingLong(SelectedLogFile::mtimeEpochSec));
        debug.sort(Comparator.comparingLong(SelectedLogFile::mtimeEpochSec));
        crash.sort(Comparator.comparingLong(SelectedLogFile::mtimeEpochSec));

        return new DrLogSelection(
                regular,
                debug,
                crash,
                anchorSel.windowStart(),
                fallbackMinutes,
                DrLogAnchorFinder.POLICY_SINCE_LAST_START,
                anchor,
                anchor.found() ? DrLogAnchorFinder.AnchorStatus.found : DrLogAnchorFinder.AnchorStatus.not_found);
    }

    private static boolean isBaselineFile(Path p, DrLogAnchorFinder.LogAnchor anchor) {
        return anchor.found() && anchor.sourcePath() != null && anchor.sourcePath().equals(p);
    }

    private static void addRegular(List<SelectedLogFile> list, Set<String> seen, Path path, String zipEntry) {
        if (seen.add(zipEntry)) {
            list.add(toSelected(path, zipEntry, "regular"));
        }
    }

    private static void addDebug(List<SelectedLogFile> list, Set<String> seen, Path path, String zipEntry) {
        if (seen.add(zipEntry)) {
            list.add(toSelected(path, zipEntry, "debug"));
        }
    }

    private static void addCrash(List<SelectedLogFile> list, Set<String> seen, Path path) {
        String zipEntry = "crash-reports/" + path.getFileName();
        if (seen.add(zipEntry)) {
            list.add(toSelected(path, zipEntry, "crash"));
        }
    }

    private static SelectedLogFile toSelected(Path path, String zipEntry, String category) {
        return new SelectedLogFile(path, zipEntry, category, mtimeSec(path));
    }

    static long mtimeSec(Path p) {
        try {
            return Files.getLastModifiedTime(p).toInstant().getEpochSecond();
        } catch (IOException e) {
            return 0L;
        }
    }
}
