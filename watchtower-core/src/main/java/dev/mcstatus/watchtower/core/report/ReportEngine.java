package dev.mcstatus.watchtower.core.report;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.WatchtowerFiles;
import dev.mcstatus.watchtower.core.analyze.ReportPipeline;
import dev.mcstatus.watchtower.core.collect.SparkCollector;
import dev.mcstatus.watchtower.core.collect.StagingBuilder;
import dev.mcstatus.watchtower.core.incident.IncidentReader;
import dev.mcstatus.watchtower.core.ops.LagIssueBuilder;
import dev.mcstatus.watchtower.core.util.TimeParse;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;

/**
 * Pure-Java health report: staging → facts → brief (no subprocess).
 */
public final class ReportEngine {

    public static final String ENGINE_ID = "java";
    public static final String ENGINE_VERSION = "4.0.6";

    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static final DateTimeFormatter WINDOW_FMT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss");

    private ReportEngine() {
    }

    public record ReportResult(
            boolean success,
            String message,
            Path briefPath,
            Path factsPath,
            JsonObject facts
    ) {
        public static ReportResult failure(String message) {
            return new ReportResult(false, message, null, null, null);
        }
    }

    public static ReportResult run(ReportConfig baseConfig, Path reportDir) {
        List<String> warnings = new ArrayList<>();
        try {
            Files.createDirectories(reportDir);
            Path statePath = baseConfig.stateFile() != null && !baseConfig.stateFile().isBlank()
                    ? Path.of(baseConfig.stateFile())
                    : reportDir.resolve(WatchtowerFiles.STATE_FILENAME);

            Window window = computeWindow(baseConfig, statePath);
            ReportConfig config = ReportConfig.builder()
                    .from(baseConfig)
                    .windowStart(window.windowStart)
                    .since(window.windowStart)
                    .stateFile(statePath.toString())
                    .build();

            JsonObject staging = StagingBuilder.buildStaging(config);
            JsonObject meta = staging.getAsJsonObject("meta");
            if (meta == null) {
                meta = new JsonObject();
                staging.add("meta", meta);
            }
            meta.addProperty("engine", ENGINE_ID);
            meta.addProperty("engine_version", ENGINE_VERSION);
            addSourcePaths(meta, config, reportDir);

            JsonObject facts = ReportPipeline.buildFacts(staging);
            JsonObject factsMeta = facts.getAsJsonObject("meta");
            if (factsMeta != null) {
                factsMeta.addProperty("engine", ENGINE_ID);
                factsMeta.addProperty("engine_version", ENGINE_VERSION);
                if (meta.has("source_paths")) {
                    factsMeta.add("source_paths", meta.get("source_paths"));
                }
            }

            enrichRecentIncidents(facts, config.serverDir());

            String timestamp = ZonedDateTime.now(ZoneId.systemDefault()).format(
                    DateTimeFormatter.ofPattern("yyyy-MM-dd_HH-mm-ss"));
            Path factsPath = reportDir.resolve(WatchtowerFiles.FACTS_PREFIX + timestamp + ".json");
            Path briefPath = reportDir.resolve(WatchtowerFiles.BRIEF_PREFIX + timestamp + ".txt");

            Files.writeString(factsPath, GSON.toJson(facts) + System.lineSeparator(), StandardCharsets.UTF_8);
            String brief = ReportPipeline.writeBrief(facts);
            Files.writeString(briefPath, brief, StandardCharsets.UTF_8);

            if (!config.disasterRecovery()) {
                StateManager.updateAfterReport(statePath, window.windowStart, facts, config.lookbackHours());
            }

            return new ReportResult(true, "Report completed", briefPath, factsPath, facts);
        } catch (Exception e) {
            warnings.add(e.getMessage() != null ? e.getMessage() : e.toString());
            return ReportResult.failure("Report error: " + String.join("; ", warnings));
        }
    }

    public static JsonObject buildSourcePaths(ReportConfig config, Path reportDir) {
        JsonObject meta = new JsonObject();
        addSourcePaths(meta, config, reportDir);
        return meta.getAsJsonObject("source_paths");
    }

