package dev.mcstatus.watchtower.core.analyze;

import com.google.gson.JsonObject;
import org.junit.jupiter.api.Test;

import java.time.Instant;

import static org.junit.jupiter.api.Assertions.*;

class ModRestartNudgeTest {

    @Test
    void recordChangeAddsJar() {
        Instant t0 = Instant.parse("2026-08-01T12:00:00Z");
        JsonObject pending = ModRestartNudge.recordChange(null, "a.jar", t0);
        assertEquals(1, pending.getAsJsonArray("jars").size());
        assertEquals("a.jar", pending.getAsJsonArray("jars").get(0).getAsString());
        JsonObject meta = ModRestartNudge.toMeta(pending, true);
        assertTrue(meta.get("active").getAsBoolean());
    }

    @Test
    void clearWhenBootAfterSince() {
        Instant t0 = Instant.parse("2026-08-01T12:00:00Z");
        JsonObject pending = ModRestartNudge.recordChange(null, "a.jar", t0);
        long bootAfter = t0.getEpochSecond() + 60;
        JsonObject cleared = ModRestartNudge.maybeClear(pending, bootAfter);
        assertFalse(cleared.get("active").getAsBoolean());
    }

    @Test
    void keepWhenBootBeforeSince() {
        Instant t0 = Instant.parse("2026-08-01T12:00:00Z");
        JsonObject pending = ModRestartNudge.recordChange(null, "a.jar", t0);
        long bootBefore = t0.getEpochSecond() - 10;
        JsonObject still = ModRestartNudge.maybeClear(pending, bootBefore);
        assertTrue(still.get("active").getAsBoolean());
    }
}
