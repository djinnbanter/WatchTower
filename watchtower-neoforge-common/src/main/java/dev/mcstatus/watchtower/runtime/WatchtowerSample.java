package dev.mcstatus.watchtower.runtime;

import java.time.Instant;
import java.util.List;

/**
 * Live sample DTOs shared by sampler (glue) and snapshot/live writers (common).
 */
public final class WatchtowerSample {
    private WatchtowerSample() {
    }

    public record DimensionSample(String id, double tps, double mspt, long entities, long chunks) {
    }

    public record TypeCount(String type, long count) {
    }

    public record DimensionCensus(
            String id,
            long entities,
            long items,
            long living,
            long loadedChunks,
            long forcedChunks,
            long spawnChunks,
            long modForcedChunks,
            int players,
            List<TypeCount> topTypes) {
    }

    public record WorldCensus(Instant takenAt, List<DimensionCensus> dimensions) {
        public static WorldCensus empty() {
            return new WorldCensus(null, List.of());
        }
    }

    public record PlayerSample(String name, String uuid, int ping, String dimension) {
    }

    public record ModSample(
            String id,
            String version,
            String displayName,
            String jarFile,
            boolean nested,
            String parentJar,
            String nestedPath) {
        public ModSample(String id, String version, String displayName) {
            this(id, version, displayName, null, false, null, null);
        }
    }

    public record HeapMb(double used, double committed, double max) {
    }

    public record SessionMspt(double min, double max, double avg, double p95, Instant since) {
    }

    public record Sample(
            double mspt,
            double tps,
            int playersOnline,
            long entities,
            long chunks,
            int modCount,
            List<DimensionSample> dimensions,
            SessionMspt sessionMspt,
            HeapMb heap,
            List<PlayerSample> players,
            List<ModSample> mods
    ) {
    }

    public static HeapMb sampleHeapOnly() {
        Runtime rt = Runtime.getRuntime();
        double used = (rt.totalMemory() - rt.freeMemory()) / (1024.0 * 1024.0);
        double committed = rt.totalMemory() / (1024.0 * 1024.0);
        double max = rt.maxMemory() / (1024.0 * 1024.0);
        return new HeapMb(
                Math.round(used * 10.0) / 10.0,
                Math.round(committed * 10.0) / 10.0,
                Math.round(max * 10.0) / 10.0
        );
    }
}