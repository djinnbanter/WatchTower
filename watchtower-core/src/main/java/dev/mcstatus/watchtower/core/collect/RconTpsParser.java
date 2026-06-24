package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Parse NeoForge/Forge/Spark TPS command output (ported from mc-status-rcon.py).
 */
public final class RconTpsParser {

    private static final Pattern DIM_TPS = Pattern.compile(
            "(?:dimension[:\\s]+)?([\\w.:]+)[:\\s]+(?:mean\\s+)?(\\d+(?:\\.\\d+)?)\\s*TPS"
                    + "(?:[,\\s]+(?:mean\\s+)?(\\d+(?:\\.\\d+)?)\\s*(?:ms|MSPT))?",
            Pattern.CASE_INSENSITIVE);
    private static final Pattern DIM_MSPT = Pattern.compile(
            "([\\w.:]+)[:\\s,]+.*?(\\d+(?:\\.\\d+)?)\\s*ms",
            Pattern.CASE_INSENSITIVE);
    private static final Pattern SPARK_TPS = Pattern.compile(
            "TPS from last (\\d+m):\\s*(\\d+(?:\\.\\d+)?)",
            Pattern.CASE_INSENSITIVE);

    private RconTpsParser() {
    }

    public static JsonObject parse(String text) {
        JsonObject result = new JsonObject();
        if (text == null || text.isBlank()) {
            result.add("dimensions", new JsonArray());
            return result;
        }
        List<JsonObject> dimensions = new ArrayList<>();
        Set<String> seenIds = new HashSet<>();

        Matcher m = DIM_TPS.matcher(text);
        while (m.find()) {
            String dimId = m.group(1).strip();
            if (!seenIds.add(dimId)) {
                continue;
            }
            JsonObject entry = new JsonObject();
            entry.addProperty("id", dimId);
            if (m.group(2) != null) {
                entry.addProperty("tps", Double.parseDouble(m.group(2)));
            }
            if (m.group(3) != null) {
                entry.addProperty("mspt", Double.parseDouble(m.group(3)));
            }
            dimensions.add(entry);
        }

        if (dimensions.isEmpty()) {
            Matcher msptMatcher = DIM_MSPT.matcher(text);
            while (msptMatcher.find()) {
                String dimId = msptMatcher.group(1).strip();
                if (!seenIds.add(dimId)) {
                    continue;
                }
                double mspt = Double.parseDouble(msptMatcher.group(2));
                JsonObject entry = new JsonObject();
                entry.addProperty("id", dimId);
                entry.addProperty("mspt", mspt);
                entry.addProperty("tps", mspt > 50
                        ? Math.round(Math.max(0.0, 20.0 - (mspt - 50.0) / 50.0 * 20.0) * 100.0) / 100.0
                        : 20.0);
                dimensions.add(entry);
            }
        }

        JsonObject sparkWindows = new JsonObject();
        Matcher spark = SPARK_TPS.matcher(text);
        while (spark.find()) {
            sparkWindows.addProperty(spark.group(1), Double.parseDouble(spark.group(2)));
        }

        JsonArray dimArr = new JsonArray();
        dimensions.forEach(dimArr::add);
        result.add("dimensions", dimArr);
        result.addProperty("raw", text.length() > 2000 ? text.substring(0, 2000) : text);

        JsonObject overworld = null;
        for (JsonObject d : dimensions) {
            String id = d.get("id").getAsString();
            if (id.toLowerCase(Locale.ROOT).contains("overworld") || "minecraft:overworld".equals(id)) {
                overworld = d;
                break;
            }
        }
        if (overworld == null && !dimensions.isEmpty()) {
            overworld = dimensions.get(0);
        }
        if (overworld != null) {
            JsonObject ow = new JsonObject();
            if (overworld.has("id")) {
                ow.addProperty("id", overworld.get("id").getAsString());
            }
            if (overworld.has("tps")) {
                ow.addProperty("tps", overworld.get("tps").getAsDouble());
            }
            if (overworld.has("mspt")) {
                ow.addProperty("mspt", overworld.get("mspt").getAsDouble());
            }
            result.add("overworld", ow);
        }
        if (!sparkWindows.entrySet().isEmpty()) {
            result.add("spark_tps", sparkWindows);
        }
        return result;
    }

    public static boolean hasMetrics(JsonObject parsed) {
        if (parsed == null) {
            return false;
        }
        if (parsed.has("spark_tps") && parsed.getAsJsonObject("spark_tps").size() > 0) {
            return true;
        }
        return parsed.has("dimensions") && !parsed.getAsJsonArray("dimensions").isEmpty();
    }
}
