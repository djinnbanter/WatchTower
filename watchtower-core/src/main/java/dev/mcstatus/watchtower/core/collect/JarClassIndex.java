package dev.mcstatus.watchtower.core.collect;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;
import java.util.zip.ZipInputStream;

/**
 * Headless jar class/package index (CA-19). Nested jarjar scanned one level only.
 * Cache: {@code watchtower/forensics-cache.json} keyed by jar path + size + mtime.
 */
public final class JarClassIndex {

    private static final Gson GSON = new GsonBuilder().disableHtmlEscaping().create();
    private static final long MAX_NESTED_BYTES = 64L * 1024L * 1024L;
    private static final int MAX_MATCHES = 200;

    public record Match(String modId, String jar, String innerPath, String source) {
    }

    public record BuildStats(String builtAt, int jarCount, int entryCount, boolean fromCache) {
    }

    private final Map<String, List<Match>> byClassPath;
    private final Map<String, List<Match>> bySimpleName;
    private final Map<String, Map<String, Integer>> packageCounts; // package -> jarKey -> count
    private final BuildStats stats;
    private final Map<String, JarFingerprint> fingerprints;

    private JarClassIndex(
            Map<String, List<Match>> byClassPath,
            Map<String, List<Match>> bySimpleName,
            Map<String, Map<String, Integer>> packageCounts,
            BuildStats stats,
            Map<String, JarFingerprint> fingerprints) {
        this.byClassPath = byClassPath;
        this.bySimpleName = bySimpleName;
        this.packageCounts = packageCounts;
        this.stats = stats;
        this.fingerprints = fingerprints;
    }

    public BuildStats stats() {
        return stats;
    }

    public boolean isStale(Path modsDir) {
        if (modsDir == null || !Files.isDirectory(modsDir)) {
            return fingerprints.isEmpty();
        }
        Map<String, JarFingerprint> current = fingerprintModsDir(modsDir);
        return !current.equals(fingerprints);
    }

    public List<Match> findClass(String query, boolean includeNested) {
        String normalized = normalizeClassQuery(query);
        if (normalized == null || normalized.isBlank()) {
            return List.of();
        }
        Set<String> seen = new LinkedHashSet<>();
        List<Match> out = new ArrayList<>();
        appendMatches(out, seen, byClassPath.get(normalized), includeNested);
        if (out.isEmpty()) {
            String simple = simpleName(normalized);
            appendMatches(out, seen, bySimpleName.get(simple), includeNested);
        }
        if (out.size() > MAX_MATCHES) {
            return new ArrayList<>(out.subList(0, MAX_MATCHES));
        }
        return out;
    }

    public List<Match> findPackage(String packageName, String mode) {
        String pkg = normalizePackage(packageName);
        if (pkg == null || pkg.isBlank()) {
            return List.of();
        }
        boolean prefix = mode == null || mode.isBlank()
                || "prefix".equalsIgnoreCase(mode);
        List<Match> out = new ArrayList<>();
        Set<String> seen = new LinkedHashSet<>();
        for (Map.Entry<String, Map<String, Integer>> e : packageCounts.entrySet()) {
            String key = e.getKey();
            boolean hit = prefix ? key.equals(pkg) || key.startsWith(pkg + "/")
                    : key.equals(pkg);
            if (!hit) {
                continue;
            }
            for (Map.Entry<String, Integer> jarHit : e.getValue().entrySet()) {
                String jarKey = jarHit.getKey();
                String[] parts = jarKey.split("\\|", 2);
                String modId = parts.length > 0 ? parts[0] : "unknown";
                String jar = parts.length > 1 ? parts[1] : jarKey;
                String dedupe = modId + "|" + jar + "|" + key;
                if (!seen.add(dedupe)) {
                    continue;
                }
                out.add(new Match(modId, jar, key, "jar_entry_scan"));
                if (out.size() >= MAX_MATCHES) {
                    return out;
                }
            }
        }
        return out;
    }

    public boolean truncated(List<Match> matches) {
        return matches != null && matches.size() >= MAX_MATCHES;
    }

