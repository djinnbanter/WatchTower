package dev.mcstatus.watchtower.core.collect;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.*;

class CpuUsageSamplerTest {

    @TempDir
    Path temp;

    private final AtomicLong wallNanos = new AtomicLong(1_000_000_000L);
    private CpuUsageSampler sampler;

    @BeforeEach
    void setUp() {
        sampler = new CpuUsageSampler(wallNanos::get);
        sampler.reset();
    }

    @Test
    void v2UsageDeltaYieldsCoresUsed() throws Exception {
        Path cgroupRoot = temp.resolve("cgroup");
        Path slice = cgroupRoot.resolve("docker/abc");
        Files.createDirectories(slice);
        Files.writeString(slice.resolve("cpu.max"), "1200000 100000", StandardCharsets.UTF_8);
        Files.writeString(slice.resolve("cpu.stat"), "usage_usec 1000000\n", StandardCharsets.UTF_8);
        Path selfCgroup = temp.resolve("self.cgroup");
        Files.writeString(selfCgroup, "0::/docker/abc" + System.lineSeparator());
        Path procStat = writeProcStat(0, 1000);

        CpuUsageSampler.Reading first = sampler.sample(selfCgroup, cgroupRoot, procStat);
        assertNull(first.coresUsed());
        assertNull(first.hostCpuPct());

        Files.writeString(slice.resolve("cpu.stat"), "usage_usec 4000000\n", StandardCharsets.UTF_8);
        writeProcStat(procStat, 100, 1100);
        wallNanos.addAndGet(1_000_000_000L);

        CpuUsageSampler.Reading second = sampler.sample(selfCgroup, cgroupRoot, procStat);
        assertEquals("cgroup_v2", second.cpuSource());
        assertEquals(12.0, second.limitCores(), 0.01);
        assertEquals(3.0, second.coresUsed(), 0.05);
        assertNotNull(second.hostCpuPct());
        assertTrue(second.hostCpuPct() >= 0 && second.hostCpuPct() <= 100);
    }

    @Test
    void v1CpuacctUsageDeltaYieldsCoresUsed() throws Exception {
        Path cgroupRoot = temp.resolve("cgroup");
        Path cpuacct = cgroupRoot.resolve("cpuacct/docker/xyz");
        Files.createDirectories(cpuacct);
        Files.writeString(cpuacct.resolve("cpuacct.usage"), "1000000000", StandardCharsets.UTF_8);
        Files.writeString(cpuacct.resolve("cpu.cfs_quota_us"), "400000", StandardCharsets.UTF_8);
        Files.writeString(cpuacct.resolve("cpu.cfs_period_us"), "100000", StandardCharsets.UTF_8);
        Path selfCgroup = temp.resolve("self.cgroup");
        Files.writeString(selfCgroup, "12:cpu,cpuacct:/docker/xyz" + System.lineSeparator()
                + "11:memory:/docker/xyz" + System.lineSeparator());
        Path memory = cgroupRoot.resolve("memory/docker/xyz");
        Files.createDirectories(memory);
        Path procStat = writeProcStat(0, 1000);

        assertNull(sampler.sample(selfCgroup, cgroupRoot, procStat).coresUsed());

        Files.writeString(cpuacct.resolve("cpuacct.usage"), "3000000000", StandardCharsets.UTF_8);
        writeProcStat(procStat, 50, 1050);
        wallNanos.addAndGet(1_000_000_000L);

        CpuUsageSampler.Reading reading = sampler.sample(selfCgroup, cgroupRoot, procStat);
        assertEquals("cgroup_v1", reading.cpuSource());
        assertEquals(2.0, reading.coresUsed(), 0.05);
        assertEquals(4.0, reading.limitCores(), 0.01);
    }

    @Test
    void missingCgroupFallsBackToHostOnly() throws Exception {
        Path procStat = writeProcStat(800, 1000);
        assertNull(sampler.sample(temp.resolve("missing"), temp.resolve("cgroup"), procStat).hostCpuPct());

        writeProcStat(procStat, 850, 1200);
        wallNanos.addAndGet(500_000_000L);
        CpuUsageSampler.Reading reading = sampler.sample(temp.resolve("missing"), temp.resolve("cgroup"), procStat);
        assertNull(reading.coresUsed());
        assertNull(reading.limitCores());
        assertEquals("proc_stat", reading.cpuSource());
        // idleDelta=50, totalDelta=200 → 75% busy
        assertEquals(75.0, reading.hostCpuPct(), 0.5);
    }

    private Path writeProcStat(long idle, long totalNonIdlePlusIdle) throws Exception {
        Path procStat = temp.resolve("proc.stat");
        return writeProcStat(procStat, idle, totalNonIdlePlusIdle);
    }

    private Path writeProcStat(Path procStat, long idle, long total) throws Exception {
        // cpu user nice system idle ...  — keep other fields 0 so total = user+nice+system+idle
        long busy = Math.max(0, total - idle);
        long user = busy;
        String line = "cpu  " + user + " 0 0 " + idle + " 0 0 0 0 0 0";
        Files.writeString(procStat, line + System.lineSeparator(), StandardCharsets.UTF_8);
        return procStat;
    }
}
