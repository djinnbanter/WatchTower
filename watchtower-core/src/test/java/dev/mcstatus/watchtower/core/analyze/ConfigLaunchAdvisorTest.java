package dev.mcstatus.watchtower.core.analyze;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.collect.ServerPropertiesReader;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;

class ConfigLaunchAdvisorTest {

    @TempDir
    Path temp;

    @Test
    void defaultFixtureIsMostlyFine() throws Exception {
        copyFixture("server-properties-default.properties");
        ServerPropertiesReader.Result props = ServerPropertiesReader.read(temp);
        JsonObject audit = ConfigLaunchAdvisor.build(props, null);
        assertEquals("ok", audit.get("status").getAsString());
        assertTrue(audit.get("read_only").getAsBoolean());
        JsonObject summary = audit.getAsJsonObject("summary");
        assertTrue(summary.get("consider").getAsInt() <= 1, "summary=" + summary);
        assertTrue(summary.get("fine").getAsInt() >= 4);
        assertEquals(ConfigLaunchAdvisor.VERDICT_FINE, verdictFor(audit, "view-distance"));
        assertEquals(ConfigLaunchAdvisor.VERDICT_FINE, verdictFor(audit, "max-tick-time"));
        assertEquals("6–10", recommendedFor(audit, "view-distance"));
        assertEquals("60000 or -1", recommendedFor(audit, "max-tick-time"));
    }

    @Test
    void hotFixtureRaisesConsiderVerdicts() throws Exception {
        copyFixture("server-properties-hot.properties");
        ServerPropertiesReader.Result props = ServerPropertiesReader.read(temp);
        JsonObject jvm = new JsonObject();
        jvm.addProperty("flags_profile", "g1_basic");
        jvm.addProperty("advice", "Worth adding missing flags.");
        JsonObject audit = ConfigLaunchAdvisor.build(props, jvm);
        assertEquals(ConfigLaunchAdvisor.VERDICT_CONSIDER_LOWERING, verdictFor(audit, "view-distance"));
        assertEquals(ConfigLaunchAdvisor.VERDICT_CONSIDER_LOWERING, verdictFor(audit, "simulation-distance"));
        assertEquals(ConfigLaunchAdvisor.VERDICT_CONSIDER_RAISING, verdictFor(audit, "max-tick-time"));
        assertEquals(ConfigLaunchAdvisor.VERDICT_CONSIDER_RAISING, verdictFor(audit, "network-compression-threshold"));
        assertEquals(ConfigLaunchAdvisor.VERDICT_CONSIDER_LOWERING, verdictFor(audit, "sync-chunk-writes"));
        assertTrue(audit.getAsJsonObject("summary").get("consider").getAsInt() >= 4);
        assertEquals("g1_basic", audit.getAsJsonObject("jvm").get("flags_profile").getAsString());
    }

    @Test
    void missingFileUnavailable() {
        JsonObject audit = ConfigLaunchAdvisor.build(ServerPropertiesReader.read(temp), null);
        assertEquals("unavailable", audit.get("status").getAsString());
        assertEquals(0, audit.getAsJsonArray("properties").size());
    }

    private void copyFixture(String name) throws Exception {
        Path src = Path.of("..", "samples", "fixtures", "config-audit", name);
        if (!Files.isRegularFile(src)) {
            src = Path.of("samples", "fixtures", "config-audit", name);
        }
        Files.copy(src.toAbsolutePath().normalize(), temp.resolve("server.properties"));
    }

    private static String verdictFor(JsonObject audit, String key) {
        return propertyField(audit, key, "verdict");
    }

    private static String recommendedFor(JsonObject audit, String key) {
        return propertyField(audit, key, "recommended");
    }

    private static String propertyField(JsonObject audit, String key, String field) {
        JsonArray rows = audit.getAsJsonArray("properties");
        for (int i = 0; i < rows.size(); i++) {
            JsonObject row = rows.get(i).getAsJsonObject();
            if (key.equals(row.get("key").getAsString())) {
                assertTrue(row.has(field), "missing " + field + " for " + key);
                return row.get(field).getAsString();
            }
        }
        fail("missing key " + key);
        return null;
    }
}
