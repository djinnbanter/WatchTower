package dev.mcstatus.watchtower.core.analyze;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class ServerPropertiesAdvisorTest {

    @Test
    void highCpuPrefersLoweringSimulationFirst() {
        JsonObject props = props(
                "view-distance", "12",
                "simulation-distance", "10",
                "sync-chunk-writes", "true");
        ServerPropertiesAdvisor.HostSignals host = new ServerPropertiesAdvisor.HostSignals(
                85, 50, 40, 0, 64, 4, 48, 16);
        JsonArray advice = ServerPropertiesAdvisor.advise(props, host);

        JsonObject view = row(advice, "view-distance");
        JsonObject sim = row(advice, "simulation-distance");
        assertNotNull(view);
        assertNotNull(sim);

        int recView = Integer.parseInt(view.get("recommended").getAsString());
        int recSim = Integer.parseInt(sim.get("recommended").getAsString());
        assertTrue(recSim <= recView, "sim=" + recSim + " view=" + recView);
        assertTrue(recSim < 10, "expected sim to drop under CPU pressure, got " + recSim);
        assertEquals(ServerPropertiesAdvisor.VERDICT_CONSIDER_LOWERING, sim.get("verdict").getAsString());
        assertTrue(drivers(sim).contains("cpu") || drivers(sim).contains("mspt"));
    }

    @Test
    void swapPressureCutsViewAggressively() {
        JsonObject props = props(
                "view-distance", "16",
                "simulation-distance", "8");
        ServerPropertiesAdvisor.HostSignals host = new ServerPropertiesAdvisor.HostSignals(
                40, 60, 70, 25, 32, 8, 30, 19);
        JsonArray advice = ServerPropertiesAdvisor.advise(props, host);
        JsonObject view = row(advice, "view-distance");
        assertNotNull(view);
        int recView = Integer.parseInt(view.get("recommended").getAsString());
        assertTrue(recView <= 8, "expected aggressive view cut under swap, got " + recView);
        assertTrue(drivers(view).contains("swap"));
        assertTrue(recView >= 4);
    }

    @Test
    void calmHighRamKeepsHealthyDistances() {
        JsonObject props = props(
                "view-distance", "8",
                "simulation-distance", "5",
                "sync-chunk-writes", "false",
                "max-tick-time", "60000");
        ServerPropertiesAdvisor.HostSignals host = new ServerPropertiesAdvisor.HostSignals(
                20, 40, 35, 0, 64, 2, 25, 20);
        JsonArray advice = ServerPropertiesAdvisor.advise(props, host);
        JsonObject view = row(advice, "view-distance");
        JsonObject sim = row(advice, "simulation-distance");
        assertNotNull(view);
        assertNotNull(sim);
        assertEquals("8", view.get("recommended").getAsString());
        assertEquals("5", sim.get("recommended").getAsString());
        assertEquals(ServerPropertiesAdvisor.VERDICT_FINE, view.get("verdict").getAsString());
        assertEquals(ServerPropertiesAdvisor.VERDICT_FINE, row(advice, "sync-chunk-writes").get("verdict").getAsString());
    }

    @Test
    void enforcesSimNotAboveView() {
        JsonObject props = props(
                "view-distance", "6",
                "simulation-distance", "10");
        ServerPropertiesAdvisor.HostSignals host = new ServerPropertiesAdvisor.HostSignals(
                10, 20, 20, 0, 32, 1, 20, 20);
        JsonArray advice = ServerPropertiesAdvisor.advise(props, host);
        int recView = Integer.parseInt(row(advice, "view-distance").get("recommended").getAsString());
        int recSim = Integer.parseInt(row(advice, "simulation-distance").get("recommended").getAsString());
        assertTrue(recSim <= recView);
    }

    @Test
    void advisesExpandedKeysAndFlagsSyncTrue() {
        JsonObject props = props(
                "view-distance", "10",
                "network-compression-threshold", "0",
                "max-tick-time", "20000",
                "use-native-transport", "false",
                "sync-chunk-writes", "true",
                "player-idle-timeout", "0",
                "max-chained-neighbor-updates", "1000000");
        JsonArray advice = ServerPropertiesAdvisor.advise(props, ServerPropertiesAdvisor.HostSignals.empty());
        assertNotNull(row(advice, "network-compression-threshold"));
        assertEquals("256", row(advice, "network-compression-threshold").get("recommended").getAsString());
        assertEquals(ServerPropertiesAdvisor.VERDICT_CONSIDER_LOWERING,
                row(advice, "sync-chunk-writes").get("verdict").getAsString());
        assertEquals("false", row(advice, "sync-chunk-writes").get("recommended").getAsString());
        assertEquals("30", row(advice, "player-idle-timeout").get("recommended").getAsString());
        assertEquals("100000", row(advice, "max-chained-neighbor-updates").get("recommended").getAsString());
        assertEquals("60000", row(advice, "max-tick-time").get("recommended").getAsString());
        assertEquals("true", row(advice, "use-native-transport").get("recommended").getAsString());
    }

    @Test
    void attachToProfileWritesSettingsAdvice() {
        JsonObject profile = new JsonObject();
        JsonObject capture = new JsonObject();
        JsonObject selected = props(
                "view-distance", "20",
                "simulation-distance", "10",
                "sync-chunk-writes", "true");
        capture.add("selected_server_properties", selected);
        profile.add("capture", capture);

        JsonObject context = new JsonObject();
        context.addProperty("players", 12);
        JsonObject heap = new JsonObject();
        heap.addProperty("used_mb", 12000);
        heap.addProperty("max_mb", 16000);
        context.add("jvm_heap", heap);
        context.addProperty("mspt_p95_1m", 55);
        profile.add("context", context);

        JsonObject system = new JsonObject();
        JsonObject cpu = new JsonObject();
        cpu.addProperty("usage_unit", "percent");
        cpu.addProperty("process_1m", 78);
        system.add("cpu", cpu);
        JsonObject memory = new JsonObject();
        memory.addProperty("physical_used_gb", 90);
        memory.addProperty("physical_total_gb", 120);
        system.add("memory", memory);
        profile.add("system", system);

        ServerPropertiesAdvisor.attachToProfile(profile);
        assertTrue(profile.has("settings_advice"));
        assertTrue(profile.getAsJsonArray("settings_advice").size() >= 3);
    }

    private static JsonObject props(String... kv) {
        JsonObject o = new JsonObject();
        for (int i = 0; i + 1 < kv.length; i += 2) {
            o.addProperty(kv[i], kv[i + 1]);
        }
        return o;
    }

    private static JsonObject row(JsonArray advice, String key) {
        for (int i = 0; i < advice.size(); i++) {
            JsonObject row = advice.get(i).getAsJsonObject();
            if (key.equals(row.get("key").getAsString())) {
                return row;
            }
        }
        return null;
    }

    private static java.util.List<String> drivers(JsonObject row) {
        java.util.List<String> out = new java.util.ArrayList<>();
        if (row.has("drivers") && row.get("drivers").isJsonArray()) {
            JsonArray arr = row.getAsJsonArray("drivers");
            for (int i = 0; i < arr.size(); i++) {
                out.add(arr.get(i).getAsString());
            }
        }
        return out;
    }
}
