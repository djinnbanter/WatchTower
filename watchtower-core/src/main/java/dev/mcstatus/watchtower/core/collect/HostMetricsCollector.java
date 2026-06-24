package dev.mcstatus.watchtower.core.collect;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.report.ReportConfig;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Host metrics from /proc and subprocess tools (ported from build_staging host section).
 */
public final class HostMetricsCollector {

    private static final Gson GSON = new Gson();
    private static final Path PROC_STAT = Path.of("/proc/stat");
    private static final Path PROC_UPTIME = Path.of("/proc/uptime");
    private static final Path PROC_LOADAVG = Path.of("/proc/loadavg");
    private static final Path PROC_MEMINFO = Path.of("/proc/meminfo");

    private HostMetricsCollector() {
    }

    public static JsonObject collectSystemBasics(String serverDir) {
        JsonObject system = new JsonObject();
        system.addProperty("uptime_seconds", readUptimeSeconds());
        system.add("load_avg", readLoadAvg());
        Integer cores = cpuCount();
        if (cores != null) {
            system.addProperty("cpu_count", cores);
            if (system.has("load_avg") && !system.get("load_avg").isJsonNull()) {
                JsonArray load = system.getAsJsonArray("load_avg");
                if (!load.isEmpty()) {
                    system.addProperty("load_1m_per_core",
                            Math.round(load.get(0).getAsDouble() / cores * 100.0) / 100.0);
                }
            }
        }
        applyMeminfo(system);
        CgroupProbe.applyToSystem(system);
        applyDiskMetrics(system, serverDir);
        applyJavaRuntimeVersion(system);
        return system;
    }

    private static void applyJavaRuntimeVersion(JsonObject system) {
        String version = System.getProperty("java.version");
        if (version != null && !version.isBlank()) {
            system.addProperty("java_version", version);
        }
    }

    private static void applyDiskMetrics(JsonObject system, String serverDir) {
        JsonObject disk = readDiskSpaceGb(serverDir);
        if (disk.has("disk_available") && disk.get("disk_available").getAsBoolean()) {
            if (disk.has("disk_use_pct")) {
                system.addProperty("disk_use_pct", disk.get("disk_use_pct").getAsInt());
            }
            if (disk.has("disk_free_gb")) {
                system.addProperty("disk_free_gb", disk.get("disk_free_gb").getAsDouble());
            }
            if (disk.has("disk_total_gb")) {
                system.addProperty("disk_total_gb", disk.get("disk_total_gb").getAsDouble());
            }
        }
    }

    /**
     * Filesystem usage for the server data path via {@code df -P}.
     */
    public static JsonObject readDiskSpaceGb(String serverDir) {
        JsonObject disk = new JsonObject();
        DfParseResult parsed = parseDf(serverDir);
        if (parsed == null) {
            disk.addProperty("disk_available", false);
            return disk;
        }
        disk.addProperty("disk_available", true);
        disk.addProperty("disk_use_pct", parsed.usePct());
        disk.addProperty("disk_free_gb", parsed.freeGb());
        disk.addProperty("disk_total_gb", parsed.totalGb());
        return disk;
    }

    public static void applyJavaProcessInfo(JsonObject system, ReportConfig config) {
        JsonObject info = javaProcessInfo(config);
        for (String key : info.keySet()) {
            system.add(key, info.get(key));
        }
    }

    public static void collectCpuMetrics(JsonObject system, ReportConfig config, String since) {
        Double hostNow = hostCpuPctNow(config.cpuSampleIntervalMs());
        if (hostNow != null) {
            system.addProperty("host_cpu_pct_now", hostNow);
        }

        if (system.has("java_cpu_pct_avg") && system.has("cpu_count")) {
            double javaPct = system.get("java_cpu_pct_avg").getAsDouble();
            int cores = system.get("cpu_count").getAsInt();
            system.addProperty("java_cpu_pct_of_machine", Math.round(javaPct / cores * 10.0) / 10.0);
        }

        Double sarAvg = parseSarCpuAvg(since);
        if (sarAvg != null) {
            system.addProperty("host_cpu_pct_avg", sarAvg);
            system.addProperty("host_cpu_avg_source", "sar");
        } else {
            mergeCpuStateSamples(system, config);
        }
    }

    public static JsonObject loadStateFile(ReportConfig config) {
        String stateFile = config.stateFile();
        if (stateFile == null || stateFile.isBlank()) {
            return new JsonObject();
        }
        Path path = Path.of(stateFile);
        if (!Files.isRegularFile(path)) {
            return new JsonObject();
        }
        try {
            String text = Files.readString(path, StandardCharsets.UTF_8);
            return GSON.fromJson(text, JsonObject.class);
        } catch (IOException | com.google.gson.JsonSyntaxException e) {
            return new JsonObject();
        }
    }

