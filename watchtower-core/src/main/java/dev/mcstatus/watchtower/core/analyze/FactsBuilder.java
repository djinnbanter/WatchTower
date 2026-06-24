package dev.mcstatus.watchtower.core.analyze;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.brief.BriefFormatters;
import dev.mcstatus.watchtower.core.collect.CrashDetails;
import dev.mcstatus.watchtower.core.collect.SparkRecommendationBuilder;
import dev.mcstatus.watchtower.core.panel.PanelLabels;
import dev.mcstatus.watchtower.core.util.TimeParse;

import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Rule-based facts builder ported from mc-status-analyze.py build_facts.
 */
public final class FactsBuilder {

    public static final Set<String> HISTORICAL_ISSUE_IDS = Set.of(
            "CRASH_REPORT", "MANUAL_REBOOT", "SESSION_ATTACH_HISTORICAL"
    );

    public static final Map<String, List<String>> ACTIONS = Map.ofEntries(
            Map.entry("SERVER_DOWN", List.of(
                    "Start the server from your panel or service manager.",
                    "Check full report for last log lines and crash reports."
            )),
            Map.entry("ABNORMAL_STOP", List.of(
                    "Server stopped without a clean 'Stopping server' message — likely crash, hang, or process kill.",
                    "Avoid running the server attached to an SSH terminal; use systemd, screen, or tmux.",
                    "Check panel/service logs and kernel OOM entries in the full report."
            )),
            Map.entry("SESSION_ATTACH", List.of(
                    "Panel or server process may be tied to an SSH/su session that closed.",
                    "Run Crafty/your panel as a systemd service so disconnects do not kill Minecraft."
            )),
            Map.entry("SESSION_ATTACH_HISTORICAL", List.of(
                    "A past su/SSH session kill was recorded in this window — ensure Crafty runs as a service."
            )),
            Map.entry("OOM", List.of(
                    "Review JVM heap (-Xmx) and reduce chunk loaders / pregen aggressiveness.",
                    "Check for OutOfMemoryError or kernel OOM lines in the full report."
            )),
            Map.entry("MOD_LOAD_FAILED", List.of(
                    "Mod load issues detected — see MOD LOG HEALTH and latest.log."
            )),
            Map.entry("MOD_UPDATE_CONFLICT", List.of(
                    "Update or align mod versions cited in Mods → Update conflicts.",
                    "Remove conflicting mods one at a time if updates do not resolve the issue."
            )),
            Map.entry("CRASH_REPORT", List.of(
                    "Open the new crash report under crash-reports/ and address the mod or config cited.",
                    "Acknowledge each report after review so health reflects current risk."
            )),
            Map.entry("BACKUP_NOT_FOUND", List.of(
                    "Configure automated world backups in your control panel.",
                    "Verify BACKUP_DIR in watchtower/watchtower.conf points to where archives are stored."
            )),
            Map.entry("BACKUP_NOT_CONFIGURED", List.of(
                    "Set BACKUP_DIR in watchtower/watchtower.conf to your panel backup folder.",
                    "Enable scheduled backups in Crafty or your panel."
            )),
            Map.entry("DISK_HIGH", List.of(
                    "Free disk space on the server volume; world backups and logs can fill the disk."
            )),
            Map.entry("MEM_LOW", List.of(
                    "Available system RAM is low — reduce heap, players, or loaded chunks."
            )),
            Map.entry("TICK_LAG", List.of(
                    "Server logged 'Can't keep up' warnings — reduce MSPT load, factories, or view distance."
            )),
            Map.entry("MSPT_HIGH", List.of(
                    "Current MSPT is above the warning threshold — check Spark profiler or reduce loaded chunks."
            )),
            Map.entry("TPS_LOW", List.of(
                    "TPS is below 20 — investigate tick time (MSPT), entity counts, and chunk loaders."
            )),
            Map.entry("DH_PREGEN_THROTTLE", List.of(
                    "Consider: dh pregen stop minecraft:overworld — high CPU or tick lag during DH pregen.",
                    "Resume pregen when load drops: dh pregen start minecraft:overworld"
            )),
            Map.entry("LOG_STALE", List.of(
                    "Logs are stale while Java appears running — server may be hung; check process CPU."
            )),
            Map.entry("PANEL_DOWN", List.of(
                    "Management panel is not running — restart the panel service before using the web UI."
            )),
            Map.entry("MANUAL_REBOOT", List.of(
                    "Machine was rebooted manually during the lookback window."
            )),
            Map.entry("DH_PREGEN_STALL", List.of(
                    "DH pregen has not logged progress recently — run /dh pregen status in console."
            )),
            Map.entry("DH_PREGEN_INFO", List.of(
                    "Run /dh pregen status in console to confirm progress and resume if needed."
            )),
            Map.entry("CHUNKY_PREGEN_STALL", List.of(
                    "Chunky pregen has not logged progress recently — try /chunky pause then inspect debug logs."
            )),
            Map.entry("CHUNKY_PREGEN_DEGRADED", List.of(
                    "Chunky generation rate is low — check CPU, mods, and chunk errors in logs."
            )),
            Map.entry("CHUNKY_PREGEN_THROTTLE", List.of(
                    "Consider /chunky pause while tick lag or CPU is high, then continue when load drops."
            )),
            Map.entry("CHUNK_GEN_DURING_PREGEN", List.of(
                    "Chunk generation errors during pregen — pause Chunky and inspect failing coordinates."
            ))
    );

    private FactsBuilder() {
    }

