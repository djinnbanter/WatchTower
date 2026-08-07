package dev.mcstatus.watchtower.core.collect;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.function.LongSupplier;

/**
 * Stateful CPU sampler: cgroup usage → cores used; {@code /proc/stat} → host-wide %.
 */
public final class CpuUsageSampler {

    private static final Path DEFAULT_SELF_CGROUP = Path.of("/proc/self/cgroup");
    private static final Path DEFAULT_CGROUP_ROOT = Path.of("/sys/fs/cgroup");
    private static final Path DEFAULT_PROC_STAT = Path.of("/proc/stat");

    public record Reading(
            Double coresUsed,
            Double hostCpuPct,
            String cpuSource,
            Double limitCores
    ) {
    }

    private final LongSupplier wallNanos;

    private long lastUsageNanos = -1L;
    private long lastWallNanos = -1L;
    private long lastHostTotal = -1L;
    private long lastHostIdle = -1L;

    public CpuUsageSampler() {
        this(System::nanoTime);
    }

    CpuUsageSampler(LongSupplier wallNanos) {
        this.wallNanos = wallNanos != null ? wallNanos : System::nanoTime;
    }

    public void reset() {
        lastUsageNanos = -1L;
        lastWallNanos = -1L;
        lastHostTotal = -1L;
        lastHostIdle = -1L;
    }

    public Reading sample() {
        return sample(DEFAULT_SELF_CGROUP, DEFAULT_CGROUP_ROOT, DEFAULT_PROC_STAT);
    }

    Reading sample(Path selfCgroup, Path cgroupRoot, Path procStat) {
        long now = wallNanos.getAsLong();
        Double limitCores = null;
        CgroupProbe.CpuReading limit = CgroupProbe.readCpuLimit(selfCgroup, cgroupRoot);
        if (limit.limitCores() != null) {
            limitCores = limit.limitCores();
        }

        Double coresUsed = null;
        String usageSource = CgroupProbe.readCpuUsageSource(selfCgroup, cgroupRoot);
        Long usageNanos = CgroupProbe.readCpuUsageNanos(selfCgroup, cgroupRoot);
        if (usageNanos != null) {
            if (lastUsageNanos >= 0 && lastWallNanos >= 0) {
                long usageDelta = usageNanos - lastUsageNanos;
                long wallDelta = now - lastWallNanos;
                if (usageDelta >= 0 && wallDelta > 0) {
                    double cores = (usageDelta / 1_000_000_000.0) / (wallDelta / 1_000_000_000.0);
                    coresUsed = round2(Math.max(0.0, cores));
                }
            }
            lastUsageNanos = usageNanos;
            lastWallNanos = now;
        }

        Double hostPct = sampleHostCpuPct(procStat);
        String cpuSource;
        if (usageSource != null) {
            cpuSource = usageSource;
        } else if (hostPct != null || lastHostTotal >= 0) {
            cpuSource = "proc_stat";
        } else {
            cpuSource = null;
        }

        return new Reading(coresUsed, hostPct, cpuSource, limitCores);
    }

    private Double sampleHostCpuPct(Path procStat) {
        long[] values = readProcStatCpu(procStat);
        if (values == null) {
            return null;
        }
        long idle = values[0];
        long total = values[1];
        if (lastHostTotal < 0) {
            lastHostTotal = total;
            lastHostIdle = idle;
            return null;
        }
        long totalDelta = total - lastHostTotal;
        long idleDelta = idle - lastHostIdle;
        lastHostTotal = total;
        lastHostIdle = idle;
        if (totalDelta <= 0) {
            return null;
        }
        double used = 100.0 * (totalDelta - idleDelta) / (double) totalDelta;
        return round1(Math.max(0.0, Math.min(100.0, used)));
    }

    private static long[] readProcStatCpu(Path procStat) {
        if (procStat == null || !Files.isRegularFile(procStat)) {
            return null;
        }
        try {
            String first = Files.readAllLines(procStat, StandardCharsets.UTF_8).getFirst();
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
            return new long[]{idle, total};
        } catch (Exception e) {
            return null;
        }
    }

    private static double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }

    private static double round1(double v) {
        return Math.round(v * 10.0) / 10.0;
    }
}
