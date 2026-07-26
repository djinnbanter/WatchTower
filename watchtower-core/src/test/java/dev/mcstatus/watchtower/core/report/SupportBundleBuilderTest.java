package dev.mcstatus.watchtower.core.report;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Enumeration;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class SupportComposeOptionsTest {

    @Test
    void quickDefaultsRoundTrip() {
        SupportComposeOptions opts = SupportComposeOptions.quickDefaults();
        SupportComposeOptions again = SupportComposeOptions.fromJson(opts.toJson());
        assertEquals(SupportComposeOptions.Preset.QUICK, again.preset());
        assertTrue(again.includeLatestLogTail());
        assertTrue(again.includeSpark());
        assertEquals(500, again.logTailLines());
    }

    @Test
    void presetServerTriageIncludesCrashes() {
        SupportComposeOptions opts = SupportComposeOptions.forPreset(SupportComposeOptions.Preset.SERVER_TRIAGE);
        assertTrue(opts.includeCrashes());
        assertEquals(3, opts.crashLastN());
        assertTrue(opts.includeSpark());
    }
}

class SupportRedactorTest {

    @Test
    void redactsSecretsAndIps() {
        String conf = "DISCORD_WEBHOOK=https://discord.com/api/webhooks/abc\nHOST=1.2.3.4\n";
        String out = SupportRedactor.redactConfOrToml(conf);
        assertTrue(out.contains("[REDACTED]"));
        assertFalse(out.contains("webhooks/abc"));
        assertTrue(out.contains("[IP_REDACTED]"));
        assertFalse(out.contains("1.2.3.4"));
    }

    @Test
    void redactsUuidInLogs() {
        String line = "Player aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee joined from 10.0.0.5";
        String out = SupportRedactor.redactLine(line);
        assertTrue(out.contains("[UUID_REDACTED]"));
        assertTrue(out.contains("[IP_REDACTED]"));
    }
}

class SupportComposerV4Test {

    @TempDir
    Path temp;

    @Test
    void composeWritesV4ManifestEnvironmentAndRecipe() throws Exception {
        Path serverDir = temp.resolve("server");
        Path watchtower = serverDir.resolve("watchtower");
        Files.createDirectories(watchtower);
        Files.writeString(watchtower.resolve("ops-cache.json"), """
                {
                  "schema_version": 3,
                  "activity": { "events": [] },
                  "issues_live": [],
                  "crashes": { "entries": [], "unreviewed": 0 }
                }
                """, StandardCharsets.UTF_8);
        Files.writeString(watchtower.resolve("performance-rollups.json"), "{}", StandardCharsets.UTF_8);
        Files.createDirectories(serverDir.resolve("logs"));
        StringBuilder big = new StringBuilder();
        for (int i = 0; i < 2000; i++) {
            big.append("line-").append(i).append(" secret_token=should-redact ip=8.8.8.8\n");
        }
        Files.writeString(serverDir.resolve("logs/latest.log"), big.toString(), StandardCharsets.UTF_8);

        SupportComposer.ComposeResult result = SupportComposer.compose(new SupportComposer.ComposeRequest(
                watchtower,
                serverDir,
                watchtower.resolve("ops-cache.json"),
                watchtower.resolve("performance-rollups.json"),
                "test-host",
                "neoforge",
                "none",
                true,
                15,
                SupportComposeOptions.quickDefaults(),
                new SupportEnvironmentBuilder.Context("1.2.0", "1.21.1", "neoforge", null,
                        "test-host", "none", true, "Linux", "amd64"),
                null,
                "1.2.0",
                "1.21.1"));

        assertTrue(Files.isRegularFile(result.zipPath()));
        try (ZipFile zip = new ZipFile(result.zipPath().toFile())) {
            assertNotNullEntry(zip, "manifest.json");
            assertNotNullEntry(zip, "builder-options.json");
            assertNotNullEntry(zip, "environment.json");
            assertNotNullEntry(zip, "README.txt");
            String manifest = readEntry(zip, "manifest.json");
            JsonObject m = JsonParser.parseString(manifest).getAsJsonObject();
            assertEquals(4, m.get("bundle_version").getAsInt());
            assertTrue(m.get("redaction").getAsBoolean());
            String env = readEntry(zip, "environment.json");
            assertTrue(env.contains("\"mod_version\""));
            String logs = findLogTail(zip);
            assertTrue(logs != null);
            assertFalse(logs.contains("8.8.8.8"));
            assertTrue(logs.contains("[IP_REDACTED]") || logs.contains("[REDACTED]"));
        }
    }

    @Test
    void hugeLogTailDoesNotLoadEntireFileAsList() throws Exception {
        Path serverDir = temp.resolve("server2");
        Path watchtower = serverDir.resolve("watchtower");
        Files.createDirectories(watchtower.resolve("logs").getParent());
        Files.createDirectories(serverDir.resolve("logs"));
        Files.writeString(watchtower.resolve("ops-cache.json"), "{\"issues_live\":[]}", StandardCharsets.UTF_8);
        // 50k lines — ring buffer should only keep tail
        Path log = serverDir.resolve("logs/latest.log");
        StringBuilder sb = new StringBuilder(50_000 * 20);
        for (int i = 0; i < 50_000; i++) {
            sb.append("L").append(i).append('\n');
        }
        Files.writeString(log, sb.toString(), StandardCharsets.UTF_8);
        String tail = SupportEvidenceCollector.tailLines(log, 500);
        assertTrue(tail.contains("L49999"));
        assertFalse(tail.contains("L0\n"));
        assertTrue(tail.lines().count() <= 501);
    }

    @Test
    void catalogListsLogs() throws Exception {
        Path serverDir = temp.resolve("server3");
        Files.createDirectories(serverDir.resolve("logs"));
        Files.writeString(serverDir.resolve("logs/latest.log"), "x\n", StandardCharsets.UTF_8);
        Path wt = serverDir.resolve("watchtower");
        Files.createDirectories(wt);
        Files.writeString(wt.resolve("ops-cache.json"), "{\"crashes\":{\"entries\":[]}}", StandardCharsets.UTF_8);
        JsonObject catalog = SupportBundleCatalog.build(new SupportBundleCatalog.Request(
                serverDir, wt.resolve("ops-cache.json"), null, null, null, null));
        assertTrue(catalog.getAsJsonArray("logs").size() >= 1);
        assertEquals(4, catalog.get("bundle_version").getAsInt());
    }

    @Test
    void safePathsRejectTraversal() {
        assertFalse(SupportSafePaths.isSafeBasename("../x"));
        assertFalse(SupportSafePaths.isSafeBasename("a/b"));
        assertTrue(SupportSafePaths.isSafeBasename("latest.log"));
    }

    private static void assertNotNullEntry(ZipFile zip, String name) {
        assertTrue(zip.getEntry(name) != null, "missing " + name);
    }

    private static String readEntry(ZipFile zip, String name) throws Exception {
        ZipEntry e = zip.getEntry(name);
        return new String(zip.getInputStream(e).readAllBytes(), StandardCharsets.UTF_8);
    }

    private static String findLogTail(ZipFile zip) throws Exception {
        Enumeration<? extends ZipEntry> en = zip.entries();
        while (en.hasMoreElements()) {
            ZipEntry e = en.nextElement();
            if (e.getName().contains("latest.log") || e.getName().equals("logs-tail.txt")
                    || e.getName().startsWith("evidence/logs/")) {
                return new String(zip.getInputStream(e).readAllBytes(), StandardCharsets.UTF_8);
            }
        }
        return null;
    }
}
