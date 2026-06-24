package dev.mcstatus.watchtower;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import net.minecraft.server.MinecraftServer;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;

public final class SnapshotWriter {
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();

    private SnapshotWriter() {
    }

    public static Path snapshotPath(MinecraftServer server) {
        return WatchtowerPaths.snapshotPath(server);
    }

    public static void write(MinecraftServer server, WatchtowerSampler.Sample sample) throws IOException {
        Path path = snapshotPath(server);
        Files.createDirectories(path.getParent());

        JsonObject root = new JsonObject();
        root.addProperty("source", "watchtower");
        root.addProperty("polled_at", Instant.now().toString());

        JsonObject overworld = new JsonObject();
        overworld.addProperty("tps", round2(sample.tps()));
        overworld.addProperty("mspt", round1(sample.mspt()));
        root.add("overworld", overworld);

        if (!sample.dimensions().isEmpty()) {
            JsonArray dims = new JsonArray();
            for (WatchtowerSampler.DimensionSample d : sample.dimensions()) {
                JsonObject dim = new JsonObject();
                dim.addProperty("id", d.id());
                dim.addProperty("tps", round2(d.tps()));
                dim.addProperty("mspt", round1(d.mspt()));
                dim.addProperty("entities", d.entities());
                dim.addProperty("chunks", d.chunks());
                dims.add(dim);
            }
            root.add("dimensions", dims);
        }

        TickMetrics.SessionMspt session = sample.sessionMspt();
        if (session != null && session.since() != null) {
            JsonObject sessionMspt = new JsonObject();
            sessionMspt.addProperty("min", round1(session.min()));
            sessionMspt.addProperty("max", round1(session.max()));
            sessionMspt.addProperty("avg", round1(session.avg()));
            sessionMspt.addProperty("p95", round1(session.p95()));
            sessionMspt.addProperty("since", session.since().toString());
            root.add("session_mspt", sessionMspt);
        }

        WatchtowerSampler.HeapMb heap = sample.heap();
        if (heap != null) {
            JsonObject heapMb = new JsonObject();
            heapMb.addProperty("used", heap.used());
            heapMb.addProperty("committed", heap.committed());
            heapMb.addProperty("max", heap.max());
            root.add("heap_mb", heapMb);
        }

        if (!sample.players().isEmpty()) {
            JsonArray players = new JsonArray();
            for (WatchtowerSampler.PlayerSample p : sample.players()) {
                JsonObject pl = new JsonObject();
                pl.addProperty("name", p.name());
                if (p.uuid() != null && !p.uuid().isBlank()) {
                    pl.addProperty("uuid", p.uuid());
                }
                pl.addProperty("ping", p.ping());
                pl.addProperty("dimension", p.dimension());
                players.add(pl);
            }
            root.add("players", players);
        }

        root.addProperty("players_online", sample.playersOnline());
        if (sample.entities() >= 0) {
            root.addProperty("entities", sample.entities());
        }
        if (sample.chunks() >= 0) {
            root.addProperty("chunks", sample.chunks());
        }
        root.addProperty("mod_count", sample.modCount());

        if (!sample.mods().isEmpty()) {
            JsonArray mods = new JsonArray();
            for (WatchtowerSampler.ModSample m : sample.mods()) {
                JsonObject mod = new JsonObject();
                mod.addProperty("id", m.id());
                mod.addProperty("version", m.version());
                if (m.displayName() != null && !m.displayName().isBlank()) {
                    mod.addProperty("display_name", m.displayName());
                }
                mods.add(mod);
            }
            root.add("mods", mods);
        }

        Files.writeString(path, GSON.toJson(root) + System.lineSeparator(), StandardCharsets.UTF_8);
    }

    private static double round1(double value) {
        return Math.round(value * 10.0) / 10.0;
    }

    private static double round2(double value) {
        return Math.round(value * 100.0) / 100.0;
    }
}
