package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Fold jar-in-jar / nested ModList peers under their parent top-level mods.
 */
public final class ModNesting {

    private ModNesting() {
    }

    /**
     * After enriching {@code mods} from disk + ModList:
     * <ul>
     *   <li>Ensure parents have {@code jar_in_jar} / {@code nested_mod_ids}</li>
     *   <li>Remove nested peers from the top-level array</li>
     * </ul>
     *
     * @return filtered top-level mods array (mutates and replaces contents of {@code mods})
     */
    public static JsonArray foldOptionalMods(JsonArray mods, String serverDir) {
        if (mods == null) {
            return new JsonArray();
        }
        // Seed jar_in_jar from disk for any parent that is missing it.
        if (serverDir != null && !serverDir.isBlank()) {
            ModJarMetadataReader.enrichModArray(mods, serverDir);
        }
        return foldInPlace(mods);
    }

    /** Fold running_mods array (already may include nested flags). */
    public static JsonArray foldRunningMods(JsonArray mods, String serverDir) {
        if (mods == null) {
            return new JsonArray();
        }
        if (serverDir != null && !serverDir.isBlank()) {
            // Attach jar_in_jar from session cache (tick-safe; no disk unzip).
            Map<String, ModJarMetadataReader.ModEntry> byJar = new HashMap<>();
            Map<String, ModJarMetadataReader.ModEntry> byId = new HashMap<>();
            for (ModJarMetadataReader.ModEntry e : ModJarMetadataCache.get().entries()) {
                if (e.jarFile() != null) {
                    byJar.putIfAbsent(e.jarFile().toLowerCase(Locale.ROOT), e);
                }
                byId.putIfAbsent(e.id().toLowerCase(Locale.ROOT), e);
            }
            for (JsonElement el : mods) {
                if (!el.isJsonObject()) {
                    continue;
                }
                JsonObject mod = el.getAsJsonObject();
                if (isNestedFlag(mod)) {
                    continue;
                }
                ModJarMetadataReader.ModEntry meta = null;
                String jar = str(mod, "jar_file");
                if (jar != null) {
                    meta = byJar.get(jar.toLowerCase(Locale.ROOT));
                }
                if (meta == null) {
                    String id = str(mod, "id");
                    if (id != null) {
                        meta = byId.get(id.toLowerCase(Locale.ROOT));
                    }
                }
                if (meta != null && meta.jarInJar() != null && !meta.jarInJar().isEmpty()) {
                    if (!mod.has("jar_file") && meta.jarFile() != null) {
                        mod.addProperty("jar_file", meta.jarFile());
                    }
                    ModJarMetadataReader.addJarInJarFields(mod, meta.jarInJar());
                }
            }
        }
        return foldInPlace(mods);
    }

    private static JsonArray foldInPlace(JsonArray mods) {
        Map<String, JsonObject> byId = new LinkedHashMap<>();
        List<JsonObject> order = new ArrayList<>();
        for (JsonElement el : mods) {
            if (!el.isJsonObject()) {
                continue;
            }
            JsonObject mod = el.getAsJsonObject().deepCopy();
            String id = str(mod, "id");
            if (id == null || id.isBlank()) {
                continue;
            }
            byId.put(id.toLowerCase(Locale.ROOT), mod);
            order.add(mod);
        }

        // Collect nested ids known from parents + flagged nested rows.
        Set<String> nestedIds = new HashSet<>();
        Map<String, JsonObject> nestedRows = new HashMap<>();
        for (JsonObject mod : order) {
            collectNestedIdsFromParent(mod, nestedIds);
            if (isNestedFlag(mod)) {
                String id = str(mod, "id");
                if (id != null) {
                    nestedIds.add(id.toLowerCase(Locale.ROOT));
                    nestedRows.put(id.toLowerCase(Locale.ROOT), mod);
                }
            }
        }

        // Attach runtime nested peers onto parents' jar_in_jar.
        for (JsonObject nested : nestedRows.values()) {
            String nestedId = str(nested, "id");
            String parentJar = str(nested, "parent_jar");
            JsonObject parent = findParent(byId, order, parentJar, nestedId);
            if (parent == null) {
                continue;
            }
            mergeNestedOntoParent(parent, nested);
        }

        // Rebuild array without nested peers.
        JsonArray out = new JsonArray();
        Set<String> seen = new HashSet<>();
        for (JsonObject mod : order) {
            String id = str(mod, "id");
            if (id == null) {
                continue;
            }
            String key = id.toLowerCase(Locale.ROOT);
            if (nestedIds.contains(key) || isNestedFlag(mod)) {
                continue;
            }
            if (!seen.add(key)) {
                continue;
            }
            // Drop nested flags if any leaked onto parent
            mod.remove("nested");
            mod.remove("parent_jar");
            mod.remove("nested_path");
            out.add(mod);
        }

        while (mods.size() > 0) {
            mods.remove(0);
        }
        for (JsonElement el : out) {
            mods.add(el);
        }
        return mods;
    }

