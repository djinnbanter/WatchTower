package dev.mcstatus.watchtower;

import dev.mcstatus.watchtower.core.audit.AuditEvent;
import dev.mcstatus.watchtower.core.audit.AuditLog;
import dev.mcstatus.watchtower.core.auth.SessionManager;

/** Records dashboard audit rows; no-ops until auth services are initialized. */
public final class DashboardAudit {
    private DashboardAudit() {
    }

    public static void record(String event, SessionManager.SessionState session,
                              String target, String detail, String ip) {
        if (session == null) {
            return;
        }
        AuditLog.append(DashboardAuthServices.auditPath(), AuditEvent.of(
                event, session.username(), session.accountId(), session.role(),
                target, detail, ip, AuditEvent.OK));
    }

    public static void recordDenied(SessionManager.SessionState session, String target, String ip) {
        if (session == null) {
            return;
        }
        AuditLog.append(DashboardAuthServices.auditPath(), AuditEvent.of(
                "write_denied", session.username(), session.accountId(), session.role(),
                target, null, ip, AuditEvent.DENIED));
    }

    public static void recordAnonymous(String event, String username, String target, String ip, String result) {
        AuditLog.append(DashboardAuthServices.auditPath(), AuditEvent.of(
                event, username, null, null, target, null, ip, result));
    }
}
