package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.report.ReportConfig;
import dev.mcstatus.watchtower.core.spark.proto.SparkProtos;
import dev.mcstatus.watchtower.core.spark.proto.SparkSamplerProtos;
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
                FIXTURE, FIXTURE.getFileName().toString(), FIXTURE.getFileName().toString(),
                "config_spark", Instant.now(), data);
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

        assertTrue(profile.has("capture"));
        JsonObject capture = profile.getAsJsonObject("capture");
        if (capture.has("selected_server_properties")
                && !capture.getAsJsonObject("selected_server_properties").entrySet().isEmpty()) {
            assertTrue(profile.has("settings_advice"), "adaptive settings_advice should be attached");
            JsonArray advice = profile.getAsJsonArray("settings_advice");
            assertFalse(advice.isEmpty());
            JsonObject selected = capture.getAsJsonObject("selected_server_properties");
            // Expanded performance keys may be present when the capture includes them.
            for (String key : new String[]{
                    "network-compression-threshold", "max-tick-time", "use-native-transport"}) {
                if (selected.has(key)) {
                    boolean found = false;
                    for (int i = 0; i < advice.size(); i++) {
                        if (key.equals(advice.get(i).getAsJsonObject().get("key").getAsString())) {
                            found = true;
                            break;
                        }
                    }
                    assertTrue(found, "settings_advice missing expanded key " + key);
                }
            }
        }

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
        double ownTotal = 0;
        for (var element : profile.getAsJsonArray("source_rollups")) {
            JsonObject source = element.getAsJsonObject();
            String modId = source.get("mod_id").getAsString();
            assertFalse(modId.equals("com") || modId.equals("org") || modId.equals("io") || modId.equals("dev"),
                    "package prefix must not be emitted as a mod id: " + modId);
            double ownPct = source.get("own_pct").getAsDouble();
            assertTrue(ownPct >= 0);
            ownTotal += ownPct;
        }
        assertTrue(ownTotal <= 100.1, "exclusive source shares must not overlap: " + ownTotal);

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
                HEALTHY, HEALTHY.getFileName().toString(), HEALTHY.getFileName().toString(),
                "config_spark", Instant.now(), data);
        JsonObject profile = SparkParser.toFacts(result, ReportConfig.builder().build());
        assertNotNull(profile);
        assertTrue(profile.getAsJsonArray("top_methods").size() >= 3);
        JsonObject ctx = profile.getAsJsonObject("context");
        String grade = profile.getAsJsonObject("verdict").get("grade").getAsString();
        double msptMax5m = ctx.has("mspt_max_5m") ? ctx.get("mspt_max_5m").getAsDouble() : 0;
        // Average TPS can look fine while a multi-second stall still warrants critical.
        if (msptMax5m >= 1000) {
            assertEquals("critical", grade);
        } else {
            assertTrue(grade.equals("healthy") || grade.equals("degraded"));
        }
        assertTrue(ctx.has("mspt_mean_1m"));
        assertTrue(ctx.has("entity_composition"));
        assertEquals(HEALTHY.getFileName().toString(), profile.get("source_path").getAsString());
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
                FIXTURE, FIXTURE.getFileName().toString(), FIXTURE.getFileName().toString(),
                "config_spark", Instant.now(), data);
        JsonObject profile = SparkParser.toFacts(result, ReportConfig.builder().build());
        assertNotNull(profile);
        JsonArray hints = profile.getAsJsonArray("mod_hints");
        assertTrue(hints.size() > 0);
        String summary = hints.get(0).getAsJsonObject().get("summary").getAsString();
        assertFalse(summary.contains("Server thread"));
        assertTrue(summary.contains("allocation"));
    }

    @Test
    void analysisV2UsesExclusiveSelfAndServerRootNormalization() {
        SparkSamplerProtos.StackTraceNode nativeLeaf = node("native.libexample.so", "work", 10, 5);
        SparkSamplerProtos.StackTraceNode unknownChild = node("com.example.library.Child", "run", 60, 20)
                .toBuilder().addChildrenRefs(2).build();
        SparkSamplerProtos.StackTraceNode parent = node("com.example.mod.Parent", "tick", 100, 80)
                .toBuilder()
                .setMethodDesc("(I)V")
                .setParentLineNumber(31)
                .setLineNumber(42)
                .addChildrenRefs(1)
                .build();
        SparkSamplerProtos.ThreadNode server = SparkSamplerProtos.ThreadNode.newBuilder()
                .setName("Server thread")
                .addTimes(120).addTimes(100)
                .addChildren(parent).addChildren(unknownChild).addChildren(nativeLeaf)
                .addChildrenRefs(0)
                .build();
        SparkSamplerProtos.ThreadNode worker = SparkSamplerProtos.ThreadNode.newBuilder()
                .setName("Worker-1")
                .addTimes(50)
                .addChildren(node("com.worker.Task", "run", 50))
                .addChildrenRefs(0)
                .build();

        SparkSamplerProtos.SamplerData data = SparkSamplerProtos.SamplerData.newBuilder()
                .setMetadata(metadataV2())
                .addTimeWindows(100).addTimeWindows(101)
                .addThreads(server).addThreads(worker)
                .putClassSources("com.example.mod.Parent", "testmod")
                .build();
        SparkCollectResult result = new SparkCollectResult(
                Path.of("profile.sparkprofile"), "profile.sparkprofile", "profile.sparkprofile",
                "test", Instant.now(), data);

        JsonObject profile = SparkParser.toFacts(result, ReportConfig.builder().build());
        assertNotNull(profile);
        assertEquals(2, profile.get("analysis_version").getAsInt());
        JsonObject tree = profile.getAsJsonObject("call_tree");
        assertEquals(2, tree.getAsJsonArray("threads").size(), "all threads must be preserved");
        assertEquals("ms", tree.get("value_unit").getAsString());
        JsonObject serverTree = tree.getAsJsonArray("threads").get(0).getAsJsonObject();
        assertEquals("thread-0", serverTree.get("id").getAsString());
        assertEquals(100.0, serverTree.get("involvement_pct").getAsDouble(), 0.01);
        JsonObject parentTree = serverTree.getAsJsonArray("children").get(0).getAsJsonObject();
        assertEquals("thread-0", parentTree.get("parent_id").getAsString());
        assertEquals(100.0, parentTree.get("self_weight").getAsDouble(), 0.01);
        assertEquals("(I)V", parentTree.get("method_desc").getAsString());
        assertEquals(31, parentTree.get("parent_line").getAsInt());
        assertNonnegativeSelf(parentTree);

        for (var element : profile.getAsJsonArray("source_rollups")) {
            JsonObject source = element.getAsJsonObject();
            assertNotEquals("com", source.get("mod_id").getAsString());
            assertTrue(source.get("own_pct").getAsDouble() >= 0);
        }
        JsonObject testmod = findByMod(profile.getAsJsonArray("source_rollups"), "testmod");
        assertEquals(45.45, testmod.get("own_pct").getAsDouble(), 0.01);
        assertEquals(81.82, testmod.get("involvement_pct").getAsDouble(), 0.01);
        for (var element : profile.getAsJsonArray("source_rollups")) {
            JsonObject source = element.getAsJsonObject();
            assertTrue(source.get("involvement_pct").getAsDouble() <= 100.0 + 0.01,
                    source.get("mod_id").getAsString() + " involvement exceeds 100%");
            assertTrue(source.get("own_pct").getAsDouble()
                    <= source.get("involvement_pct").getAsDouble() + 0.01);
        }
        JsonObject catalog = profile.getAsJsonObject("mod_catalog").getAsJsonObject("testmod");
        assertTrue(catalog.get("builtin").getAsBoolean());
        assertEquals("Test source", catalog.get("description").getAsString());
        assertEquals(20, profile.getAsJsonObject("context").get("target_tps").getAsInt());
        assertEquals(50, profile.getAsJsonObject("context").get("target_mspt").getAsInt());
        assertFalse(profile.getAsJsonObject("system").getAsJsonObject("cpu").has("process_1m"));
        assertEquals("percent",
                profile.getAsJsonObject("system").getAsJsonObject("cpu").get("usage_unit").getAsString());
        assertEquals(50,
                profile.getAsJsonObject("system").getAsJsonObject("cpu").get("system_1m").getAsDouble(),
                0.01);
        JsonObject gc = profile.getAsJsonObject("system").getAsJsonObject("gc");
        assertEquals(7, gc.get("total_collections").getAsLong());
        assertFalse(gc.has("total_ms"));
        JsonObject settings = profile.getAsJsonObject("capture").getAsJsonObject("profiler_settings");
        assertEquals("by_pool", settings.get("thread_grouper").getAsString());
        assertEquals(3, settings.get("included_ticks").getAsInt());
    }

    @Test
    void nestedSameSourceInvolvementIsNotDoubleCounted() {
        SparkSamplerProtos.StackTraceNode child = node("com.example.mod.Child", "work", 40)
                .toBuilder().build();
        SparkSamplerProtos.StackTraceNode parent = node("com.example.mod.Parent", "tick", 100)
                .toBuilder()
                .addChildrenRefs(1)
                .build();
        SparkSamplerProtos.ThreadNode server = SparkSamplerProtos.ThreadNode.newBuilder()
                .setName("Server thread")
                .addTimes(100)
                .addChildren(parent).addChildren(child)
                .addChildrenRefs(0)
                .build();
        SparkSamplerProtos.SamplerData data = SparkSamplerProtos.SamplerData.newBuilder()
                .setMetadata(metadataV2())
                .addTimeWindows(100)
                .addThreads(server)
                .putClassSources("com.example.mod.Parent", "testmod")
                .putClassSources("com.example.mod.Child", "testmod")
                .build();
        SparkCollectResult result = new SparkCollectResult(
                Path.of("nested.sparkprofile"), "nested.sparkprofile", "nested.sparkprofile",
                "test", Instant.now(), data);
        JsonObject profile = SparkParser.toFacts(result, ReportConfig.builder().build());
        assertNotNull(profile);
        JsonObject testmod = findByMod(profile.getAsJsonArray("source_rollups"), "testmod");
        assertEquals(100.0, testmod.get("own_pct").getAsDouble(), 0.01);
        assertEquals(100.0, testmod.get("involvement_pct").getAsDouble(), 0.01);
    }

    private static SparkSamplerProtos.StackTraceNode node(
            String className, String methodName, double... times) {
        SparkSamplerProtos.StackTraceNode.Builder builder = SparkSamplerProtos.StackTraceNode.newBuilder()
                .setClassName(className)
                .setMethodName(methodName);
        for (double time : times) {
            builder.addTimes(time);
        }
        return builder.build();
    }

    private static SparkSamplerProtos.SamplerMetadata metadataV2() {
        SparkProtos.PlatformStatistics platform = SparkProtos.PlatformStatistics.newBuilder()
                .setTps(SparkProtos.PlatformStatistics.Tps.newBuilder()
                        .setLast1M(18).setGameTargetTps(20))
                .setMspt(SparkProtos.PlatformStatistics.Mspt.newBuilder()
                        .setLast1M(SparkProtos.RollingAverageValues.newBuilder().setPercentile95(55))
                        .setGameMaxIdealMspt(50))
                .build();
        SparkProtos.SystemStatistics system = SparkProtos.SystemStatistics.newBuilder()
                .setCpu(SparkProtos.SystemStatistics.Cpu.newBuilder()
                        .setThreads(8)
                        .setProcessUsage(SparkProtos.SystemStatistics.Cpu.Usage.newBuilder().setLast1M(-1))
                        .setSystemUsage(SparkProtos.SystemStatistics.Cpu.Usage.newBuilder().setLast1M(0.5)))
                .putGc("G1 Young", SparkProtos.SystemStatistics.Gc.newBuilder()
                        .setTotal(7).setAvgTime(4.5).build())
                .build();
        return SparkSamplerProtos.SamplerMetadata.newBuilder()
                .setPlatformMetadata(SparkProtos.PlatformMetadata.newBuilder()
                        .setType(SparkProtos.PlatformMetadata.Type.SERVER)
                        .setName("NeoForge")
                        .setBrand("test-brand"))
                .setPlatformStatistics(platform)
                .setSystemStatistics(system)
                .setDataAggregator(SparkSamplerProtos.SamplerMetadata.DataAggregator.newBuilder()
                        .setType(SparkSamplerProtos.SamplerMetadata.DataAggregator.Type.TICKED)
                        .setThreadGrouper(SparkSamplerProtos.SamplerMetadata.DataAggregator.ThreadGrouper.BY_POOL)
                        .setTickLengthThreshold(50)
                        .setNumberOfIncludedTicks(3))
                .putSources("testmod", SparkProtos.PluginOrModMetadata.newBuilder()
                        .setName("Test Mod")
                        .setDescription("Test source")
                        .setBuiltin(true)
                        .build())
                .build();
    }

    private static void assertNonnegativeSelf(JsonObject node) {
        for (var value : node.getAsJsonArray("self_by_window")) {
            assertTrue(value.getAsDouble() >= 0);
        }
        for (var child : node.getAsJsonArray("children")) {
            assertNonnegativeSelf(child.getAsJsonObject());
        }
    }

    private static JsonObject findByMod(JsonArray rows, String modId) {
        for (var element : rows) {
            JsonObject row = element.getAsJsonObject();
            if (modId.equals(row.get("mod_id").getAsString())) {
                return row;
            }
        }
        fail("missing mod: " + modId);
        return null;
    }

    private static void assumeFixture(Path path) {
        org.junit.jupiter.api.Assumptions.assumeTrue(Files.isRegularFile(path),
                "fixture missing: " + path);
    }
}
