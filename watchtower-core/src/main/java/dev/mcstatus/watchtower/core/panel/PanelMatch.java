package dev.mcstatus.watchtower.core.panel;

/**
 * Result of a successful panel detector match (before running checks).
 */
public record PanelMatch(
        String panelId,
        String panelRoot,
        String pgrepPattern,
        String systemdUnit,
        boolean lifecycleSupported,
        boolean hasPanelDaemon
) {
}
