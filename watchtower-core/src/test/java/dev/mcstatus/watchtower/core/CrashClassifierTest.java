package dev.mcstatus.watchtower.core;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import dev.mcstatus.watchtower.core.analyze.CrashClassifier;
import dev.mcstatus.watchtower.core.collect.CrashReportParser;
import dev.mcstatus.watchtower.core.collect.MixinConfigIndex;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Locale;

import static org.junit.jupiter.api.Assertions.*;

class CrashClassifierTest {

    @Test
    void classifiesModLoadingCrash() {
        JsonObject crash = new JsonObject();
        crash.addProperty("exception", "net.neoforged.neoforge.logging.CrashReportExtender");
        crash.addProperty("mod_file", "create-6.0.8.jar");
        crash.addProperty("summary", "Mod loading error has occurred");

        CrashClassifier.Classification c = CrashClassifier.classify(crash);
        assertEquals("mod", c.category());
        assertEquals("create", c.suspectModId());
        assertEquals(CrashClassifier.FK_MOD_LOAD_DEPENDENCY, c.failureKind());
        assertFalse(c.fixHints().isEmpty());
    }

    @Test
    void classifiesWatchdogAsHostResource() {
        JsonObject crash = new JsonObject();
        crash.addProperty("exception", "java.lang.Error: ServerHangWatchdog detected that a single server tick took 60.00 seconds");
        crash.addProperty("summary", "Watching Server");

        CrashClassifier.Classification c = CrashClassifier.classify(crash);
        assertEquals("host_resource", c.category());
        assertEquals(CrashClassifier.FK_WATCHDOG, c.failureKind());
        assertNull(c.suspectModId());
        assertTrue(c.fixHints().get(0).getAsString().toLowerCase().contains("hang")
                || c.fixHints().get(0).getAsString().toLowerCase().contains("thread"));
        assertTrue(c.fixHints().toString().toLowerCase().contains("dump")
                || c.fixHints().toString().toLowerCase().contains("thread"));
    }

    @Test
    void classifiesOomAsHostResource() {
        JsonObject crash = new JsonObject();
        crash.addProperty("exception", "java.lang.OutOfMemoryError: Java heap space");

        CrashClassifier.Classification c = CrashClassifier.classify(crash);
        assertEquals("host_resource", c.category());
        assertEquals(CrashClassifier.FK_HOST_RESOURCE, c.failureKind());
    }

    @Test
    void classifiesCreateNpeViaPrimaryModId() {
        JsonObject crash = new JsonObject();
        crash.addProperty("exception", "java.lang.NullPointerException: mf.axis is null");
        crash.addProperty("description", "Exception ticking world");
        crash.addProperty("primary_mod_id", "create");
        crash.addProperty("summary", "Exception ticking world");

        CrashClassifier.Classification c = CrashClassifier.classify(crash);
        assertEquals("mod", c.category());
        assertEquals(CrashClassifier.FK_MOD_RUNTIME, c.failureKind());
        assertEquals("create", c.primaryModId());
        assertEquals("create", c.suspectModId());
        assertEquals(CrashClassifier.CREATE_ISSUE_CONTRAPTION, c.details().get("create_issue").getAsString());
        assertTrue(c.details().has("exception_class"));
        String hints = c.fixHints().toString();
        assertTrue(hints.toLowerCase().contains("contraption") || hints.toLowerCase().contains("assembly")
                || hints.toLowerCase().contains("bearing") || hints.toLowerCase().contains("controller"),
                "contraption recovery should lead");
        assertFalse(hints.toLowerCase().contains("flywheel"),
                "contraption collision must not lead with Flywheel");
    }

    @Test
    void createRuntimeWithoutContraptionEvidenceStaysGeneric() {
        JsonObject crash = new JsonObject();
        crash.addProperty("exception",
                "java.lang.NullPointerException: Cannot invoke \"com.simibubi.create.content.kinetics.belt.BeltBlockEntity.getSpeed()\"");
        crash.addProperty("description", "Exception ticking world");
        crash.addProperty("primary_mod_id", "create");
        crash.addProperty("summary", "Exception ticking world");
        crash.addProperty("stack",
                "at TRANSFORMER/create@6.0.10/com.simibubi.create.content.kinetics.belt.BeltBlockEntity.tick(BeltBlockEntity.java:10)");

        CrashClassifier.Classification c = CrashClassifier.classify(crash);
        assertEquals(CrashClassifier.FK_MOD_RUNTIME, c.failureKind());
        assertEquals("create", c.primaryModId());
        assertFalse(c.details().has("create_issue"), "must not invent contraption_collision from mod id alone");
        String hints = c.fixHints().toString().toLowerCase();
        assertFalse(hints.contains("contraption"));
        assertFalse(hints.contains("flywheel"), "generic Create runtime must not invent Flywheel advice");
        assertTrue(hints.contains("create") || hints.contains("addon") || hints.contains("inspect"));
    }