    public static Integer cpuCount() {
        int n = Runtime.getRuntime().availableProcessors();
        if (n > 0) {
            return n;
        }
        try {
            Process proc = new ProcessBuilder("nproc").redirectErrorStream(true).start();
            if (!proc.waitFor(5, TimeUnit.SECONDS)) {
                proc.destroyForcibly();
                return null;
            }
            String out = new String(proc.getInputStream().readAllBytes(), StandardCharsets.UTF_8).strip();
            return Integer.parseInt(out);
        } catch (Exception e) {
            return null;
        }
    }

    public static Double hostCpuPctNow(int intervalMs) {
        int[] first = readProcStatCpu();
        if (first == null) {
            return null;
        }
        try {
            Thread.sleep(Math.max(50, intervalMs));
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            return null;
        }
        int[] second = readProcStatCpu();
        if (second == null) {
            return null;
        }
        long idleDelta = second[0] - first[0];
        long totalDelta = second[1] - first[1];
        if (totalDelta <= 0) {
            return null;
        }
        return Math.round(100.0 * (1.0 - (double) idleDelta / totalDelta) * 10.0) / 10.0;
    }

    private static int[] readProcStatCpu() {
        if (!Files.isRegularFile(PROC_STAT)) {
            return null;
        }
        try {
            String line = Files.readAllLines(PROC_STAT, StandardCharsets.UTF_8).getFirst();
            if (!line.startsWith("cpu ")) {
                return null;
            }
            String[] parts = line.trim().split("\\s+");
            List<Long> values = new ArrayList<>();
            for (int i = 1; i < parts.length; i++) {
                values.add(Long.parseLong(parts[i]));
            }
            long idle = values.get(3) + (values.size() > 4 ? values.get(4) : 0);
            long total = values.stream().mapToLong(Long::longValue).sum();
            return new int[]{(int) idle, (int) total};
        } catch (IOException | NumberFormatException | IndexOutOfBoundsException e) {
            return null;
        }
    }

    private static double readUptimeSeconds() {
        if (!Files.isRegularFile(PROC_UPTIME)) {
            return 0;
        }
        try {
            String[] parts = Files.readString(PROC_UPTIME, StandardCharsets.UTF_8).trim().split("\\s+");
            return Double.parseDouble(parts[0]);
        } catch (IOException | NumberFormatException e) {
            return 0;
        }
    }

    private static JsonArray readLoadAvg() {
        if (!Files.isRegularFile(PROC_LOADAVG)) {
            return null;
        }
        try {
            String[] parts = Files.readString(PROC_LOADAVG, StandardCharsets.UTF_8).trim().split("\\s+");
            JsonArray arr = new JsonArray();
            arr.add(Double.parseDouble(parts[0]));
            arr.add(Double.parseDouble(parts[1]));
            arr.add(Double.parseDouble(parts[2]));
            return arr;
        } catch (IOException | NumberFormatException | IndexOutOfBoundsException e) {
            return null;
        }
    }

    private static void applyMeminfo(JsonObject system) {
        if (!Files.isRegularFile(PROC_MEMINFO)) {
            system.add("mem_available_gb", null);
            system.addProperty("swap_used_mb", 0);
            return;
        }
        try {
            long memAvailable = 0;
            long swapTotal = 0;
            long swapFree = 0;
            for (String line : Files.readAllLines(PROC_MEMINFO, StandardCharsets.UTF_8)) {
                int colon = line.indexOf(':');
                if (colon < 0) {
                    continue;
                }
                String key = line.substring(0, colon).strip();
                long kb = Long.parseLong(line.substring(colon + 1).trim().split("\\s+")[0]);
                switch (key) {
                    case "MemAvailable" -> memAvailable = kb;
                    case "SwapTotal" -> swapTotal = kb;
                    case "SwapFree" -> swapFree = kb;
                    default -> { }
                }
            }
            system.addProperty("mem_available_gb", Math.round(memAvailable / 1024.0 / 1024.0 * 100.0) / 100.0);
            system.addProperty("swap_used_mb", Math.round((swapTotal - swapFree) / 1024.0 * 10.0) / 10.0);
        } catch (IOException | NumberFormatException e) {
            system.add("mem_available_gb", null);
            system.addProperty("swap_used_mb", 0);
        }
    }

    private record DfParseResult(int usePct, double freeGb, double totalGb) {
    }

