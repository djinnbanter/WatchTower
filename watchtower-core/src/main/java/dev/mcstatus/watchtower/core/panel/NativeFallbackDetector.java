package dev.mcstatus.watchtower.core.panel;

import java.util.Optional;

public final class NativeFallbackDetector implements PanelDetector {

    @Override
    public String id() {
        return "none";
    }

    @Override
    public int priority() {
        return 0;
    }

    @Override
    public Optional<PanelMatch> detect(PanelContext ctx) {
        return Optional.of(new PanelMatch(
                "none",
                null,
                null,
                null,
                false,
                false
        ));
    }
}
