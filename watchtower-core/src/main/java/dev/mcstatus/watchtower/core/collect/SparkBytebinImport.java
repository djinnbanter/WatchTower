package dev.mcstatus.watchtower.core.collect;

import dev.mcstatus.watchtower.core.report.ReportConfig;
import dev.mcstatus.watchtower.core.spark.proto.SparkSamplerProtos;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.function.Function;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Downloads a Spark sampler export from lucko's bytebin and saves it under spark-upload.
 */
public final class SparkBytebinImport {

    private static final Pattern KEY = Pattern.compile("^[A-Za-z0-9]{10}$");
    private static final Pattern KEY_FILE = Pattern.compile("^([A-Za-z0-9]{10})\\.sparkprofile$", Pattern.CASE_INSENSITIVE);
    private static final Set<String> ALLOWED_HOSTS = Set.of(
            "spark.lucko.me",
            "spark-usercontent.lucko.me"
    );
    private static final String BYTEBIN_BASE = "https://spark-usercontent.lucko.me/";
    private static final Duration CONNECT_TIMEOUT = Duration.ofSeconds(10);
    private static final Duration REQUEST_TIMEOUT = Duration.ofSeconds(30);
    /** Reject oversized downloads before write (profiles are typically a few MB). */
    public static final int MAX_DOWNLOAD_BYTES = 64 * 1024 * 1024;

    @FunctionalInterface
    public interface Downloader {
        byte[] download(String key) throws IOException, InterruptedException;
    }

    public sealed interface Result permits Result.Ok, Result.Err {
        record Ok(SparkProfileEntry entry, String sourcePath) implements Result {
        }

        record Err(String code, String message) implements Result {
        }
    }

    private SparkBytebinImport() {
    }

    /**
     * Extract a 10-character bytebin key from a viewer URL, raw URL, bare key, or filename.
     */
    public static Optional<String> parseKey(String input) {
        if (input == null) {
            return Optional.empty();
        }
        String raw = input.strip();
        if (raw.isEmpty()) {
            return Optional.empty();
        }
        if (KEY.matcher(raw).matches()) {
            return Optional.of(raw);
        }
        Matcher file = KEY_FILE.matcher(raw);
        if (file.matches()) {
            return Optional.of(file.group(1));
        }
        try {
            URI uri = URI.create(raw.contains("://") ? raw : "https://" + raw);
            String host = uri.getHost();
            if (host == null) {
                return Optional.empty();
            }
            host = host.toLowerCase(Locale.ROOT);
            if (!ALLOWED_HOSTS.contains(host)) {
                return Optional.empty();
            }
            String path = uri.getPath();
            if (path == null || path.isBlank() || "/".equals(path)) {
                return Optional.empty();
            }
            String segment = path.startsWith("/") ? path.substring(1) : path;
            int slash = segment.indexOf('/');
            if (slash >= 0) {
                segment = segment.substring(0, slash);
            }
            if (segment.endsWith(".sparkprofile")) {
                segment = segment.substring(0, segment.length() - ".sparkprofile".length());
            }
            if (KEY.matcher(segment).matches()) {
                return Optional.of(segment);
            }
            return Optional.empty();
        } catch (IllegalArgumentException | NullPointerException e) {
            return Optional.empty();
        }
    }

    public static Result importFromUrl(String serverDir, ReportConfig config, String urlOrKey) {
        return importFromUrl(serverDir, config, urlOrKey, SparkBytebinImport::httpDownload);
    }

