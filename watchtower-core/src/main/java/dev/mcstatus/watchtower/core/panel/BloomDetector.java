package dev.mcstatus.watchtower.core.panel;

import java.util.Optional;

/**
 * bloom.host uses Pterodactyl/Wings layout with bloom-specific paths and env hints.
 */
public final class BloomDetector extends WingsFamilyDetector {

    @Override
    public String id() {
        return "bloom";
    }

    @Override
    public int priority() {
        return 92;
    }

    @Override
    String rootConfigKey() {
        return "BLOOM_ROOT";
    }

    @Override
    String defaultRoot() {
        return "/var/lib/pterodactyl";
    }

    @Override
    String pathMarker() {
        return "bloom";
    }

    @Override
    String systemdDefault() {
        return "wings";
    }

    @Override
    public Optional<PanelMatch> detect(PanelContext ctx) {
        if ("bloom".equals(ctx.panelMode()) || bloomEnvHint(ctx)
                || PanelPaths.pathContains(ctx.serverDir(), "/bloom.host/")
                || PanelPaths.pathContains(ctx.serverDir(), "/bloom/")) {
            return super.detect(ctx);
        }
        return Optional.empty();
    }

    private static boolean bloomEnvHint(PanelContext ctx) {
        String host = ctx.confOrEnv("BLOOM_HOST", "BLOOM_HOST");
        return !host.isEmpty();
    }
}
