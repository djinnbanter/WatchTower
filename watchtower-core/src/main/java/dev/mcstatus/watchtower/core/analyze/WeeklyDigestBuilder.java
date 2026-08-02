package dev.mcstatus.watchtower.core.analyze;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.ops.IssuesLiveSchema;
import dev.mcstatus.watchtower.core.ops.OpsCacheSchema;
import dev.mcstatus.watchtower.core.util.TimeParse;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Rolls up one week of already-computed ops-cache / L1 data into a weekly digest entry.
 * Pure builder — no I/O; injectable clock for tests.
 */
public final class WeeklyDigestBuilder {

    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_OFFSET_DATE_TIME;
    private static final DateTimeFormatter DATE_ID = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    private static final double TPS_LOW_THRESHOLD = 19.0;
    private static final int MIN_SAMPLE_MINUTES = 60;
    private static final double MSPT_STEADY_PCT = 5.0;

    private WeeklyDigestBuilder() {
    }

    public record Settings(boolean enabled, int windowDays, int historyMax) {
        public static Settings defaults() {
            return new Settings(true, 7, 8);
        }

        public Settings sanitized() {
            return new Settings(
                    enabled,
                    Math.max(1, windowDays),
                    Math.max(1, historyMax)
            );
        }
    }

    /**
     * Build one digest entry, or null when disabled.
     *
     * @param opsCache      current ops-cache object
     * @param scorecard     full scorecard from {@link ScorecardBuilder#build}
     * @param rollupRows    last {@code windowDays * 2} of L1 minute rows
     * @param priorHistory  previous digest history (newest-first); may be null/empty
     * @param trigger       {@code "auto"} or {@code "manual"}
     * @param settings      cadence / history settings
     * @param now           injectable clock
     */
    public static JsonObject build(
            JsonObject opsCache,
            JsonObject scorecard,
            List<JsonObject> rollupRows,
            JsonArray priorHistory,
            String trigger,
            Settings settings,
            Instant now
    ) {
        Settings cfg = settings != null ? settings.sanitized() : Settings.defaults();
        if (!cfg.enabled()) {
            return null;
        }
        Instant clock = now != null ? now : Instant.now();
        long nowEpoch = clock.getEpochSecond();
        long windowSec = (long) cfg.windowDays() * 86400L;
        long currentStart = nowEpoch - windowSec;
        long priorStart = nowEpoch - 2L * windowSec;

        List<JsonObject> current = new ArrayList<>();
        List<JsonObject> prior = new ArrayList<>();
        if (rollupRows != null) {
            for (JsonObject row : rollupRows) {
                long epoch = rowEpoch(row);
                if (epoch <= 0) {
                    continue;
                }
                if (epoch >= currentStart) {
                    current.add(row);
                } else if (epoch >= priorStart) {
                    prior.add(row);
                }
            }
        }

        JsonObject entry = new JsonObject();
        String periodEndIso = ZonedDateTime.ofInstant(clock, ZoneOffset.UTC).format(ISO);
        String periodStartIso = ZonedDateTime.ofInstant(Instant.ofEpochSecond(currentStart), ZoneOffset.UTC).format(ISO);
        String dateId = ZonedDateTime.ofInstant(clock, ZoneOffset.UTC).format(DATE_ID);
        entry.addProperty("id", "digest-" + dateId);
        entry.addProperty("generated_at", periodEndIso);
        entry.addProperty("trigger", trigger != null && !trigger.isBlank() ? trigger : "auto");
        entry.addProperty("window_days", cfg.windowDays());
        entry.addProperty("period_start", periodStartIso);
        entry.addProperty("period_end", periodEndIso);

        String grade = scorecard != null && scorecard.has("grade") ? scorecard.get("grade").getAsString() : "unknown";
        String gradeWord = scorecard != null && scorecard.has("grade_word")
                ? scorecard.get("grade_word").getAsString()
                : capitalize(grade);
        entry.addProperty("grade", grade);
        entry.addProperty("grade_word", gradeWord);

        String gradePrev = null;
        if (priorHistory != null && priorHistory.size() > 0 && priorHistory.get(0).isJsonObject()) {
            JsonObject prev = priorHistory.get(0).getAsJsonObject();
            if (prev.has("grade") && !prev.get("grade").isJsonNull()) {
                gradePrev = prev.get("grade").getAsString();
            }
        }
        if (gradePrev != null) {
            entry.addProperty("grade_prev", gradePrev);
        }
        entry.addProperty("grade_trend", gradeTrend(grade, gradePrev));

        JsonObject crashes = buildCrashes(opsCache, currentStart);
        entry.add("crashes", crashes);

        JsonObject disk = buildDisk(opsCache, cfg.windowDays());
        entry.add("disk", disk);

        JsonObject performance = buildPerformance(current, prior);
        entry.add("performance", performance);

        JsonObject mods = buildMods(opsCache);
        entry.add("mods", mods);

        JsonObject topAction = buildTopAction(opsCache);
        if (topAction != null) {
            entry.add("top_action", topAction);
        } else {
            entry.add("top_action", com.google.gson.JsonNull.INSTANCE);
        }

        entry.addProperty("summary", buildSummary(
                gradeWord, crashes, disk, performance, topAction));
        return entry;
    }

