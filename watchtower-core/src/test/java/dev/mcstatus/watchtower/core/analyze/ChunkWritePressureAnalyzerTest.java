package dev.mcstatus.watchtower.core.analyze;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Locale;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ChunkWritePressureAnalyzerTest {

    @Test
    void pregenOutrunningDiskAfterSustained() throws Exception {
        JsonObject fixture = load("pregen-outrunning-disk.json");
        JsonObject signals = fixture.getAsJsonObject("signals");
        JsonObject block = emptyWpBlock();
        JsonObject prev = new JsonObject();
        for (int i = 0; i < 2; i++) {
            ChunkWritePressureAnalyzer.enrich(block, signals, prev, 50);
            prev = wrapWp(block);
            assertFalse(hasKind(block, ChunkWritePressureAnalyzer.KIND_PREGEN_DISK),
                    "scan " + (i + 1) + " should not emit yet");
        }
        ChunkWritePressureAnalyzer.enrich(block, signals, prev, 50);
        assertTrue(hasKind(block, ChunkWritePressureAnalyzer.KIND_PREGEN_DISK));
        assertTrue(block.has("meters"));
        assertTrue(block.getAsJsonObject("meters").get("pregen_active").getAsBoolean());
    }

    @Test
    void saveBacklogWithoutPregen() throws Exception {
        JsonObject fixture = load("chunk-save-backlog.json");
        JsonObject signals = fixture.getAsJsonObject("signals");
        JsonObject block = emptyWpBlock();
        JsonObject prev = new JsonObject();
        for (int i = 0; i < 2; i++) {
            ChunkWritePressureAnalyzer.enrich(block, signals, prev, 50);
            prev = wrapWp(block);
            assertFalse(hasKind(block, ChunkWritePressureAnalyzer.KIND_SAVE_BACKLOG));
        }
        ChunkWritePressureAnalyzer.enrich(block, signals, prev, 50);
        assertTrue(hasKind(block, ChunkWritePressureAnalyzer.KIND_SAVE_BACKLOG));
        assertFalse(hasKind(block, ChunkWritePressureAnalyzer.KIND_PREGEN_DISK));
    }

    @Test
    void heavyGenRequiresPlayersAndGrowth() throws Exception {
        JsonObject fixture = load("heavy-chunk-gen-players.json");
        JsonObject signals = fixture.getAsJsonObject("signals").deepCopy();
        long base = fixture.get("prev_loaded_chunks").getAsLong();
        JsonObject block = emptyWpBlock();
        JsonObject prev = new JsonObject();
        JsonObject prevWp = new JsonObject();
        JsonObject meters = new JsonObject();
        meters.addProperty("prev_loaded_chunks", base);
        prevWp.add("meters", meters);
        prev.add("world_pressure", prevWp);

        for (int i = 0; i < 2; i++) {
            long chunks = base + 50L * (i + 1);
            setLoadedChunks(signals, chunks);
            ChunkWritePressureAnalyzer.enrich(block, signals, prev, 50);
            prev = wrapWp(block);
            assertFalse(hasKind(block, ChunkWritePressureAnalyzer.KIND_HEAVY_GEN),
                    "scan " + (i + 1) + " should not emit yet");
        }
        setLoadedChunks(signals, base + 150);
        ChunkWritePressureAnalyzer.enrich(block, signals, prev, 50);
        assertTrue(hasKind(block, ChunkWritePressureAnalyzer.KIND_HEAVY_GEN));
        assertFalse(hasKind(block, ChunkWritePressureAnalyzer.KIND_SAVE_BACKLOG));
    }

    @Test
    void quietDoesNotEmitButFillsMeters() throws Exception {
        JsonObject fixture = load("chunk-write-quiet.json");
        JsonObject signals = fixture.getAsJsonObject("signals");
        JsonObject block = emptyWpBlock();
        JsonObject prev = new JsonObject();
        JsonObject prevWp = new JsonObject();
        JsonObject meters = new JsonObject();
        meters.addProperty("prev_loaded_chunks", fixture.get("prev_loaded_chunks").getAsLong());
        prevWp.add("meters", meters);
        prev.add("world_pressure", prevWp);

        for (int i = 0; i < 3; i++) {
            ChunkWritePressureAnalyzer.enrich(block, signals, prev, 50);
            prev = wrapWp(block);
        }
        assertFalse(hasKind(block, ChunkWritePressureAnalyzer.KIND_PREGEN_DISK));
        assertFalse(hasKind(block, ChunkWritePressureAnalyzer.KIND_SAVE_BACKLOG));
        assertFalse(hasKind(block, ChunkWritePressureAnalyzer.KIND_HEAVY_GEN));
        assertTrue(block.has("meters"));
        assertFalse(block.getAsJsonObject("meters").get("pregen_active").getAsBoolean());
    }

    @Test
    void neverBlamesModInCopy() throws Exception {
        JsonObject fixture = load("pregen-outrunning-disk.json");
        JsonObject signals = fixture.getAsJsonObject("signals");
        JsonObject block = emptyWpBlock();
        JsonObject prev = new JsonObject();
        for (int i = 0; i < 3; i++) {
            ChunkWritePressureAnalyzer.enrich(block, signals, prev, 50);
            prev = wrapWp(block);
        }
        JsonArray classifiers = block.getAsJsonArray("classifiers");
        for (JsonElement el : classifiers) {
            JsonObject c = el.getAsJsonObject();
            String blob = (str(c, "headline") + " " + str(c, "detail") + " " + c.get("next_steps"))
                    .toLowerCase(Locale.ROOT);
            assertFalse(blob.contains("create-"), "should not invent mod blame");
            assertFalse(blob.contains("modid:"), "should not invent mod blame");
        }
    }

    private static JsonObject emptyWpBlock() {
        JsonObject block = new JsonObject();
        block.add("classifiers", new JsonArray());
        block.add("streaks", new JsonObject());
        return block;
    }

    private static JsonObject wrapWp(JsonObject block) {
        JsonObject root = new JsonObject();
        root.add("world_pressure", block.deepCopy());
        return root;
    }

    private static boolean hasKind(JsonObject block, String kind) {
        if (!block.has("classifiers") || !block.get("classifiers").isJsonArray()) {
            return false;
        }
        for (JsonElement el : block.getAsJsonArray("classifiers")) {
            if (el.isJsonObject() && kind.equals(str(el.getAsJsonObject(), "kind"))) {
                return true;
            }
        }
        return false;
    }

    private static void setLoadedChunks(JsonObject signals, long chunks) {
        JsonObject census = signals.getAsJsonObject("census");
        JsonArray dims = census.getAsJsonArray("dimensions");
        dims.get(0).getAsJsonObject().addProperty("loaded_chunks", chunks);
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

    private static JsonObject load(String name) throws Exception {
        Path cwd = Path.of("").toAbsolutePath();
        for (Path p : new Path[] {
                cwd.resolve("samples/fixtures/world-pressure").resolve(name),
                cwd.resolve("../samples/fixtures/world-pressure").resolve(name),
                cwd.resolve("../../samples/fixtures/world-pressure").resolve(name)
        }) {
            if (Files.isRegularFile(p)) {
                return JsonParser.parseString(Files.readString(p)).getAsJsonObject();
            }
        }
        throw new IllegalStateException("missing fixture world-pressure/" + name);
    }
}
