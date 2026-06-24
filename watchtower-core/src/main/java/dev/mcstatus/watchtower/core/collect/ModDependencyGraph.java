package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Reverse dependency map built from mod TOML metadata.
 */
public final class ModDependencyGraph {

    private final Map<String, Set<String>> dependents;

    private ModDependencyGraph(Map<String, Set<String>> dependents) {
        this.dependents = dependents;
    }

    public static ModDependencyGraph fromMods(JsonArray mods) {
        Map<String, Set<String>> reverse = new HashMap<>();
        if (mods == null) {
            return new ModDependencyGraph(reverse);
        }
        for (JsonElement el : mods) {
            if (!el.isJsonObject()) {
                continue;
            }
            JsonObject mod = el.getAsJsonObject();
            String modId = str(mod, "id");
            if (modId == null || modId.isBlank()) {
                continue;
            }
            if (!mod.has("dependencies") || !mod.get("dependencies").isJsonArray()) {
                continue;
            }
            for (JsonElement depEl : mod.getAsJsonArray("dependencies")) {
                if (!depEl.isJsonObject()) {
                    continue;
                }
                JsonObject dep = depEl.getAsJsonObject();
                if (dep.has("mandatory") && !dep.get("mandatory").getAsBoolean()) {
                    continue;
                }
                String target = str(dep, "modId");
                if (target == null || target.isBlank()) {
                    continue;
                }
                reverse.computeIfAbsent(target, k -> new HashSet<>()).add(modId);
            }
        }
        return new ModDependencyGraph(reverse);
    }

    public List<String> dependentsOf(String modId) {
        Set<String> deps = dependents.get(modId);
        if (deps == null || deps.isEmpty()) {
            return List.of();
        }
        List<String> sorted = new ArrayList<>(deps);
        Collections.sort(sorted);
        return sorted;
    }

    public boolean hasServerDependents(String modId, Set<String> clientOnlyCandidates) {
        for (String dependent : dependentsOf(modId)) {
            if (clientOnlyCandidates == null || !clientOnlyCandidates.contains(dependent)) {
                return true;
            }
        }
        return false;
    }

    private static String str(JsonObject o, String key) {
        if (o == null || !o.has(key) || o.get(key).isJsonNull()) {
            return null;
        }
        return o.get(key).getAsString();
    }
}
