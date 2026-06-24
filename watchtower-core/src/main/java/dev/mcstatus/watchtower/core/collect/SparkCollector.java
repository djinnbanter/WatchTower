package dev.mcstatus.watchtower.core.collect;

import dev.mcstatus.watchtower.core.report.ReportConfig;
import me.lucko.spark.proto.SparkSamplerProtos;

import java.io.IOException;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.FileTime;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;

/**
 * Locates valid {@code .sparkprofile} CPU exports on disk.
 */
public final class SparkCollector {

    static final int MAX_PROFILES = 25;

    private SparkCollector() {
    }

    public static Optional<SparkCollectResult> collect(String serverDir, ReportConfig config) {
        List<SparkProfileEntry> profiles = listProfiles(serverDir, config);
        if (profiles.isEmpty()) {
            return Optional.empty();
        }
        return readProfile(serverDir, config, profiles.get(0).sourcePath());
    }

    public static List<SparkProfileEntry> listProfiles(String serverDir, ReportConfig config) {
        if (!config.sparkEnabled() || serverDir == null || serverDir.isBlank()) {
            return List.of();
        }
        Path root = Path.of(serverDir).toAbsolutePath().normalize();
        if (!Files.isDirectory(root)) {
            return List.of();
        }

        List<SparkProfileEntry> entries = new ArrayList<>();
        for (SearchDir dir : searchDirs(root, config)) {
            entries.addAll(scanDirEntries(root, dir, config));
        }
        entries.sort(Comparator
                .comparing(SparkProfileEntry::capturedAt)
                .reversed()
                .thenComparing(SparkProfileEntry::mtime, Comparator.reverseOrder()));
        if (entries.size() > MAX_PROFILES) {
            return List.copyOf(entries.subList(0, MAX_PROFILES));
        }
        return entries;
    }

    public static List<SearchDir> searchDirs(Path root, ReportConfig config) {
        List<SearchDir> dirs = new ArrayList<>();
        String uploadOverride = config.sparkUploadDir();
        if (uploadOverride != null && !uploadOverride.isBlank()) {
            dirs.add(new SearchDir(root.resolve(uploadOverride).normalize(), "spark_upload"));
        } else {
            dirs.add(new SearchDir(root.resolve("watchtower").resolve("spark-upload").normalize(), "spark_upload"));
        }
        dirs.add(new SearchDir(root.resolve("config").resolve("spark").normalize(), "config_spark"));
        dirs.add(new SearchDir(root.resolve("spark").normalize(), "legacy_spark"));
        return dirs;
    }

    public static Optional<SparkCollectResult> readProfile(String serverDir, ReportConfig config, String sourcePath) {
        if (!config.sparkEnabled() || serverDir == null || serverDir.isBlank() || sourcePath == null || sourcePath.isBlank()) {
            return Optional.empty();
        }
        Path root = Path.of(serverDir).toAbsolutePath().normalize();
        if (!Files.isDirectory(root)) {
            return Optional.empty();
        }
        Path file = resolveAllowedProfile(root, config, sourcePath);
        if (file == null || !Files.isRegularFile(file)) {
            return Optional.empty();
        }
        return readCandidate(file, sourceKindFor(root, config, file));
    }

    static Path resolveAllowedProfile(Path root, ReportConfig config, String sourcePath) {
        Path normalized = Path.of(sourcePath.replace('\\', '/')).normalize();
        Path file = normalized.isAbsolute()
                ? normalized
                : root.resolve(normalized).normalize();
        if (!file.startsWith(root) || !Files.isRegularFile(file)) {
            return null;
        }
        for (SearchDir dir : searchDirs(root, config)) {
            Path searchRoot = dir.path().toAbsolutePath().normalize();
            if (file.startsWith(searchRoot) && file.getFileName().toString().endsWith(".sparkprofile")) {
                if ("config_spark".equals(dir.sourceKind())
                        && !file.getFileName().toString().startsWith("profile-")) {
                    return null;
                }
                return file;
            }
        }
        return null;
    }

    private static String sourceKindFor(Path root, ReportConfig config, Path file) {
        Path absolute = file.toAbsolutePath().normalize();
        for (SearchDir dir : searchDirs(root, config)) {
            if (absolute.startsWith(dir.path().toAbsolutePath().normalize())) {
                return dir.sourceKind();
            }
        }
        return "unknown";
    }

    private static String relativePath(Path root, Path file) {
        return root.relativize(file.toAbsolutePath().normalize()).toString().replace('\\', '/');
    }

    private static List<SparkProfileEntry> scanDirEntries(Path root, SearchDir dir, ReportConfig config) {
        Path path = dir.path();
        if (!Files.isDirectory(path)) {
            return List.of();
        }
        List<SparkProfileEntry> entries = new ArrayList<>();
        try (DirectoryStream<Path> stream = Files.newDirectoryStream(path, "*.sparkprofile")) {
            for (Path file : stream) {
                if (!Files.isRegularFile(file)) {
                    continue;
                }
                if ("config_spark".equals(dir.sourceKind())
                        && !file.getFileName().toString().startsWith("profile-")) {
                    continue;
                }
                SparkProfileEntry entry = toEntry(root, file, dir.sourceKind(), config);
                if (entry != null) {
                    entries.add(entry);
                }
            }
        } catch (IOException ignored) {
            return List.of();
        }
        return entries;
    }

    private static SparkProfileEntry toEntry(Path root, Path file, String sourceKind, ReportConfig config) {
        try {
            FileTime mtime = Files.getLastModifiedTime(file);
            long size = Files.size(file);
            byte[] bytes = Files.readAllBytes(file);
            SparkSamplerProtos.SamplerData data = SparkSamplerProtos.SamplerData.parseFrom(bytes);
            if (!data.hasMetadata()) {
                return null;
            }
            Instant captured = SparkCaptureTimes.resolveSampler(data, mtime.toInstant());
            boolean fresh = Duration.between(captured, Instant.now()).toHours() < config.sparkFreshHours();
            return new SparkProfileEntry(
                    relativePath(root, file),
                    file.getFileName().toString(),
                    sourceKind,
                    captured,
                    mtime.toInstant(),
                    size,
                    fresh);
        } catch (Exception ignored) {
            return null;
        }
    }

    private static Optional<SparkCollectResult> readCandidate(Path file, String sourceKind) {
        try {
            FileTime mtime = Files.getLastModifiedTime(file);
            byte[] bytes = Files.readAllBytes(file);
            SparkSamplerProtos.SamplerData data = SparkSamplerProtos.SamplerData.parseFrom(bytes);
            if (!data.hasMetadata()) {
                return Optional.empty();
            }
            Instant captured = SparkCaptureTimes.resolveSampler(data, mtime.toInstant());
            return Optional.of(new SparkCollectResult(
                    file,
                    file.getFileName().toString(),
                    sourceKind,
                    captured,
                    data));
        } catch (Exception ignored) {
            return Optional.empty();
        }
    }

    public record SearchDir(Path path, String sourceKind) {
    }
}
