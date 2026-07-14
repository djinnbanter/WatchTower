package dev.mcstatus.watchtower.core.analyze;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import dev.mcstatus.watchtower.core.collect.JarClassIndex;
import dev.mcstatus.watchtower.core.collect.MixinConfigIndex;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.ZonedDateTime;

import static org.junit.jupiter.api.Assertions.*;

class CaParityClassifierTest {

    @Test
    void ca02_mixinConflict() throws Exception {
        String text = Files.readString(fixture("mixin-conflict-server.txt"));
        JsonArray mods = JsonParser.parseString(Files.readString(fixture("mixin-conflict-mods.json")))
                .getAsJsonObject().getAsJsonArray("mods");
        JsonObject crash = crashFrom(text, "MixinTransformerError");
        CrashClassifier.ClassifyContext ctx = ctx(mods, true);
        CrashClassifier.Classification c = CrashClassifier.classify(crash, ctx);
        assertEquals(CrashClassifier.FK_MOD_LOAD_MIXIN_CONFLICT, c.failureKind());
        assertEquals("examplemod", c.primaryModId());
        assertEquals("mixins.examplemod.json", c.details().get("mixin_config").getAsString());
        assertEquals("mixins.othermod.json", c.details().get("mixin_config_conflict").getAsString());
        assertEquals("othermod", c.details().get("conflict_mod_id").getAsString());
    }

    @Test
    void ca02_unresolvedSecondConfigUsesGenericHint() {
        JsonArray mods = new JsonArray();
        JsonObject only = new JsonObject();
        only.addProperty("id", "examplemod");
        JsonArray configs = new JsonArray();
        configs.add("mixins.examplemod.json");
        only.add("mixin_configs", configs);
        mods.add(only);
        JsonObject crash = new JsonObject();
        crash.addProperty("exception", "MixinTransformerError");
        crash.addProperty("description",
                "mixins.examplemod.json conflict. Skipping mixins.unknownmod.json @ com.example.Foo");
        CrashClassifier.Classification c = CrashClassifier.classify(crash, ctx(mods, true));
        assertEquals(CrashClassifier.FK_MOD_LOAD_MIXIN_CONFLICT, c.failureKind());
        assertEquals("examplemod", c.primaryModId());
        assertFalse(c.details().has("conflict_mod_id"),
                "unresolved second config must not invent conflict_mod_id");
        assertTrue(c.fixHints().size() > 0);
        String hintBlob = c.fixHints().toString().toLowerCase();
        assertFalse(hintBlob.contains("'unknownmod'"), "must not name unresolved second mod");
    }

    @Test
    void ca02_skipsVanillaNetMinecraft() {
        JsonObject crash = new JsonObject();
        crash.addProperty("exception", "mixin");
        crash.addProperty("description",
                "mixins.foo.json merged by net.minecraft.server.MinecraftServer previously written by net.minecraft");
        CrashClassifier.Classification c = CrashClassifier.classify(crash);
        assertNotEquals(CrashClassifier.FK_MOD_LOAD_MIXIN_CONFLICT, c.failureKind());
    }

    @Test
    void ca03_duplicateModsBootOnly() throws Exception {
        String text = Files.readString(fixture("duplicate-mods-boot.log"));
        JsonObject crash = crashFrom(text, "EarlyLoadingException: Duplicate mods found");
        CrashClassifier.Classification boot = CrashClassifier.classify(crash, ctx(new JsonArray(), true));
        assertEquals(CrashClassifier.FK_MOD_LOAD_DUPLICATE, boot.failureKind());
        assertTrue(boot.details().has("duplicate_mod_ids"));
        assertEquals("create", boot.details().getAsJsonArray("duplicate_mod_ids").get(0).getAsString());
        assertTrue(boot.details().has("duplicate_jars"));
        CrashClassifier.Classification runtime = CrashClassifier.classify(crash, ctx(new JsonArray(), false));
        assertNotEquals(CrashClassifier.FK_MOD_LOAD_DUPLICATE, runtime.failureKind());
    }

