package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonObject;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Reads cgroup v2 (preferred) or v1 memory/CPU limits for the current process.
 */
public final class CgroupProbe {

    private static final Path DEFAULT_SELF_CGROUP = Path.of("/proc/self/cgroup");
    private static final Path DEFAULT_CGROUP_ROOT = Path.of("/sys/fs/cgroup");
    private static final Path DEFAULT_MEMINFO = Path.of("/proc/meminfo");

    private CgroupProbe() {
    }

    public record MemoryReading(
            Double totalGb,
            Double usedGb,
            String ramSource
    ) {
    }

    public record CpuReading(
            Double limitCores,
            String cpuSource
    ) {
    }

    public static void applyToSystem(JsonObject system) {
        applyToSystem(system, DEFAULT_SELF_CGROUP, DEFAULT_CGROUP_ROOT, DEFAULT_MEMINFO);
    }

    static void applyToSystem(JsonObject system, Path selfCgroup, Path cgroupRoot, Path meminfoPath) {
        MemoryReading mem = readMemory(selfCgroup, cgroupRoot, meminfoPath);
        if (mem.totalGb() != null) {
            system.addProperty("mem_total_gb", round2(mem.totalGb()));
        }
        if (mem.usedGb() != null) {
            system.addProperty("mem_used_gb", round2(mem.usedGb()));
        }
        if (mem.ramSource() != null) {
            system.addProperty("ram_source", mem.ramSource());
        }

        CpuReading cpu = readCpuLimit(selfCgroup, cgroupRoot);
        if (cpu.limitCores() != null) {
            system.addProperty("cpu_limit_cores", round2(cpu.limitCores()));
        }
        if (cpu.cpuSource() != null) {
            system.addProperty("cpu_source", cpu.cpuSource());
        }
    }

    public static MemoryReading readMemory() {
        return readMemory(DEFAULT_SELF_CGROUP, DEFAULT_CGROUP_ROOT, DEFAULT_MEMINFO);
    }

    static MemoryReading readMemory(Path selfCgroup, Path cgroupRoot, Path meminfoPath) {
        CgroupPath path = resolveCgroupPath(selfCgroup, cgroupRoot);
        if (path != null) {
            if ("v2".equals(path.version())) {
                Long maxBytes = readLongOrMax(path.dir().resolve("memory.max"));
                Long currentBytes = readLong(path.dir().resolve("memory.current"));
                if (maxBytes != null && currentBytes != null && maxBytes > 0) {
                    double totalGb = maxBytes / (1024.0 * 1024.0 * 1024.0);
                    double usedGb = currentBytes / (1024.0 * 1024.0 * 1024.0);
                    return new MemoryReading(totalGb, usedGb, "cgroup_v2");
                }
            } else if ("v1".equals(path.version())) {
                Long limitBytes = readLong(path.dir().resolve("memory.limit_in_bytes"));
                Long usageBytes = readLong(path.dir().resolve("memory.usage_in_bytes"));
                if (limitBytes != null && usageBytes != null && limitBytes > 0 && limitBytes < Long.MAX_VALUE / 2) {
                    double totalGb = limitBytes / (1024.0 * 1024.0 * 1024.0);
                    double usedGb = usageBytes / (1024.0 * 1024.0 * 1024.0);
                    return new MemoryReading(totalGb, usedGb, "cgroup_v1");
                }
            }
        }

        Double procTotal = readMemTotalGb(meminfoPath);
        Double procAvail = readMemAvailableGb(meminfoPath);
        if (procTotal != null && procAvail != null) {
            return new MemoryReading(procTotal, procTotal - procAvail, "proc");
        }
        return new MemoryReading(null, null, "unknown");
    }

    public static CpuReading readCpuLimit() {
        return readCpuLimit(DEFAULT_SELF_CGROUP, DEFAULT_CGROUP_ROOT);
    }

    static CpuReading readCpuLimit(Path selfCgroup, Path cgroupRoot) {
        CgroupPath path = resolveCgroupPath(selfCgroup, cgroupRoot);
        if (path == null) {
            return new CpuReading(null, null);
        }
        if ("v2".equals(path.version())) {
            Double cores = parseCpuMaxV2(readText(path.dir().resolve("cpu.max")));
            if (cores != null) {
                return new CpuReading(cores, "cgroup_v2");
            }
        } else if ("v1".equals(path.version())) {
            Long quota = readLong(path.dir().resolve("cpu.cfs_quota_us"));
            Long period = readLong(path.dir().resolve("cpu.cfs_period_us"));
            if (quota != null && period != null && quota > 0 && period > 0) {
                return new CpuReading(quota / (double) period, "cgroup_v1");
            }
        }
        return new CpuReading(null, null);
    }

