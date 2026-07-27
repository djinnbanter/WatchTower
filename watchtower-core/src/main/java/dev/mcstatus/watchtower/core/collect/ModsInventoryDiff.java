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

        Set<String> matchedJars = new HashSet<>();
        JsonArray changed = new JsonArray();

        for (Map.Entry<String, JsonObject> e : curByJar.entrySet()) {
            JsonObject prev = baseByJar.get(e.getKey());
            if (prev != null && isChanged(e.getValue(), prev)) {
                changed.add(changeRow(e.getValue(), prev));
                matchedJars.add(e.getKey());
            } else if (prev != null) {
                matchedJars.add(e.getKey());
            }
        }

        List<JsonObject> unmatchedAdded = new ArrayList<>();
        List<JsonObject> unmatchedRemoved = new ArrayList<>();
        for (Map.Entry<String, JsonObject> e : curByJar.entrySet()) {
            if (!matchedJars.contains(e.getKey()) && !baseByJar.containsKey(e.getKey())) {
                unmatchedAdded.add(e.getValue());
            }
        }
        for (Map.Entry<String, JsonObject> e : baseByJar.entrySet()) {
            if (!matchedJars.contains(e.getKey()) && !curByJar.containsKey(e.getKey())) {
                unmatchedRemoved.add(e.getValue());
            }
        }

        // Same mod_id with a new jar file name is an update (version bump), not remove+add.
        Map<String, JsonObject> addedByMod = indexUniqueByModId(unmatchedAdded);
        Map<String, JsonObject> removedByMod = indexUniqueByModId(unmatchedRemoved);
        Set<String> coalescedMods = new HashSet<>();
        for (Map.Entry<String, JsonObject> e : addedByMod.entrySet()) {
            JsonObject prev = removedByMod.get(e.getKey());
            if (prev == null) {
                continue;
            }
            changed.add(changeRow(e.getValue(), prev));
            coalescedMods.add(e.getKey());
        }

        JsonArray added = new JsonArray();
        for (JsonObject row : unmatchedAdded) {
            String modId = modIdOf(row);
            if (modId != null && coalescedMods.contains(modId)) {
                continue;
            }
            added.add(summaryRow(row, "added"));
        }
        JsonArray removed = new JsonArray();
        for (JsonObject row : unmatchedRemoved) {
            String modId = modIdOf(row);
            if (modId != null && coalescedMods.contains(modId)) {
                continue;
            }
            removed.add(summaryRow(row, "removed"));
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

    /** Previous ops-poll jar snapshot used to detect on-disk changes between scans. */
    public static JsonArray loadOpsBaseline(JsonObject state) {
        if (state == null || !state.has("last_mods_ops_snapshot")
                || !state.get("last_mods_ops_snapshot").isJsonArray()) {
            return new JsonArray();
        }
        return state.getAsJsonArray("last_mods_ops_snapshot").deepCopy();
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
        if (row.has("mtime") && !row.get("mtime").isJsonNull()) {
            out.addProperty("mtime", row.get("mtime").getAsLong());
        }
        if (row.has("size") && !row.get("size").isJsonNull()) {
            out.addProperty("size", row.get("size").getAsLong());
        }
        out.addProperty("change", changeType);
        return out;
    }

    private static JsonObject changeRow(JsonObject current, JsonObject previous) {
        JsonObject out = summaryRow(current, "changed");
        if (previous.has("version") && previous.get("version").isJsonPrimitive()) {
            String prevVer = previous.get("version").getAsString();
            if (prevVer != null && !prevVer.isBlank()) {
                out.addProperty("prev_version", prevVer);
            }
        }
        if (previous.has("jar") && current.has("jar")
                && !previous.get("jar").getAsString().equals(current.get("jar").getAsString())) {
            out.addProperty("prev_jar", previous.get("jar").getAsString());
        }
        if (previous.has("size") && current.has("size")
                && previous.get("size").getAsLong() != current.get("size").getAsLong()) {
            out.addProperty("prev_size", previous.get("size").getAsLong());
            out.addProperty("size", current.get("size").getAsLong());
        } else if (previous.has("size") && !out.has("prev_size")) {
            // Keep size trail when jar renamed even if sizes match.
            out.addProperty("prev_size", previous.get("size").getAsLong());
            if (current.has("size")) {
                out.addProperty("size", current.get("size").getAsLong());
            }
        }
        if (previous.has("mtime") && current.has("mtime")
                && previous.get("mtime").getAsLong() != current.get("mtime").getAsLong()) {
            out.addProperty("prev_mtime", previous.get("mtime").getAsLong());
            out.addProperty("mtime", current.get("mtime").getAsLong());
        }
        return out;
    }

    private static boolean isChanged(JsonObject current, JsonObject previous) {
        if (current.has("version") && previous.has("version")
                && !current.get("version").getAsString().equals(previous.get("version").getAsString())) {
            return true;
        }
        if (current.has("size") && previous.has("size")
                && current.get("size").getAsLong() != previous.get("size").getAsLong()) {
            return true;
        }
        return current.has("mtime") && previous.has("mtime")
                && current.get("mtime").getAsLong() != previous.get("mtime").getAsLong();
    }

    private static String modIdOf(JsonObject row) {
        if (row == null || !row.has("mod_id") || row.get("mod_id").isJsonNull()) {
            return null;
        }
        String id = row.get("mod_id").getAsString();
        return id == null || id.isBlank() ? null : id;
    }

    /** Index rows by mod_id only when that id appears once (safe 1:1 coalesce). */
    private static Map<String, JsonObject> indexUniqueByModId(List<JsonObject> rows) {
        Map<String, Integer> counts = new HashMap<>();
        for (JsonObject row : rows) {
            String id = modIdOf(row);
            if (id != null) {
                counts.merge(id, 1, Integer::sum);
            }
        }
        Map<String, JsonObject> map = new HashMap<>();
        for (JsonObject row : rows) {
            String id = modIdOf(row);
            if (id != null && counts.getOrDefault(id, 0) == 1) {
                map.put(id, row);
            }
        }
        return map;
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