    public static JsonObject buildFacts(JsonObject staging) {
        JsonObject meta = copyOrEmpty(staging, "meta");
        JsonObject flags = copyOrEmpty(staging, "flags");
        JsonObject mc = copyOrEmpty(staging, "minecraft");
        JsonObject system = copyOrEmpty(staging, "system");
        JsonObject thresholds = copyOrEmpty(staging, "thresholds");
        JsonArray events = array(staging, "events");
        if (events == null) {
            events = new JsonArray();
        }

        JsonArray issues = new JsonArray();
        Set<String> seenIds = new HashSet<>();
        String[] overallStatus = {"ok"};

        boolean javaRunning = bool(flags, "java_running", false);
        boolean panelRunning = bool(flags, "panel_running", false);
        boolean logHadActivity = bool(mc, "log_had_activity_in_window", false);
        boolean cleanStop = bool(mc, "clean_shutdown_seen", false);
        Double logGap = dbl(staging, "health_log_gap_minutes");
        if (logGap != null && logGap < 0) {
            logGap = 0.0;
        }
        String lastLogTime = str(mc, "last_log_time");
        JsonArray crashReports = array(mc, "new_crash_reports");
        boolean oomLog = bool(mc, "oom_in_logs", false);
        List<JsonObject> kernelOom = filterEvents(events, "kernel_oom", true);
        int cantKeepUp = integer(mc, "cant_keep_up_count", 0);
        int cantKeepUpSession = integer(mc, "cant_keep_up_session_count", cantKeepUp);
        int cantKeepUpHistorical = integer(mc, "cant_keep_up_historical_count", cantKeepUp);
        JsonArray tickLagSessionEv = array(mc, "tick_lag_session_evidence");
        if (tickLagSessionEv == null) {
            tickLagSessionEv = array(mc, "tick_lag_evidence");
        }
        JsonArray tickLagHistoricalEv = array(mc, "tick_lag_historical_evidence");
        if (tickLagHistoricalEv == null) {
            tickLagHistoricalEv = array(mc, "tick_lag_evidence");
        }
        double diskPct = dbl(system, "disk_use_pct") != null ? dbl(system, "disk_use_pct") : 0.0;
        Double memAvail = dbl(system, "mem_available_gb");
        double logStaleMin = dbl(thresholds, "log_stale_minutes") != null
                ? dbl(thresholds, "log_stale_minutes") : 15.0;
        int cantWarn = integer(thresholds, "cant_keep_up_warn", 5);
        Instant serverStarted = TimeParse.parseTime(str(mc, "server_started"));

        IssueContext ctx = new IssueContext(issues, seenIds, overallStatus);

        if (!javaRunning && logHadActivity) {
            JsonArray ev = new JsonArray();
            if (str(mc, "last_log_line") != null) {
                JsonObject evEntry = new JsonObject();
                evEntry.addProperty("file", strOr(mc, "last_log_file", "logs/latest.log"));
                if (mc.has("last_log_line_no") && !mc.get("last_log_line_no").isJsonNull()) {
                    evEntry.add("line", mc.get("last_log_line_no"));
                }
                evEntry.addProperty("quote", str(mc, "last_log_line"));
                if (lastLogTime != null) {
                    evEntry.addProperty("time", lastLogTime);
                }
                ev.add(evEntry);
            }
            ctx.addIssue("SERVER_DOWN",
                    "Minecraft Java process is not running but logs show activity in the lookback window.",
                    "critical", ev.isEmpty() ? null : ev, false);
        }

        if (logHadActivity && !javaRunning && !cleanStop) {
            ctx.addIssue("ABNORMAL_STOP", "Logs stopped without a clean shutdown message.", "critical",
                    null, false);
        }

        if (logGap != null && logGap > logStaleMin && javaRunning) {
            JsonArray ev = new JsonArray();
            JsonObject evEntry = new JsonObject();
            evEntry.addProperty("file", strOr(mc, "last_log_file", "logs/latest.log"));
            if (mc.has("last_log_line_no") && !mc.get("last_log_line_no").isJsonNull()) {
                evEntry.add("line", mc.get("last_log_line_no"));
            }
            evEntry.addProperty("quote", strOr(mc, "last_log_line", ""));
            if (lastLogTime != null) {
                evEntry.addProperty("time", lastLogTime);
            }
            ev.add(evEntry);
            ctx.addIssue("LOG_STALE",
                    String.format(Locale.US, "Last log entry was %.0f minutes ago while Java is still running.",
                            logGap),
                    "warning", ev, false);
        }

        if (!javaRunning && logGap != null && logGap > 30 && !cleanStop) {
            ctx.addIssue("ABNORMAL_STOP",
                    String.format(Locale.US,
                            "Logging stopped ~%.0f minutes ago with no clean shutdown.", logGap),
                    "critical", null, false);
        }

        List<JsonObject> sessionCloses = filterEvents(events, "session_close", false);
        if (!sessionCloses.isEmpty() && lastLogTime != null && !javaRunning) {
            JsonArray ev = new JsonArray();
            int limit = Math.min(3, sessionCloses.size());
            for (int i = 0; i < limit; i++) {
                JsonObject e = sessionCloses.get(i);
                JsonArray evidence = array(e, "evidence");
                if (evidence != null && !evidence.isEmpty()) {
                    for (JsonElement el : evidence) {
                        ev.add(el.deepCopy());
                    }
                } else {
                    JsonObject fallback = new JsonObject();
                    fallback.addProperty("file", "journalctl");
                    fallback.add("line", null);
                    fallback.addProperty("quote", strOr(e, "detail", ""));
                    ev.add(fallback);
                }
            }
            ctx.addIssue("SESSION_ATTACH",
                    "A user session closed around the time the server stopped — common when the panel runs inside SSH/su.",
                    "warning", ev, false);
        }

        List<JsonObject> suCrafty = new ArrayList<>();
        for (JsonObject e : sessionCloses) {
            if ("su_crafty".equals(str(e, "subtype"))) {
                suCrafty.add(e);
            }
        }
        if (!suCrafty.isEmpty() && javaRunning) {
            int n = suCrafty.size();
            List<String> times = new ArrayList<>();
            for (int i = 0; i < Math.min(5, suCrafty.size()); i++) {
                times.add(TimeParse.fmtTime(str(suCrafty.get(i), "time")));
            }
            String msg = String.format("Crafty su session closed (%d instance%s in window)",
                    n, n != 1 ? "s" : "") + " — server has since recovered.";
            JsonArray ev = new JsonArray();
            JsonObject evEntry = new JsonObject();
            evEntry.addProperty("file", "journalctl");
            evEntry.add("line", null);
            evEntry.addProperty("quote", n + " su crafty session close(s): " + String.join(", ", times));
            ev.add(evEntry);
            ctx.addIssue("SESSION_ATTACH_HISTORICAL", msg, "warning", ev, true);
        }

        JsonArray oomEvidence = new JsonArray();
        appendAll(oomEvidence, array(mc, "oom_evidence"));
        appendAll(oomEvidence, array(staging, "kernel_oom_evidence"));
        for (JsonObject e : kernelOom) {
            appendAll(oomEvidence, array(e, "evidence"));
        }
        if (oomLog || !kernelOom.isEmpty()) {
            ctx.addIssue("OOM", "Out-of-memory condition detected in logs or kernel journal.",
                    "critical", oomEvidence.isEmpty() ? null : oomEvidence, false);
        }

        if (crashReports != null && !crashReports.isEmpty()) {
            JsonObject optionalEarly = obj(staging, "optional");
            Set<String> ackedCrashes = acknowledgedCrashFiles(optionalEarly);
            JsonArray unacked = new JsonArray();
            for (JsonElement el : crashReports) {
                JsonObject c = el.getAsJsonObject();
                if (!isCrashAcked(c, ackedCrashes)) {
                    unacked.add(c);
                }
            }
            if (!unacked.isEmpty()) {
            List<String> names = new ArrayList<>();
            JsonArray ev = new JsonArray();
            String latestLabel = "";
            for (int i = 0; i < unacked.size(); i++) {
                JsonObject c = unacked.get(i).getAsJsonObject();
                if (i < 4) {
                    names.add(strOr(c, "file", "?"));
                }
                if (i == 0) {
                    latestLabel = crashDisplayLabel(c);
                }
                if (i < 5) {
                    JsonObject evEntry = new JsonObject();
                    evEntry.addProperty("file", "crash-reports/" + strOr(c, "file", "?"));
                    evEntry.add("line", null);
                    String quote = crashDisplayLabel(c);
                    if (quote == null || quote.isBlank()) {
                        quote = str(c, "summary");
                    }
                    if (quote == null || quote.isBlank()) {
                        quote = strOr(c, "quote", strOr(c, "file", "?"));
                    }
                    evEntry.addProperty("quote", quote);
                    if (str(c, "time") != null) {
                        evEntry.addProperty("time", str(c, "time"));
                    }
                    ev.add(evEntry);
                }
            }
            boolean allHistorical = false;
            if (serverStarted != null) {
                allHistorical = true;
                for (JsonElement el : unacked) {
                    Instant ct = TimeParse.parseTime(str(el.getAsJsonObject(), "time"));
                    if (ct == null || !ct.isBefore(serverStarted)) {
                        allHistorical = false;
                        break;
                    }
                }
            }
            String msg = "New crash report(s) in lookback window: " + String.join(", ", names);
            if (!latestLabel.isBlank()) {
                msg += " — Latest: " + latestLabel;
            }
            ctx.addIssue("CRASH_REPORT", msg, "critical", ev, allHistorical);
            }
        }

        double diskWarn = dbl(thresholds, "disk_warn_pct") != null ? dbl(thresholds, "disk_warn_pct") : 85.0;
        if (diskPct > 0 && diskPct >= diskWarn) {
            ctx.addIssue("DISK_HIGH",
                    String.format(Locale.US, "Disk usage is %.0f%% on the server volume.", diskPct),
                    "warning", null, false);
        }

        double memWarn = dbl(thresholds, "mem_warn_avail_gb") != null ? dbl(thresholds, "mem_warn_avail_gb") : 2.0;
        if (memAvail != null && memAvail < memWarn) {
            ctx.addIssue("MEM_LOW",
                    String.format(Locale.US, "Only ~%.0f GB RAM available.", memAvail),
                    "warning", null, false);
        }

        if (cantKeepUpSession >= cantWarn) {
            ctx.addIssue("TICK_LAG",
                    String.format("'Can't keep up' appeared %d time(s) in the current session.", cantKeepUpSession),
                    "warning", tickLagSessionEv, false);
        } else if (cantKeepUpHistorical >= cantWarn) {
            ctx.addIssue("TICK_LAG",
                    String.format("'Can't keep up' appeared %d time(s) in logs (before current session).",
                            cantKeepUpHistorical),
                    "warning", tickLagHistoricalEv, true);
        }

        JsonObject tpsData = obj(mc, "tps");
        JsonObject ow = tpsData != null ? obj(tpsData, "overworld") : null;
        Double msptNow = ow != null ? dbl(ow, "mspt") : null;
        Double tpsNow = ow != null ? dbl(ow, "tps") : null;
        double msptWarn = dbl(thresholds, "mspt_warn") != null ? dbl(thresholds, "mspt_warn") : 50.0;
        double tpsWarn = dbl(thresholds, "tps_warn") != null ? dbl(thresholds, "tps_warn") : 19.5;
        if (msptNow != null && msptNow > msptWarn) {
            ctx.addIssue("MSPT_HIGH",
                    String.format(Locale.US, "Current MSPT is %.1f ms (warn > %.0f ms).", msptNow, msptWarn),
                    "warning", null, false);
        }
        if (tpsNow != null && tpsNow < tpsWarn) {
            ctx.addIssue("TPS_LOW",
                    String.format(Locale.US, "Current TPS is %.2f (warn < %.1f).", tpsNow, tpsWarn),
                    "warning", null, false);
        }

        String panelId = str(meta, "panel");
        boolean suppressPanelDown = bool(flags, "hosted_container", false)
                || PanelLabels.shouldSuppressPanelDown(panelId);
        if (PanelLabels.hasDaemon(panelId) && !panelRunning && !suppressPanelDown) {
            ctx.addIssue("PANEL_DOWN", PanelLabels.panelDownMessage(panelId), "warning", null, false);
        }

        List<JsonObject> rebootEv = filterEvents(events, "reboot", false);
        if (!rebootEv.isEmpty()) {
            Set<Integer> seenSec = new HashSet<>();
            List<JsonObject> dedupedReboot = new ArrayList<>();
            for (JsonObject e : rebootEv) {
                int sig = (int) TimeParse.timeSortKey(str(e, "time"));
                if (seenSec.contains(sig)) {
                    continue;
                }
                seenSec.add(sig);
                dedupedReboot.add(e);
            }
            if (!dedupedReboot.isEmpty()) {
                ctx.addRebootIssue(dedupedReboot.get(0));
            }
        }

        JsonObject optional = obj(staging, "optional");
        if (optional == null) {
            optional = new JsonObject();
        }
        addCrashSummaries(optional, crashReports, serverStarted, acknowledgedCrashFiles(optional), meta, events);
        ModIssueAdvisor.AdvisorResult modAdvice = ModIssueAdvisor.analyze(optional, meta);
        JsonArray modRecs = modAdvice.recommendations();
        if (optional.has("client_only_mods_summary")) {
            int removable = integer(optional.getAsJsonObject("client_only_mods_summary"),
                    "likely_removable_count", 0);
            if (removable > 0) {
                JsonObject rec = new JsonObject();
                rec.addProperty("mod_id", "client_only_mods");
                rec.addProperty("category", "client_on_server");
                rec.addProperty("severity", "info");
                rec.addProperty("count", removable);
                rec.addProperty("why", "Client-oriented mods detected on the dedicated server.");
                rec.addProperty("fix", "Consider removing listed client-only mods from server mods/ "
                        + "(see CLIENT-ONLY MODS ON SERVER).");
                rec.addProperty("install_hint", "Remove one mod at a time and restart to verify.");
                modRecs.add(rec);
            }
            int testRemove = integer(optional.getAsJsonObject("client_only_mods_summary"),
                    "test_remove_count", 0);
            if (testRemove > 0) {
                JsonObject rec = new JsonObject();
                rec.addProperty("mod_id", "client_only_mods_test");
                rec.addProperty("category", "client_on_server");
                rec.addProperty("severity", "info");
                rec.addProperty("count", testRemove);
                rec.addProperty("why", "Some mods could not be classified confidently as client-only.");
                rec.addProperty("fix", "Test removing uncertain mods one at a time from server mods/ before deleting from the pack.");
                rec.addProperty("worry_level", "informational");
                rec.addProperty("action_needed", false);
                modRecs.add(rec);
            }
        }
        if (!modRecs.isEmpty()) {
            optional.add("mod_recommendations", modRecs);
            enrichCrashModLinks(optional, modRecs);
            addModUpdateConflictIssue(ctx, modRecs);
            if (optional.has("spark_profile")) {
                SparkRecommendationBuilder.mergeModRecommendations(
                        optional.getAsJsonObject("spark_profile"), modRecs);
            }
        }
        if (!modAdvice.severeIssues().isEmpty()) {
            List<String> parts = new ArrayList<>();
            for (ModIssueAdvisor.SevereModIssue severe : modAdvice.severeIssues()) {
                parts.add(severe.modId() + ": " + severe.message());
            }
            String worst = modAdvice.severeIssues().get(0).category().severityRank() >= 5
                    ? "critical" : "warning";
            ctx.addIssue("MOD_LOAD_FAILED",
                    "Mod issue(s) detected: " + String.join(" | ", parts),
                    worst, null, false);
        }
        if (staging.has("collection_warnings") && staging.get("collection_warnings").isJsonArray()) {
            meta.add("collection_warnings", staging.get("collection_warnings").deepCopy());
        }
        JsonObject backup = obj(optional, "last_backup");
        JsonObject backupExternal = obj(optional, "backup_external");
        boolean localConfigured = bool(meta, "backup_local_configured", false);
        boolean externalConfigured = backupExternal != null && bool(backupExternal, "configured", false)
                || bool(meta, "backup_external_configured", false);
        boolean suppressLocal = bool(meta, "backup_suppress_local_missing", true);
        BackupStatusResolver.Resolved resolved = BackupStatusResolver.resolve(
                backup, backupExternal, localConfigured, externalConfigured, suppressLocal);

        if ((meta.has("backup_local_configured") || meta.has("backup_external_configured"))
                && resolved.mode() == BackupStatusResolver.Mode.NONE) {
            ctx.addIssue("BACKUP_NOT_CONFIGURED",
                    "No backup folder or external heartbeat configured.",
                    "warning", null, false);
        }
        if (backup != null && "not_found".equals(str(backup, "status")) && !resolved.suppressLocalNotFound()) {
            ctx.addIssue("BACKUP_NOT_FOUND",
                    "No backup archive found in the lookback window.",
                    "warning", null, false);
        }
        if (backupExternal != null && bool(backupExternal, "configured", false)) {
            String extStatus = str(backupExternal, "status");
            if ("missing".equals(extStatus) && resolved.mode() == BackupStatusResolver.Mode.EXTERNAL_ONLY) {
                ctx.addIssue("BACKUP_NOT_FOUND",
                        "No external backup heartbeat received yet.",
                        "warning", null, false);
            } else if ("failed".equals(extStatus)) {
                ctx.addIssue("BACKUP_NOT_FOUND",
                        strOr(backupExternal, "detail", "External backup reported failure."),
                        "warning", null, false);
            } else if (bool(backupExternal, "stale", false) || "stale".equals(extStatus)) {
                Double age = dbl(backupExternal, "age_days");
                String ageStr = age != null ? String.format(Locale.US, "%.1f", age) : "?";
                int warnDays = integer(backup, "warn_days", 7);
                ctx.addIssue("BACKUP_STALE",
                        String.format("External backup is %s days old (warn > %d days)%s",
                                ageStr, warnDays,
                                str(backupExternal, "source") != null ? ": " + str(backupExternal, "source") : ""),
                        "warning", null, false);
            }
        }
        if (backup != null && bool(backup, "stale", false)) {
            String age = str(backup, "age_days");
            if (age == null) {
                age = "?";
            }
            int warnDays = integer(backup, "warn_days", 7);
            ctx.addIssue("BACKUP_STALE",
                    String.format("Newest backup is %s days old (warn > %d days): %s",
                            age, warnDays, strOr(backup, "path", "?")),
                    "warning", null, false);
        }

        JsonObject dh = optional != null ? obj(optional, "dh_pregen") : null;
        if (dh != null && javaRunning) {
            double hoursSince = dbl(dh, "hours_since_last") != null ? dbl(dh, "hours_since_last") : 0.0;
            boolean paused = bool(dh, "pregen_paused", false);
            JsonObject lastDh = obj(dh, "last");
            Instant lastPregen = lastDh != null ? TimeParse.parseTime(str(lastDh, "time")) : null;
            boolean postRestartPause = false;
            if (paused && serverStarted != null && lastPregen != null) {
                postRestartPause = !lastPregen.isAfter(serverStarted)
                        || Duration.between(lastPregen, serverStarted).getSeconds() < 600;
            }
            if ((hoursSince > 1 || paused) && !bool(dh, "pregen_active", false) && !postRestartPause) {
                JsonObject last = obj(dh, "last");
                JsonArray ev = null;
                if (last != null && str(last, "quote") != null) {
                    ev = new JsonArray();
                    JsonObject evEntry = new JsonObject();
                    evEntry.addProperty("file", strOr(last, "file", "logs/latest.log"));
                    if (last.has("line") && !last.get("line").isJsonNull()) {
                        evEntry.add("line", last.get("line"));
                    }
                    evEntry.addProperty("quote", str(last, "quote"));
                    if (str(last, "time") != null) {
                        evEntry.addProperty("time", str(last, "time"));
                    }
                    ev.add(evEntry);
                }
                ctx.addIssue("DH_PREGEN_STALL",
                        String.format(Locale.US,
                                "DH pregen last logged %.1fh ago — may be paused or stalled.", hoursSince),
                        "warning", ev, false);
            }
        }

        Double hostCpuNow = dbl(system, "host_cpu_pct_now");
        double worstLag = dbl(mc, "worst_tick_lag_ms") != null ? dbl(mc, "worst_tick_lag_ms") : 0.0;
        double cpuThrottle = dbl(thresholds, "cpu_throttle_pct") != null
                ? dbl(thresholds, "cpu_throttle_pct") : 95.0;
        double lagThrottle = dbl(thresholds, "tick_lag_throttle_ms") != null
                ? dbl(thresholds, "tick_lag_throttle_ms") : 5000.0;
        if (dh != null && bool(dh, "pregen_active", false) && javaRunning) {
            boolean cpuHigh = hostCpuNow != null && hostCpuNow > cpuThrottle;
            boolean lagHigh = worstLag > lagThrottle;
            if (cpuHigh || lagHigh) {
                List<String> reason = new ArrayList<>();
                if (cpuHigh) {
                    reason.add(String.format(Locale.US, "CPU %.0f%%", hostCpuNow));
                }
                if (lagHigh) {
                    reason.add(String.format(Locale.US, "tick lag %.0fms", worstLag));
                }
                ctx.addIssue("DH_PREGEN_THROTTLE",
                        "DH pregen active during high load (" + String.join(", ", reason)
                                + ") — consider throttling.",
                        "warning", null, false);
            }
        }

        JsonObject chunky = optional != null ? obj(optional, "chunky_pregen") : null;
        if (chunky != null && javaRunning) {
            double stallMinutes = dbl(thresholds, "chunky_stall_minutes") != null
                    ? dbl(thresholds, "chunky_stall_minutes") : 10.0;
            double degradedCps = dbl(thresholds, "chunky_degraded_cps") != null
                    ? dbl(thresholds, "chunky_degraded_cps") : 5.0;
            int failThreshold = integer(thresholds, "chunk_gen_fail_threshold", 3);
            double hoursSinceChunky = dbl(chunky, "hours_since_last") != null ? dbl(chunky, "hours_since_last") : 0.0;
            boolean chunkyPaused = bool(chunky, "pregen_paused", false);
            boolean chunkyActive = bool(chunky, "pregen_active", false);
            JsonObject lastChunky = obj(chunky, "last");
            double minutesSince = hoursSinceChunky * 60.0;
            if (chunkyActive && minutesSince > stallMinutes) {
                ctx.addIssue("CHUNKY_PREGEN_STALL",
                        String.format(Locale.US,
                                "Chunky pregen has not logged progress for %.0f minutes.", minutesSince),
                        "warning", chunkyEvidence(lastChunky), false);
            } else if (!chunkyActive && (minutesSince > stallMinutes || chunkyPaused) && lastChunky != null) {
                ctx.addIssue("CHUNKY_PREGEN_STALL",
                        String.format(Locale.US,
                                "Chunky pregen last logged %.1fh ago — may be paused or stalled.", hoursSinceChunky),
                        "warning", chunkyEvidence(lastChunky), false);
            } else if (chunkyActive && lastChunky != null) {
                Double rate = dbl(lastChunky, "rate");
                if (rate == null) {
                    rate = dbl(lastChunky, "cps");
                }
                Double avg = dbl(chunky, "cps_avg");
                if (rate != null && rate < degradedCps) {
                    ctx.addIssue("CHUNKY_PREGEN_DEGRADED",
                            String.format(Locale.US,
                                    "Chunky rate %.1f cps is below %.1f cps floor.", rate, degradedCps),
                            "warning", chunkyEvidence(lastChunky), false);
                } else if (rate != null && avg != null && avg > 0 && rate < avg * 0.5) {
                    ctx.addIssue("CHUNKY_PREGEN_DEGRADED",
                            String.format(Locale.US,
                                    "Chunky rate %.1f cps is below 50%% of recent average (%.1f cps).",
                                    rate, avg),
                            "warning", chunkyEvidence(lastChunky), false);
                }
                if (cpuHigh(hostCpuNow, cpuThrottle) || lagHigh(worstLag, lagThrottle)) {
                    List<String> reason = new ArrayList<>();
                    if (cpuHigh(hostCpuNow, cpuThrottle)) {
                        reason.add(String.format(Locale.US, "CPU %.0f%%", hostCpuNow));
                    }
                    if (lagHigh(worstLag, lagThrottle)) {
                        reason.add(String.format(Locale.US, "tick lag %.0fms", worstLag));
                    }
                    ctx.addIssue("CHUNKY_PREGEN_THROTTLE",
                            "Chunky pregen active during high load (" + String.join(", ", reason)
                                    + ") — consider pausing.",
                            "warning", null, false);
                }
            }
            int fails = integer(chunky, "chunk_gen_failures", 0);
            if (chunkyActive && fails >= failThreshold) {
                ctx.addIssue("CHUNK_GEN_DURING_PREGEN",
                        String.format(Locale.US,
                                "%d chunk generation failures logged during Chunky pregen.", fails),
                        "critical", null, false);
            }
        }

        String currentStatus = BriefFormatters.computeCurrentStatus(issues, javaRunning);
        if (javaRunning && "ok".equals(currentStatus)) {
            boolean anyActive = false;
            for (JsonElement el : issues) {
                if (!bool(el.getAsJsonObject(), "historical", false)) {
                    anyActive = true;
                    break;
                }
            }
            if (!anyActive) {
                boolean anyHistorical = false;
                for (JsonElement el : issues) {
                    if (bool(el.getAsJsonObject(), "historical", false)) {
                        anyHistorical = true;
                        break;
                    }
                }
                if (!anyHistorical) {
                    overallStatus[0] = "ok";
                }
            }
        }

        String statusNote = BriefFormatters.buildStatusNote(overallStatus[0], currentStatus, issues);

        JsonObject health = new JsonObject();
        health.addProperty("status", overallStatus[0]);
        health.addProperty("current_status", currentStatus);
        health.addProperty("status_note", statusNote);
        health.addProperty("java_running", javaRunning);
        health.addProperty("panel_running", panelRunning);
        if (lastLogTime != null) {
            health.addProperty("last_log_time", lastLogTime);
        }
        if (logGap != null) {
            health.addProperty("log_gap_minutes", logGap);
        }

        JsonObject facts = new JsonObject();
        facts.add("meta", meta);
        facts.add("health", health);
        facts.add("system", system);
        facts.add("events", events);
        facts.add("minecraft", mc);
        if (optional != null) {
            facts.add("optional", optional);
        } else {
            facts.add("optional", new JsonObject());
        }
        facts.add("issues", issues);
        facts.add("thresholds", thresholds);
        return facts;
    }

