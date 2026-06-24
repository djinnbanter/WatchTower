package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class PlayerDirectoryCollectorTest {

    @TempDir
    Path temp;

    @Test
    void collectsUsercacheStatsAndOnlineMerge() throws Exception {
        Path world = temp.resolve("world").resolve("stats");
        Files.createDirectories(world);
        String uuid = "550e8400e29b41d4a716446655440000";
        Files.writeString(temp.resolve("usercache.json"), """
                [{"name":"Steve","uuid":"550e8400-e29b-41d4-a716-446655440000","expiresOn":"2026-07-01T00:00:00Z"},
                 {"name":"Alex","uuid":"6ba7b810-9dad-11d1-80b4-00c04fd430c8","expiresOn":"2026-06-01T00:00:00Z"}]
                """);
        Files.writeString(world.resolve(uuid + ".json"), """
                {"stats":{"minecraft:custom":{"minecraft:play_time":72000}}}
                """);

        JsonObject roster = PlayerDirectoryCollector.collect(
                temp.toString(),
                List.of(new PlayerDirectoryCollector.OnlinePlayer(
                        "Steve", uuid, 42, "minecraft:overworld")));

        assertEquals(2, roster.get("known_count").getAsInt());
        assertEquals(1, roster.get("online_count").getAsInt());
        JsonArray players = roster.getAsJsonArray("players");
        JsonObject steve = players.get(0).getAsJsonObject();
        assertTrue(steve.get("online").getAsBoolean());
        assertEquals(42, steve.get("ping").getAsInt());
        assertEquals(1.0, steve.get("playtime_hours").getAsDouble(), 0.01);
        JsonObject alex = players.get(1).getAsJsonObject();
        assertFalse(alex.get("online").getAsBoolean());
    }

    @Test
    void resolvesWorldFromServerProperties() throws Exception {
        Files.writeString(temp.resolve("server.properties"), "level-name=myworld\n");
        assertEquals("myworld", PlayerDirectoryCollector.resolveWorldName(temp));
    }

    @Test
    void readPlaytimeTicksFromStatsFile() throws Exception {
        Path stats = temp.resolve("p.json");
        Files.writeString(stats, """
                {"stats":{"minecraft:custom":{"minecraft:play_time":1200}}}
                """);
        assertEquals(1200, PlayerDirectoryCollector.readPlaytimeTicks(stats));
    }
}
