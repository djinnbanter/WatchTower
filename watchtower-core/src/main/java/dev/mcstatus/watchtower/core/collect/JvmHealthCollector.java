package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

import java.lang.management.GarbageCollectorMXBean;
import java.lang.management.ManagementFactory;
import java.lang.management.MemoryMXBean;
import java.lang.management.MemoryUsage;
import java.lang.management.RuntimeMXBean;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.atomic.AtomicLong;

import dev.mcstatus.watchtower.core.live.PerformanceRollupWriter;

/**
 * Samples GC MXBeans, heap pressure, and JVM input arguments for Live + report.
 * Not part of {@link ExtrasCollector}.
 */
public final class JvmHealthCollector {

    private static final ConcurrentHashMap<String, long[]> LAST_GC = new ConcurrentHashMap<>();
    private static final AtomicLong LAST_WALL_MS = new AtomicLong(0);
    private static final AtomicLong LAST_HEAP_USED = new AtomicLong(-1);

    private JvmHealthCollector() {
    }

    /** Live poll sample (GC deltas since previous call). */
    public static JsonObject sampleLive() {
        return sampleLive(null);
    }

    public static JsonObject sampleLive(Double xmxGbHint) {
        JsonObject out = new JsonObject();
        out.add("jvm_gc", sampleGcDelta());
        JsonObject heap = sampleHeap();
        out.add("heap", heap);
        double xmxHint = xmxGbHint != null ? xmxGbHint : Double.NaN;
        if (Double.isNaN(xmxHint) && heap.has("max_mb") && heap.get("max_mb").getAsDouble() > 0) {
            xmxHint = heap.get("max_mb").getAsDouble() / 1024.0;
        }
        List<String> args = readInputArguments();
        out.addProperty("current_flags", joinFlags(args));
        out.addProperty("flags_source", "runtime_mxbean");
        out.add("flags", classifyArgs(args, xmxHint));
        out.addProperty("java_version", System.getProperty("java.version", ""));
        out.addProperty("java_major", parseJavaMajor(System.getProperty("java.specification.version"),
                System.getProperty("java.version")));
        out.addProperty("sampled_at", Instant.now().toString());
        return out;
    }

    /**
     * Once-per-report sample. Does <strong>not</strong> mutate live GC delta state.
     * Prefer L1 rollup averages (via {@link #averageL1JvmHealth}) for pause % when raising Issues.
     */
    public static JsonObject sampleReport(String serverDir, Double xmxGbHint) {
        JsonObject out = new JsonObject();
        JsonObject heap = sampleHeap();
        out.add("heap", heap);
        double xmxHint = xmxGbHint != null ? xmxGbHint : Double.NaN;
        if (Double.isNaN(xmxHint) && heap.has("max_mb") && heap.get("max_mb").getAsDouble() > 0) {
            xmxHint = heap.get("max_mb").getAsDouble() / 1024.0;
        }

        List<String> runtimeArgs = readInputArguments();
        List<String> fileArgs = List.of();
        if (serverDir != null && !serverDir.isBlank()) {
            fileArgs = readArgsFromFiles(Path.of(serverDir));
        }
        List<String> args;
        String flagsSource;
        if (looksLikeServerJvmArgs(runtimeArgs)) {
            args = runtimeArgs;
            flagsSource = "runtime_mxbean";
        } else if (!fileArgs.isEmpty()) {
            args = fileArgs;
            flagsSource = "jvm_args_file";
        } else {
            args = runtimeArgs;
            flagsSource = "runtime_mxbean";
        }
        out.addProperty("current_flags", joinFlags(args));
        out.addProperty("flags_source", flagsSource);
        out.add("flags", classifyArgs(args, xmxHint));

        JsonObject cumulative = sampleGcCumulative();
        out.add("jvm_gc", cumulative);
        if (cumulative.has("pause_pct_of_wall")) {
            cumulative.addProperty("pause_source", "uptime_cumulative");
        } else {
            cumulative.addProperty("pause_pct_of_wall", 0.0);
            cumulative.addProperty("pause_source", "unavailable");
        }

        out.addProperty("java_version", System.getProperty("java.version", ""));
        out.addProperty("java_major", parseJavaMajor(System.getProperty("java.specification.version"),
                System.getProperty("java.version")));
        out.addProperty("sampled_at", Instant.now().toString());
        return out;
    }