    private static JsonObject buildCrashes(JsonObject opsCache, long currentStart) {
        JsonObject out = new JsonObject();
        int count = 0;
        Map<String, Integer> modCounts = new HashMap<>();
        if (opsCache != null && opsCache.has(OpsCacheSchema.CRASHES)
                && opsCache.get(OpsCacheSchema.CRASHES).isJsonObject()) {
            JsonObject block = opsCache.getAsJsonObject(OpsCacheSchema.CRASHES);
            if (block.has(OpsCacheSchema.CRASHES_ENTRIES)
                    && block.get(OpsCacheSchema.CRASHES_ENTRIES).isJsonArray()) {
                for (JsonElement el : block.getAsJsonArray(OpsCacheSchema.CRASHES_ENTRIES)) {
                    if (!el.isJsonObject()) {
                        continue;
                    }
                    JsonObject row = el.getAsJsonObject();
                    long epoch = crashEpoch(row);
                    if (epoch > 0 && epoch < currentStart) {
                        continue;
                    }
                    count++;
                    if (row.has("primary_mod_id") && !row.get("primary_mod_id").isJsonNull()) {
                        String mod = row.get("primary_mod_id").getAsString();
                        if (mod != null && !mod.isBlank()) {
                            modCounts.merge(mod, 1, Integer::sum);
                        }
                    }
                }
            }
        }
        out.addProperty("count", count);
        String topMod = null;
        int topCount = 0;
        for (Map.Entry<String, Integer> e : modCounts.entrySet()) {
            if (e.getValue() > topCount
                    || (e.getValue() == topCount && (topMod == null || e.getKey().compareTo(topMod) < 0))) {
                topMod = e.getKey();
                topCount = e.getValue();
            }
        }
        if (topMod != null) {
            out.addProperty("top_mod_id", topMod);
            out.addProperty("top_mod_count", topCount);
        }
        return out;
    }

    private static JsonObject buildDisk(JsonObject opsCache, int windowDays) {
        JsonObject out = new JsonObject();
        if (opsCache == null || !opsCache.has(OpsCacheSchema.DISK_PROJECTION)
                || !opsCache.get(OpsCacheSchema.DISK_PROJECTION).isJsonObject()) {
            return out;
        }
        JsonObject proj = opsCache.getAsJsonObject(OpsCacheSchema.DISK_PROJECTION);
        if (proj.has("confidence") && !"ok".equalsIgnoreCase(proj.get("confidence").getAsString())) {
            return out;
        }
        if (proj.has("disk_use_pct") && !proj.get("disk_use_pct").isJsonNull()) {
            out.addProperty("use_pct", proj.get("disk_use_pct").getAsDouble());
        }
        if (proj.has("days_until_full") && !proj.get("days_until_full").isJsonNull()) {
            out.addProperty("days_until_full", proj.get("days_until_full").getAsDouble());
        }
        if (proj.has("fill_rate_gb_per_day") && !proj.get("fill_rate_gb_per_day").isJsonNull()) {
            double rate = proj.get("fill_rate_gb_per_day").getAsDouble();
            double growth = Math.round(rate * windowDays * 10.0) / 10.0;
            out.addProperty("growth_gb_7d_est", growth);
        }
        return out;
    }

