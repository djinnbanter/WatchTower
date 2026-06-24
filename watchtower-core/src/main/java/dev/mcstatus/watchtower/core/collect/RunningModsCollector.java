package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

import java.util.Comparator;
import java.util.List;

/**
 * Loader-agnostic running mod list JSON shape.
 */
public final class RunningModsCollector {

    public record ModRow(String id, String version, String displayName) {
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
        return row;
    }
}
