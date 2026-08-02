package dev.mcstatus.watchtower.core.analyze;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.collect.CrashReportParser;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

import static org.junit.jupiter.api.Assertions.*;

class IncidentChainBuilderTest {

    private static final Pattern TIME_LINE = Pattern.compile("^Time:\\s*(.+)$", Pattern.MULTILINE);

    @Test
    void pairsCreateNpeWithWatchdogWithin120s() {
        JsonArray summaries = new JsonArray();

        JsonObject create = new JsonObject();
        create.addProperty("file", "crash-2026-06-03_15.00.00-server.txt");
        create.addProperty("time", "2026-06-03T15:00:00+01:00");
        create.addProperty("failure_kind", CrashClassifier.FK_MOD_RUNTIME);
        create.addProperty("category", "mod");
        create.addProperty("exception", "java.lang.NullPointerException: Cannot invoke \"Object.hashCode()\"");
        create.addProperty("primary_mod_id", "create");
        summaries.add(create);

        JsonObject watchdog = new JsonObject();
        watchdog.addProperty("file", "crash-2026-06-03_15.01.02-server.txt");
        watchdog.addProperty("time", "2026-06-03T15:01:02+01:00");
        watchdog.addProperty("failure_kind", CrashClassifier.FK_WATCHDOG);
        watchdog.addProperty("category", "watchdog");
        watchdog.addProperty("exception",
                "java.lang.Error: ServerHangWatchdog detected that a single server tick took 62.00 seconds");
        summaries.add(watchdog);

        IncidentChainBuilder.link(summaries);

        assertEquals(create.get("incident_id").getAsString(), watchdog.get("incident_id").getAsString());
        assertTrue(create.get("incident_id").getAsString().startsWith("inc-"));
        assertEquals(CrashClassifier.FK_WATCHDOG_FOLLOWUP, watchdog.get("failure_kind").getAsString());
        assertEquals(create.get("file").getAsString(), watchdog.get("paired_primary_file").getAsString());
    }

    @Test
    void followupInheritsPrimaryModId() {
        JsonArray summaries = new JsonArray();

        JsonObject create = new JsonObject();
        create.addProperty("file", "crash-2026-06-03_15.00.00-server.txt");
        create.addProperty("time", "2026-06-03T15:00:00+01:00");
        create.addProperty("failure_kind", CrashClassifier.FK_MOD_RUNTIME);
        create.addProperty("category", "mod");
        create.addProperty("exception", "java.lang.NullPointerException: Cannot invoke \"Object.hashCode()\"");
        create.addProperty("primary_mod_id", "create");
        summaries.add(create);

        JsonObject watchdog = new JsonObject();
        watchdog.addProperty("file", "crash-2026-06-03_15.01.02-server.txt");
        watchdog.addProperty("time", "2026-06-03T15:01:02+01:00");
        watchdog.addProperty("failure_kind", CrashClassifier.FK_WATCHDOG);
        watchdog.addProperty("category", "host_resource");
        watchdog.addProperty("exception",
                "java.lang.Error: ServerHangWatchdog detected that a single server tick took 62.00 seconds");
        watchdog.addProperty("primary_mod_id", "c2me_base");
        watchdog.addProperty("summary", "Watching Server — dump has no main tick thread");
        summaries.add(watchdog);

        IncidentChainBuilder.link(summaries);

        assertEquals("create", watchdog.get("primary_mod_id").getAsString());
        assertEquals("create", watchdog.get("suspect_mod_id").getAsString());
        assertEquals(CrashClassifier.FK_WATCHDOG_FOLLOWUP, watchdog.get("failure_kind").getAsString());
        assertTrue(watchdog.has("missing_server_thread")
                && watchdog.get("missing_server_thread").getAsBoolean());
    }

