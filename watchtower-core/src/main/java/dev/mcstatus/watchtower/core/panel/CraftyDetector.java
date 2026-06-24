package dev.mcstatus.watchtower.core.panel;

import java.nio.file.Path;
import java.util.Optional;

public final class CraftyDetector implements PanelDetector {

    private static final String PGREP = "python.*main.py";

    @Override
    public String id() {
        return "crafty";
    }

    @Override
    public int priority() {
        return 100;
    }

    @Override
    public Optional<PanelMatch> detect(PanelContext ctx) {
        for (Path candidate : PanelPaths.craftyRootCandidates(ctx)) {
            if (!PanelPaths.isCraftyInstall(candidate)) {
                continue;
            }
            String unit = ctx.confOrEnv("SYSTEMD_UNIT", "CRAFTY_SYSTEMD_UNIT");
            if (unit.isEmpty()) {
                unit = "crafty.service";
            }
            return Optional.of(new PanelMatch(
                    "crafty",
                    candidate.toString(),
                    PGREP,
                    unit,
                    true,
                    true
            ));
        }
        return Optional.empty();
    }
}
