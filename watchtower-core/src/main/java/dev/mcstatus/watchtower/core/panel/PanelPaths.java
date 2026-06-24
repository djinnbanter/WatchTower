package dev.mcstatus.watchtower.core.panel;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Shared path heuristics for panel layout detection.
 */
public final class PanelPaths {

    private PanelPaths() {
    }

    public static boolean isDirectory(Path p) {
        return p != null && Files.isDirectory(p);
    }

    public static boolean isFile(Path p) {
        return p != null && Files.isRegularFile(p);
    }

    public static String normalizedPathString(Path path) {
        if (path == null) {
            return "";
        }
        return path.toAbsolutePath().normalize().toString().replace('\\', '/').toLowerCase(Locale.ROOT);
    }

    public static boolean pathContains(Path path, String segment) {
        return normalizedPathString(path).contains(segment.toLowerCase(Locale.ROOT));
    }

    /**
     * For .../crafty-4/servers/&lt;uuid&gt; returns crafty-4 root.
     */
    public static Path craftyRootFromServerDir(Path serverDir) {
        if (serverDir == null) {
            return null;
        }
        Path parent = serverDir.getParent();
        if (parent == null) {
            return null;
        }
        Path grand = parent.getParent();
        if (grand == null) {
            return null;
        }
        if ("servers".equalsIgnoreCase(parent.getFileName().toString())) {
            return grand;
        }
        return null;
    }

    /**
     * When server lives under &lt;root&gt;/volumes/&lt;uuid&gt;, return panel root.
     */
    public static Path volumeRootFromServerDir(Path serverDir, String volumesSegment) {
        if (serverDir == null) {
            return null;
        }
        Path volParent = serverDir.getParent();
        if (volParent == null || !"volumes".equalsIgnoreCase(volParent.getFileName().toString())) {
            return null;
        }
        Path root = volParent.getParent();
        if (root == null) {
            return null;
        }
        if (volumesSegment != null && !pathContains(root, volumesSegment)) {
            return null;
        }
        return root;
    }

    public static List<Path> craftyRootCandidates(PanelContext ctx) {
        List<Path> out = new ArrayList<>();
        Path configured = ctx.pathFromConf("CRAFTY_APP");
        if (configured != null) {
            out.add(configured);
        }
        String craftyRoot = ctx.confOrEnv("CRAFTY_ROOT");
        if (!craftyRoot.isEmpty()) {
            out.add(Path.of(craftyRoot, "crafty-4").normalize());
        }
        out.add(Path.of("/var/opt/minecraft/crafty/crafty-4"));
        Path fromServer = craftyRootFromServerDir(ctx.serverDir());
        if (fromServer != null) {
            out.add(fromServer);
        }
        String panelRoot = ctx.confOrEnv("PANEL_ROOT");
        if (!panelRoot.isEmpty()) {
            out.add(Path.of(panelRoot).normalize());
        }
        return out;
    }

    public static boolean isCraftyInstall(Path craftyRoot) {
        if (!isDirectory(craftyRoot)) {
            return false;
        }
        return isFile(craftyRoot.resolve("app/main.py"))
                || isFile(craftyRoot.resolve("logs/audit.log"));
    }
}
