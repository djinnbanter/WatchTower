package dev.mcstatus.watchtower.core.analyze;

import com.google.gson.JsonObject;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class DiskJumpEvaluatorTest {

    @Test
    void detectsPctJump() {
        JsonObject baseline = new JsonObject();
        baseline.addProperty("disk_use_pct", 40.0);
        baseline.addProperty("disk_free_gb", 100.0);
        JsonObject current = new JsonObject();
        current.addProperty("disk_use_pct", 48.0);
        current.addProperty("disk_free_gb", 92.0);
        JsonObject result = DiskJumpEvaluator.evaluate(current, baseline, 5.0, 10.0);
        assertTrue(result.get("active").getAsBoolean());
        assertTrue(result.get("message").getAsString().contains("8.0%"));
    }

    @Test
    void noJumpBelowThreshold() {
        JsonObject baseline = new JsonObject();
        baseline.addProperty("disk_use_pct", 40.0);
        JsonObject current = new JsonObject();
        current.addProperty("disk_use_pct", 42.0);
        JsonObject result = DiskJumpEvaluator.evaluate(current, baseline, 5.0, 10.0);
        assertFalse(result.get("active").getAsBoolean());
    }
}
