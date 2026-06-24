package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

/**
 * Soft-fail messages from staging collectors.
 */
public final class CollectionWarnings {

    private CollectionWarnings() {
    }

    public static JsonArray getOrCreate(JsonObject staging) {
        if (staging.has("collection_warnings") && staging.get("collection_warnings").isJsonArray()) {
            return staging.getAsJsonArray("collection_warnings");
        }
        JsonArray arr = new JsonArray();
        staging.add("collection_warnings", arr);
        return arr;
    }

    public static void add(JsonObject staging, String message) {
        if (message == null || message.isBlank()) {
            return;
        }
        getOrCreate(staging).add(message);
    }
}
