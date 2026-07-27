package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

import java.io.IOException;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.TimeUnit;
import java.util.stream.Stream;

/**
 * {@code du} scan of world dimension folders for storage breakdown.
 */
public final class DimensionStorageScanner {

    private static final int MAX_DU_CALLS = 24;
    private static final int MAX_OTHER_ENTRIES = 12;
    private static final int DU_TIMEOUT_SEC = 15;
    /** Top-level names already covered by world / mods / logs (or backup) cards. */
    private static final Set<String> OTHER_SKIP = Set.of(
            "world", "mods", "logs", "dim-1", "dim1", "backups", "backup"
    );

    private DimensionStorageScanner() {
    }

    public static JsonObject scan(String serverDir) {
        return scan(serverDir, true);
    }

    public static JsonObject scan(String serverDir, boolean enabled) {
        JsonObject result = new JsonObject();
        if (!enabled || serverDir == null || serverDir.isBlank()) {
            return result;
        }
        Path root = Path.of(serverDir);
        if (!Files.isDirectory(root)) {
            return result;
        }

        Map<String, Target> targets = new LinkedHashMap<>();
        addIfDir(targets, root.resolve("world"), "overworld", "Overworld");
        addIfDir(targets, root.resolve("DIM-1"), "nether", "Nether");
        addIfDir(targets, root.resolve("DIM1"), "end", "End");
        addIfDir(targets, root.resolve("world/DIM-1"), "nether", "Nether");
        addIfDir(targets, root.resolve("world/DIM1"), "end", "End");

        try (DirectoryStream<Path> stream = Files.newDirectoryStream(root)) {
            for (Path p : stream) {
                String name = p.getFileName().toString();
                if (Files.isDirectory(p) && name.startsWith("DIM-")) {
                    String id = name.toLowerCase(Locale.ROOT).replace('-', '_');
                    addIfDir(targets, p, id, name);
                }
            }
        } catch (IOException ignored) {
            // skip
        }

        Path dimensions = root.resolve("world/dimensions");
        if (Files.isDirectory(dimensions)) {
            try (DirectoryStream<Path> mods = Files.newDirectoryStream(dimensions)) {
                for (Path modDir : mods) {
                    if (!Files.isDirectory(modDir)) {
                        continue;
                    }
                    String modName = modDir.getFileName().toString();
                    try (DirectoryStream<Path> dims = Files.newDirectoryStream(modDir)) {
                        for (Path dimDir : dims) {
                            if (!Files.isDirectory(dimDir)) {
                                continue;
                            }
                            String dimName = dimDir.getFileName().toString();
                            String id = "mod:" + modName + "/" + dimName;
                            String label = modName + " / " + dimName;
                            addIfDir(targets, dimDir, id, label);
                        }
                    } catch (IOException ignored) {
                        // skip mod
                    }
                }
            } catch (IOException ignored) {
                // skip
            }
        }

        List<Target> list = new ArrayList<>(targets.values());
        if (list.size() > MAX_DU_CALLS) {
            list = list.subList(0, MAX_DU_CALLS);
        }

        JsonArray byDimension = new JsonArray();
        long worldTotal = 0;
        for (Target t : list) {
            Long bytes = duBytes(t.path.toString());
            if (bytes == null) {
                continue;
            }
            worldTotal += bytes;
            JsonObject dim = new JsonObject();
            dim.addProperty("id", t.id);
            dim.addProperty("path", root.relativize(t.path).toString().replace('\\', '/'));
            dim.addProperty("label", t.label);
            dim.addProperty("gb", round2(bytes / (1024.0 * 1024.0 * 1024.0)));
            byDimension.add(dim);
        }

        if (byDimension.isEmpty()) {
            return ExtrasCollector.collectStorage(serverDir);
        }

        result.addProperty("world_bytes", worldTotal);
        result.addProperty("world_gb", round2(worldTotal / (1024.0 * 1024.0 * 1024.0)));
        result.add("by_dimension", byDimension);

        Long serverB = duBytes(serverDir);
        if (serverB != null) {
            result.addProperty("server_dir_bytes", serverB);
            result.addProperty("server_dir_gb", round2(serverB / (1024.0 * 1024.0 * 1024.0)));
            result.addProperty("total_gb", round2(serverB / (1024.0 * 1024.0 * 1024.0)));
        }

        attachCategoryBreakdowns(root, result);
        return result;
    }

    /** Logs file groups, top-level "other" folders, and mods folder size. */
    static void attachCategoryBreakdowns(Path root, JsonObject result) {
        if (root == null || result == null) {
            return;
        }
        attachLogsBreakdown(root, result);
        attachModsSize(root, result);
        attachOtherBreakdown(root, result);
    }