    private static JsonObject buildPerformance(List<JsonObject> current, List<JsonObject> prior) {
        JsonObject out = new JsonObject();
        PerfStats cur = summarize(current);
        PerfStats pri = summarize(prior);
        out.addProperty("mspt_avg", round1(cur.msptAvg));
        out.addProperty("mspt_avg_prior", round1(pri.msptAvg));
        out.addProperty("low_tps_minutes", cur.lowTpsMinutes);
        out.addProperty("low_tps_minutes_prior", pri.lowTpsMinutes);
        out.addProperty("sample_minutes", cur.sampleMinutes);
        out.addProperty("sample_minutes_prior", pri.sampleMinutes);

        String trend;
        double deltaPct = 0;
        if (cur.sampleMinutes < MIN_SAMPLE_MINUTES || pri.sampleMinutes < MIN_SAMPLE_MINUTES) {
            trend = "insufficient";
        } else if (pri.msptAvg <= 0) {
            trend = "steady";
        } else {
            deltaPct = (cur.msptAvg - pri.msptAvg) / pri.msptAvg * 100.0;
            if (Math.abs(deltaPct) < MSPT_STEADY_PCT) {
                trend = "steady";
            } else if (deltaPct > 0) {
                trend = "worse";
            } else {
                trend = "better";
            }
        }
        out.addProperty("mspt_delta_pct", round1(deltaPct));
        out.addProperty("trend", trend);
        return out;
    }

    private static PerfStats summarize(List<JsonObject> rows) {
        PerfStats s = new PerfStats();
        if (rows == null || rows.isEmpty()) {
            return s;
        }
        double msptSum = 0;
        int msptN = 0;
        for (JsonObject row : rows) {
            s.sampleMinutes++;
            Double mspt = rowDouble(row, "mspt_avg");
            if (mspt == null) {
                mspt = rowDouble(row, "mspt_p50");
            }
            if (mspt != null) {
                msptSum += mspt;
                msptN++;
            }
            Double tps = rowDouble(row, "tps_avg");
            if (tps != null && tps < TPS_LOW_THRESHOLD) {
                s.lowTpsMinutes++;
            } else if (row.has("low_tps_flag") && row.get("low_tps_flag").getAsBoolean()) {
                s.lowTpsMinutes++;
            }
        }
        s.msptAvg = msptN > 0 ? msptSum / msptN : 0;
        return s;
    }

    private static JsonObject buildMods(JsonObject opsCache) {
        JsonObject out = new JsonObject();
        int added = 0;
        int removed = 0;
        int changed = 0;
        if (opsCache != null && opsCache.has(OpsCacheSchema.MODS_INVENTORY)
                && opsCache.get(OpsCacheSchema.MODS_INVENTORY).isJsonObject()) {
            JsonObject inv = opsCache.getAsJsonObject(OpsCacheSchema.MODS_INVENTORY);
            if (inv.has("diff") && inv.get("diff").isJsonObject()) {
                JsonObject diff = inv.getAsJsonObject("diff");
                added = intOrZero(diff, "added_count");
                removed = intOrZero(diff, "removed_count");
                changed = intOrZero(diff, "changed_count");
            }
        }
        out.addProperty("added", added);
        out.addProperty("removed", removed);
        out.addProperty("changed", changed);
        return out;
    }

