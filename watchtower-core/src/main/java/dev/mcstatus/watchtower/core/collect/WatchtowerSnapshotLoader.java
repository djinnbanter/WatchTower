package dev.mcstatus.watchtower.core.collect;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.ZonedDateTime;
import java.util.HashSet;
import java.util.Set;

/**
 * Load Watchtower mod snapshot.json and compute peak MSPT (ported from build_staging).
 */
public final class WatchtowerSnapshotLoader {

    private static final Gson GSON = new Gson();

    private WatchtowerSnapshotLoader() {
    }

    /**
     * Read live metrics written by the Watchtower NeoForge mod.
     *
     * @return snapshot object with {@code _native} blob, or null when unavailable
     */
    public static JsonObject loadWatchtowerSnapshot(String serverDir) {
        Path path = Path.of(serverDir, "watchtower", "snapshot.json");
        if (!Files.isRegularFile(path)) {
            return null;
        }
        JsonObject data;
        try {
            data = GSON.fromJson(Files.readString(path, StandardCharsets.UTF_8), JsonObject.class);
        } catch (IOException | com.google.gson.JsonSyntaxException e) {
            return null;
        }
        if (data == null) {
            return null;
        }

        JsonObject ow = data.has("overworld") ? data.getAsJsonObject("overworld") : new JsonObject();
        boolean hasMspt = ow.has("mspt") && !ow.get("mspt").isJsonNull();
        boolean hasTps = ow.has("tps") && !ow.get("tps").isJsonNull();
        if (!hasMspt && !hasTps) {
            return null;
        }

        JsonObject result = new JsonObject();
        result.addProperty("source", CollectSupport.getString(data, "source").isEmpty()
                ? "watchtower" : data.get("source").getAsString());
        if (data.has("polled_at")) {
            result.add("polled_at", data.get("polled_at"));
        }

        JsonObject overworld = new JsonObject();
        if (hasTps) {
            overworld.addProperty("tps", data.getAsJsonObject("overworld").get("tps").getAsDouble());
        }
        if (hasMspt) {
            overworld.addProperty("mspt", data.getAsJsonObject("overworld").get("mspt").getAsDouble());
        }
        result.add("overworld", overworld);

        JsonObject nativeBlob = new JsonObject();
        if (data.has("dimensions")) {
            nativeBlob.add("dimensions", data.get("dimensions"));
        }
        if (data.has("session_mspt")) {
            nativeBlob.add("session_mspt", data.get("session_mspt"));
        }
        if (data.has("heap_mb")) {
            nativeBlob.add("heap_mb", data.get("heap_mb"));
        }
        if (data.has("players")) {
            nativeBlob.add("players", data.get("players"));
        }
        if (data.has("mods")) {
            nativeBlob.add("mods", data.get("mods"));
        }
        result.add("_native", nativeBlob);

        if (data.has("players_online")) {
            result.addProperty("players_online", data.get("players_online").getAsInt());
        }
        if (data.has("entities")) {
            result.addProperty("entities", data.get("entities").getAsInt());
        }
        if (data.has("chunks")) {
            result.addProperty("chunks", data.get("chunks").getAsInt());
        }
        if (data.has("mod_count")) {
            result.addProperty("mod_count", data.get("mod_count").getAsInt());
        }
        return result;
    }

    public static PeakMsptResult computePeakMspt(
            double peakLog,
            JsonObject tps,
            JsonObject nativeBlob,
            JsonObject state,
            double cutoffTs) {
        Set<String> sources = new HashSet<>();
        double peak = peakLog;
        if (peakLog > 0) {
            sources.add("log");
        }

        if (tps != null) {
            JsonObject ow = tps.has("overworld") ? tps.getAsJsonObject("overworld") : null;
            if (ow != null && ow.has("mspt") && !ow.get("mspt").isJsonNull()) {
                double v = ow.get("mspt").getAsDouble();
                if (v > peak) {
                    peak = v;
                }
                sources.add("watchtower");
            }
        }

        if (nativeBlob != null && nativeBlob.has("session_mspt")) {
            JsonObject session = nativeBlob.getAsJsonObject("session_mspt");
            for (String key : new String[]{"max", "p95", "avg"}) {
                if (session.has(key) && !session.get(key).isJsonNull()) {
                    double v = session.get(key).getAsDouble();
                    if (v > peak) {
                        peak = v;
                    }
                    sources.add("watchtower");
                }
            }
        }

        if (state != null && state.has("tps_samples")) {
            JsonArray samples = state.getAsJsonArray("tps_samples");
            for (var el : samples) {
                JsonObject sample = el.getAsJsonObject();
                ZonedDateTime ts = CollectSupport.parseTime(CollectSupport.getString(sample, "time"));
                if (ts != null && CollectSupport.epochSeconds(ts) >= cutoffTs
                        && sample.has("mspt") && !sample.get("mspt").isJsonNull()) {
                    double v = sample.get("mspt").getAsDouble();
                    if (v > peak) {
                        peak = v;
                    }
                    String src = CollectSupport.getString(sample, "source");
                    sources.add(src.isEmpty() ? "watchtower" : src);
                }
            }
        }

        String sourceLabel = "";
        if (!sources.isEmpty()) {
            sourceLabel = sources.size() == 1 ? sources.iterator().next() : "mixed";
        }
        return new PeakMsptResult(peak, sourceLabel);
    }

    public record PeakMsptResult(double peak, String source) {
    }
}
