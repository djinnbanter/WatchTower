package dev.mcstatus.watchtower;

import dev.mcstatus.watchtower.core.collect.ModMutateJob;
import dev.mcstatus.watchtower.core.collect.ModrinthFileFetcher;
import dev.mcstatus.watchtower.runtime.OnlinePlayerView;
import dev.mcstatus.watchtower.runtime.ServerContext;
import dev.mcstatus.watchtower.runtime.WatchtowerSample;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.util.ArrayList;
import java.util.HexFormat;
import java.util.List;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ModMutateRunnerTest {

    @TempDir
    Path temp;

    @Test
    void swapWithInjectedBytesKeepsBasenameAndBacksUp() throws Exception {
        Path serverDir = temp.resolve("server");
        Path mods = serverDir.resolve("mods");
        Files.createDirectories(mods);
        Files.createDirectories(WatchtowerPaths.watchtowerRoot(serverDir));
        Files.writeString(mods.resolve("foo-1.0.jar"), "old-bytes");

        byte[] newBytes = "new-mod-bytes".getBytes(StandardCharsets.UTF_8);
        String sha512 = sha512Hex(newBytes);

        FakeServer server = new FakeServer(serverDir);
        WatchtowerRuntimeState state = new WatchtowerRuntimeState();
        ModMutateJob job = ModMutateJob.newSwap(
                "acc_1", "owner", "foo", "foo-1.0.jar",
                "proj", "ver_abc", sha512, "fp1");
        assertTrue(state.tryBeginMutate(job));

        String versionJson = """
                {
                  "version_number": "2.0",
                  "files": [{
                    "primary": true,
                    "url": "https://cdn.example/foo-2.0.jar",
                    "filename": "foo-2.0.jar",
                    "hashes": { "sha512": "%s" }
                  }]
                }
                """.formatted(sha512);

        ModMutateRunner.continueAfterBegin(
                server,
                state,
                job,
                new ModrinthFileFetcher(url -> newBytes),
                url -> versionJson).get(30, TimeUnit.SECONDS);

        assertEquals(ModMutateJob.STATE_DONE, job.state, job.error);
        assertEquals("new-mod-bytes", Files.readString(mods.resolve("foo-1.0.jar")));
        assertTrue(Files.exists(WatchtowerPaths.modBackupsDir(serverDir).resolve("index.json")));
        assertNotNull(job.backup_id);
        assertFalse(state.isMutateBusy());
        assertEquals(job.id, state.getMutateJob(job.id).id);
    }

    @Test
    void hashMismatchLeavesLiveJarUntouched() throws Exception {
        Path serverDir = temp.resolve("server2");
        Path mods = serverDir.resolve("mods");
        Files.createDirectories(mods);
        Files.createDirectories(WatchtowerPaths.watchtowerRoot(serverDir));
        Files.writeString(mods.resolve("foo-1.0.jar"), "old-bytes");

        byte[] newBytes = "new-mod-bytes".getBytes(StandardCharsets.UTF_8);
        String realSha = sha512Hex(newBytes);
        String wrongSha = sha512Hex("other".getBytes(StandardCharsets.UTF_8));

        FakeServer server = new FakeServer(serverDir);
        WatchtowerRuntimeState state = new WatchtowerRuntimeState();
        ModMutateJob job = ModMutateJob.newSwap(
                "acc_1", "owner", "foo", "foo-1.0.jar",
                "proj", "ver_abc", wrongSha, "fp1");
        assertTrue(state.tryBeginMutate(job));

        String versionJson = """
                {
                  "version_number": "2.0",
                  "files": [{
                    "primary": true,
                    "url": "https://cdn.example/foo-2.0.jar",
                    "filename": "foo-2.0.jar",
                    "hashes": { "sha512": "%s" }
                  }]
                }
                """.formatted(realSha);

        ModMutateRunner.continueAfterBegin(
                server,
                state,
                job,
                new ModrinthFileFetcher(url -> newBytes),
                url -> versionJson).get(30, TimeUnit.SECONDS);

        assertEquals(ModMutateJob.STATE_FAILED, job.state);
        assertEquals("hash_mismatch", job.error_code);
        assertEquals("old-bytes", Files.readString(mods.resolve("foo-1.0.jar")));
    }

    @Test
    void tryBeginMutateRejectsWhenBusy() {
        WatchtowerRuntimeState state = new WatchtowerRuntimeState();
        ModMutateJob first = ModMutateJob.newSwap("a", "a", "m", "j.jar", null, "v", null, "fp");
        ModMutateJob second = ModMutateJob.newSwap("b", "b", "m", "j.jar", null, "v", null, "fp");
        assertTrue(state.tryBeginMutate(first));
        assertTrue(state.isMutateBusy());
        assertFalse(state.tryBeginMutate(second));
        state.finishMutate(first.id);
        assertFalse(state.isMutateBusy());
        assertTrue(state.tryBeginMutate(second));
    }

    @Test
    void finishMutateIgnoresStaleJobId() {
        WatchtowerRuntimeState state = new WatchtowerRuntimeState();
        ModMutateJob first = ModMutateJob.newSwap("a", "a", "m", "j.jar", null, "v", null, "fp");
        ModMutateJob second = ModMutateJob.newSwap("b", "b", "m", "j.jar", null, "v", null, "fp");
        assertTrue(state.tryBeginMutate(first));
        first.transition(ModMutateJob.STATE_DONE);
        // Still busy until finishMutate for this job
        assertTrue(state.isMutateBusy());
        assertFalse(state.tryBeginMutate(second));
        state.finishMutate(first.id);
        assertFalse(state.isMutateBusy());
        assertTrue(state.tryBeginMutate(second));
        // Stale finish from first must not clear second
        state.finishMutate(first.id);
        assertTrue(state.isMutateBusy());
        assertEquals(second.id, state.getActiveMutateJob().id);
        state.finishMutate(second.id);
        assertFalse(state.isMutateBusy());
    }

    @Test
    void resolveLiveJarBasenameIgnoresHintThatBelongsToAnotherMod() throws Exception {
        Path serverDir = temp.resolve("server-hint");
        Path mods = serverDir.resolve("mods");
        Files.createDirectories(mods);
        // Wrong hint: jei jar while targeting create — must not return jei jar
        Files.writeString(mods.resolve("jei-1.0.jar"), "jei");
        Files.writeString(mods.resolve("create-1.0.jar"), "create");

        // Without metadata, basename prefix is the ownership signal
        String resolved = ModMutateRunner.resolveLiveJarBasename(
                serverDir, "create", "jei-1.0.jar");
        assertEquals("create-1.0.jar", resolved);
        assertFalse(ModMutateRunner.jarHintBelongsToMod(serverDir, "create", "jei-1.0.jar"));
        assertTrue(ModMutateRunner.jarHintBelongsToMod(serverDir, "create", "create-1.0.jar"));
    }

    @Test
    void resolveLiveJarBasenameAcceptsMatchingHint() throws Exception {
        Path serverDir = temp.resolve("server-hint-ok");
        Path mods = serverDir.resolve("mods");
        Files.createDirectories(mods);
        Files.writeString(mods.resolve("create-1.2.jar"), "create");

        String resolved = ModMutateRunner.resolveLiveJarBasename(
                serverDir, "create", "create-1.2.jar");
        assertEquals("create-1.2.jar", resolved);
    }

    @Test
    void resolveLiveJarBasenameAllowsHintWhenModIdBlank() throws Exception {
        Path serverDir = temp.resolve("server-hint-blank");
        Path mods = serverDir.resolve("mods");
        Files.createDirectories(mods);
        Files.writeString(mods.resolve("lonely-1.0.jar"), "x");

        String resolved = ModMutateRunner.resolveLiveJarBasename(
                serverDir, null, "lonely-1.0.jar");
        assertEquals("lonely-1.0.jar", resolved);
    }

    @Test
    void jarBasenameMatchesModIdIsPrefixNotSubstring() {
        assertTrue(ModMutateRunner.jarBasenameMatchesModId("create-1.0.jar", "create"));
        assertTrue(ModMutateRunner.jarBasenameMatchesModId("create.jar", "create"));
        assertFalse(ModMutateRunner.jarBasenameMatchesModId("somecreatemod-1.0.jar", "create"));
        assertFalse(ModMutateRunner.jarBasenameMatchesModId("createaddition-1.0.jar", "create"));
    }

    @Test
    void pickPrimaryFilePrefersPrimaryFlag() {
        var version = com.google.gson.JsonParser.parseString("""
                {
                  "version_number": "1.2",
                  "files": [
                    {"primary": false, "url": "https://a", "filename": "a.jar",
                     "hashes": {"sha512": "aa"}},
                    {"primary": true, "url": "https://b", "filename": "b.jar",
                     "hashes": {"sha512": "bb"}}
                  ]
                }
                """).getAsJsonObject();
        ModMutateRunner.PrimaryFile primary = ModMutateRunner.pickPrimaryFile(version);
        assertNotNull(primary);
        assertEquals("b.jar", primary.filename());
        assertEquals("bb", primary.sha512());
    }

    private static String sha512Hex(byte[] bytes) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-512");
        return HexFormat.of().formatHex(digest.digest(bytes));
    }

    static final class FakeServer implements ServerContext {
        final Path root;

        FakeServer(Path root) {
            this.root = root;
        }

        @Override
        public Path serverDirectory() {
            return root;
        }

        @Override
        public void execute(Runnable task) {
            task.run();
        }

        @Override
        public boolean runConsoleCommand(String command) {
            return false;
        }

        @Override
        public boolean isModLoaded(String modId) {
            return false;
        }

        @Override
        public int playerCount() {
            return 0;
        }

        @Override
        public String modId() {
            return "watchtower";
        }

        @Override
        public String modVersion() {
            return "test";
        }

        @Override
        public String minecraftVersion() {
            return "1.21.1";
        }

        @Override
        public Logger logger() {
            return LoggerFactory.getLogger("ModMutateRunnerTest");
        }

        @Override
        public WatchtowerSample.Sample collectSample() {
            return null;
        }

        @Override
        public WatchtowerSample.Sample collectSampleLight() {
            return null;
        }

        @Override
        public List<OnlinePlayerView> onlinePlayers() {
            return new ArrayList<>();
        }

        @Override
        public double smoothedMspt() {
            return 0;
        }

        @Override
        public WatchtowerSample.SessionMspt sessionMspt() {
            return new WatchtowerSample.SessionMspt(0, 0, 0, 0, java.time.Instant.EPOCH);
        }
    }
}
