package dev.mcstatus.watchtower;

import dev.mcstatus.watchtower.core.collect.CpuUsageSampler;

/**
 * Live CPU probe: cgroup cores used when available, plus host-wide {@code /proc/stat} %.
 */
public final class HostCpuProbe {
    private static final CpuUsageSampler SAMPLER = new CpuUsageSampler();

    private HostCpuProbe() {
    }

    /** Full sample (cores + host %). First call after reset may return nulls for deltas. */
    public static CpuUsageSampler.Reading sample() {
        return SAMPLER.sample();
    }

    /** Host-wide busy percent only (legacy callers). */
    public static Double readHostCpuPct() {
        CpuUsageSampler.Reading reading = SAMPLER.sample();
        return reading.hostCpuPct();
    }

    public static void reset() {
        SAMPLER.reset();
    }
}
