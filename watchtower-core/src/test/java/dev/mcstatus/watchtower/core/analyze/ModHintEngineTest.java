package dev.mcstatus.watchtower.core.analyze;

import com.google.gson.JsonObject;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class ModHintEngineTest {

    @Test
    void kubeJsSampleReturnsFixSteps() {
        JsonObject bundle = ModHintEngine.buildHintBundle(
                "kubejs",
                "logger_error",
                "[KubeJS Server] ERROR syntax error in server_scripts/foo.js");
        assertTrue(bundle.has("fix_steps"));
        assertTrue(bundle.getAsJsonArray("fix_steps").size() >= 2);
        assertEquals("kubejs_script", bundle.get("tech_hint_id").getAsString());
    }
}