    private static void addCrashSummaries(JsonObject optional, JsonArray crashReports, Instant serverStarted,
                                          Set<String> ackedCrashes, JsonObject meta, JsonArray events) {
        if (crashReports == null || crashReports.isEmpty()) {
            return;
        }
        String serverDir = str(meta, "server_dir");
        Path logPath = serverDir != null ? Path.of(serverDir, "logs", "latest.log") : null;
        JsonArray summaries = new JsonArray();
        for (JsonElement el : crashReports) {
            JsonObject c = el.getAsJsonObject();
            JsonObject row = new JsonObject();
            row.addProperty("file", strOr(c, "file", "?"));
            if (str(c, "time") != null) {
                row.addProperty("time", str(c, "time"));
            }
            row.addProperty("summary", strOr(c, "summary", ""));
            String displayLabel = crashDisplayLabel(c);
            if (!displayLabel.isBlank()) {
                row.addProperty("display_label", displayLabel);
            }
            if (str(c, "mod_file") != null) {
                row.addProperty("mod_file", str(c, "mod_file"));
            }
            if (str(c, "exception") != null) {
                row.addProperty("exception", str(c, "exception"));
            }
            boolean historical = false;
            if (serverStarted != null) {
                Instant ct = TimeParse.parseTime(str(c, "time"));
                historical = ct != null && ct.isBefore(serverStarted);
            }
            row.addProperty("historical", historical);
            if (isCrashAcked(c, ackedCrashes)) {
                row.addProperty("acknowledged", true);
            }
            CrashClassifier.Classification classification = CrashClassifier.classify(c);
            row.addProperty("category", classification.category());
            if (classification.suspectModId() != null) {
                row.addProperty("suspect_mod_id", classification.suspectModId());
            }
            JsonArray mods = optional.has("mods") ? optional.getAsJsonArray("mods") : new JsonArray();
            CrashNarrator.Narrative narrative = CrashNarrator.narrate(c, mods);
            CrashNarrator.enrichSummary(row, narrative);
            long crashEpoch = crashEpochSec(c, serverDir);
            if (crashEpoch > 0 && logPath != null) {
                row.add("pre_crash", PreCrashContextBuilder.build(
                        crashEpoch, 10, null, logPath, optional, events));
            }
            summaries.add(row);
        }
        optional.add("crash_summaries", summaries);
    }

