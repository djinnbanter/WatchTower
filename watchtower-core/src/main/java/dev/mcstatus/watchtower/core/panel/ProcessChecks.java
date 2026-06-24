package dev.mcstatus.watchtower.core.panel;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.TimeUnit;

/**
 * Linux process and environment checks for panel daemons.
 */
public final class ProcessChecks {

    private ProcessChecks() {
    }

    public static boolean pgrepMatches(String pattern) {
        if (pattern == null || pattern.isBlank()) {
            return false;
        }
        try {
            Process proc = new ProcessBuilder("pgrep", "-f", pattern)
                    .redirectErrorStream(false)
                    .start();
            proc.getErrorStream().close();
            if (!proc.waitFor(5, TimeUnit.SECONDS)) {
                proc.destroyForcibly();
                return false;
            }
            String out = new String(proc.getInputStream().readAllBytes(), StandardCharsets.UTF_8).strip();
            return !out.isBlank();
        } catch (Exception e) {
            return false;
        }
    }

    public static boolean systemdActive(String unit) {
        if (unit == null || unit.isBlank()) {
            return false;
        }
        try {
            Process proc = new ProcessBuilder("systemctl", "is-active", "--quiet", unit)
                    .redirectErrorStream(true)
                    .start();
            if (!proc.waitFor(5, TimeUnit.SECONDS)) {
                proc.destroyForcibly();
                return false;
            }
            return proc.exitValue() == 0;
        } catch (Exception e) {
            return false;
        }
    }

    public static boolean isPanelRunning(String pgrepPattern, String systemdUnit) {
        if (systemdUnit != null && !systemdUnit.isBlank() && systemdActive(systemdUnit)) {
            return true;
        }
        return pgrepMatches(pgrepPattern);
    }

    public static boolean isDockerContainer() {
        if (Files.exists(Path.of("/.dockerenv"))) {
            return true;
        }
        try {
            String cgroup = Files.readString(Path.of("/proc/1/cgroup"));
            return cgroup.toLowerCase().contains("docker");
        } catch (Exception e) {
            return false;
        }
    }
}