    @Test
    void opacWatchdogFollowupInheritsOpacPrimary() throws Exception {
        JsonObject primary = summaryFromFixture("opac-nsm-listener.txt");
        JsonObject follow = summaryFromFixture("watchdog-opac-followup-2043.txt");
        follow.addProperty("primary_mod_id", "c2me_base");

        JsonArray summaries = new JsonArray();
        summaries.add(primary);
        summaries.add(follow);

        IncidentChainBuilder.link(summaries);
        CrashNarrator.enrichAfterChain(summaries);

        assertEquals(CrashClassifier.FK_WATCHDOG_FOLLOWUP, follow.get("failure_kind").getAsString());
        assertEquals("opac_better_commands", follow.get("primary_mod_id").getAsString());
        assertEquals(primary.get("file").getAsString(), follow.get("paired_primary_file").getAsString());
        assertEquals(primary.get("incident_id").getAsString(), follow.get("incident_id").getAsString());
        String plain = follow.get("plain_english").getAsString().toLowerCase(Locale.ROOT);
        assertTrue(plain.contains("follow-up") || plain.contains("aftermath") || plain.contains("prior"));
        assertFalse(plain.contains("c2me"));
        String hints = follow.get("fix_hints").toString().toLowerCase(Locale.ROOT);
        assertTrue(hints.contains("paired") || hints.contains("prior") || hints.contains("first"));
        assertFalse(hints.contains("c2me"));
        assertTrue(follow.has("missing_server_thread")
                && follow.get("missing_server_thread").getAsBoolean());
    }

    @Test
    void sableWatchdogFollowupInheritsSablePrimary() throws Exception {
        JsonObject primary = summaryFromFixture("sable-body-removed-save.txt");
        JsonObject follow = summaryFromFixture("watchdog-sable-followup-2150.txt");
        follow.addProperty("primary_mod_id", "c2me_base");

        JsonArray summaries = new JsonArray();
        summaries.add(primary);
        summaries.add(follow);

        IncidentChainBuilder.link(summaries);
        CrashNarrator.enrichAfterChain(summaries);

        assertEquals(CrashClassifier.FK_WATCHDOG_FOLLOWUP, follow.get("failure_kind").getAsString());
        assertEquals("sable_rapier", follow.get("primary_mod_id").getAsString());
        assertEquals(primary.get("file").getAsString(), follow.get("paired_primary_file").getAsString());
        String plain = follow.get("plain_english").getAsString().toLowerCase(Locale.ROOT);
        assertTrue(plain.contains("sable") || plain.contains("follow-up") || plain.contains("prior"));
        assertFalse(plain.contains("c2me"));
        assertTrue(follow.has("missing_server_thread")
                && follow.get("missing_server_thread").getAsBoolean());
    }

    @Test
    void doesNotPairWhenOutside120sWindow() {
        JsonArray summaries = new JsonArray();

        JsonObject create = new JsonObject();
        create.addProperty("file", "crash-a.txt");
        create.addProperty("time", "2026-06-03T15:00:00+01:00");
        create.addProperty("failure_kind", CrashClassifier.FK_MOD_RUNTIME);
        create.addProperty("category", "mod");
        summaries.add(create);

        JsonObject watchdog = new JsonObject();
        watchdog.addProperty("file", "crash-b.txt");
        watchdog.addProperty("time", "2026-06-03T15:03:00+01:00");
        watchdog.addProperty("failure_kind", CrashClassifier.FK_WATCHDOG);
        watchdog.addProperty("exception", "java.lang.Error: ServerHangWatchdog");
        summaries.add(watchdog);

        IncidentChainBuilder.link(summaries);

        assertFalse(create.has("incident_id"));
        assertFalse(watchdog.has("incident_id"));
        assertEquals(CrashClassifier.FK_WATCHDOG, watchdog.get("failure_kind").getAsString());
    }

    private static JsonObject summaryFromFixture(String name) throws Exception {
        Path path = resolveCrashIntel(name);
        String text = Files.readString(path);
        CrashReportParser.ParsedCrash parsed = CrashReportParser.parse(text, List.of());
        JsonObject report = new JsonObject();
        parsed.applyTo(report);
        CrashClassifier.Classification c = CrashClassifier.classify(report);

        JsonObject row = new JsonObject();
        row.addProperty("file", name);
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
        return row;
    }

    private static String extractTime(String text) {
        Matcher m = TIME_LINE.matcher(text);
        if (!m.find()) {
            fail("fixture missing Time: line");
        }
        return m.group(1).trim().replace(' ', 'T');
    }

    private static Path resolveCrashIntel(String name) {
        Path p = Path.of("samples", "fixtures", "crash-intelligence", name);
        if (!Files.isRegularFile(p)) {
            p = Path.of("..", "samples", "fixtures", "crash-intelligence", name);
        }
        assertTrue(Files.isRegularFile(p), "missing fixture: " + name);
        return p;
    }
}
