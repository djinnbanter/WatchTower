package dev.mcstatus.watchtower.core.panel;

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

public final class PufferPanelDetector implements PanelDetector {

    private static final String PGREP = "pufferd";

    @Override
    public String id() {
        return "pufferpanel";
    }

    @Override
    public int priority() {
        return 85;
    }

    @Override
    public Optional<PanelMatch> detect(PanelContext ctx) {
        boolean forced = "pufferpanel".equals(ctx.panelMode());
        for (Path root : roots(ctx)) {
            Path servers = root.resolve("servers");
            if (!PanelPaths.isDirectory(servers)) {
                continue;
            }
            if (!underServers(ctx.serverDir(), servers)) {
                continue;
            }
            if (!forced && ctx.pathFromConf("PUFFER_ROOT") == null
                    && !PanelPaths.pathContains(root, "pufferpanel")
                    && !PanelPaths.pathContains(ctx.serverDir(), "pufferpanel")) {
                continue;
            }
            String unit = ctx.confOrEnv("SYSTEMD_UNIT");
            return Optional.of(new PanelMatch(
                    "pufferpanel",
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
        Path configured = ctx.pathFromConf("PUFFER_ROOT");
        if (configured != null) {
            out.add(configured);
        }
        out.add(Path.of("/var/lib/pufferpanel"));
        Path parent = ctx.serverDir().getParent();
        if (parent != null && "servers".equalsIgnoreCase(String.valueOf(parent.getFileName()))) {
            Path grand = parent.getParent();
            if (grand != null && PanelPaths.pathContains(grand, "pufferpanel")) {
                out.add(grand);
            }
        }
        return out;
    }

    private boolean underServers(Path serverDir, Path serversDir) {
        if (serverDir == null) {
            return false;
        }
        Path parent = serverDir.getParent();
        return parent != null && parent.normalize().equals(serversDir.normalize());
    }
}
