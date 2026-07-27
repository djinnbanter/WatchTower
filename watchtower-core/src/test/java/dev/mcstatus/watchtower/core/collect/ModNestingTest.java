package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class ModNestingTest {

    @Test
    void foldsNestedPeersUnderParent() {
        JsonArray mods = new JsonArray();
        JsonObject create = new JsonObject();
        create.addProperty("id", "create");
        create.addProperty("version", "6.0.0");
        create.addProperty("jar_file", "create-6.0.0.jar");
        JsonArray jarInJar = new JsonArray();
        JsonObject nestedMeta = new JsonObject();
        nestedMeta.addProperty("id", "flywheel");
        nestedMeta.addProperty("version", "1.0.0");
        nestedMeta.addProperty("nested_path", "META-INF/jarjar/flywheel.jar");
        jarInJar.add(nestedMeta);
        create.add("jar_in_jar", jarInJar);
        JsonArray ids = new JsonArray();
        ids.add("flywheel");
        create.add("nested_mod_ids", ids);
        mods.add(create);

        JsonObject fly = new JsonObject();
        fly.addProperty("id", "flywheel");
        fly.addProperty("version", "1.0.2");
        fly.addProperty("nested", true);
        fly.addProperty("parent_jar", "create-6.0.0.jar");
        mods.add(fly);

        ModNesting.foldOptionalMods(mods, null);
        assertEquals(1, mods.size());
        assertEquals("create", mods.get(0).getAsJsonObject().get("id").getAsString());
        assertEquals("flywheel",
                mods.get(0).getAsJsonObject().getAsJsonArray("nested_mod_ids").get(0).getAsString());
    }
}
