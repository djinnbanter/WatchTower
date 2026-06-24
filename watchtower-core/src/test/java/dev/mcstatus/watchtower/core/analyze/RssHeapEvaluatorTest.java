package dev.mcstatus.watchtower.core.analyze;

import com.google.gson.JsonObject;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class RssHeapEvaluatorTest {

    @Test
    void showsHintWhenRatioExceeded() {
        JsonObject out = RssHeapEvaluator.evaluate(12.0, 8.0, 1.25);
        assertTrue(out.get("show").getAsBoolean());
        assertTrue(out.has("message"));
    }

    @Test
    void hidesWhenWithinRatio() {
        JsonObject out = RssHeapEvaluator.evaluate(9.0, 8.0, 1.25);
        assertFalse(out.get("show").getAsBoolean());
    }

    @Test
    void hidesWhenMissingData() {
        JsonObject out = RssHeapEvaluator.evaluate(null, 8.0, 1.25);
        assertFalse(out.get("show").getAsBoolean());
    }
}
