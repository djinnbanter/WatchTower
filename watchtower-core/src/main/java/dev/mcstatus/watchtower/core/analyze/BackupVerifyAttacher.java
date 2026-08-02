package dev.mcstatus.watchtower.core.analyze;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Merge / preserve backup {@code verify} objects on inventory rows by absolute path (1.1.20).
 */
public final class BackupVerifyAttacher {

    private BackupVerifyAttacher() {
    }

    /** Attach verify results onto matching inventory items (mutates array in place). */
    public static void attach(JsonArray inventory, Map<String, JsonObject> verifyByPath) {
        if (inventory == null || verifyByPath == null || verifyByPath.isEmpty()) {
            return;
        }
        for (JsonElement el : inventory) {
            if (!el.isJsonObject()) {
                continue;
            }
            JsonObject item = el.getAsJsonObject();
            String path = pathKey(item);
            if (path.isEmpty()) {
                continue;
            }
            JsonObject verify = verifyByPath.get(path);
            if (verify != null) {
                item.add("verify", verify.deepCopy());
            }
        }
    }

    /**
     * Copy {@code verify} from previous {@code backups_live} inventory onto a fresh inventory
     * when paths match and the fresh row has no verify yet.
     */
    public static JsonArray mergePreserving(JsonArray fresh, JsonObject previousBackupsLive) {
        if (fresh == null) {
            return new JsonArray();
        }
        JsonArray out = fresh.deepCopy();
        Map<String, JsonObject> prior = indexVerifyByPath(previousBackupsLive);
        if (prior.isEmpty()) {
            return out;
        }
        for (JsonElement el : out) {
            if (!el.isJsonObject()) {
                continue;
            }
            JsonObject item = el.getAsJsonObject();
            if (item.has("verify") && item.get("verify").isJsonObject()) {
                continue;
            }
            String path = pathKey(item);
            JsonObject v = prior.get(path);
            if (v != null) {
                item.add("verify", v.deepCopy());
            }
        }
        return out;
    }

    public static Map<String, JsonObject> indexVerifyByPath(JsonObject backupsLive) {
        Map<String, JsonObject> map = new LinkedHashMap<>();
        if (backupsLive == null || !backupsLive.has("inventory") || !backupsLive.get("inventory").isJsonArray()) {
            return map;
        }
        for (JsonElement el : backupsLive.getAsJsonArray("inventory")) {
            if (!el.isJsonObject()) {
                continue;
            }
            JsonObject item = el.getAsJsonObject();
            String path = pathKey(item);
            if (path.isEmpty()) {
                continue;
            }
            if (item.has("verify") && item.get("verify").isJsonObject()) {
                map.put(path, item.getAsJsonObject("verify").deepCopy());
            }
        }
        return map;
    }

    public static String pathKey(JsonObject item) {
        if (item == null) {
            return "";
        }
        if (item.has("path") && item.get("path").isJsonPrimitive()) {
            return normalizePath(item.get("path").getAsString());
        }
        if (item.has("file") && item.get("file").isJsonPrimitive()) {
            return normalizePath(item.get("file").getAsString());
        }
        return "";
    }

    public static String normalizePath(String path) {
        if (path == null || path.isBlank()) {
            return "";
        }
        return path.trim().replace('\\', '/');
    }
}
