package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonObject;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class CgroupProbeTest {

    @TempDir
    Path temp;

    @Test
    void readsCgroupV2MemoryAndCpu() throws Exception {
        Path cgroupRoot = temp.resolve("cgroup");
        Path slice = cgroupRoot.resolve("user.slice/test.slice");
        Files.createDirectories(slice);
        Files.writeString(slice.resolve("memory.max"), "2147483648", StandardCharsets.UTF_8);
        Files.writeString(slice.resolve("memory.current"), "1073741824", StandardCharsets.UTF_8);
        Files.writeString(slice.resolve("cpu.max"), "200000 100000", StandardCharsets.UTF_8);
        Path selfCgroup = temp.resolve("self.cgroup");
        Files.writeString(selfCgroup, "0::/user.slice/test.slice" + System.lineSeparator());

        CgroupProbe.MemoryReading mem = CgroupProbe.readMemory(selfCgroup, cgroupRoot, temp.resolve("meminfo"));
        assertEquals("cgroup_v2", mem.ramSource());
        assertEquals(2.0, mem.totalGb(), 0.01);
        assertEquals(1.0, mem.usedGb(), 0.01);

        CgroupProbe.CpuReading cpu = CgroupProbe.readCpuLimit(selfCgroup, cgroupRoot);
        assertEquals("cgroup_v2", cpu.cpuSource());
        assertEquals(2.0, cpu.limitCores(), 0.01);
    }

    @Test
    void appliesToSystemJson() throws Exception {
        Path cgroupRoot = temp.resolve("cgroup");
        Path slice = cgroupRoot.resolve("docker/abc");
        Files.createDirectories(slice);
        Files.writeString(slice.resolve("memory.max"), "4294967296", StandardCharsets.UTF_8);
        Files.writeString(slice.resolve("memory.current"), "2147483648", StandardCharsets.UTF_8);
        Files.writeString(slice.resolve("cpu.max"), "100000 100000", StandardCharsets.UTF_8);
        Path selfCgroup = temp.resolve("self.cgroup");
        Files.writeString(selfCgroup, "0::/docker/abc" + System.lineSeparator());

        JsonObject system = new JsonObject();
        CgroupProbe.applyToSystem(system, selfCgroup, cgroupRoot, temp.resolve("meminfo"));

        assertEquals(4.0, system.get("mem_total_gb").getAsDouble(), 0.01);
        assertEquals(2.0, system.get("mem_used_gb").getAsDouble(), 0.01);
        assertEquals("cgroup_v2", system.get("ram_source").getAsString());
        assertEquals(1.0, system.get("cpu_limit_cores").getAsDouble(), 0.01);
    }

    @Test
    void fallsBackToProcWhenNoCgroup() throws Exception {
        Path meminfo = temp.resolve("meminfo");
        Files.writeString(meminfo, """
                MemTotal:       16384000 kB
                MemAvailable:    8192000 kB
                """, StandardCharsets.UTF_8);

        CgroupProbe.MemoryReading mem = CgroupProbe.readMemory(temp.resolve("missing"), temp.resolve("cgroup"), meminfo);
        assertEquals("proc", mem.ramSource());
        assertNotNull(mem.totalGb());
        assertNotNull(mem.usedGb());
        assertTrue(mem.usedGb() > 0);
    }
}
