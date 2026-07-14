package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class MixinConfigIndexTest {

    @Test
    void resolvesBasenameAndPathToCreate() {
        JsonArray mods = new JsonArray();
        JsonObject create = new JsonObject();
        create.addProperty("id", "create");
        create.addProperty("jar_file", "create-6.0.0.jar");
        JsonArray configs = new JsonArray();
        configs.add("create.mixins.json");
        create.add("mixin_configs", configs);
        mods.add(create);

        MixinConfigIndex index = MixinConfigIndex.fromMods(mods);
        assertFalse(index.isEmpty());
        assertEquals("create", index.resolve("create.mixins.json").orElseThrow().modId());
        assertEquals("create", index.resolve("META-INF/create.mixins.json").orElseThrow().modId());
    }

    @Test
    void unknownConfigEmpty() {
        MixinConfigIndex index = MixinConfigIndex.fromMods(new JsonArray());
        assertTrue(index.resolve("missing.mixins.json").isEmpty());
    }

    @Test
    void collisionFirstWins() {
        JsonArray mods = new JsonArray();
        mods.add(modWithConfig("alpha", "a.jar", "shared.mixins.json"));
        mods.add(modWithConfig("beta", "b.jar", "shared.mixins.json"));
        MixinConfigIndex index = MixinConfigIndex.fromMods(mods);
        assertEquals("alpha", index.resolve("shared.mixins.json").orElseThrow().modId());
    }

    private static JsonObject modWithConfig(String id, String jar, String config) {
        JsonObject mod = new JsonObject();
        mod.addProperty("id", id);
        mod.addProperty("jar_file", jar);
        JsonArray configs = new JsonArray();
        configs.add(config);
        mod.add("mixin_configs", configs);
        return mod;
    }
}
