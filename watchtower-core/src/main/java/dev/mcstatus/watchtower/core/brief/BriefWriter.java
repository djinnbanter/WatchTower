package dev.mcstatus.watchtower.core.brief;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.analyze.FactsBuilder;
import dev.mcstatus.watchtower.core.panel.PanelLabels;
import dev.mcstatus.watchtower.core.util.TimeParse;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Brief report writer ported from mc-status-analyze.py write_brief.
 */
public final class BriefWriter {

    private BriefWriter() {
    }

    public static String writeBrief(JsonObject facts) {
        JsonObject meta = obj(facts, "meta");
        JsonObject health = obj(facts, "health");
        JsonObject system = obj(facts, "system");
        JsonObject mc = obj(facts, "minecraft");
        JsonObject optional = obj(facts, "optional");
        JsonArray issues = array(facts, "issues");
        JsonArray events = array(facts, "events");

        String overall = strOr(health, "status", "unknown").toUpperCase(Locale.ROOT);
        String current = strOr(health, "current_status", strOr(health, "status", "unknown"))
                .toUpperCase(Locale.ROOT);
        String hostname = strOr(meta, "hostname", "unknown");
        String serverDir = str(meta, "server_dir");
        if (serverDir == null) {
            serverDir = "[not detected]";
        }
        String panel = strOr(meta, "panel", "unknown");
        String loader = strOr(meta, "loader", "unknown");
        boolean javaUp = bool(health, "java_running", false);

        List<JsonObject> activeIssues = new ArrayList<>();
        List<JsonObject> histIssues = new ArrayList<>();
        if (issues != null) {
            for (JsonElement el : issues) {
                JsonObject i = el.getAsJsonObject();
                if (bool(i, "historical", false)) {
                    histIssues.add(i);
                } else {
                    activeIssues.add(i);
                }
            }
        }

        List<String> lines = new ArrayList<>();
        lines.add("=".repeat(80));
        lines.add("MINECRAFT SERVER — HEALTH REPORT");
        lines.add("Generated: " + TimeParse.fmtTime(str(meta, "generated"))
                + "  |  Host: " + hostname);
        String statusLine = BriefFormatters.fmtWindowLine(meta != null ? meta : new JsonObject())
                + "  |  Overall: " + overall + "  |  Now: " + current;
        lines.add(statusLine);
        String statusNote = str(health, "status_note");
        if (statusNote != null && !statusNote.isEmpty()) {
            lines.add(statusNote);
        }
        lines.add("Server: " + BriefFormatters.truncateServerPath(serverDir));
        String panelLabel = PanelLabels.displayName(panel);
        if (!panel.equals(panelLabel.toLowerCase(Locale.ROOT)) && !"unknown".equals(panel) && !"none".equals(panel)) {
            lines.add("Panel: " + panelLabel + " (" + panel + ")  |  Loader: " + loader);
        } else {
            lines.add("Panel: " + panel + "  |  Loader: " + loader);
        }
        lines.add("=".repeat(80));
        lines.add("");

        lines.add("TL;DR");
        lines.add("-".repeat(40));
        lines.add("  " + TldrBuilder.buildTldr(facts));
        lines.add("");

        lines.add("AT A GLANCE");
        lines.add("-".repeat(40));
        Double javaUptime = dbl(system, "java_uptime_sec");
        String javaU = javaUptime != null
                ? String.format(Locale.US, " (up %.1fh)", javaUptime / 3600.0) : "";
        Double gap = dbl(health, "log_gap_minutes");
        String logS;
        if (gap != null && gap <= 1) {
            logS = "fresh (just now)";
        } else if (gap != null) {
            logS = gap < 60
                    ? String.format(Locale.US, "fresh (%.0f min ago)", gap)
                    : String.format(Locale.US, "%.1fh ago", gap / 60.0);
        } else {
            logS = "unknown";
        }
        int ac = 0;
        int aw = 0;
        for (JsonObject i : activeIssues) {
            if ("critical".equals(str(i, "severity"))) {
                ac++;
            }
            if ("warning".equals(str(i, "severity"))) {
                aw++;
            }
        }
        int hc = histIssues.size();
        String issueS = ac + " critical, " + aw + " warning" + (hc > 0 ? ", " + hc + " historical" : "");
        String panelStatus = PanelLabels.glanceStatus(panel, bool(health, "panel_running", false));
        lines.add(String.format("  Java: %s%s   Panel: %s   Logs: %s",
                javaUp ? "RUNNING" : "DOWN", javaU, panelStatus, logS));
        lines.add("  Issues: " + issueS);
        lines.add("  " + BriefFormatters.fmtPlayersLine(mc != null ? mc : new JsonObject()));

        JsonObject dh = optional != null ? obj(optional, "dh_pregen") : null;
        if (dh != null) {
            JsonObject last = obj(dh, "last");
            String pctS = BriefFormatters.fmtDhPct(last);
            String pctPart = pctS.isEmpty() ? "" : " (" + pctS + " complete)";
            String etaS = BriefFormatters.fmtDhEta(last, dh);
            String etaPart = etaS.isEmpty() ? "" : ", ETA: " + etaS;
            String state;
            if (bool(dh, "pregen_paused", false)) {
                state = "paused";
            } else if (bool(dh, "pregen_active", false)) {
                state = "active";
            } else {
                state = "idle";
            }
            lines.add("  DH pregen: " + BriefFormatters.fmtDhRadius(last) + pctPart + etaPart + " — " + state);
        }
        String trendLine = BriefFormatters.fmtTrendMaturityLine(
                optional != null ? obj(optional, "trend_state") : null);
        if (trendLine != null) {
            lines.add(trendLine);
        }
        String logErrLine = BriefFormatters.fmtLogErrorsGlance(mc != null ? mc : new JsonObject());
        if (logErrLine != null) {
            lines.add(logErrLine);
        }
        String modErrLine = BriefFormatters.fmtModLogErrorsGlance(optional);
        if (modErrLine != null) {
            lines.add(modErrLine);
        }
        lines.add("");

        lines.add("SUMMARY");
        lines.add("-".repeat(40));
        lines.add("Java process: " + (javaUp ? "RUNNING" : "NOT RUNNING"));
        if (health != null && health.has("panel_running") && PanelLabels.hasDaemon(panel)) {
            lines.add("Panel process: " + (bool(health, "panel_running", false) ? "RUNNING" : "NOT RUNNING"));
        }
        if (str(health, "last_log_time") != null) {
            lines.add("Last log activity: " + TimeParse.fmtTime(str(health, "last_log_time"))
                    + TimeParse.fmtGap(gap));
        }
        double uptimeSec = dbl(system, "uptime_seconds") != null ? dbl(system, "uptime_seconds") : 0.0;
        lines.add(String.format(Locale.US, "Machine uptime: %.1f hours", uptimeSec / 3600.0));
        lines.add("RAM available: " + strOr(system, "mem_available_gb", "?")
                + " GB  |  Disk used: " + strOr(system, "disk_use_pct", "?") + "%");
        lines.add(BriefFormatters.fmtPlayersLine(mc != null ? mc : new JsonObject()));
        String startupLine = BriefFormatters.fmtStartupNoiseLine(optional);
        if (startupLine != null) {
            lines.add(startupLine);
        }
        boolean oomAny = bool(mc, "oom_in_logs", false) || hasIssueId(issues, "OOM");
        int crashN = array(mc, "new_crash_reports") != null ? array(mc, "new_crash_reports").size() : 0;
        lines.add(String.format("Lookback: %d crash report(s), %s, %d tick-lag warning(s)",
                crashN, oomAny ? "OOM seen" : "no OOM", integer(mc, "cant_keep_up_count", 0)));
        if (dh != null) {
            JsonObject first = obj(dh, "first");
            JsonObject last = obj(dh, "last");
            String pctPart = BriefFormatters.fmtDhProgressSuffix(last);
            String cpsPart = dbl(dh, "cps_avg") != null
                    ? String.format(Locale.US, " (~%.0f cps)", dbl(dh, "cps_avg")) : "";
            lines.add("DH pregen: " + strOr(first, "chunks", "?") + " -> "
                    + strOr(last, "chunks", "?") + " / " + strOr(last, "total", "?")
                    + " chunks" + pctPart + cpsPart);
        }
        String backupLine = BriefFormatters.fmtBackupLine(
                optional != null ? obj(optional, "last_backup") : null,
                optional != null ? obj(optional, "backup_external") : null);
        if (backupLine != null) {
            lines.add(backupLine);
        }
        List<String> sparkLines = BriefFormatters.formatSparkSection(facts, 24);
        if (sparkLines != null) {
            lines.addAll(sparkLines);
        }
        lines.add("");

        JsonObject ps = mc != null ? obj(mc, "player_stats") : null;
        lines.add("PLAYER ACTIVITY");
        lines.add("-".repeat(40));
        lines.add("  " + BriefFormatters.fmtPlayersLine(mc != null ? mc : new JsonObject()));
        if (ps != null && (integer(ps, "unique_players", 0) > 0 || integer(ps, "peak_concurrent", 0) > 0)) {
            lines.add(String.format("  Window: peak %d  |  unique %d  |  player hours %s",
                    integer(ps, "peak_concurrent", 0),
                    integer(ps, "unique_players", 0),
                    strOr(ps, "player_hours", "0")));
            JsonArray sessions = array(ps, "sessions");
            if (sessions != null && !sessions.isEmpty()) {
                int start = Math.max(0, sessions.size() - 5);
                for (int i = start; i < sessions.size(); i++) {
                    JsonObject s = sessions.get(i).getAsJsonObject();
                    String leave = str(s, "leave");
                    lines.add("  " + strOr(s, "player", "?") + " joined "
                            + TimeParse.fmtTime(str(s, "join"))
                            + (leave != null ? " → left " + TimeParse.fmtTime(leave) : " (still online)"));
                }
            }
        } else {
            lines.add("  No joins in lookback window.");
        }
        lines.add("");

        lines.add("SERVER LIFECYCLE");
        lines.add("-".repeat(40));
        if (mc != null && str(mc, "server_started") != null) {
            lines.add("  Current session started: " + TimeParse.fmtTime(str(mc, "server_started")));
        }
        int stops = countEventType(events, "clean_stop");
        int starts = countEventType(events, "server_start");
        lines.add("  Start events in window: " + starts + "  |  Clean stops: " + stops);
        JsonObject counts = optional != null ? obj(optional, "panel_command_counts") : null;
        if (counts != null && !counts.entrySet().isEmpty()) {
            lines.add(String.format("  Panel commands: %d start, %d stop, %d restart, %d kill",
                    integer(counts, "start", 0),
                    integer(counts, "stop", 0),
                    integer(counts, "restart", 0),
                    integer(counts, "kill", 0)));
        }
        JsonArray craftyCommands = optional != null ? array(optional, "crafty_commands") : null;
        if (craftyCommands != null && !craftyCommands.isEmpty()) {
            JsonObject lastCmd = craftyCommands.get(craftyCommands.size() - 1).getAsJsonObject();
            String cmd = strOr(lastCmd, "cmd", "");
            if (cmd.length() > 80) {
                cmd = cmd.substring(0, 80);
            }
            lines.add("  Last panel action: " + strOr(lastCmd, "time", "?") + " — " + cmd);
        }
        lines.add("");

        List<String> ingame = BriefFormatters.fmtIngamePerformance(
                mc != null ? mc : new JsonObject(), optional);
        if (!ingame.isEmpty()) {
            lines.add("IN-GAME PERFORMANCE");
            lines.add("-".repeat(40));
            lines.addAll(ingame);
            JsonObject ent = mc != null ? obj(mc, "entity_stats") : null;
            if (ent != null && (ent.has("entities") || ent.has("chunks"))) {
                List<String> parts = new ArrayList<>();
                if (ent.has("entities") && !ent.get("entities").isJsonNull()) {
                    parts.add(String.format(Locale.US, "Entities: %,d loaded", ent.get("entities").getAsInt()));
                }
                if (ent.has("chunks") && !ent.get("chunks").isJsonNull()) {
                    parts.add(String.format(Locale.US, "Chunks: %,d", ent.get("chunks").getAsInt()));
                }
                if (!parts.isEmpty()) {
                    lines.add("  " + String.join("  |  ", parts));
                }
            }
            Integer modN = integer(mc, "mod_count");
            if (modN != null) {
                String modLine = BriefFormatters.fmtModChangesLine(optional, modN);
                if (modLine == null) {
                    modLine = "  Mods: " + modN + " jar(s)";
                    Integer delta = integer(mc, "mod_count_delta");
                    if (delta != null && delta != 0) {
                        modLine += String.format(" (%s%d since last run)", delta > 0 ? "+" : "", delta);
                    }
                } else {
                    modLine = "  " + modLine;
                }
                lines.add(modLine);
            }
            String logErr = BriefFormatters.fmtLogErrorsLine(mc != null ? mc : new JsonObject());
            if (logErr != null) {
                lines.add(logErr);
            }
            lines.add("");
        }

        lines.add("PERFORMANCE");
        lines.add("-".repeat(40));
        if (mc != null && dbl(mc, "worst_tick_lag_ms") != null) {
            lines.add("  Worst tick lag: " + String.format(Locale.US, "%.0f", dbl(mc, "worst_tick_lag_ms"))
                    + " ms behind");
        }
        int sessionLag = integer(mc, "cant_keep_up_session_count",
                integer(mc, "cant_keep_up_count", 0));
        if (sessionLag > 0) {
            lines.add("  'Can't keep up' warnings (current session): " + sessionLag);
        } else if (mc != null && integer(mc, "cant_keep_up_count", 0) > 0) {
            lines.add("  'Can't keep up' warnings (historical): " + integer(mc, "cant_keep_up_count", 0));
        }
        String storageLine = BriefFormatters.fmtStorageLine(optional);
        if (storageLine != null) {
            lines.add(storageLine);
        }
        String diskIoLine = BriefFormatters.fmtDiskIoLine(optional);
        if (diskIoLine != null) {
            lines.add(diskIoLine);
        }
        List<String> cpuLines = BriefFormatters.fmtCpuLines(system != null ? system : new JsonObject());
        if (!cpuLines.isEmpty()) {
            lines.add("  CPU");
            lines.addAll(cpuLines);
        }
        String attrLine = BriefFormatters.fmtLoadAttributionLine(optional);
        if (attrLine != null) {
            lines.add(attrLine);
        }
        Double rss = dbl(system, "java_rss_gb");
        Double xmx = dbl(system, "java_xmx_gb");
        if (rss != null) {
            if (xmx != null && xmx >= 1) {
                lines.add(String.format(Locale.US,
                        "  Java RSS: %.0f GB (Xmx %.0f GB; RSS includes off-heap/native memory)", rss, xmx));
            } else {
                lines.add(String.format(Locale.US, "  Java RSS: %.0f GB", rss));
            }
        }
        lines.add("");

        lines.add("RESOURCE PRESSURE");
        lines.add("-".repeat(40));
        JsonObject th = obj(facts, "thresholds");
        lines.add("  RAM available: " + strOr(system, "mem_available_gb", "?")
                + " GB (warn < " + integer(th, "mem_warn_avail_gb", 2) + " GB)");
        lines.add("  Disk used: " + strOr(system, "disk_use_pct", "?")
                + "% (warn >= " + integer(th, "disk_warn_pct", 85) + "%)");
        lines.add("  Swap used: " + integer(system, "swap_used_mb", 0) + " MB");
        String secLine = BriefFormatters.fmtSecurityLine(optional);
        if (secLine != null) {
            lines.add(secLine);
        }
        String bwLine = BriefFormatters.fmtBandwidthLine(optional);
        if (bwLine != null) {
            lines.add(bwLine);
        }
        lines.add("");

        if (dh != null) {
            lines.add("DISTANT HORIZONS");
            lines.add("-".repeat(40));
            String state;
            if (bool(dh, "pregen_paused", false)) {
                state = "paused since last restart";
            } else if (bool(dh, "pregen_active", false)) {
                state = "active";
            } else {
                state = "no recent progress";
            }
            lines.add("  Status: " + state);
            JsonObject last = obj(dh, "last");
            String pctS = BriefFormatters.fmtDhPct(last);
            String etaS = BriefFormatters.fmtDhEta(last, dh);
            Double cps = last != null ? dbl(last, "cps") : null;
            List<String> parts = new ArrayList<>();
            if (!pctS.isEmpty()) {
                parts.add("Completion: " + pctS);
            }
            if (!etaS.isEmpty()) {
                parts.add("ETA: " + etaS);
            }
            if (cps != null) {
                parts.add(String.format(Locale.US, "~%.0f cps", cps));
            }
            if (!parts.isEmpty()) {
                lines.add("  " + String.join(" | ", parts));
            }
            if (last != null && str(last, "quote") != null) {
                lines.add("  Last pregen line (" + strOr(last, "file", "?") + ":"
                        + strOr(last, "line", "?") + "):");
                lines.add("    > " + str(last, "quote"));
            }
            if (dh.has("hours_since_last") && !dh.get("hours_since_last").isJsonNull()) {
                lines.add("  Hours since last pregen log: " + dh.get("hours_since_last").getAsString());
            }
            lines.add("");
        }

        lines.addAll(BriefFormatters.fmtModsSection(optional, integer(mc, "mod_count")));
        lines.addAll(BriefFormatters.fmtModLogHealthSection(optional));
        lines.addAll(BriefFormatters.fmtClientOnlyModsSection(optional));

        JsonArray recentIncidents = optional != null ? array(optional, "recent_incidents") : null;
        if (recentIncidents != null && !recentIncidents.isEmpty()) {
            lines.add("LAG INCIDENTS (recent pins)");
            lines.add("-".repeat(40));
            for (JsonElement el : recentIncidents) {
                JsonObject inc = el.getAsJsonObject();
                String src = strOr(inc, "source", "auto");
                String trig = strOr(inc, "trigger", src);
                String line = "  " + TimeParse.fmtTime(str(inc, "pinned_at"))
                        + "  [" + src + "/" + trig + "]  "
                        + strOr(inc, "narrative", strOr(inc, "title", "Lag spike"));
                if (inc.has("mspt") && inc.has("tps")) {
                    line += String.format(Locale.US, " (MSPT %.0f, TPS %.1f)",
                            inc.get("mspt").getAsDouble(), inc.get("tps").getAsDouble());
                }
                if (inc.has("note") && str(inc, "note") != null && !str(inc, "note").isBlank()) {
                    line += " — note: " + str(inc, "note");
                }
                lines.add(line);
            }
            lines.add("");
        }

        lines.add("NOTABLE TIMELINE");
        lines.add("-".repeat(40));
        List<JsonObject> ranked = TimelineRanker.rankedTimeline(events);
        if (!ranked.isEmpty()) {
            for (JsonObject e : ranked) {
                lines.add("  " + TimeParse.fmtTime(str(e, "time")) + "  " + TimelineRanker.eventLabel(e));
            }
        } else {
            lines.add("  [no notable events in window]");
        }
        lines.add("");

        lines.add("ISSUES");
        lines.add("-".repeat(40));
        if (issues == null || issues.isEmpty()) {
            lines.add("  None detected — server looks healthy for this window.");
        } else {
            if (!activeIssues.isEmpty()) {
                lines.add("  ACTIVE");
                for (JsonObject i : activeIssues) {
                    String sev = strOr(i, "severity", "warning").toUpperCase(Locale.ROOT);
                    lines.add("    [" + sev + "] " + str(i, "message"));
                    JsonArray evidence = array(i, "evidence");
                    if (evidence != null) {
                        for (JsonElement evEl : evidence) {
                            for (String ln : BriefFormatters.fmtEvidenceLine(evEl.getAsJsonObject())) {
                                lines.add("    " + ln);
                            }
                        }
                    }
                }
                lines.add("");
            }
            if (!histIssues.isEmpty()) {
                lines.add("  HISTORICAL (in window, server recovered)");
                for (JsonObject i : histIssues) {
                    String sev = strOr(i, "severity", "warning").toUpperCase(Locale.ROOT);
                    lines.add("    [" + sev + "] " + str(i, "message"));
                    if (!"SESSION_ATTACH_HISTORICAL".equals(str(i, "id"))) {
                        JsonArray evidence = array(i, "evidence");
                        if (evidence != null) {
                            for (JsonElement evEl : evidence) {
                                for (String ln : BriefFormatters.fmtEvidenceLine(evEl.getAsJsonObject())) {
                                    lines.add("    " + ln);
                                }
                            }
                        }
                    } else {
                        JsonArray evidence = array(i, "evidence");
                        if (evidence != null && !evidence.isEmpty()) {
                            String quote = str(evidence.get(0).getAsJsonObject(), "quote");
                            if (quote != null) {
                                quote = quote.strip();
                                if (!quote.isEmpty()) {
                                    lines.add("    > " + quote);
                                }
                            }
                        }
                    }
                }
            }
        }
        lines.add("");

        lines.add("RECOMMENDED ACTIONS");
        lines.add("-".repeat(40));
        List<String> actionLines = new ArrayList<>();
        Set<String> seen = new HashSet<>();
        Set<String> priorityIds = new HashSet<>();
        for (JsonObject i : activeIssues) {
            if ("critical".equals(str(i, "severity"))) {
                priorityIds.add(strOr(i, "id", ""));
            }
        }
        boolean skipModLoadBoilerplate = BriefFormatters.hasWarningModRecommendations(optional);
        if (issues != null) {
            for (JsonElement el : issues) {
                JsonObject i = el.getAsJsonObject();
                if (bool(i, "historical", false) && !priorityIds.contains(strOr(i, "id", ""))) {
                    continue;
                }
                String iid = strOr(i, "id", "");
                if (skipModLoadBoilerplate && "MOD_LOAD_FAILED".equals(iid)) {
                    continue;
                }
                String prefix = priorityIds.contains(iid) ? "Priority: " : "";
                List<String> actions = FactsBuilder.ACTIONS.get(iid);
                if (actions != null) {
                    for (String a : actions) {
                        String line = prefix.isEmpty() ? "  - " + a : "  - " + prefix + a;
                        if (!seen.contains(a)) {
                            seen.add(a);
                            actionLines.add(line);
                        }
                    }
                }
            }
        }
        if (optional != null && dh != null && bool(dh, "pregen_paused", false) && javaUp) {
            for (String a : FactsBuilder.ACTIONS.getOrDefault("DH_PREGEN_INFO", List.of())) {
                if (!seen.contains(a)) {
                    seen.add(a);
                    actionLines.add("  - " + a);
                }
            }
        }
        for (String line : BriefFormatters.fmtModRecommendationActions(optional, 8)) {
            if (!seen.contains(line.strip())) {
                seen.add(line.strip());
                actionLines.add(line);
            }
        }
        String clientInfo = BriefFormatters.fmtClientClassInfoAction(optional);
        if (clientInfo != null && !seen.contains(clientInfo.strip())) {
            seen.add(clientInfo.strip());
            actionLines.add(clientInfo);
        }
        if (!actionLines.isEmpty()) {
            lines.addAll(actionLines);
        } else {
            lines.add("  No actions required.");
        }
        lines.add("");
        lines.add("=".repeat(80));
        String collNote = BriefFormatters.fmtCollectionWarningsNote(meta);
        if (collNote != null) {
            lines.add(collNote);
        }
        lines.add(BriefFormatters.formatSourcePathsFooter(meta));
        lines.add("=".repeat(80));

        return String.join("\n", lines) + "\n";
    }

    private static int countEventType(JsonArray events, String type) {
        if (events == null) {
            return 0;
        }
        int n = 0;
        for (JsonElement el : events) {
            if (type.equals(str(el.getAsJsonObject(), "type"))) {
                n++;
            }
        }
        return n;
    }

    private static boolean hasIssueId(JsonArray issues, String id) {
        if (issues == null) {
            return false;
        }
        for (JsonElement el : issues) {
            if (id.equals(str(el.getAsJsonObject(), "id"))) {
                return true;
            }
        }
        return false;
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
        JsonElement el = o.get(key);
        if (el.isJsonPrimitive()) {
            return el.getAsString();
        }
        return el.toString();
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

    private static Integer integer(JsonObject o, String key) {
        if (o == null || !o.has(key) || o.get(key).isJsonNull()) {
            return null;
        }
        return o.get(key).getAsInt();
    }

    private static int integer(JsonObject o, String key, int def) {
        Integer v = integer(o, key);
        return v != null ? v : def;
    }

    private static boolean bool(JsonObject o, String key, boolean def) {
        if (o == null || !o.has(key) || o.get(key).isJsonNull()) {
            return def;
        }
        return o.get(key).getAsBoolean();
    }
}
