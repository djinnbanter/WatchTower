package dev.mcstatus.watchtower.core.ops;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
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
}