    /**
     * Average L1 minute fields over the last {@code hours} for sustained GC/heap pressure.
     * Returns empty object when rollups are missing.
     */
    public static JsonObject averageL1JvmHealth(Path rollupsPath, int hours) {
        JsonObject out = new JsonObject();
        List<JsonObject> rows = PerformanceRollupWriter.loadRowsFromFile(rollupsPath, Math.max(1, hours));
        if (rows.isEmpty()) {
            return out;
        }
        List<Double> pressure = new ArrayList<>();
        List<Double> pause = new ArrayList<>();
        for (JsonObject row : rows) {
            if (row.has("heap_pressure_pct_avg") && !row.get("heap_pressure_pct_avg").isJsonNull()) {
                pressure.add(row.get("heap_pressure_pct_avg").getAsDouble());
            }
            if (row.has("gc_pause_pct_avg") && !row.get("gc_pause_pct_avg").isJsonNull()) {
                pause.add(row.get("gc_pause_pct_avg").getAsDouble());
            }
        }
        out.addProperty("sample_minutes", rows.size());
        if (!pressure.isEmpty()) {
            out.addProperty("heap_pressure_pct_avg", round1(avg(pressure)));
        }
        if (!pause.isEmpty()) {
            out.addProperty("gc_pause_pct_avg", round1(avg(pause)));
        }
        return out;
    }

    private static double avg(List<Double> values) {
        double sum = 0;
        for (Double v : values) {
            sum += v;
        }
        return sum / values.size();
    }

    public static JsonObject sampleGcDelta() {
        JsonObject out = new JsonObject();
        JsonArray collectors = new JsonArray();
        long now = System.currentTimeMillis();
        long prevWall = LAST_WALL_MS.getAndSet(now);
        long wallDelta = prevWall > 0 ? Math.max(1, now - prevWall) : 0;

        long totalPauseDelta = 0;
        long totalCountDelta = 0;
        List<GarbageCollectorMXBean> beans = ManagementFactory.getGarbageCollectorMXBeans();
        for (GarbageCollectorMXBean bean : beans) {
            String name = bean.getName() != null ? bean.getName() : "gc";
            long count = Math.max(0, bean.getCollectionCount());
            long time = Math.max(0, bean.getCollectionTime());
            long[] prev = LAST_GC.put(name, new long[]{count, time});
            long dCount = prev != null ? Math.max(0, count - prev[0]) : 0;
            long dTime = prev != null ? Math.max(0, time - prev[1]) : 0;
            totalPauseDelta += dTime;
            totalCountDelta += dCount;

            JsonObject c = new JsonObject();
            c.addProperty("name", name);
            c.addProperty("count", count);
            c.addProperty("time_ms", time);
            c.addProperty("count_delta", dCount);
            c.addProperty("time_delta_ms", dTime);
            collectors.add(c);
        }
        out.add("collectors", collectors);
        out.addProperty("pause_ms_window", totalPauseDelta);
        out.addProperty("count_delta", totalCountDelta);
        if (wallDelta > 0 && prevWall > 0) {
            double pct = Math.min(100.0, (totalPauseDelta * 100.0) / wallDelta);
            out.addProperty("pause_pct_of_wall", round1(pct));
            out.addProperty("pause_source", "delta");
        } else {
            out.addProperty("pause_pct_of_wall", 0.0);
            out.addProperty("pause_source", "warmup");
        }

        MemoryMXBean mem = ManagementFactory.getMemoryMXBean();
        MemoryUsage heap = mem.getHeapMemoryUsage();
        long used = heap.getUsed();
        long prevUsed = LAST_HEAP_USED.getAndSet(used);
        if (prevUsed >= 0 && wallDelta > 0 && used >= prevUsed) {
            double mbPerSec = ((used - prevUsed) / (1024.0 * 1024.0)) / (wallDelta / 1000.0);
            out.addProperty("allocation_rate_mb_s", round1(Math.max(0, mbPerSec)));
        }
        return out;
    }

    static JsonObject sampleGcCumulative() {
        JsonObject out = new JsonObject();
        long totalTime = 0;
        JsonArray collectors = new JsonArray();
        for (GarbageCollectorMXBean bean : ManagementFactory.getGarbageCollectorMXBeans()) {
            long time = Math.max(0, bean.getCollectionTime());
            totalTime += time;
            JsonObject c = new JsonObject();
            c.addProperty("name", bean.getName());
            c.addProperty("count", Math.max(0, bean.getCollectionCount()));
            c.addProperty("time_ms", time);
            collectors.add(c);
        }
        out.add("collectors", collectors);
        long uptime = ManagementFactory.getRuntimeMXBean().getUptime();
        if (uptime > 0) {
            double pct = Math.min(100.0, (totalTime * 100.0) / uptime);
            out.addProperty("pause_pct_of_wall", round1(pct));
        }
        return out;
    }

