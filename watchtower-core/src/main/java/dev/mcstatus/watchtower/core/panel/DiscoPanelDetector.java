package dev.mcstatus.watchtower.core.panel;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Optional;

/**
 * DiscoPanel (Docker-based panel) layout detection.
 */
public final class DiscoPanelDetector implements PanelDetector {

    @Override
    public String id() {
        return "discopanel";
    }

    @Override
    public int priority() {
        return 65;
    }

    @Override
    public Optional<PanelMatch> detect(PanelContext ctx) {
        String dataDir = System.getenv("DISCOPANEL_DATA_DIR");
        String hostData = System.getenv("DISCOPANEL_HOST_DATA_PATH");
        if ((dataDir != null && !dataDir.isBlank()) || (hostData != null && !hostData.isBlank())) {
            Path root = hostData != null && !hostData.isBlank()
                    ? Path.of(hostData)
                    : (dataDir != null && !dataDir.isBlank() ? Path.of(dataDir) : null);
            return Optional.of(new PanelMatch(
                    "discopanel",
                    root != null ? root.toString() : null,
                    null,
                    null,
                    false,
                    false
            ));
        }
        if (PanelPaths.pathContains(ctx.serverDir(), "discopanel")) {
            Path root = discoRootFromServerDir(ctx.serverDir());
            return Optional.of(new PanelMatch(
                    "discopanel",
                    root != null ? root.toString() : null,
                    null,
                    null,
                    false,
                    false
            ));
        }
        if (Files.isRegularFile(Path.of("/app/config.yaml"))) {
            return Optional.of(new PanelMatch(
                    "discopanel",
                    "/app/data",
                    null,
                    null,
                    false,
                    false
            ));
        }
        return Optional.empty();
    }

    static Path discoRootFromServerDir(Path serverDir) {
        Path walk = serverDir.toAbsolutePath().normalize();
        while (walk != null) {
            if ("discopanel".equalsIgnoreCase(walk.getFileName().toString())) {
                return walk;
            }
            if ("servers".equalsIgnoreCase(walk.getFileName().toString())) {
                Path parent = walk.getParent();
                if (parent != null) {
                    return parent;
                }
            }
            walk = walk.getParent();
        }
        return null;
    }
}
