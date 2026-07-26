package dev.mcstatus.watchtower.core.ops;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

/**
 * Resolves a mods array suitable for {@link dev.mcstatus.watchtower.core.collect.ModDependencyGraph}
 * from ops-cache when no legacy BAU facts file exists.
 */
public final class OpsModsTreeSource {

    private OpsModsTreeSource() {
    }

    /**
     * Prefer {@code mods_light.mods}, then {@code running_mods.mods}, then inventory-shaped rows
     * under {@code mods_inventory} (normalized {@code mod_id} → {@code id}).
     *
     * @return non-null array (may be empty when Scanning has not produced mod data yet)
     */
    public static JsonArray resolveModsArray(JsonObject opsCache) {
        if (opsCache == null) {
            return new JsonArray();
        }
        JsonArray fromLight = arrayUnder(opsCache, "mods_light", "mods");
        if (fromLight != null && fromLight.size() > 0) {
            return normalizeIds(fromLight);
        }
        JsonArray fromRunning = arrayUnder(opsCache, OpsCacheSchema.RUNNING_MODS, OpsCacheSchema.RUNNING_MODS_MODS);
        if (fromRunning != null && fromRunning.size() > 0) {
            return normalizeIds(fromRunning);
        }
        JsonArray fromInventory = inventoryMods(opsCache);
        if (fromInventory != null && fromInventory.size() > 0) {
            return normalizeIds(fromInventory);
        }
        return new JsonArray();
    }

    private static JsonArray arrayUnder(JsonObject root, String objectKey, String arrayKey) {
        if (!root.has(objectKey) || !root.get(objectKey).isJsonObject()) {
            return null;
        }
        JsonObject block = root.getAsJsonObject(objectKey);
        if (!block.has(arrayKey) || !block.get(arrayKey).isJsonArray()) {
            return null;
        }
        return block.getAsJsonArray(arrayKey);
    }

    /**
     * Inventory block is usually a diff summary; accept an embedded {@code mods} / {@code snapshot}
     * array when present (future-proof / richer caches).
     */
    private static JsonArray inventoryMods(JsonObject opsCache) {
        if (!opsCache.has(OpsCacheSchema.MODS_INVENTORY) || !opsCache.get(OpsCacheSchema.MODS_INVENTORY).isJsonObject()) {
            return null;
        }
        JsonObject inv = opsCache.getAsJsonObject(OpsCacheSchema.MODS_INVENTORY);
        if (inv.has("mods") && inv.get("mods").isJsonArray()) {
            return inv.getAsJsonArray("mods");
        }
        if (inv.has("snapshot") && inv.get("snapshot").isJsonArray()) {
            return inv.getAsJsonArray("snapshot");
        }
        return null;
    }

    /** Ensure graph matching works for inventory rows that use {@code mod_id} instead of {@code id}. */
    static JsonArray normalizeIds(JsonArray mods) {
        JsonArray out = new JsonArray();
        for (JsonElement el : mods) {
            if (!el.isJsonObject()) {
                continue;
            }
            JsonObject mod = el.getAsJsonObject().deepCopy();
            if ((!mod.has("id") || mod.get("id").isJsonNull() || mod.get("id").getAsString().isBlank())
                    && mod.has("mod_id") && !mod.get("mod_id").isJsonNull()) {
                mod.addProperty("id", mod.get("mod_id").getAsString());
            }
            out.add(mod);
        }
        return out;
    }
}
