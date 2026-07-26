package dev.mcstatus.watchtower.core.analyze;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class SafeRestartAdvisorTest {

    private static final String NOW = "2026-07-20T12:00:00Z";

    @Test
    void safeWhenFreshBackupNoPregenNoPlayers() {
        JsonObject r = SafeRestartAdvisor.evaluate(baseFresh());
        assertEquals(SafeRestartAdvisor.VERDICT_SAFE, r.get("verdict").getAsString());
        assertEquals("Safe to restart", r.get("headline").getAsString());
        assertTrue(r.get("summary").getAsString().toLowerCase().contains("blocking"));
        assertTrue(hasReason(r, "backup_ok") || hasReason(r, "pregen_clear"));
    }

    @Test
    void waitWhenPregenActive() {
        JsonObject in = baseFresh();
        JsonObject chunky = new JsonObject();
        chunky.addProperty("pregen_active", true);
        in.add("chunky_pregen", chunky);
        JsonObject r = SafeRestartAdvisor.evaluate(in);
        assertEquals(SafeRestartAdvisor.VERDICT_WAIT, r.get("verdict").getAsString());
        assertTrue(hasReasonSeverity(r, "pregen_active", SafeRestartAdvisor.SEV_BLOCKER));
    }

    @Test
    void waitWhenBackupStale() {
        JsonObject in = emptyNow();
        JsonObject last = new JsonObject();
        last.addProperty("status", "stale");
        last.addProperty("stale", true);
        last.addProperty("age_days", 12);
        in.add("last_backup", last);
        JsonObject r = SafeRestartAdvisor.evaluate(in);
        assertEquals(SafeRestartAdvisor.VERDICT_WAIT, r.get("verdict").getAsString());
        assertTrue(hasReasonSeverity(r, "backup_stale", SafeRestartAdvisor.SEV_BLOCKER));
    }

    @Test
    void cautionWhenBackupSoftAging() {
        JsonObject in = emptyNow();
        // warn 7d = 168h; soft 1.5x = 252h; age 200h is aging caution
        JsonObject live = new JsonObject();
        JsonObject lb = new JsonObject();
        lb.addProperty("age_hours", 200);
        live.add("last_backup", lb);
        in.add("backups_live", live);
        JsonObject r = SafeRestartAdvisor.evaluate(in);
        assertEquals(SafeRestartAdvisor.VERDICT_CAUTION, r.get("verdict").getAsString());
        assertTrue(hasReasonSeverity(r, "backup_aging", SafeRestartAdvisor.SEV_CAUTION));
    }

    @Test
    void playersOnlineAloneStillSafe() {
        JsonObject in = baseFresh();
        in.addProperty("players_online", 3);
        JsonObject r = SafeRestartAdvisor.evaluate(in);
        assertEquals(SafeRestartAdvisor.VERDICT_SAFE, r.get("verdict").getAsString());
        assertTrue(hasReasonSeverity(r, "players_online", SafeRestartAdvisor.SEV_INFO));
        assertEquals(3, r.getAsJsonObject("context").get("players_online").getAsInt());
    }

    @Test
    void waitWhenDiskCritical() {
        JsonObject in = baseFresh();
        in.addProperty("disk_use_pct", 90);
        JsonObject r = SafeRestartAdvisor.evaluate(in);
        assertEquals(SafeRestartAdvisor.VERDICT_WAIT, r.get("verdict").getAsString());
        assertTrue(hasReasonSeverity(r, "disk_critical", SafeRestartAdvisor.SEV_BLOCKER));
    }

    @Test
    void cautionWhenRecentUnreviewedCrash() {
        JsonObject in = baseFresh();
        JsonObject crashes = new JsonObject();
        crashes.addProperty("unreviewed", 2);
        crashes.addProperty("latest_at", "2026-07-20T10:00:00Z"); // 2h before NOW
        crashes.addProperty("latest_unreviewed_at", "2026-07-20T10:00:00Z");
        in.add("crashes", crashes);
        JsonObject r = SafeRestartAdvisor.evaluate(in);
        assertEquals(SafeRestartAdvisor.VERDICT_CAUTION, r.get("verdict").getAsString());
        assertTrue(hasReasonSeverity(r, "recent_crash", SafeRestartAdvisor.SEV_CAUTION));
    }

    @Test
    void doesNotUseAcknowledgedLatestAtForRecentCrash() {
        JsonObject in = baseFresh();
        JsonObject crashes = new JsonObject();
        crashes.addProperty("unreviewed", 1);
        // Newest file is acknowledged; only count says unreviewed remain
        crashes.addProperty("latest_at", "2026-07-20T11:00:00Z");
        in.add("crashes", crashes);
        JsonObject r = SafeRestartAdvisor.evaluate(in);
        assertEquals(SafeRestartAdvisor.VERDICT_CAUTION, r.get("verdict").getAsString());
        assertTrue(hasReason(r, "unreviewed_crashes"));
        assertFalse(hasReason(r, "recent_crash"));
    }

    @Test
    void waitListsBothPregenAndStaleBackup() {
        JsonObject in = emptyNow();
        JsonObject last = new JsonObject();
        last.addProperty("status", "stale");
        last.addProperty("stale", true);
        last.addProperty("age_days", 14);
        in.add("last_backup", last);
        JsonObject dh = new JsonObject();
        dh.addProperty("pregen_active", true);
        in.add("dh_pregen", dh);
        JsonObject r = SafeRestartAdvisor.evaluate(in);
        assertEquals(SafeRestartAdvisor.VERDICT_WAIT, r.get("verdict").getAsString());
        assertTrue(hasReason(r, "pregen_active"));
        assertTrue(hasReason(r, "backup_stale"));
    }

    @Test
    void cautionWhenDiskWarnBand() {
        JsonObject in = baseFresh();
        in.addProperty("disk_use_pct", 80);
        JsonObject r = SafeRestartAdvisor.evaluate(in);
        assertEquals(SafeRestartAdvisor.VERDICT_CAUTION, r.get("verdict").getAsString());
        assertTrue(hasReasonSeverity(r, "disk_warn", SafeRestartAdvisor.SEV_CAUTION));
    }

    @Test
    void cautionWhenHealthCritical() {
        JsonObject in = baseFresh();
        in.addProperty("scorecard_grade", "critical");
        JsonObject r = SafeRestartAdvisor.evaluate(in);
        assertEquals(SafeRestartAdvisor.VERDICT_CAUTION, r.get("verdict").getAsString());
        assertTrue(hasReasonSeverity(r, "health_critical", SafeRestartAdvisor.SEV_CAUTION));
    }

    @Test
    void hybridFreshExternalBeatsStaleLocal() {
        JsonObject in = emptyNow();
        JsonObject last = new JsonObject();
        last.addProperty("status", "stale");
        last.addProperty("stale", true);
        last.addProperty("age_days", 14);
        in.add("last_backup", last);
        JsonObject live = new JsonObject();
        JsonObject lb = new JsonObject();
        lb.addProperty("age_hours", 14 * 24);
        live.add("last_backup", lb);
        in.add("backups_live", live);
        JsonObject ext = new JsonObject();
        ext.addProperty("configured", true);
        ext.addProperty("status", "success");
        ext.addProperty("stale", false);
        ext.addProperty("age_hours", 2.5);
        in.add("backup_external", ext);
        in.addProperty("disk_use_pct", 40);
        JsonObject r = SafeRestartAdvisor.evaluate(in);
        assertEquals(SafeRestartAdvisor.VERDICT_SAFE, r.get("verdict").getAsString());
        assertEquals(2.5, r.getAsJsonObject("context").get("backup_age_hours").getAsDouble(), 0.01);
        assertFalse(hasReason(r, "backup_stale"));
        assertFalse(hasReason(r, "backup_aging"));
    }

    @Test
    void trackingDisabledSkipsBackupMissing() {
        JsonObject in = emptyNow();
        in.addProperty("backup_tracking_enabled", false);
        in.addProperty("disk_use_pct", 40);
        JsonObject r = SafeRestartAdvisor.evaluate(in);
        assertEquals(SafeRestartAdvisor.VERDICT_SAFE, r.get("verdict").getAsString());
        assertFalse(hasReason(r, "backup_missing"));
        assertFalse(hasReason(r, "backup_stale"));
    }

    @Test
    void diskNudgeAloneIsWait() {
        JsonObject in = baseFresh();
        JsonObject nudge = new JsonObject();
        nudge.addProperty("active", true);
        nudge.addProperty("message", "Only 1.0 GB free — less than the newest backup (18.4 GB).");
        in.add("disk_nudge", nudge);
        JsonObject r = SafeRestartAdvisor.evaluate(in);
        assertEquals(SafeRestartAdvisor.VERDICT_WAIT, r.get("verdict").getAsString());
        assertTrue(hasReasonSeverity(r, "disk_critical", SafeRestartAdvisor.SEV_BLOCKER));
    }

    @Test
    void cautionWhenRecentCrashWithOffsetTimestamp() {
        JsonObject in = baseFresh();
        JsonObject crashes = new JsonObject();
        crashes.addProperty("unreviewed", 1);
        crashes.addProperty("latest_unreviewed_at", "2026-07-20T10:30:00+00:00");
        in.add("crashes", crashes);
        JsonObject r = SafeRestartAdvisor.evaluate(in);
        assertEquals(SafeRestartAdvisor.VERDICT_CAUTION, r.get("verdict").getAsString());
        assertTrue(hasReasonSeverity(r, "recent_crash", SafeRestartAdvisor.SEV_CAUTION));
    }

    @Test
    void preservesCheckedAtWhenChecklistUnchanged() {
        JsonObject first = SafeRestartAdvisor.evaluate(baseFresh());
        String checked = first.get("checked_at").getAsString();
        JsonObject againIn = baseFresh();
        againIn.addProperty("now", "2026-07-20T13:00:00Z");
        againIn.add("previous", first);
        JsonObject second = SafeRestartAdvisor.evaluate(againIn);
        assertEquals(checked, second.get("checked_at").getAsString());
        assertEquals(SafeRestartAdvisor.VERDICT_SAFE, second.get("verdict").getAsString());
    }

    private static JsonObject emptyNow() {
        JsonObject in = new JsonObject();
        in.addProperty("now", NOW);
        in.addProperty("backup_warn_days", 7);
        in.addProperty("disk_warn_pct", 85);
        in.addProperty("lookback_hours", 24);
        in.addProperty("backup_tracking_enabled", true);
        return in;
    }

    private static JsonObject baseFresh() {
        JsonObject in = emptyNow();
        JsonObject live = new JsonObject();
        JsonObject lb = new JsonObject();
        lb.addProperty("age_hours", 3);
        live.add("last_backup", lb);
        in.add("backups_live", live);
        in.addProperty("players_online", 0);
        in.addProperty("disk_use_pct", 40);
        return in;
    }

    private static boolean hasReason(JsonObject r, String id) {
        JsonArray reasons = r.getAsJsonArray("reasons");
        for (int i = 0; i < reasons.size(); i++) {
            if (id.equals(reasons.get(i).getAsJsonObject().get("id").getAsString())) {
                return true;
            }
        }
        return false;
    }

    private static boolean hasReasonSeverity(JsonObject r, String id, String severity) {
        JsonArray reasons = r.getAsJsonArray("reasons");
        for (int i = 0; i < reasons.size(); i++) {
            JsonObject row = reasons.get(i).getAsJsonObject();
            if (id.equals(row.get("id").getAsString())) {
                return severity.equals(row.get("severity").getAsString());
            }
        }
        return false;
    }
}
