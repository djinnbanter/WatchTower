package dev.mcstatus.watchtower.core.analyze;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.live.PerformanceRollupWriter;
import dev.mcstatus.watchtower.core.ops.OpsCacheSchema;

import java.nio.file.Path;
import java.time.Instant;

/**
 * Builds trust scorecard from L1 rollups, ops cache, and L3 facts.
 */
public final class ScorecardBuilder {

    private ScorecardBuilder() {
    }

    public static JsonObject build(
            JsonObject facts,
            JsonObject opsCache,
            Path rollupsPath,
            double tpsWarn,
            double msptWarn,
            int lowTpsMinutesThreshold24h
    ) {
        JsonObject out = new JsonObject();
        JsonObject perf24 = PerformanceRollupWriter.summarizeFromFile(rollupsPath, 24);
        JsonObject perf7d = PerformanceRollupWriter.summarizeFromFile(rollupsPath, 24 * 7);

        int lowTps24h = perf24.has("low_tps_minutes") ? perf24.get("low_tps_minutes").getAsInt() : 0;
        int lowTps7d = perf7d.has("low_tps_minutes") ? perf7d.get("low_tps_minutes").getAsInt() : 0;
        Double msptP95 = perf24.has("mspt_p95") ? perf24.get("mspt_p95").getAsDouble() : null;
        Double jitterMax = perf24.has("mspt_jitter_max_24h") ? perf24.get("mspt_jitter_max_24h").getAsDouble() : null;

        JsonObject performance = new JsonObject();
        performance.addProperty("low_tps_minutes_24h", lowTps24h);
        performance.addProperty("low_tps_minutes_7d", lowTps7d);
        if (msptP95 != null) {
            performance.addProperty("mspt_p95_24h", msptP95);
        }
        if (jitterMax != null) {
            performance.addProperty("mspt_jitter_max_24h", jitterMax);
        }
        performance.addProperty("subtitle", buildPerformanceSubtitle(lowTps24h, msptP95));
        out.add("performance", performance);

        JsonObject crashes = buildCrashesBlock(opsCache, facts);
        out.add("crashes", crashes);

        GradeOutcome outcome = computeGrade(facts, lowTps24h, lowTpsMinutesThreshold24h, msptWarn, msptP95, crashes);
        out.addProperty("grade", outcome.grade);
        out.addProperty("grade_word", gradeWord(outcome.grade));
        out.add("grade_reasons", outcome.reasons);

        return out;
    }

    private static String buildPerformanceSubtitle(int lowTps24h, Double msptP95) {
        StringBuilder sb = new StringBuilder();
        if (lowTps24h > 0) {
            sb.append(lowTps24h).append(" low-TPS minute").append(lowTps24h == 1 ? "" : "s").append(" (24h)");
        }
        if (msptP95 != null) {
            if (!sb.isEmpty()) {
                sb.append(" · ");
            }
            sb.append("MSPT p95 ").append(Math.round(msptP95)).append("ms");
        }
        return sb.isEmpty() ? "Performance stable (24h)" : sb.toString();
    }

