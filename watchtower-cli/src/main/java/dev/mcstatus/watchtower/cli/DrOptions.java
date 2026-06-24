package dev.mcstatus.watchtower.cli;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Locale;

/**
 * Parsed CLI options for the {@code dr} subcommand.
 */
final class DrOptions {

    static final int DEFAULT_MINUTES = 1440;
    private static final int MIN_MINUTES = 1;
    private static final int MAX_MINUTES = 1440;

    private final String serverDir;
    private final int minutes;
    private final Path outputDir;
    private final Path zipFile;
    private final boolean outExplicit;

    DrOptions(String serverDir, int minutes, Path outputDir, Path zipFile, boolean outExplicit) {
        this.serverDir = serverDir;
        this.minutes = minutes;
        this.outputDir = outputDir;
        this.zipFile = zipFile;
        this.outExplicit = outExplicit;
    }

    String serverDir() {
        return serverDir;
    }

    int minutes() {
        return minutes;
    }

    Path outputDir() {
        return outputDir;
    }

    /**
     * When set, bundle is written to this exact path; otherwise {@link DrBundlePackager} picks a timestamped name in {@link #outputDir()}.
     */
    Path zipFile() {
        return zipFile;
    }

    boolean outExplicit() {
        return outExplicit;
    }

    static DrOptions parse(String[] args, int startIndex) {
        String serverDir = null;
        int minutes = DEFAULT_MINUTES;
        String outArg = null;
        boolean outExplicit = false;

        for (int i = startIndex; i < args.length; i++) {
            String arg = args[i];
            switch (arg) {
                case "--server" -> {
                    if (++i >= args.length) {
                        throw new IllegalArgumentException("--server requires a path");
                    }
                    serverDir = args[i];
                }
                case "--minutes" -> {
                    if (++i >= args.length) {
                        throw new IllegalArgumentException("--minutes requires a number");
                    }
                    try {
                        minutes = Integer.parseInt(args[i]);
                    } catch (NumberFormatException e) {
                        throw new IllegalArgumentException("--minutes must be an integer");
                    }
                    if (minutes < MIN_MINUTES || minutes > MAX_MINUTES) {
                        throw new IllegalArgumentException(
                                "--minutes must be between " + MIN_MINUTES + " and " + MAX_MINUTES);
                    }
                }
                case "--out" -> {
                    if (++i >= args.length) {
                        throw new IllegalArgumentException("--out requires a directory or .zip path");
                    }
                    outArg = args[i];
                    outExplicit = true;
                }
                case "--help", "-h" -> throw new HelpRequested();
                default -> throw new IllegalArgumentException("Unknown option: " + arg);
            }
        }

        if (serverDir == null || serverDir.isBlank()) {
            serverDir = inferServerFromCwd();
        }
        if (serverDir == null || serverDir.isBlank()) {
            throw new IllegalArgumentException(
                    "Could not infer server directory — run from server/mods/ or pass --server <path>");
        }

        Path serverPath = Path.of(serverDir).toAbsolutePath().normalize();
        Path outputDir;
        Path zipFile = null;
        if (outArg == null || outArg.isBlank()) {
            outputDir = Path.of("").toAbsolutePath().normalize();
        } else {
            Path outPath = Path.of(outArg).toAbsolutePath().normalize();
            if (isZipPath(outPath)) {
                zipFile = outPath;
                Path parent = outPath.getParent();
                outputDir = parent != null ? parent : Path.of("").toAbsolutePath().normalize();
            } else {
                outputDir = outPath;
            }
        }

        return new DrOptions(serverPath.toString(), minutes, outputDir, zipFile, outExplicit);
    }

    private static boolean isZipPath(Path path) {
        String name = path.getFileName().toString().toLowerCase(Locale.ROOT);
        return name.endsWith(".zip");
    }

    /**
     * When cwd is {@code mods/}, server root is the parent directory.
     */
    static String inferServerFromCwd() {
        Path cwd = Path.of("").toAbsolutePath().normalize();
        if (!Files.isDirectory(cwd)) {
            return null;
        }
        String fileName = cwd.getFileName().toString();
        if ("mods".equalsIgnoreCase(fileName)) {
            Path parent = cwd.getParent();
            if (parent != null && Files.isDirectory(parent)) {
                return parent.toString();
            }
        }
        return null;
    }

    static final class HelpRequested extends RuntimeException {
    }
}