    private static JsonObject buildTopAction(JsonObject opsCache) {
        if (opsCache == null || !opsCache.has(OpsCacheSchema.ISSUES_LIVE)
                || !opsCache.get(OpsCacheSchema.ISSUES_LIVE).isJsonArray()) {
            return null;
        }
        JsonObject best = null;
        int bestRank = Integer.MAX_VALUE;
        long bestSeen = Long.MIN_VALUE;
        for (JsonElement el : opsCache.getAsJsonArray(OpsCacheSchema.ISSUES_LIVE)) {
            if (!el.isJsonObject()) {
                continue;
            }
            JsonObject row = el.getAsJsonObject();
            String status = row.has(IssuesLiveSchema.STATUS) ? row.get(IssuesLiveSchema.STATUS).getAsString() : "";
            if (!IssuesLiveSchema.STATUS_OPEN.equalsIgnoreCase(status)) {
                continue;
            }
            String severity = row.has(IssuesLiveSchema.SEVERITY)
                    ? row.get(IssuesLiveSchema.SEVERITY).getAsString() : "info";
            int rank = severityRank(severity);
            long seen = 0;
            if (row.has(IssuesLiveSchema.LAST_SEEN) && !row.get(IssuesLiveSchema.LAST_SEEN).isJsonNull()) {
                Instant t = TimeParse.parseTime(row.get(IssuesLiveSchema.LAST_SEEN).getAsString());
                if (t != null) {
                    seen = t.getEpochSecond();
                }
            }
            if (rank < bestRank || (rank == bestRank && seen > bestSeen)) {
                best = row;
                bestRank = rank;
                bestSeen = seen;
            }
        }
        if (best == null) {
            return null;
        }
        JsonObject action = new JsonObject();
        String code = best.has(IssuesLiveSchema.ID) ? best.get(IssuesLiveSchema.ID).getAsString()
                : (best.has(IssuesLiveSchema.KEY) ? best.get(IssuesLiveSchema.KEY).getAsString() : "issue");
        action.addProperty("code", code);
        action.addProperty("severity",
                best.has(IssuesLiveSchema.SEVERITY) ? best.get(IssuesLiveSchema.SEVERITY).getAsString() : "info");
        action.addProperty("message",
                best.has(IssuesLiveSchema.MESSAGE) ? best.get(IssuesLiveSchema.MESSAGE).getAsString() : code);
        action.addProperty("tab_link", "issues");
        return action;
    }

    private static String buildSummary(
            String gradeWord,
            JsonObject crashes,
            JsonObject disk,
            JsonObject performance,
            JsonObject topAction
    ) {
        StringBuilder sb = new StringBuilder("This week: grade ").append(gradeWord);

        int crashCount = intOrZero(crashes, "count");
        if (crashCount > 0) {
            sb.append(", ").append(crashCount).append(crashCount == 1 ? " crash" : " crashes");
            if (crashes.has("top_mod_id")) {
                String mod = crashes.get("top_mod_id").getAsString();
                int topCount = intOrZero(crashes, "top_mod_count");
                if (topCount == crashCount && crashCount == 1) {
                    sb.append(" (").append(mod).append(")");
                } else if (topCount == crashCount && crashCount == 2) {
                    sb.append(" (both ").append(mod).append(")");
                } else if (topCount == crashCount) {
                    sb.append(" (all ").append(mod).append(")");
                } else {
                    sb.append(" (top: ").append(mod).append(")");
                }
            }
        } else {
            sb.append(", 0 crashes");
        }

        if (disk.has("growth_gb_7d_est")) {
            double g = disk.get("growth_gb_7d_est").getAsDouble();
            String sign = g >= 0 ? "+" : "";
            sb.append(", disk ≈").append(sign).append(String.format(Locale.US, "%.1f", g)).append(" GB");
        }

        String trend = performance.has("trend") ? performance.get("trend").getAsString() : "insufficient";
        if (!"insufficient".equals(trend)) {
            if ("steady".equals(trend)) {
                sb.append(", MSPT steady");
            } else if ("worse".equals(trend)) {
                double pct = performance.has("mspt_delta_pct")
                        ? performance.get("mspt_delta_pct").getAsDouble() : 0;
                sb.append(", MSPT up ").append(String.format(Locale.US, "%.0f", Math.abs(pct)))
                        .append("% vs last week");
            } else if ("better".equals(trend)) {
                double pct = performance.has("mspt_delta_pct")
                        ? performance.get("mspt_delta_pct").getAsDouble() : 0;
                sb.append(", MSPT down ").append(String.format(Locale.US, "%.0f", Math.abs(pct)))
                        .append("% vs last week");
            }
        }

        sb.append('.');
        if (topAction != null && topAction.has("message")) {
            sb.append(" Do this next: ").append(topAction.get("message").getAsString());
            if (!sb.toString().endsWith(".")) {
                sb.append('.');
            }
        }
        return sb.toString();
    }

