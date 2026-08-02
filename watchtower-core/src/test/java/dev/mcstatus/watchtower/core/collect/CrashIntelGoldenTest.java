package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import dev.mcstatus.watchtower.core.analyze.CrashClassifier;
import dev.mcstatus.watchtower.core.analyze.CrashNarrator;
import dev.mcstatus.watchtower.core.analyze.IncidentChainBuilder;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Golden fixture parity for crash intelligence v2
 * ({@code samples/fixtures/crash-intelligence/expected.json}).
 */
class CrashIntelGoldenTest {

    private static final double TOTAL_SEC_EPS = 0.05;
    private static final Pattern TIME_LINE = Pattern.compile("^Time:\\s*(.+)$", Pattern.MULTILINE);

    @Test
    void crashIntelligenceFixturesMatchExpected() throws Exception {
        Path expectedPath = resolveFixture("expected.json");
        assertTrue(Files.isRegularFile(expectedPath), "missing fixture: " + expectedPath);

        JsonObject root = JsonParser.parseString(Files.readString(expectedPath, StandardCharsets.UTF_8))
                .getAsJsonObject();
        assertEquals("crash-intelligence-v1", root.get("schema").getAsString());

        JsonObject cases = root.getAsJsonObject("cases");
        Path dir = expectedPath.getParent();

        for (Map.Entry<String, JsonElement> entry : cases.entrySet()) {
            String name = entry.getKey();
            JsonObject caseObj = entry.getValue().getAsJsonObject();
            JsonObject want = caseObj.getAsJsonObject("expected");

            if (caseObj.has("files") && caseObj.get("files").isJsonArray()) {
                assertPairedCase(name, dir, caseObj.getAsJsonArray("files"), want);
                continue;
            }

            if (caseObj.has("file")) {
                String file = caseObj.get("file").getAsString();
                Path path = dir.resolve(file);
                assertTrue(Files.isRegularFile(path), "missing case file: " + path);
                String text = Files.readString(path, StandardCharsets.UTF_8);

                if (file.endsWith(".log") && want.has("fml_issues_length")) {
                    JsonArray issues = FmlIssueParser.parse(text);
                    assertEquals(want.get("fml_issues_length").getAsInt(), issues.size(),
                            name + " fml_issues_length");
                    continue;
                }

                if (file.endsWith(".log") && want.has("startup_profile")) {
                    List<String> lines = Files.readAllLines(path, StandardCharsets.UTF_8);
                    JsonObject profile = StartupProfileScanner.scan(lines);
                    JsonObject wantProfile = want.getAsJsonObject("startup_profile");
                    assertTrue(profile.has("total_sec"), name + " missing total_sec");
                    assertEquals(wantProfile.get("total_sec").getAsDouble(),
                            profile.get("total_sec").getAsDouble(), TOTAL_SEC_EPS,
                            name + " total_sec");
                    if (wantProfile.has("pride_blocking")) {
                        boolean foundPride = false;
                        for (JsonElement el : profile.getAsJsonArray("errors")) {
                            JsonObject err = el.getAsJsonObject();
                            if ("pride".equals(str(err, "mod_id"))) {
                                foundPride = true;
                                assertEquals(wantProfile.get("pride_blocking").getAsBoolean(),
                                        err.get("blocking").getAsBoolean(),
                                        name + " pride blocking");
                                break;
                            }
                        }
                        assertTrue(foundPride, name + " expected pride error in startup_profile.errors");
                    }
                    continue;
                }

                if (file.endsWith(".txt")) {
                    assertCrashCase(name, text, want);
                }
            }
        }
    }

    private static void assertPairedCase(String name, Path dir, JsonArray files, JsonObject want)
            throws Exception {
        assertTrue(files.size() >= 2, name + " paired case needs at least 2 files");
        JsonArray summaries = new JsonArray();
        for (JsonElement el : files) {
            String file = el.getAsString();
            Path path = dir.resolve(file);
            assertTrue(Files.isRegularFile(path), "missing paired file: " + path);
            String text = Files.readString(path, StandardCharsets.UTF_8);
            summaries.add(summaryRow(file, text));
        }

        IncidentChainBuilder.link(summaries);
        CrashNarrator.enrichAfterChain(summaries);

        JsonObject primary = summaries.get(0).getAsJsonObject();
        JsonObject follow = summaries.get(1).getAsJsonObject();

        if (want.has("same_incident_id") && want.get("same_incident_id").getAsBoolean()) {
            assertTrue(primary.has("incident_id"), name + " primary missing incident_id");
            assertTrue(follow.has("incident_id"), name + " follow-up missing incident_id");
            assertEquals(primary.get("incident_id").getAsString(),
                    follow.get("incident_id").getAsString(),
                    name + " same_incident_id");
        }
        if (want.has("followup_failure_kind")) {
            assertEquals(want.get("followup_failure_kind").getAsString(),
                    str(follow, "failure_kind"),
                    name + " followup_failure_kind");
        }
        if (want.has("followup_primary_mod_id")) {
            assertEquals(want.get("followup_primary_mod_id").getAsString(),
                    str(follow, "primary_mod_id"),
                    name + " followup_primary_mod_id");
        }
    }

