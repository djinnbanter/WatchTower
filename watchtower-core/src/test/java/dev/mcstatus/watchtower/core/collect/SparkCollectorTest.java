package dev.mcstatus.watchtower.core.collect;

import dev.mcstatus.watchtower.core.report.ReportConfig;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

class SparkCollectorTest {

    private static final Path FIXTURE = Path.of("..", "samples/fixtures/spark/H5BVV4Annz.sparkprofile");

    @Test
    void listProfilesReturnsMultipleSortedByCaptureTime(@TempDir Path temp) throws Exception {
        assumeFixture(FIXTURE);
        Path server = temp.resolve("server");
        Path upload = server.resolve("watchtower/spark-upload");
        Path configSpark = server.resolve("config/spark");
        Files.createDirectories(upload);
        Files.createDirectories(configSpark);

        Path older = configSpark.resolve("profile-old.sparkprofile");
        Files.copy(FIXTURE, older);
        Files.setLastModifiedTime(older, java.nio.file.attribute.FileTime.from(Instant.now().minusSeconds(7200)));

        Path newer = upload.resolve("fresh.sparkprofile");
        Files.copy(FIXTURE, newer);
        Files.setLastModifiedTime(newer, java.nio.file.attribute.FileTime.from(Instant.now()));

        ReportConfig config = ReportConfig.builder().serverDir(server.toString()).build();
        List<SparkProfileEntry> profiles = SparkCollector.listProfiles(server.toString(), config);
        assertEquals(2, profiles.size());
        assertEquals("fresh.sparkprofile", profiles.get(0).sourceFile());
        assertEquals("profile-old.sparkprofile", profiles.get(1).sourceFile());
    }

    @Test
    void collectPicksNewestFromList(@TempDir Path temp) throws Exception {
        assumeFixture(FIXTURE);
        Path server = temp.resolve("server");
        Path upload = server.resolve("watchtower/spark-upload");
        Path configSpark = server.resolve("config/spark");
        Files.createDirectories(upload);
        Files.createDirectories(configSpark);

        Path configFile = configSpark.resolve("profile-old.sparkprofile");
        Files.copy(FIXTURE, configFile);
        Files.setLastModifiedTime(configFile, java.nio.file.attribute.FileTime.from(Instant.now().minusSeconds(3600)));

        Path uploadFile = upload.resolve("fresh.sparkprofile");
        Files.copy(FIXTURE, uploadFile);
        Files.setLastModifiedTime(uploadFile, java.nio.file.attribute.FileTime.from(Instant.now()));

        ReportConfig config = ReportConfig.builder().serverDir(server.toString()).build();
        Optional<SparkCollectResult> result = SparkCollector.collect(server.toString(), config);
        assertTrue(result.isPresent());
        assertEquals("spark_upload", result.get().sourceKind());
        assertEquals("fresh.sparkprofile", result.get().sourceFile());
    }

    @Test
    void readProfileRejectsPathOutsideAllowedDirs(@TempDir Path temp) throws Exception {
        assumeFixture(FIXTURE);
        Path server = temp.resolve("server");
        Path outside = server.resolve("logs/evil.sparkprofile");
        Files.createDirectories(outside.getParent());
        Files.copy(FIXTURE, outside);

        ReportConfig config = ReportConfig.builder().serverDir(server.toString()).build();
        assertTrue(SparkCollector.readProfile(server.toString(), config, "logs/evil.sparkprofile").isEmpty());
    }

    @Test
    void readProfileLoadsAllowedFile(@TempDir Path temp) throws Exception {
        assumeFixture(FIXTURE);
        Path server = temp.resolve("server");
        Path upload = server.resolve("watchtower/spark-upload");
        Files.createDirectories(upload);
        Path file = upload.resolve("mine.sparkprofile");
        Files.copy(FIXTURE, file);

        ReportConfig config = ReportConfig.builder().serverDir(server.toString()).build();
        Optional<SparkCollectResult> result = SparkCollector.readProfile(
                server.toString(), config, "watchtower/spark-upload/mine.sparkprofile");
        assertTrue(result.isPresent());
        assertEquals("mine.sparkprofile", result.get().sourceFile());
    }

    @Test
    void listProfilesRespectsMaxCap(@TempDir Path temp) throws Exception {
        assumeFixture(FIXTURE);
        Path server = temp.resolve("server");
        Path upload = server.resolve("watchtower/spark-upload");
        Files.createDirectories(upload);
        for (int i = 0; i < SparkCollector.MAX_PROFILES + 3; i++) {
            Files.copy(FIXTURE, upload.resolve("p" + i + ".sparkprofile"));
        }
        ReportConfig config = ReportConfig.builder().serverDir(server.toString()).build();
        assertEquals(SparkCollector.MAX_PROFILES, SparkCollector.listProfiles(server.toString(), config).size());
    }

    private static void assumeFixture(Path path) {
        org.junit.jupiter.api.Assumptions.assumeTrue(Files.isRegularFile(path),
                "fixture missing: " + path);
    }
}
