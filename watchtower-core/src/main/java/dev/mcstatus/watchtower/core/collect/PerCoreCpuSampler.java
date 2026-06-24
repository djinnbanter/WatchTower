package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Samples per-CPU-core usage from {@code /proc/stat} on Linux.
 */
public final class PerCoreCpuSampler {

    private static final Path PROC_STAT = Path.of("/proc/stat");
    private static final Pattern CORE_LINE = Pattern.compile("^cpu(\\d+)\\s+(.+)$");

    private final Map<Integer, long[]> previousJiffies = new HashMap<>();
    private long lastSampleEpoch;

    public JsonObject sample() {
        if (!Files.isRegularFile(PROC_STAT)) {
            return null;
        }
        long now = System.currentTimeMillis() / 1000L;
        Map<Integer, long[]> current = readCoreJiffies();
        if (current.isEmpty()) {
            return null;
        }

        JsonArray cores = new JsonArray();
        if (!previousJiffies.isEmpty() && lastSampleEpoch > 0) {
            for (Map.Entry<Integer, long[]> entry : current.entrySet()) {
                long[] prev = previousJiffies.get(entry.getKey());
                if (prev == null) {
                    continue;
                }
                double pct = usagePct(prev, entry.getValue());
                if (pct >= 0) {
                    JsonObject core = new JsonObject();
                    core.addProperty("id", entry.getKey());
                    core.addProperty("pct", Math.round(pct * 10.0) / 10.0);
                    cores.add(core);
                }
            }
        }

        previousJiffies.clear();
        previousJiffies.putAll(current);
        lastSampleEpoch = now;

        if (cores.isEmpty()) {
            return null;
        }
        JsonObject out = new JsonObject();
        out.add("cores", cores);
        out.addProperty("cpu_count", cores.size());
        out.addProperty("sample_age_sec", 0);
        return out;
    }

    private static Map<Integer, long[]> readCoreJiffies() {
        Map<Integer, long[]> map = new HashMap<>();
        try {
            for (String line : Files.readAllLines(PROC_STAT, StandardCharsets.UTF_8)) {
                var m = CORE_LINE.matcher(line.trim());
                if (!m.matches()) {
                    continue;
                }
                int id = Integer.parseInt(m.group(1));
                String[] parts = m.group(2).trim().split("\\s+");
                long total = 0;
                long idle = 0;
                for (int i = 0; i < parts.length; i++) {
                    long v = Long.parseLong(parts[i]);
                    total += v;
                    if (i == 3) {
                        idle = v;
                    }
                }
                if (parts.length > 4) {
                    idle += Long.parseLong(parts[4]);
                }
                map.put(id, new long[] {idle, total});
            }
        } catch (IOException | NumberFormatException e) {
            return Map.of();
        }
        return map;
    }

    private static double usagePct(long[] prev, long[] curr) {
        long idleDelta = curr[0] - prev[0];
        long totalDelta = curr[1] - prev[1];
        if (totalDelta <= 0) {
            return -1;
        }
        return 100.0 * (1.0 - (double) idleDelta / totalDelta);
    }
}
