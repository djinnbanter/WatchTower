package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Counts known noisy startup log patterns and collects ungrouped sample rows for the UI.
 */
public final class StartupWarnings {

    private static final int DEFAULT_SAMPLE_CAP = 24;
    private static final Pattern BRACKET_MOD = Pattern.compile("\\[([a-z0-9_.:-]{2,64})/", Pattern.CASE_INSENSITIVE);
    private static final Pattern MOD_ID_TOKEN = Pattern.compile("\\bmod(?:id)?[=: ]([a-z0-9_.:-]{2,64})", Pattern.CASE_INSENSITIVE);

    private static final List<PatternDef> PATTERNS = List.of(
            new PatternDef(
                    "recipe_parse",
                    "Parsing error loading recipe",
                    "Recipe parse failure",
                    "A recipe failed to load during boot — often a datapack or mod recipe JSON issue.",
                    "mods"),
            new PatternDef(
                    "registry_missing",
                    "is not found from registry",
                    "Missing registry entry",
                    "Something referenced an item, block, or entity that is not registered (missing mod or bad datapack).",
                    "mods"),
            new PatternDef(
                    "loot_parse",
                    "Couldn't parse element ResourceKey",
                    "Loot table parse failure",
                    "A loot table or datapack element could not be parsed while the world was loading.",
                    "logs"),
            new PatternDef(
                    "postprocessing_spam",
                    "Trying to mark a block for PostProcessing",
                    "World post-processing spam",
                    "The server repeatedly tried to mark chunks for post-processing — usually noisy, rarely fatal.",
                    "logs"),
            new PatternDef(
                    "client_on_server",
                    "Attempted to load class net/minecraft/client",
                    "Client class on dedicated server",
                    "A jar tried to load client-only Minecraft classes on the dedicated server.",
                    "mods")
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

    public static List<JsonObject> newSampleList() {
        return new ArrayList<>();
    }

    public static void countLine(String line, Map<String, Integer> counts) {
        noteLine(line, counts, null, 0);
    }

    /**
     * Count matching patterns and append an ungrouped sample row (capped).
     */
    public static void noteLine(String line, Map<String, Integer> counts, List<JsonObject> samples, int sampleCap) {
        if (line == null || counts == null) {
            return;
        }
        int cap = sampleCap > 0 ? sampleCap : DEFAULT_SAMPLE_CAP;
        for (PatternDef p : PATTERNS) {
            if (!line.contains(p.substring)) {
                continue;
            }
            counts.merge(p.id, 1, Integer::sum);
            if (samples != null && samples.size() < cap) {
                JsonObject row = new JsonObject();
                row.addProperty("id", p.id);
                row.addProperty("title", p.title);
                row.addProperty("detail", p.detail);
                row.addProperty("sample", truncate(line.trim(), 180));
                row.addProperty("link", p.link);
                String modId = guessModId(line);
                if (modId != null) {
                    row.addProperty("mod_id", modId);
                }
                samples.add(row);
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
            row.addProperty("title", p.title);
            row.addProperty("detail", p.detail);
            row.addProperty("link", p.link);
            arr.add(row);
        }
        return arr;
    }

    public static JsonArray samplesToJson(List<JsonObject> samples) {
        JsonArray arr = new JsonArray();
        if (samples == null) {
            return arr;
        }
        for (JsonObject s : samples) {
            arr.add(s);
        }
        return arr;
    }

    static String guessModId(String line) {
        if (line == null || line.isBlank()) {
            return null;
        }
        Matcher m = BRACKET_MOD.matcher(line);
        while (m.find()) {
            String id = sanitizeModId(m.group(1));
            if (id != null) {
                return id;
            }
        }
        Matcher m2 = MOD_ID_TOKEN.matcher(line);
        if (m2.find()) {
            return sanitizeModId(m2.group(1));
        }
        return null;
    }

    private static String sanitizeModId(String raw) {
        if (raw == null) {
            return null;
        }
        String id = raw.trim().toLowerCase();
        if (id.startsWith("minecraft:") || id.equals("minecraft") || id.equals("neoforge")
                || id.equals("forge") || id.equals("system") || id.equals("main")
                || id.contains("server thread") || id.contains("worker")) {
            return null;
        }
        if (id.length() < 2 || id.length() > 64) {
            return null;
        }
        return id;
    }

    private static String truncate(String s, int max) {
        if (s == null) {
            return "";
        }
        if (s.length() <= max) {
            return s;
        }
        return s.substring(0, Math.max(0, max - 1)) + "…";
    }

    private record PatternDef(String id, String substring, String title, String detail, String link) {
    }
}
