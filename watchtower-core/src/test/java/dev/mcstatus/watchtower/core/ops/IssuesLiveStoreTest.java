package dev.mcstatus.watchtower.core.ops;

import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class IssuesLiveStoreTest {

    @Test
    void upsertCreatesOpenAndPreservesFirstSeen() {
        String t0 = "2026-07-20T10:00:00Z";
        String t1 = "2026-07-21T10:00:00Z";
        IssuesLiveRecord first = IssuesLiveRecord.builder()
                .id("LOG_STALE")
                .message("stale")
                .evidenceFingerprint("a")
                .build();
        List<IssuesLiveRecord> after = IssuesLiveStore.upsert(List.of(), first, t0);
        assertEquals(1, after.size());
        assertEquals(IssuesLiveSchema.STATUS_OPEN, after.get(0).status());
        assertEquals(t0, after.get(0).firstSeen());

        IssuesLiveRecord again = IssuesLiveRecord.builder()
                .id("LOG_STALE")
                .message("still stale")
                .evidenceFingerprint("a")
                .build();
        List<IssuesLiveRecord> second = IssuesLiveStore.upsert(after, again, t1);
        assertEquals(1, second.size());
        assertEquals(t0, second.get(0).firstSeen());
        assertEquals(t1, second.get(0).lastSeen());
        assertEquals("still stale", second.get(0).message());
    }

    @Test
    void missedPassDoesNotDropOpen() {
        String t0 = "2026-07-20T10:00:00Z";
        List<IssuesLiveRecord> open = IssuesLiveStore.upsert(List.of(),
                IssuesLiveRecord.builder().id("DISK_FILL_PROJECTED").message("fill").build(), t0);
        List<IssuesLiveRecord> after = IssuesLiveStore.applyPass(open, List.of(), java.util.Set.of(), false, t0);
        assertEquals(1, after.size());
        assertEquals(IssuesLiveSchema.STATUS_OPEN, after.get(0).status());
    }

    @Test
    void reviewedSurvivesSameFingerprint() {
        String t0 = "2026-07-20T10:00:00Z";
        List<IssuesLiveRecord> open = IssuesLiveStore.upsert(List.of(),
                IssuesLiveRecord.builder().id("TICK_LAG").evidenceFingerprint("fp1").message("lag").build(), t0);
        List<IssuesLiveRecord> reviewed = IssuesLiveStore.markReviewed(open, "TICK_LAG", t0);
        assertEquals(IssuesLiveSchema.STATUS_REVIEWED, reviewed.get(0).status());

        List<IssuesLiveRecord> again = IssuesLiveStore.upsert(reviewed,
                IssuesLiveRecord.builder().id("TICK_LAG").evidenceFingerprint("fp1").message("lag again").build(), t0);
        assertEquals(IssuesLiveSchema.STATUS_REVIEWED, again.get(0).status());
    }

    @Test
    void reviewedReopensOnFingerprintChange() {
        String t0 = "2026-07-20T10:00:00Z";
        List<IssuesLiveRecord> open = IssuesLiveStore.upsert(List.of(),
                IssuesLiveRecord.builder().id("TICK_LAG").evidenceFingerprint("fp1").message("lag").build(), t0);
        List<IssuesLiveRecord> reviewed = IssuesLiveStore.markReviewed(open, "TICK_LAG", t0);
        List<IssuesLiveRecord> again = IssuesLiveStore.upsert(reviewed,
                IssuesLiveRecord.builder().id("TICK_LAG").evidenceFingerprint("fp2").message("new lag").build(), t0);
        assertEquals(IssuesLiveSchema.STATUS_OPEN, again.get(0).status());
    }

    @Test
    void enrichDoesNotResetReviewed() {
        String t0 = "2026-07-20T10:00:00Z";
        List<IssuesLiveRecord> open = IssuesLiveStore.upsert(List.of(),
                IssuesLiveRecord.builder().id("BACKUP_STALE").message("stale").build(), t0);
        List<IssuesLiveRecord> reviewed = IssuesLiveStore.markReviewed(open, "BACKUP_STALE", t0);
        List<IssuesLiveRecord> enriched = IssuesLiveStore.enrich(reviewed,
                IssuesLiveRecord.builder().id("BACKUP_STALE").message("enriched").addFixStep("Take a backup").build(), t0);
        assertEquals(IssuesLiveSchema.STATUS_REVIEWED, enriched.get(0).status());
        assertFalse(enriched.get(0).fixSteps().isEmpty());
        assertEquals("enriched", enriched.get(0).message());
    }

    @Test
    void resolveDoesNotDelete() {
        String t0 = "2026-07-20T10:00:00Z";
        List<IssuesLiveRecord> open = IssuesLiveStore.upsert(List.of(),
                IssuesLiveRecord.builder().id("LOG_STALE").message("stale").build(), t0);
        List<IssuesLiveRecord> resolved = IssuesLiveStore.resolve(open, "LOG_STALE", t0);
        assertEquals(1, resolved.size());
        assertEquals(IssuesLiveSchema.STATUS_RESOLVED, resolved.get(0).status());
        assertTrue(resolved.get(0).resolvedAt() != null);
    }

    @Test
    void roundTripJson() {
        IssuesLiveRecord r = IssuesLiveRecord.builder()
                .id("LOG_STALE")
                .severity("warning")
                .message("hi")
                .addEvidenceRef("ops:log_stale")
                .addFixStep("Check process")
                .build();
        IssuesLiveRecord back = IssuesLiveRecord.fromJson(r.toJson());
        assertEquals(r.id(), back.id());
        assertEquals(r.message(), back.message());
        assertEquals(1, back.evidenceRefs().size());
        assertEquals(1, back.fixSteps().size());
    }

    @Test
    void fixtureOpenLogStaleRoundTrip() throws Exception {
        Path fixture = resolveFixture("open-log-stale.json");
        JsonObject root = JsonParser.parseString(Files.readString(fixture)).getAsJsonObject();
        List<IssuesLiveRecord> loaded = IssuesLiveStore.readAll(root);
        assertEquals(1, loaded.size());
        assertEquals("LOG_STALE", loaded.get(0).id());
        assertEquals(IssuesLiveSchema.STATUS_OPEN, loaded.get(0).status());

        List<IssuesLiveRecord> afterMiss = IssuesLiveStore.applyPass(
                loaded, List.of(), java.util.Set.of(), false, "2026-07-21T12:00:00Z");
        assertEquals(IssuesLiveSchema.STATUS_OPEN, afterMiss.get(0).status());
    }

    @Test
    void fixtureReviewedSurvivesSameFingerprint() throws Exception {
        Path fixture = resolveFixture("reviewed-tick-lag.json");
        JsonObject root = JsonParser.parseString(Files.readString(fixture)).getAsJsonObject();
        List<IssuesLiveRecord> loaded = IssuesLiveStore.readAll(root);
        List<IssuesLiveRecord> again = IssuesLiveStore.upsert(loaded,
                IssuesLiveRecord.builder()
                        .id("TICK_LAG")
                        .evidenceFingerprint("fp-same")
                        .message("still")
                        .build(),
                "2026-07-21T09:00:00Z");
        assertEquals(IssuesLiveSchema.STATUS_REVIEWED, again.get(0).status());
    }

    @Test
    void canonicalIssueKeyStripsDashboardPrefix() {
        assertEquals("DISK_HIGH", IssuesLiveStore.canonicalIssueKey("issue:DISK_HIGH"));
        assertEquals("DISK_HIGH", IssuesLiveStore.canonicalIssueKey("ISSUE:DISK_HIGH"));
        assertEquals("TICK_LAG", IssuesLiveStore.canonicalIssueKey("TICK_LAG"));
        List<IssuesLiveRecord> open = IssuesLiveStore.upsert(List.of(),
                IssuesLiveRecord.builder().id("DISK_HIGH").message("high").build(), "t0");
        List<IssuesLiveRecord> reviewed = IssuesLiveStore.markReviewed(open, "issue:DISK_HIGH", "t1");
        assertEquals(IssuesLiveSchema.STATUS_REVIEWED, reviewed.get(0).status());
        assertEquals(1, reviewed.size());
    }

    private static Path resolveFixture(String name) {
        Path fixture = Path.of("samples/fixtures/issues-live", name);
        if (!Files.isRegularFile(fixture)) {
            fixture = Path.of("..", "samples/fixtures/issues-live", name);
        }
        assertTrue(Files.isRegularFile(fixture), "fixture missing: " + fixture.toAbsolutePath());
        return fixture;
    }
}