    @Test
    void ca03_bannerAloneDoesNotFire() {
        JsonObject crash = new JsonObject();
        crash.addProperty("exception", "Mod loading");
        crash.addProperty("description", "Found duplicate mods:\n\tMod ID: 'create' from mod files: [a.jar, b.jar]");
        assertNotEquals(CrashClassifier.FK_MOD_LOAD_DUPLICATE,
                CrashClassifier.classify(crash, ctx(new JsonArray(), true)).failureKind());
    }

    @Test
    void ca04_serverConfigCorrupt() throws Exception {
        String text = Files.readString(fixture("server-config-corrupt-server.txt"));
        JsonObject crash = crashFrom(text, "ConfigLoadingException");
        CrashClassifier.Classification c = CrashClassifier.classify(crash);
        assertEquals(CrashClassifier.FK_MOD_LOAD_CONFIG, c.failureKind());
        assertEquals("create", c.suspectModId());
        assertEquals("create-server.toml", c.details().get("config_file").getAsString());
        assertEquals("create-server.toml", c.details().get("config_path").getAsString());
    }

    @Test
    void ca04_clientConfigDoesNotFire() {
        JsonObject crash = new JsonObject();
        crash.addProperty("exception", "ConfigLoadingException");
        crash.addProperty("description",
                "ConfigLoadingException: Failed loading config file create-client.toml of type CLIENT for modid create\n"
                        + "ParsingException: Invalid TOML");
        assertNotEquals(CrashClassifier.FK_MOD_LOAD_CONFIG, CrashClassifier.classify(crash).failureKind());
    }

    @Test
    void ca05_invalidResourceLocation() throws Exception {
        String text = Files.readString(fixture("invalid-resource-location.txt"));
        JsonObject crash = crashFrom(text, "ResourceLocationException");
        CrashClassifier.Classification c = CrashClassifier.classify(crash);
        assertEquals(CrashClassifier.FK_MOD_LOAD_ASSET, c.failureKind());
        assertTrue(c.details().get("invalid_location").getAsString().contains("coolmod:"));
    }

    @Test
    void ca05_minecraftNamespaceNoPrimary() {
        JsonObject crash = new JsonObject();
        crash.addProperty("exception", "ResourceLocationException");
        crash.addProperty("description",
                "ResourceLocationException: Non [a-z0-9/._-] character in path of location: minecraft:Bad Name");
        CrashClassifier.Classification c = CrashClassifier.classify(crash);
        assertEquals(CrashClassifier.FK_MOD_LOAD_ASSET, c.failureKind());
        assertNull(c.primaryModId());
    }

    @Test
    void ca06_languageProviderBootOnly() throws Exception {
        String text = Files.readString(fixture("language-provider-mismatch.log"));
        JsonObject crash = crashFrom(text, "Mod File foo.jar needs language provider javafml");
        CrashClassifier.Classification boot = CrashClassifier.classify(crash, ctx(new JsonArray(), true));
        assertEquals(CrashClassifier.FK_MOD_LOAD_DEPENDENCY, boot.failureKind());
        assertEquals("javafml", boot.details().get("required_provider").getAsString());
        assertNotEquals(CrashClassifier.FK_MOD_LOAD_DEPENDENCY,
                CrashClassifier.classify(crash, ctx(new JsonArray(), false)).failureKind());
    }

    @Test
    void ca07_featureOrderCycle() throws Exception {
        String text = Files.readString(fixture("feature-order-cycle.txt"));
        JsonObject crash = crashFrom(text, "IllegalStateException: Feature order cycle found");
        assertEquals(CrashClassifier.FK_MOD_LOAD_WORLDGEN, CrashClassifier.classify(crash).failureKind());
    }

    @Test
    void ca08_ferriteNeighborTable() throws Exception {
        String text = Files.readString(fixture("ferrite-neighbor-table.txt"));
        JsonObject crash = crashFrom(text, "UnsupportedOperationException");
        CrashClassifier.Classification c = CrashClassifier.classify(crash);
        assertEquals(CrashClassifier.FK_MOD_LOAD_COMPAT, c.failureKind());
        assertEquals("ferritecore", c.primaryModId());
    }

