package dev.mcstatus.watchtower.core.brief;

import dev.mcstatus.watchtower.core.collect.CrashDetails;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.util.TimeParse;

import java.util.ArrayList;
import java.util.List;

/**
 * TL;DR summary builder ported from mc-status-analyze.py build_tldr.
 */
public final class TldrBuilder {

    private TldrBuilder() {
    }

    public static String buildTldr(JsonObject facts) {
        JsonObject health = obj(facts, "health");
        JsonObject mc = obj(facts, "minecraft");
        JsonArray issues = array(facts, "issues");
        JsonObject optional = obj(facts, "optional");
        JsonObject dh = optional != null ? obj(optional, "dh_pregen") : null;
        boolean javaUp = bool(health, "java_running", false);
        Double gap = dbl(health, "log_gap_minutes");
        JsonObject thresholds = obj(facts, "thresholds");
        double logStaleMin = dbl(thresholds, "log_stale_minutes") != null
                ? dbl(thresholds, "log_stale_minutes") : 15.0;

        List<String> parts = new ArrayList<>();

        if (!javaUp) {
            parts.add("Server is down.");
        } else if (gap != null && gap > logStaleMin) {
            parts.add("Server may be hung — logs are stale while Java is still running.");
        } else {
            parts.add("Server is up and logging normally.");
        }

        List<JsonObject> active = activeIssues(issues);
        for (JsonObject i : active) {
            String iid = str(i, "id");
            if ("OOM".equals(iid)) {
                parts.add("Out-of-memory detected — review heap and loaders.");
                break;
            }
            if ("LOG_STALE".equals(iid)) {
                parts.add("Log output has stalled — check if the process is hung.");
                break;
            }
            if ("PANEL_DOWN".equals(iid)) {
                String msg = str(i, "message");
                parts.add(msg != null && !msg.isEmpty() ? msg : "Management panel is not running.");
                break;
            }
            if ("DH_PREGEN_STALL".equals(iid)) {
                parts.add("DH pregen appears paused or stalled.");
                break;
            }
            if ("CHUNKY_PREGEN_STALL".equals(iid)) {
                parts.add("Chunky pregen appears paused or stalled.");
                break;
            }
            if ("CHUNK_GEN_DURING_PREGEN".equals(iid)) {
                parts.add("Chunk generation is failing during pregen — pause and inspect logs.");
                break;
            }
        }

        JsonObject hostEnv = optional != null ? obj(optional, "host_environment") : null;
        if (hostEnv != null && "container".equals(str(hostEnv, "deployment")) && parts.size() <= 1) {
            parts.add("Hosted container — trust Java heap over host RAM metrics.");
        }

        List<JsonObject> histCrashes = new ArrayList<>();
        if (issues != null) {
            for (JsonElement el : issues) {
                JsonObject i = el.getAsJsonObject();
                if ("CRASH_REPORT".equals(str(i, "id")) && bool(i, "historical", false)) {
                    histCrashes.add(i);
                }
            }
        }
        String crashSummary = null;
        if (optional != null && optional.has("crash_summaries")) {
            JsonArray summaries = optional.getAsJsonArray("crash_summaries");
            if (!summaries.isEmpty()) {
                JsonObject first = summaries.get(0).getAsJsonObject();
                crashSummary = CrashDetails.formatLabel(
                        str(first, "exception"), str(first, "mod_file"), str(first, "summary"));
            }
        }
        if (crashSummary == null) {
            crashSummary = mc != null ? str(mc, "crash_summary") : null;
        }
        if (!histCrashes.isEmpty()) {
            int n = 0;
            JsonArray crashReports = mc != null ? array(mc, "new_crash_reports") : null;
            if (crashReports != null) {
                n = crashReports.size();
            }
            String msg = n + " crash report(s) from earlier in the 24h window remain on disk; "
                    + "the server has since restarted cleanly.";
            if (crashSummary != null) {
                String cs = crashSummary.length() > 120 ? crashSummary.substring(0, 120) : crashSummary;
                msg += " Latest: " + cs + ".";
            }
            parts.add(msg);
        } else if (hasIssueId(issues, "CRASH_REPORT")) {
            parts.add("New crash report(s) need review.");
        }

        if (hasIssueId(issues, "MANUAL_REBOOT")) {
            JsonArray events = array(facts, "events");
            if (events != null && !events.isEmpty()) {
                for (JsonElement el : events) {
                    JsonObject e = el.getAsJsonObject();
                    if ("reboot".equals(str(e, "type"))) {
                        parts.add("Machine rebooted during this window ("
                                + TimeParse.fmtTime(str(e, "time")) + ").");
                        break;
                    }
                }
            }
        }

        if (dh != null) {
            JsonObject last = obj(dh, "last");
            String radius = BriefFormatters.fmtDhRadius(last);
            String pctSuffix = BriefFormatters.fmtDhProgressSuffix(last);
            if (bool(dh, "pregen_paused", false)) {
                parts.add("DH pregen reached " + radius + pctSuffix
                        + " but has not resumed since the last restart.");
            } else if (bool(dh, "pregen_active", false)) {
                parts.add("DH pregen active at " + radius + pctSuffix + ".");
            }
        }

        JsonObject sparkProfile = optional != null ? obj(optional, "spark_profile") : null;
        if (sparkProfile != null && dev.mcstatus.watchtower.core.collect.SparkProfileFacts.isFresh(sparkProfile, 24)) {
            String sparkLine = BriefFormatters.formatSparkOneLiner(sparkProfile);
            if (sparkLine != null) {
                parts.add("Spark profile: " + sparkLine + " — see Spark tab for full report.");
            }
        }

        if (hasIssueId(issues, "SESSION_ATTACH_HISTORICAL")) {
            JsonObject suIssue = findIssue(issues, "SESSION_ATTACH_HISTORICAL");
            if (suIssue != null) {
                String message = strOr(suIssue, "message", "A Crafty su session kill was recorded earlier.");
                int dashIdx = message.indexOf(" —");
                if (dashIdx >= 0) {
                    message = message.substring(0, dashIdx);
                }
                parts.add(message + " — run Crafty as a systemd service.");
            }
        }

        JsonObject playerStats = mc != null ? obj(mc, "player_stats") : null;
        int cantKeepUp = mc != null ? integer(mc, "cant_keep_up_count", 0) : 0;
        if (cantKeepUp > 0 && playerStats != null && playerStats.has("concurrent_at_worst_lag")
                && !playerStats.get("concurrent_at_worst_lag").isJsonNull()) {
            int n = playerStats.get("concurrent_at_worst_lag").getAsInt();
            if (n > 0) {
                parts.add("Worst tick lag occurred with up to " + n + " player(s) online.");
            } else {
                parts.add("Worst tick lag occurred with no players online (likely background load).");
            }
        }

        List<JsonObject> activeCritical = new ArrayList<>();
        for (JsonObject i : active) {
            if ("critical".equals(str(i, "severity"))) {
                activeCritical.add(i);
            }
        }
        if (!activeCritical.isEmpty()) {
            parts.add("Address active critical issues above.");
        } else if (!histCrashes.isEmpty()) {
            parts.add("Review crash reports when convenient; no urgent action for the current session.");
        } else if (active.isEmpty()) {
            parts.add("No immediate action required.");
        }

        return String.join(" ", parts);
    }