    private static String gradeTrend(String grade, String gradePrev) {
        if (gradePrev == null || gradePrev.isBlank() || "unknown".equalsIgnoreCase(gradePrev)) {
            return "unknown";
        }
        int cur = gradeRank(grade);
        int prev = gradeRank(gradePrev);
        if (cur < 0 || prev < 0) {
            return "unknown";
        }
        if (cur < prev) {
            return "improved";
        }
        if (cur > prev) {
            return "worse";
        }
        return "steady";
    }

    private static int gradeRank(String grade) {
        if (grade == null) {
            return -1;
        }
        return switch (grade.toLowerCase(Locale.ROOT)) {
            case "healthy" -> 0;
            case "degraded" -> 1;
            case "critical" -> 2;
            default -> -1;
        };
    }

    private static int severityRank(String severity) {
        if (severity == null) {
            return 2;
        }
        return switch (severity.toLowerCase(Locale.ROOT)) {
            case "critical", "error" -> 0;
            case "warning", "warn" -> 1;
            default -> 2;
        };
    }

    private static long rowEpoch(JsonObject row) {
        if (row == null || !row.has("ts") || row.get("ts").isJsonNull()) {
            return 0;
        }
        Instant t = TimeParse.parseTime(row.get("ts").getAsString());
        return t != null ? t.getEpochSecond() : 0;
    }

    private static long crashEpoch(JsonObject row) {
        if (row.has(OpsCacheSchema.ENTRY_MTIME) && !row.get(OpsCacheSchema.ENTRY_MTIME).isJsonNull()) {
            try {
                return row.get(OpsCacheSchema.ENTRY_MTIME).getAsLong();
            } catch (Exception ignored) {
                // fall through
            }
        }
        if (row.has("time") && !row.get("time").isJsonNull()) {
            Instant t = TimeParse.parseTime(row.get("time").getAsString());
            if (t != null) {
                return t.getEpochSecond();
            }
        }
        return 0;
    }

    private static Double rowDouble(JsonObject row, String key) {
        if (row == null || !row.has(key) || row.get(key).isJsonNull()) {
            return null;
        }
        try {
            return row.get(key).getAsDouble();
        } catch (Exception e) {
            return null;
        }
    }

    private static int intOrZero(JsonObject o, String key) {
        if (o == null || !o.has(key) || o.get(key).isJsonNull()) {
            return 0;
        }
        try {
            return o.get(key).getAsInt();
        } catch (Exception e) {
            return 0;
        }
    }

    private static double round1(double v) {
        return Math.round(v * 10.0) / 10.0;
    }

    private static String capitalize(String s) {
        if (s == null || s.isBlank()) {
            return "Unknown";
        }
        return Character.toUpperCase(s.charAt(0)) + s.substring(1).toLowerCase(Locale.ROOT);
    }

    private static final class PerfStats {
        double msptAvg;
        int lowTpsMinutes;
        int sampleMinutes;
    }
}
