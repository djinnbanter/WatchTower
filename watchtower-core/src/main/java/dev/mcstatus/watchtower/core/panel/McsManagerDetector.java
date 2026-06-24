package dev.mcstatus.watchtower.core.panel;

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

public final class McsManagerDetector implements PanelDetector {

    private static final String PGREP = "mcsmanager";

    @Override
    public String id() {
        return "mcsmanager";
    }

    @Override
    public int priority() {
        return 80;
    }

    @Override
    public Optional<PanelMatch> detect(PanelContext ctx) {
        boolean forced = "mcsmanager".equals(ctx.panelMode());
        for (Path root : roots(ctx)) {
            if (!PanelPaths.isDirectory(root)) {
                continue;
            }
            boolean configured = ctx.pathFromConf("MCSM_ROOT") != null
                    && root.normalize().equals(ctx.pathFromConf("MCSM_ROOT").normalize());
            if (!forced && !configured
                    && !PanelPaths.pathContains(ctx.serverDir(), "mcsmanager")
                    && !PanelPaths.pathContains(root, "mcsmanager")) {
                continue;
            }
            String unit = ctx.confOrEnv("SYSTEMD_UNIT");
            return Optional.of(new PanelMatch(
                    "mcsmanager",
                    root.toString(),
                    PGREP,
                    unit.isEmpty() ? null : unit,
                    false,
                    true
            ));
        }
        return Optional.empty();
    }

    private List<Path> roots(PanelContext ctx) {
        List<Path> out = new ArrayList<>();
        Path configured = ctx.pathFromConf("MCSM_ROOT");
        if (configured != null) {
            out.add(configured);
        }
        if (PanelPaths.pathContains(ctx.serverDir(), "mcsmanager")) {
            Path cur = ctx.serverDir();
            while (cur != null) {
                if (PanelPaths.pathContains(cur, "mcsmanager")) {
                    out.add(cur);
                }
                cur = cur.getParent();
            }
        }
        out.add(Path.of("/opt/mcsmanager"));
        out.add(Path.of("/home/mcsmanager"));
        return out;
    }
}
