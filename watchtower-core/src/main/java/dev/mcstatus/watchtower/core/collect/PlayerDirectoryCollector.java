package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Builds a roster of known players (usercache + stats play time) merged with live online state.
 */
public final class PlayerDirectoryCollector {

    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_INSTANT;

    private PlayerDirectoryCollector() {
    }

    public record OnlinePlayer(String name, String uuid, int ping, String dimension) {
    }

    public static JsonObject collect(String serverDir, List<OnlinePlayer> onlinePlayers) {
        JsonObject out = new JsonObject();
        out.addProperty("scanned_at", ISO.format(Instant.now()));

        Path root = Path.of(serverDir);
        String worldName = resolveWorldName(root);
        out.addProperty("world_name", worldName);
        Path statsDir = root.resolve(worldName).resolve("stats");

        Map<String, PlayerRow> byUuid = new HashMap<>();
        Map<String, String> nameToUuid = new HashMap<>();

        readUserCache(root, byUuid, nameToUuid);
        readStats(statsDir, byUuid, nameToUuid);

        Set<String> onlineUuids = new HashSet<>();
        if (onlinePlayers != null) {
            for (OnlinePlayer op : onlinePlayers) {
                if (op == null || op.name() == null || op.name().isBlank()) {
                    continue;
                }
                String uuid = normalizeUuid(op.uuid());
                if (uuid == null) {
                    uuid = nameToUuid.get(op.name().toLowerCase(Locale.ROOT));
                }
                if (uuid == null) {
                    uuid = "online:" + op.name().toLowerCase(Locale.ROOT);
                }
                final String rowUuid = uuid;
                PlayerRow row = byUuid.computeIfAbsent(rowUuid, k -> new PlayerRow(op.name(), rowUuid));
                row.name = op.name();
                row.online = true;
                row.ping = op.ping();
                row.dimension = op.dimension();
                onlineUuids.add(rowUuid);
                nameToUuid.put(op.name().toLowerCase(Locale.ROOT), rowUuid);
            }
        }

        List<PlayerRow> rows = new ArrayList<>(byUuid.values());
        rows.sort(Comparator
                .comparing((PlayerRow r) -> !r.online)
                .thenComparing(r -> r.name == null ? "" : r.name.toLowerCase(Locale.ROOT)));

        JsonArray players = new JsonArray();
        int onlineCount = 0;
        for (PlayerRow row : rows) {
            if (row.online) {
                onlineCount++;
            }
            players.add(row.toJson());
        }

        out.add("players", players);
        out.addProperty("online_count", onlineCount);
        out.addProperty("known_count", rows.size());
        return out;
    }

    static String resolveWorldName(Path serverRoot) {
        Path props = serverRoot.resolve("server.properties");
        if (Files.isRegularFile(props)) {
            try {
                for (String line : Files.readAllLines(props, StandardCharsets.UTF_8)) {
                    String trimmed = line.trim();
                    if (trimmed.startsWith("level-name=")) {
                        String value = trimmed.substring("level-name=".length()).trim();
                        if (!value.isEmpty()) {
                            return value;
                        }
                    }
                }
            } catch (IOException ignored) {
                // fall through
            }
        }
        return "world";
    }

    private static void readUserCache(Path serverRoot, Map<String, PlayerRow> byUuid, Map<String, String> nameToUuid) {
        Path cache = serverRoot.resolve("usercache.json");
        if (!Files.isRegularFile(cache)) {
            return;
        }
        try {
            String text = Files.readString(cache, StandardCharsets.UTF_8);
            JsonElement parsed = JsonParser.parseString(text);
            if (!parsed.isJsonArray()) {
                return;
            }
            for (JsonElement el : parsed.getAsJsonArray()) {
                if (!el.isJsonObject()) {
                    continue;
                }
                JsonObject entry = el.getAsJsonObject();
                String name = str(entry, "name");
                String uuid = normalizeUuid(str(entry, "uuid"));
                if (name == null || uuid == null) {
                    continue;
                }
                PlayerRow row = byUuid.computeIfAbsent(uuid, k -> new PlayerRow(name, uuid));
                row.name = name;
                String expires = str(entry, "expiresOn");
                if (expires != null) {
                    row.lastSeen = expires;
                }
                nameToUuid.put(name.toLowerCase(Locale.ROOT), uuid);
            }
        } catch (Exception ignored) {
            // unreadable cache
        }
    }

