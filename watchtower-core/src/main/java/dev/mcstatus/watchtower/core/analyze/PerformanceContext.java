package dev.mcstatus.watchtower.core.analyze;

import com.google.gson.JsonObject;

import java.util.List;

/**
 * Optional ops/report context for the Performance dashboard builder.
 */
public final class PerformanceContext {

    private final JsonObject opsCache;
    private final List<JsonObject> incidents;
    private final JsonObject scorecardPerf;
    private final long windowStartEpochSec;
    private final Double xmxGb;
    private final String xmxSource;
    private final JsonObject perfBaseline;
    private final double baselineThresholdPct;
    private final Double diskFreeGb;
    private final Double diskUsePct;
    private final JsonObject storageOptional;
    private final int diskFillWarnDays;
    private final int diskFillLookbackHours;
    private final int diskFillMinSpanHours;
    private final double diskFillOutlierGb;
    private final double diskIoLatencyWarnMs;
    private final Double hostMemGb;
    private final String ramSource;

    public PerformanceContext(
            JsonObject opsCache,
            List<JsonObject> incidents,
            JsonObject scorecardPerf,
            long windowStartEpochSec
    ) {
        this(opsCache, incidents, scorecardPerf, windowStartEpochSec, null, null, null, 10.0,
                null, null, null, 14, 24, 6, 5.0, 50.0, null, null);
    }

    public PerformanceContext(
            JsonObject opsCache,
            List<JsonObject> incidents,
            JsonObject scorecardPerf,
            long windowStartEpochSec,
            Double xmxGb,
            String xmxSource
    ) {
        this(opsCache, incidents, scorecardPerf, windowStartEpochSec, xmxGb, xmxSource, null, 10.0,
                null, null, null, 14, 24, 6, 5.0, 50.0, null, null);
    }

    public PerformanceContext(
            JsonObject opsCache,
            List<JsonObject> incidents,
            JsonObject scorecardPerf,
            long windowStartEpochSec,
            Double xmxGb,
            String xmxSource,
            JsonObject perfBaseline,
            double baselineThresholdPct
    ) {
        this(opsCache, incidents, scorecardPerf, windowStartEpochSec, xmxGb, xmxSource,
                perfBaseline, baselineThresholdPct, null, null, null, 14, 24, 6, 5.0, 50.0, null, null);
    }

    public PerformanceContext(
            JsonObject opsCache,
            List<JsonObject> incidents,
            JsonObject scorecardPerf,
            long windowStartEpochSec,
            Double xmxGb,
            String xmxSource,
            JsonObject perfBaseline,
            double baselineThresholdPct,
            Double diskFreeGb,
            Double diskUsePct,
            JsonObject storageOptional,
            int diskFillWarnDays,
            int diskFillLookbackHours,
            int diskFillMinSpanHours,
            double diskFillOutlierGb,
            double diskIoLatencyWarnMs
    ) {
        this(opsCache, incidents, scorecardPerf, windowStartEpochSec, xmxGb, xmxSource,
                perfBaseline, baselineThresholdPct, diskFreeGb, diskUsePct, storageOptional,
                diskFillWarnDays, diskFillLookbackHours, diskFillMinSpanHours, diskFillOutlierGb,
                diskIoLatencyWarnMs, null, null);
    }

    public PerformanceContext(
            JsonObject opsCache,
            List<JsonObject> incidents,
            JsonObject scorecardPerf,
            long windowStartEpochSec,
            Double xmxGb,
            String xmxSource,
            JsonObject perfBaseline,
            double baselineThresholdPct,
            Double diskFreeGb,
            Double diskUsePct,
            JsonObject storageOptional,
            int diskFillWarnDays,
            int diskFillLookbackHours,
            int diskFillMinSpanHours,
            double diskFillOutlierGb,
            double diskIoLatencyWarnMs,
            Double hostMemGb,
            String ramSource
    ) {
        this.opsCache = opsCache;
        this.incidents = incidents != null ? incidents : List.of();
        this.scorecardPerf = scorecardPerf;
        this.windowStartEpochSec = windowStartEpochSec;
        this.xmxGb = xmxGb;
        this.xmxSource = xmxSource;
        this.perfBaseline = perfBaseline;
        this.baselineThresholdPct = baselineThresholdPct > 0 ? baselineThresholdPct : 10.0;
        this.diskFreeGb = diskFreeGb;
        this.diskUsePct = diskUsePct;
        this.storageOptional = storageOptional;
        this.diskFillWarnDays = diskFillWarnDays > 0 ? diskFillWarnDays : 14;
        this.diskFillLookbackHours = diskFillLookbackHours > 0 ? diskFillLookbackHours : 24;
        this.diskFillMinSpanHours = diskFillMinSpanHours > 0 ? diskFillMinSpanHours : 6;
        this.diskFillOutlierGb = diskFillOutlierGb > 0 ? diskFillOutlierGb : 5.0;
        this.diskIoLatencyWarnMs = diskIoLatencyWarnMs > 0 ? diskIoLatencyWarnMs : 50.0;
        this.hostMemGb = hostMemGb;
        this.ramSource = ramSource;
    }

    public JsonObject opsCache() {
        return opsCache;
    }

    public List<JsonObject> incidents() {
        return incidents;
    }

    public JsonObject scorecardPerf() {
        return scorecardPerf;
    }

    public long windowStartEpochSec() {
        return windowStartEpochSec;
    }

    public Double xmxGb() {
        return xmxGb;
    }

    public String xmxSource() {
        return xmxSource;
    }

    public JsonObject perfBaseline() {
        return perfBaseline;
    }

    public double baselineThresholdPct() {
        return baselineThresholdPct;
    }

    public Double diskFreeGb() {
        return diskFreeGb;
    }

    public Double diskUsePct() {
        return diskUsePct;
    }

    public JsonObject storageOptional() {
        return storageOptional;
    }

    public int diskFillWarnDays() {
        return diskFillWarnDays;
    }

    public int diskFillLookbackHours() {
        return diskFillLookbackHours;
    }

    public int diskFillMinSpanHours() {
        return diskFillMinSpanHours;
    }

    public double diskFillOutlierGb() {
        return diskFillOutlierGb;
    }

    public double diskIoLatencyWarnMs() {
        return diskIoLatencyWarnMs;
    }

    public Double hostMemGb() {
        return hostMemGb;
    }

    public String ramSource() {
        return ramSource;
    }
}
