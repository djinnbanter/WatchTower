package dev.mcstatus.watchtower.core.ops;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
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