    public static JarClassIndex build(Path modsDir, JsonArray mods, Path cacheFile) throws IOException {
        Map<String, String> jarToMod = jarToModId(mods);
        Map<String, JarFingerprint> fps = fingerprintModsDir(modsDir);
        if (cacheFile != null) {
            JarClassIndex cached = loadCache(cacheFile, fps);
            if (cached != null) {
                return cached;
            }
        }
        Map<String, List<Match>> byClass = new HashMap<>();
        Map<String, List<Match>> bySimple = new HashMap<>();
        Map<String, Map<String, Integer>> packages = new HashMap<>();
        int entryCount = 0;
        int jarCount = 0;
        if (modsDir != null && Files.isDirectory(modsDir)) {
            try (DirectoryStream<Path> stream = Files.newDirectoryStream(modsDir, "*.jar")) {
                for (Path jar : stream) {
                    jarCount++;
                    String jarName = jar.getFileName().toString();
                    String modId = jarToMod.getOrDefault(jarName.toLowerCase(Locale.ROOT),
                            guessModId(jarName));
                    entryCount += scanJar(jar, modId, jarName, byClass, bySimple, packages);
                }
            }
        }
        BuildStats stats = new BuildStats(Instant.now().toString(), jarCount, entryCount, false);
        JarClassIndex index = new JarClassIndex(byClass, bySimple, packages, stats, fps);
        if (cacheFile != null) {
            saveCache(cacheFile, index);
        }
        return index;
    }

    public static String normalizeClassQuery(String query) {
        if (query == null) {
            return null;
        }
        String q = query.strip();
        if (q.isEmpty()) {
            return null;
        }
        if (q.endsWith(".class")) {
            q = q.substring(0, q.length() - 6);
        }
        q = q.replace('.', '/');
        while (q.startsWith("/")) {
            q = q.substring(1);
        }
        return q;
    }

    public static Path defaultCachePath(String serverDir) {
        if (serverDir == null || serverDir.isBlank()) {
            return null;
        }
        return Path.of(serverDir, "watchtower", "forensics-cache.json");
    }

    /**
     * Load forensics-cache.json only when fingerprints still match mods/. Never rebuilds
     * (status/L3 classify without {@code FORENSICS_INDEX_ON_REPORT}).
     */
    public static JarClassIndex loadCached(Path modsDir, Path cacheFile) throws IOException {
        if (cacheFile == null) {
            return null;
        }
        Map<String, JarFingerprint> fps = fingerprintModsDir(modsDir);
        return loadCache(cacheFile, fps);
    }

    /**
     * Best-effort cache header for status UI when the fingerprint is stale (no jar walk).
     */
    public static BuildStats peekCacheStats(Path cacheFile) {
        if (cacheFile == null || !Files.isRegularFile(cacheFile)) {
            return null;
        }
        try {
            JsonObject root = GSON.fromJson(Files.readString(cacheFile, StandardCharsets.UTF_8), JsonObject.class);
            if (root == null) {
                return null;
            }
            int jarCount = root.has("jar_count") ? root.get("jar_count").getAsInt() : 0;
            int entryCount = 0;
            if (root.has("classes") && root.get("classes").isJsonArray()) {
                entryCount = root.getAsJsonArray("classes").size();
            }
            String builtAt = root.has("built_at") ? root.get("built_at").getAsString() : null;
            return new BuildStats(builtAt, jarCount, entryCount, true);
        } catch (Exception e) {
            return null;
        }
    }

    private static void appendMatches(List<Match> out, Set<String> seen, List<Match> src, boolean includeNested) {
        if (src == null) {
            return;
        }
        for (Match m : src) {
            if (!includeNested && m.innerPath() != null && m.innerPath().contains("!/")) {
                continue;
            }
            String key = m.modId() + "|" + m.jar() + "|" + m.innerPath();
            if (seen.add(key)) {
                out.add(m);
            }
        }
    }

    private static int scanJar(
            Path jar,
            String modId,
            String jarName,
            Map<String, List<Match>> byClass,
            Map<String, List<Match>> bySimple,
            Map<String, Map<String, Integer>> packages) {
        int count = 0;
        try (ZipFile zip = new ZipFile(jar.toFile())) {
            var entries = zip.entries();
            while (entries.hasMoreElements()) {
                ZipEntry entry = entries.nextElement();
                if (entry.isDirectory()) {
                    continue;
                }
                String name = entry.getName().replace('\\', '/');
                if (name.endsWith(".class") && !name.contains("META-INF/")) {
                    count += recordClass(modId, jarName, name, null, byClass, bySimple, packages);
                } else if (name.toLowerCase(Locale.ROOT).endsWith(".jar") && entry.getSize() <= MAX_NESTED_BYTES) {
                    count += scanNested(zip, entry, modId, jarName, byClass, bySimple, packages);
                }
            }
        } catch (IOException ignored) {
            // leave jar unscanned; caller can still use log-based forensics
        }
        return count;
    }

