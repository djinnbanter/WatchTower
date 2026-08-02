package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.report.ReportConfig;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;

class LogScannerGlCreateNpeTest {

    @Test
    void emitsGlCreateNpeFromFixture() throws Exception {
        Path server = Files.createTempDirectory("wt-gl-create");
        Path logs = Files.createDirectories(server.resolve("logs"));
        Path fixture = resolveFixture(
                "samples/fixtures/log-intelligence/grieflogger-create-npe-0729/excerpt.log");
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

        JsonObject ev = findEvent(staging.getAsJsonArray("events"), "gl_create_npe");
        assertNotNull(ev, "staging/events must contain type=gl_create_npe");
        assertEquals("grieflogger_create_compat", ev.get("kind").getAsString());
        assertEquals("grieflogger", ev.get("primary_mod").getAsString());
        assertNotEquals("db_addon_acl", ev.get("kind").getAsString());

        JsonObject optional = staging.getAsJsonObject("optional").getAsJsonObject("gl_create_npe");
        assertNotNull(optional);
        assertEquals("signal_gl_create_npe", optional.get("issue_id").getAsString());
        assertEquals("grieflogger_create_compat", optional.get("kind").getAsString());
        assertNull(staging.getAsJsonObject("optional").get("db_addon_fail"),
                "Create NPE fixture must not emit db_addon_fail");
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
