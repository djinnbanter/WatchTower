package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.analyze.ModErrorCategory;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
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
    private boolean bootWindowActive = true;

    /** Mark whether the scan is still in the boot window (before {@code Done!}). */
    public void setBootComplete(boolean complete) {
        this.bootWindowActive = !complete;
    }

    public boolean isBootWindowActive() {
        return bootWindowActive;
    }

    public void processLine(String line) {
        processLine(line, bootWindowActive);
    }

    public void processLine(String line, boolean inBootWindow) {
        processLine(null, 0, line, inBootWindow);
    }

    public void processLine(String relLogPath, int lineNo, String line, boolean inBootWindow) {
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
        stats.record(hit, line, inBootWindow, relLogPath, lineNo);
        if (hit.relatedMod() != null && !hit.relatedMod().isBlank()) {
            ModStats related = byMod.computeIfAbsent(hit.relatedMod(), k -> new ModStats(hit.relatedMod()));
            related.record(hit, line, inBootWindow, relLogPath, lineNo);
        }
        if (isKubejsSidecar(relLogPath)) {
            ModStats kubejs = byMod.computeIfAbsent("kubejs", k -> new ModStats("kubejs"));
            kubejs.record(hit, line, inBootWindow, relLogPath, lineNo);
        }
    }

    private static boolean isKubejsSidecar(String relLogPath) {
        if (relLogPath == null || relLogPath.isBlank()) {
            return false;
        }
        String norm = relLogPath.replace('\\', '/');
        return norm.endsWith("kubejs/server.log") || norm.endsWith("kubejs/startup.log");
    }

    private static String normalizeLogPath(String relLogPath) {
        return relLogPath == null ? "" : relLogPath.replace('\\', '/');
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
        private int bootHits;
        private int runtimeHits;
        private final Map<String, Integer> byCategory = new HashMap<>();
        private final List<String> topRecipes = new ArrayList<>();
        private final Set<String> recipeSeen = new HashSet<>();
        private final List<String> samples = new ArrayList<>();
        private String sourceLog;
        private final List<JsonObject> evidence = new ArrayList<>();

        private ModStats(String modId) {
            this.modId = modId;
        }

        private void record(ModErrorCategory.Hit hit, String line, boolean inBootWindow,
                            String relLogPath, int lineNo) {
            total++;
            if (inBootWindow) {
                bootHits++;
            } else {
                runtimeHits++;
            }
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
            if (relLogPath != null && !relLogPath.isBlank()) {
                if (sourceLog == null) {
                    sourceLog = normalizeLogPath(relLogPath);
                }
                if (evidence.size() < MAX_SAMPLES) {
                    String norm = normalizeLogPath(relLogPath);
                    boolean seen = false;
                    for (JsonObject ev : evidence) {
                        if (ev.has("file") && norm.equals(ev.get("file").getAsString())
                                && ev.has("line") && !ev.get("line").isJsonNull()
                                && ev.get("line").getAsInt() == lineNo) {
                            seen = true;
                            break;
                        }
                    }
                    if (!seen) {
                        evidence.add(CollectSupport.evidence(norm, lineNo > 0 ? lineNo : null, line, null));
                    }
                }
            }
        }

        private JsonObject toJson() {
            JsonObject row = new JsonObject();
            row.addProperty("mod_id", modId);
            row.addProperty("total", total);
            if (bootHits > 0 && runtimeHits == 0) {
                row.addProperty("boot_only", true);
            }
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
            if (sourceLog != null && !sourceLog.isBlank()) {
                row.addProperty("source", sourceLog);
            }
            if (!evidence.isEmpty()) {
                JsonArray evArr = new JsonArray();
                evidence.forEach(evArr::add);
                row.add("evidence", evArr);
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
