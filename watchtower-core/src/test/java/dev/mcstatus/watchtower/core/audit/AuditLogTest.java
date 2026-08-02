package dev.mcstatus.watchtower.core.audit;

import dev.mcstatus.watchtower.core.auth.AccountRole;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class AuditLogTest {
    @TempDir
    Path tempDir;

    @Test
    void appendThenReadReturnsNewestFirst() {
        Path log = tempDir.resolve("audit-log.jsonl");
        AuditLog.append(log, AuditEvent.of("settings_changed", "ella", "acc_1", AccountRole.OWNER,
                "tps_warn", "19.5 -> 18.5", "10.0.0.4", "ok"));
        AuditLog.append(log, AuditEvent.of("issue_acked", "marco", "acc_2", AccountRole.ADMIN,
                "DISK_LOW", null, "10.0.0.9", "ok"));

        List<AuditEvent> rows = AuditLog.read(log, 10);

        assertEquals(2, rows.size());
        assertEquals("issue_acked", rows.get(0).event());
        assertEquals("marco", rows.get(0).actor());
        assertEquals("settings_changed", rows.get(1).event());
        assertEquals("19.5 -> 18.5", rows.get(1).detail());
    }

    @Test
    void readHonoursLimit() {
        Path log = tempDir.resolve("audit-log.jsonl");
        for (int i = 0; i < 5; i++) {
            AuditLog.append(log, AuditEvent.of("api_write", "ella", "acc_1", AccountRole.OWNER,
                    "POST /api/mods/scan", null, "10.0.0.4", "ok"));
        }
        assertEquals(2, AuditLog.read(log, 2).size());
    }

    @Test
    void appendPrunesBeyondMaxEntries() throws Exception {
        Path log = tempDir.resolve("audit-log.jsonl");
        for (int i = 0; i < AuditLog.MAX_ENTRIES + 25; i++) {
            AuditLog.append(log, AuditEvent.of("api_write", "ella", "acc_1", AccountRole.OWNER,
                    "POST /api/crashes/scan", "n=" + i, "10.0.0.4", "ok"));
        }
        assertEquals(AuditLog.MAX_ENTRIES, Files.readAllLines(log).size());
        // Oldest rows are the ones dropped.
        assertEquals("n=" + (AuditLog.MAX_ENTRIES + 24), AuditLog.read(log, 1).get(0).detail());
    }

    @Test
    void appendDropsRowsOlderThanRetention() throws Exception {
        Path log = tempDir.resolve("audit-log.jsonl");
        String stale = "{\"at\":\"" + Instant.now().minus(RETENTION_PLUS, ChronoUnit.DAYS)
                + "\",\"event\":\"login_ok\",\"actor\":\"ghost\",\"result\":\"ok\"}";
        Files.writeString(log, stale + System.lineSeparator());

        AuditLog.append(log, AuditEvent.of("login_ok", "ella", "acc_1", AccountRole.OWNER,
                null, null, "10.0.0.4", "ok"));

        List<AuditEvent> rows = AuditLog.read(log, 10);
        assertEquals(1, rows.size());
        assertEquals("ella", rows.get(0).actor());
    }

    @Test
    void corruptLinesAreSkippedNotFatal() throws Exception {
        Path log = tempDir.resolve("audit-log.jsonl");
        Files.writeString(log, "not json at all" + System.lineSeparator());
        AuditLog.append(log, AuditEvent.of("logout", "ella", "acc_1", AccountRole.OWNER,
                null, null, "10.0.0.4", "ok"));

        List<AuditEvent> rows = AuditLog.read(log, 10);
        assertEquals(1, rows.size());
        assertEquals("logout", rows.get(0).event());
    }

    @Test
    void readMissingFileReturnsEmpty() {
        assertTrue(AuditLog.read(tempDir.resolve("nope.jsonl"), 10).isEmpty());
    }

    private static final long RETENTION_PLUS = AuditLog.RETENTION_DAYS + 1L;
}
