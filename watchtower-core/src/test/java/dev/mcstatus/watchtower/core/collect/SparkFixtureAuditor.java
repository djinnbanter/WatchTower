package dev.mcstatus.watchtower.core.collect;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.report.ReportConfig;
import me.lucko.spark.proto.SparkSamplerProtos;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.stream.Stream;

/**
 * Parses real {@code .sparkprofile} fixtures and optionally writes golden JSON.
 */
public final class SparkFixtureAuditor {

    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();

    private SparkFixtureAuditor() {
    }

    public record AuditRow(
            String fileName,
            String fixtureKey,
            String grade,
            double tps,
            double mspt,
            String topMod,
            double topModPct,
            int topMethods,
            int deepMethods,
            int modRollups,
            int modHints,
            int keyFindings,
            int recommendations,
            int timeline,
            int threadsAnalyzed,
            int threadsOther,
            int entityHotspots,
            boolean hasSystem,
            boolean hasCapture,
            boolean hasViewerUrl) {
    }

    public static void main(String[] args) throws Exception {
        Path repoRoot = Path.of(args.length > 0 ? args[0] : "..").toAbsolutePath().normalize();
        boolean write = Boolean.parseBoolean(System.getProperty("spark.audit.write", "true"));
        Path outDir = repoRoot.resolve("samples/fixtures/spark");
        List<AuditRow> rows = audit(repoRoot, write ? outDir : null);
        printSummary(rows);
        if (write) {
            System.out.println("Wrote golden JSON to " + outDir);
        }
    }

    public static List<AuditRow> audit(Path repoRoot, Path writeDir) throws IOException {
        List<Path> fixtures = listFixtures(repoRoot);
        if (fixtures.isEmpty()) {
            return List.of();
        }
        ReportConfig config = ReportConfig.builder().sparkFreshHours(24 * 365).build();
        List<AuditRow> rows = new ArrayList<>();
        for (Path fixture : fixtures) {
            JsonObject profile = parseFixture(fixture, config);
            String key = fixtureKey(fixture.getFileName().toString());
            if (writeDir != null && profile != null) {
                Files.createDirectories(writeDir);
                Path out = writeDir.resolve("expected-" + key + ".json");
                Files.writeString(out, GSON.toJson(profile) + System.lineSeparator());
            }
            rows.add(toRow(fixture.getFileName().toString(), key, profile));
        }
        return rows;
    }

    public static List<Path> listFixtures(Path repoRoot) throws IOException {
        List<Path> dirs = List.of(
                repoRoot.resolve("fixtures/spark/examples"),
                repoRoot.resolve("samples/fixtures/spark"));
        for (Path dir : dirs) {
            if (!Files.isDirectory(dir)) {
                continue;
            }
            try (Stream<Path> stream = Files.list(dir)) {
                List<Path> files = stream
                        .filter(p -> p.getFileName().toString().endsWith(".sparkprofile"))
                        .sorted(Comparator.comparing(p -> p.getFileName().toString()))
                        .toList();
                if (!files.isEmpty()) {
                    return files;
                }
            }
        }
        return List.of();
    }

    public static JsonObject parseFixture(Path fixture, ReportConfig config) throws IOException {
        byte[] bytes = Files.readAllBytes(fixture);
        SparkSamplerProtos.SamplerData data = SparkSamplerProtos.SamplerData.parseFrom(bytes);
        String fileName = fixture.getFileName().toString();
        String normalizedName = normalizeFileName(fileName);
        String sourcePath = "watchtower/spark-upload/" + normalizedName;
        SparkCollectResult result = new SparkCollectResult(
                Path.of(sourcePath),
                normalizedName,
                "spark_upload",
                capturedAt(data, fixture),
                data);
        return SparkProfileBuilder.build(result, null, config);
    }

    public static String fixtureKey(String fileName) {
        String base = normalizeFileName(fileName);
        int dot = base.lastIndexOf('.');
        if (dot > 0) {
            base = base.substring(0, dot);
        }
        return base.toLowerCase(Locale.ROOT);
    }

    public static String normalizeFileName(String fileName) {
        return fileName.replace(" (1)", "");
    }

    private static Instant capturedAt(SparkSamplerProtos.SamplerData data, Path fixture) throws IOException {
        long startMs = data.getMetadata().getStartTime();
        if (startMs > 0) {
            return Instant.ofEpochMilli(startMs);
        }
        return Files.getLastModifiedTime(fixture).toInstant();
    }

    private static AuditRow toRow(String fileName, String key, JsonObject profile) {
        if (profile == null) {
            return new AuditRow(fileName, key, "null", 0, 0, "—", 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, false, false, false);
        }
        JsonObject verdict = profile.getAsJsonObject("verdict");
        JsonObject ctx = profile.has("context") ? profile.getAsJsonObject("context") : new JsonObject();
        String topMod = "—";
        double topModPct = 0;
        if (profile.has("mod_rollups")) {
            JsonArray rollups = profile.getAsJsonArray("mod_rollups");
            if (!rollups.isEmpty()) {
                JsonObject top = rollups.get(0).getAsJsonObject();
                topMod = top.get("mod_id").getAsString();
                topModPct = top.get("pct").getAsDouble();
            }
        }
        int deepMethods = profile.has("deep")
                ? profile.getAsJsonObject("deep").getAsJsonArray("top_methods").size()
                : 0;
        int hotspots = 0;
        if (ctx.has("entity_hotspots")) {
            hotspots = ctx.getAsJsonArray("entity_hotspots").size();
        }
        return new AuditRow(
                fileName,
                key,
                verdict.get("grade").getAsString(),
                ctx.has("tps_1m") ? ctx.get("tps_1m").getAsDouble() : 0,
                ctx.has("mspt_p95_1m") ? ctx.get("mspt_p95_1m").getAsDouble() : 0,
                topMod,
                topModPct,
                profile.getAsJsonArray("top_methods").size(),
                deepMethods,
                profile.getAsJsonArray("mod_rollups").size(),
                profile.getAsJsonArray("mod_hints").size(),
                profile.getAsJsonArray("key_findings").size(),
                profile.getAsJsonArray("recommendations").size(),
                profile.getAsJsonArray("timeline").size(),
                profile.getAsJsonArray("threads_analyzed").size(),
                profile.has("threads_other") ? profile.getAsJsonArray("threads_other").size() : 0,
                hotspots,
                profile.has("system") && !profile.getAsJsonObject("system").entrySet().isEmpty(),
                profile.has("capture"),
                profile.has("spark_viewer_url"));
    }

    public static void printSummary(List<AuditRow> rows) {
        System.out.println("=== Spark fixture audit ===");
        for (AuditRow r : rows) {
            System.out.printf(Locale.US,
                    "%s | grade=%s tps=%.1f mspt=%.0f top=%s@%.1f%% | methods=%d deep=%d hints=%d timeline=%d system=%s viewer=%s%n",
                    r.fileName(), r.grade(), r.tps(), r.mspt(), r.topMod(), r.topModPct(),
                    r.topMethods(), r.deepMethods(), r.modHints(), r.timeline(),
                    r.hasSystem(), r.hasViewerUrl());
        }
    }

    public static Optional<JsonObject> loadGolden(Path repoRoot, String fixtureKey) throws IOException {
        Path golden = repoRoot.resolve("samples/fixtures/spark/expected-" + fixtureKey + ".json");
        if (!Files.isRegularFile(golden)) {
            return Optional.empty();
        }
        return Optional.of(GSON.fromJson(Files.readString(golden), JsonObject.class));
    }
}
