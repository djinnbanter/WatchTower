package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.report.ReportConfig;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;

class LogScannerDbAddonTest {

    @Test
    void emitsDbAddonFailFromFixturePreferringAcl() throws Exception {
        Path server = Files.createTempDirectory("wt-db-addon");
        Path logs = Files.createDirectories(server.resolve("logs"));
        Path fixture = resolveFixture("samples/fixtures/log-intelligence/grieflogger-db-addon/excerpt.log");
        Files.copy(fixture, logs.resolve("latest.log"));

        ReportConfig config = ReportConfig.builder()
                .serverDir(server.toString())
                .lookbackHours(24 * 14)
                .build();
        JsonObject staging = new JsonObject();
        staging.add("minecraft", new JsonObject());
        staging.add("optional", new JsonObject());
        staging.add("events", new JsonArray());

        LogScanner.scanLogs(server.toString(), staging, config.windowStartEpoch(), config);

        JsonObject ev = findEvent(staging.getAsJsonArray("events"), "db_addon_fail");
        assertNotNull(ev, "staging/events must contain type=db_addon_fail");
        assertEquals("db_addon_acl", ev.get("kind").getAsString());
        assertEquals("grieflogger", ev.get("primary_mod").getAsString());
        assertTrue(ev.get("detail").getAsString().toLowerCase().contains("1130")
                || ev.get("detail").getAsString().toLowerCase().contains("acl")
                || ev.get("detail").getAsString().toLowerCase().contains("mariadb"));

        JsonObject optional = staging.getAsJsonObject("optional").getAsJsonObject("db_addon_fail");
        assertNotNull(optional);
        assertEquals("signal_db_addon_fail", optional.get("issue_id").getAsString());
        assertEquals("db_addon_acl", optional.get("kind").getAsString());
        assertEquals("grieflogger", optional.get("primary_mod").getAsString());
    }

    @Test
    void emitsGlraWhenOnlyConnectionFailPresent() throws Exception {
        Path server = Files.createTempDirectory("wt-db-addon-glra");
        Path logs = Files.createDirectories(server.resolve("logs"));
        String line = "[02Aug2026 15:33:08.653] [modloading-worker-0/ERROR] "
                + "[eu.pankraz01.glra.GriefloggerRollbackAddon/]: "
                + "[griefloggerrollbackaddon] Database connection failed for type MARIADB\n";
        Files.writeString(logs.resolve("latest.log"), line);

        ReportConfig config = ReportConfig.builder()
                .serverDir(server.toString())
                .lookbackHours(24)
                .build();
        JsonObject staging = new JsonObject();
        staging.add("minecraft", new JsonObject());
        staging.add("optional", new JsonObject());
        staging.add("events", new JsonArray());

        LogScanner.scanLogs(server.toString(), staging, config.windowStartEpoch(), config);

        JsonObject optional = staging.getAsJsonObject("optional").getAsJsonObject("db_addon_fail");
        assertNotNull(optional);
        assertEquals("db_addon_connection", optional.get("kind").getAsString());
        assertEquals("griefloggerrollbackaddon", optional.get("primary_mod").getAsString());
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
