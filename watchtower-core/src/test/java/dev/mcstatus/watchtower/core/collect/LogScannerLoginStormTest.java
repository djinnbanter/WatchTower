package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.report.ReportConfig;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;

class LogScannerLoginStormTest {

    @Test
    void emitsLoginStormWhenDisconnectsDwarfJoins() throws Exception {
        Path server = Files.createTempDirectory("wt-login-storm");
        Path logs = Files.createDirectories(server.resolve("logs"));
        Path fixture = resolveFixture("samples/fixtures/log-intelligence/login-storm-0729/excerpt.log");
        Files.copy(fixture, logs.resolve("latest.log"));

        // Jul 29 sample dates vs Aug 2 “today” — keep inside lookback.
        ReportConfig config = ReportConfig.builder()
                .serverDir(server.toString())
                .lookbackHours(24 * 14)
                .build();
        JsonObject staging = new JsonObject();
        staging.add("minecraft", new JsonObject());
        staging.add("optional", new JsonObject());
        staging.add("events", new JsonArray());

        LogScanner.scanLogs(server.toString(), staging, config.windowStartEpoch(), config);

        JsonObject storm = findEvent(staging.getAsJsonArray("events"), "login_storm");
        assertNotNull(storm, "staging/events must contain type=login_storm when login disconnects dwarf joins");
        assertTrue(storm.has("detail"), "login_storm should include a plain-English detail");
        String detail = storm.get("detail").getAsString().toLowerCase();
        assertTrue(detail.contains("login disconnect") || detail.contains("unjoinable"),
                "detail should frame joinability: " + detail);
        assertTrue(storm.has("evidence") && storm.get("evidence").isJsonArray()
                        && storm.getAsJsonArray("evidence").size() > 0,
                "login_storm should carry evidence sample lines");
        assertTrue(storm.get("importance").getAsInt() >= 7, "login_storm importance should be high");
    }

    @Test
    void doesNotEmitLoginStormWhenJoinsKeepPace() throws Exception {
        Path server = Files.createTempDirectory("wt-login-storm-ok");
        Path logs = Files.createDirectories(server.resolve("logs"));
        StringBuilder sb = new StringBuilder();
        // 5 login disconnects vs 5 joins — below absolute floor and ratio gate
        for (int i = 1; i <= 5; i++) {
            sb.append("[02Aug2026 12:0").append(i).append(":00.000] [Server thread/INFO] ")
                    .append("[net.minecraft.server.MinecraftServer/]: player").append(i)
                    .append(" joined the game\n");
            sb.append("[02Aug2026 12:1").append(i).append(":00.000] [Server thread/INFO] ")
                    .append("[net.minecraft.server.network.ServerLoginPacketListenerImpl/]: fail")
                    .append(i).append(" (/1.2.3.4:1234").append(i)
                    .append(") lost connection: Disconnected\n");
        }
        Files.writeString(logs.resolve("latest.log"), sb.toString());

        ReportConfig config = ReportConfig.builder()
                .serverDir(server.toString())
                .lookbackHours(24)
                .build();
        JsonObject staging = new JsonObject();
        staging.add("minecraft", new JsonObject());
        staging.add("optional", new JsonObject());
        staging.add("events", new JsonArray());

        LogScanner.scanLogs(server.toString(), staging, config.windowStartEpoch(), config);

        assertNull(findEvent(staging.getAsJsonArray("events"), "login_storm"),
                "healthy join ratio must not emit login_storm");
    }

    private static JsonObject findEvent(JsonArray events, String type) {
        if (events == null) {
            return null;
        }
        for (JsonElement el : events) {
            if (!el.isJsonObject()) {
                continue;
            }
            JsonObject ev = el.getAsJsonObject();
            if (type.equals(CollectSupport.getString(ev, "type"))) {
                return ev;
            }
        }
        return null;
    }

    private static Path resolveFixture(String relative) {
        Path path = Path.of(relative);
        if (Files.isRegularFile(path)) {
            return path;
        }
        path = Path.of("..").resolve(relative);
        if (Files.isRegularFile(path)) {
            return path;
        }
        path = Path.of("../..").resolve(relative);
        if (Files.isRegularFile(path)) {
            return path;
        }
        throw new IllegalStateException("fixture not found: " + relative);
    }
}
