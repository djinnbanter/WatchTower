package dev.mcstatus.watchtower.core.collect;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ModrinthFileFetcherTest {

    @TempDir
    Path temp;

    @Test
    void verifyFileAcceptsMatchingHash() throws Exception {
        Path jar = temp.resolve("a.jar");
        Files.writeString(jar, "fixture-bytes");
        String hash = ModrinthFileFetcher.sha512Hex(jar);
        var r = ModrinthFileFetcher.verifyFile(jar, hash);
        assertTrue(r.ok(), r.message());
        assertEquals(hash, r.file().sha512());
    }

    @Test
    void verifyFileRejectsMismatch() throws Exception {
        Path jar = temp.resolve("a.jar");
        Files.writeString(jar, "fixture-bytes");
        var r = ModrinthFileFetcher.verifyFile(jar, "deadbeef");
        assertFalse(r.ok());
        assertEquals("hash_mismatch", r.errorCode());
    }

    @Test
    void fetchAndVerifyWritesStagingOnMatch() throws Exception {
        byte[] payload = "downloaded-jar-bytes".getBytes(StandardCharsets.UTF_8);
        Path staging = temp.resolve("staging");
        Files.createDirectories(staging);
        // Precompute expected hash of the payload we will "download"
        Path probe = temp.resolve("probe.jar");
        Files.write(probe, payload);
        String expected = ModrinthFileFetcher.sha512Hex(probe);

        ModrinthFileFetcher fetcher = new ModrinthFileFetcher(url -> payload);
        var r = fetcher.fetchAndVerify(
                URI.create("https://cdn.modrinth.com/data/example/versions/x/file.jar"),
                staging,
                "file.jar",
                expected);
        assertTrue(r.ok(), r.message());
        assertTrue(Files.isRegularFile(staging.resolve("file.jar")));
        assertEquals("downloaded-jar-bytes", Files.readString(staging.resolve("file.jar")));
    }

    @Test
    void fetchAndVerifyDeletesOnHashMismatch() throws Exception {
        byte[] payload = "bad-bytes".getBytes(StandardCharsets.UTF_8);
        Path staging = temp.resolve("staging");
        Files.createDirectories(staging);

        ModrinthFileFetcher fetcher = new ModrinthFileFetcher(url -> payload);
        var r = fetcher.fetchAndVerify(
                URI.create("https://cdn.modrinth.com/data/example/versions/x/file.jar"),
                staging,
                "file.jar",
                "00".repeat(64));
        assertFalse(r.ok());
        assertEquals("hash_mismatch", r.errorCode());
        assertFalse(Files.exists(staging.resolve("file.jar")));
    }

    @Test
    void rejectPathEscapeFilename() {
        ModrinthFileFetcher fetcher = new ModrinthFileFetcher(url -> new byte[]{1});
        var r = fetcher.fetchAndVerify(
                URI.create("https://cdn.modrinth.com/data/example/versions/x/file.jar"),
                temp.resolve("staging"),
                "../escape.jar",
                "aa");
        assertFalse(r.ok());
        assertEquals("invalid_filename", r.errorCode());
    }

    @Test
    void rejectNonModrinthCdnHost() {
        ModrinthFileFetcher fetcher = new ModrinthFileFetcher(url -> new byte[]{1});
        var r = fetcher.fetchAndVerify(
                URI.create("https://evil.example/a.jar"),
                temp.resolve("staging"),
                "a.jar",
                "aa".repeat(32));
        assertFalse(r.ok());
        assertEquals("invalid_url", r.errorCode());
    }

    @Test
    void isAllowedDownloadUrlHttpsCdnOnly() {
        assertTrue(ModrinthFileFetcher.isAllowedDownloadUrl(
                URI.create("https://cdn.modrinth.com/data/x/versions/y/z.jar")));
        assertFalse(ModrinthFileFetcher.isAllowedDownloadUrl(
                URI.create("http://cdn.modrinth.com/data/x/versions/y/z.jar")));
        assertFalse(ModrinthFileFetcher.isAllowedDownloadUrl(
                URI.create("https://cdn.modrinth.com.evil/x.jar")));
        assertFalse(ModrinthFileFetcher.isAllowedDownloadUrl(
                URI.create("https://127.0.0.1/x.jar")));
    }
}