    @Test
    void ca09_createMissingClassGated() throws Exception {
        String text = Files.readString(fixture("create6-missing-class.txt"));
        JsonObject crash = crashFrom(text, "NoClassDefFoundError");
        JsonArray withCreate = modsOf(mod("create", "6.0.4"));
        assertEquals(CrashClassifier.FK_MOD_LOAD_ECOSYSTEM,
                CrashClassifier.classify(crash, ctx(withCreate, false)).failureKind());
        assertNotEquals(CrashClassifier.FK_MOD_LOAD_ECOSYSTEM,
                CrashClassifier.classify(crash, ctx(new JsonArray(), false)).failureKind());
    }

    @Test
    void ca09_railwaysVersionMismatch() {
        JsonArray mods = modsOf(mod("create", "6.0.4"), mod("railways", "1.6.5"));
        JsonObject crash = new JsonObject();
        crash.addProperty("exception", "java.lang.RuntimeException: boot");
        crash.addProperty("summary", "Mod loading has failed");
        CrashClassifier.Classification c = CrashClassifier.classify(crash, ctx(mods, true));
        assertEquals(CrashClassifier.FK_MOD_LOAD_ECOSYSTEM, c.failureKind());
        assertEquals("create6", c.details().get("ecosystem").getAsString());
        assertEquals("railways", c.details().get("related_mod_id").getAsString());
    }

    @Test
    void ca09_createRailwaysFixture() throws Exception {
        String text = Files.readString(fixture("create6-railways-cnfe-server.txt"));
        JsonArray mods = JsonParser.parseString(Files.readString(fixture("create6-railways-mods.json")))
                .getAsJsonObject().getAsJsonArray("mods");
        JsonObject crash = crashFrom(text, "NoClassDefFoundError");
        CrashClassifier.Classification c = CrashClassifier.classify(crash, ctx(mods, true));
        assertEquals(CrashClassifier.FK_MOD_LOAD_ECOSYSTEM, c.failureKind());
        assertEquals("create6", c.details().get("ecosystem").getAsString());
    }

    @Test
    void ca09_excludesPonderWorld() {
        JsonArray mods = modsOf(mod("create", "6.0.4"));
        JsonObject crash = new JsonObject();
        crash.addProperty("exception",
                "java.lang.ClassNotFoundException: com.simibubi.create.foundation.ponder.PonderWorld");
        assertNotEquals(CrashClassifier.FK_MOD_LOAD_ECOSYSTEM,
                CrashClassifier.classify(crash, ctx(mods, false)).failureKind());
    }

    @Test
    void ca09_noCreateNoFire() throws Exception {
        String text = Files.readString(fixture("create6-missing-class.txt"));
        JsonObject crash = crashFrom(text, "NoClassDefFoundError");
        assertNotEquals(CrashClassifier.FK_MOD_LOAD_ECOSYSTEM,
                CrashClassifier.classify(crash, ctx(new JsonArray(), false)).failureKind());
    }

    @Test
    void ca10_epicFightGated() throws Exception {
        String text = Files.readString(fixture("epicfight-addon-cnfe-server.txt"));
        JsonObject crash = crashFrom(text, "ClassNotFoundException");
        assertNotEquals(CrashClassifier.FK_MOD_LOAD_ECOSYSTEM,
                CrashClassifier.classify(crash, ctx(new JsonArray(), false)).failureKind());
        CrashClassifier.Classification c = CrashClassifier.classify(crash, ctx(modsOf(mod("epicfight", "20.0")), false));
        assertEquals(CrashClassifier.FK_MOD_LOAD_ECOSYSTEM, c.failureKind());
        assertEquals("epicfight", c.details().get("ecosystem").getAsString());
    }

