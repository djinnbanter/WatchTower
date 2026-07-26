package dev.mcstatus.watchtower.core.collect;

import dev.mcstatus.watchtower.core.report.ReportConfig;

import java.nio.file.Path;

/**
 * Shared Spark on-disk locations (upload dir + search roots).
 */
public final class SparkPaths {

    private SparkPaths() {
    }

    /**
     * Resolve the spark-upload directory under {@code root}.
     * Override paths are resolved relative to the server root and must not escape it —
     * callers should reject results that do not {@code startsWith(root)}.
     */
    public static Path uploadDir(Path root, ReportConfig config) {
        Path normalizedRoot = root.toAbsolutePath().normalize();
        String override = config != null ? config.sparkUploadDir() : null;
        if (override != null && !override.isBlank()) {
            return normalizedRoot.resolve(override).normalize();
        }
        return normalizedRoot.resolve("watchtower").resolve("spark-upload").normalize();
    }

    /** True when {@code dir} is under {@code root} (both normalized). */
    public static boolean isUnderRoot(Path root, Path dir) {
        if (root == null || dir == null) {
            return false;
        }
        Path r = root.toAbsolutePath().normalize();
        Path d = dir.toAbsolutePath().normalize();
        return d.startsWith(r);
    }
}