    public static Result importFromUrl(
            String serverDir,
            ReportConfig config,
            String urlOrKey,
            Downloader downloader
    ) {
        Objects.requireNonNull(downloader, "downloader");
        if (config == null || !config.sparkEnabled()) {
            return new Result.Err("spark_disabled", "Spark integration is disabled");
        }
        if (serverDir == null || serverDir.isBlank()) {
            return new Result.Err("invalid_server", "Server directory is not configured");
        }
        Optional<String> keyOpt = parseKey(urlOrKey);
        if (keyOpt.isEmpty()) {
            return new Result.Err("invalid_spark_url", "Not a spark.lucko.me viewer URL or 10-character key");
        }
        String key = keyOpt.get();
        Path root = Path.of(serverDir).toAbsolutePath().normalize();
        if (!Files.isDirectory(root)) {
            return new Result.Err("invalid_server", "Server directory does not exist");
        }

        byte[] bytes;
        try {
            bytes = downloader.download(key);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return new Result.Err("fetch_interrupted", "Download interrupted");
        } catch (IOException e) {
            String msg = e.getMessage() != null ? e.getMessage() : "download failed";
            if (msg.contains("HTTP 404") || msg.toLowerCase(Locale.ROOT).contains("not found")) {
                return new Result.Err("not_found", "Profile not found on spark bytebin (expired or invalid key)");
            }
            if (msg.toLowerCase(Locale.ROOT).contains("too large") || msg.contains("MAX_DOWNLOAD")) {
                return new Result.Err("too_large", "Spark profile exceeds maximum download size");
            }
            return new Result.Err("fetch_failed", msg);
        }
        if (bytes == null || bytes.length == 0) {
            return new Result.Err("fetch_failed", "Empty response body");
        }
        if (bytes.length > MAX_DOWNLOAD_BYTES) {
            return new Result.Err("too_large", "Spark profile exceeds maximum download size ("
                    + (MAX_DOWNLOAD_BYTES / (1024 * 1024)) + " MB)");
        }

        SparkSamplerProtos.SamplerData data;
        try {
            data = SparkSamplerProtos.SamplerData.parseFrom(bytes);
        } catch (Exception e) {
            return new Result.Err("parse_failed", "Downloaded bytes are not a valid Spark sampler profile");
        }
        if (!data.hasMetadata()) {
            return new Result.Err("parse_failed", "Spark profile is missing metadata");
        }

        Path uploadDir = SparkPaths.uploadDir(root, config);
        if (!SparkPaths.isUnderRoot(root, uploadDir)) {
            return new Result.Err("write_failed", "SPARK_UPLOAD_DIR escapes server root");
        }
        try {
            Files.createDirectories(uploadDir);
        } catch (IOException e) {
            return new Result.Err("write_failed", "Could not create spark-upload directory");
        }

        String fileName = key + ".sparkprofile";
        Path dest = uploadDir.resolve(fileName).normalize();
        if (!dest.startsWith(uploadDir)) {
            return new Result.Err("write_failed", "Refusing to write outside spark-upload");
        }
        try {
            Files.write(dest, bytes);
        } catch (IOException e) {
            return new Result.Err("write_failed", "Could not write profile file");
        }

        Instant mtime;
        long size;
        try {
            mtime = Files.getLastModifiedTime(dest).toInstant();
            size = Files.size(dest);
        } catch (IOException e) {
            mtime = Instant.now();
            size = bytes.length;
        }
        Instant captured = SparkCaptureTimes.resolveSampler(data, mtime);
        boolean fresh = SparkProfileFacts.isFreshInstant(captured, config.sparkFreshHours());
        String relative = SparkCollector.relativeSourcePath(serverDir, dest);
        SparkProfileEntry entry = new SparkProfileEntry(
                relative,
                fileName,
                "spark_upload",
                captured,
                mtime,
                size,
                fresh);
        return new Result.Ok(entry, relative);
    }

    static Path uploadDir(Path root, ReportConfig config) {
        return SparkPaths.uploadDir(root, config);
    }

    static byte[] httpDownload(String key) throws IOException, InterruptedException {
        HttpClient client = HttpClient.newBuilder().connectTimeout(CONNECT_TIMEOUT).build();
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(BYTEBIN_BASE + key))
                .timeout(REQUEST_TIMEOUT)
                .header("Accept", "application/x-spark-sampler, application/octet-stream, */*")
                .header("User-Agent", "Watchtower-SparkImport")
                .GET()
                .build();
        HttpResponse<byte[]> response = client.send(request, HttpResponse.BodyHandlers.ofByteArray());
        int code = response.statusCode();
        if (code == 404) {
            throw new IOException("HTTP 404 not found");
        }
        if (code < 200 || code >= 300) {
            throw new IOException("HTTP " + code);
        }
        byte[] body = response.body();
        if (body == null || body.length == 0) {
            throw new IOException("Empty response body");
        }
        if (body.length > MAX_DOWNLOAD_BYTES) {
            throw new IOException("Spark profile too large (MAX_DOWNLOAD " + MAX_DOWNLOAD_BYTES + ")");
        }
        String contentType = response.headers().firstValue("Content-Type").orElse("");
        if (!contentType.isBlank()
                && !contentType.toLowerCase(Locale.ROOT).contains("spark-sampler")
                && !contentType.toLowerCase(Locale.ROOT).contains("octet-stream")
                && !contentType.toLowerCase(Locale.ROOT).contains("protobuf")) {
            // Still accept if protobuf parses — caller validates SamplerData
        }
        return body;
    }

    /** Test helper: wrap fixed bytes as a downloader. */
    public static Downloader fixedBytes(byte[] bytes) {
        return key -> bytes;
    }

    /** Test helper: map keys to download functions. */
    public static Downloader mapping(Function<String, byte[]> map) {
        return map::apply;
    }
}
