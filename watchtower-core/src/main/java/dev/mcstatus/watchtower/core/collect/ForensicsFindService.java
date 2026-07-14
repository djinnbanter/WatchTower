package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.report.ReportConfig;

import java.io.IOException;
import java.nio.file.Path;
import java.util.List;

/**
 * Shared find-class / find-package helpers for HTTP + CLI (CA-19).
 */
public final class ForensicsFindService {

    private ForensicsFindService() {
    }

    public static JsonObject findClass(
            ReportConfig config,
            Path modsDir,
            JsonArray mods,
            Path cacheFile,
            String className,
            boolean includeNested) throws IOException {
        JsonObject out = new JsonObject();
        if (config == null || !config.modForensicsScan()) {
            out.addProperty("state", ModForensicsCollector.STATE_SKIPPED);
            out.addProperty("error", "MOD_FORENSICS_SCAN is disabled");
            out.add("matches", new JsonArray());
            return out;
        }
        String query = JarClassIndex.normalizeClassQuery(className);
        out.addProperty("query", query != null ? query : "");
        JarClassIndex index = JarClassIndex.build(modsDir, mods, cacheFile);
        List<JarClassIndex.Match> matches = index.findClass(className, includeNested);
        out.add("matches", matchesToJson(matches));
        out.addProperty("index_built_at", index.stats().builtAt());
        out.addProperty("truncated", index.truncated(matches));
        out.addProperty("from_cache", index.stats().fromCache());
        out.addProperty("jar_count", index.stats().jarCount());
        out.addProperty("entry_count", index.stats().entryCount());
        return out;
    }

    public static JsonObject findPackage(
            ReportConfig config,
            Path modsDir,
            JsonArray mods,
            Path cacheFile,
            String packageName,
            String mode) throws IOException {
        JsonObject out = new JsonObject();
        if (config == null || !config.modForensicsScan()) {
            out.addProperty("state", ModForensicsCollector.STATE_SKIPPED);
            out.addProperty("error", "MOD_FORENSICS_SCAN is disabled");
            out.add("matches", new JsonArray());
            return out;
        }
        out.addProperty("package", packageName != null ? packageName : "");
        out.addProperty("mode", mode != null ? mode : "prefix");
        JarClassIndex index = JarClassIndex.build(modsDir, mods, cacheFile);
        List<JarClassIndex.Match> matches = index.findPackage(packageName, mode);
        JsonArray arr = new JsonArray();
        for (JarClassIndex.Match m : matches) {
            JsonObject row = new JsonObject();
            row.addProperty("mod_id", m.modId());
            row.addProperty("jar", m.jar());
            row.addProperty("match_count", 1);
            if (m.innerPath() != null) {
                row.addProperty("package_path", m.innerPath());
            }
            arr.add(row);
        }
        out.add("matches", arr);
        out.addProperty("index_built_at", index.stats().builtAt());
        out.addProperty("truncated", index.truncated(matches));
        return out;
    }

    private static JsonArray matchesToJson(List<JarClassIndex.Match> matches) {
        JsonArray arr = new JsonArray();
        for (JarClassIndex.Match m : matches) {
            JsonObject row = new JsonObject();
            row.addProperty("mod_id", m.modId());
            row.addProperty("jar", m.jar());
            if (m.innerPath() != null) {
                row.addProperty("inner_path", m.innerPath());
            }
            row.addProperty("source", m.source() != null ? m.source() : "jar_entry_scan");
            arr.add(row);
        }
        return arr;
    }
}
