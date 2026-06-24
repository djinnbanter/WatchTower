package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.analyze.ModErrorCategory;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Attributes client-class log warnings to individual mod ids during log scan.
 */
public final class ClientLogAttributor {

    private static final int MAX_MODS = 25;
    private static final int MAX_SAMPLES = 3;
    private static final Pattern LOGGER_MOD = Pattern.compile(
            "\\[(?:ERROR|WARN|FATAL)\\]\\s*\\[([^/\\]]+)/", Pattern.CASE_INSENSITIVE);
    private static final Pattern MIXIN_PLUGIN = Pattern.compile(
            "mixin.*?\\b([a-z][\\w-]*)\\b", Pattern.CASE_INSENSITIVE);
    private static final Pattern RUNTIME_DIST = Pattern.compile(
            "RuntimeDistCleaner.*?\\b([a-z][\\w-]*)\\b", Pattern.CASE_INSENSITIVE);

    private final Map<String, ModWarnings> byMod = new HashMap<>();

    public void processLine(String line) {
        ModErrorCategory.Hit hit = ModErrorCategory.classify(line);
        if (hit == null || hit.category() != ModErrorCategory.CLIENT_ON_SERVER) {
            return;
        }
        String modId = extractModId(line, hit);
        if (modId == null || modId.isBlank() || "unknown".equals(modId)) {
            return;
        }
        byMod.computeIfAbsent(modId, ModWarnings::new).record(line);
    }

    public JsonArray toJsonArray() {
        List<ModWarnings> sorted = new ArrayList<>(byMod.values());
        sorted.sort(Comparator.comparingInt((ModWarnings w) -> w.count).reversed());
        JsonArray arr = new JsonArray();
        int limit = Math.min(MAX_MODS, sorted.size());
        for (int i = 0; i < limit; i++) {
            arr.add(sorted.get(i).toJson());
        }
        return arr;
    }

    private static String extractModId(String line, ModErrorCategory.Hit hit) {
        if (hit.primaryMod() != null && !hit.primaryMod().isBlank() && !"unknown".equals(hit.primaryMod())) {
            return hit.primaryMod();
        }
        Matcher logger = LOGGER_MOD.matcher(line);
        if (logger.find()) {
            String id = logger.group(1).strip().toLowerCase();
            if (!isFrameworkId(id)) {
                return id;
            }
        }
        Matcher mixin = MIXIN_PLUGIN.matcher(line);
        if (mixin.find()) {
            return mixin.group(1).strip().toLowerCase();
        }
        Matcher dist = RUNTIME_DIST.matcher(line);
        if (dist.find()) {
            return dist.group(1).strip().toLowerCase();
        }
        return null;
    }

    private static boolean isFrameworkId(String id) {
        return "minecraft".equals(id) || "neoforge".equals(id) || "forge".equals(id)
                || "mixin".equals(id) || "modlauncher".equals(id);
    }

    private static final class ModWarnings {
        private final String modId;
        private int count;
        private final List<String> samples = new ArrayList<>();
        private final Set<String> sampleSeen = new HashSet<>();

        private ModWarnings(String modId) {
            this.modId = modId;
        }

        private void record(String line) {
            count++;
            if (samples.size() >= MAX_SAMPLES) {
                return;
            }
            String sample = line.strip();
            if (sample.length() > 200) {
                sample = sample.substring(0, 200);
            }
            if (sampleSeen.add(sample)) {
                samples.add(sample);
            }
        }

        private JsonObject toJson() {
            JsonObject row = new JsonObject();
            row.addProperty("mod_id", modId);
            row.addProperty("count", count);
            JsonArray sampleArr = new JsonArray();
            samples.forEach(sampleArr::add);
            row.add("sample_lines", sampleArr);
            return row;
        }
    }
}