    private static void addSourcePaths(JsonObject meta, ReportConfig config, Path reportDir) {
        if (!config.serverDirValid()) {
            return;
        }
        JsonObject paths = new JsonObject();
        String serverDir = config.serverDir();
        paths.addProperty("server_dir", serverDir);
        paths.addProperty("logs", serverDir + "/logs/latest.log");
        paths.addProperty("crash_reports", serverDir + "/crash-reports/");
        paths.addProperty("snapshot", serverDir + "/watchtower/snapshot.json");
        String statePath = config.stateFile() != null && !config.stateFile().isBlank()
                ? config.stateFile()
                : reportDir.resolve(WatchtowerFiles.STATE_FILENAME).toString();
        paths.addProperty("state", statePath);
        paths.addProperty("reports_dir", Path.of(serverDir, "watchtower").toString());
        int lookback = config.lookbackMinutes() > 0 ? config.lookbackMinutes() : config.lookbackHours();
        String journalUnit = config.lookbackMinutes() > 0 ? lookback + " minutes ago" : lookback + " hours ago";
        paths.addProperty("journal", "journalctl --since \"" + journalUnit + "\"");
        if (config.craftyApp() != null && !config.craftyApp().isBlank()) {
            paths.addProperty("audit", config.craftyApp() + "/logs/audit.log");
        }
        if (config.backupDir() != null && !config.backupDir().isBlank()) {
            paths.addProperty("backup", config.backupDir());
        }
        paths.addProperty("spark_upload", serverDir + "/watchtower/spark-upload/");
        paths.addProperty("spark_config", serverDir + "/config/spark/");
        SparkCollector.collect(serverDir, config).ifPresent(result ->
                paths.addProperty("spark_profile_file", result.sourcePath().toString().replace('\\', '/')));
        meta.add("source_paths", paths);
    }

    private record Window(String windowStart) {}

    private static Window computeWindow(ReportConfig config, Path statePath) throws IOException {
        ZonedDateTime now = ZonedDateTime.now(ZoneId.systemDefault());
        ZonedDateTime lookbackSince = config.lookbackMinutes() > 0
                ? now.minusMinutes(config.lookbackMinutes())
                : now.minusHours(config.lookbackHours());
        String lookbackSinceStr = lookbackSince.format(WINDOW_FMT);

        if (config.disasterRecovery() || !config.incremental() || !Files.isRegularFile(statePath)) {
            return new Window(lookbackSinceStr);
        }

        String lastRun = readLastRun(statePath);
        if (lastRun == null || lastRun.isBlank()) {
            return new Window(lookbackSinceStr);
        }

        Instant lastInstant = TimeParse.parseTime(lastRun);
        if (lastInstant == null) {
            return new Window(lookbackSinceStr);
        }

        ZonedDateTime overlapSince = lastInstant.atZone(ZoneId.systemDefault()).minusMinutes(5);
        ZonedDateTime windowStart = overlapSince.isAfter(lookbackSince) ? overlapSince : lookbackSince;
        return new Window(windowStart.format(WINDOW_FMT));
    }

    private static String readLastRun(Path statePath) throws IOException {
        if (!Files.isRegularFile(statePath)) {
            return null;
        }
        String text = Files.readString(statePath, StandardCharsets.UTF_8);
        try {
            JsonObject state = com.google.gson.JsonParser.parseString(text).getAsJsonObject();
            return state.has("last_run") ? state.get("last_run").getAsString() : null;
        } catch (Exception e) {
            return null;
        }
    }

    private static void enrichRecentIncidents(JsonObject facts, String serverDir) {
        if (serverDir == null || serverDir.isBlank() || facts == null) {
            return;
        }
        try {
            Path incidentsDir = Path.of(serverDir, "watchtower", "incidents");
            var summaries = IncidentReader.listSummaries(incidentsDir, 5);
            if (summaries.isEmpty()) {
                return;
            }
            JsonObject optional = facts.has("optional") && facts.get("optional").isJsonObject()
                    ? facts.getAsJsonObject("optional")
                    : new JsonObject();
            JsonObject sparkProfile = optional.has("spark_profile")
                    ? optional.getAsJsonObject("spark_profile") : null;
            optional.add("recent_incidents", IncidentReader.toJsonArray(summaries));

            JsonArray peekEntries = new JsonArray();
            for (JsonObject summary : summaries) {
                if (!summary.has("id")) {
                    continue;
                }
                JsonObject full = IncidentReader.loadById(incidentsDir, summary.get("id").getAsString());
                if (full != null) {
                    peekEntries.add(LagIssueBuilder.buildPeekEntry(full, sparkProfile));
                }
            }
            int active = 0;
            for (JsonElement el : peekEntries) {
                JsonObject row = el.getAsJsonObject();
                if (!row.has("resolved") || !row.get("resolved").getAsBoolean()) {
                    active++;
                }
            }
            JsonObject lagIncidents = new JsonObject();
            lagIncidents.addProperty("updated_at",
                    ZonedDateTime.now(ZoneId.systemDefault()).format(DateTimeFormatter.ISO_OFFSET_DATE_TIME));
            lagIncidents.addProperty("active_count", active);
            lagIncidents.add("entries", peekEntries);
            optional.add("lag_incidents", lagIncidents);

            facts.add("optional", optional);
        } catch (IOException ignored) {
            // optional enrichment
        }
    }
}
