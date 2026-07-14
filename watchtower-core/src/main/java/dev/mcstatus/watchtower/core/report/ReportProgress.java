package dev.mcstatus.watchtower.core.report;

/**
 * Optional callback for coarse report pipeline stages (dashboard checklist).
 * {@link #detail(String)} is for finer in-stage status text while a long step runs.
 */
@FunctionalInterface
public interface ReportProgress {

    ReportProgress NOOP = new ReportProgress() {
        @Override
        public void stage(String id, String label) {
        }
    };

    void stage(String id, String label);

    /** Finer status under the current stage (e.g. "Scanning server logs…"). */
    default void detail(String message) {
    }
}
