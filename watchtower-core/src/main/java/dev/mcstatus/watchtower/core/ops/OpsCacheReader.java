package dev.mcstatus.watchtower.core.ops;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

/**
 * Loads {@code watchtower/ops-cache.json}.
 */
public final class OpsCacheReader {

    private OpsCacheReader() {
    }

    public static JsonObject load(Path opsCachePath) throws IOException {
        if (opsCachePath == null || !Files.isRegularFile(opsCachePath)) {
            return empty();
        }
        String text = Files.readString(opsCachePath, StandardCharsets.UTF_8);
        try {
            JsonObject root = JsonParser.parseString(text).getAsJsonObject();
            if (!root.has(OpsCacheSchema.SCHEMA_VERSION_KEY)) {
                root.addProperty(OpsCacheSchema.SCHEMA_VERSION_KEY, OpsCacheSchema.SCHEMA_VERSION);
            }
            return root;
        } catch (Exception e) {
            return empty();
        }
    }

    public static JsonObject empty() {
        JsonObject root = new JsonObject();
        root.addProperty(OpsCacheSchema.SCHEMA_VERSION_KEY, OpsCacheSchema.SCHEMA_VERSION);
        return root;
    }
}
