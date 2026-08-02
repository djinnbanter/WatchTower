package dev.mcstatus.watchtower.core.analyze;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonNull;
import com.google.gson.JsonObject;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Chunk write / pregen pressure classifiers (1.1.23). Pure JSON — merges onto {@code world_pressure}.
 */
public final class ChunkWritePressureAnalyzer {

    public static final int SUSTAINED = 3;
    public static final long GROWTH_HOT_CHUNKS = 48;
    public static final String KIND_SAVE_BACKLOG = "chunk_save_backlog";
    public static final String KIND_PREGEN_DISK = "pregen_outrunning_disk";
    public static final String KIND_HEAVY_GEN = "heavy_chunk_generation";
    public static final String CHUNK_WRITE_STREAKS = "chunk_write_streaks";

    private ChunkWritePressureAnalyzer() {
    }

    /**
     * Mutates {@code block} in place: appends classifiers, updates {@code chunk_write_streaks}, sets meters.
     *
     * @param signals {@code dh_pregen}, {@code chunky_pregen}, {@code write_await_ms}, {@code write_mb_s}, {@code census}
     */
    public static void enrich(JsonObject block, JsonObject signals, JsonObject prevOpsRoot, double diskWarnMs) {
        enrich(block, signals, prevOpsRoot, diskWarnMs, GROWTH_HOT_CHUNKS, SUSTAINED);
    }

