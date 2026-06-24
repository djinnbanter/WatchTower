package dev.mcstatus.watchtower.core.panel;

import java.util.Optional;

public final class DockerDetector implements PanelDetector {

    @Override
    public String id() {
        return "docker";
    }

    @Override
    public int priority() {
        return 60;
    }

    @Override
    public Optional<PanelMatch> detect(PanelContext ctx) {
        if (ProcessChecks.isDockerContainer()) {
            return Optional.of(new PanelMatch(
                    "docker",
                    null,
                    null,
                    null,
                    false,
                    false
            ));
        }
        if (PanelPaths.pathContains(ctx.serverDir(), "/docker/")) {
            return Optional.of(new PanelMatch(
                    "docker",
                    null,
                    null,
                    null,
                    false,
                    false
            ));
        }
        return Optional.empty();
    }
}
