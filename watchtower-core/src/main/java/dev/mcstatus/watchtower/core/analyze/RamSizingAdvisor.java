package dev.mcstatus.watchtower.core.analyze;

import com.google.gson.JsonObject;

/**
 * Conservative RAM / {@code -Xmx} right-sizing advisor (1.1.2 + 1.1.26 envelope).
 * Wallet-framed; never raises RAM when the window GC verdict says tick/GC-bound,
 * and never pushes {@code -Xmx} past host/container headroom.
 */
public final class RamSizingAdvisor {

    public static final String VERDICT_INSUFFICIENT = "insufficient_data";
    public static final String VERDICT_OVER = "over_provisioned";
    public static final String VERDICT_UNDER = "under_provisioned";
    public static final String VERDICT_RIGHT = "right_sized";
    public static final String VERDICT_ENVELOPE_TIGHT = "envelope_tight";

    public static final String ENVELOPE_OK = "ok";
    public static final String ENVELOPE_LOW = "low";
    public static final String ENVELOPE_CRITICAL = "critical";
    public static final String ENVELOPE_UNKNOWN = "unknown";

    /** Conservative: peak must be at or below this fraction of Xmx. */
    public static final double OVER_PEAK_FRAC = 0.50;
    /** Conservative: pressure p95 must be at or below this. */
    public static final double OVER_PRESSURE_P95_MAX = 35.0;
    /** Under-provisioned pressure p95 bar (aligns with GcAdvisor soft heap). */
    public static final double UNDER_PRESSURE_P95_MIN = 85.0;
    public static final double MIN_SPAN_DAYS = 7.0;
    public static final double MIN_XMX_FLOOR_GB = 6.0;

    public static final double ENVELOPE_CRITICAL_FRAC = 0.85;
    public static final double ENVELOPE_LOW_FRAC = 0.70;
    public static final double ENVELOPE_CRITICAL_OUTSIDE_GB = 1.0;
    public static final double ENVELOPE_LOW_OUTSIDE_GB = 1.5;
    public static final double ENVELOPE_SAFE_XMX_FRAC = 0.65;
    public static final double ENVELOPE_SAFE_XMX_FLOOR_GB = 2.0;

    private RamSizingAdvisor() {
    }

    public static String classifyEnvelope(double hostMemGb, double xmxGb) {
        if (Double.isNaN(hostMemGb) || hostMemGb <= 0 || Double.isNaN(xmxGb) || xmxGb <= 0) {
            return ENVELOPE_UNKNOWN;
        }
        double outside = hostMemGb - xmxGb;
        double frac = xmxGb / hostMemGb;
        if (frac >= ENVELOPE_CRITICAL_FRAC || outside < ENVELOPE_CRITICAL_OUTSIDE_GB) {
            return ENVELOPE_CRITICAL;
        }
        if (frac >= ENVELOPE_LOW_FRAC || outside < ENVELOPE_LOW_OUTSIDE_GB) {
            return ENVELOPE_LOW;
        }
        return ENVELOPE_OK;
    }

    public static double safeXmxMaxGb(double hostMemGb) {
        if (Double.isNaN(hostMemGb) || hostMemGb <= 0) {
            return Double.NaN;
        }
        return Math.max(ENVELOPE_SAFE_XMX_FLOOR_GB, Math.floor(hostMemGb * ENVELOPE_SAFE_XMX_FRAC));
    }

    /**
     * Compact live/Overview snapshot. When envelope is {@link #ENVELOPE_UNKNOWN}, only
     * {@code envelope} is set.
     */
    public static JsonObject envelopeSnapshot(double hostMemGb, double xmxGb, String ramSource) {
        JsonObject o = new JsonObject();
        String env = classifyEnvelope(hostMemGb, xmxGb);
        o.addProperty("envelope", env);
        if (!ENVELOPE_UNKNOWN.equals(env)) {
            o.addProperty("host_mem_gb", round2(hostMemGb));
            o.addProperty("xmx_gb", round2(xmxGb));
            o.addProperty("outside_headroom_gb", round2(hostMemGb - xmxGb));
            if (ramSource != null && !ramSource.isBlank()) {
                o.addProperty("ram_source", ramSource);
            }
        }
        return o;
    }