    private static JsonObject buildCrashesBlock(JsonObject opsCache, JsonObject facts) {
        JsonObject crashes = new JsonObject();
        int unreviewed = 0;
        String latestLabel = "";
        String latestFile = "";
        String latestAt = "";

        if (opsCache != null && opsCache.has(OpsCacheSchema.CRASHES)) {
            JsonObject block = opsCache.getAsJsonObject(OpsCacheSchema.CRASHES);
            if (block.has(OpsCacheSchema.CRASHES_UNREVIEWED)) {
                unreviewed = block.get(OpsCacheSchema.CRASHES_UNREVIEWED).getAsInt();
            }
            if (block.has(OpsCacheSchema.CRASHES_LATEST)) {
                JsonObject latest = block.getAsJsonObject(OpsCacheSchema.CRASHES_LATEST);
                latestFile = str(latest, OpsCacheSchema.ENTRY_FILE);
                latestLabel = firstNonBlank(
                        str(latest, OpsCacheSchema.ENTRY_DISPLAY_LABEL),
                        str(latest, "display_label"),
                        str(latest, "plain_english"),
                        str(latest, "summary"),
                        str(latest, "exception"));
                if (latest.has(OpsCacheSchema.ENTRY_MTIME)) {
                    latestAt = CrashMtimeScannerFormat.isoFromEpoch(latest.get(OpsCacheSchema.ENTRY_MTIME).getAsLong());
                } else if (latest.has("time")) {
                    latestAt = latest.get("time").getAsString();
                }
            }
            // Newest unreviewed entry time (latest may be acknowledged)
            String unreviewedAt = newestUnreviewedCrashAt(block);
            if (unreviewedAt != null && !unreviewedAt.isBlank()) {
                crashes.addProperty("latest_unreviewed_at", unreviewedAt);
            }
        }

        if (unreviewed == 0 && facts != null && facts.has("optional")) {
            JsonObject optional = facts.getAsJsonObject("optional");
            if (optional.has("crash_summaries")) {
                JsonArray summaries = optional.getAsJsonArray("crash_summaries");
                for (var el : summaries) {
                    JsonObject c = el.getAsJsonObject();
                    if (!c.has("acknowledged") || !c.get("acknowledged").getAsBoolean()) {
                        unreviewed++;
                    }
                }
            }
        }

        if (latestLabel.isBlank() && facts != null && facts.has("optional")) {
            JsonObject optional = facts.getAsJsonObject("optional");
            if (optional.has("crash_summaries") && !optional.getAsJsonArray("crash_summaries").isEmpty()) {
                JsonObject c = optional.getAsJsonArray("crash_summaries").get(0).getAsJsonObject();
                latestFile = str(c, "file");
                latestLabel = firstNonBlank(
                        str(c, "display_label"),
                        str(c, "plain_english"),
                        str(c, "summary"),
                        str(c, "exception"));
                latestAt = str(c, "time");
            }
        }

        crashes.addProperty("unreviewed", unreviewed);
        if (!latestLabel.isBlank()) {
            crashes.addProperty("latest_label", latestLabel);
        }
        if (!latestFile.isBlank()) {
            crashes.addProperty("latest_file", latestFile);
        }
        if (!latestAt.isBlank()) {
            crashes.addProperty("latest_at", latestAt);
        }
        if (!crashes.has("latest_unreviewed_at") && facts != null && facts.has("optional")) {
            JsonObject optional = facts.getAsJsonObject("optional");
            if (optional.has("crash_summaries")) {
                for (var el : optional.getAsJsonArray("crash_summaries")) {
                    JsonObject c = el.getAsJsonObject();
                    if (c.has("acknowledged") && c.get("acknowledged").getAsBoolean()) {
                        continue;
                    }
                    String t = str(c, "time");
                    if (!t.isBlank()) {
                        crashes.addProperty("latest_unreviewed_at", t);
                        break;
                    }
                }
            }
        }
        return crashes;
    }

    /** Newest crash entry that is not explicitly acknowledged (mtime → ISO). */
    static String newestUnreviewedCrashAt(JsonObject crashesBlock) {
        if (crashesBlock == null) {
            return null;
        }
        if (crashesBlock.has("latest_unreviewed") && crashesBlock.get("latest_unreviewed").isJsonObject()) {
            JsonObject u = crashesBlock.getAsJsonObject("latest_unreviewed");
            if (u.has(OpsCacheSchema.ENTRY_MTIME)) {
                return CrashMtimeScannerFormat.isoFromEpoch(u.get(OpsCacheSchema.ENTRY_MTIME).getAsLong());
            }
            if (u.has("time")) {
                return u.get("time").getAsString();
            }
        }
        if (!crashesBlock.has(OpsCacheSchema.CRASHES_ENTRIES)
                || !crashesBlock.get(OpsCacheSchema.CRASHES_ENTRIES).isJsonArray()) {
            return null;
        }
        long best = 0;
        String bestIso = null;
        for (var el : crashesBlock.getAsJsonArray(OpsCacheSchema.CRASHES_ENTRIES)) {
            if (!el.isJsonObject()) {
                continue;
            }
            JsonObject row = el.getAsJsonObject();
            if (row.has("acknowledged") && row.get("acknowledged").getAsBoolean()) {
                continue;
            }
            // Skip rows with no ack flag only when we know some rows are stamped —
            // otherwise treat missing as unreviewed (scan path).
            long mt = row.has(OpsCacheSchema.ENTRY_MTIME) ? row.get(OpsCacheSchema.ENTRY_MTIME).getAsLong() : 0;
            String iso = null;
            if (mt > 0) {
                iso = CrashMtimeScannerFormat.isoFromEpoch(mt);
            } else if (row.has("time")) {
                iso = row.get("time").getAsString();
                Instant t = dev.mcstatus.watchtower.core.util.TimeParse.parseTime(iso);
                mt = t != null ? t.getEpochSecond() : 0;
            }
            if (mt > best && iso != null) {
                best = mt;
                bestIso = iso;
            }
        }
        return bestIso;
    }

