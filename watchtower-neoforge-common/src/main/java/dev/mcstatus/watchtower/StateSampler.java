package dev.mcstatus.watchtower;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import net.minecraft.server.MinecraftServer;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.List;

/**
 * Appends lightweight trend samples to watchtower/.watchtower-state.json between full reports.
 */
public final class StateSampler {
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static final int MAX_SAMPLES = 288;

    private StateSampler() {
    }

    public static void recordSample(MinecraftServer server, WatchtowerSampler.Sample sample) {
        try {
            Path statePath = WatchtowerPaths.statePath(server);
            Files.createDirectories(statePath.getParent());
            JsonObject state = loadState(statePath);

            int lookbackHours = 24;
            try {
                lookbackHours = WatchtowerConfig.LOOKBACK_HOURS.get();
            } catch (IllegalStateException ignored) {
            }
            long cutoff = Instant.now().getEpochSecond() - (long) lookbackHours * 3600L;
            String nowIso = Instant.now().toString();

            JsonArray tpsSamples = state.has("tps_samples")
                    ? state.getAsJsonArray("tps_samples")
                    : new JsonArray();
            JsonObject tpsEntry = new JsonObject();
            tpsEntry.addProperty("time", nowIso);
            tpsEntry.addProperty("mspt", round1(sample.mspt()));
            tpsEntry.addProperty("source", "watchtower");
            tpsSamples.add(tpsEntry);
            state.add("tps_samples", pruneSamples(tpsSamples, cutoff));

            Double hostPct = HostCpuProbe.readHostCpuPct();
            if (hostPct != null) {
                JsonArray cpuSamples = state.has("cpu_samples")
                        ? state.getAsJsonArray("cpu_samples")
                        : new JsonArray();
                JsonObject cpuEntry = new JsonObject();
                cpuEntry.addProperty("time", nowIso);
                cpuEntry.addProperty("host_pct", round1(hostPct));
                cpuSamples.add(cpuEntry);
                state.add("cpu_samples", pruneSamples(cpuSamples, cutoff));
            }

            Files.writeString(statePath, GSON.toJson(state) + System.lineSeparator(), StandardCharsets.UTF_8);
        } catch (Exception e) {
            WatchtowerMod.LOGGER.debug("State sample write failed: {}", e.toString());
        }
    }

    private static JsonObject loadState(Path path) throws IOException {
        if (!Files.isRegularFile(path)) {
            return new JsonObject();
        }
        String text = Files.readString(path, StandardCharsets.UTF_8);
        try {
            return JsonParser.parseString(text).getAsJsonObject();
        } catch (Exception e) {
            return new JsonObject();
        }
    }

    private static JsonArray pruneSamples(JsonArray samples, long cutoffEpoch) {
        List<JsonElement> kept = new ArrayList<>();
        for (JsonElement el : samples) {
            if (!el.isJsonObject()) {
                continue;
            }
            JsonObject obj = el.getAsJsonObject();
            if (!obj.has("time")) {
                continue;
            }
            try {
                Instant ts = Instant.parse(obj.get("time").getAsString());
                if (ts.getEpochSecond() >= cutoffEpoch) {
                    kept.add(obj);
                }
            } catch (DateTimeParseException ignored) {
            }
        }
        if (kept.size() > MAX_SAMPLES) {
            kept = kept.subList(kept.size() - MAX_SAMPLES, kept.size());
        }
        JsonArray out = new JsonArray();
        kept.forEach(out::add);
        return out;
    }

    private static double round1(double value) {
        return Math.round(value * 10.0) / 10.0;
    }
}
