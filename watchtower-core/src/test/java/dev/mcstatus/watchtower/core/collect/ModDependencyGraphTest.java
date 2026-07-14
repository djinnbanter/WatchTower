package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class ModDependencyGraphTest {

    @Test
    void toTreeNestsDependentsAndDependencies() {
        JsonArray mods = new JsonArray();
        mods.add(modWithDeps("create", "somecorelib"));
        mods.add(mod("somecorelib"));
        mods.add(modWithDeps("railways", "create"));

        ModDependencyGraph graph = ModDependencyGraph.fromMods(mods);
        assertEquals(1, graph.dependentsCount("create"));
        assertEquals(List.of("railways"), graph.dependentsOf("create"));

        JsonObject dependents = graph.toTree("create", ModDependencyGraph.Direction.DEPENDENTS, 6);
        assertEquals("create", dependents.get("mod_id").getAsString());
        assertEquals(1, dependents.getAsJsonArray("children").size());
        assertEquals("railways", dependents.getAsJsonArray("children").get(0).getAsJsonObject()
                .get("mod_id").getAsString());

        JsonObject dependencies = graph.toTree("create", ModDependencyGraph.Direction.DEPENDENCIES, 6);
        assertEquals(1, dependencies.getAsJsonArray("children").size());
        assertEquals("somecorelib", dependencies.getAsJsonArray("children").get(0).getAsJsonObject()
                .get("mod_id").getAsString());
    }

    @Test
    void toTreeGuardsCyclesAndDepth() {
        JsonArray mods = new JsonArray();
        mods.add(modWithDeps("a", "b"));
        mods.add(modWithDeps("b", "a"));
        ModDependencyGraph graph = ModDependencyGraph.fromMods(mods);

        JsonObject tree = graph.toTree("a", ModDependencyGraph.Direction.DEPENDENCIES, 6);
        JsonObject child = tree.getAsJsonArray("children").get(0).getAsJsonObject();
        assertEquals("b", child.get("mod_id").getAsString());
        // Cycle A→B→A must not recurse forever; visited set prevents re-adding a under b.
        assertEquals(0, child.getAsJsonArray("children").size());

        JsonObject shallow = graph.toTree("a", ModDependencyGraph.Direction.DEPENDENCIES, 0);
        assertEquals(0, shallow.getAsJsonArray("children").size());
    }

    private static JsonObject mod(String id) {
        JsonObject m = new JsonObject();
        m.addProperty("id", id);
        m.addProperty("version", "1.0");
        return m;
    }

    private static JsonObject modWithDeps(String id, String... deps) {
        JsonObject m = mod(id);
        JsonArray arr = new JsonArray();
        for (String depId : deps) {
            JsonObject d = new JsonObject();
            d.addProperty("modId", depId);
            d.addProperty("mandatory", true);
            arr.add(d);
        }
        m.add("dependencies", arr);
        return m;
    }
}