    private static long crashEpochSec(JsonObject c, String serverDir) {
        Instant ct = TimeParse.parseTime(str(c, "time"));
        if (ct != null) {
            return ct.getEpochSecond();
        }
        String file = str(c, "file");
        if (file == null || file.isBlank() || serverDir == null) {
            return 0;
        }
        try {
            return Files.getLastModifiedTime(Path.of(serverDir, "crash-reports", file)).toInstant().getEpochSecond();
        } catch (Exception e) {
            return 0;
        }
    }

    private static void enrichCrashModLinks(JsonObject optional, JsonArray modRecs) {
        if (!optional.has("crash_summaries")) {
            return;
        }
        JsonArray summaries = optional.getAsJsonArray("crash_summaries");
        for (JsonElement el : summaries) {
            JsonObject row = el.getAsJsonObject();
            String suspect = str(row, "suspect_mod_id");
            if (suspect == null) {
                suspect = str(row, "mod_file");
                if (suspect != null) {
                    suspect = suspect.replace(".jar", "").split("-")[0].toLowerCase(Locale.ROOT);
                }
            }
            JsonObject rec = findModRec(modRecs, suspect, row);
            if (rec == null) {
                continue;
            }
            row.addProperty("linked_mod_id", str(rec, "mod_id"));
            JsonObject fix = new JsonObject();
            copyIfPresent(rec, fix, "action");
            copyIfPresent(rec, fix, "action_detail");
            copyIfPresent(rec, fix, "fix");
            copyIfPresent(rec, fix, "install_hint");
            copyIfPresent(rec, fix, "why");
            if (rec.has("related_mods")) {
                fix.add("related_mods", rec.getAsJsonArray("related_mods").deepCopy());
            }
            row.add("mod_fix", fix);
        }
    }

