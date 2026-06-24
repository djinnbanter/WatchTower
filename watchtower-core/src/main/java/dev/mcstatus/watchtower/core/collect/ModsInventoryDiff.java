package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.FileTime;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Tracks mod jar files on disk and diffs against the last report snapshot.
 */
public final class ModsInventoryDiff {

    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_OFFSET_DATE_TIME;

    private ModsInventoryDiff() {
    }

    public static JsonArray buildSnapshot(String serverDir) {
        JsonArray out = new JsonArray();
        Path modsDir = Path.of(serverDir, "mods");
        if (!Files.isDirectory(modsDir)) {
            return out;
        }
        List<JsonObject> rows = new ArrayList<>();
        for (ModJarMetadataReader.ModEntry entry : ModJarMetadataReader.readFromModsDir(serverDir)) {
            Path jar = modsDir.resolve(entry.jarFile());
            if (!Files.isRegularFile(jar)) {
                continue;
            }
            try {
                JsonObject row = new JsonObject();
                row.addProperty("jar", entry.jarFile());
                row.addProperty("mod_id", entry.id());
                if (entry.version() != null && !entry.version().isBlank()) {
                    row.addProperty("version", entry.version());
                }
                if (entry.displayName() != null && !entry.displayName().isBlank()) {
                    row.addProperty("display_name", entry.displayName());
                }
                row.addProperty("size", Files.size(jar));
                FileTime mtime = Files.getLastModifiedTime(jar);
                row.addProperty("mtime", mtime.toInstant().getEpochSecond());
                rows.add(row);
            } catch (IOException ignored) {
            }
        }
        rows.sort(Comparator.comparing(o -> o.get("jar").getAsString()));
        rows.forEach(out::add);
        return out;
    }

    public static JsonObject diff(JsonArray current, JsonArray baseline) {
        JsonObject result = new JsonObject();
        Map<String, JsonObject> curByJar = indexByJar(current);
        Map<String, JsonObject> baseByJar = indexByJar(baseline);
        JsonArray added = new JsonArray();
        JsonArray removed = new JsonArray();
        JsonArray changed = new JsonArray();

        for (Map.Entry<String, JsonObject> e : curByJar.entrySet()) {
            JsonObject prev = baseByJar.get(e.getKey());
            if (prev == null) {
                added.add(summaryRow(e.getValue(), "added"));
            } else if (isChanged(e.getValue(), prev)) {
                changed.add(changeRow(e.getValue(), prev));
            }
        }
        for (Map.Entry<String, JsonObject> e : baseByJar.entrySet()) {
            if (!curByJar.containsKey(e.getKey())) {
                removed.add(summaryRow(e.getValue(), "removed"));
            }
        }

        result.add("added", added);
        result.add("removed", removed);
        result.add("changed", changed);
        result.addProperty("added_count", added.size());
        result.addProperty("removed_count", removed.size());
        result.addProperty("changed_count", changed.size());
        result.addProperty("has_changes", !added.isEmpty() || !removed.isEmpty() || !changed.isEmpty());
        return result;
    }

    public static void enrichModChanges(JsonObject optional, JsonArray current, JsonArray baseline) {
        if (optional == null || baseline == null || baseline.isEmpty()) {
            return;
        }
        JsonObject inventoryDiff = diff(current, baseline);
        if (!inventoryDiff.get("has_changes").getAsBoolean()) {
            return;
        }
        optional.add("mods_inventory_diff", inventoryDiff);
        if (optional.has("mod_changes") && optional.get("mod_changes").isJsonObject()) {
            JsonObject changes = optional.getAsJsonObject("mod_changes");
            appendJarNames(changes, inventoryDiff);
        }
    }

    public static JsonArray loadBaseline(JsonObject state) {
        if (state == null || !state.has("last_mods_snapshot")) {
            return new JsonArray();
        }
        return state.getAsJsonArray("last_mods_snapshot").deepCopy();
    }

