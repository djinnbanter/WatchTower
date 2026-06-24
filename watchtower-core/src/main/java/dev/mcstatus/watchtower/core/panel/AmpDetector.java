package dev.mcstatus.watchtower.core.panel;

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

public final class AmpDetector implements PanelDetector {

    private static final String PGREP = "AMP_|InstanceManager|ampinstmgr";

    @Override
    public String id() {
        return "amp";
    }

    @Override
    public int priority() {
        return 75;
    }

    @Override
    public Optional<PanelMatch> detect(PanelContext ctx) {
        boolean forced = "amp".equals(ctx.panelMode());
        for (Path root : roots(ctx)) {
            Path instances = root.resolve("Instances");
            if (!PanelPaths.isDirectory(instances)) {
                continue;
            }
            if (!forced && !underInstances(ctx.serverDir(), instances)
                    && !PanelPaths.pathContains(ctx.serverDir(), ".ampdata")) {
                continue;
            }
            String unit = ctx.confOrEnv("SYSTEMD_UNIT");
            return Optional.of(new PanelMatch(
                    "amp",
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
        Path configured = ctx.pathFromConf("AMP_ROOT");
        if (configured != null) {
            out.add(configured);
        }
        if (PanelPaths.pathContains(ctx.serverDir(), ".ampdata")) {
            Path ampData = findAmpDataRoot(ctx.serverDir());
            if (ampData != null) {
                out.add(ampData);
            }
        }
        out.add(Path.of("/home/amp/.ampdata"));
        return out;
    }

    private Path findAmpDataRoot(Path serverDir) {
        Path cur = serverDir;
        while (cur != null) {
            if (".ampdata".equalsIgnoreCase(String.valueOf(cur.getFileName()))) {
                return cur;
            }
            cur = cur.getParent();
        }
        return null;
    }

    private boolean underInstances(Path serverDir, Path instancesDir) {
        if (serverDir == null) {
            return false;
        }
        Path parent = serverDir.getParent();
        return parent != null && parent.normalize().equals(instancesDir.normalize());
    }
}