    private static JsonObject findModRec(JsonArray modRecs, String suspect, JsonObject crash) {
        if (suspect != null) {
            for (JsonElement el : modRecs) {
                JsonObject rec = el.getAsJsonObject();
                if (suspect.equalsIgnoreCase(str(rec, "mod_id"))) {
                    return rec;
                }
            }
        }
        String category = str(crash, "category");
        if (!"mod".equals(category) && !"loader".equals(category)) {
            return null;
        }
        for (JsonElement el : modRecs) {
            JsonObject rec = el.getAsJsonObject();
            String cat = str(rec, "category");
            if ("mod_load_failed".equals(cat) || "recipe_compat".equals(cat) || "registry_missing".equals(cat)) {
                return rec;
            }
        }
        return null;
    }

    private static void copyIfPresent(JsonObject from, JsonObject to, String key) {
        if (from.has(key) && !from.get(key).isJsonNull()) {
            to.add(key, from.get(key));
        }
    }

    private static void addModUpdateConflictIssue(IssueContext ctx, JsonArray modRecs) {
        List<JsonObject> conflicts = new ArrayList<>();
        for (JsonElement el : modRecs) {
            JsonObject rec = el.getAsJsonObject();
            String cat = str(rec, "category");
            if ("recipe_compat".equals(cat) || "mod_load_failed".equals(cat) || "registry_missing".equals(cat)
                    || rec.has("action")) {
                conflicts.add(rec);
            }
        }
        if (conflicts.isEmpty()) {
            return;
        }
        String message;
        if (conflicts.size() == 1) {
            JsonObject rec = conflicts.get(0);
            message = rec.has("action_detail")
                    ? str(rec, "action_detail")
                    : strOr(rec, "fix", "Mod version or compat conflict detected.");
        } else {
            message = conflicts.size() + " mod update or compat conflicts — see Mods tab for actions.";
        }
        ctx.addIssue("MOD_UPDATE_CONFLICT", message, "warning", null, false);
    }

