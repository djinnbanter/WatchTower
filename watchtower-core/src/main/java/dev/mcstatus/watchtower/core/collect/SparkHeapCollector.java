package dev.mcstatus.watchtower.core.collect;

import dev.mcstatus.watchtower.core.report.ReportConfig;
import me.lucko.spark.proto.SparkHeapProtos;

import java.io.IOException;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.FileTime;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

/**
 * Locates the newest valid {@code .sparkheap} export on disk.
 */
public final class SparkHeapCollector {

    private SparkHeapCollector() {
    }

    public static Optional<SparkHeapCollectResult> collect(String serverDir, ReportConfig config) {
        if (!config.sparkEnabled() || serverDir == null || serverDir.isBlank()) {
            return Optional.empty();
        }
        Path root = Path.of(serverDir);
        if (!Files.isDirectory(root)) {
            return Optional.empty();
        }

        List<SearchDir> dirs = new ArrayList<>();
        String uploadOverride = config.sparkUploadDir();
        if (uploadOverride != null && !uploadOverride.isBlank()) {
            dirs.add(new SearchDir(root.resolve(uploadOverride), "spark_upload"));
        } else {
            dirs.add(new SearchDir(root.resolve("watchtower").resolve("spark-upload"), "spark_upload"));
        }
        dirs.add(new SearchDir(root.resolve("config").resolve("spark"), "config_spark"));
        dirs.add(new SearchDir(root.resolve("spark"), "legacy_spark"));

        Optional<Candidate> newest = Optional.empty();
        for (SearchDir dir : dirs) {
            newest = pickNewest(newest, scanDir(dir));
        }
        if (newest.isEmpty()) {
            return Optional.empty();
        }

        Candidate c = newest.get();
        try {
            byte[] bytes = Files.readAllBytes(c.path());
            SparkHeapProtos.HeapData data = SparkHeapProtos.HeapData.parseFrom(bytes);
            if (!data.hasMetadata()) {
                return Optional.empty();
            }
            Instant captured = SparkCaptureTimes.resolveHeap(data, c.mtime());
            return Optional.of(new SparkHeapCollectResult(
                    c.path(),
                    c.path().getFileName().toString(),
                    c.sourceKind(),
                    captured,
                    data));
        } catch (Exception ignored) {
            return Optional.empty();
        }
    }

    private static Optional<Candidate> scanDir(SearchDir dir) {
        Path path = dir.path();
        if (!Files.isDirectory(path)) {
            return Optional.empty();
        }
        Optional<Candidate> newest = Optional.empty();
        try (DirectoryStream<Path> stream = Files.newDirectoryStream(path, "*.sparkheap")) {
            for (Path file : stream) {
                if (!Files.isRegularFile(file)) {
                    continue;
                }
                FileTime mtime = Files.getLastModifiedTime(file);
                Candidate cand = new Candidate(file, dir.sourceKind(), mtime.toInstant());
                newest = pickNewest(newest, Optional.of(cand));
            }
        } catch (IOException ignored) {
            return Optional.empty();
        }
        return newest;
    }

    private static Optional<Candidate> pickNewest(Optional<Candidate> a, Optional<Candidate> b) {
        if (a.isEmpty()) {
            return b;
        }
        if (b.isEmpty()) {
            return a;
        }
        return Optional.of(Comparator.comparing(Candidate::mtime).compare(a.get(), b.get()) >= 0
                ? a.get() : b.get());
    }

    private record SearchDir(Path path, String sourceKind) {
    }

    private record Candidate(Path path, String sourceKind, Instant mtime) {
    }
}