    @Test
    void ca10_azureLibGated() throws Exception {
        String text = Files.readString(fixture("azurelib-addon-cnfe-server.txt"));
        JsonObject crash = crashFrom(text, "NoClassDefFoundError");
        assertNotEquals(CrashClassifier.FK_MOD_LOAD_ECOSYSTEM,
                CrashClassifier.classify(crash, ctx(new JsonArray(), false)).failureKind());
        CrashClassifier.Classification c = CrashClassifier.classify(crash, ctx(modsOf(mod("azurelib", "2.0")), false));
        assertEquals(CrashClassifier.FK_MOD_LOAD_ECOSYSTEM, c.failureKind());
        assertEquals("azurelib", c.primaryModId());
    }

    @Test
    void ca12_kubejsGated() throws Exception {
        String text = Files.readString(fixture("kubejs-datapack.txt"));
        JsonObject crash = crashFrom(text, "IllegalStateException");
        assertNotEquals(CrashClassifier.FK_MOD_LOAD_SCRIPT,
                CrashClassifier.classify(crash, ctx(new JsonArray(), false)).failureKind());
        assertEquals(CrashClassifier.FK_MOD_LOAD_SCRIPT,
                CrashClassifier.classify(crash, ctx(modsOf(mod("kubejs", "2101.7")), false)).failureKind());
    }

    @Test
    void ca14_unsupportedClassVersion() throws Exception {
        String text = Files.readString(fixture("unsupported-class-version.txt"));
        JsonObject crash = crashFrom(text, "UnsupportedClassVersionError");
        CrashClassifier.Classification c = CrashClassifier.classify(crash);
        assertEquals(CrashClassifier.FK_PLATFORM_MISMATCH, c.failureKind());
        assertTrue(c.details().has("java_mismatch"));
        assertEquals(21, c.details().getAsJsonObject("java_mismatch").get("compiled_java").getAsInt());
        assertEquals(17, c.details().getAsJsonObject("java_mismatch").get("runtime_java").getAsInt());
    }

    @Test
    void ca14_ucveAttributesOwningJarWhenClassIndexPresent() throws Exception {
        Path tmp = Files.createTempDirectory("wt-ucve-index");
        try {
            Path mods = tmp.resolve("mods");
            Files.createDirectories(mods);
            Path jar = mods.resolve("luckperms-5.jar");
            try (java.util.jar.JarOutputStream jos = new java.util.jar.JarOutputStream(Files.newOutputStream(jar))) {
                jos.putNextEntry(new java.util.zip.ZipEntry("me/lucko/luckperms/common/plugin/AbstractLuckPermsPlugin.class"));
                jos.write(new byte[] {(byte) 0xCA, (byte) 0xFE, (byte) 0xBA, (byte) 0xBE});
                jos.closeEntry();
            }
            JsonArray modsJson = new JsonArray();
            JsonObject lp = new JsonObject();
            lp.addProperty("id", "luckperms");
            lp.addProperty("jar_file", "luckperms-5.jar");
            modsJson.add(lp);
            Path cache = tmp.resolve("watchtower").resolve("forensics-cache.json");
            Files.createDirectories(cache.getParent());
            JarClassIndex index = JarClassIndex.build(mods, modsJson, cache);

            JsonObject crash = new JsonObject();
            crash.addProperty("exception", "UnsupportedClassVersionError");
            crash.addProperty("description",
                    "java.lang.UnsupportedClassVersionError: me/lucko/luckperms/common/plugin/AbstractLuckPermsPlugin "
                            + "has been compiled by a more recent version of the Java Runtime "
                            + "(class file version 65.0), this version of the Java Runtime only "
                            + "recognizes class file versions up to 61.0");
            CrashClassifier.ClassifyContext classifyCtx =
                    new CrashClassifier.ClassifyContext(modsJson, MixinConfigIndex.empty(), false, index);
            CrashClassifier.Classification c = CrashClassifier.classify(crash, classifyCtx);
            assertEquals(CrashClassifier.FK_PLATFORM_MISMATCH, c.failureKind());
            assertEquals("luckperms", c.primaryModId());
            assertTrue(c.details().has("owning_jar"));
            assertTrue(c.details().get("owning_jar").getAsString().contains("luckperms"));
        } finally {
            try (var walk = Files.walk(tmp)) {
                walk.sorted(java.util.Comparator.reverseOrder()).forEach(p -> {
                    try {
                        Files.deleteIfExists(p);
                    } catch (Exception ignored) {
                    }
                });
            }
        }
    }

