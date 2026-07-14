package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.report.ReportConfig;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

/**
 * Mod forensics toolbox (1.0.17 / WT-034): status + L3 scan orchestration.
 * Index builds are on-demand or gated by {@code FORENSICS_INDEX_ON_REPORT} — never on live poll.
 */
public final class ModForensicsCollector {

    public static final String STATE_READY = "ready";
    public static final String STATE_BUILDING = "building";
    public static final String STATE_SKIPPED = "skipped";
    /** Master on, but no cache yet — find-class will build on demand. */
    public static final String STATE_IDLE = "idle";
    public static final String STATE_ERROR = "error";

    private ModForensicsCollector() {
    }

    /**
     * Build {@code GET /api/mods/forensics/status} payload.
     */
    public static JsonObject status(
            ReportConfig config,
            String indexState,
            String indexBuiltAt,
            int jarCount,
            int entryCount,
            boolean stale,
            JsonObject lastReportScan) {
        JsonObject out = new JsonObject();
        boolean enabled = config != null && config.modForensicsScan();
        String state = !enabled ? STATE_SKIPPED
                : (indexState != null && !indexState.isBlank() ? indexState : STATE_IDLE);

        JsonObject index = new JsonObject();
        index.addProperty("state", state);
        if (indexBuiltAt != null && !indexBuiltAt.isBlank()) {
            index.addProperty("built_at", indexBuiltAt);
        }
        index.addProperty("jar_count", Math.max(0, jarCount));
        index.addProperty("entry_count", Math.max(0, entryCount));
        index.addProperty("stale", stale);
        out.add("index", index);

        if (lastReportScan != null) {
            out.add("last_report_scan", lastReportScan.deepCopy());
        } else {
            JsonObject empty = new JsonObject();
            empty.addProperty("corrupt_jars", 0);
            empty.addProperty("config_issues", 0);
            empty.addProperty("stderr_merged", false);
            out.add("last_report_scan", empty);
        }

        JsonObject cfg = new JsonObject();
        cfg.addProperty("mod_forensics_scan", enabled);
        cfg.addProperty("corrupt_jar_walk", config != null && config.forensicsCorruptJarWalk());
        cfg.addProperty("index_on_report", config != null && config.forensicsIndexOnReport());
        if (config != null && config.forensicsStderrPaths() != null) {
            cfg.addProperty("stderr_paths", config.forensicsStderrPaths());
        }
        out.add("config", cfg);
        return out;
    }

    /** Empty facts block for optional.mod_forensics when master is off. */
    public static JsonObject emptyFacts(ReportConfig config) {
        JsonObject facts = new JsonObject();
        facts.addProperty("class_index_status", STATE_SKIPPED);
        facts.add("corrupt_jars", new JsonArray());
        facts.add("stderr_sources", new JsonArray());
        JsonObject scanConfig = new JsonObject();
        scanConfig.addProperty("mod_forensics_scan", config != null && config.modForensicsScan());
        scanConfig.addProperty("corrupt_jar_walk", config != null && config.forensicsCorruptJarWalk());
        scanConfig.addProperty("index_on_report", config != null && config.forensicsIndexOnReport());
        facts.add("scan_config", scanConfig);
        return facts;
    }

