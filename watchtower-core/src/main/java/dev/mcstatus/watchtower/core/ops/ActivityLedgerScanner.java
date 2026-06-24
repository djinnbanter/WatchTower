package dev.mcstatus.watchtower.core.ops;

import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.report.StateManager;

import java.io.IOException;
import java.nio.file.Path;
import java.time.Instant;
import java.util.List;

/**
 * Incremental and tail log scan for Activity ledger events.
 * Delegates to {@link OpsLogTailScanner} for unified log processing.
 */
public final class ActivityLedgerScanner {

    public static final int MAX_LEDGER_EVENTS = OpsLogTailScanner.MAX_LEDGER_EVENTS;
    public static final int DEFAULT_TAIL_LINES = OpsLogTailScanner.DEFAULT_TAIL_LINES;

    public record ScanResult(
            Instant scannedAt,
            int newCount,
            List<JsonObject> events,
            JsonObject updatedOffset,
            JsonObject context
    ) {
    }

    private ActivityLedgerScanner() {
    }

    public static ScanResult scanIncremental(String serverDir, Path statePath, int tickLagThrottleMs)
            throws IOException {
        OpsLogTailScanner.ScanResult scan = OpsLogTailScanner.scanIncremental(serverDir, statePath, tickLagThrottleMs);
        return toActivityResult(scan);
    }

    public static ScanResult scanTail(String serverDir, int maxLines, int tickLagThrottleMs) throws IOException {
        OpsLogTailScanner.ScanResult scan = OpsLogTailScanner.scanTail(serverDir, maxLines, tickLagThrottleMs);
        return toActivityResult(scan);
    }

    public static JsonObject lagIncidentEvent(String incidentId, Instant when) {
        return OpsLogTailScanner.lagIncidentEvent(incidentId, when);
    }

    private static ScanResult toActivityResult(OpsLogTailScanner.ScanResult scan) {
        return new ScanResult(
                scan.scannedAt(),
                scan.newActivityCount(),
                scan.activityEvents(),
                scan.updatedOffset(),
                scan.context()
        );
    }
}