    public static String summarizeTldr(JsonObject diff) {
        if (diff == null || !diff.has("has_changes") || !diff.get("has_changes").getAsBoolean()) {
            return null;
        }
        int added = diff.has("added_count") ? diff.get("added_count").getAsInt() : 0;
        int removed = diff.has("removed_count") ? diff.get("removed_count").getAsInt() : 0;
        int changed = diff.has("changed_count") ? diff.get("changed_count").getAsInt() : 0;
        List<String> parts = new ArrayList<>();
        if (added > 0) {
            parts.add(added + " added");
        }
        if (removed > 0) {
            parts.add(removed + " removed");
        }
        if (changed > 0) {
            parts.add(changed + " updated");
        }
        return String.join(", ", parts) + " since last report";
    }

    private static void appendJarNames(JsonObject changes, JsonObject inventoryDiff) {
        if (inventoryDiff.has("added")) {
            changes.add("added_jars", jarNames(inventoryDiff.getAsJsonArray("added")));
        }
        if (inventoryDiff.has("removed")) {
            changes.add("removed_jars", jarNames(inventoryDiff.getAsJsonArray("removed")));
        }
    }

    private static JsonArray jarNames(JsonArray rows) {
        JsonArray out = new JsonArray();
        for (JsonElement el : rows) {
            if (el.isJsonObject() && el.getAsJsonObject().has("jar")) {
                out.add(el.getAsJsonObject().get("jar").getAsString());
            }
        }
        return out;
    }

    private static JsonObject summaryRow(JsonObject row, String changeType) {
        JsonObject out = new JsonObject();
        out.addProperty("jar", row.get("jar").getAsString());
        if (row.has("mod_id")) {
            out.addProperty("mod_id", row.get("mod_id").getAsString());
        }
        if (row.has("display_name")) {
            out.addProperty("display_name", row.get("display_name").getAsString());
        }
        if (row.has("version")) {
            out.addProperty("version", row.get("version").getAsString());
        }
        out.addProperty("change", changeType);
        return out;
    }

    private static JsonObject changeRow(JsonObject current, JsonObject previous) {
        JsonObject out = summaryRow(current, "changed");
        if (previous.has("size") && current.has("size")
                && previous.get("size").getAsLong() != current.get("size").getAsLong()) {
            out.addProperty("prev_size", previous.get("size").getAsLong());
            out.addProperty("size", current.get("size").getAsLong());
        }
        if (previous.has("mtime") && current.has("mtime")
                && previous.get("mtime").getAsLong() != current.get("mtime").getAsLong()) {
            out.addProperty("prev_mtime", previous.get("mtime").getAsLong());
            out.addProperty("mtime", current.get("mtime").getAsLong());
        }
        return out;
    }

    private static boolean isChanged(JsonObject current, JsonObject previous) {
        if (current.has("size") && previous.has("size")
                && current.get("size").getAsLong() != previous.get("size").getAsLong()) {
            return true;
        }
        return current.has("mtime") && previous.has("mtime")
                && current.get("mtime").getAsLong() != previous.get("mtime").getAsLong();
    }

    private static Map<String, JsonObject> indexByJar(JsonArray arr) {
        Map<String, JsonObject> map = new HashMap<>();
        if (arr == null) {
            return map;
        }
        for (JsonElement el : arr) {
            if (!el.isJsonObject()) {
                continue;
            }
            JsonObject row = el.getAsJsonObject();
            if (row.has("jar")) {
                map.put(row.get("jar").getAsString(), row);
            }
        }
        return map;
    }

    public static JsonObject buildOpsBlock(JsonArray current, JsonArray baseline) {
        JsonObject block = new JsonObject();
        block.addProperty("scanned_at", ZonedDateTime.now(ZoneId.systemDefault()).format(ISO));
        JsonObject diff = diff(current, baseline);
        block.add("diff", diff);
        String tldr = summarizeTldr(diff);
        if (tldr != null) {
            block.addProperty("tldr", tldr);
        }
        block.addProperty("jar_count", current.size());
        return block;
    }
}
