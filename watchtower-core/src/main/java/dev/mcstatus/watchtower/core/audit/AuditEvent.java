package dev.mcstatus.watchtower.core.audit;

import dev.mcstatus.watchtower.core.auth.AccountRole;

import java.time.Instant;

/** One append-only audit row. */
public record AuditEvent(
        String at,
        String event,
        String actor,
        String actorId,
        String role,
        String target,
        String detail,
        String ip,
        String result
) {
    public static final String OK = "ok";
    public static final String DENIED = "denied";
    public static final String FAILED = "failed";

    public static AuditEvent of(
            String event,
            String actor,
            String actorId,
            AccountRole role,
            String target,
            String detail,
            String ip,
            String result
    ) {
        return new AuditEvent(
                Instant.now().toString(),
                event,
                actor != null && !actor.isBlank() ? actor : "unknown",
                actorId,
                role != null ? role.wire() : null,
                target,
                detail,
                ip,
                result != null ? result : OK
        );
    }
}
