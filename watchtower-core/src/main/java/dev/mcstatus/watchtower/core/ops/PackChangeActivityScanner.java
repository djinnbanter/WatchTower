package dev.mcstatus.watchtower.core.ops;

import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.collect.ModJarDisable;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Stream;

/**
 * Snapshot-poll scanner for pack changes (mod jars + config touches) → activity ledger events.
 * Pure filesystem — no NeoForge.
 */
public final class PackChangeActivityScanner {

    public static final long CONFIG_COOLDOWN_SECONDS = 300L;
    public static final String TYPE_MOD_JAR_ADDED = "mod_jar_added";
    public static final String TYPE_MOD_JAR_REMOVED = "mod_jar_removed";
    public static final String TYPE_MOD_JAR_UPDATED = "mod_jar_updated";
    public static final String TYPE_CONFIG_CHANGED = "config_changed";

    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_OFFSET_DATE_TIME;

    private PackChangeActivityScanner() {
    }

    public record Result(List<JsonObject> events, JsonObject nextSnapshot) {
        public Result {
            events = events == null ? List.of() : List.copyOf(events);
            nextSnapshot = nextSnapshot == null ? new JsonObject() : nextSnapshot;
        }
    }

    /**
     * @param prevSnapshot null or missing mods → baseline only, no events
     * @param nowEpochSeconds for cooldown + event time
     */
    public static Result scan(Path serverDir, JsonObject prevSnapshot, long nowEpochSeconds) {
        if (serverDir == null) {
            return new Result(List.of(), emptySnapshot(nowEpochSeconds));
        }
        Map<String, FileMeta> curMods = scanMods(serverDir);
        Map<String, FileMeta> curConfigs = scanConfigs(serverDir);
        boolean hasPrev = prevSnapshot != null
                && prevSnapshot.has("mods")
                && prevSnapshot.get("mods").isJsonObject();

        if (!hasPrev) {
            return new Result(List.of(), buildSnapshot(nowEpochSeconds, curMods, curConfigs, Map.of()));
        }

        Map<String, FileMeta> prevMods = readMods(prevSnapshot.getAsJsonObject("mods"));
        List<JsonObject> events = new ArrayList<>();
        diffMods(prevMods, curMods, nowEpochSeconds, events);

        Map<String, FileMeta> prevConfigs = prevSnapshot.has("configs") && prevSnapshot.get("configs").isJsonObject()
                ? readMods(prevSnapshot.getAsJsonObject("configs"))
                : Map.of();
        Map<String, Long> lastEmit = readLastEmit(prevSnapshot);
        Map<String, Long> nextEmit = new HashMap<>(lastEmit);
        Set<String> cooldownHeld = new HashSet<>();
        diffConfigs(prevConfigs, curConfigs, lastEmit, nextEmit, nowEpochSeconds, events, cooldownHeld);

        Map<String, FileMeta> snapConfigs = new HashMap<>(curConfigs);
        for (String path : cooldownHeld) {
            FileMeta held = prevConfigs.get(path);
            if (held != null) {
                snapConfigs.put(path, held);
            }
        }
        return new Result(events, buildSnapshot(nowEpochSeconds, curMods, snapConfigs, nextEmit));
    }

    private static void diffMods(
            Map<String, FileMeta> prev,
            Map<String, FileMeta> cur,
            long nowEpoch,
            List<JsonObject> events
    ) {
        Set<String> softPairs = softDisablePairs(prev, cur);
        for (Map.Entry<String, FileMeta> e : cur.entrySet()) {
            String name = e.getKey();
            if (softPairs.contains(name)) {
                continue;
            }
            FileMeta was = prev.get(name);
            if (was == null) {
                if (partnerInSoftPair(name, softPairs)) {
                    continue;
                }
                // added — unless this is the disabled/enabled side of a soft toggle
                if (isSoftToggleArrival(name, prev, cur)) {
                    continue;
                }
                events.add(event(TYPE_MOD_JAR_ADDED, name, name, nowEpoch));
            } else if (was.size != e.getValue().size || was.mtime != e.getValue().mtime) {
                events.add(event(TYPE_MOD_JAR_UPDATED, name, name, nowEpoch));
            }
        }
        for (String name : prev.keySet()) {
            if (cur.containsKey(name)) {
                continue;
            }
            if (softPairs.contains(name) || isSoftToggleDeparture(name, prev, cur)) {
                continue;
            }
            events.add(event(TYPE_MOD_JAR_REMOVED, name, name, nowEpoch));
        }
    }

