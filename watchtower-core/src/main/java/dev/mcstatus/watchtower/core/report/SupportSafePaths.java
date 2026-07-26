package dev.mcstatus.watchtower.core.report;

import java.nio.file.Path;

/**
 * Path containment helpers for support pack file selection.
 */
public final class SupportSafePaths {

    private SupportSafePaths() {
    }

    public static boolean isSafeBasename(String name) {
        if (name == null || name.isBlank()) {
            return false;
        }
        if (name.contains("..") || name.contains("/") || name.contains("\\")) {
            return false;
        }
        return true;
    }

    public static Path resolveUnder(Path root, String relative) {
        if (root == null || relative == null || relative.isBlank()) {
            return null;
        }
        String rel = relative.replace('\\', '/');
        if (rel.startsWith("/") || rel.contains("..")) {
            return null;
        }
        Path resolved = root.toAbsolutePath().normalize().resolve(rel).normalize();
        if (!resolved.startsWith(root.toAbsolutePath().normalize())) {
            return null;
        }
        return resolved;
    }

    public static Path resolveBasename(Path dir, String basename) {
        if (dir == null || !isSafeBasename(basename)) {
            return null;
        }
        Path resolved = dir.toAbsolutePath().normalize().resolve(basename).normalize();
        if (!resolved.startsWith(dir.toAbsolutePath().normalize())) {
            return null;
        }
        return resolved;
    }
}
