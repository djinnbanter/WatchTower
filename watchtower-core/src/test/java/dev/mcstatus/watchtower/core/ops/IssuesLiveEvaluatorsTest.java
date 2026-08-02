package dev.mcstatus.watchtower.core.ops;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class IssuesLiveEvaluatorsTest {

    @Test
    void lagAndLogStaleAndDiskProduceKeys() {
        JsonObject cache = new JsonObject();

        JsonObject lag = new JsonObject();
        JsonArray lagEntries = new JsonArray();
        JsonObject le = new JsonObject();
        le.addProperty("severity", "critical");
        le.addProperty("message", "MSPT spike");
        le.addProperty("incident_id", "2026-01-01");
        lagEntries.add(le);
        lag.add(OpsCacheSchema.LAG_ISSUES_ENTRIES, lagEntries);
        cache.add(OpsCacheSchema.LAG_ISSUES, lag);

        JsonObject stale = new JsonObject();
        stale.addProperty("active", true);
        stale.addProperty("message", "log quiet");
        cache.add(OpsCacheSchema.LOG_STALE, stale);

        JsonObject proj = new JsonObject();
        proj.addProperty("verdict", "filling");
        proj.addProperty("confidence", "ok");
        proj.addProperty("days_until_full", 12.0);
        proj.addProperty("message", "≈12 days until full at current growth");
        cache.add(OpsCacheSchema.DISK_PROJECTION, proj);

        List<IssuesLiveRecord> merged = IssuesLiveEvaluators.evaluateAndMerge(
                cache, List.of(), true, "2026-07-21T12:00:00Z", 14.0);
        assertTrue(merged.stream().anyMatch(r -> "TICK_LAG".equals(r.normalizedKey())));
        assertTrue(merged.stream().anyMatch(r -> "LOG_STALE".equals(r.normalizedKey())));
        assertTrue(merged.stream().anyMatch(r -> "DISK_FILL_PROJECTED".equals(r.normalizedKey())));
    }

    @Test
    void lagResolvedOnlyClearsTickLag() {
        String t0 = "2026-07-21T12:00:00Z";
        JsonObject cache = new JsonObject();
        JsonObject lag = new JsonObject();
        JsonArray lagEntries = new JsonArray();
        JsonObject resolved = new JsonObject();
        resolved.addProperty("severity", "critical");
        resolved.addProperty("message", "old spike");
        resolved.addProperty("resolved", true);
        lagEntries.add(resolved);
        lag.add(OpsCacheSchema.LAG_ISSUES_ENTRIES, lagEntries);
        cache.add(OpsCacheSchema.LAG_ISSUES, lag);

        List<IssuesLiveRecord> open = IssuesLiveStore.upsert(List.of(),
                IssuesLiveRecord.builder().id("TICK_LAG").message("lag").build(), t0);
        List<IssuesLiveRecord> after = IssuesLiveEvaluators.evaluateAndMerge(cache, open, true, t0);
        assertEquals(IssuesLiveSchema.STATUS_RESOLVED,
                after.stream().filter(r -> "TICK_LAG".equals(r.normalizedKey())).findFirst().orElseThrow().status());
        assertTrue(IssuesLiveEvaluators.fromLagIssues(cache).isEmpty());
    }

    @Test
    void clearingLagResolvesOpenTickLag() {
        String t0 = "2026-07-21T12:00:00Z";
        List<IssuesLiveRecord> open = IssuesLiveStore.upsert(List.of(),
                IssuesLiveRecord.builder().id("TICK_LAG").message("lag").build(), t0);
        JsonObject empty = new JsonObject();
        List<IssuesLiveRecord> after = IssuesLiveEvaluators.evaluateAndMerge(empty, open, true, t0);
        assertEquals(IssuesLiveSchema.STATUS_RESOLVED,
                after.stream().filter(r -> "TICK_LAG".equals(r.normalizedKey())).findFirst().orElseThrow().status());
    }

    @Test
    void clearingModIssuesResolvesModLogKeys() {
        String t0 = "2026-07-21T12:00:00Z";
        List<IssuesLiveRecord> open = IssuesLiveStore.upsert(List.of(),
                IssuesLiveRecord.builder().id("MOD_LOG:create").message("Create error").build(), t0);
        JsonObject empty = new JsonObject();
        List<IssuesLiveRecord> after = IssuesLiveEvaluators.evaluateAndMerge(empty, open, true, t0);
        assertEquals(IssuesLiveSchema.STATUS_RESOLVED,
                after.stream().filter(r -> "MOD_LOG:CREATE".equals(r.normalizedKey())
                        || "MOD_LOG:create".equalsIgnoreCase(r.normalizedKey()))
                        .findFirst().orElseThrow().status());
    }

    @Test
    void fromBackupsNotFoundUnderLastBackup() {
        JsonObject cache = new JsonObject();
        JsonObject backups = new JsonObject();
        JsonObject last = new JsonObject();
        last.addProperty("status", "not_found");
        backups.add("last_backup", last);
        cache.add(OpsCacheSchema.BACKUPS_LIVE, backups);

        List<IssuesLiveRecord> out = IssuesLiveEvaluators.fromBackups(cache, true);
        assertEquals(1, out.size());
        assertEquals("BACKUP_NOT_FOUND", out.getFirst().normalizedKey());
        assertEquals("backup:not_found", out.getFirst().evidenceFingerprint());
        assertEquals("No backup archive found.", out.getFirst().message());
    }

    @Test
    void fromBackupsAgeOver24HoursIsStaleEvenWhenStatusSuccess() {
        JsonObject cache = new JsonObject();
        JsonObject backups = new JsonObject();
        JsonObject last = new JsonObject();
        last.addProperty("status", "success");
        last.addProperty("stale", false);
        last.addProperty("age_hours", 48.0);
        last.addProperty("warn_days", 7);
        backups.add("last_backup", last);
        cache.add(OpsCacheSchema.BACKUPS_LIVE, backups);

        List<IssuesLiveRecord> out = IssuesLiveEvaluators.fromBackups(cache, true);
        assertEquals(1, out.size());
        assertEquals("BACKUP_STALE", out.getFirst().normalizedKey());
        assertEquals("backup:stale", out.getFirst().evidenceFingerprint());
        assertEquals("No backup in the last 24 hours.", out.getFirst().message());
    }

    @Test
    void fromBackupsVerifyFailedOnNewestBroken() {
        JsonObject cache = new JsonObject();
        JsonObject backups = new JsonObject();
        JsonObject last = new JsonObject();
        last.addProperty("status", "success");
        last.addProperty("age_hours", 1.0);
        backups.add("last_backup", last);
        JsonArray inv = new JsonArray();
        JsonObject row = new JsonObject();
        row.addProperty("path", "/b/newest.zip");
        row.addProperty("filename", "newest.zip");
        JsonObject verify = new JsonObject();
        verify.addProperty("status", "broken");
        row.add("verify", verify);
        inv.add(row);
        backups.add("inventory", inv);
        cache.add(OpsCacheSchema.BACKUPS_LIVE, backups);

        List<IssuesLiveRecord> out = IssuesLiveEvaluators.fromBackups(cache, true);
        assertTrue(out.stream().anyMatch(r -> "BACKUP_VERIFY_FAILED".equals(r.normalizedKey())));
    }

    @Test
    void backupFingerprintStableAcrossAgeHours() {
        JsonObject cacheA = backupCacheWithAge(48.0);
        JsonObject cacheB = backupCacheWithAge(49.5);
        String fpA = IssuesLiveEvaluators.fromBackups(cacheA, true).getFirst().evidenceFingerprint();
        String fpB = IssuesLiveEvaluators.fromBackups(cacheB, true).getFirst().evidenceFingerprint();
        assertEquals("backup:stale", fpA);
        assertEquals(fpA, fpB);

        String t0 = "2026-07-21T12:00:00Z";
        List<IssuesLiveRecord> reviewed = IssuesLiveStore.markReviewed(
                IssuesLiveStore.upsert(List.of(),
                        IssuesLiveEvaluators.fromBackups(cacheA, true).getFirst(), t0),
                "BACKUP_STALE", t0);
        assertEquals(IssuesLiveSchema.STATUS_REVIEWED, reviewed.getFirst().status());

        List<IssuesLiveRecord> after = IssuesLiveEvaluators.evaluateAndMerge(cacheB, reviewed, true, t0);
        assertEquals(IssuesLiveSchema.STATUS_REVIEWED,
                after.stream().filter(r -> "BACKUP_STALE".equals(r.normalizedKey())).findFirst().orElseThrow().status());
    }

    @Test
    void fromLogStaleUsesActiveField() {
        JsonObject cache = new JsonObject();
        JsonObject stale = new JsonObject();
        stale.addProperty("active", true);
        stale.addProperty("message", "quiet");
        cache.add(OpsCacheSchema.LOG_STALE, stale);
        assertEquals(1, IssuesLiveEvaluators.fromLogStale(cache).size());

        JsonObject inactive = new JsonObject();
        inactive.addProperty("active", false);
        cache.add(OpsCacheSchema.LOG_STALE, inactive);
        assertTrue(IssuesLiveEvaluators.fromLogStale(cache).isEmpty());
    }

    @Test
    void fromSoftHangActiveEmitsSoftHang() {
        JsonObject cache = new JsonObject();
        JsonObject soft = new JsonObject();
        soft.addProperty(OpsCacheSchema.SOFT_HANG_ACTIVE, true);
        soft.addProperty(OpsCacheSchema.SOFT_HANG_PHASE, "ticking");
        soft.addProperty(OpsCacheSchema.SOFT_HANG_STALL_SECONDS, 48);
        soft.addProperty(OpsCacheSchema.SOFT_HANG_STARTED_AT, "2026-08-02T00:00:00Z");
        cache.add(OpsCacheSchema.SOFT_HANG, soft);
        List<IssuesLiveRecord> out = IssuesLiveEvaluators.fromSoftHang(cache);
        assertEquals(1, out.size());
        assertEquals("SOFT_HANG", out.getFirst().normalizedKey());
        assertEquals("critical", out.getFirst().severity());
        assertTrue(out.getFirst().message().contains("Server tick frozen"));
    }

    @Test
    void fromSoftHangIncludesLikelyCauseInMessageAndSteps() {
        JsonObject cache = new JsonObject();
        JsonObject soft = new JsonObject();
        soft.addProperty(OpsCacheSchema.SOFT_HANG_ACTIVE, true);
        soft.addProperty(OpsCacheSchema.SOFT_HANG_PHASE, "ticking");
        soft.addProperty(OpsCacheSchema.SOFT_HANG_STALL_SECONDS, 48);
        soft.addProperty(OpsCacheSchema.SOFT_HANG_STARTED_AT, "2026-08-02T00:00:00Z");
        soft.addProperty(OpsCacheSchema.SOFT_HANG_LIKELY_CAUSE, "entity_tick");
        soft.addProperty(OpsCacheSchema.SOFT_HANG_LIKELY_CAUSE_SUMMARY, "Looks stuck while ticking entities");
        soft.addProperty(OpsCacheSchema.SOFT_HANG_LIKELY_CAUSE_CONFIDENCE, "medium");
        soft.addProperty(OpsCacheSchema.SOFT_HANG_SUSPECT_MOD, "example");
        soft.addProperty(OpsCacheSchema.SOFT_HANG_DUMP_PATH, "watchtower/hangs/hang-x.txt");
        cache.add(OpsCacheSchema.SOFT_HANG, soft);
        IssuesLiveRecord r = IssuesLiveEvaluators.fromSoftHang(cache).getFirst();
        assertTrue(r.message().contains("Looks stuck while ticking entities"));
        assertFalse(r.message().contains("example"));
        assertTrue(r.fixSteps().stream().anyMatch(s ->
                s.contains("entity") || s.contains("farm") || s.contains("mob")));
        assertTrue(r.fixSteps().stream().anyMatch(s -> s.contains("example") && s.contains("lead")));
    }

    @Test
    void evaluateAndMergeResolvesSoftHangWhenInactive() {
        String t0 = "2026-08-02T00:00:00Z";
        IssuesLiveRecord open = IssuesLiveRecord.builder()
                .id("SOFT_HANG")
                .key("SOFT_HANG")
                .severity("critical")
                .message("Server tick frozen")
                .source(IssuesLiveSchema.SOURCE_OPS)
                .build();
        JsonObject cache = new JsonObject();
        JsonObject soft = new JsonObject();
        soft.addProperty(OpsCacheSchema.SOFT_HANG_ACTIVE, false);
        soft.addProperty(OpsCacheSchema.SOFT_HANG_RECOVERED_AT, t0);
        cache.add(OpsCacheSchema.SOFT_HANG, soft);
        List<IssuesLiveRecord> after = IssuesLiveEvaluators.evaluateAndMerge(cache, List.of(open), true, t0);
        assertTrue(after.stream().noneMatch(r ->
                "SOFT_HANG".equals(r.normalizedKey())
                        && IssuesLiveSchema.STATUS_OPEN.equals(r.status())));
    }

    @Test
    void fromDiskUsesProjectionAnalyzerShape() {
        JsonObject cache = new JsonObject();
        JsonObject proj = new JsonObject();
        proj.addProperty("verdict", "filling");
        proj.addProperty("confidence", "ok");
        proj.addProperty("days_until_full", 10.0);
        proj.addProperty("message", "≈10 days until full at current growth");
        cache.add(OpsCacheSchema.DISK_PROJECTION, proj);

        List<IssuesLiveRecord> out = IssuesLiveEvaluators.fromDisk(cache, 14.0);
        assertEquals(1, out.size());
        assertEquals("DISK_FILL_PROJECTED", out.getFirst().normalizedKey());
        assertEquals("disk_fill_projected", out.getFirst().evidenceFingerprint());

        assertTrue(IssuesLiveEvaluators.fromDisk(cache, 5.0).isEmpty());
    }

    @Test
    void diskFillFingerprintStableAcrossDaysUntilFull() {
        JsonObject cacheA = diskProjCache(12.0);
        JsonObject cacheB = diskProjCache(11.0);
        String fpA = IssuesLiveEvaluators.fromDisk(cacheA, 14.0).getFirst().evidenceFingerprint();
        String fpB = IssuesLiveEvaluators.fromDisk(cacheB, 14.0).getFirst().evidenceFingerprint();
        assertEquals("disk_fill_projected", fpA);
        assertEquals(fpA, fpB);

        String t0 = "2026-07-21T12:00:00Z";
        List<IssuesLiveRecord> reviewed = IssuesLiveStore.markReviewed(
                IssuesLiveStore.upsert(List.of(),
                        IssuesLiveEvaluators.fromDisk(cacheA, 14.0).getFirst(), t0),
                "DISK_FILL_PROJECTED", t0);
        assertEquals(IssuesLiveSchema.STATUS_REVIEWED, reviewed.getFirst().status());

        List<IssuesLiveRecord> after = IssuesLiveEvaluators.evaluateAndMerge(cacheB, reviewed, true, t0, 14.0);
        assertEquals(IssuesLiveSchema.STATUS_REVIEWED,
                after.stream().filter(r -> "DISK_FILL_PROJECTED".equals(r.normalizedKey()))
                        .findFirst().orElseThrow().status());
    }

    @Test
    void lagFingerprintStableAcrossOpenCount() {
        JsonObject cacheA = lagCache(2, "critical");
        JsonObject cacheB = lagCache(1, "critical");
        String fpA = IssuesLiveEvaluators.fromLagIssues(cacheA).getFirst().evidenceFingerprint();
        String fpB = IssuesLiveEvaluators.fromLagIssues(cacheB).getFirst().evidenceFingerprint();
        assertEquals("lag:c", fpA);
        assertEquals(fpA, fpB);

        String t0 = "2026-07-21T12:00:00Z";
        List<IssuesLiveRecord> reviewed = IssuesLiveStore.markReviewed(
                IssuesLiveStore.upsert(List.of(),
                        IssuesLiveEvaluators.fromLagIssues(cacheA).getFirst(), t0),
                "TICK_LAG", t0);
        List<IssuesLiveRecord> after = IssuesLiveEvaluators.evaluateAndMerge(cacheB, reviewed, true, t0);
        assertEquals(IssuesLiveSchema.STATUS_REVIEWED,
                after.stream().filter(r -> "TICK_LAG".equals(r.normalizedKey()))
                        .findFirst().orElseThrow().status());
    }

    @Test
    void fromBackupsAgeWithin24HoursNoIssue() {
        JsonObject cache = new JsonObject();
        JsonObject backups = new JsonObject();
        JsonObject last = new JsonObject();
        last.addProperty("status", "success");
        last.addProperty("stale", false);
        last.addProperty("age_hours", 6.0);
        backups.add("last_backup", last);
        cache.add(OpsCacheSchema.BACKUPS_LIVE, backups);

        assertTrue(IssuesLiveEvaluators.fromBackups(cache, true).isEmpty());
    }

    @Test
    void fromBackupsCustomStaleHoursGate() {
        JsonObject cache = new JsonObject();
        JsonObject backups = new JsonObject();
        JsonObject last = new JsonObject();
        last.addProperty("status", "success");
        last.addProperty("stale", false);
        last.addProperty("age_hours", 30.0);
        backups.add("last_backup", last);
        cache.add(OpsCacheSchema.BACKUPS_LIVE, backups);

        assertTrue(IssuesLiveEvaluators.fromBackups(cache, true, 48).isEmpty());
        List<IssuesLiveRecord> stale = IssuesLiveEvaluators.fromBackups(cache, true, 24);
        assertEquals(1, stale.size());
        assertEquals("BACKUP_STALE", stale.getFirst().key());
        assertEquals("No backup in the last 24 hours.", stale.getFirst().message());
    }

    @Test
    void fromBackupsMissingLastBackupObjectYieldsNoIssue() {
        JsonObject cache = new JsonObject();
        cache.add(OpsCacheSchema.BACKUPS_LIVE, new JsonObject());
        assertTrue(IssuesLiveEvaluators.fromBackups(cache, true).isEmpty());
    }

    @Test
    void fromBackupsTrackingDisabledYieldsNoIssue() {
        JsonObject cache = new JsonObject();
        JsonObject backups = new JsonObject();
        JsonObject last = new JsonObject();
        last.addProperty("status", "not_found");
        backups.add("last_backup", last);
        cache.add(OpsCacheSchema.BACKUPS_LIVE, backups);
        assertTrue(IssuesLiveEvaluators.fromBackups(cache, false).isEmpty());
    }

    @Test
    void fromModJarDriftProducesWarningKey() throws Exception {
        JsonObject cache = loadFixture("samples/fixtures/issues-live/mod-jar-drift.json");
        List<IssuesLiveRecord> rows = IssuesLiveEvaluators.fromModJarDrift(cache);
        assertEquals(1, rows.size());
        assertEquals("MOD_JAR_DRIFT:SWAP.JAR", rows.get(0).normalizedKey());
        assertEquals("warning", rows.get(0).severity());
        assertTrue(rows.get(0).message().contains("verify this was intentional"));
    }

    @Test
    void fromClientOnServerOnlyHighConfidenceLikelyRemovable() throws Exception {
        JsonObject cache = loadFixture("samples/fixtures/issues-live/client-on-server-band.json");
        List<IssuesLiveRecord> rows = IssuesLiveEvaluators.fromClientOnServer(cache, true);
        assertEquals(1, rows.size());
        assertEquals("CLIENT_ON_SERVER:IRIS", rows.get(0).normalizedKey());
        assertEquals("info", rows.get(0).severity());
        assertTrue(IssuesLiveEvaluators.fromClientOnServer(cache, false).isEmpty());
    }

    @Test
    void fromSilentFailsProducesKeyWithPath() throws Exception {
        JsonObject cache = loadFixture("samples/fixtures/issues-live/silent-fail.json");
        List<IssuesLiveRecord> rows = IssuesLiveEvaluators.fromSilentFails(cache, true);
        assertEquals(2, rows.size());
        IssuesLiveRecord kube = rows.stream()
                .filter(r -> r.normalizedKey().startsWith("SILENT_FAIL:KUBEJS"))
                .findFirst()
                .orElseThrow();
        assertEquals("warning", kube.severity());
        assertTrue(kube.message().contains("kubejs/server_scripts/machines.js:42"));
        assertTrue(IssuesLiveEvaluators.fromSilentFails(cache, false).isEmpty());

        IssuesLiveRecord reload = rows.stream()
                .filter(r -> r.normalizedKey().startsWith("SILENT_FAIL:RELOAD_FAILED"))
                .findFirst()
                .orElseThrow();
        assertEquals("info", reload.severity());
        assertEquals("/reload command failed", reload.message());
    }

    @Test
    void fromWorldPressureProducesKeyWithDimension() {
        JsonObject cache = new JsonObject();
        JsonObject wp = new JsonObject();
        JsonArray classifiers = new JsonArray();
        JsonObject c = new JsonObject();
        c.addProperty("kind", "item_storm");
        c.addProperty("dimension", "minecraft:overworld");
        c.addProperty("severity", "warning");
        c.addProperty("headline", "Item storm in Overworld");
        c.addProperty("detail", "1,840 item entities in Overworld.");
        JsonArray steps = new JsonArray();
        steps.add("Check hoppers on item farms");
        c.add("next_steps", steps);
        classifiers.add(c);
        wp.add(OpsCacheSchema.WORLD_PRESSURE_CLASSIFIERS, classifiers);
        cache.add(OpsCacheSchema.WORLD_PRESSURE, wp);

        List<IssuesLiveRecord> rows = IssuesLiveEvaluators.fromWorldPressure(cache, true);
        assertEquals(1, rows.size());
        assertEquals("WORLD_PRESSURE:ITEM_STORM:MINECRAFT:OVERWORLD", rows.get(0).normalizedKey());
        assertEquals("warning", rows.get(0).severity());
        assertTrue(rows.get(0).message().contains("Item storm"));
        assertTrue(IssuesLiveEvaluators.fromWorldPressure(cache, false).isEmpty());
    }

    @Test
    void fromWorldPressureMapsPregenOutrunningDisk() {
        JsonObject cache = new JsonObject();
        JsonObject wp = new JsonObject();
        JsonArray classifiers = new JsonArray();
        JsonObject c = new JsonObject();
        c.addProperty("kind", "pregen_outrunning_disk");
        c.addProperty("dimension", "minecraft:overworld");
        c.addProperty("severity", "warning");
        c.addProperty("headline", "Pregen is outrunning the disk");
        c.addProperty("detail", "Chunky active with high write latency");
        JsonArray steps = new JsonArray();
        steps.add("Pause pregen and wait for the disk to catch up.");
        c.add("next_steps", steps);
        classifiers.add(c);
        wp.add(OpsCacheSchema.WORLD_PRESSURE_CLASSIFIERS, classifiers);
        cache.add(OpsCacheSchema.WORLD_PRESSURE, wp);
        List<IssuesLiveRecord> rows = IssuesLiveEvaluators.fromWorldPressure(cache, true);
        assertEquals(1, rows.size());
        assertEquals("WORLD_PRESSURE:PREGEN_OUTRUNNING_DISK:MINECRAFT:OVERWORLD", rows.get(0).normalizedKey());
        assertTrue(rows.get(0).fixSteps().get(0).toLowerCase().contains("pregen"));
    }

    @Test
    void fromLoginStormProducesSignalLoginStorm() {
        JsonObject cache = new JsonObject();
        JsonObject activity = new JsonObject();
        JsonArray events = new JsonArray();
        JsonObject ev = new JsonObject();
        ev.addProperty(OpsCacheSchema.EVENT_TYPE, "login_storm");
        ev.addProperty(OpsCacheSchema.EVENT_DETAIL,
                "25 login disconnects vs 1 join — server up but unjoinable");
        ev.addProperty("login_disconnects", 25);
        ev.addProperty("successful_joins", 1);
        events.add(ev);
        activity.add(OpsCacheSchema.ACTIVITY_EVENTS, events);
        cache.add(OpsCacheSchema.ACTIVITY, activity);

        List<IssuesLiveRecord> rows = IssuesLiveEvaluators.fromLoginStorm(cache);
        assertEquals(1, rows.size());
        assertEquals("SIGNAL_LOGIN_STORM", rows.get(0).normalizedKey());
        assertEquals("warning", rows.get(0).severity());
        assertTrue(rows.get(0).message().toLowerCase().contains("unjoinable")
                || rows.get(0).message().toLowerCase().contains("cannot finish login"));
        assertFalse(rows.get(0).fixSteps().isEmpty());
        assertTrue(rows.get(0).fixSteps().stream()
                .anyMatch(s -> s.toLowerCase().contains("login") || s.toLowerCase().contains("auth")));
    }

    @Test
    void clearingLoginStormResolvesSignal() {
        String t0 = "2026-08-02T12:00:00Z";
        List<IssuesLiveRecord> open = IssuesLiveStore.upsert(List.of(),
                IssuesLiveRecord.builder().id("signal_login_storm").message("storm").build(), t0);
        JsonObject empty = new JsonObject();
        List<IssuesLiveRecord> after = IssuesLiveEvaluators.evaluateAndMerge(empty, open, true, t0);
        assertEquals(IssuesLiveSchema.STATUS_RESOLVED,
                after.stream().filter(r -> "SIGNAL_LOGIN_STORM".equals(r.normalizedKey()))
                        .findFirst().orElseThrow().status());
    }

    @Test
    void fromDbAddonFailProducesSignalWithAclFix() {
        JsonObject cache = new JsonObject();
        JsonObject optional = new JsonObject();
        JsonObject block = new JsonObject();
        block.addProperty("active", true);
        block.addProperty("issue_id", "signal_db_addon_fail");
        block.addProperty("kind", "db_addon_acl");
        block.addProperty("primary_mod", "grieflogger");
        block.addProperty("detail",
                "GriefLogger disabled — MariaDB host ACL (1130) blocked database access");
        optional.add("db_addon_fail", block);
        cache.add("optional", optional);

        List<IssuesLiveRecord> rows = IssuesLiveEvaluators.fromDbAddonFail(cache);
        assertEquals(1, rows.size());
        assertEquals("SIGNAL_DB_ADDON_FAIL", rows.get(0).normalizedKey());
        assertEquals("warning", rows.get(0).severity());
        assertTrue(rows.get(0).message().toLowerCase().contains("mariadb")
                || rows.get(0).message().toLowerCase().contains("1130"));
        assertFalse(rows.get(0).fixSteps().isEmpty());
        assertTrue(rows.get(0).fixSteps().stream()
                .anyMatch(s -> s.toLowerCase().contains("1130") || s.toLowerCase().contains("acl")
                        || s.toLowerCase().contains("mariadb")));
    }

    @Test
    void fromDbAddonFailAttributesGlraConnection() {
        JsonObject cache = new JsonObject();
        JsonObject optional = new JsonObject();
        JsonObject block = new JsonObject();
        block.addProperty("active", true);
        block.addProperty("kind", "db_addon_connection");
        block.addProperty("primary_mod", "griefloggerrollbackaddon");
        block.addProperty("detail",
                "GriefLogger Rollback Addon (griefloggerrollbackaddon) database connection failed");
        optional.add("db_addon_fail", block);
        cache.add("optional", optional);

        List<IssuesLiveRecord> rows = IssuesLiveEvaluators.fromDbAddonFail(cache);
        assertEquals(1, rows.size());
        assertEquals("SIGNAL_DB_ADDON_FAIL", rows.get(0).normalizedKey());
        assertTrue(rows.get(0).fixSteps().stream()
                .anyMatch(s -> s.toLowerCase().contains("griefloggerrollbackaddon")
                        || s.toLowerCase().contains("rollback")));
    }

    @Test
    void clearingDbAddonFailResolvesSignal() {
        String t0 = "2026-08-02T12:00:00Z";
        List<IssuesLiveRecord> open = IssuesLiveStore.upsert(List.of(),
                IssuesLiveRecord.builder().id("signal_db_addon_fail").message("db").build(), t0);
        JsonObject empty = new JsonObject();
        List<IssuesLiveRecord> after = IssuesLiveEvaluators.evaluateAndMerge(empty, open, true, t0);
        assertEquals(IssuesLiveSchema.STATUS_RESOLVED,
                after.stream().filter(r -> "SIGNAL_DB_ADDON_FAIL".equals(r.normalizedKey()))
                        .findFirst().orElseThrow().status());
    }

    @Test
    void fromGlCreateNpeProducesDistinctSignal() {
        JsonObject cache = new JsonObject();
        JsonObject optional = new JsonObject();
        JsonObject block = new JsonObject();
        block.addProperty("active", true);
        block.addProperty("issue_id", "signal_gl_create_npe");
        block.addProperty("kind", "grieflogger_create_compat");
        block.addProperty("primary_mod", "grieflogger");
        block.addProperty("detail",
                "GriefLogger × Create mounted-storage NPE (menuProvider null) — FATAL task without crash-report");
        optional.add("gl_create_npe", block);
        cache.add("optional", optional);

        List<IssuesLiveRecord> rows = IssuesLiveEvaluators.fromGlCreateNpe(cache);
        assertEquals(1, rows.size());
        assertEquals("SIGNAL_GL_CREATE_NPE", rows.get(0).normalizedKey());
        assertNotEquals("SIGNAL_DB_ADDON_FAIL", rows.get(0).normalizedKey());
        assertEquals("warning", rows.get(0).severity());
        assertFalse(rows.get(0).fixSteps().isEmpty());
        String joined = String.join(" ", rows.get(0).fixSteps()).toLowerCase();
        assertTrue(joined.contains("menuprovider") || joined.contains("mounted")
                || joined.contains("contraption") || joined.contains("create"));
        assertTrue(joined.contains("fatal") || joined.contains("crash"));
    }

    @Test
    void clearingGlCreateNpeResolvesSignal() {
        String t0 = "2026-08-02T12:00:00Z";
        List<IssuesLiveRecord> open = IssuesLiveStore.upsert(List.of(),
                IssuesLiveRecord.builder().id("signal_gl_create_npe").message("compat").build(), t0);
        JsonObject empty = new JsonObject();
        List<IssuesLiveRecord> after = IssuesLiveEvaluators.evaluateAndMerge(empty, open, true, t0);
        assertEquals(IssuesLiveSchema.STATUS_RESOLVED,
                after.stream().filter(r -> "SIGNAL_GL_CREATE_NPE".equals(r.normalizedKey()))
                        .findFirst().orElseThrow().status());
    }

    @Test
    void fromJoinClinicProducesJoinSyncKey() throws Exception {
        JsonObject cache = loadFixture("samples/fixtures/issues-live/join-sync-positive.json");
        List<IssuesLiveRecord> rows = IssuesLiveEvaluators.fromJoinClinic(cache, true);
        assertFalse(rows.isEmpty());
        assertTrue(rows.get(0).normalizedKey().startsWith("JOIN_SYNC"));
        assertEquals("warning", rows.get(0).severity());
    }

    @Test
    void fromJoinClinicDisabledReturnsEmpty() throws Exception {
        JsonObject cache = loadFixture("samples/fixtures/issues-live/join-sync-positive.json");
        assertTrue(IssuesLiveEvaluators.fromJoinClinic(cache, false).isEmpty());
    }

    @Test
    void clearingJoinClinicResolvesKeys() {
        String t0 = "2026-07-28T12:00:00Z";
        List<IssuesLiveRecord> open = IssuesLiveStore.upsert(List.of(),
                IssuesLiveRecord.builder().id("JOIN_SYNC:mismatched_channel|Friend|create")
                        .message("join").build(), t0);
        JsonObject empty = new JsonObject();
        List<IssuesLiveRecord> after = IssuesLiveEvaluators.evaluateAndMerge(empty, open, true, t0);
        assertEquals(IssuesLiveSchema.STATUS_RESOLVED,
                after.stream().filter(r -> r.normalizedKey().startsWith("JOIN_SYNC"))
                        .findFirst().orElseThrow().status());
    }

    @Test
    void clearingWorldPressureResolvesKeys() {
        String t0 = "2026-07-28T12:00:00Z";
        List<IssuesLiveRecord> open = IssuesLiveStore.upsert(List.of(),
                IssuesLiveRecord.builder().id("WORLD_PRESSURE:item_storm:minecraft:overworld")
                        .message("storm").build(), t0);
        JsonObject empty = new JsonObject();
        List<IssuesLiveRecord> after = IssuesLiveEvaluators.evaluateAndMerge(empty, open, true, t0);
        assertEquals(IssuesLiveSchema.STATUS_RESOLVED,
                after.stream().filter(r -> r.normalizedKey().startsWith("WORLD_PRESSURE"))
                        .findFirst().orElseThrow().status());
    }

    @Test
    void evaluateAndMergeUpsertsDriftFromOpsCacheFixture() throws Exception {
        JsonObject cache = loadFixture("samples/fixtures/ops-cache/mod-jar-drift-positive.json");
        List<IssuesLiveRecord> merged = IssuesLiveEvaluators.evaluateAndMerge(
                cache, List.of(), true, "2026-07-28T12:00:00Z");
        assertTrue(merged.stream().anyMatch(r -> "MOD_JAR_DRIFT:CREATE-6.0.0.JAR".equals(r.normalizedKey())));
    }

    @Test
    void clearingDriftResolvesModJarDriftKeys() {
        String t0 = "2026-07-28T12:00:00Z";
        List<IssuesLiveRecord> open = IssuesLiveStore.upsert(List.of(),
                IssuesLiveRecord.builder().id("MOD_JAR_DRIFT:swap.jar").message("drift").build(), t0);
        JsonObject empty = new JsonObject();
        List<IssuesLiveRecord> after = IssuesLiveEvaluators.evaluateAndMerge(empty, open, true, t0);
        assertEquals(IssuesLiveSchema.STATUS_RESOLVED,
                after.stream().filter(r -> r.normalizedKey().startsWith("MOD_JAR_DRIFT"))
                        .findFirst().orElseThrow().status());
    }

    @Test
    void clearingClientOnlyResolvesClientOnServerKeys() {
        String t0 = "2026-07-28T12:00:00Z";
        List<IssuesLiveRecord> open = IssuesLiveStore.upsert(List.of(),
                IssuesLiveRecord.builder().id("CLIENT_ON_SERVER:iris").message("client").build(), t0);
        JsonObject empty = new JsonObject();
        List<IssuesLiveRecord> after = IssuesLiveEvaluators.evaluateAndMerge(empty, open, true, t0);
        assertEquals(IssuesLiveSchema.STATUS_RESOLVED,
                after.stream().filter(r -> r.normalizedKey().startsWith("CLIENT_ON_SERVER"))
                        .findFirst().orElseThrow().status());
    }

    private static JsonObject loadFixture(String relative) throws Exception {
        java.nio.file.Path path = java.nio.file.Path.of(relative);
        if (!java.nio.file.Files.isRegularFile(path)) {
            path = java.nio.file.Path.of("..").resolve(relative);
        }
        if (!java.nio.file.Files.isRegularFile(path)) {
            path = java.nio.file.Path.of("../..").resolve(relative);
        }
        String text = java.nio.file.Files.readString(path.toAbsolutePath().normalize());
        return com.google.gson.JsonParser.parseString(text).getAsJsonObject();
    }

    private static JsonObject backupCacheWithAge(double ageHours) {
        JsonObject cache = new JsonObject();
        JsonObject backups = new JsonObject();
        JsonObject last = new JsonObject();
        last.addProperty("status", "success");
        last.addProperty("age_hours", ageHours);
        backups.add("last_backup", last);
        cache.add(OpsCacheSchema.BACKUPS_LIVE, backups);
        return cache;
    }

    @Test
    void worldRiskDisabledProducesIssue() {
        JsonObject cache = new JsonObject();
        JsonObject light = new JsonObject();
        JsonArray mods = new JsonArray();
        JsonObject mod = new JsonObject();
        mod.addProperty("id", "dimmod");
        mod.addProperty("jar_file", "dimmod-1.0.jar.disabled");
        mod.addProperty("disabled", true);
        JsonObject risk = new JsonObject();
        risk.addProperty("level", "high");
        JsonArray reasons = new JsonArray();
        reasons.add("world_dimension_folders:dimmod");
        risk.add("reasons", reasons);
        mod.add("world_risk", risk);
        mods.add(mod);
        light.add("mods", mods);
        cache.add("mods_light", light);

        List<IssuesLiveRecord> found = IssuesLiveEvaluators.fromWorldRiskDisabled(cache, true);
        assertEquals(1, found.size());
        assertTrue(found.get(0).normalizedKey().startsWith("WORLD_RISK_DISABLED"));
        assertTrue(IssuesLiveEvaluators.fromWorldRiskDisabled(cache, false).isEmpty());
    }

    private static JsonObject diskProjCache(double daysUntilFull) {
        JsonObject cache = new JsonObject();
        JsonObject proj = new JsonObject();
        proj.addProperty("verdict", "filling");
        proj.addProperty("confidence", "ok");
        proj.addProperty("days_until_full", daysUntilFull);
        proj.addProperty("message", "≈" + daysUntilFull + " days until full at current growth");
        cache.add(OpsCacheSchema.DISK_PROJECTION, proj);
        return cache;
    }

    private static JsonObject lagCache(int openCount, String severity) {
        JsonObject cache = new JsonObject();
        JsonObject lag = new JsonObject();
        JsonArray lagEntries = new JsonArray();
        for (int i = 0; i < openCount; i++) {
            JsonObject le = new JsonObject();
            le.addProperty("severity", severity);
            le.addProperty("message", "MSPT spike " + i);
            lagEntries.add(le);
        }
        lag.add(OpsCacheSchema.LAG_ISSUES_ENTRIES, lagEntries);
        cache.add(OpsCacheSchema.LAG_ISSUES, lag);
        return cache;
    }
}