    private static void readStats(Path statsDir, Map<String, PlayerRow> byUuid, Map<String, String> nameToUuid) {
        if (!Files.isDirectory(statsDir)) {
            return;
        }
        try (DirectoryStream<Path> stream = Files.newDirectoryStream(statsDir, "*.json")) {
            for (Path file : stream) {
                String fileName = file.getFileName().toString();
                if (!fileName.endsWith(".json")) {
                    continue;
                }
                String uuid = normalizeUuid(fileName.substring(0, fileName.length() - 5));
                if (uuid == null) {
                    continue;
                }
                long ticks = readPlaytimeTicks(file);
                if (ticks <= 0) {
                    continue;
                }
                PlayerRow row = byUuid.computeIfAbsent(uuid, k -> new PlayerRow(null, uuid));
                row.playtimeTicks = ticks;
            }
        } catch (IOException ignored) {
            // skip
        }
    }

    static long readPlaytimeTicks(Path statsFile) {
        try {
            String text = Files.readString(statsFile, StandardCharsets.UTF_8);
            JsonObject root = JsonParser.parseString(text).getAsJsonObject();
            JsonObject stats = root.has("stats") ? root.getAsJsonObject("stats") : null;
            if (stats == null) {
                return 0;
            }
            JsonObject custom = stats.has("minecraft:custom") ? stats.getAsJsonObject("minecraft:custom") : null;
            if (custom == null) {
                return 0;
            }
            if (custom.has("minecraft:play_time") && !custom.get("minecraft:play_time").isJsonNull()) {
                return custom.get("minecraft:play_time").getAsLong();
            }
            if (custom.has("minecraft:play_one_minute") && !custom.get("minecraft:play_one_minute").isJsonNull()) {
                return custom.get("minecraft:play_one_minute").getAsLong() * 20L * 60L;
            }
            return 0;
        } catch (Exception e) {
            return 0;
        }
    }

    private static String normalizeUuid(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String s = raw.trim().toLowerCase(Locale.ROOT);
        if (s.startsWith("online:")) {
            return s;
        }
        String hex = s.replace("-", "");
        if (hex.length() != 32) {
            return null;
        }
        return hex;
    }

    private static String str(JsonObject obj, String key) {
        if (obj == null || !obj.has(key) || obj.get(key).isJsonNull()) {
            return null;
        }
        return obj.get(key).getAsString();
    }

    private static final class PlayerRow {
        private String name;
        private final String uuid;
        private boolean online;
        private int ping;
        private String dimension;
        private long playtimeTicks;
        private String lastSeen;

        private PlayerRow(String name, String uuid) {
            this.name = name;
            this.uuid = uuid;
        }

        private JsonObject toJson() {
            JsonObject o = new JsonObject();
            o.addProperty("name", name != null ? name : uuid);
            o.addProperty("uuid", uuid);
            o.addProperty("online", online);
            if (online) {
                o.addProperty("ping", ping);
                if (dimension != null && !dimension.isBlank()) {
                    o.addProperty("dimension", dimension);
                }
            }
            if (playtimeTicks > 0) {
                o.addProperty("playtime_ticks", playtimeTicks);
                double hours = playtimeTicks / 20.0 / 3600.0;
                o.addProperty("playtime_hours", Math.round(hours * 10.0) / 10.0);
            }
            if (lastSeen != null) {
                o.addProperty("last_seen", lastSeen);
            }
            return o;
        }
    }
}
