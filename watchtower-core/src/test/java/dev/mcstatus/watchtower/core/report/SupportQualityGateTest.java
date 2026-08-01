package dev.mcstatus.watchtower.core.report;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class SupportQualityGateTest {

    @TempDir
    Path temp;

    private static SupportQualityGate.Check find(SupportQualityGate.Result r, String id) {
        return r.checks().stream().filter(c -> id.equals(c.id())).findFirst().orElseThrow();
    }

    @Test
    void missingSelectedLogIsWarnNotBlock() throws Exception {
        Path serverDir = temp.resolve("server");
        Files.createDirectories(serverDir);
        Path ops = temp.resolve("ops-cache.json");
        Files.writeString(ops, "{\"schema_version\":3}", StandardCharsets.UTF_8);

        JsonObject catalog = new JsonObject();
        catalog.add("logs", new JsonArray());
        catalog.add("crashes", new JsonArray());

        SupportComposeOptions options = SupportComposeOptions.quickDefaults().toBuilder()
                .logs(List.of(new SupportComposeOptions.LogSelection(
                        "latest.log", SupportComposeOptions.LogMode.TAIL, 500)))
                .build();

        SupportQualityGate.Result r = SupportQualityGate.evaluate(serverDir, ops, catalog, options);
        SupportQualityGate.Check c = find(r, "log_present");
        assertEquals(SupportQualityGate.Status.WARN, c.status());
        assertTrue(r.overrideAllowed());
        assertTrue(r.hasWarnings());
    }

    @Test
    void crashRelevantWithoutCrashWarns() throws Exception {
        Path serverDir = temp.resolve("server");
        Files.createDirectories(serverDir.resolve("logs"));
        Files.writeString(serverDir.resolve("logs/latest.log"), "line\n", StandardCharsets.UTF_8);
        Path ops = temp.resolve("ops-cache.json");
        Files.writeString(ops, """
                {"schema_version":3,"mods_light":{"mods":[{"id":"x"}]},"server":{"loader":"neoforge"}}
                """, StandardCharsets.UTF_8);

        JsonObject catalog = new JsonObject();
        JsonArray logs = new JsonArray();
        JsonObject log = new JsonObject();
        log.addProperty("name", "latest.log");
        log.addProperty("mtime", 1_700_000_000L);
        logs.add(log);
        catalog.add("logs", logs);
        JsonArray crashes = new JsonArray();
        JsonObject crash = new JsonObject();
        crash.addProperty("file", "crash-2026.txt");
        crash.addProperty("mtime", 1_700_000_100L);
        crashes.add(crash);
        catalog.add("crashes", crashes);

        SupportComposeOptions options = SupportComposeOptions.forPreset(SupportComposeOptions.Preset.SERVER_TRIAGE)
                .toBuilder()
                .category("server_lag")
                .crashFiles(List.of())
                .build();

        SupportQualityGate.Result r = SupportQualityGate.evaluate(serverDir, ops, catalog, options);
        assertEquals(SupportQualityGate.Status.WARN, find(r, "crash_if_relevant").status());
    }

    @Test
    void incidentWindowWarnsWhenLogOlderThanCrashBeyondGrace() throws Exception {
        Path serverDir = temp.resolve("server");
        Files.createDirectories(serverDir.resolve("logs"));
        Files.writeString(serverDir.resolve("logs/latest.log"), "line\n", StandardCharsets.UTF_8);
        Path ops = temp.resolve("ops-cache.json");
        Files.writeString(ops, """
                {"schema_version":3,"mods_light":{"mods":[{"id":"x"}]},"server":{"loader":"neoforge"}}
                """, StandardCharsets.UTF_8);

        long crashMtime = 1_700_000_000L;
        long logMtime = crashMtime - (3L * 60L * 60L);

        JsonObject catalog = new JsonObject();
        JsonArray logs = new JsonArray();
        JsonObject log = new JsonObject();
        log.addProperty("name", "latest.log");
        log.addProperty("mtime", logMtime);
        logs.add(log);
        catalog.add("logs", logs);
        JsonArray crashes = new JsonArray();
        JsonObject crash = new JsonObject();
        crash.addProperty("file", "crash-old.txt");
        crash.addProperty("mtime", crashMtime);
        crashes.add(crash);
        catalog.add("crashes", crashes);

        SupportComposeOptions options = SupportComposeOptions.forPreset(SupportComposeOptions.Preset.SERVER_TRIAGE)
                .toBuilder()
                .crashFiles(List.of("crash-old.txt"))
                .build();

        SupportQualityGate.Result r = SupportQualityGate.evaluate(serverDir, ops, catalog, options);
        assertEquals(SupportQualityGate.Status.WARN, find(r, "incident_window").status());
    }

    @Test
    void incidentWindowSkipsWhenNoCrashSelected() throws Exception {
        Path serverDir = temp.resolve("server");
        Files.createDirectories(serverDir.resolve("logs"));
        Files.writeString(serverDir.resolve("logs/latest.log"), "line\n", StandardCharsets.UTF_8);
        Path ops = temp.resolve("ops-cache.json");
        Files.writeString(ops, """
                {"schema_version":3,"mods_light":{"mods":[{"id":"x"}]},"server":{"loader":"neoforge"}}
                """, StandardCharsets.UTF_8);

        JsonObject catalog = new JsonObject();
        JsonArray logs = new JsonArray();
        JsonObject log = new JsonObject();
        log.addProperty("name", "latest.log");
        log.addProperty("mtime", 1_700_000_000L);
        logs.add(log);
        catalog.add("logs", logs);
        catalog.add("crashes", new JsonArray());

        SupportComposeOptions options = SupportComposeOptions.forPreset(SupportComposeOptions.Preset.QUICK)
                .toBuilder()
                .category("other")
                .crashFiles(List.of())
                .build();

        SupportQualityGate.Result r = SupportQualityGate.evaluate(serverDir, ops, catalog, options);
        assertEquals(SupportQualityGate.Status.SKIP, find(r, "incident_window").status());
    }

    @Test
    void hangDumpAlwaysSkipped() throws Exception {
        Path serverDir = temp.resolve("server");
        Files.createDirectories(serverDir);
        Path ops = temp.resolve("ops-cache.json");
        Files.writeString(ops, "{}", StandardCharsets.UTF_8);

        SupportQualityGate.Result r = SupportQualityGate.evaluate(
                serverDir, ops, new JsonObject(), SupportComposeOptions.quickDefaults());
        assertEquals(SupportQualityGate.Status.SKIP, find(r, "hang_dump").status());
    }

    @Test
    void secretsRedactedPassesWhenRedactorAvailable() throws Exception {
        Path serverDir = temp.resolve("server");
        Files.createDirectories(serverDir);
        Path ops = temp.resolve("ops-cache.json");
        Files.writeString(ops, "{}", StandardCharsets.UTF_8);

        SupportQualityGate.Result r = SupportQualityGate.evaluate(
                serverDir, ops, new JsonObject(), SupportComposeOptions.quickDefaults());
        assertEquals(SupportQualityGate.Status.PASS, find(r, "secrets_redacted").status());
    }

    @Test
    void allGreenWhenLogModsEnvPresent() throws Exception {
        Path serverDir = temp.resolve("server");
        Files.createDirectories(serverDir.resolve("logs"));
        Files.writeString(serverDir.resolve("logs/latest.log"), "ok\n", StandardCharsets.UTF_8);
        Path ops = temp.resolve("ops-cache.json");
        Files.writeString(ops, """
                {"schema_version":3,"mods_light":{"mods":[{"id":"jei"}]},"server":{"loader":"neoforge"}}
                """, StandardCharsets.UTF_8);

        JsonObject catalog = new JsonObject();
        JsonArray logs = new JsonArray();
        JsonObject log = new JsonObject();
        log.addProperty("name", "latest.log");
        log.addProperty("mtime", 1_700_000_000L);
        logs.add(log);
        catalog.add("logs", logs);
        catalog.add("crashes", new JsonArray());

        SupportComposeOptions options = SupportComposeOptions.forPreset(SupportComposeOptions.Preset.QUICK)
                .toBuilder()
                .category("other")
                .build();

        SupportQualityGate.Result r = SupportQualityGate.evaluate(serverDir, ops, catalog, options);
        assertEquals(0, r.summary().warn());
        assertFalse(r.hasWarnings());
    }
}
