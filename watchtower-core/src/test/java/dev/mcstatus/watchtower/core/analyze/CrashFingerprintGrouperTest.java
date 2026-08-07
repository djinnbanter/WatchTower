package dev.mcstatus.watchtower.core.analyze;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashSet;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;

class CrashFingerprintGrouperTest {

    @Test
    void groupsFixtureWithinCapAndCollapsesWatchdogs() throws Exception {
        JsonArray input = JsonParser.parseString(Files.readString(resolveFixture("grouped-input.json"), StandardCharsets.UTF_8))
                .getAsJsonArray();
        JsonObject expected = JsonParser.parseString(Files.readString(resolveFixture("grouped-expected.json"), StandardCharsets.UTF_8))
                .getAsJsonObject();

        JsonObject result = CrashFingerprintGrouper.group(input, new JsonObject());
        JsonArray groups = result.getAsJsonArray("groups");

        assertTrue(groups.size() <= 12, "groups.size()=" + groups.size());
        assertEquals(input.size(), result.get("count").getAsInt());
        assertEquals(expected.get("unreviewed_groups").getAsInt(), result.get("unreviewed_groups").getAsInt());
        assertEquals(input.size(), result.get("unreviewed").getAsInt());

        Set<String> fingerprints = new HashSet<>();
        int watchdogCount = 0;
        boolean sawCreate = false;
        for (JsonElement el : groups) {
            JsonObject g = el.getAsJsonObject();
            String fp = g.get("fingerprint").getAsString();
            assertTrue(fp.contains("|"), "fingerprint must contain |: " + fp);
            assertEquals(4, fp.split("\\|", -1).length, "fingerprint parts: " + fp);
            fingerprints.add(fp);
            if (fp.startsWith("watchdog|")) {
                watchdogCount = g.get("count").getAsInt();
            }
            if (fp.contains("|create|")) {
                sawCreate = true;
                assertEquals("Mod crash (create)", g.get("label").getAsString());
            }
        }

        assertTrue(watchdogCount >= 5, "identical watchdog rows should collapse");
        assertTrue(sawCreate, "create mod_runtime group should exist");
        assertTrue(fingerprints.contains("watchdog|-|java.lang.Error|-"));
        assertTrue(fingerprints.contains("watchdog_pregen|squaremap|java.lang.Error|squaremap"));
        assertTrue(fingerprints.contains("mod_runtime|create|java.lang.NullPointerException|create,neoforge"));
        assertTrue(fingerprints.contains("world_nbt_corrupt|-|java.io.EOFException|-"));

        for (JsonElement el : expected.getAsJsonArray("groups")) {
            String fp = el.getAsJsonObject().get("fingerprint").getAsString();
            assertTrue(fingerprints.contains(fp), "missing expected fingerprint: " + fp);
        }
    }

    @Test
    void memberJsonKeepsPairedPrimaryFile() {
        JsonArray input = new JsonArray();
        JsonObject row = new JsonObject();
        row.addProperty("file", "crash-wd.txt");
        row.addProperty("time", "2026-06-03T15:01:00+01:00");
        row.addProperty("failure_kind", CrashClassifier.FK_WATCHDOG_FOLLOWUP);
        row.addProperty("exception", "java.lang.Error: ServerHangWatchdog");
        row.addProperty("incident_id", "inc-crash-create.txt");
        row.addProperty("paired_primary_file", "crash-create.txt");
        row.addProperty("plain_english", "The main server thread stopped responding.");
        input.add(row);

        JsonObject result = CrashFingerprintGrouper.group(input, new JsonObject());
        JsonArray groups = result.getAsJsonArray("groups");
        assertFalse(groups.isEmpty());
        JsonObject member = groups.get(0).getAsJsonObject()
                .getAsJsonArray("members").get(0).getAsJsonObject();
        assertEquals("crash-create.txt", member.get("paired_primary_file").getAsString());
        assertEquals("inc-crash-create.txt", member.get("incident_id").getAsString());
    }

    @Test
    void ackKeysReduceUnreviewed() throws Exception {
        JsonArray input = JsonParser.parseString(Files.readString(resolveFixture("grouped-input.json"), StandardCharsets.UTF_8))
                .getAsJsonArray();
        JsonObject acks = new JsonObject();
        acks.add("crash-2026-06-01_10.00.00-server.txt", new JsonObject());
        acks.add("crash-reports/crash-2026-06-01_11.00.00-server.txt", new JsonObject());

        JsonObject result = CrashFingerprintGrouper.group(input, acks);
        assertEquals(input.size() - 2, result.get("unreviewed").getAsInt());

        JsonObject watchdogGroup = null;
        for (JsonElement el : result.getAsJsonArray("groups")) {
            JsonObject g = el.getAsJsonObject();
            if ("watchdog|-|java.lang.Error|-".equals(g.get("fingerprint").getAsString())) {
                watchdogGroup = g;
                break;
            }
        }
        assertNotNull(watchdogGroup);
        assertEquals(3, watchdogGroup.get("unreviewed").getAsInt());
    }

    private static Path resolveFixture(String name) {
        Path cwd = Path.of("").toAbsolutePath();
        Path[] candidates = {
                cwd.resolve("samples/fixtures/crash-inbox").resolve(name),
                cwd.resolve("../samples/fixtures/crash-inbox").resolve(name),
                cwd.resolve("../../samples/fixtures/crash-inbox").resolve(name),
        };
        for (Path p : candidates) {
            if (Files.isRegularFile(p)) {
                return p;
            }
        }
        Path walked = cwd;
        for (int i = 0; i < 6; i++) {
            if (Files.isDirectory(walked.resolve("samples/fixtures"))) {
                Path hit = walked.resolve("samples/fixtures/crash-inbox").resolve(name);
                if (Files.isRegularFile(hit)) {
                    return hit;
                }
            }
            walked = walked.getParent();
            if (walked == null) {
                break;
            }
        }
        throw new IllegalStateException("fixture not found: " + name + " (cwd=" + cwd + ")");
    }
}
