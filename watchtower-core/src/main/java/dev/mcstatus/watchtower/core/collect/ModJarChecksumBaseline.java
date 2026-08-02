package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.Set;

/**
 * SHA-512 jar checksum helpers for pack drift lock (same filename + version, different hash).
 * Reuses {@link ModrinthLookupService#sha512Hex} and caches by jar+size+mtime so ops polls
 * do not rehash unchanged files.
 */
public final class ModJarChecksumBaseline {

    private ModJarChecksumBaseline() {
    }

    /** Hex SHA-512 of a jar file; empty string on failure. */
    public static String sha512Hex(Path jar) {
        try {
            return ModrinthLookupService.sha512Hex(jar);
        } catch (Exception e) {
            return "";
        }
    }

    /**
     * Fill {@code sha512} on each snapshot row. Reuses hash from {@code previousSnapshot}
     * when the same jar has identical size and mtime.
     */
    public static void enrichSnapshot(Path modsDir, JsonArray rows, JsonArray previousSnapshot) {
        if (rows == null || rows.isEmpty() || modsDir == null) {
            return;
        }
        Map<String, JsonObject> prevByJar = indexByJar(previousSnapshot);
        for (JsonElement el : rows) {
            if (!el.isJsonObject()) {
                continue;
            }
            JsonObject row = el.getAsJsonObject();
            if (!row.has("jar")) {
                continue;
            }
            String jarName = row.get("jar").getAsString();
            JsonObject prev = prevByJar.get(jarName);
            if (prev != null
                    && prev.has("sha512")
                    && !prev.get("sha512").getAsString().isBlank()
                    && sameSizeMtime(row, prev)) {
                row.addProperty("sha512", prev.get("sha512").getAsString());
                continue;
            }
            Path jar = modsDir.resolve(jarName);
            if (!Files.isRegularFile(jar)) {
                continue;
            }
            String hash = sha512Hex(jar);
            if (!hash.isBlank()) {
                row.addProperty("sha512", hash);
            }
        }
    }

    /**
     * Same jar key, same version (or both blank), both hashes present and unequal → drift.
     * Empty baseline yields no drift (seed only).
     */
    public static JsonArray detectDrift(JsonArray current, JsonArray baseline) {
        JsonArray drift = new JsonArray();
        if (current == null || baseline == null || baseline.isEmpty()) {
            return drift;
        }
        Map<String, JsonObject> baseByJar = indexByJar(baseline);
        for (JsonElement el : current) {
            if (!el.isJsonObject()) {
                continue;
            }
            JsonObject cur = el.getAsJsonObject();
            if (!cur.has("jar")) {
                continue;
            }
            String jar = cur.get("jar").getAsString();
            JsonObject prev = baseByJar.get(jar);
            if (prev == null) {
                continue;
            }
            if (!versionsEqual(cur, prev)) {
                continue;
            }
            String curHash = shaOf(cur);
            String prevHash = shaOf(prev);
            if (curHash.isBlank() || prevHash.isBlank()) {
                continue;
            }
            if (curHash.equalsIgnoreCase(prevHash)) {
                continue;
            }
            JsonObject row = new JsonObject();
            row.addProperty("jar", jar);
            if (cur.has("mod_id") && !cur.get("mod_id").isJsonNull()) {
                row.addProperty("mod_id", cur.get("mod_id").getAsString());
            }
            String ver = versionOf(cur);
            if (!ver.isBlank()) {
                row.addProperty("version", ver);
            }
            row.addProperty("prev_sha512", prevHash);
            row.addProperty("sha512", curHash);
            row.addProperty("change", "drift");
            drift.add(row);
        }
        return drift;
    }

    /**
     * Next baseline: current rows for jars that are new, version-changed, or not drifting;
     * keep previous hash for active drift jars so the issue stays open until fixed or version bumps.
     */
    public static JsonArray mergeBaseline(JsonArray prevBaseline, JsonArray current, Set<String> driftJars) {
        JsonArray out = new JsonArray();
        if (current == null) {
            return out;
        }
        Map<String, JsonObject> prevByJar = indexByJar(prevBaseline);
        Set<String> drift = driftJars != null ? driftJars : Set.of();
        for (JsonElement el : current) {
            if (!el.isJsonObject()) {
                continue;
            }
            JsonObject cur = el.getAsJsonObject().deepCopy();
            if (!cur.has("jar")) {
                continue;
            }
            String jar = cur.get("jar").getAsString();
            JsonObject prev = prevByJar.get(jar);
            if (drift.contains(jar) && prev != null) {
                // Hold prior baseline hash so detectDrift keeps firing until intentional update.
                out.add(prev.deepCopy());
            } else {
                out.add(cur);
            }
        }
        return out;
    }

    public static Set<String> driftJarNames(JsonArray drift) {
        Set<String> out = new HashSet<>();
        if (drift == null) {
            return out;
        }
        for (JsonElement el : drift) {
            if (el.isJsonObject() && el.getAsJsonObject().has("jar")) {
                out.add(el.getAsJsonObject().get("jar").getAsString());
            }
        }
        return out;
    }

    private static boolean sameSizeMtime(JsonObject a, JsonObject b) {
        if (!a.has("size") || !b.has("size") || !a.has("mtime") || !b.has("mtime")) {
            return false;
        }
        return a.get("size").getAsLong() == b.get("size").getAsLong()
                && a.get("mtime").getAsLong() == b.get("mtime").getAsLong();
    }

    private static boolean versionsEqual(JsonObject a, JsonObject b) {
        return versionOf(a).equals(versionOf(b));
    }

    private static String versionOf(JsonObject row) {
        if (row == null || !row.has("version") || row.get("version").isJsonNull()) {
            return "";
        }
        String v = row.get("version").getAsString();
        return v == null ? "" : v.trim();
    }

    private static String shaOf(JsonObject row) {
        if (row == null || !row.has("sha512") || row.get("sha512").isJsonNull()) {
            return "";
        }
        String s = row.get("sha512").getAsString();
        return s == null ? "" : s.trim();
    }

    private static Map<String, JsonObject> indexByJar(JsonArray arr) {
        Map<String, JsonObject> map = new HashMap<>();
        if (arr == null) {
            return map;
        }
        for (JsonElement el : arr) {
            if (!el.isJsonObject()) {
                continue;
            }
            JsonObject row = el.getAsJsonObject();
            if (row.has("jar")) {
                map.put(row.get("jar").getAsString(), row);
            }
        }
        return map;
    }
}