    private static JsonObject findParent(
            Map<String, JsonObject> byId,
            List<JsonObject> order,
            String parentJar,
            String nestedId) {
        if (parentJar != null && !parentJar.isBlank()) {
            String want = parentJar.toLowerCase(Locale.ROOT);
            for (JsonObject mod : order) {
                if (isNestedFlag(mod)) {
                    continue;
                }
                String jar = str(mod, "jar_file");
                if (jar != null && jar.toLowerCase(Locale.ROOT).equals(want)) {
                    return mod;
                }
            }
        }
        // Fallback: parent that already lists this nested id
        if (nestedId != null) {
            String wantId = nestedId.toLowerCase(Locale.ROOT);
            for (JsonObject mod : order) {
                if (isNestedFlag(mod)) {
                    continue;
                }
                if (parentListsNested(mod, wantId)) {
                    return mod;
                }
            }
        }
        return null;
    }

    private static boolean parentListsNested(JsonObject parent, String nestedIdLower) {
        if (parent.has("nested_mod_ids") && parent.get("nested_mod_ids").isJsonArray()) {
            for (JsonElement el : parent.getAsJsonArray("nested_mod_ids")) {
                if (el.isJsonPrimitive() && nestedIdLower.equals(el.getAsString().toLowerCase(Locale.ROOT))) {
                    return true;
                }
            }
        }
        if (parent.has("jar_in_jar") && parent.get("jar_in_jar").isJsonArray()) {
            for (JsonElement el : parent.getAsJsonArray("jar_in_jar")) {
                if (!el.isJsonObject()) {
                    continue;
                }
                String id = str(el.getAsJsonObject(), "id");
                if (id != null && nestedIdLower.equals(id.toLowerCase(Locale.ROOT))) {
                    return true;
                }
            }
        }
        return false;
    }

    private static void mergeNestedOntoParent(JsonObject parent, JsonObject nested) {
        String nestedId = str(nested, "id");
        if (nestedId == null) {
            return;
        }
        JsonArray jarInJar = parent.has("jar_in_jar") && parent.get("jar_in_jar").isJsonArray()
                ? parent.getAsJsonArray("jar_in_jar")
                : new JsonArray();
        boolean found = false;
        for (JsonElement el : jarInJar) {
            if (el.isJsonObject() && nestedId.equalsIgnoreCase(str(el.getAsJsonObject(), "id"))) {
                JsonObject row = el.getAsJsonObject();
                if (!row.has("version") && nested.has("version")) {
                    row.add("version", nested.get("version"));
                }
                if (!row.has("display_name") && nested.has("display_name")) {
                    row.add("display_name", nested.get("display_name"));
                }
                if (!row.has("nested_path") && nested.has("nested_path")) {
                    row.add("nested_path", nested.get("nested_path"));
                }
                found = true;
                break;
            }
        }
        if (!found) {
            JsonObject row = new JsonObject();
            row.addProperty("id", nestedId);
            if (nested.has("version")) {
                row.add("version", nested.get("version"));
            }
            if (nested.has("display_name")) {
                row.add("display_name", nested.get("display_name"));
            }
            if (nested.has("nested_path")) {
                row.add("nested_path", nested.get("nested_path"));
            }
            jarInJar.add(row);
        }
        parent.add("jar_in_jar", jarInJar);

        JsonArray ids = new JsonArray();
        Set<String> seen = new HashSet<>();
        for (JsonElement el : jarInJar) {
            if (!el.isJsonObject()) {
                continue;
            }
            String id = str(el.getAsJsonObject(), "id");
            if (id == null || !seen.add(id.toLowerCase(Locale.ROOT))) {
                continue;
            }
            ids.add(id);
        }
        parent.add("nested_mod_ids", ids);
    }

    private static void collectNestedIdsFromParent(JsonObject mod, Set<String> nestedIds) {
        if (mod.has("nested_mod_ids") && mod.get("nested_mod_ids").isJsonArray()) {
            for (JsonElement el : mod.getAsJsonArray("nested_mod_ids")) {
                if (el.isJsonPrimitive()) {
                    String id = el.getAsString();
                    if (id != null && !id.isBlank()) {
                        nestedIds.add(id.toLowerCase(Locale.ROOT));
                    }
                }
            }
        }
        if (mod.has("jar_in_jar") && mod.get("jar_in_jar").isJsonArray()) {
            for (JsonElement el : mod.getAsJsonArray("jar_in_jar")) {
                if (el.isJsonObject()) {
                    String id = str(el.getAsJsonObject(), "id");
                    if (id != null && !id.isBlank()) {
                        nestedIds.add(id.toLowerCase(Locale.ROOT));
                    }
                }
            }
        }
    }

    private static boolean isNestedFlag(JsonObject mod) {
        if (mod.has("nested") && !mod.get("nested").isJsonNull() && mod.get("nested").getAsBoolean()) {
            return true;
        }
        String parent = str(mod, "parent_jar");
        return parent != null && !parent.isBlank();
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
