package dev.mcstatus.watchtower;

import java.nio.file.Files;
import java.nio.file.Path;

/**
 * Reads host CPU utilization from /proc/stat (Linux).
 */
public final class HostCpuProbe {
    private static long lastCpuTotal = -1;
    private static long lastCpuIdle = -1;

    private HostCpuProbe() {
    }

    public static Double readHostCpuPct() {
        try {
            Path stat = Path.of("/proc/stat");
            if (!Files.isRegularFile(stat)) {
                return null;
            }
            String first = Files.readAllLines(stat).get(0);
            if (!first.startsWith("cpu ")) {
                return null;
            }
            String[] parts = first.trim().split("\\s+");
            if (parts.length < 5) {
                return null;
            }
            long user = Long.parseLong(parts[1]);
            long nice = Long.parseLong(parts[2]);
            long system = Long.parseLong(parts[3]);
            long idle = Long.parseLong(parts[4]);
            long total = user + nice + system + idle;
            for (int i = 5; i < parts.length; i++) {
                total += Long.parseLong(parts[i]);
            }
            if (lastCpuTotal < 0) {
                lastCpuTotal = total;
                lastCpuIdle = idle;
                return null;
            }
            long totalDelta = total - lastCpuTotal;
            long idleDelta = idle - lastCpuIdle;
            lastCpuTotal = total;
            lastCpuIdle = idle;
            if (totalDelta <= 0) {
                return null;
            }
            double used = 100.0 * (totalDelta - idleDelta) / totalDelta;
            return Math.max(0.0, Math.min(100.0, used));
        } catch (Exception e) {
            return null;
        }
    }

    public static void reset() {
        lastCpuTotal = -1;
        lastCpuIdle = -1;
    }
}