    private static int scanNested(
            ZipFile zip,
            ZipEntry nested,
            String modId,
            String jarName,
            Map<String, List<Match>> byClass,
            Map<String, List<Match>> bySimple,
            Map<String, Map<String, Integer>> packages) {
        int count = 0;
        try (InputStream in = zip.getInputStream(nested);
             ZipInputStream zis = new ZipInputStream(in)) {
            ZipEntry child;
            while ((child = zis.getNextEntry()) != null) {
                if (child.isDirectory()) {
                    continue;
                }
                String childName = child.getName().replace('\\', '/');
                if (childName.endsWith(".class") && !childName.contains("META-INF/")) {
                    String inner = jarName + "!/" + nested.getName().replace('\\', '/') + "!/" + childName;
                    // one-level nested path reported as outer!/nested.jar path to class via entry name
                    String reportInner = nested.getName().replace('\\', '/') + "!/" + childName;
                    count += recordClass(modId, jarName, childName, reportInner, byClass, bySimple, packages);
                }
            }
        } catch (IOException ignored) {
            // nested jar unreadable
        }
        return count;
    }

    private static int recordClass(
            String modId,
            String jarName,
            String classPath,
            String innerPath,
            Map<String, List<Match>> byClass,
            Map<String, List<Match>> bySimple,
            Map<String, Map<String, Integer>> packages) {
        String path = classPath.endsWith(".class")
                ? classPath.substring(0, classPath.length() - 6)
                : classPath;
        path = path.replace('\\', '/');
        String reportPath = innerPath != null ? jarName + "!/" + innerPath : path;
        Match match = new Match(modId, jarName, reportPath, "jar_entry_scan");
        byClass.computeIfAbsent(path, k -> new ArrayList<>()).add(match);
        String simple = simpleName(path);
        bySimple.computeIfAbsent(simple, k -> new ArrayList<>()).add(match);
        String pkg = packageOf(path);
        if (pkg != null) {
            String jarKey = modId + "|" + jarName;
            packages.computeIfAbsent(pkg, k -> new HashMap<>())
                    .merge(jarKey, 1, Integer::sum);
        }
        return 1;
    }

    private static String simpleName(String classPath) {
        int slash = classPath.lastIndexOf('/');
        String name = slash >= 0 ? classPath.substring(slash + 1) : classPath;
        int dollar = name.indexOf('$');
        return dollar >= 0 ? name.substring(0, dollar) : name;
    }

    private static String packageOf(String classPath) {
        int slash = classPath.lastIndexOf('/');
        return slash > 0 ? classPath.substring(0, slash) : null;
    }

    private static String normalizePackage(String packageName) {
        if (packageName == null) {
            return null;
        }
        String p = packageName.strip().replace('.', '/');
        while (p.startsWith("/")) {
            p = p.substring(1);
        }
        while (p.endsWith("/")) {
            p = p.substring(0, p.length() - 1);
        }
        return p;
    }

    private static Map<String, String> jarToModId(JsonArray mods) {
        Map<String, String> map = new HashMap<>();
        if (mods == null) {
            return map;
        }
        for (JsonElement el : mods) {
            if (!el.isJsonObject()) {
                continue;
            }
            JsonObject mod = el.getAsJsonObject();
            String id = str(mod, "id");
            if (id == null) {
                id = str(mod, "mod_id");
            }
            String jar = str(mod, "jar_file");
            if (jar == null) {
                jar = str(mod, "jar");
            }
            if (id != null && jar != null) {
                map.put(jar.toLowerCase(Locale.ROOT), id);
            }
        }
        return map;
    }

    private static String guessModId(String jarName) {
        String base = jarName;
        int dash = base.lastIndexOf('-');
        if (dash > 0) {
            base = base.substring(0, dash);
        }
        if (base.toLowerCase(Locale.ROOT).endsWith(".jar")) {
            base = base.substring(0, base.length() - 4);
        }
        return base.toLowerCase(Locale.ROOT).replace(' ', '_');
    }

    private record JarFingerprint(long size, long mtime) {
    }

    private static Map<String, JarFingerprint> fingerprintModsDir(Path modsDir) {
        Map<String, JarFingerprint> map = new LinkedHashMap<>();
        if (modsDir == null || !Files.isDirectory(modsDir)) {
            return map;
        }
        try (DirectoryStream<Path> stream = Files.newDirectoryStream(modsDir, "*.jar")) {
            List<Path> jars = new ArrayList<>();
            for (Path jar : stream) {
                jars.add(jar);
            }
            jars.sort(Path::compareTo);
            for (Path jar : jars) {
                try {
                    map.put(jar.getFileName().toString(),
                            new JarFingerprint(Files.size(jar), Files.getLastModifiedTime(jar).toMillis()));
                } catch (IOException ignored) {
                    // skip
                }
            }
        } catch (IOException ignored) {
            // empty
        }
        return map;
    }

