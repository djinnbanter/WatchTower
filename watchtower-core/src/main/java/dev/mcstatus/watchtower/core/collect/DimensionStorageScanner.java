package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

import java.io.IOException;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.TimeUnit;

/**
 * {@code du} scan of world dimension folders for storage breakdown.
 */
public final class DimensionStorageScanner {

    private static final int MAX_DU_CALLS = 24;
    private static final int DU_TIMEOUT_SEC = 15;

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
        }

        Path logsDir = root.resolve("logs");
        if (Files.isDirectory(logsDir)) {
            Long lb = duBytes(logsDir.toString());
            if (lb != null) {
                result.addProperty("logs_bytes", lb);
                result.addProperty("logs_mb", Math.round(lb / (1024.0 * 1024.0) * 10.0) / 10.0);
            }
        }
        return result;
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
}
