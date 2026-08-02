package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

import java.util.Comparator;
import java.util.List;

/**
 * Loader-agnostic running mod list JSON shape.
 */
public final class RunningModsCollector {

    public record ModRow(
            String id,
            String version,
            String displayName,
            String jarFile,
            boolean nested,
            String parentJar,
            String nestedPath) {
        public ModRow(String id, String version, String displayName) {
            this(id, version, displayName, null, false, null, null);
        }
    }

    private RunningModsCollector() {
    }

    public static JsonArray toJsonArray(List<ModRow> mods) {
        JsonArray arr = new JsonArray();
        mods.stream()
                .sorted(Comparator.comparing(ModRow::id))
                .forEach(m -> arr.add(toJson(m)));
        return arr;
    }

    public static JsonObject toJson(ModRow mod) {
        JsonObject row = new JsonObject();
        row.addProperty("id", mod.id());
        row.addProperty("version", mod.version());
        if (mod.displayName() != null && !mod.displayName().isBlank()) {
            row.addProperty("display_name", mod.displayName());
        }
        if (mod.jarFile() != null && !mod.jarFile().isBlank()) {
            row.addProperty("jar_file", mod.jarFile());
            if (ModJarDisable.isDisabledName(mod.jarFile())) {
                row.addProperty("disabled", true);
            }
        }
        if (mod.nested()) {
            row.addProperty("nested", true);
            if (mod.parentJar() != null && !mod.parentJar().isBlank()) {
                row.addProperty("parent_jar", mod.parentJar());
            }
            if (mod.nestedPath() != null && !mod.nestedPath().isBlank()) {
                row.addProperty("nested_path", mod.nestedPath());
            }
        }
        return row;
    }

    /** Count of top-level (non-nested) running mods for ops cache KPIs. */
    public static int topLevelCount(JsonArray mods) {
        if (mods == null || mods.isEmpty()) {
            return 0;
        }
        int n = 0;
        for (var el : mods) {
            if (!el.isJsonObject()) {
                continue;
            }
            JsonObject m = el.getAsJsonObject();
            if (m.has("nested") && m.get("nested").getAsBoolean()) {
                continue;
            }
            if (m.has("parent_jar") && !m.get("parent_jar").isJsonNull()
                    && !m.get("parent_jar").getAsString().isBlank()) {
                continue;
            }
            n++;
        }
        return n;
    }
}