    private static void saveCache(Path cacheFile, JarClassIndex index) throws IOException {
        Files.createDirectories(cacheFile.getParent());
        JsonObject root = new JsonObject();
        root.addProperty("built_at", index.stats.builtAt());
        root.addProperty("jar_count", index.stats.jarCount());
        root.addProperty("entry_count", index.stats.entryCount());
        JsonObject fps = new JsonObject();
        for (Map.Entry<String, JarFingerprint> e : index.fingerprints.entrySet()) {
            JsonObject fp = new JsonObject();
            fp.addProperty("size", e.getValue().size());
            fp.addProperty("mtime", e.getValue().mtime());
            fps.add(e.getKey(), fp);
        }
        root.add("fingerprints", fps);
        JsonArray classes = new JsonArray();
        for (Map.Entry<String, List<Match>> e : index.byClassPath.entrySet()) {
            for (Match m : e.getValue()) {
                JsonObject row = new JsonObject();
                row.addProperty("class", e.getKey());
                row.addProperty("mod_id", m.modId());
                row.addProperty("jar", m.jar());
                row.addProperty("inner_path", m.innerPath());
                classes.add(row);
            }
        }
        root.add("classes", classes);
        Files.writeString(cacheFile, GSON.toJson(root), StandardCharsets.UTF_8);
    }

    private static JarClassIndex loadCache(Path cacheFile, Map<String, JarFingerprint> current)
            throws IOException {
        if (!Files.isRegularFile(cacheFile)) {
            return null;
        }
        JsonObject root = GSON.fromJson(Files.readString(cacheFile, StandardCharsets.UTF_8), JsonObject.class);
        if (root == null || !root.has("fingerprints") || !root.has("classes")) {
            return null;
        }
        Map<String, JarFingerprint> fps = new LinkedHashMap<>();
        JsonObject fpsObj = root.getAsJsonObject("fingerprints");
        for (Map.Entry<String, JsonElement> e : fpsObj.entrySet()) {
            if (!e.getValue().isJsonObject()) {
                continue;
            }
            JsonObject fp = e.getValue().getAsJsonObject();
            fps.put(e.getKey(), new JarFingerprint(fp.get("size").getAsLong(), fp.get("mtime").getAsLong()));
        }
        if (!fps.equals(current)) {
            return null;
        }
        Map<String, List<Match>> byClass = new HashMap<>();
        Map<String, List<Match>> bySimple = new HashMap<>();
        Map<String, Map<String, Integer>> packages = new HashMap<>();
        JsonArray classes = root.getAsJsonArray("classes");
        int entryCount = 0;
        for (JsonElement el : classes) {
            if (!el.isJsonObject()) {
                continue;
            }
            JsonObject row = el.getAsJsonObject();
            String classPath = str(row, "class");
            String modId = str(row, "mod_id");
            String jar = str(row, "jar");
            String inner = str(row, "inner_path");
            if (classPath == null || jar == null) {
                continue;
            }
            Match match = new Match(modId != null ? modId : "unknown", jar,
                    inner != null ? inner : classPath, "jar_entry_scan");
            byClass.computeIfAbsent(classPath, k -> new ArrayList<>()).add(match);
            bySimple.computeIfAbsent(simpleName(classPath), k -> new ArrayList<>()).add(match);
            String pkg = packageOf(classPath);
            if (pkg != null) {
                packages.computeIfAbsent(pkg, k -> new HashMap<>())
                        .merge((modId != null ? modId : "unknown") + "|" + jar, 1, Integer::sum);
            }
            entryCount++;
        }
        int jarCount = root.has("jar_count") ? root.get("jar_count").getAsInt() : fps.size();
        String builtAt = root.has("built_at") ? root.get("built_at").getAsString() : Instant.now().toString();
        BuildStats stats = new BuildStats(builtAt, jarCount, entryCount, true);
        return new JarClassIndex(byClass, bySimple, packages, stats, fps);
    }

    private static String str(JsonObject o, String key) {
        if (o == null || !o.has(key) || o.get(key).isJsonNull()) {
            return null;
        }
        return o.get(key).getAsString();
    }
}