    public static boolean cgroupMemoryReadable() {
        MemoryReading mem = readMemory();
        return mem.ramSource() != null && mem.ramSource().startsWith("cgroup");
    }

    private record CgroupPath(Path dir, String version) {
    }

    private static CgroupPath resolveCgroupPath(Path selfCgroup, Path cgroupRoot) {
        if (!Files.isRegularFile(selfCgroup) || !Files.isDirectory(cgroupRoot)) {
            return null;
        }
        try {
            List<String> lines = Files.readAllLines(selfCgroup, StandardCharsets.UTF_8);
            String v2Rel = null;
            String v1Memory = null;
            for (String line : lines) {
                if (line.startsWith("0::")) {
                    v2Rel = line.substring(3).strip();
                } else {
                    String[] parts = line.split(":");
                    if (parts.length >= 3 && parts[1].contains("memory")) {
                        v1Memory = parts[2].strip();
                    }
                }
            }
            if (v2Rel != null && !v2Rel.isEmpty()) {
                Path dir = cgroupRoot.resolve(v2Rel.startsWith("/") ? v2Rel.substring(1) : v2Rel).normalize();
                if (Files.isDirectory(dir)) {
                    return new CgroupPath(dir, "v2");
                }
            }
            if (v1Memory != null && !v1Memory.isEmpty()) {
                Path memRoot = cgroupRoot.resolve("memory");
                Path dir = memRoot.resolve(v1Memory.startsWith("/") ? v1Memory.substring(1) : v1Memory).normalize();
                if (Files.isDirectory(dir)) {
                    return new CgroupPath(dir, "v1");
                }
            }
        } catch (IOException ignored) {
            // fall through
        }
        return null;
    }

    private static Double parseCpuMaxV2(String text) {
        if (text == null || text.isBlank()) {
            return null;
        }
        String[] parts = text.strip().split("\\s+");
        if (parts.length < 2) {
            return null;
        }
        if ("max".equalsIgnoreCase(parts[0])) {
            return null;
        }
        try {
            long quota = Long.parseLong(parts[0]);
            long period = Long.parseLong(parts[1]);
            if (quota <= 0 || period <= 0) {
                return null;
            }
            return quota / (double) period;
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static Long readLongOrMax(Path path) {
        String text = readText(path);
        if (text == null || text.isBlank() || "max".equalsIgnoreCase(text.strip())) {
            return null;
        }
        try {
            return Long.parseLong(text.strip());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static Long readLong(Path path) {
        String text = readText(path);
        if (text == null || text.isBlank()) {
            return null;
        }
        try {
            return Long.parseLong(text.strip());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static String readText(Path path) {
        if (!Files.isRegularFile(path)) {
            return null;
        }
        try {
            return Files.readString(path, StandardCharsets.UTF_8).strip();
        } catch (IOException e) {
            return null;
        }
    }

    private static Double readMemTotalGb(Path meminfoPath) {
        if (!Files.isRegularFile(meminfoPath)) {
            return null;
        }
        try {
            for (String line : Files.readAllLines(meminfoPath, StandardCharsets.UTF_8)) {
                if (line.startsWith("MemTotal:")) {
                    long kb = Long.parseLong(line.replaceAll("[^0-9]", ""));
                    return kb / 1024.0 / 1024.0;
                }
            }
        } catch (IOException | NumberFormatException ignored) {
            // skip
        }
        return null;
    }

    private static Double readMemAvailableGb(Path meminfoPath) {
        if (!Files.isRegularFile(meminfoPath)) {
            return null;
        }
        try {
            for (String line : Files.readAllLines(meminfoPath, StandardCharsets.UTF_8)) {
                if (line.startsWith("MemAvailable:")) {
                    long kb = Long.parseLong(line.replaceAll("[^0-9]", ""));
                    return kb / 1024.0 / 1024.0;
                }
            }
        } catch (IOException | NumberFormatException ignored) {
            // skip
        }
        return null;
    }

    private static double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }

    /** Exposed for tests — build mock cgroup tree under {@code root}. */
    static Path mockCgroupRoot(Path root, String version, String relativePath, List<String[]> files) throws IOException {
        Path dir = root.resolve(relativePath.startsWith("/") ? relativePath.substring(1) : relativePath);
        Files.createDirectories(dir);
        for (String[] kv : files) {
            Files.writeString(dir.resolve(kv[0]), kv[1], StandardCharsets.UTF_8);
        }
        String selfLine = "v2".equals(version)
                ? "0::" + (relativePath.startsWith("/") ? relativePath : "/" + relativePath)
                : "12:memory:" + (relativePath.startsWith("/") ? relativePath : "/" + relativePath);
        Files.writeString(root.resolve("self.cgroup"), selfLine + System.lineSeparator(), StandardCharsets.UTF_8);
        return root;
    }
}
