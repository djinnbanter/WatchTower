package dev.mcstatus.watchtower.core.collect;

import com.google.protobuf.InvalidProtocolBufferException;
import dev.mcstatus.watchtower.core.report.ReportConfig;
import dev.mcstatus.watchtower.core.spark.proto.SparkSamplerProtos;

import java.io.IOException;
import java.nio.file.AtomicMoveNotSupportedException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Instant;
import java.util.Locale;

/**
 * Validates a locally uploaded {@code .sparkprofile} and stores it below the configured
 * spark-upload directory. The caller is responsible for authentication and request limits.
 */
public final class SparkProfileUpload {

    private static final int MAX_FILE_NAME = 120;

    private SparkProfileUpload() {
    }

    public sealed interface Result permits Result.Ok, Result.Err {
        record Ok(SparkProfileEntry entry, String sourcePath) implements Result {
        }

        record Err(String code, String message) implements Result {
        }
    }

    public static Result save(String serverDir, ReportConfig config, String requestedName, byte[] bytes) {
        if (config == null || !config.sparkEnabled()) {
            return new Result.Err("spark_disabled", "Spark integration is disabled");
        }
        if (serverDir == null || serverDir.isBlank()) {
            return new Result.Err("invalid_server", "Server directory is not configured");
        }
        if (bytes == null || bytes.length == 0) {
            return new Result.Err("empty_upload", "Uploaded profile is empty");
        }
        if (bytes.length > SparkBytebinImport.MAX_DOWNLOAD_BYTES) {
            return new Result.Err("too_large", "Spark profile exceeds the 64 MB limit");
        }

        SparkSamplerProtos.SamplerData data;
        try {
            data = SparkSamplerProtos.SamplerData.parseFrom(bytes);
        } catch (InvalidProtocolBufferException e) {
            return new Result.Err("parse_failed", "Uploaded bytes are not a valid Spark sampler profile");
        }
        if (!data.hasMetadata()) {
            return new Result.Err("parse_failed", "Spark profile is missing metadata");
        }

        Path root;
        try {
            root = Path.of(serverDir).toAbsolutePath().normalize();
        } catch (Exception e) {
            return new Result.Err("invalid_server", "Server directory is invalid");
        }
        if (!Files.isDirectory(root)) {
            return new Result.Err("invalid_server", "Server directory does not exist");
        }

        Path uploadDir = SparkPaths.uploadDir(root, config);
        if (!SparkPaths.isUnderRoot(root, uploadDir)) {
            return new Result.Err("write_failed", "SPARK_UPLOAD_DIR escapes server root");
        }

        String fileName = safeFileName(requestedName);
        Path destination = uploadDir.resolve(fileName).normalize();
        if (!destination.startsWith(uploadDir)) {
            return new Result.Err("write_failed", "Refusing to write outside spark-upload");
        }

        Path temp = null;
        try {
            Files.createDirectories(uploadDir);
            temp = Files.createTempFile(uploadDir, ".spark-upload-", ".tmp");
            Files.write(temp, bytes);
            try {
                Files.move(temp, destination,
                        StandardCopyOption.ATOMIC_MOVE, StandardCopyOption.REPLACE_EXISTING);
            } catch (AtomicMoveNotSupportedException ignored) {
                Files.move(temp, destination, StandardCopyOption.REPLACE_EXISTING);
            }

            Instant mtime = Files.getLastModifiedTime(destination).toInstant();
            Instant captured = SparkCaptureTimes.resolveSampler(data, mtime);
            boolean fresh = SparkProfileFacts.isFreshInstant(captured, config.sparkFreshHours());
            String relative = SparkCollector.relativeSourcePath(serverDir, destination);
            SparkProfileEntry entry = new SparkProfileEntry(
                    relative,
                    destination.getFileName().toString(),
                    "spark_upload",
                    captured,
                    mtime,
                    bytes.length,
                    fresh);
            return new Result.Ok(entry, relative);
        } catch (IOException e) {
            return new Result.Err("write_failed",
                    e.getMessage() != null ? e.getMessage() : "Could not save Spark profile");
        } finally {
            if (temp != null) {
                try {
                    Files.deleteIfExists(temp);
                } catch (IOException ignored) {
                    // Best-effort cleanup; destination may already own the bytes.
                }
            }
        }
    }

    static String safeFileName(String requestedName) {
        String raw = requestedName == null ? "" : requestedName.trim();
        raw = raw.replace('\\', '/');
        int slash = raw.lastIndexOf('/');
        if (slash >= 0) {
            raw = raw.substring(slash + 1);
        }
        if (raw.toLowerCase(Locale.ROOT).endsWith(".sparkprofile")) {
            raw = raw.substring(0, raw.length() - ".sparkprofile".length());
        }
        String stem = raw.replaceAll("[^A-Za-z0-9._-]+", "-")
                .replaceAll("^[._-]+|[._-]+$", "");
        if (stem.isBlank()) {
            stem = "uploaded-" + Instant.now().toEpochMilli();
        }
        int maxStem = MAX_FILE_NAME - ".sparkprofile".length();
        if (stem.length() > maxStem) {
            stem = stem.substring(0, maxStem);
        }
        return stem + ".sparkprofile";
    }
}
