package dev.mcstatus.watchtower.core.report;

/**
 * Optional callback for coarse report pipeline stages (dashboard checklist).
 * {@link #detail(String)} is for finer in-stage status text while a long step runs.
 * {@link #units(int, int)} and {@link #found(String, int)} power per-item discovery progress.
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

    /** Per-item progress within the current stage (1-based done, total items). */
    default void units(int done, int total) {
    }

    /**
     * Live inventory count for the wizard (e.g. {@code logs}, {@code crashes}, {@code jars}).
     * Callers pass the current total found so far.
     */
    default void found(String key, int count) {
    }

    /**
     * Collect-phase sub-step (1-based). Default encodes into {@link #detail(String)}
     * and {@link #units(int, int)}.
     */
    default void collectStep(int step, int total, String message) {
        String msg = message != null ? message : "";
        if (total > 0 && step > 0) {
            detail("[" + step + "/" + total + "] " + msg);
            units(step, total);
        } else {
            detail(msg);
        }
    }
}