    private static void attachLogsBreakdown(Path root, JsonObject result) {
        Path logsDir = root.resolve("logs");
        if (!Files.isDirectory(logsDir)) {
            return;
        }
        long latest = 0;
        long debug = 0;
        long archives = 0;
        long other = 0;
        try (Stream<Path> walk = Files.walk(logsDir, 4)) {
            for (Path p : (Iterable<Path>) walk::iterator) {
                if (!Files.isRegularFile(p)) {
                    continue;
                }
                long sz;
                try {
                    sz = Files.size(p);
                } catch (IOException e) {
                    continue;
                }
                String name = p.getFileName().toString().toLowerCase(Locale.ROOT);
                if (name.equals("latest.log")) {
                    latest += sz;
                } else if (name.equals("debug.log") || name.startsWith("debug.log.")) {
                    debug += sz;
                } else if (name.endsWith(".gz") || name.endsWith(".zip") || name.endsWith(".xz")
                        || name.endsWith(".bz2")) {
                    archives += sz;
                } else {
                    other += sz;
                }
            }
        } catch (IOException ignored) {
            // keep any du-based logs_* already on result
            return;
        }

        long total = latest + debug + archives + other;
        if (total <= 0) {
            return;
        }
        JsonArray byLogs = new JsonArray();
        addShareRow(byLogs, "latest", "logs/latest.log", "latest.log", latest);
        addShareRow(byLogs, "debug", "logs/debug.log", "debug.log", debug);
        addShareRow(byLogs, "archives", "logs/*.gz", "Rotated archives", archives);
        addShareRow(byLogs, "other_logs", "logs", "Other log files", other);
        result.add("by_logs", byLogs);
        result.addProperty("logs_bytes", total);
        result.addProperty("logs_mb", Math.round(total / (1024.0 * 1024.0) * 10.0) / 10.0);
        result.addProperty("logs_gb", round2(total / (1024.0 * 1024.0 * 1024.0)));
    }

    private static void attachModsSize(Path root, JsonObject result) {
        Path modsDir = root.resolve("mods");
        if (!Files.isDirectory(modsDir)) {
            return;
        }
        Long bytes = duBytes(modsDir.toString());
        if (bytes == null) {
            return;
        }
        result.addProperty("mods_bytes", bytes);
        result.addProperty("mods_gb", round2(bytes / (1024.0 * 1024.0 * 1024.0)));
    }

    private static void attachOtherBreakdown(Path root, JsonObject result) {
        List<ShareRow> rows = new ArrayList<>();
        int duBudget = MAX_DU_CALLS;
        try (DirectoryStream<Path> stream = Files.newDirectoryStream(root)) {
            for (Path p : stream) {
                String name = p.getFileName().toString();
                String key = name.toLowerCase(Locale.ROOT);
                if (OTHER_SKIP.contains(key) || key.startsWith("dim-") || key.matches("dim\\d+")) {
                    continue;
                }
                if (key.startsWith(".")) {
                    continue;
                }
                Long bytes = null;
                if (Files.isDirectory(p)) {
                    if (duBudget <= 0) {
                        continue;
                    }
                    duBudget--;
                    bytes = duBytes(p.toString());
                } else if (Files.isRegularFile(p)) {
                    try {
                        bytes = Files.size(p);
                    } catch (IOException ignored) {
                        // skip
                    }
                }
                if (bytes == null || bytes <= 0) {
                    continue;
                }
                rows.add(new ShareRow(
                        "other:" + key,
                        name.replace('\\', '/'),
                        name,
                        bytes
                ));
            }
        } catch (IOException ignored) {
            return;
        }
        if (rows.isEmpty()) {
            return;
        }
        rows.sort(Comparator.comparingLong((ShareRow r) -> r.bytes).reversed());
        JsonArray byOther = new JsonArray();
        long shown = 0;
        int limit = Math.min(MAX_OTHER_ENTRIES, rows.size());
        for (int i = 0; i < limit; i++) {
            ShareRow r = rows.get(i);
            addShareRow(byOther, r.id, r.path, r.label, r.bytes);
            shown += r.bytes;
        }
        long rest = 0;
        for (int i = limit; i < rows.size(); i++) {
            rest += rows.get(i).bytes;
        }
        if (rest > 0) {
            addShareRow(byOther, "other:rest", ".", "Other folders", rest);
            shown += rest;
        }
        result.add("by_other", byOther);
        if (shown > 0) {
            result.addProperty("other_gb", round2(shown / (1024.0 * 1024.0 * 1024.0)));
        }
    }

    private static void addShareRow(JsonArray arr, String id, String path, String label, long bytes) {
        if (bytes <= 0) {
            return;
        }
        JsonObject row = new JsonObject();
        row.addProperty("id", id);
        row.addProperty("path", path);
        row.addProperty("label", label);
        row.addProperty("gb", round2(bytes / (1024.0 * 1024.0 * 1024.0)));
        // Keep mb for small log rows that round to 0.00 GB.
        row.addProperty("mb", Math.round(bytes / (1024.0 * 1024.0) * 10.0) / 10.0);
        arr.add(row);
    }

    private static void addIfDir(Map<String, Target> targets, Path path, String id, String label) {
        if (!Files.isDirectory(path)) {
            return;
        }
        targets.putIfAbsent(path.normalize().toString(), new Target(path, id, label));
    }

    private static Long duBytes(String path) {
        try {
            Process proc = new ProcessBuilder("du", "-sb", path)
                    .redirectErrorStream(true)
                    .start();
            if (!proc.waitFor(DU_TIMEOUT_SEC, TimeUnit.SECONDS)) {
                proc.destroyForcibly();
                return null;
            }
            String out = new String(proc.getInputStream().readAllBytes(), java.nio.charset.StandardCharsets.UTF_8).trim();
            if (out.isBlank()) {
                return null;
            }
            return Long.parseLong(out.split("\\s+")[0]);
        } catch (Exception e) {
            return null;
        }
    }

    private static double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }

    private record Target(Path path, String id, String label) {
    }

    private record ShareRow(String id, String path, String label, long bytes) {
    }
}
