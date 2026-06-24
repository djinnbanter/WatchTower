package dev.mcstatus.watchtower.cli;

import dev.mcstatus.watchtower.core.report.ReportPreset;

import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * CLI options for {@code watchtower report}.
 */
final class ReportCliOptions {

    private final Path serverDir;
    private final ReportPreset preset;
    private final Integer lookbackHours;
    private final Boolean incremental;

    private ReportCliOptions(Path serverDir, ReportPreset preset, Integer lookbackHours, Boolean incremental) {
        this.serverDir = serverDir;
        this.preset = preset;
        this.lookbackHours = lookbackHours;
        this.incremental = incremental;
    }

    Path serverDir() {
        return serverDir;
    }

    ReportPreset preset() {
        return preset;
    }

    Integer lookbackHours() {
        return lookbackHours;
    }

    Boolean incremental() {
        return incremental;
    }

    static ReportCliOptions parse(String[] args, int startIndex) {
        Path server = Paths.get(".").toAbsolutePath().normalize();
        ReportPreset preset = ReportPreset.FULL;
        Integer lookback = null;
        Boolean incremental = null;

        for (int i = startIndex; i < args.length; i++) {
            String arg = args[i];
            if ("--help".equals(arg) || "-h".equals(arg)) {
                throw new HelpRequested();
            }
            if ("--server".equals(arg) && i + 1 < args.length) {
                server = Path.of(args[++i]).toAbsolutePath().normalize();
            } else if ("--preset".equals(arg) && i + 1 < args.length) {
                preset = ReportPreset.parse(args[++i]);
            } else if ("--lookback".equals(arg) && i + 1 < args.length) {
                lookback = Integer.parseInt(args[++i]);
            } else if ("--incremental".equals(arg)) {
                incremental = true;
            } else if ("--no-incremental".equals(arg)) {
                incremental = false;
            } else {
                throw new IllegalArgumentException("Unknown option: " + arg);
            }
        }

        return new ReportCliOptions(server, preset, lookback, incremental);
    }

    static final class HelpRequested extends RuntimeException {
    }
}
