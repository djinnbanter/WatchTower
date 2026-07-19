package dev.mcstatus.watchtower.core.collect;

/**
 * Observes the dedicated, network-owning Modrinth scan. Implementations may update an HTTP
 * status endpoint; callers that do not need progress can use {@link #NOOP}.
 */
public interface ModrinthScanProgress {
    ModrinthScanProgress NOOP = new ModrinthScanProgress() {
        @Override
        public void stage(String id, String label) {
        }
    };

    void stage(String id, String label);

    default void detail(String message) {
    }

    default void progress(int done, int total) {
    }

    default void batch(int index, int count, int size) {
    }

    default void etaSeconds(Integer seconds) {
    }
}
