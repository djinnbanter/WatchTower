package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.analyze.ModErrorCategory;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Attribute log lines to mods during a single log scan pass.
 */
public final class ModLogAnalyzer {

    private static final int MAX_MODS = 25;
    private static final int MAX_RECIPES = 5;
    private static final int MAX_SAMPLES = 3;

    private final Map<String, ModStats> byMod = new HashMap<>();

    public void processLine(String line) {
        ModErrorCategory.Hit hit = ModErrorCategory.classify(line);
        if (hit == null) {
            return;
        }
        String modId = hit.primaryMod();
        if (modId == null || modId.isBlank() || "unknown".equals(modId)) {
            if (hit.category() == ModErrorCategory.CLIENT_ON_SERVER) {
                modId = "client_noise";
            } else {
                return;
            }
        }
        final String key = modId;
        ModStats stats = byMod.computeIfAbsent(key, k -> new ModStats(key));
        stats.record(hit, line);
        if (hit.relatedMod() != null && !hit.relatedMod().isBlank()) {
            ModStats related = byMod.computeIfAbsent(hit.relatedMod(), k -> new ModStats(hit.relatedMod()));
            related.record(hit, line);
        }
    }

    public JsonArray toJsonArray() {
        List<ModStats> sorted = new ArrayList<>(byMod.values());
        sorted.sort((a, b) -> Integer.compare(b.total, a.total));
        JsonArray arr = new JsonArray();
        int limit = Math.min(MAX_MODS, sorted.size());
        for (int i = 0; i < limit; i++) {
            arr.add(sorted.get(i).toJson());
        }
        return arr;
    }

    private static final class ModStats {
        private final String modId;
        private int total;
        private final Map<String, Integer> byCategory = new HashMap<>();
        private final List<String> topRecipes = new ArrayList<>();
        private final Set<String> recipeSeen = new HashSet<>();
        private final List<String> samples = new ArrayList<>();

        private ModStats(String modId) {
            this.modId = modId;
        }

        private void record(ModErrorCategory.Hit hit, String line) {
            total++;
            String cat = hit.category().id();
            byCategory.merge(cat, 1, Integer::sum);
            if (hit.recipeId() != null && recipeSeen.size() < MAX_RECIPES) {
                if (recipeSeen.add(hit.recipeId())) {
                    topRecipes.add(hit.recipeId());
                }
            }
            if (samples.size() < MAX_SAMPLES) {
                String sample = line.strip();
                if (sample.length() > 200) {
                    sample = sample.substring(0, 200);
                }
                if (!samples.contains(sample)) {
                    samples.add(sample);
                }
            }
        }

        private JsonObject toJson() {
            JsonObject row = new JsonObject();
            row.addProperty("mod_id", modId);
            row.addProperty("total", total);
            JsonObject cats = new JsonObject();
            byCategory.entrySet().stream()
                    .sorted(Map.Entry.<String, Integer>comparingByValue().reversed())
                    .forEach(e -> cats.addProperty(e.getKey(), e.getValue()));
            row.add("by_category", cats);
            JsonArray recipes = new JsonArray();
            topRecipes.forEach(recipes::add);
            row.add("top_recipes", recipes);
            if (!samples.isEmpty()) {
                row.addProperty("sample_line", samples.get(0));
                JsonArray sampleArr = new JsonArray();
                samples.forEach(sampleArr::add);
                row.add("sample_lines", sampleArr);
            }
            if ("client_noise".equals(modId)) {
                row.addProperty("display_name", ModErrorCategory.CLIENT_ON_SERVER_DISPLAY);
                row.addProperty("worry_level", "informational");
                row.addProperty("action_needed", false);
                row.addProperty("explanation", ModErrorCategory.CLIENT_ON_SERVER_WHAT);
            } else if (!byCategory.isEmpty()) {
                String topCat = byCategory.entrySet().stream()
                        .max(Map.Entry.comparingByValue())
                        .map(Map.Entry::getKey)
                        .orElse(null);
                if (topCat != null) {
                    row.addProperty("top_category", topCat);
                    ModErrorCategory cat = categoryFromId(topCat);
                    if (cat != null) {
                        row.addProperty("category_label", cat.briefLabel());
                    }
                }
            }
            return row;
        }

        private static ModErrorCategory categoryFromId(String id) {
            for (ModErrorCategory c : ModErrorCategory.values()) {
                if (c.id().equals(id)) {
                    return c;
                }
            }
            return null;
        }
    }
}
