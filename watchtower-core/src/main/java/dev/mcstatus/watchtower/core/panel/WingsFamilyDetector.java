package dev.mcstatus.watchtower.core.panel;

import java.nio.file.Path;
import java.util.Optional;

/**
 * Shared Wings layout for Pterodactyl and Pelican.
 */
abstract class WingsFamilyDetector implements PanelDetector {

    private static final String PGREP = "[w]ings";

    abstract String rootConfigKey();

    abstract String defaultRoot();

    abstract String pathMarker();

    abstract String systemdDefault();

    @Override
    public Optional<PanelMatch> detect(PanelContext ctx) {
        boolean forced = id().equals(ctx.panelMode());
        Path configured = ctx.pathFromConf(rootConfigKey());
        if (configured == null && forced) {
            configured = Path.of(defaultRoot());
        }
        Optional<PanelMatch> fromConfigured = matchRoot(configured, ctx, forced);
        if (fromConfigured.isPresent()) {
            return fromConfigured;
        }
        Path fromServer = PanelPaths.volumeRootFromServerDir(ctx.serverDir(), null);
        return matchRoot(fromServer, ctx, false);
    }

    private Optional<PanelMatch> matchRoot(Path root, PanelContext ctx, boolean forced) {
        if (root == null || !PanelPaths.isDirectory(root)) {
            return Optional.empty();
        }
        if (!acceptsRoot(root, ctx, forced)) {
            return Optional.empty();
        }
        Path vol = root.resolve("volumes");
        if (!PanelPaths.isDirectory(vol)) {
            return Optional.empty();
        }
        if (!forced) {
            Path volRoot = PanelPaths.volumeRootFromServerDir(ctx.serverDir(), null);
            if (volRoot == null || !volRoot.normalize().equals(root.normalize())) {
                return Optional.empty();
            }
        }
        String unit = ctx.confOrEnv("SYSTEMD_UNIT");
        if (unit.isEmpty()) {
            unit = systemdDefault();
        }
        return Optional.of(new PanelMatch(
                id(),
                root.toString(),
                PGREP,
                unit,
                false,
                true
        ));
    }

    private boolean acceptsRoot(Path root, PanelContext ctx, boolean forced) {
        Path configured = ctx.pathFromConf(rootConfigKey());
        if (configured != null && root.normalize().equals(configured.normalize())) {
            return true;
        }
        if (PanelPaths.pathContains(root, pathMarker())
                || PanelPaths.pathContains(ctx.serverDir(), "/" + pathMarker() + "/")) {
            return true;
        }
        return forced && root.normalize().equals(Path.of(defaultRoot()).normalize());
    }
}