    @Test
    void createNpeFixtureSetsContraptionIssue() throws Exception {
        Path fixture = Path.of("samples/fixtures/crash-intelligence/create-npe.txt");
        if (!Files.isRegularFile(fixture)) {
            fixture = Path.of("../samples/fixtures/crash-intelligence/create-npe.txt");
        }
        String text = Files.readString(fixture);
        JsonObject crash = new JsonObject();
        crash.addProperty("exception", "java.lang.NullPointerException: Cannot invoke \"com.simibubi.create.content.contraptions.ContraptionCollision.mf()\" because \"mf.axis\" is null");
        crash.addProperty("description", text);
        crash.addProperty("primary_mod_id", "create");
        CrashClassifier.Classification c = CrashClassifier.classify(crash);
        assertEquals(CrashClassifier.CREATE_ISSUE_CONTRAPTION, c.details().get("create_issue").getAsString());
        assertTrue(c.details().has("hot_frame"), "TRANSFORMER create frame should populate hot_frame");
        assertTrue(c.details().get("hot_frame").getAsString().contains("ContraptionCollision"));
    }

    @Test
    void classifiesNbtCorrupt() {
        JsonObject crash = new JsonObject();
        crash.addProperty("description", "Loading NBT data");
        crash.addProperty("exception", "java.io.EOFException: Unexpected end of ZLIB input stream");
        crash.addProperty("summary", "Loading NBT data");

        CrashClassifier.Classification c = CrashClassifier.classify(crash);
        assertEquals(CrashClassifier.FK_WORLD_NBT_CORRUPT, c.failureKind());
        assertEquals("host_resource", c.category());
    }

    @Test
    void classifiesWatchdogPregenStallMod() {
        JsonObject crash = new JsonObject();
        crash.addProperty("exception", "java.lang.Error: ServerHangWatchdog detected that a single server tick took 60.00 seconds");
        crash.addProperty("summary", "Watching Server");
        crash.addProperty("primary_mod_id", "squaremap");

        CrashClassifier.Classification c = CrashClassifier.classify(crash);
        assertEquals(CrashClassifier.FK_WATCHDOG_PREGEN, c.failureKind());
        assertEquals("squaremap", c.stallModId());
    }

    @Test
    void envLockLeadsWithStopProcessesNotReboot() {
        JsonObject crash = new JsonObject();
        crash.addProperty("exception",
                "java.nio.file.FileSystemException: world/session.lock: The process cannot access the file because it is being used by another process");
        crash.addProperty("description", "Exception in server tick loop");
        crash.addProperty("summary", "Exception in server tick loop");

        CrashClassifier.Classification c = CrashClassifier.classify(crash);
        assertEquals(CrashClassifier.FK_ENV_LOCK, c.failureKind());
        String hints = c.fixHints().toString().toLowerCase();
        assertTrue(hints.contains("stop") || hints.contains("close") || hints.contains("holding"));
        assertTrue(hints.contains("session.lock"));
        assertFalse(c.fixHints().get(0).getAsString().toLowerCase().contains("restart the machine"));
    }

    @Test
    void rejectsPlaceholderModFile() {
        assertNull(CrashClassifier.sanitizeModId("<No mod information provided>"));
        assertNull(CrashClassifier.sanitizeModId("java.lang.Error"));
    }

    @Test
    void classifiesMixinInitToCreate() throws Exception {
        Path fixture = resolveCaParity("mixin-config-init-server.txt");
        Path modsPath = resolveCaParity("mixin-config-init-mods.json");
        String text = Files.readString(fixture);
        JsonArray mods = JsonParser.parseString(Files.readString(modsPath)).getAsJsonObject()
                .getAsJsonArray("mods");
        JsonObject crash = new JsonObject();
        crash.addProperty("exception", "org.spongepowered.asm.mixin.throwables.MixinInitialisationError: Error initialising mixin config create.mixins.json");
        crash.addProperty("description", text);
        crash.addProperty("summary", "Mod loading has failed");
        CrashClassifier.ClassifyContext ctx = new CrashClassifier.ClassifyContext(
                mods, MixinConfigIndex.fromMods(mods), true);
        CrashClassifier.Classification c = CrashClassifier.classify(crash, ctx);
        assertEquals(CrashClassifier.FK_MOD_LOAD_MIXIN, c.failureKind());
        assertEquals("create", c.primaryModId());
        assertEquals("create", c.suspectModId());
        assertEquals("create.mixins.json", c.details().get("mixin_config").getAsString());
        assertEquals("java_asm_level", c.details().get("exception_detail").getAsString());
    }

