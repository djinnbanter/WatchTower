package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Counts known noisy startup log patterns (informational only).
 */
public final class StartupWarnings {

    private static final List<PatternDef> PATTERNS = List.of(
            new PatternDef("recipe_parse", "Parsing error loading recipe"),
            new PatternDef("registry_missing", "is not found from registry"),
            new PatternDef("loot_parse", "Couldn't parse element ResourceKey"),
            new PatternDef("postprocessing_spam", "Trying to mark a block for PostProcessing"),
            new PatternDef("client_on_server", "Attempted to load class net/minecraft/client")
    );

    private StartupWarnings() {
    }

    public static Map<String, Integer> newCounter() {
        Map<String, Integer> counts = new LinkedHashMap<>();
        for (PatternDef p : PATTERNS) {
            counts.put(p.id, 0);
        }
        return counts;
    }

    public static void countLine(String line, Map<String, Integer> counts) {
        if (line == null || counts == null) {
            return;
        }
        for (PatternDef p : PATTERNS) {
            if (line.contains(p.substring)) {
                counts.merge(p.id, 1, Integer::sum);
            }
        }
    }

    public static JsonArray toJsonArray(Map<String, Integer> counts) {
        JsonArray arr = new JsonArray();
        if (counts == null) {
            return arr;
        }
        for (PatternDef p : PATTERNS) {
            int c = counts.getOrDefault(p.id, 0);
            if (c <= 0) {
                continue;
            }
            JsonObject row = new JsonObject();
            row.addProperty("id", p.id);
            row.addProperty("pattern", p.substring);
            row.addProperty("count", c);
            row.addProperty("severity", "info");
            arr.add(row);
        }
        return arr;
    }

    private record PatternDef(String id, String substring) {
    }
}
