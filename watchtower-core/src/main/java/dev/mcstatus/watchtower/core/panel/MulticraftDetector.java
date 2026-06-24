package dev.mcstatus.watchtower.core.panel;

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

public final class MulticraftDetector implements PanelDetector {

    private static final String PGREP = "multicraft";

    @Override
    public String id() {
        return "multicraft";
    }

    @Override
    public int priority() {
        return 70;
    }

    @Override
    public Optional<PanelMatch> detect(PanelContext ctx) {
        boolean forced = "multicraft".equals(ctx.panelMode());
        for (Path root : roots(ctx)) {
            Path servers = root.resolve("servers");
            if (!PanelPaths.isDirectory(servers)) {
                continue;
            }
            boolean configured = ctx.pathFromConf("MULTICRAFT_ROOT") != null
                    && root.normalize().equals(ctx.pathFromConf("MULTICRAFT_ROOT").normalize());
            if (!underServers(ctx.serverDir(), servers)) {
                continue;
            }
            if (!forced && !configured
                    && !PanelPaths.pathContains(root, "multicraft")
                    && !PanelPaths.pathContains(ctx.serverDir(), "multicraft")) {
                continue;
            }
            String unit = ctx.confOrEnv("SYSTEMD_UNIT");
            return Optional.of(new PanelMatch(
                    "multicraft",
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
        Path configured = ctx.pathFromConf("MULTICRAFT_ROOT");
        if (configured != null) {
            out.add(configured);
        }
        Path parent = ctx.serverDir().getParent();
        if (parent != null && "servers".equalsIgnoreCase(String.valueOf(parent.getFileName()))) {
            Path grand = parent.getParent();
            if (grand != null && PanelPaths.pathContains(grand, "multicraft")) {
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