    public static void enrich(
            JsonObject block,
            JsonObject signals,
            JsonObject prevOpsRoot,
            double diskWarnMs,
            long growthHotChunks,
            int sustainedScans
    ) {
        if (block == null) {
            return;
        }
        if (signals == null) {
            signals = new JsonObject();
        }
        double warn = diskWarnMs > 0 ? diskWarnMs : 50.0;
        long growthHot = Math.max(1, growthHotChunks);
        int sustainedNeed = Math.max(1, sustainedScans);

        JsonObject prevWp = prevOpsRoot != null
                && prevOpsRoot.has("world_pressure")
                && prevOpsRoot.get("world_pressure").isJsonObject()
                ? prevOpsRoot.getAsJsonObject("world_pressure")
                : null;
        JsonObject prevStreaks = prevWp != null
                && prevWp.has(CHUNK_WRITE_STREAKS)
                && prevWp.get(CHUNK_WRITE_STREAKS).isJsonObject()
                ? prevWp.getAsJsonObject(CHUNK_WRITE_STREAKS).deepCopy()
                : new JsonObject();
        long prevLoaded = 0;
        if (prevWp != null && prevWp.has("meters") && prevWp.get("meters").isJsonObject()) {
            JsonObject pm = prevWp.getAsJsonObject("meters");
            if (pm.has("prev_loaded_chunks") && !pm.get("prev_loaded_chunks").isJsonNull()) {
                prevLoaded = Math.round(pm.get("prev_loaded_chunks").getAsDouble());
            }
        }

        stripOurClassifiers(block);

        JsonObject census = signals.has("census") && signals.get("census").isJsonObject()
                ? signals.getAsJsonObject("census")
                : new JsonObject();
        DimStats dim = pickDim(census);
        long totalLoaded = totalLoadedChunks(census);
        long totalPlayers = totalPlayers(census);
        long growthHotChunksThreshold = growthHot;
        long growth = prevLoaded > 0 ? totalLoaded - prevLoaded : 0;
        boolean growthIsHot = growth >= growthHotChunksThreshold;

        Double writeAwait = dbl(signals, "write_await_ms");
        Double writeMbS = dbl(signals, "write_mb_s");
        boolean latencyHot = writeAwait != null && writeAwait >= warn;
        boolean latencyCritical = writeAwait != null && writeAwait >= warn * 3.0;

        PregenInfo pregen = readPregen(signals);

        JsonArray classifiers = block.has("classifiers") && block.get("classifiers").isJsonArray()
                ? block.getAsJsonArray("classifiers")
                : new JsonArray();
        if (!block.has("classifiers") || !block.get("classifiers").isJsonArray()) {
            block.add("classifiers", classifiers);
        }

        JsonObject streaks = prevStreaks;
        Set<String> active = new HashSet<>();
        String dimId = dim.id();
        String label = WorldPressureAnalyzer.dimensionLabel(dimId);

        // pregen_outrunning_disk
        boolean pregenHit = pregen.active && latencyHot;
        JsonObject pregenEvidence = new JsonObject();
        if (writeAwait != null) {
            pregenEvidence.addProperty("write_await_ms", round1(writeAwait));
        }
        pregenEvidence.addProperty("write_warn_ms", warn);
        pregenEvidence.addProperty("pregen_active", pregen.active);
        pregenEvidence.addProperty("pregen_label", pregen.label);
        if (pregen.rateLabel != null) {
            pregenEvidence.addProperty("pregen_rate", pregen.rateLabel);
        }
        if (writeMbS != null) {
            pregenEvidence.addProperty("write_mb_s", round1(writeMbS));
        }
        maybeEmit(classifiers, streaks, active, KIND_PREGEN_DISK, dimId, pregenHit, sustainedNeed,
                latencyCritical ? "critical" : "warning",
                "Pregen is outrunning the disk",
                String.format(Locale.US,
                        "%s pregen is active while disk write latency is %s — the disk cannot keep up.",
                        pregen.label, formatMs(writeAwait)),
                List.of(
                        "Pause pregen and let the disk catch up.",
                        "Wait for chunk saves to finish before making more world changes.",
                        "Do not restart mid-flush when write latency is this high."),
                pregenEvidence);

        // chunk_save_backlog — latency without needing pregen; skip if pregen classifier already covers it
        boolean saveHit = latencyHot && !pregen.active;
        JsonObject saveEvidence = new JsonObject();
        if (writeAwait != null) {
            saveEvidence.addProperty("write_await_ms", round1(writeAwait));
        }
        saveEvidence.addProperty("write_warn_ms", warn);
        if (writeMbS != null) {
            saveEvidence.addProperty("write_mb_s", round1(writeMbS));
        }
        maybeEmit(classifiers, streaks, active, KIND_SAVE_BACKLOG, dimId, saveHit, sustainedNeed,
                latencyCritical ? "critical" : "warning",
                "Chunk save backlog",
                String.format(Locale.US,
                        "Disk write latency is %s%s — chunk saves look backed up.",
                        formatMs(writeAwait),
                        writeMbS != null && writeMbS > 0
                                ? String.format(Locale.US, " (about %.1f MB/s)", writeMbS)
                                : ""),
                List.of(
                        "Wait for world saves to finish before restarting.",
                        "Avoid restarting mid-flush when the disk is this busy.",
                        "If this keeps happening, pause heavy worldgen or lower save frequency."),
                saveEvidence);

        // heavy_chunk_generation
        boolean heavyHit = totalPlayers > 0 && growthIsHot;
        JsonObject heavyEvidence = new JsonObject();
        heavyEvidence.addProperty("loaded_chunks", totalLoaded);
        heavyEvidence.addProperty("chunk_growth", Math.max(0, growth));
        heavyEvidence.addProperty("growth_hot_chunks", growthHotChunksThreshold);
        heavyEvidence.addProperty("players", totalPlayers);
        maybeEmit(classifiers, streaks, active, KIND_HEAVY_GEN, dimId, heavyHit, sustainedNeed,
                "warning",
                "Heavy chunk generation while players are online",
                String.format(Locale.US,
                        "Loaded chunks grew by %,d in %s while players are online.",
                        Math.max(0, growth), label),
                List.of(
                        "Pause pregen or slow exploration bursts while players are on.",
                        "Check view distance and worldgen load — WatchTower will not name a mod without evidence.",
                        "Prefer waiting for chunk load to settle before restarting."),
                heavyEvidence);

        // Decay inactive chunk-write streaks only
        List<String> remove = new ArrayList<>();
        for (Map.Entry<String, JsonElement> e : streaks.entrySet()) {
            if (!active.contains(e.getKey())) {
                remove.add(e.getKey());
            }
        }
        for (String k : remove) {
            streaks.remove(k);
        }
        block.add(CHUNK_WRITE_STREAKS, streaks);

        JsonObject meters = new JsonObject();
        if (writeAwait != null) {
            meters.addProperty("write_await_ms", round1(writeAwait));
        } else {
            meters.add("write_await_ms", JsonNull.INSTANCE);
        }
        meters.addProperty("write_warn_ms", warn);
        meters.addProperty("pregen_active", pregen.active);
        if (pregen.active) {
            meters.addProperty("pregen_label", pregen.label);
            if (pregen.rateLabel != null) {
                meters.addProperty("pregen_rate", pregen.rateLabel);
            } else {
                meters.add("pregen_rate", JsonNull.INSTANCE);
            }
        } else {
            meters.addProperty("pregen_label", "Pregen");
            meters.add("pregen_rate", JsonNull.INSTANCE);
        }
        if (growthIsHot) {
            meters.addProperty("chunk_growth_label",
                    String.format(Locale.US, "+%d", Math.max(0, growth)));
        } else if (growth > 0) {
            meters.addProperty("chunk_growth_label", String.format(Locale.US, "+%d", growth));
        } else if (growth < 0) {
            meters.addProperty("chunk_growth_label", String.format(Locale.US, "%d", growth));
        } else {
            meters.addProperty("chunk_growth_label", "Steady");
        }
        meters.addProperty("growth_hot_chunks", growthHotChunksThreshold);
        meters.addProperty("prev_loaded_chunks", totalLoaded);
        block.add("meters", meters);
    }