    /**
     * L3 forensics collect into {@code optional}. Returns issue rows to add (id, message, severity).
     */
    public static List<JsonObject> applyToOptional(
            JsonObject optional,
            ReportConfig config,
            String serverDir,
            String logBlob,
            boolean hasActiveRuntimeCrash) {
        List<JsonObject> issues = new ArrayList<>();
        if (optional == null) {
            return issues;
        }
        if (config == null || !config.modForensicsScan()) {
            optional.add("mod_forensics", emptyFacts(config));
            return issues;
        }
        Path serverPath = serverDir != null && !serverDir.isBlank() ? Path.of(serverDir) : null;
        JsonObject mf = emptyFacts(config);
        mf.addProperty("class_index_status", STATE_SKIPPED);

        List<CorruptedJarScanner.Hit> corrupt = new ArrayList<>();
        if (logBlob != null && !logBlob.isBlank()) {
            corrupt.addAll(CorruptedJarScanner.scanLogs(logBlob));
        }
        if (optional.has("startup_profile") && optional.get("startup_profile").isJsonObject()) {
            JsonObject sp = optional.getAsJsonObject("startup_profile");
            if (sp.has("stderr_excerpt") && sp.get("stderr_excerpt").isJsonArray()) {
                StringBuilder sb = new StringBuilder();
                for (var el : sp.getAsJsonArray("stderr_excerpt")) {
                    sb.append(el.getAsString()).append('\n');
                }
                corrupt.addAll(CorruptedJarScanner.scanLogs(sb.toString()));
            }
        }
        if (config.forensicsCorruptJarWalk() && serverPath != null) {
            corrupt.addAll(CorruptedJarScanner.scanModsDir(serverPath.resolve("mods")));
        }
        JsonArray corruptJson = CorruptedJarScanner.toJson(corrupt);
        mf.add("corrupt_jars", corruptJson);

        for (CorruptedJarScanner.Hit hit : corrupt) {
            JsonObject issue = new JsonObject();
            issue.addProperty("id", "CORRUPTED_MOD_JAR");
            String msg = "Corrupt mod jar detected"
                    + (hit.path() != null ? ": " + hit.path() : "")
                    + " (" + hit.reason() + "). Re-download the jar; do not delete automatically.";
            issue.addProperty("message", msg);
            issue.addProperty("severity", hasActiveRuntimeCrash ? "info" : "warning");
            issues.add(issue);
        }

        if (serverPath != null) {
            List<ConfigHealthScanner.Issue> health = ConfigHealthScanner.scan(serverPath);
            optional.add("config_health", ConfigHealthScanner.toJson(health));
            for (ConfigHealthScanner.Issue hi : health) {
                JsonObject issue = new JsonObject();
                issue.addProperty("id", "CONFIG_CORRUPT");
                issue.addProperty("message", "Config issue " + hi.path() + " (" + hi.reason()
                        + "). Fix or delete the file manually — Watchtower will not remove it.");
                issue.addProperty("severity", hasActiveRuntimeCrash ? "info" : "warning");
                issues.add(issue);
            }
        }

        if (optional.has("startup_profile") && optional.get("startup_profile").isJsonObject()) {
            JsonObject sp = optional.getAsJsonObject("startup_profile");
            if (sp.has("stderr_sources") && sp.get("stderr_sources").isJsonArray()) {
                mf.add("stderr_sources", sp.getAsJsonArray("stderr_sources").deepCopy());
            }
        }

        if (config.forensicsIndexOnReport() && serverPath != null) {
            try {
                Path modsDir = serverPath.resolve("mods");
                Path cache = JarClassIndex.defaultCachePath(serverDir);
                JsonArray mods = optional.has("mods") && optional.get("mods").isJsonArray()
                        ? optional.getAsJsonArray("mods")
                        : ModJarMetadataReader.listModsFromDir(serverDir);
                JarClassIndex index = JarClassIndex.build(modsDir, mods, cache);
                mf.addProperty("class_index_status", STATE_READY);
                mf.addProperty("class_index_built_at", index.stats().builtAt());
                mf.addProperty("class_index_jar_count", index.stats().jarCount());
                mf.addProperty("class_index_entry_count", index.stats().entryCount());
                if (index.isStale(modsDir)) {
                    JsonObject stale = new JsonObject();
                    stale.addProperty("id", "FORENSICS_INDEX_STALE");
                    stale.addProperty("message", "Forensics class index is stale — rebuild via find-class or next report.");
                    stale.addProperty("severity", "info");
                    issues.add(stale);
                }
            } catch (Exception e) {
                mf.addProperty("class_index_status", STATE_ERROR);
            }
        } else {
            Path cache = serverDir != null ? JarClassIndex.defaultCachePath(serverDir) : null;
            if (cache != null && Files.isRegularFile(cache)) {
                mf.addProperty("class_index_status", STATE_READY);
                JarClassIndex.BuildStats peek = JarClassIndex.peekCacheStats(cache);
                if (peek != null && peek.builtAt() != null) {
                    mf.addProperty("class_index_built_at", peek.builtAt());
                    mf.addProperty("class_index_jar_count", peek.jarCount());
                    mf.addProperty("class_index_entry_count", peek.entryCount());
                }
            } else {
                mf.addProperty("class_index_status", STATE_IDLE);
            }
        }

        optional.add("mod_forensics", mf);
        return issues;
    }
}
