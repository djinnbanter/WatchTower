package dev.mcstatus.watchtower.core.collect;

import dev.mcstatus.watchtower.core.report.ReportConfig;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SparkProfileUploadTest {

    private static final Path FIXTURE =
            Path.of("..", "samples", "fixtures", "spark", "H5BVV4Annz.sparkprofile");

    @Test
    void storesValidatedProfileWithSanitizedName(@TempDir Path temp) throws Exception {
        assumeFixture();
        Path server = temp.resolve("server");
        Files.createDirectories(server);
        ReportConfig config = ReportConfig.builder().serverDir(server.toString()).build();

        SparkProfileUpload.Result result = SparkProfileUpload.save(
                server.toString(),
                config,
                "../../my capture.sparkprofile",
                Files.readAllBytes(FIXTURE));

        SparkProfileUpload.Result.Ok ok =
                assertInstanceOf(SparkProfileUpload.Result.Ok.class, result);
        assertEquals("watchtower/spark-upload/my-capture.sparkprofile", ok.sourcePath());
        assertTrue(Files.isRegularFile(server.resolve(ok.sourcePath())));
    }

    @Test
    void rejectsCorruptBytes(@TempDir Path temp) throws Exception {
        Path server = temp.resolve("server");
        Files.createDirectories(server);
        ReportConfig config = ReportConfig.builder().serverDir(server.toString()).build();

        SparkProfileUpload.Result result =
                SparkProfileUpload.save(server.toString(), config, "bad.sparkprofile", new byte[]{1, 2, 3});

        SparkProfileUpload.Result.Err err =
                assertInstanceOf(SparkProfileUpload.Result.Err.class, result);
        assertEquals("parse_failed", err.code());
    }

    @Test
    void rejectsEscapingUploadDirectory(@TempDir Path temp) throws Exception {
        assumeFixture();
        Path server = temp.resolve("server");
        Files.createDirectories(server);
        ReportConfig config = ReportConfig.builder()
                .serverDir(server.toString())
                .sparkUploadDir("../outside")
                .build();

        SparkProfileUpload.Result result = SparkProfileUpload.save(
                server.toString(), config, "profile.sparkprofile", Files.readAllBytes(FIXTURE));

        SparkProfileUpload.Result.Err err =
                assertInstanceOf(SparkProfileUpload.Result.Err.class, result);
        assertEquals("write_failed", err.code());
    }

    @Test
    void sanitizesWindowsAndUnixPathSegments() {
        assertEquals("profile.sparkprofile",
                SparkProfileUpload.safeFileName("C:\\Users\\player\\profile.sparkprofile"));
        assertEquals("profile.sparkprofile",
                SparkProfileUpload.safeFileName("../../profile.sparkprofile"));
    }

    private static void assumeFixture() {
        org.junit.jupiter.api.Assumptions.assumeTrue(Files.isRegularFile(FIXTURE),
                "fixture missing: " + FIXTURE);
    }
}
