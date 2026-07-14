package dev.mcstatus.watchtower.core.analyze;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.util.Collections;
import java.util.HashSet;
import java.util.Locale;
import java.util.Set;

/**
 * Early-return gate for mod-list–dependent crash rules (CA-17).
 *
 * <p>Connector detection: top-level mod ids {@code connector} / {@code connectormod},
 * plus nested ids on a mod entry when present ({@code nested_mod_ids}, {@code jar_in_jar},
 * or nested objects with an {@code id} field).
 */
public final class ModListGate {

    private static final Set<String> CONNECTOR_IDS = Set.of("connector", "connectormod");

    private final Set<String> modIds;

    private ModListGate(Set<String> modIds) {
        this.modIds = modIds;
    }

    public static ModListGate fromMods(JsonArray mods) {
        Set<String> ids = new HashSet<>();
        if (mods == null) {
            return new ModListGate(ids);
        }
        for (JsonElement el : mods) {
            if (!el.isJsonObject()) {
                continue;
            }
            JsonObject mod = el.getAsJsonObject();
            String id = str(mod, "id");
            if (id == null || id.isBlank()) {
                id = str(mod, "mod_id");
            }
            if (id != null && !id.isBlank()) {
                ids.add(id.toLowerCase(Locale.ROOT));
            }
            collectNestedIds(mod, ids);
        }
        return new ModListGate(ids);
    }

    public static ModListGate empty() {
        return new ModListGate(Set.of());
    }

    /** True when the mod id is present in the list (case-insensitive). */
    public boolean requiresMod(String modId) {
        if (modId == null || modId.isBlank()) {
            return false;
        }
        return modIds.contains(modId.toLowerCase(Locale.ROOT));
    }

    /** True when the mod id is absent (inverse of {@link #requiresMod}). */
    public boolean forbidsMod(String modId) {
        return !requiresMod(modId);
    }

    /** True when none of the given mod ids are present. */
    public boolean missingAnyOf(String... modIdsWanted) {
        if (modIdsWanted == null || modIdsWanted.length == 0) {
            return true;
        }
        for (String id : modIdsWanted) {
            if (requiresMod(id)) {
                return false;
            }
        }
        return true;
    }

    /**
     * True when Connector (Sinytra) is present as a top-level mod id
     * ({@code connector} / {@code connectormod}) or as a nested id on any mod entry.
     */
    public boolean hasConnector() {
        for (String id : CONNECTOR_IDS) {
            if (modIds.contains(id)) {
                return true;
            }
        }
        return false;
    }

    public Set<String> modIds() {
        return Collections.unmodifiableSet(modIds);
    }

    public boolean isEmpty() {
        return modIds.isEmpty();
    }

    private static void collectNestedIds(JsonObject mod, Set<String> ids) {
        if (mod.has("nested_mod_ids") && mod.get("nested_mod_ids").isJsonArray()) {
            for (JsonElement el : mod.getAsJsonArray("nested_mod_ids")) {
                if (el.isJsonPrimitive()) {
                    String nested = el.getAsString();
                    if (nested != null && !nested.isBlank()) {
                        ids.add(nested.toLowerCase(Locale.ROOT));
                    }
                }
            }
        }
        if (mod.has("jar_in_jar") && mod.get("jar_in_jar").isJsonArray()) {
            for (JsonElement el : mod.getAsJsonArray("jar_in_jar")) {
                if (el.isJsonObject()) {
                    String nested = str(el.getAsJsonObject(), "id");
                    if (nested == null) {
                        nested = str(el.getAsJsonObject(), "mod_id");
                    }
                    if (nested != null && !nested.isBlank()) {
                        ids.add(nested.toLowerCase(Locale.ROOT));
                    }
                } else if (el.isJsonPrimitive()) {
                    String nested = el.getAsString();
                    if (nested != null && !nested.isBlank()) {
                        ids.add(nested.toLowerCase(Locale.ROOT));
                    }
                }
            }
        }
        if (mod.has("nested") && mod.get("nested").isJsonArray()) {
            for (JsonElement el : mod.getAsJsonArray("nested")) {
                if (el.isJsonObject()) {
                    String nested = str(el.getAsJsonObject(), "id");
                    if (nested != null && !nested.isBlank()) {
                        ids.add(nested.toLowerCase(Locale.ROOT));
                    }
                }
            }
        }
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