    private static String crashDisplayLabel(JsonObject c) {
        return CrashDetails.formatLabel(str(c, "exception"), str(c, "mod_file"), str(c, "summary"));
    }

    private static Set<String> acknowledgedCrashFiles(JsonObject optional) {
        Set<String> out = new HashSet<>();
        if (optional == null || !optional.has("acknowledged_crashes")) {
            return out;
        }
        JsonObject acks = optional.getAsJsonObject("acknowledged_crashes");
        for (String key : acks.keySet()) {
            String bare = bareCrashKey(key);
            out.add(bare);
            out.add("crash-reports/" + bare);
            if (!key.equals(bare)) {
                out.add(key);
            }
        }
        return out;
    }

    private static String bareCrashKey(String key) {
        if (key != null && key.startsWith("crash-reports/")) {
            return key.substring("crash-reports/".length());
        }
        return key;
    }

    private static boolean isCrashAcked(JsonObject c, Set<String> ackedCrashes) {
        if (ackedCrashes == null || ackedCrashes.isEmpty()) {
            return false;
        }
        String file = strOr(c, "file", "");
        return ackedCrashes.contains(file)
                || ackedCrashes.contains("crash-reports/" + file);
    }

    private static final class IssueContext {
        private final JsonArray issues;
        private final Set<String> seenIds;
        private final String[] overallStatus;