    private static boolean partnerInSoftPair(String name, Set<String> softPairs) {
        return softPairs.contains(name);
    }

    /** Names involved in a soft-disable/enable rename this scan. */
    private static Set<String> softDisablePairs(Map<String, FileMeta> prev, Map<String, FileMeta> cur) {
        Set<String> out = new HashSet<>();
        for (String name : prev.keySet()) {
            if (cur.containsKey(name)) {
                continue;
            }
            String partner = softPartner(name);
            if (partner != null && cur.containsKey(partner) && !prev.containsKey(partner)) {
                out.add(name);
                out.add(partner);
            }
        }
        for (String name : cur.keySet()) {
            if (prev.containsKey(name)) {
                continue;
            }
            String partner = softPartner(name);
            if (partner != null && prev.containsKey(partner) && !cur.containsKey(partner)) {
                out.add(name);
                out.add(partner);
            }
        }
        return out;
    }

    private static boolean isSoftToggleArrival(String name, Map<String, FileMeta> prev, Map<String, FileMeta> cur) {
        String partner = softPartner(name);
        return partner != null && prev.containsKey(partner) && !cur.containsKey(partner);
    }

    private static boolean isSoftToggleDeparture(String name, Map<String, FileMeta> prev, Map<String, FileMeta> cur) {
        String partner = softPartner(name);
        return partner != null && cur.containsKey(partner) && !prev.containsKey(partner);
    }

    private static String softPartner(String name) {
        if (name == null || name.isBlank()) {
            return null;
        }
        if (ModJarDisable.isDisabledName(name)) {
            return ModJarDisable.enabledNameFor(name);
        }
        if (name.toLowerCase(Locale.ROOT).endsWith(".jar")) {
            return ModJarDisable.disabledNameFor(name);
        }
        return null;
    }

    private static void diffConfigs(
            Map<String, FileMeta> prev,
            Map<String, FileMeta> cur,
            Map<String, Long> lastEmit,
            Map<String, Long> nextEmit,
            long nowEpoch,
            List<JsonObject> events,
            Set<String> cooldownHeld
    ) {
        Set<String> paths = new HashSet<>();
        paths.addAll(prev.keySet());
        paths.addAll(cur.keySet());
        for (String path : paths) {
            FileMeta was = prev.get(path);
            FileMeta now = cur.get(path);
            if (now == null) {
                nextEmit.remove(path);
                continue;
            }
            boolean changed = was == null || was.size != now.size || was.mtime != now.mtime;
            if (!changed) {
                continue;
            }
            long last = lastEmit.getOrDefault(path, 0L);
            if (last > 0 && nowEpoch - last < CONFIG_COOLDOWN_SECONDS) {
                cooldownHeld.add(path);
                continue;
            }
            events.add(event(TYPE_CONFIG_CHANGED, path, path, nowEpoch));
            nextEmit.put(path, nowEpoch);
        }
    }

    private static JsonObject event(String type, String detail, String path, long nowEpoch) {
        JsonObject e = new JsonObject();
        e.addProperty("time", formatTime(nowEpoch));
        e.addProperty("type", type);
        e.addProperty("detail", detail);
        e.addProperty("source", "scan");
        if (path != null && !path.isBlank()) {
            e.addProperty("path", path.replace('\\', '/'));
        }
        return e;
    }

    private static String formatTime(long epochSeconds) {
        return ZonedDateTime.ofInstant(Instant.ofEpochSecond(epochSeconds), ZoneId.systemDefault()).format(ISO);
    }

    private static JsonObject buildSnapshot(
            long nowEpoch,
            Map<String, FileMeta> mods,
            Map<String, FileMeta> configs,
            Map<String, Long> lastEmit
    ) {
        JsonObject next = new JsonObject();
        next.addProperty("captured_at_epoch", nowEpoch);
        next.add("mods", toMetaObject(mods));
        next.add("configs", toMetaObject(configs));
        Map<String, Long> kept = new HashMap<>();
        for (Map.Entry<String, Long> e : lastEmit.entrySet()) {
            if (configs.containsKey(e.getKey())) {
                kept.put(e.getKey(), e.getValue());
            }
        }
        next.add("config_last_emit_epoch", toEpochObject(kept));
        return next;
    }

