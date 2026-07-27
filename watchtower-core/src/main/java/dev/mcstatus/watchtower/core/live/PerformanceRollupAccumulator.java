package dev.mcstatus.watchtower.core.live;

import com.google.gson.JsonObject;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * In-memory buffer aggregating live samples for one wall-clock minute.
 */
public final class PerformanceRollupAccumulator {

    private final List<Double> tpsSamples = new ArrayList<>();
    private final List<Double> msptSamples = new ArrayList<>();
    private final List<Integer> playerSamples = new ArrayList<>();
    private final List<Double> heapUsedGbSamples = new ArrayList<>();
    private final List<Double> memUsedGbSamples = new ArrayList<>();
    private final List<Double> cpuPctSamples = new ArrayList<>();
    private final List<Double> heapPressurePctSamples = new ArrayList<>();
    private final List<Double> gcPausePctSamples = new ArrayList<>();
    private final List<Double> diskUsePctSamples = new ArrayList<>();
    private final List<Double> diskFreeGbSamples = new ArrayList<>();
    private final List<Double> diskWriteMbSSamples = new ArrayList<>();
    private final List<Double> diskWriteAwaitMsSamples = new ArrayList<>();
    private boolean lowTpsFlag;

    public void reset() {
        tpsSamples.clear();
        msptSamples.clear();
        playerSamples.clear();
        heapUsedGbSamples.clear();
        memUsedGbSamples.clear();
        cpuPctSamples.clear();
        heapPressurePctSamples.clear();
        gcPausePctSamples.clear();
        diskUsePctSamples.clear();
        diskFreeGbSamples.clear();
        diskWriteMbSSamples.clear();
        diskWriteAwaitMsSamples.clear();
        lowTpsFlag = false;
    }

    public void addSample(
            Double tps,
            Double mspt,
            int players,
            Double heapUsedGb,
            Double memUsedGb,
            Double cpuPct,
            double tpsWarn) {
        addSample(tps, mspt, players, heapUsedGb, memUsedGb, cpuPct, tpsWarn, null, null, null, null, null, null);
    }

    public void addSample(
            Double tps,
            Double mspt,
            int players,
            Double heapUsedGb,
            Double memUsedGb,
            Double cpuPct,
            double tpsWarn,
            Double heapPressurePct,
            Double gcPausePct) {
        addSample(tps, mspt, players, heapUsedGb, memUsedGb, cpuPct, tpsWarn,
                heapPressurePct, gcPausePct, null, null, null, null);
    }

    public void addSample(
            Double tps,
            Double mspt,
            int players,
            Double heapUsedGb,
            Double memUsedGb,
            Double cpuPct,
            double tpsWarn,
            Double heapPressurePct,
            Double gcPausePct,
            Double diskUsePct,
            Double diskFreeGb,
            Double diskWriteMbS,
            Double diskWriteAwaitMs) {
        if (tps != null) {
            tpsSamples.add(tps);
            if (tps < tpsWarn) {
                lowTpsFlag = true;
            }
        }
        if (mspt != null) {
            msptSamples.add(mspt);
        }
        playerSamples.add(players);
        if (heapUsedGb != null) {
            heapUsedGbSamples.add(heapUsedGb);
        }
        if (memUsedGb != null) {
            memUsedGbSamples.add(memUsedGb);
        }
        if (cpuPct != null) {
            cpuPctSamples.add(cpuPct);
        }
        if (heapPressurePct != null) {
            heapPressurePctSamples.add(heapPressurePct);
        }
        if (gcPausePct != null) {
            gcPausePctSamples.add(gcPausePct);
        }
        if (diskUsePct != null) {
            diskUsePctSamples.add(diskUsePct);
        }
        if (diskFreeGb != null) {
            diskFreeGbSamples.add(diskFreeGb);
        }
        if (diskWriteMbS != null) {
            diskWriteMbSSamples.add(diskWriteMbS);
        }
        if (diskWriteAwaitMs != null) {
            diskWriteAwaitMsSamples.add(diskWriteAwaitMs);
        }
    }

    public boolean isEmpty() {
        return msptSamples.isEmpty() && tpsSamples.isEmpty();
    }