    /**
     * @param window          Insights window id ({@code 7d}/{@code 30d})
     * @param stats           heap window stats from {@link PerformanceInsightEngine#buildRamSizingStats}
     * @param xmxGb           current allocated heap (NaN if unknown)
     * @param xmxSource       {@code live} / {@code report} / {@code unknown}
     * @param gcVerdict       window-recomputed {@link GcAdvisor} verdict
     */
    public static JsonObject evaluate(
            String window,
            JsonObject stats,
            double xmxGb,
            String xmxSource,
            String gcVerdict
    ) {
        return evaluate(window, stats, xmxGb, xmxSource, gcVerdict, Double.NaN, null);
    }

    /**
     * @param hostMemGb host/container memory total (NaN if unknown)
     * @param ramSource {@code cgroup_v2} / {@code cgroup_v1} / {@code proc} / etc.
     */
    public static JsonObject evaluate(
            String window,
            JsonObject stats,
            double xmxGb,
            String xmxSource,
            String gcVerdict,
            double hostMemGb,
            String ramSource
    ) {
        JsonObject out = new JsonObject();
        String win = window != null && !window.isBlank() ? window : "7d";
        out.addProperty("window", win);
        out.addProperty("gc_verdict_source", "window");

        boolean sufficient = stats != null && bool(stats, "sufficient_data", false);
        out.addProperty("sufficient_data", sufficient);
        copyNum(out, stats, "sample_minutes");
        copyNum(out, stats, "span_days");
        copyNum(out, stats, "heap_used_gb_avg");
        copyNum(out, stats, "heap_used_gb_p95");
        copyNum(out, stats, "heap_used_gb_peak");
        copyNum(out, stats, "heap_pressure_pct_avg");
        copyNum(out, stats, "heap_pressure_pct_p95");
        copyNum(out, stats, "heap_pressure_pct_peak");

        String src = xmxSource != null && !xmxSource.isBlank() ? xmxSource : "unknown";
        out.addProperty("xmx_source", src);
        if (!Double.isNaN(xmxGb) && xmxGb > 0) {
            out.addProperty("xmx_gb", round2(xmxGb));
        }

        String gc = gcVerdict != null && !gcVerdict.isBlank() ? gcVerdict : GcAdvisor.VERDICT_HEALTHY;
        out.addProperty("gc_verdict", gc);

        String envelope = classifyEnvelope(hostMemGb, xmxGb);
        out.addProperty("envelope", envelope);
        if (!ENVELOPE_UNKNOWN.equals(envelope)) {
            out.addProperty("host_mem_gb", round2(hostMemGb));
            out.addProperty("outside_headroom_gb", round2(hostMemGb - xmxGb));
            out.addProperty("ram_source", ramSource != null && !ramSource.isBlank() ? ramSource : "unknown");
        }

        // Envelope does not need 7d heap history — tight host wins immediately.
        if (ENVELOPE_LOW.equals(envelope) || ENVELOPE_CRITICAL.equals(envelope)) {
            applyEnvelopeTight(out, hostMemGb, xmxGb, ramSource, envelope);
            return out;
        }

        if (!sufficient) {
            out.addProperty("verdict", VERDICT_INSUFFICIENT);
            out.addProperty("ram_upgrade_blocked", false);
            out.addProperty("advice",
                    "Need at least 7 days of live heap history before WatchTower can right-size -Xmx.");
            return out;
        }

        double peak = dbl(stats, "heap_used_gb_peak", Double.NaN);
        double pressureP95 = dbl(stats, "heap_pressure_pct_p95", Double.NaN);
        if (Double.isNaN(pressureP95)) {
            pressureP95 = dbl(stats, "heap_pressure_pct_avg", Double.NaN);
        }

        boolean upgradeBlocked = GcAdvisor.VERDICT_SINGLE_THREAD.equals(gc)
                || (GcAdvisor.VERDICT_GC_BOUND.equals(gc)
                && (Double.isNaN(pressureP95) || pressureP95 < UNDER_PRESSURE_P95_MIN));
        out.addProperty("ram_upgrade_blocked", upgradeBlocked);

        if (!Double.isNaN(xmxGb) && xmxGb > 0 && !Double.isNaN(peak)) {
            out.addProperty("headroom_gb", round2(Math.max(0, xmxGb - peak)));
        }

        if (upgradeBlocked) {
            out.addProperty("verdict", VERDICT_RIGHT);
            if (GcAdvisor.VERDICT_SINGLE_THREAD.equals(gc)) {
                out.addProperty("advice",
                        "Tick time is high while the heap looks fine — more RAM will not fix this. "
                                + "Check Live MSPT / Spark before changing the panel plan.");
            } else {
                out.addProperty("advice",
                        "GC pause share is high while heap pressure is not full — fix JVM flags "
                                + "(Insights → Configs) before buying more RAM.");
            }
            return out;
        }

        boolean under = GcAdvisor.VERDICT_HEAP_BOUND.equals(gc)
                || (!Double.isNaN(pressureP95) && pressureP95 >= UNDER_PRESSURE_P95_MIN);
        if (under) {
            if (!Double.isNaN(xmxGb) && xmxGb > 0 && !Double.isNaN(peak)) {
                long min = Math.max(Math.round(Math.ceil(peak * 1.25)), Math.round(Math.ceil(xmxGb)));
                long max = Math.max(min + 1, Math.round(Math.ceil(peak * 1.5)));
                double safeMax = safeXmxMaxGb(hostMemGb);
                if (!Double.isNaN(safeMax)) {
                    long safe = Math.round(safeMax);
                    if (safe < Math.round(xmxGb)) {
                        // Would need more heap than the host can spare — treat as envelope story.
                        applyEnvelopeTight(out, hostMemGb, xmxGb, ramSource, ENVELOPE_LOW);
                        return out;
                    }
                    min = Math.min(min, safe);
                    max = Math.min(max, safe);
                    if (max < min) {
                        max = min;
                    }
                }
                out.addProperty("verdict", VERDICT_UNDER);
                out.addProperty("suggested_xmx_gb_min", min);
                out.addProperty("suggested_xmx_gb_max", max);
                out.addProperty("advice", String.format(
                        "Heap pressure stayed high over this window (peak ~%.1f GB of %.0f GB). "
                                + "Raising -Xmx toward %d–%d GB may help — leave OS/container headroom.",
                        peak, xmxGb, min, max));
            } else {
                out.addProperty("verdict", VERDICT_UNDER);
                out.addProperty("advice",
                        "Heap pressure stayed high over this window — more -Xmx (with OS headroom) may help.");
            }
            return out;
        }

        boolean clearlyOver = !Double.isNaN(xmxGb) && xmxGb > 0
                && !Double.isNaN(peak)
                && peak <= xmxGb * OVER_PEAK_FRAC
                && !Double.isNaN(pressureP95)
                && pressureP95 <= OVER_PRESSURE_P95_MAX
                && (GcAdvisor.VERDICT_HEALTHY.equals(gc) || GcAdvisor.VERDICT_GC_BOUND.equals(gc));

        if (clearlyOver && GcAdvisor.VERDICT_HEALTHY.equals(gc)) {
            long soft = Math.max(Math.round(MIN_XMX_FLOOR_GB), Math.round(Math.ceil(peak * 1.4)));
            if (soft >= Math.round(xmxGb)) {
                out.addProperty("verdict", VERDICT_RIGHT);
                out.addProperty("advice", String.format(
                        "Heap peaked around %.1f GB of %.0f GB — sizing looks fine for this window.",
                        peak, xmxGb));
                return out;
            }
            long softMax = Math.min(Math.round(xmxGb) - 1, soft + 1);
            if (softMax < soft) {
                softMax = soft;
            }
            out.addProperty("verdict", VERDICT_OVER);
            out.addProperty("suggested_xmx_gb_min", soft);
            out.addProperty("suggested_xmx_gb_max", softMax);
            out.addProperty("advice", String.format(
                    "Heap stayed near %.1f GB of %.0f GB over this week — you could likely drop toward ~%d GB. "
                            + "Confirm after a busy week before changing the panel plan.",
                    peak, xmxGb, soft));
            return out;
        }

        out.addProperty("verdict", VERDICT_RIGHT);
        if (!Double.isNaN(xmxGb) && xmxGb > 0 && !Double.isNaN(peak)) {
            out.addProperty("advice", String.format(
                    "Heap peaked around %.1f GB of %.0f GB — sizing looks about right for this window.",
                    peak, xmxGb));
        } else {
            out.addProperty("advice", "Heap sizing looks about right for this window.");
        }
        return out;
    }