    @Test
    void ca14_vanillaNetMinecraftSuppressed() {
        JsonObject crash = new JsonObject();
        crash.addProperty("exception", "UnsupportedClassVersionError");
        crash.addProperty("description",
                "java.lang.UnsupportedClassVersionError: net/minecraft/server/MinecraftServer "
                        + "has been compiled by a more recent version of the Java Runtime "
                        + "(class file version 65.0), this version of the Java Runtime only "
                        + "recognizes class file versions up to 61.0");
        assertNotEquals(CrashClassifier.FK_PLATFORM_MISMATCH,
                CrashClassifier.classify(crash).failureKind(),
                "vanilla net.minecraft class version must not fire platform_mismatch");
    }

    @Test
    void ca15_envLock() throws Exception {
        String text = Files.readString(fixture("env-lock-windows.txt"));
        JsonObject crash = crashFrom(text, "FileSystemException");
        CrashClassifier.Classification c = CrashClassifier.classify(crash);
        assertEquals(CrashClassifier.FK_ENV_LOCK, c.failureKind());
        assertTrue(c.details().get("locked_path").getAsString().contains("create-server.toml"));
    }

    @Test
    void ca15_linuxFileSystemExceptionNoFire() {
        JsonObject crash = new JsonObject();
        crash.addProperty("exception", "FileSystemException");
        crash.addProperty("description",
                "java.nio.file.FileSystemException: /home/server/config/foo.toml: Operation not permitted");
        assertNotEquals(CrashClassifier.FK_ENV_LOCK, CrashClassifier.classify(crash).failureKind());
    }

    @Test
    void ca16_oomKeepsHostResourceKind() throws Exception {
        JsonObject heap = crashFrom(Files.readString(fixture("oom-heap.txt")), "OutOfMemoryError");
        CrashClassifier.Classification h = CrashClassifier.classify(heap);
        assertEquals(CrashClassifier.FK_HOST_RESOURCE, h.failureKind());
        assertEquals("heap", h.details().get("oom_kind").getAsString());

        JsonObject nativeOom = crashFrom(Files.readString(fixture("oom-native.txt")), "OutOfMemoryError");
        CrashClassifier.Classification n = CrashClassifier.classify(nativeOom);
        assertEquals(CrashClassifier.FK_HOST_RESOURCE, n.failureKind());
        assertEquals("native", n.details().get("oom_kind").getAsString());
    }

    @Test
    void ca16_memoryDiagnosticsEnrichedFromNativeOom() throws Exception {
        JsonObject staging = minimalStaging();
        JsonObject mc = staging.getAsJsonObject("minecraft");
        JsonArray crashes = new JsonArray();
        JsonObject crash = crashFrom(Files.readString(fixture("oom-native.txt")), "OutOfMemoryError");
        crash.addProperty("file", "hs_err_pid1.log");
        crash.addProperty("time", "2026-07-13T12:00:00+01:00");
        crashes.add(crash);
        mc.add("new_crash_reports", crashes);

        JsonObject facts = ReportPipeline.buildFacts(staging);
        JsonObject mem = facts.getAsJsonObject("optional").getAsJsonObject("memory_diagnostics");
        assertNotNull(mem);
        assertEquals("native", mem.get("oom_kind").getAsString());
        assertTrue(mem.get("page_file_disabled").getAsBoolean());
        assertEquals(8191, mem.get("physical_mb").getAsInt());
        assertTrue(mem.get("jvm_args").getAsString().contains("-Xmx8G"));
    }

