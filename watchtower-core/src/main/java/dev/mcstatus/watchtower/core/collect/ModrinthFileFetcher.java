package dev.mcstatus.watchtower.core.collect;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.time.Duration;
import java.util.HexFormat;
import java.util.Locale;
import java.util.Objects;
import java.util.function.Function;

/**
 * Downloads a Modrinth CDN file into staging and verifies sha512.
 * Lookup/metadata stays in {@link ModrinthLookupService}; this class only fetches bytes.
 */
public final class ModrinthFileFetcher {
    public record FetchedFile(Path path, String sha512, long size) {
    }

    public record Result(boolean ok, FetchedFile file, String errorCode, String message) {
        public static Result success(FetchedFile file) {
            return new Result(true, file, null, null);
        }

        public static Result fail(String code, String message) {
            return new Result(false, null, code, message);
        }
    }

    @FunctionalInterface
    public interface ByteDownloader {
        byte[] download(URI url) throws IOException, InterruptedException;
    }

    private final ByteDownloader downloader;

    public ModrinthFileFetcher() {
        this(defaultHttpDownloader());
    }

    public ModrinthFileFetcher(HttpClient client) {
        this(url -> {
            HttpRequest request = HttpRequest.newBuilder(url)
                    .timeout(Duration.ofMinutes(2))
                    .header("User-Agent", "WatchTower/mod-mutate")
                    .GET()
                    .build();
            try {
                HttpResponse<byte[]> response = client.send(request, HttpResponse.BodyHandlers.ofByteArray());
                if (response.statusCode() < 200 || response.statusCode() >= 300) {
                    throw new IOException("HTTP " + response.statusCode());
                }
                return response.body();
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
                throw e;
            }
        });
    }

    public ModrinthFileFetcher(ByteDownloader downloader) {
        this.downloader = Objects.requireNonNull(downloader, "downloader");
    }

    /**
     * Download URL to {@code stagingDir/filename}; verify sha512; on mismatch delete and fail.
     */
    public Result fetchAndVerify(URI url, Path stagingDir, String filename, String expectedSha512) {
        if (url == null) {
            return Result.fail("invalid_url", "Download URL required");
        }
        String safeName = ModJarPaths.safeSegment(filename);
        if (safeName == null || !safeName.toLowerCase(Locale.ROOT).endsWith(".jar")) {
            return Result.fail("invalid_filename", "Filename must be a single .jar segment");
        }
        if (expectedSha512 == null || expectedSha512.isBlank()) {
            return Result.fail("missing_hash", "expected_sha512 required");
        }
        if (stagingDir == null) {
            return Result.fail("invalid_staging", "stagingDir required");
        }

        Path stagingAbs = stagingDir.toAbsolutePath().normalize();
        Path target = stagingAbs.resolve(safeName).normalize();
        if (!target.startsWith(stagingAbs) || !Objects.equals(target.getParent(), stagingAbs)) {
            return Result.fail("path_escape", "Filename escapes staging directory");
        }

        try {
            Files.createDirectories(stagingAbs);
            byte[] bytes = downloader.download(url);
            if (bytes == null) {
                return Result.fail("download_empty", "Empty download");
            }
            Files.write(target, bytes);
            Result verified = verifyFile(target, expectedSha512);
            if (!verified.ok()) {
                Files.deleteIfExists(target);
                return verified;
            }
            return Result.success(new FetchedFile(target, verified.file().sha512(), verified.file().size()));
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            try {
                Files.deleteIfExists(target);
            } catch (IOException ignored) {
            }
            return Result.fail("interrupted", "Download interrupted");
        } catch (IOException e) {
            try {
                Files.deleteIfExists(target);
            } catch (IOException ignored) {
            }
            return Result.fail("download_failed", e.getMessage() != null ? e.getMessage() : "download failed");
        }
    }

    /** Verify sha512 of local bytes without network. */
    public static Result verifyFile(Path file, String expectedSha512) {
        if (file == null || !Files.isRegularFile(file)) {
            return Result.fail("not_found", "File not found");
        }
        if (expectedSha512 == null || expectedSha512.isBlank()) {
            return Result.fail("missing_hash", "expected_sha512 required");
        }
        try {
            String actual = sha512Hex(file);
            if (!actual.equalsIgnoreCase(expectedSha512.trim())) {
                return Result.fail("hash_mismatch", "sha512 does not match expected");
            }
            return Result.success(new FetchedFile(file, actual, Files.size(file)));
        } catch (Exception e) {
            return Result.fail("hash_error", e.getMessage() != null ? e.getMessage() : "hash failed");
        }
    }

    public static String sha512Hex(Path file) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-512");
        try (InputStream in = Files.newInputStream(file)) {
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) >= 0) {
                digest.update(buf, 0, n);
            }
        }
        return HexFormat.of().formatHex(digest.digest());
    }

    public static ByteDownloader bytesProvider(Function<URI, byte[]> provider) {
        return url -> {
            byte[] bytes = provider.apply(url);
            if (bytes == null) {
                throw new IOException("No bytes for " + url);
            }
            return bytes;
        };
    }

    private static ByteDownloader defaultHttpDownloader() {
        HttpClient client = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(15))
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
        return url -> {
            HttpRequest request = HttpRequest.newBuilder(url)
                    .timeout(Duration.ofMinutes(2))
                    .header("User-Agent", "WatchTower/mod-mutate")
                    .GET()
                    .build();
            HttpResponse<byte[]> response = client.send(request, HttpResponse.BodyHandlers.ofByteArray());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new IOException("HTTP " + response.statusCode());
            }
            return response.body();
        };
    }
}
