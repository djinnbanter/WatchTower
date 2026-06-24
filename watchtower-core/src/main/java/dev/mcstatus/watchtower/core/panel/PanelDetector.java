package dev.mcstatus.watchtower.core.panel;

import java.util.Optional;

/**
 * Detects a specific hosting panel from server layout and configuration.
 */
public interface PanelDetector {

    String id();

    int priority();

    Optional<PanelMatch> detect(PanelContext ctx);
}
