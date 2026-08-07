package dev.mcstatus.watchtower.core.analyze;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class CrashNarratorTest {

    @Test
    void narratesWatchdogWithHighConfidence() {
        JsonObject crash = new JsonObject();
        crash.addProperty("exception",
                "java.lang.Error: ServerHangWatchdog detected that a single server tick took 60000.00 seconds");
        crash.addProperty("summary", "Watching Server");
        crash.addProperty("watchdog_tick_ms", 60000);

        CrashNarrator.Narrative n = CrashNarrator.narrate(crash, new JsonArray());
        assertEquals("high", n.confidence());
        assertFalse(n.manualReview());
        assertTrue(n.plainEnglish().contains("tick watchdog"));
        assertEquals("Server hung", n.likelyCause());
        String hints = n.fixHints().toString().toLowerCase();
        assertTrue(hints.contains("thread dump") || hints.contains("dump"),
                "watchdog advice should lead with thread dump");
    }

    @Test
    void narratesModLoadFailure() {
        JsonObject crash = new JsonObject();
        crash.addProperty("exception", "Mod loading has failed");
        crash.addProperty("mod_file", "sable-neoforge-1.21.1");
        crash.addProperty("failure_message", "Mod sable has failed to load");

        CrashNarrator.Narrative n = CrashNarrator.narrate(crash, new JsonArray());
        assertFalse(n.manualReview());
        assertTrue(n.plainEnglish().toLowerCase().contains("loading"));
        assertEquals("Mod failed to load", n.likelyCause());
    }

    @Test
    void narratesLanguageProviderDependency() throws Exception {
        java.nio.file.Path p = java.nio.file.Path.of("samples", "fixtures", "ca-parity",
                "language-provider-mismatch.log");
        if (!java.nio.file.Files.isRegularFile(p)) {
            p = java.nio.file.Path.of("..", "samples", "fixtures", "ca-parity",
                    "language-provider-mismatch.log");
        }
        String text = java.nio.file.Files.readString(p);
        JsonObject crash = new JsonObject();
        crash.addProperty("exception", "ModLoadingException");
        crash.addProperty("description", text);
        crash.addProperty("summary", text.length() > 80 ? text.substring(0, 80) : text);
        CrashClassifier.ClassifyContext ctx = new CrashClassifier.ClassifyContext(
                new JsonArray(), null, true);
        CrashNarrator.Narrative n = CrashNarrator.narrate(crash, new JsonArray(), ctx);
        assertFalse(n.manualReview());
        assertEquals("Mod failed to load", n.likelyCause());
        assertTrue(n.plainEnglish().toLowerCase().contains("language provider")
                || n.plainEnglish().toLowerCase().contains("dependency")
                || n.plainEnglish().toLowerCase().contains("loading"));
    }

    @Test
    void unknownCrashSetsManualReview() {
        JsonObject crash = new JsonObject();
        crash.addProperty("file", "crash-2026-06-16_test.txt");
        crash.addProperty("time", "2026-06-16T12:00:00+01:00");
        crash.addProperty("summary", "Something odd happened");

        CrashNarrator.Narrative n = CrashNarrator.narrate(crash, new JsonArray());
        assertTrue(n.manualReview());
        assertEquals("low", n.confidence());
        assertFalse(n.fixHints().isEmpty());
    }

    @Test
    void createContraptionEvidenceGetsCollisionNarrative() {
        JsonObject crash = new JsonObject();
        crash.addProperty("exception",
                "java.lang.NullPointerException: Cannot invoke \"com.simibubi.create.content.contraptions.ContraptionCollision.mf()\" because \"mf.axis\" is null");
        crash.addProperty("description", "Exception ticking world");
        crash.addProperty("primary_mod_id", "create");
        crash.addProperty("stack",
                "at TRANSFORMER/create@6.0.10/com.simibubi.create.content.contraptions.ContraptionCollision.tick(ContraptionCollision.java:42)");

        CrashNarrator.Narrative n = CrashNarrator.narrate(crash, new JsonArray());
        assertTrue(n.plainEnglish().toLowerCase().contains("contraption"));
        assertTrue(n.plainEnglish().toLowerCase().contains("assembly")
                || n.plainEnglish().toLowerCase().contains("stop"));
        assertFalse(n.plainEnglish().toLowerCase().contains("flywheel"));
        String hints = n.fixHints().toString().toLowerCase();
        assertTrue(hints.contains("contraption") || hints.contains("bearing") || hints.contains("assembly"));
        assertFalse(hints.contains("flywheel"));
    }

    @Test
    void createWithoutContraptionEvidenceDoesNotClaimCollision() {
        JsonObject crash = new JsonObject();
        crash.addProperty("exception",
                "java.lang.NullPointerException: Cannot invoke \"com.simibubi.create.content.kinetics.belt.BeltBlockEntity.getSpeed()\"");
        crash.addProperty("description", "Exception ticking world");
        crash.addProperty("primary_mod_id", "create");
        crash.addProperty("stack",
                "at TRANSFORMER/create@6.0.10/com.simibubi.create.content.kinetics.belt.BeltBlockEntity.tick(BeltBlockEntity.java:10)");

        CrashNarrator.Narrative n = CrashNarrator.narrate(crash, new JsonArray());
        assertFalse(n.plainEnglish().toLowerCase().contains("contraption"));
        assertTrue(n.plainEnglish().toLowerCase().contains("create crashed during play"));
        assertFalse(n.plainEnglish().toLowerCase().contains("flywheel"));
        assertFalse(n.fixHints().toString().toLowerCase().contains("contraption"));
        assertFalse(n.fixHints().toString().toLowerCase().contains("flywheel"));
    }

    @Test
    void nonBlankFailureAloneDoesNotForceModLoadNarrative() {
        JsonObject crash = new JsonObject();
        crash.addProperty("file", "crash-odd.txt");
        crash.addProperty("time", "2026-08-06T12:00:00+01:00");
        crash.addProperty("summary", "Something odd happened");
        crash.addProperty("failure_message", "See stack below");
        crash.addProperty("exception", "java.lang.IllegalStateException: odd");

        CrashNarrator.Narrative n = CrashNarrator.narrate(crash, new JsonArray());
        assertNotEquals("Mod failed to load", n.likelyCause(),
                "any non-blank failure_message must not force mod-load narration");
        assertFalse(n.plainEnglish().toLowerCase().contains("failed while loading"),
                "must not use mod-load plain English solely because failure_message is set");
    }

    @Test
    void realModLoadingExceptionStillNarratesModLoad() {
        JsonObject crash = new JsonObject();
        crash.addProperty("exception", "net.neoforged.fml.ModLoadingException: Mod foo failed");
        crash.addProperty("failure_message", "Mod foo failed to load");
        CrashNarrator.Narrative n = CrashNarrator.narrate(crash, new JsonArray());
        assertEquals("Mod failed to load", n.likelyCause());
    }

    @Test
    void watchdogFollowupDoesNotUsePregenTemplateEvenWithStallMod() {
        JsonObject crash = new JsonObject();
        crash.addProperty("exception",
                "java.lang.Error: ServerHangWatchdog detected that a single server tick took 60.00 seconds");
        crash.addProperty("failure_kind", CrashClassifier.FK_WATCHDOG_FOLLOWUP);
        crash.addProperty("stall_mod_id", "chunky");
        crash.addProperty("watchdog_tick_ms", 60000);
        crash.addProperty("paired_primary_file", "crash-create.txt");

        CrashNarrator.Narrative n = CrashNarrator.narrate(crash, new JsonArray());
        assertEquals("Server hung", n.likelyCause());
        assertFalse(n.plainEnglish().toLowerCase().contains("chunky pregen"),
                "follow-up must not claim Chunky pregen contention");
        assertTrue(n.plainEnglish().toLowerCase().contains("thread dump")
                        || n.plainEnglish().toLowerCase().contains("tick watchdog"),
                "follow-up should use generic watchdog narration");
    }

    @Test
    void watchdogPregenKindStillUsesPregenTemplate() {
        JsonObject crash = new JsonObject();
        crash.addProperty("exception",
                "java.lang.Error: ServerHangWatchdog detected that a single server tick took 60.00 seconds");
        crash.addProperty("failure_kind", CrashClassifier.FK_WATCHDOG_PREGEN);
        crash.addProperty("stall_mod_id", "chunky");
        crash.addProperty("watchdog_tick_ms", 60000);

        CrashNarrator.Narrative n = CrashNarrator.narrate(crash, new JsonArray());
        assertEquals("Tick hang / pregen contention", n.likelyCause());
        assertTrue(n.plainEnglish().toLowerCase().contains("pregen"));
    }
}