    private static void stripOurClassifiers(JsonObject block) {
        if (!block.has("classifiers") || !block.get("classifiers").isJsonArray()) {
            block.add("classifiers", new JsonArray());
            return;
        }
        JsonArray src = block.getAsJsonArray("classifiers");
        JsonArray kept = new JsonArray();
        for (JsonElement el : src) {
            if (!el.isJsonObject()) {
                continue;
            }
            String kind = str(el.getAsJsonObject(), "kind");
            if (KIND_SAVE_BACKLOG.equals(kind)
                    || KIND_PREGEN_DISK.equals(kind)
                    || KIND_HEAVY_GEN.equals(kind)) {
                continue;
            }
            kept.add(el);
        }
        block.add("classifiers", kept);
    }

    private static void maybeEmit(
            JsonArray classifiers,
            JsonObject streaks,
            Set<String> active,
            String kind,
            String dimId,
            boolean hit,
            int sustainedNeed,
            String severity,
            String headline,
            String detail,
            List<String> nextSteps,
            JsonObject evidence
    ) {
        String key = kind + ":" + dimId;
        int streak = streaks.has(key) ? streaks.get(key).getAsInt() : 0;
        if (!hit) {
            return;
        }
        streak++;
        streaks.addProperty(key, streak);
        active.add(key);
        if (streak < sustainedNeed) {
            return;
        }
        JsonObject c = new JsonObject();
        c.addProperty("kind", kind);
        c.addProperty("dimension", dimId);
        c.addProperty("severity", severity);
        c.addProperty("sustained_scans", streak);
        c.addProperty("headline", headline);
        c.addProperty("detail", detail);
        if (evidence != null) {
            c.add("evidence", evidence.deepCopy());
        }
        JsonArray steps = new JsonArray();
        for (String s : nextSteps) {
            steps.add(s);
        }
        c.add("next_steps", steps);
        classifiers.add(c);
    }

    private static PregenInfo readPregen(JsonObject signals) {
        JsonObject chunky = obj(signals, "chunky_pregen");
        JsonObject dh = obj(signals, "dh_pregen");
        boolean chunkyActive = bool(chunky, "pregen_active");
        boolean dhActive = bool(dh, "pregen_active");
        if (chunkyActive) {
            return new PregenInfo(true, "Chunky", rateFrom(chunky));
        }
        if (dhActive) {
            return new PregenInfo(true, "Distant Horizons", rateFrom(dh));
        }
        return new PregenInfo(false, "Pregen", null);
    }

