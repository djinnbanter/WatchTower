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

    @Test
    void preservesTimestampsAndVersions() {
        String in = "[28Jul2026 14:16:32.036] Time: 2026-06-29 09:56:04 "
                + "last_seen 2026-07-14 21:52:13 +0100 Manifest: 3a:b1:c2:d4:e5:f6 v1.21.1-neoforge";
        String out = SupportRedactor.redactLine(in);
        assertFalse(out.contains("[IP_REDACTED]"), "timestamps/fingerprints must survive: " + out);
        assertTrue(out.contains("14:16:32.036"));
        assertTrue(out.contains("09:56:04"));
        assertTrue(out.contains("v1.21.1-neoforge"));
        assertTrue(out.contains("3a:b1:c2:d4:e5:f6"));
    }

    @Test
    void redactsRealIpv6Forms() {
        assertFalse(SupportRedactor.redactLine("peer ::1 connected").contains("::1"));
        assertFalse(SupportRedactor.redactLine("peer fe80::1ff:fe23:4567:890a").contains("fe80::"));
        assertFalse(SupportRedactor.redactLine("2001:0db8:85a3:0000:0000:8a2e:0370:7334")
                .contains("2001:0db8"));
    }

    @Test
    void redactsInlineMidLineSecrets() {
        String out = SupportRedactor.redactLine("connected user password=s3cret token=abc123 end");
        assertTrue(out.contains("[REDACTED]"));
        assertFalse(out.contains("s3cret"));
        assertFalse(out.contains("abc123"));
    }

    @Test
    void redactsQuotedJsonSecrets() {
        String json = "{\"password\":\"hunter2\",\"host\":\"1.2.3.4\",\"ok\":true}";
        String out = SupportRedactor.redactJsonText(json);
        assertTrue(out.contains("[REDACTED]"));
        assertFalse(out.contains("hunter2"));
        assertTrue(out.contains("[IP_REDACTED]"));
        assertFalse(out.contains("1.2.3.4"));
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
                "1.21.1",
                null));

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

    @Test
    void bundleNeverContainsAuthOrAuditFiles() throws Exception {
        Path serverDir = temp.resolve("server-auth-audit");
        Path watchtower = serverDir.resolve("watchtower");
        Files.createDirectories(watchtower);
        Files.createDirectories(serverDir.resolve("logs"));
        Files.writeString(watchtower.resolve("ops-cache.json"), """
                {
                  "schema_version": 3,
                  "activity": { "events": [] },
                  "issues_live": [],
                  "crashes": { "entries": [], "unreviewed": 0 }
                }
                """, StandardCharsets.UTF_8);
        Files.writeString(watchtower.resolve("performance-rollups.json"), "{}", StandardCharsets.UTF_8);
        Files.writeString(serverDir.resolve("logs/latest.log"), "ok\n", StandardCharsets.UTF_8);
        // Sensitive files that must never ship in a support zip.
        Files.writeString(watchtower.resolve("dashboard-auth.json"),
                "{\"schema\":2,\"accounts\":[]}", StandardCharsets.UTF_8);
        Files.writeString(watchtower.resolve("audit-log.jsonl"),
                "{\"action\":\"login_ok\"}\n", StandardCharsets.UTF_8);
        Files.write(watchtower.resolve(".auth-key"), new byte[32]);

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
                "1.21.1",
                null));

        assertTrue(Files.isRegularFile(result.zipPath()));
        try (ZipFile zip = new ZipFile(result.zipPath().toFile())) {
            assertTrue(zip.stream().noneMatch(e -> e.getName().contains("audit-log")),
                    "support zip must not contain audit-log");
            assertTrue(zip.stream().noneMatch(e -> e.getName().contains("dashboard-auth")),
                    "support zip must not contain dashboard-auth");
            assertTrue(zip.stream().noneMatch(e -> e.getName().contains(".auth-key")),
                    "support zip must not contain .auth-key");
            String readme = readEntry(zip, "README.txt");
            assertTrue(readme.contains("audit log"), "README should mention audit log exclusion");
        }
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