    @Test
    void g05_watchdogBeatsConnectorAndOomTips() {
        JsonObject crash = new JsonObject();
        crash.addProperty("exception",
                "java.lang.Error: ServerHangWatchdog detected that a single server tick took 60.00 seconds");
        crash.addProperty("summary", "Watching Server OutOfMemoryError sodium iris connector");
        JsonArray mods = modsOf(mod("connector", "1.0"), mod("sodium", "0.5"), mod("create", "6.0.4"));
        CrashClassifier.Classification c = CrashClassifier.classify(crash, ctx(mods, false));
        assertEquals(CrashClassifier.FK_WATCHDOG, c.failureKind());
        JsonArray warnings = ConnectorHygieneScanner.scan(mods);
        assertFalse(warnings.isEmpty());
        // Hygiene is parallel optional — does not change crash kind
        assertEquals(CrashClassifier.FK_WATCHDOG, c.failureKind());
    }

    private static CrashClassifier.ClassifyContext ctx(JsonArray mods, boolean bootFailed) {
        return new CrashClassifier.ClassifyContext(mods, MixinConfigIndex.fromMods(mods), bootFailed);
    }

    private static JsonObject crashFrom(String text, String exception) {
        JsonObject crash = new JsonObject();
        crash.addProperty("exception", exception);
        crash.addProperty("description", text);
        crash.addProperty("summary", text.length() > 80 ? text.substring(0, 80) : text);
        return crash;
    }

    private static JsonArray modsOf(JsonObject... mods) {
        JsonArray arr = new JsonArray();
        for (JsonObject m : mods) {
            arr.add(m);
        }
        return arr;
    }

    private static JsonObject mod(String id, String version) {
        JsonObject o = new JsonObject();
        o.addProperty("id", id);
        o.addProperty("version", version);
        return o;
    }

    /** Minimal staging for FactsBuilder/ReportPipeline crash enrichment tests. */
    private static JsonObject minimalStaging() {
        JsonObject staging = new JsonObject();
        JsonObject meta = new JsonObject();
        meta.addProperty("lookback_hours", 24);
        meta.addProperty("incremental", false);
        meta.addProperty("panel", "crafty");
        meta.addProperty("loader", "neoforge");
        staging.add("meta", meta);
        JsonObject flags = new JsonObject();
        flags.addProperty("java_running", true);
        flags.addProperty("panel_running", true);
        staging.add("flags", flags);
        JsonObject thresholds = new JsonObject();
        thresholds.addProperty("disk_warn_pct", 85);
        thresholds.addProperty("mem_warn_avail_gb", 2);
        thresholds.addProperty("log_stale_minutes", 15);
        thresholds.addProperty("cant_keep_up_warn", 5);
        staging.add("thresholds", thresholds);
        JsonObject system = new JsonObject();
        system.addProperty("uptime_seconds", 5000);
        system.addProperty("mem_available_gb", 10);
        system.addProperty("disk_use_pct", 5);
        staging.add("system", system);
        staging.add("events", new JsonArray());
        JsonObject mc = new JsonObject();
        mc.addProperty("log_had_activity_in_window", true);
        mc.addProperty("last_log_time",
                ZonedDateTime.now().format(java.time.format.DateTimeFormatter.ISO_OFFSET_DATE_TIME));
        mc.addProperty("cant_keep_up_count", 0);
        mc.add("new_crash_reports", new JsonArray());
        mc.addProperty("oom_in_logs", false);
        mc.add("tick_lag_evidence", new JsonArray());
        mc.add("oom_evidence", new JsonArray());
        staging.add("minecraft", mc);
        staging.addProperty("health_log_gap_minutes", 1);
        staging.add("kernel_oom_evidence", new JsonArray());
        staging.add("optional", new JsonObject());
        return staging;
    }

    private static Path fixture(String name) {
        Path p = Path.of("..", "samples", "fixtures", "ca-parity", name);
        if (!Files.isRegularFile(p)) {
            p = Path.of("samples", "fixtures", "ca-parity", name);
        }
        return p;
    }
}
