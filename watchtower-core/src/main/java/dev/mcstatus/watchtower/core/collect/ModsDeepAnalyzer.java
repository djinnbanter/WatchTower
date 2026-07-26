package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.report.ReportConfig;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;

/**
 * Continuous Mods deep / forensics delta: incremental class index + optional corrupt walk + config health.
 * Writes an ops-cache {@code mods_deep} block — never full StagingBuilder.
 */
public final class ModsDeepAnalyzer {

    public static final String OPS_KEY = "mods_deep";

    private ModsDeepAnalyzer() {
    }

    /**
     * Run deep delta against {@code serverDir}/mods. Safe to call async off the ops tick.
     */
    public static JsonObject analyze(String serverDir, ReportConfig config, String trigger) {
        JsonObject out = new JsonObject();
        out.addProperty("updated_at", Instant.now().toString());
        out.addProperty("trigger", trigger != null ? trigger : "manual");
        if (config == null || !config.modForensicsScan()) {
            out.addProperty("status", "skipped");
            out.addProperty("reason", "MOD_FORENSICS_SCAN disabled");
            return out;
        }
        if (serverDir == null || serverDir.isBlank()) {
            out.addProperty("status", "error");
            out.addProperty("reason", "no server dir");
            return out;
        }
        Path serverPath = Path.of(serverDir);
        Path modsDir = serverPath.resolve("mods");
        if (!Files.isDirectory(modsDir)) {
            out.addProperty("status", "skipped");
            out.addProperty("reason", "no mods dir");
            return out;
        }

        try {
            Path cache = JarClassIndex.defaultCachePath(serverDir);
            JsonArray mods = ModJarMetadataReader.listModsFromDir(serverDir);
            JarClassIndex index = JarClassIndex.build(modsDir, mods, cache, config.modsDeepMaxJarsPerWake());
            JsonObject indexJson = new JsonObject();
            indexJson.addProperty("status", ModForensicsCollector.STATE_READY);
            indexJson.addProperty("jar_count", index.stats().jarCount());
            indexJson.addProperty("entry_count", index.stats().entryCount());
            indexJson.addProperty("jars_rebuilt", index.stats().jarsRebuilt());
            indexJson.addProperty("jars_reused", index.stats().jarsReused());
            indexJson.addProperty("from_cache", index.stats().fromCache());
            indexJson.addProperty("built_at", index.stats().builtAt());
            out.add("class_index", indexJson);

            JsonArray corruptJson = new JsonArray();
            if (config.forensicsCorruptJarWalk()) {
                List<CorruptedJarScanner.Hit> hits = CorruptedJarScanner.scanModsDir(modsDir);
                corruptJson = CorruptedJarScanner.toJson(hits);
            }
            out.add("corrupt_jars", corruptJson);

            List<ConfigHealthScanner.Issue> health = ConfigHealthScanner.scan(serverPath);
            out.add("config_health", ConfigHealthScanner.toJson(health));

            out.addProperty("status", "ok");
            out.addProperty("max_jars_per_wake", config.modsDeepMaxJarsPerWake());
        } catch (Exception e) {
            out.addProperty("status", "error");
            out.addProperty("reason", e.getMessage() != null ? e.getMessage() : e.toString());
        }
        return out;
    }
}
