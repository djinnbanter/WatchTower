package dev.mcstatus.watchtower.core.analyze;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class ModListGateTest {

    @Test
    void kubejsAbsent_requiresModFalse() {
        JsonArray mods = new JsonArray();
        mods.add(mod("create", "6.0.0"));
        ModListGate gate = ModListGate.fromMods(mods);
        assertFalse(gate.requiresMod("kubejs"));
        assertTrue(gate.forbidsMod("kubejs"));
        assertTrue(gate.requiresMod("create"));
        assertTrue(gate.requiresMod("Create"));
    }

    @Test
    void missingAnyOf_whenNonePresent() {
        ModListGate gate = ModListGate.fromMods(modsOf("create"));
        assertTrue(gate.missingAnyOf("kubejs", "epicfight"));
        assertFalse(gate.missingAnyOf("create", "kubejs"));
    }

    @Test
    void hasConnector_topLevel() {
        assertTrue(ModListGate.fromMods(modsOf("connector")).hasConnector());
        assertTrue(ModListGate.fromMods(modsOf("connectormod")).hasConnector());
        assertFalse(ModListGate.fromMods(modsOf("create")).hasConnector());
    }

    @Test
    void hasConnector_nestedIds() {
        JsonArray mods = new JsonArray();
        JsonObject parent = mod("somebridge", "1.0");
        JsonArray nested = new JsonArray();
        nested.add("connector");
        parent.add("nested_mod_ids", nested);
        mods.add(parent);
        assertTrue(ModListGate.fromMods(mods).hasConnector());
    }

    @Test
    void hasConnector_jarInJarObject() {
        JsonArray mods = new JsonArray();
        JsonObject parent = mod("bridge", "1.0");
        JsonArray jij = new JsonArray();
        JsonObject nested = new JsonObject();
        nested.addProperty("id", "connectormod");
        jij.add(nested);
        parent.add("jar_in_jar", jij);
        mods.add(parent);
        assertTrue(ModListGate.fromMods(mods).hasConnector());
    }

    @Test
    void nullMods_emptyGate() {
        ModListGate gate = ModListGate.fromMods(null);
        assertTrue(gate.isEmpty());
        assertFalse(gate.requiresMod("kubejs"));
        assertFalse(gate.hasConnector());
    }

    private static JsonArray modsOf(String... ids) {
        JsonArray arr = new JsonArray();
        for (String id : ids) {
            arr.add(mod(id, "1.0"));
        }
        return arr;
    }

    private static JsonObject mod(String id, String version) {
        JsonObject o = new JsonObject();
        o.addProperty("id", id);
        o.addProperty("version", version);
        return o;
    }
}
