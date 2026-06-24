package dev.mcstatus.watchtower.core.analyze;

import com.google.gson.JsonObject;

/**
 * Detects significant disk usage jumps vs the last full report baseline.
 */
public final class DiskJumpEvaluator {

    private DiskJumpEvaluator() {
    }

    public static JsonObject evaluate(
            JsonObject currentSystem,
            JsonObject baseline,
            double jumpPctThreshold,
            double jumpGbThreshold
    ) {
        JsonObject out = new JsonObject();
        out.addProperty("active", false);
        if (baseline == null || baseline.isEmpty() || currentSystem == null) {
            return out;
        }
        Double curPct = jsonDouble(currentSystem, "disk_use_pct");
        Double curFree = jsonDouble(currentSystem, "disk_free_gb");
        Double basePct = jsonDouble(baseline, "disk_use_pct");
        Double baseFree = jsonDouble(baseline, "disk_free_gb");
        if (curPct == null || basePct == null) {
            return out;
        }
        double pctDelta = curPct - basePct;
        double freeDelta = (curFree != null && baseFree != null) ? baseFree - curFree : 0;
        boolean pctJump = pctDelta >= jumpPctThreshold;
        boolean freeJump = jumpGbThreshold > 0 && freeDelta >= jumpGbThreshold;
        if (!pctJump && !freeJump) {
            out.addProperty("disk_use_pct", curPct);
            out.addProperty("baseline_disk_use_pct", basePct);
            out.addProperty("delta_pct", Math.round(pctDelta * 10.0) / 10.0);
            return out;
        }
        out.addProperty("active", true);
        out.addProperty("disk_use_pct", curPct);
        out.addProperty("baseline_disk_use_pct", basePct);
        out.addProperty("delta_pct", Math.round(pctDelta * 10.0) / 10.0);
        if (curFree != null) {
            out.addProperty("disk_free_gb", curFree);
        }
        if (baseFree != null) {
            out.addProperty("baseline_disk_free_gb", baseFree);
        }
        if (freeDelta > 0) {
            out.addProperty("delta_free_gb", Math.round(freeDelta * 10.0) / 10.0);
        }
        StringBuilder msg = new StringBuilder("Disk use rose ");
        msg.append(String.format("%.1f", pctDelta)).append("% since last report");
        if (freeDelta > 0) {
            msg.append(" (").append(String.format("%.1f", freeDelta)).append(" GB less free)");
        }
        out.addProperty("message", msg.toString());
        return out;
    }

    public static JsonObject baselineFromSystem(JsonObject system) {
        if (system == null) {
            return new JsonObject();
        }
        JsonObject baseline = new JsonObject();
        if (system.has("disk_use_pct")) {
            baseline.add("disk_use_pct", system.get("disk_use_pct"));
        }
        if (system.has("disk_free_gb")) {
            baseline.add("disk_free_gb", system.get("disk_free_gb"));
        }
        if (system.has("disk_total_gb")) {
            baseline.add("disk_total_gb", system.get("disk_total_gb"));
        }
        return baseline;
    }

    private static Double jsonDouble(JsonObject o, String key) {
        if (o == null || !o.has(key) || o.get(key).isJsonNull()) {
            return null;
        }
        return o.get(key).getAsDouble();
    }
}