    @Test
    void mixinMultiConfigLineDoesNotInventPrimary() {
        JsonObject crash = new JsonObject();
        crash.addProperty("exception", "mixin failed");
        crash.addProperty("description",
                "Caused by: org.spongepowered.asm.mixin.Mixin apply a.mixins.json and b.mixins.json");
        CrashClassifier.Classification c = CrashClassifier.classify(crash);
        assertNotEquals(CrashClassifier.FK_MOD_LOAD_MIXIN, c.failureKind());
    }

    @Test
    void mixinUnknownConfigStillSetsKind() {
        JsonObject crash = new JsonObject();
        crash.addProperty("exception",
                "org.spongepowered.asm.mixin.throwables.MixinInitialisationError: Error initialising mixin config mystery.mixins.json");
        CrashClassifier.Classification c = CrashClassifier.classify(crash);
        assertEquals(CrashClassifier.FK_MOD_LOAD_MIXIN, c.failureKind());
        assertNull(c.primaryModId());
        assertEquals("mystery.mixins.json", c.details().get("mixin_config").getAsString());
    }

    @Test
    void classifyLightWatchdogPregenFromHead() throws Exception {
        Path fixture = resolveCrashIntel("watchdog-squaremap-head.txt");
        String head = Files.readString(fixture);
        CrashClassifier.Classification c = CrashClassifier.classifyLight(head);
        assertEquals(CrashClassifier.FK_WATCHDOG_PREGEN, c.failureKind());
        assertEquals("squaremap", c.stallModId());
    }

    @Test
    void classifyLightFmlAlloyedModLoad() throws Exception {
        Path fixture = resolveCrashIntel("fml-alloyed-load.txt");
        String head = Files.readString(fixture);
        CrashClassifier.Classification c = CrashClassifier.classifyLight(head);
        assertEquals("mod", c.category());
        assertEquals(CrashClassifier.FK_MOD_LOAD_DEPENDENCY, c.failureKind());
        assertEquals("alloyed", c.primaryModId());
        assertEquals("alloyed", CrashClassifier.modLoadingIssueFor(head));
    }

    @Test
    void classifyLightWatchingServerDescription() {
        String head = """
                ---- Minecraft Crash Report ----
                Description: Watching Server
                java.lang.Error: ServerHangWatchdog detected that a single server tick took 60.00 seconds
                """;
        CrashClassifier.Classification c = CrashClassifier.classifyLight(head);
        assertEquals(CrashClassifier.FK_WATCHDOG, c.failureKind());
    }

    @Test
    void opacNoSuchMethodIsApiVersionMismatch() throws Exception {
        Path p = resolveCrashIntel("opac-nsm-command.txt");
        String text = Files.readString(p);
        var parsed = CrashReportParser.parse(text, List.of());
        JsonObject report = new JsonObject();
        parsed.applyTo(report);
        var c = CrashClassifier.classify(report);
        assertEquals(CrashClassifier.FK_API_VERSION_MISMATCH, c.failureKind());
        assertEquals("opac_better_commands", c.primaryModId());
        String hints = c.fixHints().toString().toLowerCase(Locale.ROOT);
        assertTrue(hints.contains("align") || hints.contains("version"),
                "hints should mention version alignment");
        assertTrue(hints.contains("opac") || hints.contains("openparties") || hints.contains("better commands"),
                "hints should name OPAC / Better Commands");
    }

    @Test
    void sparkProfilerInactiveOnStopIsShutdownNoise() throws Exception {
        Path p = resolveCrashIntel("spark-shutdown-profiler.txt");
        String text = Files.readString(p);
        var parsed = CrashReportParser.parse(text, List.of());
        JsonObject report = new JsonObject();
        parsed.applyTo(report);
        var c = CrashClassifier.classify(report);
        assertEquals(CrashClassifier.FK_SHUTDOWN_NOISE, c.failureKind());
        assertEquals("spark", c.primaryModId());
        String hints = c.fixHints().toString().toLowerCase(Locale.ROOT);
        assertTrue(hints.contains("shutdown") || hints.contains("stop"),
                "hints should mention stop/shutdown path");
        assertFalse(hints.contains("gameplay"), "must not frame as gameplay instability");
    }

    private static Path resolveCrashIntel(String name) {
        Path p = Path.of("..", "samples", "fixtures", "crash-intelligence", name);
        if (!Files.isRegularFile(p)) {
            p = Path.of("samples", "fixtures", "crash-intelligence", name);
        }
        return p;
    }

    private static Path resolveCaParity(String name) {
        Path p = Path.of("..", "samples", "fixtures", "ca-parity", name);
        if (!Files.isRegularFile(p)) {
            p = Path.of("samples", "fixtures", "ca-parity", name);
        }
        return p;
    }
}
