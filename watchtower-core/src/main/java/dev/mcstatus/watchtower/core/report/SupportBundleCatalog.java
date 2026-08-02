package dev.mcstatus.watchtower.core.report;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.WatchtowerFiles;
import dev.mcstatus.watchtower.core.ops.OpsCacheReader;
import dev.mcstatus.watchtower.core.ops.OpsCacheSchema;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

/**
 * Lists available evidence for the Support Bundle Builder catalog API.
 */
public final class SupportBundleCatalog {

    public record Request(
            Path serverDir,
            Path opsCachePath,
            Path rollupsPath,
            Path liveHistoryPath,
            Path snapshotPath,
            Path sparkUploadDir
    ) {
    }

    private SupportBundleCatalog() {
    }

    public static JsonObject build(Request req) throws IOException {
        JsonObject out = new JsonObject();
        out.addProperty("bundle_version", SupportBundlePackager.BUNDLE_VERSION);
        out.addProperty("soft_budget_bytes", SupportComposeOptions.SOFT_BUDGET_BYTES);
        out.addProperty("hard_budget_bytes", SupportComposeOptions.HARD_BUDGET_BYTES);
        out.add("presets", presetDefaults());
        out.add("logs", listLogs(req.serverDir()));
        out.add("crashes", listCrashes(req.serverDir(), req.opsCachePath()));
        out.add("spark", listSpark(req.sparkUploadDir()));
        out.add("hangs", listHangs(req.serverDir()));
        out.add("stores", listStores(req));
        return out;
    }

    private static JsonArray presetDefaults() {
        JsonArray arr = new JsonArray();
        for (SupportComposeOptions.Preset p : SupportComposeOptions.Preset.values()) {
            if (p == SupportComposeOptions.Preset.CUSTOM) {
                continue;
            }
            JsonObject row = new JsonObject();
            row.addProperty("id", p.name());
            row.add("options", SupportComposeOptions.forPreset(p).toJson());
            arr.add(row);
        }
        return arr;
    }

    private static JsonArray listLogs(Path serverDir) throws IOException {
        JsonArray arr = new JsonArray();
        if (serverDir == null) {
            return arr;
        }
        Path logs = serverDir.resolve("logs");
        if (!Files.isDirectory(logs)) {
            return arr;
        }
        List<Path> files = new ArrayList<>();
        for (String name : List.of("latest.log", "debug.log", "stderr.log", "stderr_stream.log")) {
            Path p = logs.resolve(name);
            if (Files.isRegularFile(p)) {
                files.add(p);
            }
        }
        try (var stream = Files.list(logs)) {
            stream.filter(p -> p.getFileName().toString().endsWith(".log.gz"))
                    .forEach(files::add);
        }
        files.sort(Comparator.comparingLong(SupportBundleCatalog::mtime).reversed());
        for (Path p : files) {
            JsonObject row = new JsonObject();
            row.addProperty("name", p.getFileName().toString());
            row.addProperty("size", Files.size(p));
            row.addProperty("mtime", mtime(p) / 1000L);
            row.addProperty("gz", p.getFileName().toString().endsWith(".gz"));
            arr.add(row);
        }
        return arr;
    }

    private static JsonArray listCrashes(Path serverDir, Path opsCachePath) throws IOException {
        JsonArray arr = new JsonArray();
        JsonObject ops = OpsCacheReader.load(opsCachePath);
        if (ops.has(OpsCacheSchema.CRASHES) && ops.get(OpsCacheSchema.CRASHES).isJsonObject()) {
            JsonObject crashes = ops.getAsJsonObject(OpsCacheSchema.CRASHES);
            if (crashes.has(OpsCacheSchema.CRASHES_ENTRIES)) {
                for (JsonElement el : crashes.getAsJsonArray(OpsCacheSchema.CRASHES_ENTRIES)) {
                    if (!el.isJsonObject()) {
                        continue;
                    }
                    JsonObject entry = el.getAsJsonObject();
                    JsonObject row = new JsonObject();
                    String file = entry.has(OpsCacheSchema.ENTRY_FILE)
                            ? entry.get(OpsCacheSchema.ENTRY_FILE).getAsString()
                            : "";
                    row.addProperty("file", file);
                    if (entry.has(OpsCacheSchema.ENTRY_DISPLAY_LABEL)) {
                        row.addProperty("label", entry.get(OpsCacheSchema.ENTRY_DISPLAY_LABEL).getAsString());
                    }
                    if (entry.has("mtime")) {
                        row.addProperty("mtime", entry.get("mtime").getAsLong());
                    }
                    if (serverDir != null && !file.isBlank()) {
                        String bare = file.startsWith("crash-reports/")
                                ? file.substring("crash-reports/".length()) : file;
                        Path path = SupportSafePaths.resolveBasename(serverDir.resolve("crash-reports"), bare);
                        if (path != null && Files.isRegularFile(path)) {
                            row.addProperty("size", Files.size(path));
                        }
                    }
                    arr.add(row);
                }
            }
        }
        return arr;
    }

