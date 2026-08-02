package dev.mcstatus.watchtower.core.analyze;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;

/**
 * Conservative world-risk signals for soft jar disable (1.1.19).
 * Does not scan block-entity NBT; labels what was and was not checked.
 */
public final class WorldRiskAnalyzer {

    private static final int MAX_ZIP_ENTRIES_SCANNED = 4000;

    private WorldRiskAnalyzer() {
    }

    /**
     * @param liveDimensionIdsOrEmpty full resource locations like {@code modid:path} (may be empty)
     */
    public static JsonObject evaluateMod(
            String modId,
            Path serverDir,
            Path jarFileOrNull,
            Set<String> liveDimensionIdsOrEmpty) {
        JsonObject out = new JsonObject();
        List<String> reasons = new ArrayList<>();
        Set<String> checked = new LinkedHashSet<>();
        Set<String> notChecked = new LinkedHashSet<>();
        notChecked.add("block_entity_nbt_scan");
        notChecked.add("mods_toml_dimensions");

        String id = modId == null ? "" : modId.trim();
        if (id.isEmpty()) {
            out.addProperty("level", "none");
            out.add("reasons", new JsonArray());
            out.add("checked", stringArray(checked));
            out.add("not_checked", stringArray(notChecked));
            return out;
        }

        checked.add("world_dimension_folders");
        if (serverDir != null && hasWorldDimensionFolder(serverDir, id)) {
            reasons.add("world_dimension_folders:" + id);
        }

        checked.add("live_dimensions");
        if (liveDimensionIdsOrEmpty != null) {
            for (String dim : liveDimensionIdsOrEmpty) {
                if (dim == null || dim.isBlank()) {
                    continue;
                }
                String ns = namespaceOf(dim);
                if (id.equalsIgnoreCase(ns)) {
                    reasons.add("live_dimension:" + dim);
                    break;
                }
            }
        }

        checked.add("jar_dimension_data");
        if (jarFileOrNull != null && Files.isRegularFile(jarFileOrNull)) {
            String declared = scanJarDimensionData(jarFileOrNull, id);
            if (declared != null) {
                reasons.add("declares_dimension_data:" + declared);
            }
        }

        String level = reasons.isEmpty() ? "none" : "high";
        out.addProperty("level", level);
        JsonArray reasonArr = new JsonArray();
        for (String r : reasons) {
            reasonArr.add(r);
        }
        out.add("reasons", reasonArr);
        out.add("checked", stringArray(checked));
        out.add("not_checked", stringArray(notChecked));
        return out;
    }

    public static void attachToMods(JsonArray mods, Path serverDir, Set<String> liveDims) {
        if (mods == null || mods.isEmpty()) {
            return;
        }
        for (JsonElement el : mods) {
            if (!el.isJsonObject()) {
                continue;
            }
            JsonObject mod = el.getAsJsonObject();
            String id = str(mod, "id");
            if (id == null || id.isBlank()) {
                id = str(mod, "mod_id");
            }
            Path jar = null;
            String jarFile = str(mod, "jar_file");
            if (jarFile == null || jarFile.isBlank()) {
                jarFile = str(mod, "jar");
            }
            if (serverDir != null && jarFile != null && !jarFile.isBlank()) {
                jar = serverDir.resolve("mods").resolve(jarFile);
            }
            mod.add("world_risk", evaluateMod(id, serverDir, jar, liveDims));
        }
    }

    public static boolean hasWorldDimensionFolder(Path serverDir, String modId) {
        if (serverDir == null || modId == null || modId.isBlank()) {
            return false;
        }
        Path dims = serverDir.resolve("world").resolve("dimensions").resolve(modId);
        if (!Files.isDirectory(dims)) {
            // case-insensitive fallback for Windows-ish packs
            Path parent = serverDir.resolve("world").resolve("dimensions");
            if (!Files.isDirectory(parent)) {
                return false;
            }
            try (var stream = Files.list(parent)) {
                return stream.anyMatch(p -> Files.isDirectory(p)
                        && p.getFileName().toString().equalsIgnoreCase(modId));
            } catch (IOException e) {
                return false;
            }
        }
        try (var stream = Files.list(dims)) {
            return stream.anyMatch(Files::isDirectory);
        } catch (IOException e) {
            return Files.isDirectory(dims);
        }
    }

    static String namespaceOf(String resourceLocation) {
        int i = resourceLocation.indexOf(':');
        if (i <= 0) {
            return resourceLocation.trim();
        }
        return resourceLocation.substring(0, i).trim();
    }

    /**
     * @return a sample path like {@code data/modid/dimension/foo.json} or null
     */
    static String scanJarDimensionData(Path jar, String modId) {
        String prefix = "data/" + modId.toLowerCase(Locale.ROOT) + "/dimension/";
        String prefixAlt = "data/" + modId + "/dimension/";
        try (ZipFile zip = new ZipFile(jar.toFile())) {
            int n = 0;
            var entries = zip.entries();
            while (entries.hasMoreElements() && n < MAX_ZIP_ENTRIES_SCANNED) {
                ZipEntry e = entries.nextElement();
                n++;
                if (e.isDirectory()) {
                    continue;
                }
                String name = e.getName().replace('\\', '/');
                String lower = name.toLowerCase(Locale.ROOT);
                if (lower.startsWith(prefix) || name.startsWith(prefixAlt)) {
                    return name;
                }
            }
        } catch (IOException ignored) {
            return null;
        }
        return null;
    }

    private static JsonArray stringArray(Set<String> values) {
        JsonArray arr = new JsonArray();
        for (String v : values) {
            arr.add(v);
        }
        return arr;
    }

    private static String str(JsonObject o, String key) {
        if (o == null || !o.has(key) || o.get(key).isJsonNull()) {
            return null;
        }
        try {
            return o.get(key).getAsString();
        } catch (Exception e) {
            return null;
        }
    }
}
