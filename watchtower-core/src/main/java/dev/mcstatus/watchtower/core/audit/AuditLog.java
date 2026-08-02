package dev.mcstatus.watchtower.core.audit;

import com.google.gson.Gson;
import dev.mcstatus.watchtower.core.util.WatchtowerPathLocks;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.nio.file.StandardOpenOption;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/** Append-only JSONL audit trail for dashboard actions (watchtower/audit-log.jsonl). */
public final class AuditLog {
    public static final int MAX_ENTRIES = 2000;
    public static final int RETENTION_DAYS = 90;

    private static final Gson GSON = new Gson();

    private AuditLog() {
    }

    /** Best effort: an audit write must never break the action it describes. */
    public static void append(Path auditPath, AuditEvent event) {
        if (auditPath == null || event == null) {
            return;
        }
        synchronized (WatchtowerPathLocks.lockFor(auditPath)) {
            try {
                Files.createDirectories(auditPath.getParent());
                Files.writeString(
                        auditPath,
                        GSON.toJson(event) + System.lineSeparator(),
                        StandardCharsets.UTF_8,
                        StandardOpenOption.CREATE,
                        StandardOpenOption.APPEND
                );
                prune(auditPath);
            } catch (IOException | RuntimeException ignored) {
                // Auditing is observability, not a transaction participant.
            }
        }
    }

    public static List<AuditEvent> read(Path auditPath, int limit) {
        if (auditPath == null || !Files.isRegularFile(auditPath)) {
            return List.of();
        }
        List<AuditEvent> parsed = new ArrayList<>();
        synchronized (WatchtowerPathLocks.lockFor(auditPath)) {
            try {
                for (String line : Files.readAllLines(auditPath, StandardCharsets.UTF_8)) {
                    AuditEvent row = parseOrNull(line);
                    if (row != null) {
                        parsed.add(row);
                    }
                }
            } catch (IOException e) {
                return List.of();
            }
        }
        Collections.reverse(parsed);
        int cap = limit > 0 ? Math.min(limit, parsed.size()) : parsed.size();
        return List.copyOf(parsed.subList(0, cap));
    }

    private static void prune(Path auditPath) throws IOException {
        List<String> lines = Files.readAllLines(auditPath, StandardCharsets.UTF_8);
        Instant cutoff = Instant.now().minus(RETENTION_DAYS, ChronoUnit.DAYS);
        List<String> kept = new ArrayList<>(lines.size());
        for (String line : lines) {
            AuditEvent row = parseOrNull(line);
            if (row == null) {
                continue;
            }
            if (isBefore(row.at(), cutoff)) {
                continue;
            }
            kept.add(line);
        }
        if (kept.size() > MAX_ENTRIES) {
            kept = new ArrayList<>(kept.subList(kept.size() - MAX_ENTRIES, kept.size()));
        }
        if (kept.size() == lines.size()) {
            return;
        }
        Path temp = auditPath.resolveSibling(auditPath.getFileName() + ".tmp");
        Files.writeString(temp, String.join(System.lineSeparator(), kept)
                + (kept.isEmpty() ? "" : System.lineSeparator()), StandardCharsets.UTF_8);
        Files.move(temp, auditPath, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
    }

    private static AuditEvent parseOrNull(String line) {
        if (line == null || line.isBlank()) {
            return null;
        }
        try {
            AuditEvent row = GSON.fromJson(line, AuditEvent.class);
            return row != null && row.event() != null ? row : null;
        } catch (RuntimeException e) {
            return null;
        }
    }

    private static boolean isBefore(String isoInstant, Instant cutoff) {
        if (isoInstant == null) {
            return false;
        }
        try {
            return Instant.parse(isoInstant).isBefore(cutoff);
        } catch (RuntimeException e) {
            return false;
        }
    }
}
