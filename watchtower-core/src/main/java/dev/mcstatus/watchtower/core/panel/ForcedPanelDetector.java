package dev.mcstatus.watchtower.core.panel;

import java.nio.file.Path;
import java.util.Optional;

/**
 * Forced-only panels (tcadmin, wisp, pebblehost) via PANEL + PANEL_ROOT.
 */
public final class ForcedPanelDetector implements PanelDetector {

    private final String panelId;
    private final String pgrepPattern;
    private final int priority;

    public ForcedPanelDetector(String panelId, String pgrepPattern, int priority) {
        this.panelId = panelId;
        this.pgrepPattern = pgrepPattern;
        this.priority = priority;
    }

    @Override
    public String id() {
        return panelId;
    }

    @Override
    public int priority() {
        return priority;
    }

    @Override
    public Optional<PanelMatch> detect(PanelContext ctx) {
        String root = ctx.confOrEnv("PANEL_ROOT");
        if (root.isEmpty()) {
            return Optional.empty();
        }
        String unit = ctx.confOrEnv("SYSTEMD_UNIT");
        return Optional.of(new PanelMatch(
                panelId,
                Path.of(root).toString(),
                pgrepPattern,
                unit.isEmpty() ? null : unit,
                false,
                true
        ));
    }
}