    /**
     * Build a rollup row for {@code minuteEpochSec} (start of minute, UTC).
     */
    public JsonObject finalizeRow(long minuteEpochSec) {
        JsonObject row = new JsonObject();
        row.addProperty("ts", Instant.ofEpochSecond(minuteEpochSec).toString());

        if (!tpsSamples.isEmpty()) {
            row.addProperty("tps_avg", round2(avg(tpsSamples)));
            row.addProperty("tps_min", round2(Collections.min(tpsSamples)));
        }
        if (!msptSamples.isEmpty()) {
            row.addProperty("mspt_avg", round1(avg(msptSamples)));
            row.addProperty("mspt_p95", round1(p95(msptSamples)));
            row.addProperty("mspt_jitter_max", round1(maxJitter(msptSamples)));
        }
        if (!playerSamples.isEmpty()) {
            row.addProperty("players_max", Collections.max(playerSamples));
        }
        if (!heapUsedGbSamples.isEmpty()) {
            row.addProperty("heap_used_gb_avg", round2(avg(heapUsedGbSamples)));
            row.addProperty("heap_used_gb_max", round2(Collections.max(heapUsedGbSamples)));
        }
        if (!memUsedGbSamples.isEmpty()) {
            row.addProperty("mem_used_gb_avg", round2(avg(memUsedGbSamples)));
        }
        if (!cpuPctSamples.isEmpty()) {
            row.addProperty("cpu_pct_avg", round1(avg(cpuPctSamples)));
        }
        if (!heapPressurePctSamples.isEmpty()) {
            row.addProperty("heap_pressure_pct_avg", round1(avg(heapPressurePctSamples)));
            row.addProperty("heap_pressure_pct_max", round1(Collections.max(heapPressurePctSamples)));
        }
        if (!gcPausePctSamples.isEmpty()) {
            row.addProperty("gc_pause_pct_avg", round1(avg(gcPausePctSamples)));
        }
        if (!diskUsePctSamples.isEmpty()) {
            row.addProperty("disk_use_pct_avg", round1(avg(diskUsePctSamples)));
        }
        if (!diskFreeGbSamples.isEmpty()) {
            row.addProperty("disk_free_gb_avg", round2(avg(diskFreeGbSamples)));
        }
        if (!diskWriteMbSSamples.isEmpty()) {
            row.addProperty("disk_write_mb_s_avg", round2(avg(diskWriteMbSSamples)));
        }
        if (!diskWriteAwaitMsSamples.isEmpty()) {
            row.addProperty("disk_write_await_ms_avg", round1(avg(diskWriteAwaitMsSamples)));
        }
        row.addProperty("low_tps_flag", lowTpsFlag);
        return row;
    }

    public static double avg(List<? extends Number> values) {
        if (values.isEmpty()) {
            return 0;
        }
        double sum = 0;
        for (Number n : values) {
            sum += n.doubleValue();
        }
        return sum / values.size();
    }

    public static double p95(List<Double> values) {
        return percentile(values, 0.95);
    }

    public static double p50(List<Double> values) {
        return percentile(values, 0.50);
    }

    /**
     * Inclusive percentile of a numeric list (q in {@code (0, 1]}).
     * Empty list → 0.
     */
    public static double percentile(List<Double> values, double q) {
        if (values == null || values.isEmpty()) {
            return 0;
        }
        double qq = Math.max(0.01, Math.min(1.0, q));
        List<Double> sorted = new ArrayList<>(values);
        Collections.sort(sorted);
        int idx = (int) Math.ceil(sorted.size() * qq) - 1;
        idx = Math.max(0, Math.min(sorted.size() - 1, idx));
        return sorted.get(idx);
    }

    static double maxJitter(List<Double> values) {
        if (values.size() < 2) {
            return 0;
        }
        double max = 0;
        for (int i = 1; i < values.size(); i++) {
            max = Math.max(max, Math.abs(values.get(i) - values.get(i - 1)));
        }
        return max;
    }

    public static double round1(double v) {
        return Math.round(v * 10.0) / 10.0;
    }

    public static double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }
}