        private IssueContext(JsonArray issues, Set<String> seenIds, String[] overallStatus) {
            this.issues = issues;
            this.seenIds = seenIds;
            this.overallStatus = overallStatus;
        }

        private void addRebootIssue(JsonObject rebootEvent) {
            if (seenIds.contains("MANUAL_REBOOT")) {
                return;
            }
            seenIds.add("MANUAL_REBOOT");
            String bootTime = strOr(rebootEvent, "time", "");
            String detail = strOr(rebootEvent, "detail", "");
            String source = strOr(rebootEvent, "source", "");
            String message = buildRebootIssueMessage(bootTime, detail);
            JsonArray ev = new JsonArray();
            JsonObject evEntry = new JsonObject();
            evEntry.addProperty("file", "journalctl");
            evEntry.add("line", null);
            evEntry.addProperty("quote", detail);
            if (!bootTime.isEmpty()) {
                evEntry.addProperty("time", bootTime);
            }
            ev.add(evEntry);
            JsonObject entry = new JsonObject();
            entry.addProperty("id", "MANUAL_REBOOT");
            entry.addProperty("message", message);
            entry.addProperty("severity", "warning");
            entry.addProperty("historical", true);
            entry.add("evidence", ev);
            if (!bootTime.isEmpty()) {
                entry.addProperty("event_time", bootTime);
            }
            if (!source.isEmpty()) {
                entry.addProperty("event_source", source);
            }
            issues.add(entry);
            if ("ok".equals(overallStatus[0])) {
                overallStatus[0] = "warning";
            }
        }