    private static DfParseResult parseDf(String serverDir) {
        String target = serverDir == null || serverDir.isBlank() ? "/" : serverDir;
        try {
            Process proc = new ProcessBuilder("df", "-P", target)
                    .redirectErrorStream(true)
                    .start();
            if (!proc.waitFor(15, TimeUnit.SECONDS)) {
                proc.destroyForcibly();
                return null;
            }
            try (var reader = new BufferedReader(new InputStreamReader(proc.getInputStream(), StandardCharsets.UTF_8))) {
                reader.readLine();
                String data = reader.readLine();
                if (data == null) {
                    return null;
                }
                String[] cols = data.trim().split("\\s+");
                if (cols.length < 5) {
                    return null;
                }
                long totalKb = Long.parseLong(cols[1]);
                long availKb = Long.parseLong(cols[3]);
                int usePct = Integer.parseInt(cols[4].replace("%", ""));
                double freeGb = Math.round(availKb / 1024.0 / 1024.0 * 100.0) / 100.0;
                double totalGb = Math.round(totalKb / 1024.0 / 1024.0 * 100.0) / 100.0;
                return new DfParseResult(usePct, freeGb, totalGb);
            }
        } catch (Exception ignored) {
            // Windows / missing df
        }
        return null;
    }

    public static JsonObject javaProcessInfo(ReportConfig config) {
        JsonObject info = new JsonObject();
        String javaPat = config.javaPattern();
        Integer pid = findJavaPid(javaPat);
        if (pid != null) {
            info.addProperty("java_pid", pid);
            readJavaRss(pid, info);
            readJavaCpu(pid, info);
        }
        String serverDir = config.serverDir();
        if (serverDir != null && !serverDir.isBlank()) {
            for (String name : List.of("user_jvm_args.txt", "jvm_args.txt")) {
                Path p = Path.of(serverDir, name);
                if (Files.isRegularFile(p)) {
                    try {
                        double[] heap = CollectSupport.parseJvmHeapGb(Files.readString(p, StandardCharsets.UTF_8));
                        if (!Double.isNaN(heap[0])) {
                            info.addProperty("java_xms_gb", heap[0]);
                        }
                        if (!Double.isNaN(heap[1])) {
                            info.addProperty("java_xmx_gb", heap[1]);
                        }
                    } catch (IOException ignored) {
                        // skip
                    }
                    break;
                }
            }
        }
        return info;
    }

    private static Integer findJavaPid(String pattern) {
        try {
            Process proc = new ProcessBuilder("pgrep", "-f", pattern)
                    .redirectErrorStream(false)
                    .start();
            proc.getErrorStream().close();
            if (!proc.waitFor(5, TimeUnit.SECONDS)) {
                proc.destroyForcibly();
                return null;
            }
            String out = new String(proc.getInputStream().readAllBytes(), StandardCharsets.UTF_8).strip();
            if (out.isBlank()) {
                return null;
            }
            return Integer.parseInt(out.split("\\s+")[0]);
        } catch (Exception e) {
            return null;
        }
    }

    private static void readJavaRss(int pid, JsonObject info) {
        Path status = Path.of("/proc", String.valueOf(pid), "status");
        if (!Files.isRegularFile(status)) {
            return;
        }
        try {
            for (String line : Files.readAllLines(status, StandardCharsets.UTF_8)) {
                if (line.startsWith("VmRSS:")) {
                    long kb = Long.parseLong(line.trim().split("\\s+")[1]);
                    info.addProperty("java_rss_gb", Math.round(kb / 1024.0 / 1024.0 * 100.0) / 100.0);
                    break;
                }
            }
        } catch (IOException | NumberFormatException ignored) {
            // skip
        }
    }

    private static void readJavaCpu(int pid, JsonObject info) {
        try {
            if (!Files.isRegularFile(PROC_UPTIME)) {
                return;
            }
            double uptime = Double.parseDouble(Files.readString(PROC_UPTIME, StandardCharsets.UTF_8).split("\\s+")[0]);
            Path stat = Path.of("/proc", String.valueOf(pid), "stat");
            if (!Files.isRegularFile(stat)) {
                return;
            }
            String[] parts = Files.readString(stat, StandardCharsets.UTF_8).split("\\s+");
            if (parts.length < 22) {
                return;
            }
            long startTick = Long.parseLong(parts[21]);
            long utime = Long.parseLong(parts[13]);
            long stime = Long.parseLong(parts[14]);
            long hz = OsHelper.clkTck();
            double javaUptimeSec = uptime - (double) startTick / hz;
            info.addProperty("java_uptime_sec", Math.round(javaUptimeSec));
            if (javaUptimeSec > 0) {
                double javaCpuPct = 100.0 * (utime + stime) / hz / javaUptimeSec;
                info.addProperty("java_cpu_pct_avg", Math.round(javaCpuPct * 10.0) / 10.0);
                info.addProperty("java_cpu_cores_equiv", Math.round(javaCpuPct / 100.0 * 10.0) / 10.0);
            }
        } catch (IOException | NumberFormatException | IndexOutOfBoundsException ignored) {
            // skip
        }
    }

