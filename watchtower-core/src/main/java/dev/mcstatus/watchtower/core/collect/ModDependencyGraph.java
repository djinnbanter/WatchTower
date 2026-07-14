package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Queue;
import java.util.Set;

/**
 * Forward and reverse dependency maps built from mod TOML metadata.
 */
public final class ModDependencyGraph {

    public enum Direction {
        DEPENDENTS,
        DEPENDENCIES
    }

    private final Map<String, Set<String>> dependents; // target -> mods that need it
    private final Map<String, Set<DepEdge>> dependencies; // mod -> what it needs
    private final Map<String, JsonObject> modsById;

    public record DepEdge(String modId, boolean mandatory) {
    }

    private ModDependencyGraph(
            Map<String, Set<String>> dependents,
            Map<String, Set<DepEdge>> dependencies,
            Map<String, JsonObject> modsById) {
        this.dependents = dependents;
        this.dependencies = dependencies;
        this.modsById = modsById;
    }

    public static ModDependencyGraph fromMods(JsonArray mods) {
        Map<String, Set<String>> reverse = new HashMap<>();
        Map<String, Set<DepEdge>> forward = new HashMap<>();
        Map<String, JsonObject> byId = new HashMap<>();
        if (mods == null) {
            return new ModDependencyGraph(reverse, forward, byId);
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
            byId.put(modId, mod);
            if (!mod.has("dependencies") || !mod.get("dependencies").isJsonArray()) {
                continue;
            }
            for (JsonElement depEl : mod.getAsJsonArray("dependencies")) {
                if (!depEl.isJsonObject()) {
                    continue;
                }
                JsonObject dep = depEl.getAsJsonObject();
                boolean mandatory = !dep.has("mandatory") || dep.get("mandatory").getAsBoolean();
                String target = str(dep, "modId");
                if (target == null || target.isBlank()) {
                    continue;
                }
                forward.computeIfAbsent(modId, k -> new HashSet<>()).add(new DepEdge(target, mandatory));
                if (mandatory) {
                    reverse.computeIfAbsent(target, k -> new HashSet<>()).add(modId);
                }
            }
        }
        return new ModDependencyGraph(reverse, forward, byId);
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

    public int dependentsCount(String modId) {
        Set<String> deps = dependents.get(modId);
        return deps == null ? 0 : deps.size();
    }

    public List<DepEdge> dependenciesOf(String modId) {
        Set<DepEdge> edges = dependencies.get(modId);
        if (edges == null || edges.isEmpty()) {
            return List.of();
        }
        List<DepEdge> sorted = new ArrayList<>(edges);
        sorted.sort((a, b) -> a.modId().compareToIgnoreCase(b.modId()));
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

    /**
     * Expand a seed set of protected mod ids by mandatory dependents and mandatory dependencies.
     */
    public Set<String> expandProtected(Set<String> seeds, int maxDepth) {
        Set<String> protectedIds = new HashSet<>(seeds);
        Queue<String> queue = new ArrayDeque<>(seeds);
        Map<String, Integer> depth = new HashMap<>();
        for (String seed : seeds) {
            depth.put(seed, 0);
        }
        while (!queue.isEmpty()) {
            String current = queue.poll();
            int d = depth.getOrDefault(current, 0);
            if (d >= maxDepth) {
                continue;
            }
            for (String dependent : dependentsOf(current)) {
                if (protectedIds.add(dependent)) {
                    depth.put(dependent, d + 1);
                    queue.add(dependent);
                }
            }
            for (DepEdge edge : dependenciesOf(current)) {
                if (!edge.mandatory()) {
                    continue;
                }
                if (protectedIds.add(edge.modId())) {
                    depth.put(edge.modId(), d + 1);
                    queue.add(edge.modId());
                }
            }
        }
        return protectedIds;
    }

    public JsonObject toTree(String rootId, Direction direction, int maxDepth) {
        JsonObject root = nodeFor(rootId, true);
        JsonArray children = buildChildren(rootId, direction, maxDepth, 0, new HashSet<>(Set.of(rootId)));
        root.add("children", children);
        return root;
    }

    private JsonArray buildChildren(
            String parentId,
            Direction direction,
            int maxDepth,
            int depth,
            Set<String> visited) {
        JsonArray children = new JsonArray();
        if (depth >= maxDepth) {
            return children;
        }
        if (direction == Direction.DEPENDENTS) {
            for (String childId : dependentsOf(parentId)) {
                if (!visited.add(childId)) {
                    continue;
                }
                JsonObject node = nodeFor(childId, true);
                node.add("children", buildChildren(childId, direction, maxDepth, depth + 1, visited));
                visited.remove(childId);
                children.add(node);
            }
        } else {
            for (DepEdge edge : dependenciesOf(parentId)) {
                if (!visited.add(edge.modId())) {
                    continue;
                }
                JsonObject node = nodeFor(edge.modId(), edge.mandatory());
                node.add("children", buildChildren(edge.modId(), direction, maxDepth, depth + 1, visited));
                visited.remove(edge.modId());
                children.add(node);
            }
        }
        return children;
    }

    private JsonObject nodeFor(String modId, boolean mandatory) {
        JsonObject node = new JsonObject();
        node.addProperty("mod_id", modId);
        node.addProperty("mandatory", mandatory);
        JsonObject mod = modsById.get(modId);
        if (mod != null) {
            String display = str(mod, "display_name");
            if (display != null && !display.isBlank()) {
                node.addProperty("display_name", display);
            }
            String version = str(mod, "version");
            if (version != null && !version.isBlank()) {
                node.addProperty("version", version);
            }
            if (mod.has("side_score") && !mod.get("side_score").isJsonNull()) {
                node.addProperty("side_score", mod.get("side_score").getAsString());
            }
            if (mod.has("is_mcreator") && mod.get("is_mcreator").getAsBoolean()) {
                node.addProperty("is_mcreator", true);
            }
            if (mod.has("loader_hint") && !mod.get("loader_hint").isJsonNull()) {
                node.addProperty("loader_hint", mod.get("loader_hint").getAsString());
            }
        }
        return node;
    }

    private static String str(JsonObject o, String key) {
        if (o == null || !o.has(key) || o.get(key).isJsonNull()) {
            return null;
        }
        return o.get(key).getAsString();
    }
}