    private static List<JsonObject> activeIssues(JsonArray issues) {
        List<JsonObject> active = new ArrayList<>();
        if (issues == null) {
            return active;
        }
        for (JsonElement el : issues) {
            JsonObject i = el.getAsJsonObject();
            if (!bool(i, "historical", false)) {
                active.add(i);
            }
        }
        return active;
    }

    private static boolean hasIssueId(JsonArray issues, String id) {
        return findIssue(issues, id) != null;
    }

    private static JsonObject findIssue(JsonArray issues, String id) {
        if (issues == null) {
            return null;
        }
        for (JsonElement el : issues) {
            JsonObject i = el.getAsJsonObject();
            if (id.equals(str(i, "id"))) {
                return i;
            }
        }
        return null;
    }

    private static JsonObject obj(JsonObject o, String key) {
        if (o == null || !o.has(key) || o.get(key).isJsonNull() || !o.get(key).isJsonObject()) {
            return null;
        }
        return o.getAsJsonObject(key);
    }

    private static JsonArray array(JsonObject o, String key) {
        if (o == null || !o.has(key) || o.get(key).isJsonNull() || !o.get(key).isJsonArray()) {
            return null;
        }
        return o.getAsJsonArray(key);
    }

    private static String str(JsonObject o, String key) {
        if (o == null || !o.has(key) || o.get(key).isJsonNull()) {
            return null;
        }
        return o.get(key).getAsString();
    }

    private static String strOr(JsonObject o, String key, String def) {
        String s = str(o, key);
        return s != null ? s : def;
    }

    private static Double dbl(JsonObject o, String key) {
        if (o == null || !o.has(key) || o.get(key).isJsonNull()) {
            return null;
        }
        return o.get(key).getAsDouble();
    }

    private static int integer(JsonObject o, String key, int def) {
        if (o == null || !o.has(key) || o.get(key).isJsonNull()) {
            return def;
        }
        return o.get(key).getAsInt();
    }

    private static boolean bool(JsonObject o, String key, boolean def) {
        if (o == null || !o.has(key) || o.get(key).isJsonNull()) {
            return def;
        }
        return o.get(key).getAsBoolean();
    }
}