    private static JsonArray listSpark(Path sparkDir) throws IOException {
        JsonArray arr = new JsonArray();
        if (sparkDir == null || !Files.isDirectory(sparkDir)) {
            return arr;
        }
        try (var stream = Files.list(sparkDir)) {
            stream.filter(p -> p.getFileName().toString().endsWith(".sparkprofile"))
                    .sorted(Comparator.comparingLong(SupportBundleCatalog::mtime).reversed())
                    .forEach(p -> {
                        try {
                            JsonObject row = new JsonObject();
                            row.addProperty("name", p.getFileName().toString());
                            row.addProperty("source_path", "watchtower/spark-upload/" + p.getFileName());
                            row.addProperty("size", Files.size(p));
                            row.addProperty("mtime", mtime(p) / 1000L);
                            arr.add(row);
                        } catch (IOException ignored) {
                        }
                    });
        }
        return arr;
    }

    private static JsonArray listHangs(Path serverDir) throws IOException {
        JsonArray arr = new JsonArray();
        if (serverDir == null) {
            return arr;
        }
        Path hangs = serverDir.resolve("watchtower").resolve("hangs");
        if (!Files.isDirectory(hangs)) {
            return arr;
        }
        try (var stream = Files.list(hangs)) {
            stream.filter(p -> {
                        String n = p.getFileName().toString();
                        return Files.isRegularFile(p) && (n.endsWith(".txt") || n.endsWith(".log"));
                    })
                    .sorted(Comparator.comparingLong(SupportBundleCatalog::mtime).reversed())
                    .forEach(p -> {
                        try {
                            JsonObject row = new JsonObject();
                            row.addProperty("name", p.getFileName().toString());
                            row.addProperty("path", "watchtower/hangs/" + p.getFileName());
                            row.addProperty("size", Files.size(p));
                            row.addProperty("mtime", mtime(p) / 1000L);
                            arr.add(row);
                        } catch (IOException ignored) {
                        }
                    });
        }
        return arr;
    }

    private static JsonObject listStores(Request req) throws IOException {
        JsonObject stores = new JsonObject();
        addStore(stores, "ops_cache", req.opsCachePath());
        addStore(stores, "performance_rollups", req.rollupsPath());
        addStore(stores, "live_history", req.liveHistoryPath());
        addStore(stores, "snapshot", req.snapshotPath());
        if (req.serverDir() != null) {
            addStore(stores, "watchtower_conf", req.serverDir().resolve("watchtower").resolve(WatchtowerFiles.CONF_FILENAME));
            addStore(stores, "server_toml", req.serverDir().resolve("config").resolve("watchtower-server.toml"));
            addStore(stores, "state", req.serverDir().resolve("watchtower").resolve(WatchtowerFiles.STATE_FILENAME));
            addStore(stores, "server_properties", req.serverDir().resolve("server.properties"));
        }
        return stores;
    }

    private static void addStore(JsonObject stores, String key, Path path) throws IOException {
        JsonObject row = new JsonObject();
        boolean present = path != null && Files.isRegularFile(path);
        row.addProperty("present", present);
        if (present) {
            row.addProperty("size", Files.size(path));
            row.addProperty("mtime", mtime(path) / 1000L);
        }
        stores.add(key, row);
    }

    private static long mtime(Path p) {
        try {
            return Files.getLastModifiedTime(p).toMillis();
        } catch (IOException e) {
            return 0L;
        }
    }
}
