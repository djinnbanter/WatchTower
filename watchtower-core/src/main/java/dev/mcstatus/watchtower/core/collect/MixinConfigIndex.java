package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.util.HashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

/**
 * Maps mixin config paths / basenames to owning mods from {@code optional.mods[]} (CA-01 index).
 */
public final class MixinConfigIndex {

    public record Hit(String modId, String jarName, String configPath) {
    }

    private final Map<String, Hit> byKey;

    private MixinConfigIndex(Map<String, Hit> byKey) {
        this.byKey = byKey;
    }

    public static MixinConfigIndex fromMods(JsonArray mods) {
        Map<String, Hit> map = new HashMap<>();
        if (mods == null) {
            return new MixinConfigIndex(map);
        }
        for (JsonElement el : mods) {
            if (!el.isJsonObject()) {
                continue;
            }
            JsonObject mod = el.getAsJsonObject();
            String modId = str(mod, "id");
            if (modId == null || modId.isBlank()) {
                modId = str(mod, "mod_id");
            }
            if (modId == null || modId.isBlank()) {
                continue;
            }
            String jarName = str(mod, "jar_file");
            if (jarName == null) {
                jarName = str(mod, "jar");
            }
            if (mod.has("mixin_configs") && mod.get("mixin_configs").isJsonArray()) {
                for (JsonElement cfgEl : mod.getAsJsonArray("mixin_configs")) {
                    if (!cfgEl.isJsonPrimitive()) {
                        continue;
                    }
                    String path = cfgEl.getAsString();
                    if (path == null || path.isBlank()) {
                        continue;
                    }
                    put(map, path, new Hit(modId, jarName, path));
                }
            }
            // Nested jar-in-jar configs encoded as parent.jar!nested/path
            if (mod.has("jar_in_jar") && mod.get("jar_in_jar").isJsonArray()) {
                for (JsonElement nestedEl : mod.getAsJsonArray("jar_in_jar")) {
                    if (!nestedEl.isJsonObject()) {
                        continue;
                    }
                    JsonObject nested = nestedEl.getAsJsonObject();
                    String nestedId = str(nested, "id");
                    if (nestedId == null) {
                        nestedId = modId;
                    }
                    String nestedJar = str(nested, "jar_file");
                    String indexJar = jarName != null && nestedJar != null
                            ? jarName + "!" + nestedJar
                            : (nestedJar != null ? nestedJar : jarName);
                    if (!nested.has("mixin_configs") || !nested.get("mixin_configs").isJsonArray()) {
                        continue;
                    }
                    for (JsonElement cfgEl : nested.getAsJsonArray("mixin_configs")) {
                        if (!cfgEl.isJsonPrimitive()) {
                            continue;
                        }
                        String path = cfgEl.getAsString();
                        if (path == null || path.isBlank()) {
                            continue;
                        }
                        put(map, path, new Hit(nestedId, indexJar, path));
                    }
                }
            }
        }
        return new MixinConfigIndex(map);
    }

    public static MixinConfigIndex empty() {
        return new MixinConfigIndex(Map.of());
    }

    public Optional<Hit> resolve(String configToken) {
        if (configToken == null || configToken.isBlank()) {
            return Optional.empty();
        }
        String token = configToken.strip().replace('\\', '/');
        Hit hit = byKey.get(token);
        if (hit != null) {
            return Optional.of(hit);
        }
        hit = byKey.get(token.toLowerCase(Locale.ROOT));
        if (hit != null) {
            return Optional.of(hit);
        }
        String base = basename(token);
        hit = byKey.get(base);
        if (hit != null) {
            return Optional.of(hit);
        }
        return Optional.ofNullable(byKey.get(base.toLowerCase(Locale.ROOT)));
    }

    public boolean isEmpty() {
        return byKey.isEmpty();
    }

    private static void put(Map<String, Hit> map, String path, Hit hit) {
        String normalized = path.replace('\\', '/');
        map.putIfAbsent(normalized, hit);
        map.putIfAbsent(normalized.toLowerCase(Locale.ROOT), hit);
        String base = basename(normalized);
        map.putIfAbsent(base, hit);
        map.putIfAbsent(base.toLowerCase(Locale.ROOT), hit);
    }

    private static String basename(String path) {
        int bang = path.lastIndexOf('!');
        String after = bang >= 0 ? path.substring(bang + 1) : path;
        int slash = after.lastIndexOf('/');
        return slash >= 0 ? after.substring(slash + 1) : after;
    }

    private static String str(JsonObject o, String key) {
        if (o == null || !o.has(key) || o.get(key).isJsonNull()) {
            return null;
        }
        try {
            return o.get(key).getAsString();
        } catch (Exception e) {
            return null;
        }
    }
}