    public static JsonObject sampleHeap() {
        JsonObject out = new JsonObject();
        try {
            MemoryUsage heap = ManagementFactory.getMemoryMXBean().getHeapMemoryUsage();
            long used = heap.getUsed();
            long committed = heap.getCommitted();
            long max = heap.getMax();
            if (max <= 0) {
                max = committed;
            }
            double usedMb = used / (1024.0 * 1024.0);
            double maxMb = max / (1024.0 * 1024.0);
            out.addProperty("used_mb", round1(usedMb));
            out.addProperty("max_mb", round1(maxMb));
            out.addProperty("committed_mb", round1(committed / (1024.0 * 1024.0)));
            if (maxMb > 0) {
                out.addProperty("pressure_pct", round1(Math.min(100.0, (usedMb * 100.0) / maxMb)));
            }
        } catch (Exception e) {
            Runtime rt = Runtime.getRuntime();
            double usedMb = (rt.totalMemory() - rt.freeMemory()) / (1024.0 * 1024.0);
            double maxMb = rt.maxMemory() / (1024.0 * 1024.0);
            out.addProperty("used_mb", round1(usedMb));
            out.addProperty("max_mb", round1(maxMb));
            if (maxMb > 0) {
                out.addProperty("pressure_pct", round1(Math.min(100.0, (usedMb * 100.0) / maxMb)));
            }
        }
        return out;
    }

    public static List<String> readInputArguments() {
        try {
            RuntimeMXBean rt = ManagementFactory.getRuntimeMXBean();
            List<String> args = rt.getInputArguments();
            return args != null ? new ArrayList<>(args) : List.of();
        } catch (Exception e) {
            return List.of();
        }
    }

    public static List<String> readArgsFromFiles(Path serverDir) {
        List<String> out = new ArrayList<>();
        for (String name : List.of("user_jvm_args.txt", "jvm_args.txt")) {
            Path p = serverDir.resolve(name);
            if (!Files.isRegularFile(p)) {
                continue;
            }
            try {
                for (String line : Files.readAllLines(p, StandardCharsets.UTF_8)) {
                    String t = line.strip();
                    if (t.isEmpty() || t.startsWith("#")) {
                        continue;
                    }
                    for (String tok : t.split("\\s+")) {
                        if (!tok.isBlank()) {
                            out.add(tok.trim());
                        }
                    }
                }
            } catch (Exception ignored) {
                // keep going
            }
        }
        return out;
    }

    /** True when args look like a Minecraft server JVM (not a short CLI process). */
    static boolean looksLikeServerJvmArgs(List<String> args) {
        if (args == null || args.isEmpty()) {
            return false;
        }
        for (String a : args) {
            if (a == null) {
                continue;
            }
            String s = a.toLowerCase(Locale.ROOT);
            if (s.contains("useg1gc") || s.contains("usezgc") || s.contains("useshenandoah")
                    || s.startsWith("-xmx") || s.contains("aikars") || s.contains("mcflags.emc.gs")
                    || s.contains("neoforge") || s.contains("forge") || s.contains("fabric")) {
                return true;
            }
        }
        return args.size() >= 8;
    }

    public static JsonObject classifyArgs(List<String> args, double xmxGbHint) {
        if (args == null || args.isEmpty()) {
            JsonObject u = new JsonObject();
            u.addProperty("flags_profile", JvmFlagsClassifier.PROFILE_UNKNOWN);
            u.add("flags_matched", new JsonArray());
            u.addProperty("xms_equals_xmx", true);
            u.addProperty("large_heap_overrides_ok", true);
            u.add("missing_flags", new JsonArray());
            u.add("missing_flags_paste", new JsonArray());
            return u;
        }
        return JvmFlagsClassifier.classify(args, xmxGbHint);
    }

    /** Space-join JVM args for display / copy (empty string when none). */
    public static String joinFlags(List<String> args) {
        if (args == null || args.isEmpty()) {
            return "";
        }
        StringBuilder sb = new StringBuilder();
        for (String a : args) {
            if (a == null || a.isBlank()) {
                continue;
            }
            if (sb.length() > 0) {
                sb.append(' ');
            }
            sb.append(a.trim());
        }
        return sb.toString();
    }

    public static int parseJavaMajor(String specificationVersion, String javaVersion) {
        if (specificationVersion != null && !specificationVersion.isBlank()) {
            String s = specificationVersion.trim();
            if (s.startsWith("1.")) {
                try {
                    return Integer.parseInt(s.substring(2).split("[^0-9]")[0]);
                } catch (Exception ignored) {
                }
            }
            try {
                return Integer.parseInt(s.split("[^0-9]")[0]);
            } catch (Exception ignored) {
            }
        }
        if (javaVersion != null && !javaVersion.isBlank()) {
            String v = javaVersion.trim().toLowerCase(Locale.ROOT);
            if (v.startsWith("1.")) {
                try {
                    return Integer.parseInt(v.substring(2).split("[^0-9]")[0]);
                } catch (Exception ignored) {
                }
            }
            try {
                return Integer.parseInt(v.split("[^0-9]")[0]);
            } catch (Exception ignored) {
            }
        }
        return -1;
    }

    /** Test helper: reset delta state between tests. */
    public static void resetDeltaStateForTests() {
        LAST_GC.clear();
        LAST_WALL_MS.set(0);
        LAST_HEAP_USED.set(-1);
    }

    private static double round1(double v) {
        return Math.round(v * 10.0) / 10.0;
    }
}