    private static JsonObject emptySnapshot(long nowEpoch) {
        JsonObject next = new JsonObject();
        next.addProperty("captured_at_epoch", nowEpoch);
        next.add("mods", new JsonObject());
        next.add("configs", new JsonObject());
        next.add("config_last_emit_epoch", new JsonObject());
        return next;
    }

    private static JsonObject toMetaObject(Map<String, FileMeta> map) {
        JsonObject o = new JsonObject();
        for (Map.Entry<String, FileMeta> e : map.entrySet()) {
            JsonObject row = new JsonObject();
            row.addProperty("size", e.getValue().size);
            row.addProperty("mtime", e.getValue().mtime);
            row.addProperty("disabled", e.getValue().disabled);
            o.add(e.getKey(), row);
        }
        return o;
    }

    private static JsonObject toEpochObject(Map<String, Long> map) {
        JsonObject o = new JsonObject();
        for (Map.Entry<String, Long> e : map.entrySet()) {
            o.addProperty(e.getKey(), e.getValue());
        }
        return o;
    }

    private static Map<String, FileMeta> readMods(JsonObject mods) {
        Map<String, FileMeta> out = new HashMap<>();
        if (mods == null) {
            return out;
        }
        for (String key : mods.keySet()) {
            if (!mods.get(key).isJsonObject()) {
                continue;
            }
            JsonObject row = mods.getAsJsonObject(key);
            long size = row.has("size") ? row.get("size").getAsLong() : 0L;
            long mtime = row.has("mtime") ? row.get("mtime").getAsLong() : 0L;
            boolean disabled = row.has("disabled") && row.get("disabled").getAsBoolean();
            out.put(key, new FileMeta(size, mtime, disabled));
        }
        return out;
    }

    private static Map<String, Long> readLastEmit(JsonObject prev) {
        Map<String, Long> out = new HashMap<>();
        if (prev == null || !prev.has("config_last_emit_epoch") || !prev.get("config_last_emit_epoch").isJsonObject()) {
            return out;
        }
        JsonObject o = prev.getAsJsonObject("config_last_emit_epoch");
        for (String key : o.keySet()) {
            try {
                out.put(key, o.get(key).getAsLong());
            } catch (Exception ignored) {
            }
        }
        return out;
    }

    private static Map<String, FileMeta> scanMods(Path serverDir) {
        Map<String, FileMeta> out = new HashMap<>();
        Path mods = serverDir.resolve("mods");
        if (!Files.isDirectory(mods)) {
            return out;
        }
        try (Stream<Path> stream = Files.list(mods)) {
            stream.filter(Files::isRegularFile).forEach(p -> {
                String name = p.getFileName().toString();
                if (!isJarCandidate(name)) {
                    return;
                }
                try {
                    long size = Files.size(p);
                    long mtime = Files.getLastModifiedTime(p).toInstant().getEpochSecond();
                    out.put(name, new FileMeta(size, mtime, ModJarDisable.isDisabledName(name)));
                } catch (IOException ignored) {
                }
            });
        } catch (IOException ignored) {
        }
        return out;
    }

    private static boolean isJarCandidate(String name) {
        String lower = name.toLowerCase(Locale.ROOT);
        return lower.endsWith(".jar") || lower.endsWith(ModJarDisable.DISABLED_SUFFIX);
    }

    private static Map<String, FileMeta> scanConfigs(Path serverDir) {
        Map<String, FileMeta> out = new HashMap<>();
        Path config = serverDir.resolve("config");
        if (!Files.isDirectory(config)) {
            return out;
        }
        try (Stream<Path> stream = Files.walk(config)) {
            stream.filter(Files::isRegularFile).forEach(p -> {
                String fileName = p.getFileName().toString();
                if (shouldSkipConfigName(fileName)) {
                    return;
                }
                Path rel = serverDir.relativize(p);
                String key = rel.toString().replace('\\', '/');
                if (!key.startsWith("config/")) {
                    key = "config/" + key;
                }
                try {
                    long size = Files.size(p);
                    long mtime = Files.getLastModifiedTime(p).toInstant().getEpochSecond();
                    out.put(key, new FileMeta(size, mtime, false));
                } catch (IOException ignored) {
                }
            });
        } catch (IOException ignored) {
        }
        return out;
    }

    private static boolean shouldSkipConfigName(String name) {
        String lower = name.toLowerCase(Locale.ROOT);
        return lower.endsWith(".tmp") || lower.endsWith(".bak") || name.endsWith("~");
    }

    private record FileMeta(long size, long mtime, boolean disabled) {
    }
}
