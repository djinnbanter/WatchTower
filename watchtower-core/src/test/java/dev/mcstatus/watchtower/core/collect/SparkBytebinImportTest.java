package dev.mcstatus.watchtower.core.collect;

import dev.mcstatus.watchtower.core.report.ReportConfig;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

class SparkBytebinImportTest {

    private static final Path FIXTURE = Path.of("..", "samples/fixtures/spark/H5BVV4Annz.sparkprofile");

    @Test
    void parseKeyAcceptsViewerUrlAndBareKey() {
        assertEquals(Optional.of("H5BVV4Annz"), SparkBytebinImport.parseKey("https://spark.lucko.me/H5BVV4Annz"));
        assertEquals(Optional.of("H5BVV4Annz"), SparkBytebinImport.parseKey("https://spark.lucko.me/H5BVV4Annz?raw=1"));
        assertEquals(Optional.of("H5BVV4Annz"), SparkBytebinImport.parseKey("spark.lucko.me/H5BVV4Annz"));
        assertEquals(Optional.of("H5BVV4Annz"), SparkBytebinImport.parseKey("H5BVV4Annz"));
        assertEquals(Optional.of("H5BVV4Annz"), SparkBytebinImport.parseKey("H5BVV4Annz.sparkprofile"));
        assertEquals(Optional.of("H5BVV4Annz"),
                SparkBytebinImport.parseKey("https://spark-usercontent.lucko.me/H5BVV4Annz"));
    }

    @Test
    void parseKeyRejectsSsrfAndBadShapes() {
        assertTrue(SparkBytebinImport.parseKey("https://evil.example/H5BVV4Annz").isEmpty());
        assertTrue(SparkBytebinImport.parseKey("https://spark.lucko.me.evil.com/H5BVV4Annz").isEmpty());
        assertTrue(SparkBytebinImport.parseKey("profile-2026-07-20.sparkprofile").isEmpty());
        assertTrue(SparkBytebinImport.parseKey("short").isEmpty());
        assertTrue(SparkBytebinImport.parseKey("").isEmpty());
        assertTrue(SparkBytebinImport.parseKey(null).isEmpty());
    }

    @Test
    void importWritesRelativePathUnderSparkUpload(@TempDir Path temp) throws Exception {
        assumeFixture(FIXTURE);
        byte[] bytes = Files.readAllBytes(FIXTURE);
        Path server = temp.resolve("server");
        Files.createDirectories(server);
        ReportConfig config = ReportConfig.builder().serverDir(server.toString()).sparkFreshHours(24).build();

        SparkBytebinImport.Result result = SparkBytebinImport.importFromUrl(
                server.toString(),
                config,
                "https://spark.lucko.me/H5BVV4Annz",
                SparkBytebinImport.fixedBytes(bytes));

        assertInstanceOf(SparkBytebinImport.Result.Ok.class, result);
        SparkBytebinImport.Result.Ok ok = (SparkBytebinImport.Result.Ok) result;
        assertEquals("watchtower/spark-upload/H5BVV4Annz.sparkprofile", ok.sourcePath());
        assertTrue(Files.isRegularFile(server.resolve("watchtower/spark-upload/H5BVV4Annz.sparkprofile")));
        assertEquals("H5BVV4Annz.sparkprofile", ok.entry().sourceFile());
        assertEquals("spark_upload", ok.entry().sourceKind());
    }

    @Test
    void importRejectsDisabledSpark(@TempDir Path temp) throws Exception {
        assumeFixture(FIXTURE);
        Path server = temp.resolve("server");
        Files.createDirectories(server);
        ReportConfig config = ReportConfig.builder()
                .serverDir(server.toString())
                .sparkEnabled(false)
                .build();
        SparkBytebinImport.Result result = SparkBytebinImport.importFromUrl(
                server.toString(),
                config,
                "H5BVV4Annz",
                SparkBytebinImport.fixedBytes(Files.readAllBytes(FIXTURE)));
        assertInstanceOf(SparkBytebinImport.Result.Err.class, result);
        assertEquals("spark_disabled", ((SparkBytebinImport.Result.Err) result).code());
    }

    @Test
    void importRejectsCorruptBytes(@TempDir Path temp) throws Exception {
        Path server = temp.resolve("server");
        Files.createDirectories(server);
        ReportConfig config = ReportConfig.builder().serverDir(server.toString()).build();
        SparkBytebinImport.Result result = SparkBytebinImport.importFromUrl(
                server.toString(),
                config,
                "H5BVV4Annz",
                SparkBytebinImport.fixedBytes("not-protobuf".getBytes()));
        assertInstanceOf(SparkBytebinImport.Result.Err.class, result);
        assertEquals("parse_failed", ((SparkBytebinImport.Result.Err) result).code());
    }

    @Test
    void importRejectsOversizedDownload(@TempDir Path temp) throws Exception {
        Path server = temp.resolve("server");
        Files.createDirectories(server);
        ReportConfig config = ReportConfig.builder().serverDir(server.toString()).build();
        byte[] huge = new byte[SparkBytebinImport.MAX_DOWNLOAD_BYTES + 1];
        SparkBytebinImport.Result result = SparkBytebinImport.importFromUrl(
                server.toString(),
                config,
                "H5BVV4Annz",
                SparkBytebinImport.fixedBytes(huge));
        assertInstanceOf(SparkBytebinImport.Result.Err.class, result);
        assertEquals("too_large", ((SparkBytebinImport.Result.Err) result).code());
    }

    @Test
    void importRejectsUploadDirOutsideServerRoot(@TempDir Path temp) throws Exception {
        assumeFixture(FIXTURE);
        Path server = temp.resolve("server");
        Files.createDirectories(server);
        ReportConfig config = ReportConfig.builder()
                .serverDir(server.toString())
                .sparkUploadDir("../outside-upload")
                .build();
        SparkBytebinImport.Result result = SparkBytebinImport.importFromUrl(
                server.toString(),
                config,
                "H5BVV4Annz",
                SparkBytebinImport.fixedBytes(Files.readAllBytes(FIXTURE)));
        assertInstanceOf(SparkBytebinImport.Result.Err.class, result);
        assertEquals("write_failed", ((SparkBytebinImport.Result.Err) result).code());
    }

    private static void assumeFixture(Path path) {
        org.junit.jupiter.api.Assumptions.assumeTrue(Files.isRegularFile(path),
                "fixture missing: " + path);
    }
}