    private static String rateFrom(JsonObject pregen) {
        if (pregen == null) {
            return null;
        }
        Double cps = dbl(pregen, "cps_avg");
        if (cps == null && pregen.has("last") && pregen.get("last").isJsonObject()) {
            cps = dbl(pregen.getAsJsonObject("last"), "cps");
            if (cps == null) {
                cps = dbl(pregen.getAsJsonObject("last"), "rate");
            }
        }
        if (cps == null || cps <= 0) {
            return null;
        }
        if (cps == Math.rint(cps)) {
            return String.format(Locale.US, "%.0f/s", cps);
        }
        return String.format(Locale.US, "%.1f/s", cps);
    }

    private static DimStats pickDim(JsonObject census) {
        JsonArray dims = census.has("dimensions") && census.get("dimensions").isJsonArray()
                ? census.getAsJsonArray("dimensions") : new JsonArray();
        DimStats best = new DimStats("minecraft:overworld", 0, 0);
        long bestScore = -1;
        for (JsonElement el : dims) {
            if (!el.isJsonObject()) {
                continue;
            }
            JsonObject d = el.getAsJsonObject();
            String id = str(d, "id");
            if (id.isBlank()) {
                id = "unknown";
            }
            long loaded = Math.round(dbl(d, "loaded_chunks", 0));
            long players = Math.round(dbl(d, "players", 0));
            long score = loaded + players * 1000;
            if (score > bestScore) {
                bestScore = score;
                best = new DimStats(id, loaded, players);
            }
        }
        return best;
    }

    private static long totalLoadedChunks(JsonObject census) {
        JsonArray dims = census.has("dimensions") && census.get("dimensions").isJsonArray()
                ? census.getAsJsonArray("dimensions") : new JsonArray();
        long sum = 0;
        for (JsonElement el : dims) {
            if (el.isJsonObject()) {
                sum += Math.round(dbl(el.getAsJsonObject(), "loaded_chunks", 0));
            }
        }
        return sum;
    }

    private static long totalPlayers(JsonObject census) {
        JsonArray dims = census.has("dimensions") && census.get("dimensions").isJsonArray()
                ? census.getAsJsonArray("dimensions") : new JsonArray();
        long sum = 0;
        for (JsonElement el : dims) {
            if (el.isJsonObject()) {
                sum += Math.round(dbl(el.getAsJsonObject(), "players", 0));
            }
        }
        return sum;
    }

    private static String formatMs(Double ms) {
        if (ms == null) {
            return "unknown";
        }
        return String.format(Locale.US, "%.0f ms", ms);
    }

    private static double round1(double v) {
        return Math.round(v * 10.0) / 10.0;
    }

    private static JsonObject obj(JsonObject o, String k) {
        if (o == null || !o.has(k) || !o.get(k).isJsonObject()) {
            return null;
        }
        return o.getAsJsonObject(k);
    }

    private static boolean bool(JsonObject o, String k) {
        if (o == null || !o.has(k) || o.get(k).isJsonNull()) {
            return false;
        }
        try {
            return o.get(k).getAsBoolean();
        } catch (Exception e) {
            return false;
        }
    }

    private static Double dbl(JsonObject o, String k) {
        if (o == null || !o.has(k) || o.get(k).isJsonNull()) {
            return null;
        }
        try {
            return o.get(k).getAsDouble();
        } catch (Exception e) {
            return null;
        }
    }

    private static double dbl(JsonObject o, String k, double def) {
        Double v = dbl(o, k);
        return v != null ? v : def;
    }

    private static String str(JsonObject o, String k) {
        if (o == null || !o.has(k) || o.get(k).isJsonNull()) {
            return "";
        }
        try {
            return o.get(k).getAsString();
        } catch (Exception e) {
            return "";
        }
    }

    private record PregenInfo(boolean active, String label, String rateLabel) {
    }

    private record DimStats(String id, long loaded, long players) {
    }
}
