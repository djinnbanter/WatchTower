package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Diff mod ids from snapshot vs persisted state.
 */
public final class ModChangeDetector {

    private static final int BASELINE_ADDED_THRESHOLD = 15;

    private ModChangeDetector() {
    }

    public static void apply(JsonObject optional, JsonObject nativeBlob, JsonObject state) {
        if (optional == null) {
            return;
        }
        Set<String> current = modIdsFromNative(nativeBlob);
        if (current.isEmpty()) {
            return;
        }
        Set<String> previous = modIdsFromState(state);
        if (previous.isEmpty()) {
            return;
        }
        List<String> added = new ArrayList<>();
        List<String> removed = new ArrayList<>();
        for (String id : current) {
            if (!previous.contains(id)) {
                added.add(id);
            }
        }
        for (String id : previous) {
            if (!current.contains(id)) {
                removed.add(id);
            }
        }
        if (added.isEmpty() && removed.isEmpty()) {
            return;
        }

        boolean modIdsFull = state != null && state.has("mod_ids_full")
                && state.get("mod_ids_full").getAsBoolean();
        boolean incompleteBaseline = !modIdsFull
                || (previous.size() < current.size() * 0.5
                && added.size() >= BASELINE_ADDED_THRESHOLD
                && removed.isEmpty());
        boolean baselineRefresh = incompleteBaseline
                && added.size() >= BASELINE_ADDED_THRESHOLD
                && removed.isEmpty();

        JsonObject changes = new JsonObject();
        if (baselineRefresh) {
            changes.addProperty("baseline_refresh", true);
            changes.addProperty("added_count", added.size());
            changes.addProperty("removed_count", removed.size());
            changes.addProperty("previous_count", previous.size());
            changes.addProperty("current_count", current.size());
        } else {
            added.sort(String::compareTo);
            removed.sort(String::compareTo);
            JsonArray addedArr = new JsonArray();
            added.forEach(addedArr::add);
            JsonArray removedArr = new JsonArray();
            removed.forEach(removedArr::add);
            changes.add("added", addedArr);
            changes.add("removed", removedArr);
        }
        int unchanged = 0;
        for (String id : current) {
            if (previous.contains(id)) {
                unchanged++;
            }
        }
        changes.addProperty("unchanged_count", unchanged);
        optional.add("mod_changes", changes);
    }

    public static JsonArray modIdsArray(JsonObject nativeBlob) {
        JsonArray out = new JsonArray();
        for (String id : modIdsFromNative(nativeBlob)) {
            out.add(id);
        }
        return out;
    }

    private static Set<String> modIdsFromNative(JsonObject nativeBlob) {
        Set<String> ids = new HashSet<>();
        if (nativeBlob == null || !nativeBlob.has("mods")) {
            return ids;
        }
        JsonArray mods = nativeBlob.getAsJsonArray("mods");
        for (JsonElement el : mods) {
            if (!el.isJsonObject()) {
                continue;
            }
            JsonObject m = el.getAsJsonObject();
            if (m.has("id") && !m.get("id").isJsonNull()) {
                ids.add(m.get("id").getAsString());
            }
        }
        return ids;
    }

    private static Set<String> modIdsFromState(JsonObject state) {
        Set<String> ids = new HashSet<>();
        if (state == null || !state.has("mod_ids")) {
            return ids;
        }
        JsonArray arr = state.getAsJsonArray("mod_ids");
        for (JsonElement el : arr) {
            ids.add(el.getAsString());
        }
        return ids;
    }
}
