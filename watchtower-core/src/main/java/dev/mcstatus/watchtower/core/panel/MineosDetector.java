package dev.mcstatus.watchtower.core.panel;

import java.nio.file.Path;
import java.util.Optional;

public final class MineosDetector implements PanelDetector {

    private static final String PGREP = "mineos";

    @Override
    public String id() {
        return "mineos";
    }

    @Override
    public int priority() {
        return 65;
    }

    @Override
    public Optional<PanelMatch> detect(PanelContext ctx) {
        Path mineosRoot = mineosRootFromServerDir(ctx.serverDir());
        if (mineosRoot == null) {
            return Optional.empty();
        }
        return match(ctx, mineosRoot);
    }

    static Path mineosRootFromServerDir(Path serverDir) {
        Path parent = serverDir != null ? serverDir.getParent() : null;
        if (parent == null || !"servers".equalsIgnoreCase(String.valueOf(parent.getFileName()))) {
            return null;
        }
        Path gamesMinecraft = parent.getParent();
        if (gamesMinecraft == null) {
            return null;
        }
        if (!PanelPaths.pathContains(gamesMinecraft, "games")
                || !PanelPaths.pathContains(gamesMinecraft, "minecraft")) {
            return null;
        }
        return gamesMinecraft;
    }

    private Optional<PanelMatch> match(PanelContext ctx, Path root) {
        String unit = ctx.confOrEnv("SYSTEMD_UNIT");
        return Optional.of(new PanelMatch(
                "mineos",
                root.toString(),
                PGREP,
                unit.isEmpty() ? null : unit,
                false,
                true
        ));
    }
}
