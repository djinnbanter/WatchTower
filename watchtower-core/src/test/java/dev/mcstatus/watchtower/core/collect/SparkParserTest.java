package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.report.ReportConfig;
import me.lucko.spark.proto.SparkSamplerProtos;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;

class SparkParserTest {

    private static final Path FIXTURE = Path.of("..", "samples/fixtures/spark/H5BVV4Annz.sparkprofile");
    private static final Path HEALTHY = Path.of("..", "samples/fixtures/spark/CXrvhrNd1R.sparkprofile");

    @Test
    void parsesLaggyFixtureWithModHints() throws Exception {
        assumeFixture(FIXTURE);
        byte[] bytes = Files.readAllBytes(FIXTURE);
        SparkSamplerProtos.SamplerData data = SparkSamplerProtos.SamplerData.parseFrom(bytes);
        SparkCollectResult result = new SparkCollectResult(
                FIXTURE, FIXTURE.getFileName().toString(), "config_spark", Instant.now(), data);
        ReportConfig config = ReportConfig.builder().sparkFreshHours(24).build();
        JsonObject profile = SparkParser.toFacts(result, config);
        assertNotNull(profile);
        SparkRecommendationBuilder.enrich(profile);

        JsonArray methods = profile.getAsJsonArray("top_methods");
        assertTrue(methods.size() >= 3);
        for (int i = 0; i < Math.min(3, methods.size()); i++) {
            assertTrue(methods.get(i).getAsJsonObject().has("pct"));
        }

        JsonArray hints = profile.getAsJsonArray("mod_hints");
        boolean hasSable = false;
        for (int i = 0; i < hints.size(); i++) {
            if ("sable".equals(hints.get(i).getAsJsonObject().get("mod_id").getAsString())) {
                hasSable = true;
                break;
            }
        }
        assertTrue(hasSable, "expected sable in mod_hints for H5BVV4Annz");

        JsonObject ctx = profile.getAsJsonObject("context");
        assertTrue(ctx.get("tps_1m").getAsDouble() < 15);
        assertTrue(ctx.get("mspt_p95_1m").getAsDouble() > 80);

        assertTrue(profile.has("recommendations"));
        assertTrue(profile.getAsJsonArray("recommendations").size() >= 1);

        assertTrue(profile.has("timeline"));
        JsonArray timeline = profile.getAsJsonArray("timeline");
        assertTrue(timeline.size() >= 1);
        assertTrue(timeline.get(0).getAsJsonObject().has("mspt_max"));

        assertTrue(profile.has("system"));
        JsonObject system = profile.getAsJsonObject("system");
        assertTrue(system.has("cpu") || system.has("memory") || system.has("gc"));

        assertTrue(profile.has("capture"));
        assertTrue(profile.has("deep"));
        assertTrue(profile.getAsJsonObject("deep").getAsJsonArray("top_methods").size() >= 10);

        assertEquals("https://spark.lucko.me/H5BVV4Annz", profile.get("spark_viewer_url").getAsString());
        assertEquals("https://spark.lucko.me/H5BVV4Annz?raw=1", profile.get("spark_raw_url").getAsString());

        if (ctx.has("tps_15m")) {
            assertTrue(ctx.get("tps_15m").getAsDouble() > 0);
        }
        if (ctx.has("mspt_p95_5m")) {
            assertTrue(ctx.get("mspt_p95_5m").getAsDouble() > 0);
        }
    }

    @Test
    void parsesHealthyFixture() throws Exception {
        assumeFixture(HEALTHY);
        byte[] bytes = Files.readAllBytes(HEALTHY);
        SparkSamplerProtos.SamplerData data = SparkSamplerProtos.SamplerData.parseFrom(bytes);
        SparkCollectResult result = new SparkCollectResult(
                HEALTHY, HEALTHY.getFileName().toString(), "config_spark", Instant.now(), data);
        JsonObject profile = SparkParser.toFacts(result, ReportConfig.builder().build());
        assertNotNull(profile);
        assertTrue(profile.getAsJsonArray("top_methods").size() >= 3);
        String grade = profile.getAsJsonObject("verdict").get("grade").getAsString();
        assertTrue(grade.equals("healthy") || grade.equals("degraded"));
    }