    private static void applyEnvelopeTight(
            JsonObject out,
            double hostMemGb,
            double xmxGb,
            String ramSource,
            String envelope
    ) {
        out.addProperty("verdict", VERDICT_ENVELOPE_TIGHT);
        out.addProperty("ram_upgrade_blocked", true);
        out.addProperty("envelope", envelope);
        out.addProperty("host_mem_gb", round2(hostMemGb));
        out.addProperty("outside_headroom_gb", round2(hostMemGb - xmxGb));
        out.addProperty("ram_source", ramSource != null && !ramSource.isBlank() ? ramSource : "unknown");

        long safe = Math.round(safeXmxMaxGb(hostMemGb));
        long suggestMin = Math.max(Math.round(ENVELOPE_SAFE_XMX_FLOOR_GB), safe - 1);
        long suggestMax = safe;
        if (suggestMin > suggestMax) {
            suggestMin = suggestMax;
        }
        out.addProperty("suggested_xmx_gb_min", suggestMin);
        out.addProperty("suggested_xmx_gb_max", suggestMax);

        String sourceLabel = ramSourceLabel(ramSource);
        out.addProperty("advice", String.format(
                "Host memory ~%.0f GB (%s). Java heap (-Xmx) %.0f GB leaves little room outside Java — "
                        + "risk of an external OOM kill. Try -Xmx%dG–%dG on this host, or a larger plan.",
                hostMemGb, sourceLabel, xmxGb, suggestMin, suggestMax));
    }

    private static String ramSourceLabel(String ramSource) {
        if (ramSource == null || ramSource.isBlank()) {
            return "host";
        }
        if (ramSource.startsWith("cgroup")) {
            return "cgroup";
        }
        if ("proc".equals(ramSource)) {
            return "host";
        }
        return ramSource;
    }

    private static void copyNum(JsonObject out, JsonObject stats, String key) {
        if (stats == null || !stats.has(key) || stats.get(key).isJsonNull()) {
            return;
        }
        out.add(key, stats.get(key));
    }

    private static double dbl(JsonObject o, String key, double def) {
        if (o == null || !o.has(key) || o.get(key).isJsonNull()) {
            return def;
        }
        try {
            return o.get(key).getAsDouble();
        } catch (Exception e) {
            return def;
        }
    }

    private static boolean bool(JsonObject o, String key, boolean def) {
        if (o == null || !o.has(key) || o.get(key).isJsonNull()) {
            return def;
        }
        try {
            return o.get(key).getAsBoolean();
        } catch (Exception e) {
            return def;
        }
    }

    private static double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }
}