        private void addIssue(String id, String message, String severity, JsonArray evidence, boolean historical) {
            if (seenIds.contains(id)) {
                return;
            }
            seenIds.add(id);
            JsonObject entry = new JsonObject();
            entry.addProperty("id", id);
            entry.addProperty("message", message);
            entry.addProperty("severity", severity);
            entry.addProperty("historical", historical);
            if (evidence != null && !evidence.isEmpty()) {
                entry.add("evidence", evidence);
            }
            issues.add(entry);
            if (!historical) {
                if ("critical".equals(severity)) {
                    overallStatus[0] = "critical";
                } else if ("warning".equals(severity) && "ok".equals(overallStatus[0])) {
                    overallStatus[0] = "warning";
                }
            } else {
                if ("critical".equals(severity) && "ok".equals(overallStatus[0])) {
                    overallStatus[0] = "critical";
                } else if ("warning".equals(severity) && "ok".equals(overallStatus[0])) {
                    overallStatus[0] = "warning";
                }
            }
        }
    }

    private static String buildRebootIssueMessage(String bootTime, String detail) {
        if (bootTime != null && !bootTime.isEmpty()) {
            StringBuilder sb = new StringBuilder("Machine rebooted at ").append(bootTime);
            if (detail != null && !detail.isEmpty()) {
                sb.append(" — ").append(detail);
            }
            return sb.toString();
        }
        if (detail != null && !detail.isEmpty()) {
            return "System reboot recorded during lookback window — " + detail;
        }
        return "System reboot recorded during lookback window.";
    }

    private static List<JsonObject> filterEvents(JsonArray events, String type, boolean requireVerified) {
        List<JsonObject> out = new ArrayList<>();
        if (events == null) {
            return out;
        }
        for (JsonElement el : events) {
            JsonObject e = el.getAsJsonObject();
            if (type.equals(str(e, "type"))) {
                if (!requireVerified || bool(e, "verified", false)) {
                    out.add(e);
                }
            }
        }
        return out;
    }

    private static void appendAll(JsonArray target, JsonArray source) {
        if (source == null) {
            return;
        }
        for (JsonElement el : source) {
            target.add(el.deepCopy());
        }
    }

    private static JsonObject copyOrEmpty(JsonObject parent, String key) {
        JsonObject o = obj(parent, key);
        return o != null ? o : new JsonObject();
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

    private static boolean cpuHigh(Double hostCpuNow, double cpuThrottle) {
        return hostCpuNow != null && hostCpuNow > cpuThrottle;
    }

    private static boolean lagHigh(double worstLag, double lagThrottle) {
        return worstLag > lagThrottle;
    }

    private static JsonArray chunkyEvidence(JsonObject lastChunky) {
        if (lastChunky == null) {
            return null;
        }
        JsonArray ev = new JsonArray();
        JsonObject evEntry = new JsonObject();
        evEntry.addProperty("file", strOr(lastChunky, "file", "logs/latest.log"));
        if (lastChunky.has("line") && !lastChunky.get("line").isJsonNull()) {
            evEntry.add("line", lastChunky.get("line"));
        }
        if (str(lastChunky, "quote") != null) {
            evEntry.addProperty("quote", str(lastChunky, "quote"));
        }
        if (str(lastChunky, "time") != null) {
            evEntry.addProperty("time", str(lastChunky, "time"));
        }
        ev.add(evEntry);
        return ev;
    }
}