    @Test
    void collectorPicksNewestUpload(@TempDir Path temp) throws Exception {
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
    void corruptFileReturnsEmpty(@TempDir Path temp) throws Exception {
        Path server = temp.resolve("server");
        Path upload = server.resolve("watchtower/spark-upload");
        Files.createDirectories(upload);
        Files.writeString(upload.resolve("bad.sparkprofile"), "not protobuf");
        ReportConfig config = ReportConfig.builder().serverDir(server.toString()).build();
        assertTrue(SparkCollector.collect(server.toString(), config).isEmpty());
    }

    @Test
    void disabledCollectorReturnsEmpty(@TempDir Path temp) throws Exception {
        assumeFixture(FIXTURE);
        Path server = temp.resolve("server");
        Path upload = server.resolve("watchtower/spark-upload");
        Files.createDirectories(upload);
        Files.copy(FIXTURE, upload.resolve("p.sparkprofile"));
        ReportConfig config = ReportConfig.builder()
                .serverDir(server.toString())
                .sparkEnabled(false)
                .build();
        assertTrue(SparkCollector.collect(server.toString(), config).isEmpty());
    }

    @Test
    void collectorUsesMetadataStartTime(@TempDir Path temp) throws Exception {
        assumeFixture(FIXTURE);
        byte[] bytes = Files.readAllBytes(FIXTURE);
        SparkSamplerProtos.SamplerData data = SparkSamplerProtos.SamplerData.parseFrom(bytes);
        long startMs = data.getMetadata().getStartTime();
        org.junit.jupiter.api.Assumptions.assumeTrue(startMs > 0, "fixture missing start_time");

        Path server = temp.resolve("server");
        Path upload = server.resolve("watchtower/spark-upload");
        Files.createDirectories(upload);
        Path file = upload.resolve("timed.sparkprofile");
        Files.write(file, bytes);
        Files.setLastModifiedTime(file, java.nio.file.attribute.FileTime.from(Instant.EPOCH));

        ReportConfig config = ReportConfig.builder().serverDir(server.toString()).build();
        Optional<SparkCollectResult> result = SparkCollector.collect(server.toString(), config);
        assertTrue(result.isPresent());
        assertEquals(Instant.ofEpochMilli(startMs), result.get().capturedAt());
    }

    @Test
    void allocationModHintUsesAllocationWording() throws Exception {
        assumeFixture(FIXTURE);
        byte[] bytes = Files.readAllBytes(FIXTURE);
        SparkSamplerProtos.SamplerMetadata meta = SparkSamplerProtos.SamplerData.parseFrom(bytes).getMetadata().toBuilder()
                .setSamplerMode(SparkSamplerProtos.SamplerMetadata.SamplerMode.ALLOCATION)
                .build();
        SparkSamplerProtos.SamplerData parsed = SparkSamplerProtos.SamplerData.parseFrom(bytes);
        SparkSamplerProtos.SamplerData data = parsed.toBuilder().setMetadata(meta).build();
        SparkCollectResult result = new SparkCollectResult(
                FIXTURE, FIXTURE.getFileName().toString(), "config_spark", Instant.now(), data);
        JsonObject profile = SparkParser.toFacts(result, ReportConfig.builder().build());
        assertNotNull(profile);
        JsonArray hints = profile.getAsJsonArray("mod_hints");
        assertTrue(hints.size() > 0);
        String summary = hints.get(0).getAsJsonObject().get("summary").getAsString();
        assertFalse(summary.contains("Server thread"));
        assertTrue(summary.contains("allocation"));
    }

    private static void assumeFixture(Path path) {
        org.junit.jupiter.api.Assumptions.assumeTrue(Files.isRegularFile(path),
                "fixture missing: " + path);
    }
}
