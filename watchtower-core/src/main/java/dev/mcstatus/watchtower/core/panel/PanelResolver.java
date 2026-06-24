package dev.mcstatus.watchtower.core.panel;

import java.nio.file.Path;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

/**
 * Resolves hosting panel from config and server directory layout.
 */
public final class PanelResolver {

    private static final PanelRegistry REGISTRY = new PanelRegistry();

    private PanelResolver() {
    }

    public static PanelInfo resolve(Map<String, String> conf, Path serverDir) {
        PanelContext ctx = new PanelContext(conf, serverDir);
        String mode = ctx.panelMode();

        if (!PanelRegistry.isValidPanelMode(mode)) {
            return PanelInfo.unknown();
        }

        if ("none".equals(mode)) {
            return PanelInfo.nativeLinux();
        }

        Optional<PanelMatch> match;
        if ("auto".equals(mode)) {
            match = detectAuto(ctx);
        } else {
            match = detectForced(ctx, mode);
        }

        if (match.isEmpty()) {
            return "auto".equals(mode) ? PanelInfo.nativeLinux() : PanelInfo.unknown();
        }

        PanelMatch m = match.get();
        boolean running = false;
        if (m.hasPanelDaemon()) {
            running = ProcessChecks.isPanelRunning(m.pgrepPattern(), m.systemdUnit());
        }
        return PanelInfo.fromMatch(m, running);
    }

    private static Optional<PanelMatch> detectAuto(PanelContext ctx) {
        for (PanelDetector detector : REGISTRY.autoDetectors()) {
            Optional<PanelMatch> match = detector.detect(ctx);
            if (match.isPresent()) {
                return match;
            }
        }
        return REGISTRY.byId("none").detect(ctx);
    }

    private static Optional<PanelMatch> detectForced(PanelContext ctx, String panelId) {
        String id = panelId.toLowerCase(Locale.ROOT);
        PanelDetector detector = REGISTRY.byId(id);
        if (detector == null) {
            return Optional.empty();
        }
        if (REGISTRY.isForcedOnly(id)) {
            return detector.detect(ctx);
        }
        return detector.detect(ctx);
    }
}