    private static JsonObject summaryRow(String file, String text) {
        CrashReportParser.ParsedCrash parsed = CrashReportParser.parse(text, List.of());
        JsonObject report = new JsonObject();
        parsed.applyTo(report);
        CrashClassifier.Classification c = CrashClassifier.classify(report);

        JsonObject row = new JsonObject();
        row.addProperty("file", file);
        row.addProperty("time", extractTime(text));
        if (parsed.exception() != null) {
            row.addProperty("exception", parsed.exception());
        }
        if (parsed.description() != null) {
            row.addProperty("description", parsed.description());
        }
        if (parsed.summary() != null) {
            row.addProperty("summary", parsed.summary());
        }
        if (parsed.stackFrames() != null) {
            row.add("stack_frames", parsed.stackFrames());
        }
        row.addProperty("failure_kind", c.failureKind());
        row.addProperty("category", c.category());
        if (c.primaryModId() != null) {
            row.addProperty("primary_mod_id", c.primaryModId());
        } else if (c.suspectModId() != null) {
            row.addProperty("primary_mod_id", c.suspectModId());
        }
        if (c.suspectModId() != null) {
            row.addProperty("suspect_mod_id", c.suspectModId());
        }
        CrashNarrator.Narrative narrative = CrashNarrator.narrate(report, new JsonArray());
        CrashNarrator.enrichSummary(row, narrative);
        return row;
    }

    private static String extractTime(String text) {
        Matcher m = TIME_LINE.matcher(text);
        assertTrue(m.find(), "fixture missing Time: line");
        return m.group(1).trim().replace(' ', 'T');
    }

    private static void assertCrashCase(String name, String text, JsonObject want) {
        CrashReportParser.ParsedCrash parsed = CrashReportParser.parse(text, List.of());
        JsonObject report = new JsonObject();
        parsed.applyTo(report);
        CrashClassifier.Classification c = CrashClassifier.classify(report);

        if (want.has("failure_kind")) {
            assertEquals(want.get("failure_kind").getAsString(), c.failureKind(),
                    name + " failure_kind");
        }
        if (want.has("category")) {
            assertEquals(want.get("category").getAsString(), c.category(),
                    name + " category");
        }
        if (want.has("primary_mod_id")) {
            String expected = want.get("primary_mod_id").getAsString();
            String actual = c.primaryModId() != null ? c.primaryModId() : c.suspectModId();
            assertEquals(expected, actual, name + " primary_mod_id");
        }
        if (want.has("stall_mod_id")) {
            assertEquals(want.get("stall_mod_id").getAsString(), c.stallModId(),
                    name + " stall_mod_id");
        }
        if (want.has("watchdog_tick_ms")) {
            assertEquals(want.get("watchdog_tick_ms").getAsInt(), parsed.watchdogTickMs(),
                    name + " watchdog_tick_ms");
        }
    }

    private static String str(JsonObject o, String key) {
        if (o == null || !o.has(key) || o.get(key).isJsonNull()) {
            return null;
        }
        return o.get(key).getAsString();
    }

    private static Path resolveFixture(String name) {
        Path cwd = Path.of(System.getProperty("user.dir")).toAbsolutePath().normalize();
        Path[] candidates = {
                cwd.resolve("samples/fixtures/crash-intelligence").resolve(name),
                cwd.resolve("../samples/fixtures/crash-intelligence").resolve(name),
                cwd.resolve("../../samples/fixtures/crash-intelligence").resolve(name),
        };
        for (Path p : candidates) {
            if (Files.isRegularFile(p)) {
                return p.normalize();
            }
        }
        Path walked = walkUpToRepoRoot(cwd);
        if (walked != null) {
            return walked.resolve("samples/fixtures/crash-intelligence").resolve(name);
        }
        return candidates[0];
    }

    private static Path walkUpToRepoRoot(Path start) {
        Path cur = start;
        for (int i = 0; i < 8 && cur != null; i++) {
            if (Files.isDirectory(cur.resolve("samples/fixtures"))) {
                return cur;
            }
            cur = cur.getParent();
        }
        return null;
    }
}
