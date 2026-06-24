package dev.mcstatus.watchtower.core.collect;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.function.BiConsumer;
import java.util.zip.GZIPInputStream;

/**
 * Iterate Minecraft log files including gzip archives.
 */
public final class GzipLineReader {

    private GzipLineReader() {
    }

    public static List<Path> iterLogFiles(String serverDir, int gzipCount, double windowStart) {
        Path base = Path.of(serverDir, "logs");
        if (!Files.isDirectory(base)) {
            return List.of();
        }
        List<Path> files = new ArrayList<>();
        for (String name : List.of("latest.log", "debug.log")) {
            Path p = base.resolve(name);
            if (Files.isRegularFile(p)) {
                files.add(p);
            }
        }
        List<Path> gzFiles = new ArrayList<>();
        try (var stream = Files.list(base)) {
            stream.filter(p -> p.getFileName().toString().endsWith(".log.gz"))
                    .forEach(gzFiles::add);
        } catch (IOException e) {
            return files;
        }
        gzFiles.sort(Comparator.comparingLong(GzipLineReader::mtime).reversed());
        final int maxGzInWindow = Math.max(gzipCount * 8, 50);
        int added = 0;
        for (Path p : gzFiles) {
            if (mtime(p) < windowStart - 3600) {
                continue;
            }
            files.add(p);
            added++;
            if (added >= maxGzInWindow) {
                break;
            }
        }
        return files;
    }

    private static long mtime(Path p) {
        try {
            return Files.getLastModifiedTime(p).toMillis() / 1000L;
        } catch (IOException e) {
            return 0;
        }
    }

    public static void forEachLine(Path logPath, BiConsumer<Integer, String> consumer) throws IOException {
        String name = logPath.getFileName().toString();
        if (name.endsWith(".gz")) {
            try (var gis = new GZIPInputStream(Files.newInputStream(logPath));
                 var reader = new BufferedReader(new InputStreamReader(gis, StandardCharsets.UTF_8))) {
                int lineNo = 0;
                String line;
                while ((line = reader.readLine()) != null) {
                    lineNo++;
                    consumer.accept(lineNo, line);
                }
            }
        } else {
            try (var reader = Files.newBufferedReader(logPath, StandardCharsets.UTF_8)) {
                int lineNo = 0;
                String line;
                while ((line = reader.readLine()) != null) {
                    lineNo++;
                    consumer.accept(lineNo, line);
                }
            }
        }
    }
}
