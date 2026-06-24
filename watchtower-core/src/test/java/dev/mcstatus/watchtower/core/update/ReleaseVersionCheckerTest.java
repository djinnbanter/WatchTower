package dev.mcstatus.watchtower.core.update;

import com.google.gson.JsonObject;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class ReleaseVersionCheckerTest {

    @AfterEach
    void reset() {
        ReleaseVersionChecker.resetCacheForTests();
    }

    @Test
    void comparesLetterSuffixVersions() {
        assertTrue(ReleaseVersionChecker.compareWatchtowerVersions("1.0.1a", "1.0.1") > 0);
        assertTrue(ReleaseVersionChecker.compareWatchtowerVersions("1.0.2", "1.0.1a") > 0);
        assertEquals(0, ReleaseVersionChecker.compareWatchtowerVersions("1.0.1", "1.0.1"));
    }

    @Test
    void disabledCheckReturnsNoUpdate() {
        JsonObject out = ReleaseVersionChecker.check("1.0.1a", false);
        assertFalse(out.get("update_available").getAsBoolean());
        assertFalse(out.get("enabled").getAsBoolean());
    }

    @Test
    void usesCachedResultWhenSeeded() {
        JsonObject seeded = new JsonObject();
        seeded.addProperty("update_available", true);
        seeded.addProperty("latest_version", "9.9.9");
        seeded.addProperty("enabled", true);
        ReleaseVersionChecker.seedCacheForTests(seeded);
        JsonObject out = ReleaseVersionChecker.check("1.0.1a", true);
        assertTrue(out.get("update_available").getAsBoolean());
        assertEquals("9.9.9", out.get("latest_version").getAsString());
    }
}
