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

    public PerformanceContext(
            JsonObject opsCache,
            List<JsonObject> incidents,
            JsonObject scorecardPerf,
            long windowStartEpochSec
    ) {
        this.opsCache = opsCache;
        this.incidents = incidents != null ? incidents : List.of();
        this.scorecardPerf = scorecardPerf;
        this.windowStartEpochSec = windowStartEpochSec;
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
}
