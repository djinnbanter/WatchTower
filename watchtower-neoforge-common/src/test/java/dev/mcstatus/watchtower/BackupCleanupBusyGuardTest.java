package dev.mcstatus.watchtower;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class BackupCleanupBusyGuardTest {
    @Test
    void rejectsWhenRestoreBusyOrJobRunning() {
        assertTrue(DashboardHttpServer.shouldRejectCleanupBecauseBusy(true, "idle"));
        assertTrue(DashboardHttpServer.shouldRejectCleanupBecauseBusy(false, "running"));
        assertFalse(DashboardHttpServer.shouldRejectCleanupBecauseBusy(false, "ok"));
        assertFalse(DashboardHttpServer.shouldRejectCleanupBecauseBusy(false, null));
    }
}