    private static Double parseSarCpuAvg(String since) {
        try {
            Process proc = new ProcessBuilder("sar", "-u", "-s", since, "-e", "now")
                    .redirectErrorStream(true)
                    .start();
            if (!proc.waitFor(30, TimeUnit.SECONDS)) {
                proc.destroyForcibly();
                return null;
            }
            String out = new String(proc.getInputStream().readAllBytes(), StandardCharsets.UTF_8);
            List<Double> idleVals = new ArrayList<>();
            for (String line : out.split("\\R")) {
                String trimmed = line.strip();
                if (trimmed.isEmpty() || trimmed.startsWith("Linux") || trimmed.startsWith("Average")) {
                    continue;
                }
                if (trimmed.startsWith("%") || trimmed.contains("CPU")) {
                    continue;
                }
                String[] parts = trimmed.split("\\s+");
                if (parts.length < 8) {
                    continue;
                }
                try {
                    idleVals.add(Double.parseDouble(parts[7]));
                } catch (NumberFormatException ignored) {
                    // skip line
                }
            }
            if (idleVals.isEmpty()) {
                return null;
            }
            double avgIdle = idleVals.stream().mapToDouble(Double::doubleValue).average().orElse(0);
            return Math.round((100.0 - avgIdle) * 10.0) / 10.0;
        } catch (Exception e) {
            return null;
        }
    }

    private static void mergeCpuStateSamples(JsonObject system, ReportConfig config) {
        String stateFile = config.stateFile();
        if (stateFile == null || stateFile.isBlank()) {
            if (!system.has("host_cpu_avg_source")) {
                system.addProperty("host_cpu_avg_source", "unavailable");
            }
            return;
        }
        Path path = Path.of(stateFile);
        if (!Files.isRegularFile(path)) {
            if (!system.has("host_cpu_avg_source")) {
                system.addProperty("host_cpu_avg_source", "unavailable");
            }
            return;
        }
        JsonObject state;
        try {
            state = GSON.fromJson(Files.readString(path, StandardCharsets.UTF_8), JsonObject.class);
        } catch (IOException | com.google.gson.JsonSyntaxException e) {
            if (!system.has("host_cpu_avg_source")) {
                system.addProperty("host_cpu_avg_source", "unavailable");
            }
            return;
        }

        double cutoff = Instant.now().getEpochSecond() - (long) config.lookbackHours() * 3600L;
        JsonArray samples = state.has("cpu_samples") ? state.getAsJsonArray("cpu_samples") : new JsonArray();
        List<JsonObject> pruned = new ArrayList<>();
        for (var el : samples) {
            JsonObject s = el.getAsJsonObject();
            ZonedDateTime ts = CollectSupport.parseTime(CollectSupport.getString(s, "time"));
            if (ts != null && CollectSupport.epochSeconds(ts) >= cutoff) {
                pruned.add(s);
            }
        }

        if (pruned.size() >= 2) {
            List<Double> hostVals = new ArrayList<>();
            List<Double> javaVals = new ArrayList<>();
            for (JsonObject s : pruned) {
                if (s.has("host_pct") && !s.get("host_pct").isJsonNull()) {
                    hostVals.add(s.get("host_pct").getAsDouble());
                }
                if (s.has("java_pct") && !s.get("java_pct").isJsonNull()) {
                    javaVals.add(s.get("java_pct").getAsDouble());
                }
            }
            if (!hostVals.isEmpty()) {
                double avg = hostVals.stream().mapToDouble(Double::doubleValue).average().orElse(0);
                system.addProperty("host_cpu_pct_avg", Math.round(avg * 10.0) / 10.0);
                system.addProperty("host_cpu_avg_source", "state_samples");
                system.addProperty("host_cpu_sample_count", hostVals.size());
            }
            if (!javaVals.isEmpty()) {
                double avg = javaVals.stream().mapToDouble(Double::doubleValue).average().orElse(0);
                system.addProperty("java_cpu_pct_avg_window", Math.round(avg * 10.0) / 10.0);
            }
        } else if (!system.has("host_cpu_avg_source")) {
            system.addProperty("host_cpu_avg_source", "unavailable");
        }
    }

    /** Minimal CLK_TCK helper without external deps. */
    private static final class OsHelper {
        private static final long CLK_TCK = readClkTck();

        static long clkTck() {
            return CLK_TCK;
        }

        private static long readClkTck() {
            try {
                Process proc = new ProcessBuilder("getconf", "CLK_TCK").redirectErrorStream(true).start();
                if (proc.waitFor(2, TimeUnit.SECONDS)) {
                    String out = new String(proc.getInputStream().readAllBytes(), StandardCharsets.UTF_8).strip();
                    return Long.parseLong(out);
                }
            } catch (Exception ignored) {
                // fall through
            }
            return 100;
        }
    }
}
