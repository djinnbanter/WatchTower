package dev.mcstatus.watchtower;

import dev.mcstatus.watchtower.runtime.ModRuntime;

import dev.mcstatus.watchtower.runtime.ServerContext;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.collect.PlayerDirectoryCollector;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Cached player roster for the dashboard session tab.
 */
public final class PlayerRosterService {
    private static final PlayerRosterService INSTANCE = new PlayerRosterService();
    private static final long SCAN_INTERVAL_SEC = 120;

    private final AtomicReference<JsonObject> cached = new AtomicReference<>(new JsonObject());
    private volatile long lastScanEpoch;
    private volatile boolean scanRunning;

    private PlayerRosterService() {
    }

    public static PlayerRosterService get() {
        return INSTANCE;
    }

    public JsonObject getRoster(ServerContext server) {
        if (server == null) {
            JsonObject empty = cached.get();
            return empty != null ? empty.deepCopy() : new JsonObject();
        }
        JsonObject base = cached.get();
        if (base == null || !base.has("players") || base.getAsJsonArray("players").isEmpty()) {
            JsonObject fresh = scan(server);
            cached.set(fresh);
            lastScanEpoch = System.currentTimeMillis() / 1000L;
            return fresh.deepCopy();
        }
        maybeRefreshCache(server);
        return overlayOnline(base.deepCopy(), sampleOnline(server));
    }

    private void maybeRefreshCache(ServerContext server) {
        long now = System.currentTimeMillis() / 1000L;
        if (now - lastScanEpoch < SCAN_INTERVAL_SEC || scanRunning) {
            return;
        }
        scanRunning = true;
        Thread.ofVirtual().name("watchtower-player-roster").start(() -> {
            try {
                JsonObject roster = scan(server);
                cached.set(roster);
                lastScanEpoch = System.currentTimeMillis() / 1000L;
            } catch (Exception e) {
                ModRuntime.logger().debug("Player roster scan failed: {}", e.toString());
            } finally {
                scanRunning = false;
            }
        });
    }

    private static JsonObject scan(ServerContext server) {
        String serverDir = server.serverDirectory().toAbsolutePath().toString();
        return PlayerDirectoryCollector.collect(
                serverDir,
                sampleOnline(server),
                WatchtowerPaths.statePath(server));
    }

    /** Shared roster scan for ops-cache poll and dashboard API. */
    public static JsonObject scanRoster(ServerContext server) {
        return scan(server);
    }

    static JsonObject overlayOnline(JsonObject roster, List<PlayerDirectoryCollector.OnlinePlayer> onlinePlayers) {
        JsonArray players = roster.has("players") ? roster.getAsJsonArray("players") : new JsonArray();
        Map<String, JsonObject> byUuid = new HashMap<>();
        Map<String, JsonObject> byName = new HashMap<>();
        for (JsonElement el : players) {
            if (!el.isJsonObject()) {
                continue;
            }
            JsonObject p = el.getAsJsonObject();
            if (p.has("uuid")) {
                byUuid.put(p.get("uuid").getAsString().toLowerCase(Locale.ROOT), p);
            }
            if (p.has("name")) {
                byName.put(p.get("name").getAsString().toLowerCase(Locale.ROOT), p);
            }
            p.addProperty("online", false);
            p.remove("ping");
            p.remove("dimension");
        }

        Set<String> seen = new HashSet<>();
        for (PlayerDirectoryCollector.OnlinePlayer op : onlinePlayers) {
            if (op.name() == null || op.name().isBlank()) {
                continue;
            }
            String uuid = op.uuid() != null ? op.uuid().toLowerCase(Locale.ROOT) : null;
            JsonObject row = uuid != null ? byUuid.get(uuid) : null;
            if (row == null) {
                row = byName.get(op.name().toLowerCase(Locale.ROOT));
            }
            if (row == null) {
                row = new JsonObject();
                row.addProperty("name", op.name());
                row.addProperty("uuid", uuid != null ? uuid : "online:" + op.name().toLowerCase(Locale.ROOT));
                players.add(row);
            }
            row.addProperty("online", true);
            row.addProperty("ping", op.ping());
            if (op.dimension() != null && !op.dimension().isBlank()) {
                row.addProperty("dimension", op.dimension());
            }
            seen.add(row.get("uuid").getAsString());
        }

        int onlineCount = 0;
        for (JsonElement el : players) {
            if (el.isJsonObject() && el.getAsJsonObject().has("online")
                    && el.getAsJsonObject().get("online").getAsBoolean()) {
                onlineCount++;
            }
        }
        roster.add("players", players);
        roster.addProperty("online_count", onlineCount);
        roster.addProperty("known_count", players.size());
        return roster;
    }

    private static List<PlayerDirectoryCollector.OnlinePlayer> sampleOnline(ServerContext server) {
        List<PlayerDirectoryCollector.OnlinePlayer> out = new ArrayList<>();
        for (var player : server.onlinePlayers()) {
            out.add(new PlayerDirectoryCollector.OnlinePlayer(
                    player.name(),
                    player.uuid(),
                    player.ping(),
                    player.dimension()));
        }
        return out;
    }
}
