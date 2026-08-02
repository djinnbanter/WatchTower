package dev.mcstatus.watchtower.core.ops;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import dev.mcstatus.watchtower.core.analyze.HangDumpAnalyzer;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class OpsCacheWriterSoftHangTest {

    @TempDir
    Path tmp;

    @Test
    void applySoftHangPersistsActivePeek() throws Exception {
        Path ops = tmp.resolve("ops-cache.json");
        Files.writeString(ops, "{}");
        JsonObject peek = new JsonObject();
        peek.addProperty(OpsCacheSchema.SOFT_HANG_ACTIVE, true);
        peek.addProperty(OpsCacheSchema.SOFT_HANG_PHASE, "ticking");
        peek.addProperty(OpsCacheSchema.SOFT_HANG_STALL_SECONDS, 48);
        OpsCacheWriter.applySoftHang(ops, peek);
        JsonObject cache = JsonParser.parseString(Files.readString(ops)).getAsJsonObject();
        assertTrue(cache.has(OpsCacheSchema.SOFT_HANG));
        JsonObject soft = cache.getAsJsonObject(OpsCacheSchema.SOFT_HANG);
        assertTrue(soft.get(OpsCacheSchema.SOFT_HANG_ACTIVE).getAsBoolean());
        assertEquals("ticking", soft.get(OpsCacheSchema.SOFT_HANG_PHASE).getAsString());
    }

    @Test
    void applySoftHangPersistsLikelyCauseFields() throws Exception {
        Path ops = tmp.resolve("ops-cache.json");
        Files.writeString(ops, "{}");
        JsonObject peek = new JsonObject();
        peek.addProperty(OpsCacheSchema.SOFT_HANG_ACTIVE, true);
        peek.addProperty(OpsCacheSchema.SOFT_HANG_PHASE, "ticking");
        peek.addProperty(OpsCacheSchema.SOFT_HANG_LIKELY_CAUSE, "entity_tick");
        peek.addProperty(OpsCacheSchema.SOFT_HANG_LIKELY_CAUSE_SUMMARY, "Looks stuck while ticking entities");
        peek.addProperty(OpsCacheSchema.SOFT_HANG_LIKELY_CAUSE_CONFIDENCE, "medium");
        peek.addProperty(OpsCacheSchema.SOFT_HANG_SUSPECT_MOD, "example");
        peek.addProperty(OpsCacheSchema.SOFT_HANG_SUSPECT_MOD_NOTE, HangDumpAnalyzer.NOTE_HINT);
        OpsCacheWriter.applySoftHang(ops, peek);
        JsonObject soft = JsonParser.parseString(Files.readString(ops)).getAsJsonObject()
                .getAsJsonObject(OpsCacheSchema.SOFT_HANG);
        assertEquals("entity_tick", soft.get(OpsCacheSchema.SOFT_HANG_LIKELY_CAUSE).getAsString());
        assertEquals("example", soft.get(OpsCacheSchema.SOFT_HANG_SUSPECT_MOD).getAsString());
        assertEquals(HangDumpAnalyzer.NOTE_HINT, soft.get(OpsCacheSchema.SOFT_HANG_SUSPECT_MOD_NOTE).getAsString());
    }
}
