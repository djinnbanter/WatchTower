package dev.mcstatus.watchtower.core.collect;

import java.nio.file.Path;
import java.util.Locale;
import java.util.Objects;

/**
 * Shared path-safe resolution of a single top-level basename under {@code mods/}
 * (or any other directory root). Rejects escapes, nested segments, and absolute paths.
 */
public final class ModJarPaths {
    private ModJarPaths() {
    }

    /**
     * Resolve a basename under {@code dir}. Returns null if path escapes, contains separators,
     * or is not a single path segment.
     */
    public static Path resolveTopLevelJar(Path dir, String jarBasename) {
        if (dir == null || jarBasename == null) {
            return null;
        }
        String raw = jarBasename.trim();
        if (raw.isEmpty()) {
            return null;
        }
        if (raw.contains("/") || raw.contains("\\") || raw.contains("..")) {
            return null;
        }
        Path name = Path.of(raw);
        if (name.getNameCount() != 1) {
            return null;
        }
        Path dirAbs = dir.toAbsolutePath().normalize();
        Path resolved = dirAbs.resolve(name.getFileName().toString()).normalize();
        if (!resolved.startsWith(dirAbs)) {
            return null;
        }
        if (!Objects.equals(resolved.getParent(), dirAbs)) {
            return null;
        }
        return resolved;
    }

    /** Safe single path segment for mod id / backup folder names. */
    public static String safeSegment(String raw) {
        if (raw == null) {
            return null;
        }
        String trimmed = raw.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        if (trimmed.contains("/") || trimmed.contains("\\") || trimmed.contains("..")) {
            return null;
        }
        Path name = Path.of(trimmed);
        if (name.getNameCount() != 1) {
            return null;
        }
        String segment = name.getFileName().toString();
        if (segment.isBlank() || ".".equals(segment) || "..".equals(segment)) {
            return null;
        }
        return segment;
    }

    public static boolean looksLikeJarName(String name) {
        if (name == null || name.isBlank()) {
            return false;
        }
        String lower = name.trim().toLowerCase(Locale.ROOT);
        return lower.endsWith(".jar") || lower.endsWith(ModJarDisable.DISABLED_SUFFIX);
    }
}
