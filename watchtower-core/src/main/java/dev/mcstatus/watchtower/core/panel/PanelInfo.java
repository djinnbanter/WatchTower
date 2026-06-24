package dev.mcstatus.watchtower.core.panel;

/**
 * Resolved panel environment for report staging.
 */
public record PanelInfo(
        String panelId,
        String panelRoot,
        boolean panelRunning,
        boolean hasPanelDaemon,
        boolean lifecycleSupported
) {
    public static PanelInfo unknown() {
        return new PanelInfo("unknown", null, false, false, false);
    }

    public static PanelInfo nativeLinux() {
        return new PanelInfo("none", null, false, false, false);
    }

    public static PanelInfo fromMatch(PanelMatch match, boolean running) {
        return new PanelInfo(
                match.panelId(),
                match.panelRoot(),
                running,
                match.hasPanelDaemon(),
                match.lifecycleSupported()
        );
    }
}
