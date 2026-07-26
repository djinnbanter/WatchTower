package dev.mcstatus.watchtower.core.collect;

import dev.mcstatus.watchtower.core.report.ReportConfig;
import dev.mcstatus.watchtower.core.spark.proto.SparkSamplerProtos;
import com.google.protobuf.InvalidProtocolBufferException;

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
import java.util.concurrent.ConcurrentHashMap;
import java.util.logging.Level;
import java.util.logging.Logger;

/**
 * Locates valid {@code .sparkprofile} CPU exports on disk.
 */
public final class SparkCollector {

    static final int MAX_PROFILES = 25;

    private static final Logger LOG = Logger.getLogger(SparkCollector.class.getName());

    /** Process-local list cache: absolutePath|mtimeEpochMs|size → entry or skip. */
    private static final ConcurrentHashMap<String, CachedListItem> LIST_CACHE = new ConcurrentHashMap<>();

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
        return scanProfiles(serverDir, config).profiles();
    }

    /**
     * Full scan including files that were found but could not be parsed/listed.
     */
    public static SparkProfileScan scanProfiles(String serverDir, ReportConfig config) {
        if (!config.sparkEnabled() || serverDir == null || serverDir.isBlank()) {
            return SparkProfileScan.empty();
        }
        Path root = Path.of(serverDir).toAbsolutePath().normalize();
        if (!Files.isDirectory(root)) {
            return SparkProfileScan.empty();
        }

        List<SparkProfileEntry> entries = new ArrayList<>();
        List<SparkSkippedProfile> skipped = new ArrayList<>();
        for (SearchDir dir : searchDirs(root, config)) {
            ScanBucket bucket = scanDirEntries(root, dir, config);
            entries.addAll(bucket.entries());
            skipped.addAll(bucket.skipped());
        }
        entries.sort(Comparator
                .comparing(SparkProfileEntry::capturedAt)
                .reversed()
                .thenComparing(SparkProfileEntry::mtime, Comparator.reverseOrder()));
        List<SparkProfileEntry> capped = entries.size() > MAX_PROFILES
                ? List.copyOf(entries.subList(0, MAX_PROFILES))
                : List.copyOf(entries);
        return new SparkProfileScan(capped, List.copyOf(skipped));
    }

    /**
     * Newest profile whose filesystem mtime falls in {@code [fromInclusive, toInclusive]}.
     * Used by auto-capture to pick the file produced by a start/stop window.
     */
    public static Optional<SparkProfileEntry> findNewestInMtimeWindow(
            String serverDir,
            ReportConfig config,
            Instant fromInclusive,
            Instant toInclusive
    ) {
        if (fromInclusive == null || toInclusive == null) {
            return Optional.empty();
        }
        SparkProfileEntry best = null;
        for (SparkProfileEntry entry : listProfiles(serverDir, config)) {
            Instant mtime = entry.mtime();
            if (mtime == null) {
                continue;
            }
            if (mtime.isBefore(fromInclusive) || mtime.isAfter(toInclusive)) {
                continue;
            }
            if (best == null || mtime.isAfter(best.mtime())) {
                best = entry;
            }
        }
        return Optional.ofNullable(best);
    }

    public static List<SearchDir> searchDirs(Path root, ReportConfig config) {
        List<SearchDir> dirs = new ArrayList<>();
        Path upload = SparkPaths.uploadDir(root, config);
        dirs.add(new SearchDir(upload, "spark_upload"));
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
        return readCandidate(root, file, sourceKindFor(root, config, file));
    }

    /**
     * Relativize an absolute file path against {@code serverDir}, falling back to absolute form.
     */
    public static String relativeSourcePath(String serverDir, Path file) {
        if (file == null) {
            return "";
        }
        Path abs = file.toAbsolutePath().normalize();
        if (serverDir == null || serverDir.isBlank()) {
            return abs.toString().replace('\\', '/');
        }
        Path root = Path.of(serverDir).toAbsolutePath().normalize();
        if (abs.startsWith(root)) {
            return root.relativize(abs).toString().replace('\\', '/');
        }
        return abs.toString().replace('\\', '/');
    }

    /**
     * If {@code sourcePath} is absolute under {@code serverDir}, return the relative form; otherwise
     * return the normalized slash path as given.
     */
    public static String normalizeSourcePath(String serverDir, String sourcePath) {
        if (sourcePath == null || sourcePath.isBlank()) {
            return sourcePath;
        }
        String normalized = sourcePath.replace('\\', '/');
        if (serverDir == null || serverDir.isBlank()) {
            return normalized;
        }
        Path root = Path.of(serverDir).toAbsolutePath().normalize();
        Path path = Path.of(normalized).normalize();
        Path abs = path.isAbsolute() ? path : root.resolve(path).normalize();
        if (abs.startsWith(root)) {
            return root.relativize(abs).toString().replace('\\', '/');
        }
        return normalized;
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

    /** Test seam: clear list cache. */
    static void clearListCacheForTests() {
        LIST_CACHE.clear();
    }

    /** Test seam: current cache size. */
    static int listCacheSizeForTests() {
        return LIST_CACHE.size();
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

    private static ScanBucket scanDirEntries(Path root, SearchDir dir, ReportConfig config) {
        Path path = dir.path();
        if (!Files.isDirectory(path)) {
            return ScanBucket.empty();
        }
        List<SparkProfileEntry> entries = new ArrayList<>();
        List<SparkSkippedProfile> skipped = new ArrayList<>();
        try (DirectoryStream<Path> stream = Files.newDirectoryStream(path, "*.sparkprofile")) {
            for (Path file : stream) {
                if (!Files.isRegularFile(file)) {
                    continue;
                }
                if ("config_spark".equals(dir.sourceKind())
                        && !file.getFileName().toString().startsWith("profile-")) {
                    continue;
                }
                EntryOrSkip result = toEntryOrSkip(root, file, dir.sourceKind(), config);
                if (result.entry() != null) {
                    entries.add(result.entry());
                } else if (result.skipped() != null) {
                    skipped.add(result.skipped());
                    LOG.warning("Skipping spark profile " + result.skipped().sourcePath()
                            + ": " + result.skipped().reason());
                }
            }
        } catch (IOException e) {
            String rel = relativePath(root, path);
            skipped.add(new SparkSkippedProfile(rel + "/", SparkSkippedProfile.REASON_IO_ERROR));
            LOG.warning("Spark profile dir scan failed for " + rel + ": " + e);
            return new ScanBucket(List.of(), List.copyOf(skipped));
        }
        return new ScanBucket(entries, skipped);
    }

    private static EntryOrSkip toEntryOrSkip(Path root, Path file, String sourceKind, ReportConfig config) {
        String rel = relativePath(root, file);
        try {
            FileTime mtime = Files.getLastModifiedTime(file);
            long size = Files.size(file);
            String cacheKey = cacheKey(file, mtime, size);
            CachedListItem cached = LIST_CACHE.get(cacheKey);
            if (cached != null) {
                if (cached.entry() != null) {
                    // Recompute freshness against current clock / config.
                    SparkProfileEntry e = cached.entry();
                    boolean fresh = SparkProfileFacts.isFreshInstant(e.capturedAt(), config.sparkFreshHours());
                    return EntryOrSkip.ok(new SparkProfileEntry(
                            e.sourcePath(),
                            e.sourceFile(),
                            e.sourceKind(),
                            e.capturedAt(),
                            e.mtime(),
                            e.sizeBytes(),
                            fresh));
                }
                return EntryOrSkip.skip(cached.skipped());
            }

            byte[] bytes = Files.readAllBytes(file);
            SparkSamplerProtos.SamplerData data = SparkSamplerProtos.SamplerData.parseFrom(bytes);
            if (!data.hasMetadata()) {
                SparkSkippedProfile skip = new SparkSkippedProfile(rel, SparkSkippedProfile.REASON_NO_METADATA);
                LIST_CACHE.put(cacheKey, CachedListItem.skip(skip));
                return EntryOrSkip.skip(skip);
            }
            Instant captured = SparkCaptureTimes.resolveSampler(data, mtime.toInstant());
            boolean fresh = SparkProfileFacts.isFreshInstant(captured, config.sparkFreshHours());
            SparkProfileEntry entry = new SparkProfileEntry(
                    rel,
                    file.getFileName().toString(),
                    sourceKind,
                    captured,
                    mtime.toInstant(),
                    size,
                    fresh);
            LIST_CACHE.put(cacheKey, CachedListItem.ok(entry));
            return EntryOrSkip.ok(entry);
        } catch (InvalidProtocolBufferException e) {
            SparkSkippedProfile skip = new SparkSkippedProfile(rel, SparkSkippedProfile.REASON_UNREADABLE);
            tryCacheSkip(file, skip);
            return EntryOrSkip.skip(skip);
        } catch (IOException e) {
            return EntryOrSkip.skip(new SparkSkippedProfile(rel, SparkSkippedProfile.REASON_IO_ERROR));
        } catch (Throwable t) {
            LOG.log(Level.FINE, "Spark list parse failed for " + rel + ": " + t);
            SparkSkippedProfile skip = new SparkSkippedProfile(rel, SparkSkippedProfile.REASON_UNREADABLE);
            tryCacheSkip(file, skip);
            return EntryOrSkip.skip(skip);
        }
    }

    private static void tryCacheSkip(Path file, SparkSkippedProfile skip) {
        try {
            FileTime mtime = Files.getLastModifiedTime(file);
            long size = Files.size(file);
            LIST_CACHE.put(cacheKey(file, mtime, size), CachedListItem.skip(skip));
        } catch (IOException ignored) {
            // leave uncached
        }
    }

    private static String cacheKey(Path file, FileTime mtime, long size) {
        return file.toAbsolutePath().normalize() + "|" + mtime.toMillis() + "|" + size;
    }

    private static Optional<SparkCollectResult> readCandidate(Path root, Path file, String sourceKind) {
        String rel = relativePath(root, file);
        try {
            FileTime mtime = Files.getLastModifiedTime(file);
            byte[] bytes = Files.readAllBytes(file);
            SparkSamplerProtos.SamplerData data = SparkSamplerProtos.SamplerData.parseFrom(bytes);
            if (!data.hasMetadata()) {
                LOG.fine("Spark profile missing metadata: " + rel);
                return Optional.empty();
            }
            Instant captured = SparkCaptureTimes.resolveSampler(data, mtime.toInstant());
            return Optional.of(new SparkCollectResult(
                    file,
                    rel,
                    file.getFileName().toString(),
                    sourceKind,
                    captured,
                    data));
        } catch (InvalidProtocolBufferException e) {
            LOG.log(Level.FINE, "Spark profile unreadable (protobuf): " + rel, e);
            return Optional.empty();
        } catch (IOException e) {
            LOG.log(Level.FINE, "Spark profile IO error: " + rel, e);
            return Optional.empty();
        } catch (Throwable t) {
            LOG.log(Level.WARNING, "Spark profile read failed for " + rel + ": " + t);
            return Optional.empty();
        }
    }

    public record SearchDir(Path path, String sourceKind) {
    }

    private record ScanBucket(List<SparkProfileEntry> entries, List<SparkSkippedProfile> skipped) {
        static ScanBucket empty() {
            return new ScanBucket(List.of(), List.of());
        }
    }

    private record EntryOrSkip(SparkProfileEntry entry, SparkSkippedProfile skipped) {
        static EntryOrSkip ok(SparkProfileEntry entry) {
            return new EntryOrSkip(entry, null);
        }

        static EntryOrSkip skip(SparkSkippedProfile skipped) {
            return new EntryOrSkip(null, skipped);
        }
    }

    private record CachedListItem(SparkProfileEntry entry, SparkSkippedProfile skipped) {
        static CachedListItem ok(SparkProfileEntry entry) {
            return new CachedListItem(entry, null);
        }

        static CachedListItem skip(SparkSkippedProfile skipped) {
            return new CachedListItem(null, skipped);
        }
    }
}