    private static final class GradeOutcome {
        final String grade;
        final JsonArray reasons;

        GradeOutcome(String grade, JsonArray reasons) {
            this.grade = grade;
            this.reasons = reasons;
        }
    }

    private static GradeOutcome computeGrade(
            JsonObject facts,
            int lowTps24h,
            int lowTpsThreshold,
            double msptWarn,
            Double msptP95,
            JsonObject crashes
    ) {
        JsonArray reasons = new JsonArray();
        int unreviewed = crashes != null && crashes.has("unreviewed")
                ? crashes.get("unreviewed").getAsInt() : 0;
        if (unreviewed > 0) {
            JsonObject r = new JsonObject();
            r.addProperty("code", "unreviewed_crashes");
            r.addProperty("severity", "critical");
            r.addProperty("message", unreviewed + " unreviewed crash report"
                    + (unreviewed == 1 ? "" : "s"));
            r.addProperty("tab", "crashes");
            reasons.add(r);
            return new GradeOutcome("critical", reasons);
        }

        String overall = "ok";
        if (facts != null && facts.has("health") && facts.get("health").isJsonObject()) {
            JsonObject health = facts.getAsJsonObject("health");
            if (health.has("status") && !health.get("status").isJsonNull()) {
                overall = health.get("status").getAsString();
            }
        }
        if ("critical".equals(overall)) {
            JsonObject r = new JsonObject();
            r.addProperty("code", "facts_health_critical");
            r.addProperty("severity", "critical");
            r.addProperty("message", "Last health report status is critical");
            r.addProperty("tab", "overview");
            reasons.add(r);
            return new GradeOutcome("critical", reasons);
        }

        boolean lowTps = lowTps24h >= lowTpsThreshold;
        boolean msptHigh = msptP95 != null && msptP95 > msptWarn;
        boolean healthWarn = "warning".equals(overall);

        if (lowTps) {
            JsonObject r = new JsonObject();
            r.addProperty("code", "low_tps_24h");
            r.addProperty("severity", "warning");
            r.addProperty("message", lowTps24h + " low-TPS minute"
                    + (lowTps24h == 1 ? "" : "s") + " in the last 24h");
            r.addProperty("tab", "insights");
            reasons.add(r);
        }
        if (msptHigh) {
            JsonObject r = new JsonObject();
            r.addProperty("code", "mspt_p95_24h");
            r.addProperty("severity", "warning");
            r.addProperty("message", "MSPT p95 "
                    + Math.round(msptP95) + "ms exceeds warn threshold");
            r.addProperty("tab", "insights");
            reasons.add(r);
        }
        if (healthWarn) {
            JsonObject r = new JsonObject();
            r.addProperty("code", "facts_health_warning");
            r.addProperty("severity", "warning");
            r.addProperty("message", "Last health report status is warning");
            r.addProperty("tab", "overview");
            reasons.add(r);
        }

        if (lowTps || msptHigh || healthWarn) {
            return new GradeOutcome("degraded", reasons);
        }
        return new GradeOutcome("healthy", reasons);
    }

    private static String gradeWord(String grade) {
        return switch (grade) {
            case "critical" -> "Critical";
            case "degraded" -> "Degraded";
            default -> "Healthy";
        };
    }

    private static String str(JsonObject obj, String key) {
        if (obj == null || !obj.has(key) || obj.get(key).isJsonNull()) {
            return "";
        }
        return obj.get(key).getAsString();
    }

    private static String firstNonBlank(String... values) {
        for (String v : values) {
            if (v != null && !v.isBlank()) {
                return v;
            }
        }
        return "";
    }

    /** Avoid circular dependency with collect package in public API. */
    static final class CrashMtimeScannerFormat {
        private CrashMtimeScannerFormat() {
        }

        static String isoFromEpoch(long epochSec) {
            return dev.mcstatus.watchtower.core.collect.CrashMtimeScanner.formatMtimeIso(epochSec);
        }
    }
}
