package dev.mcstatus.watchtower.core.brief;

import com.google.gson.JsonArray;
import dev.mcstatus.watchtower.core.analyze.ModErrorCategory;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.util.TimeParse;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Pattern;

/**
 * Brief report formatting helpers ported from mc-status-analyze.py fmt_* functions.
 */
public final class BriefFormatters {

    private static final Pattern UUID_TRUNCATE = Pattern.compile(
            "([0-9a-f]{8})-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}",
            Pattern.CASE_INSENSITIVE
    );

    private static final Map<String, String> LOAD_ATTRIBUTION_LABELS = Map.of(
            "likely_pregen", "likely pregen (DH active, 0 players at worst lag)",
            "likely_gameplay", "likely gameplay (players online at worst lag)",
            "mixed", "mixed (DH pregen and players during lag)",
            "unknown", "unknown"
    );

    private BriefFormatters() {
    }

    public static String truncateServerPath(String path) {
        if (path == null || path.isEmpty() || "[not detected]".equals(path)) {
            return path;
        }
        return UUID_TRUNCATE.matcher(path).replaceAll("$1...");
    }

    public static String fmtDhEta(JsonObject entry, JsonObject dh) {
        if (entry == null) {
            return "";
        }
        String eta = str(entry, "eta");
        if (eta != null && !eta.isBlank()) {
            return eta.strip();
        }
        Double pct = dbl(entry, "pct");
        Double cps = dbl(entry, "cps");
        if (pct != null && cps != null && cps > 0) {
            double remaining = Math.max(0.0, 100.0 - pct);
            double total = dbl(entry, "total") != null ? dbl(entry, "total") : 3126.0;
            double hours = remaining / cps * total / 3600.0;
            return String.format(Locale.US, "~%.0fh (estimated)", hours);
        }
        return "";
    }

    public static String fmtBackupLine(JsonObject backup) {
        return fmtBackupLine(backup, null);
    }

    public static String fmtBackupLine(JsonObject backup, JsonObject backupExternal) {
        String external = fmtExternalBackupLine(backupExternal);
        String local = fmtLocalBackupLine(backup);
        if (external != null && local != null) {
            return local + "\n" + external;
        }
        if (external != null) {
            return external;
        }
        return local;
    }

    private static String fmtExternalBackupLine(JsonObject external) {
        if (external == null || !bool(external, "configured", false)) {
            return null;
        }
        String status = str(external, "status");
        String source = str(external, "source");
        String sourceS = source != null ? " | " + source : "";
        if ("success".equals(status) && !bool(external, "stale", false)) {
            Double size = dbl(external, "size_gb");
            String sizeS = size != null ? " (" + size + " GB)" : "";
            return "Backup (external): SUCCESS" + sizeS + " | " + TimeParse.fmtTime(str(external, "last_at")) + sourceS;
        }
        if ("running".equals(status)) {
            return "Backup (external): RUNNING" + sourceS
                    + (str(external, "detail") != null ? " | " + str(external, "detail") : "");
        }
        if ("stale".equals(status) || bool(external, "stale", false)) {
            Double age = dbl(external, "age_days");
            String ageS = age != null ? String.format(Locale.US, " (%.0fd ago)", age) : "";
            return "Backup (external): STALE" + ageS + sourceS;
        }
        if ("missing".equals(status)) {
            return "Backup (external): NOT FOUND — no heartbeat file or webhook yet";
        }
        if ("failed".equals(status)) {
            return "Backup (external): FAILED | " + strOr(external, "detail", "?");
        }
        return null;
    }

    private static String fmtLocalBackupLine(JsonObject backup) {
        if (backup == null) {
            return null;
        }
        String status = str(backup, "status");
        if ("success".equals(status)) {
            Double size = dbl(backup, "size_gb");
            String sizeS = size != null ? " (" + size + " GB)" : "";
            return "Backup: SUCCESS" + sizeS + " | " + TimeParse.fmtTime(str(backup, "time"));
        }
        if ("not_found".equals(status)) {
            String newest = str(backup, "newest_on_disk");
            if (newest != null) {
                Double size = dbl(backup, "newest_size_gb");
                String sizeS = size != null ? " (" + size + " GB)" : "";
                return "Backup: NOT FOUND in 24h window (newest on disk: "
                        + TimeParse.fmtTime(newest) + sizeS + ")";
            }
            String reason = str(backup, "reason");
            String dir = strOr(backup, "dir", "?");
            String reasonText = switch (reason != null ? reason : "") {
                case "empty" -> "empty";
                case "no_suffix_match" -> "no matching archive suffix";
                case "no_server_match" -> "no backup matching this server";
                default -> "no backup in window";
            };
            Integer seen = integer(backup, "files_seen");
            String seenS = seen != null ? " (" + seen + " file(s) scanned)" : "";
            return "Backup: NOT FOUND in 24h window — searched: " + dir + " (" + reasonText + ")" + seenS;
        }
        if ("unconfigured".equals(status)) {
            return "Backup: unconfigured — choose a folder in the dashboard Backups tab or set BACKUP_DIR in watchtower/watchtower.conf";
        }
        if ("stale".equals(status) || bool(backup, "stale", false)) {
            Double age = dbl(backup, "age_days");
            String ageS = age != null ? String.format(Locale.US, " (%.0fd ago)", age) : "";
            Double size = dbl(backup, "newest_size_gb");
            if (size == null) {
                size = dbl(backup, "size_gb");
            }
            String sizeS = size != null ? " (" + size + " GB)" : "";
            return "Backup: STALE" + ageS + sizeS + " | " + strOr(backup, "path", "?");
        }
        return null;
    }

    public static List<String> fmtCpuLines(JsonObject system) {
        List<String> lines = new ArrayList<>();
        Double hostNow = dbl(system, "host_cpu_pct_now");
        Double hostAvg = dbl(system, "host_cpu_pct_avg");
        String hostSrc = strOr(system, "host_cpu_avg_source", "unavailable");
        Integer sampleCount = integer(system, "host_cpu_sample_count");

        List<String> hostParts = new ArrayList<>();
        if (hostNow != null) {
            hostParts.add(String.format(Locale.US, "%.0f%% now", hostNow));
        }
        if (hostAvg != null) {
            if ("sar".equals(hostSrc)) {
                hostParts.add(String.format(Locale.US, "%.0f%% avg over lookback (sysstat)", hostAvg));
            } else if ("state_samples".equals(hostSrc) && sampleCount != null) {
                hostParts.add(String.format(Locale.US, "%.0f%% avg over %d report samples", hostAvg, sampleCount));
            } else {
                hostParts.add(String.format(Locale.US, "%.0f%% avg", hostAvg));
            }
        }
        if (!hostParts.isEmpty()) {
            lines.add("  Host utilization: " + String.join(" | ", hostParts));
        } else if ("unavailable".equals(hostSrc)) {
            lines.add("  Host utilization: unavailable (install sysstat or run reports on a schedule)");
        }

        Double javaCores = dbl(system, "java_cpu_cores_equiv");
        Double javaPct = dbl(system, "java_cpu_pct_avg");
        Double javaMachine = dbl(system, "java_cpu_pct_of_machine");
        Integer cores = integer(system, "cpu_count");
        if (javaCores != null && javaPct != null) {
            String machineS = "";
            if (javaMachine != null && cores != null) {
                machineS = String.format(Locale.US, "; %.0f%% of %d cores", javaMachine, cores);
            }
            lines.add(String.format(Locale.US,
                    "  Java: ~%.1f cores avg since session start (%.0f%% of one CPU%s)",
                    javaCores, javaPct, machineS));
        }

        JsonArray load = array(system, "load_avg");
        if (load != null && load.size() >= 3) {
            Integer coreCount = cores;
            Double perCore = dbl(system, "load_1m_per_core");
            String coreS = coreCount != null ? " on " + coreCount + " cores" : "";
            String perCoreS = perCore != null
                    ? String.format(Locale.US, " — ~%.1f runnable jobs/core", perCore) : "";
            lines.add(String.format(Locale.US,
                    "  Load (queue depth, not %%): %.2f, %.2f, %.2f%s%s",
                    load.get(0).getAsDouble(), load.get(1).getAsDouble(), load.get(2).getAsDouble(),
                    coreS, perCoreS));
            lines.add("  (Load counts waiting processes; utilization is % of CPU time spent working.)");
        }
        return lines;
    }

    public static String fmtTickHealth(Double mspt) {
        if (mspt == null) {
            return "unknown";
        }
        if (mspt <= 50) {
            return "OK (<50 ms)";
        }
        if (mspt <= 100) {
            return "DEGRADED (>50 ms)";
        }
        return "CRITICAL (>100 ms)";
    }

    public static List<String> fmtIngamePerformance(JsonObject mc, JsonObject optional) {
        JsonObject tpsData = obj(mc, "tps");
        if (tpsData == null) {
            return List.of();
        }
        JsonObject ow = obj(tpsData, "overworld");
        if (ow == null) {
            ow = new JsonObject();
        }
        Double tpsVal = dbl(ow, "tps");
        Double msptVal = dbl(ow, "mspt");
        Double peak = dbl(tpsData, "peak_mspt_24h");
        String peakSrc = str(tpsData, "peak_mspt_24h_source");
        if (peakSrc == null) {
            peakSrc = str(tpsData, "source");
        }
        String source = strOr(tpsData, "source", "unknown");

        List<String> lines = new ArrayList<>();
        List<String> parts = new ArrayList<>();
        if (tpsVal != null) {
            parts.add(String.format(Locale.US, "TPS (overworld): %.2f", tpsVal));
        }
        if (msptVal != null) {
            parts.add(String.format(Locale.US, "MSPT: %.0f ms now", msptVal));
        }
        if (peak != null) {
            String srcNote = peakSrc != null && !peakSrc.isEmpty() ? " (" + peakSrc + ")" : "";
            parts.add(String.format(Locale.US, "24h peak MSPT: %.0f ms%s", peak, srcNote));
        }
        if (!parts.isEmpty()) {
            lines.add("  " + String.join("  |  ", parts));
        }
        if (msptVal != null) {
            lines.add("  Tick health: " + fmtTickHealth(msptVal));
        }
        lines.add("  Source: " + source);

        JsonObject nativeObj = obj(optional != null ? optional : new JsonObject(), "watchtower_native");
        if (nativeObj != null) {
            JsonObject session = obj(nativeObj, "session_mspt");
            if (session != null && dbl(session, "max") != null) {
                double min = dbl(session, "min") != null ? dbl(session, "min") : 0.0;
                double max = dbl(session, "max");
                double p95 = dbl(session, "p95") != null ? dbl(session, "p95") : max;
                lines.add(String.format(Locale.US,
                        "  Session MSPT: min %.0f ms | max %.0f ms | p95 %.0f ms", min, max, p95));
            }
            JsonObject heap = obj(nativeObj, "heap_mb");
            if (heap != null && dbl(heap, "used") != null && dbl(heap, "max") != null) {
                lines.add(String.format(Locale.US,
                        "  Java heap: %.0f MB used / %.0f MB max",
                        dbl(heap, "used"), dbl(heap, "max")));
            }
            JsonArray dims = array(nativeObj, "dimensions");
            if (dims != null) {
                for (JsonElement el : dims) {
                    if (!el.isJsonObject()) {
                        continue;
                    }
                    JsonObject dim = el.getAsJsonObject();
                    String dimId = strOr(dim, "id", "");
                    if (dimId.isEmpty() || "minecraft:overworld".equals(dimId)) {
                        continue;
                    }
                    String shortName = dimId.contains(":") ? dimId.substring(dimId.indexOf(':') + 1) : dimId;
                    lines.add(String.format(Locale.US,
                            "  %s: MSPT %.0f ms | entities %s | chunks %s",
                            shortName,
                            dbl(dim, "mspt") != null ? dbl(dim, "mspt") : 0.0,
                            strOr(dim, "entities", "?"),
                            strOr(dim, "chunks", "?")));
                }
            }
            JsonArray players = array(nativeObj, "players");
            if (players != null && !players.isEmpty()) {
                List<String> plParts = new ArrayList<>();
                int limit = Math.min(5, players.size());
                for (int i = 0; i < limit; i++) {
                    JsonObject p = players.get(i).getAsJsonObject();
                    plParts.add(strOr(p, "name", "?") + " (" + strOr(p, "ping", "?") + " ms)");
                }
                String extra = players.size() > 5 ? " +" + (players.size() - 5) + " more" : "";
                lines.add("  Online: " + String.join(", ", plParts) + extra);
            }
        }
        return lines;
    }

    public static String fmtTrendMaturityLine(JsonObject stateMeta) {
        if (stateMeta == null) {
            return null;
        }
        int cpuN = integer(stateMeta, "cpu_sample_count", 0);
        int tpsN = integer(stateMeta, "tps_sample_count", 0);
        if (cpuN >= 3 && tpsN >= 10) {
            return null;
        }
        return String.format(
                "  Trends: warming up (%d TPS / %d CPU samples — run again or /watchtower schedule set 60)",
                tpsN, cpuN);
    }

    public static String fmtLogErrorsGlance(JsonObject mc) {
        JsonObject logErrors = obj(mc, "log_errors");
        if (logErrors == null) {
            return null;
        }
        JsonArray top = array(logErrors, "top");
        if (top == null || top.isEmpty()) {
            return null;
        }
        List<String> bits = new ArrayList<>();
        int limit = Math.min(3, top.size());
        for (int i = 0; i < limit; i++) {
            JsonObject e = top.get(i).getAsJsonObject();
            String msg = strOr(e, "message", "?");
            if (msg.length() > 50) {
                msg = msg.substring(0, 50);
            }
            bits.add(msg + " (" + integer(e, "count", 0) + "x)");
        }
        return "  Log errors: " + String.join(" | ", bits);
    }

    public static String fmtLoadAttributionLine(JsonObject optional) {
        if (optional == null) {
            return null;
        }
        JsonObject la = obj(optional, "load_attribution");
        if (la == null) {
            return null;
        }
        String verdict = strOr(la, "verdict", "unknown");
        Boolean dhOn = boolObj(la, "dh_pregen_active");
        Integer atLag = integer(la, "concurrent_at_worst_lag");
        String detail = LOAD_ATTRIBUTION_LABELS.getOrDefault(verdict, verdict);
        if ("likely_pregen".equals(verdict) && Boolean.FALSE.equals(dhOn)) {
            detail = "likely background load (no players at worst lag)";
        }
        if (atLag != null && !LOAD_ATTRIBUTION_LABELS.containsKey(verdict)) {
            detail = verdict + " (" + atLag + " players at worst lag)";
        }
        return "  Load attribution: " + detail;
    }

    public static String fmtStorageLine(JsonObject optional) {
        if (optional == null) {
            return null;
        }
        JsonObject storage = obj(optional, "storage");
        if (storage == null) {
            return null;
        }
        Double worldGb = dbl(storage, "world_gb");
        if (worldGb == null) {
            return null;
        }
        List<String> parts = new ArrayList<>();
        parts.add(String.format(Locale.US, "World size: %.0f GB", worldGb));
        Double sinceLast = dbl(storage, "delta_mb_since_last");
        if (sinceLast != null) {
            parts.add((sinceLast >= 0 ? "+" : "") + String.format(Locale.US, "%.0f MB since last report", sinceLast));
        }
        Double delta24h = dbl(storage, "delta_mb_24h");
        if (delta24h != null) {
            parts.add((delta24h >= 0 ? "+" : "") + String.format(Locale.US, "%.0f MB 24h est.", delta24h));
        }
        Double logsMb = dbl(storage, "logs_mb");
        if (logsMb != null) {
            parts.add(String.format(Locale.US, "logs %.0f MB", logsMb));
        }
        return "  " + String.join(" / ", parts);
    }

    public static String fmtDiskIoLine(JsonObject optional) {
        if (optional == null) {
            return null;
        }
        JsonObject dio = obj(optional, "disk_io");
        if (dio == null) {
            return null;
        }
        String device = strOr(dio, "device", "?");
        Double util = dbl(dio, "util_pct");
        Double awaitMs = dbl(dio, "await_ms");
        if (util != null && awaitMs != null) {
            return String.format(Locale.US, "  Disk I/O: %.0f%% util, %.0f ms await (%s)", util, awaitMs, device);
        }
        Double tps = dbl(dio, "tps");
        if (tps != null) {
            return String.format(Locale.US, "  Disk I/O: %.0f tps (%s, sar)", tps, device);
        }
        return null;
    }

    public static String fmtLogErrorsLine(JsonObject mc) {
        JsonObject le = obj(mc, "log_errors");
        if (le == null) {
            return null;
        }
        int err = integer(le, "error", 0);
        int fatal = integer(le, "fatal", 0);
        if (err == 0 && fatal == 0) {
            return null;
        }
        JsonArray top = array(le, "top");
        String topS = "";
        if (top != null && !top.isEmpty()) {
            JsonObject t0 = top.get(0).getAsJsonObject();
            String msg = strOr(t0, "message", "");
            if (msg.length() > 60) {
                msg = msg.substring(0, 60);
            }
            topS = String.format(" (top: %s x%d)", msg, integer(t0, "count", 0));
        }
        return String.format("  Log errors: %d ERROR, %d FATAL in window%s", err, fatal, topS);
    }

    public static String fmtSecurityLine(JsonObject optional) {
        if (optional == null) {
            return null;
        }
        JsonObject sec = obj(optional, "security");
        if (sec == null) {
            return null;
        }
        return String.format(
                "  Failed logins: SSH %d  |  Crafty %d  |  MC %d (window)"
                        + "  |  Unique IPs: %d (%d private, %d public)",
                integer(sec, "failed_ssh", 0),
                integer(sec, "failed_crafty", 0),
                integer(sec, "failed_mc", 0),
                integer(sec, "unique_ip_count", 0),
                integer(sec, "private_ip_count", 0),
                integer(sec, "public_ip_count", 0));
    }

    public static String fmtBandwidthLine(JsonObject optional) {
        if (optional == null) {
            return null;
        }
        JsonObject bw = obj(optional, "bandwidth");
        if (bw == null) {
            return null;
        }
        List<String> parts = new ArrayList<>();
        parts.add("Interface: " + strOr(bw, "interface", "?"));
        Double rx = dbl(bw, "rx_mb_since_last");
        Double tx = dbl(bw, "tx_mb_since_last");
        if (rx != null && tx != null) {
            parts.add(String.format(Locale.US, "Rx %.0f MB / Tx %.0f MB since last run", rx, tx));
        }
        return "  " + String.join("  |  ", parts);
    }

    public static String fmtDhPct(JsonObject entry) {
        if (entry == null) {
            return "";
        }
        Double pct = dbl(entry, "pct");
        if (pct == null) {
            return "";
        }
        return String.format(Locale.US, "%.3f%%", pct);
    }

    public static String fmtDhRadius(JsonObject entry) {
        if (entry == null) {
            return "?/? chunks";
        }
        return strOr(entry, "chunks", "?") + "/" + strOr(entry, "total", "?") + " chunks";
    }

    public static String fmtDhProgressSuffix(JsonObject entry) {
        String pctS = fmtDhPct(entry);
        return pctS.isEmpty() ? "" : " (" + pctS + " complete)";
    }

    public static List<String> fmtEvidenceLine(JsonObject ev) {
        List<String> out = new ArrayList<>();
        String f = strOr(ev, "file", "?");
        JsonElement lineEl = ev.get("line");
        String loc = lineEl != null && !lineEl.isJsonNull() ? f + ":" + lineEl.getAsString() : f;
        out.add("    source: " + loc);
        String quote = str(ev, "quote");
        if (quote != null) {
            quote = quote.strip();
            if (!quote.isEmpty()) {
                if (quote.length() > 240) {
                    quote = quote.substring(0, 240);
                }
                out.add("    > " + quote);
            }
        }
        return out;
    }

    public static String fmtWindowLine(JsonObject meta) {
        int lookback = integer(meta, "lookback_hours", 24);
        String windowStart = str(meta, "window_start");
        boolean incremental = bool(meta, "incremental", false);
        if (incremental && windowStart != null) {
            return "Window: incremental since " + TimeParse.fmtTime(windowStart) + " (cap " + lookback + "h)";
        }
        if (windowStart != null) {
            return "Window: full " + lookback + "h since " + TimeParse.fmtTime(windowStart);
        }
        return "Window: last " + lookback + "h";
    }

    public static int severityRank(String sev) {
        if (sev == null) {
            return 0;
        }
        return switch (sev) {
            case "critical" -> 3;
            case "warning" -> 2;
            case "info" -> 1;
            default -> 0;
        };
    }

    public static String computeCurrentStatus(JsonArray issues, boolean javaRunning) {
        List<JsonObject> active = new ArrayList<>();
        if (issues != null) {
            for (JsonElement el : issues) {
                JsonObject i = el.getAsJsonObject();
                if (!bool(i, "historical", false)) {
                    active.add(i);
                }
            }
        }
        if (active.isEmpty()) {
            return javaRunning ? "ok" : "warning";
        }
        int worst = 0;
        for (JsonObject i : active) {
            worst = Math.max(worst, severityRank(strOr(i, "severity", "warning")));
        }
        if (worst >= 3) {
            return "critical";
        }
        if (worst >= 2) {
            return "warning";
        }
        return "ok";
    }

    public static String buildStatusNote(String overall, String current, JsonArray issues) {
        if (overall.equals(current)) {
            return "";
        }
        List<JsonObject> hist = new ArrayList<>();
        if (issues != null) {
            for (JsonElement el : issues) {
                JsonObject i = el.getAsJsonObject();
                if (bool(i, "historical", false)) {
                    hist.add(i);
                }
            }
        }
        if (!hist.isEmpty() && "ok".equals(current)) {
            List<String> kinds = new ArrayList<>();
            for (JsonObject i : hist) {
                String id = strOr(i, "id", "");
                if (!kinds.contains(id)) {
                    kinds.add(id);
                }
            }
            kinds.sort(String::compareTo);
            return "Server running normally; " + overall.toUpperCase(Locale.ROOT)
                    + " from historical items (" + String.join(", ", kinds) + ").";
        }
        return "Overall " + overall + "; current session status is " + current + ".";
    }

    public static String fmtPlayersLine(JsonObject mc) {
        if (mc == null) {
            return "Players: 0 online";
        }
        int online = integer(mc, "players_online_now", 0);
        JsonArray names = array(mc, "players_online_names");
        if (online <= 0 || names == null || names.isEmpty()) {
            return "Players: 0 online";
        }
        List<String> nameList = new ArrayList<>();
        for (JsonElement el : names) {
            nameList.add(el.getAsString());
        }
        return "Players: " + online + " online (" + String.join(", ", nameList) + ")";
    }

    public static String fmtStartupNoiseLine(JsonObject optional) {
        if (optional == null || !optional.has("startup_warnings")) {
            return null;
        }
        JsonArray warnings = optional.getAsJsonArray("startup_warnings");
        if (warnings.isEmpty()) {
            return null;
        }
        List<String> labels = new ArrayList<>();
        for (JsonElement el : warnings) {
            if (!el.isJsonObject()) {
                continue;
            }
            JsonObject w = el.getAsJsonObject();
            int count = integer(w, "count", 0);
            if (count <= 0) {
                continue;
            }
            String id = strOr(w, "id", "");
            labels.add(count + " " + startupLabel(id));
            if (labels.size() >= 3) {
                break;
            }
        }
        if (labels.isEmpty()) {
            return null;
        }
        return "Startup noise: " + String.join(", ", labels)
                + " (informational; client-class lines = client code blocked on dedicated server — usually harmless)";
    }

    public static String fmtModChangesLine(JsonObject optional, int modCount) {
        if (optional == null || !optional.has("mod_changes")) {
            return null;
        }
        JsonObject changes = optional.getAsJsonObject("mod_changes");
        if (bool(changes, "baseline_refresh", false)) {
            int added = integer(changes, "added_count", 0);
            return "Mods: " + modCount + " jar(s) (mod ID baseline expanded: +" + added
                    + " tracked; see MODS section)";
        }
        JsonArray added = array(changes, "added");
        JsonArray removed = array(changes, "removed");
        if ((added == null || added.isEmpty()) && (removed == null || removed.isEmpty())) {
            return null;
        }
        List<String> parts = new ArrayList<>();
        int cap = 8;
        if (added != null) {
            for (int i = 0; i < added.size(); i++) {
                if (i >= cap) {
                    parts.add("+" + (added.size() - cap) + " more");
                    break;
                }
                parts.add("+" + added.get(i).getAsString());
            }
        }
        if (removed != null) {
            for (int i = 0; i < removed.size(); i++) {
                if (parts.size() >= cap) {
                    parts.add("-" + (removed.size() - i) + " more");
                    break;
                }
                parts.add("-" + removed.get(i).getAsString());
            }
        }
        return "Mods: " + modCount + " jar(s) (" + String.join(", ", parts) + ")";
    }

    public static String fmtCollectionWarningsNote(JsonObject meta) {
        if (meta == null || !meta.has("collection_warnings")) {
            return null;
        }
        JsonArray warnings = meta.getAsJsonArray("collection_warnings");
        if (warnings.isEmpty()) {
            return null;
        }
        return "(" + warnings.size() + " collection warning(s) — see facts.meta)";
    }

    private static String startupLabel(String id) {
        return switch (id) {
            case "recipe_parse" -> "recipe errors";
            case "registry_missing" -> "registry warnings";
            case "loot_parse" -> "loot parse errors";
            case "postprocessing_spam" -> "postprocessing warnings";
            case "client_on_server" -> "client-class warnings";
            default -> id.replace('_', ' ');
        };
    }

    public static String fmtModLogErrorsGlance(JsonObject optional) {
        if (optional == null || !optional.has("mod_log_errors")) {
            return null;
        }
        JsonArray errors = optional.getAsJsonArray("mod_log_errors");
        if (errors.isEmpty()) {
            return null;
        }
        List<String> bits = new ArrayList<>();
        int limit = Math.min(3, errors.size());
        for (int i = 0; i < limit; i++) {
            JsonObject e = errors.get(i).getAsJsonObject();
            String modId = strOr(e, "mod_id", "?");
            int total = integer(e, "total", 0);
            if ("client_noise".equals(modId)) {
                bits.add("Client-only warnings " + total + "x (usually safe)");
            } else {
                bits.add(modDisplayName(e) + " " + total + "x");
            }
        }
        return "  Mod errors: " + String.join(" | ", bits);
    }

    public static List<String> fmtModsSection(JsonObject optional, Integer jarCount) {
        List<String> lines = new ArrayList<>();
        if (optional == null || !optional.has("mods")) {
            return lines;
        }
        JsonArray mods = optional.getAsJsonArray("mods");
        if (mods.isEmpty()) {
            return lines;
        }
        lines.add("MODS");
        lines.add("-".repeat(40));
        String header = mods.size() + " mod ID(s)";
        if (jarCount != null) {
            header += " (" + jarCount + " jar(s) in mods/)";
        } else {
            header += " installed";
        }
        lines.add("  " + header + ":");
        for (JsonElement el : mods) {
            if (!el.isJsonObject()) {
                continue;
            }
            JsonObject m = el.getAsJsonObject();
            lines.add("  " + strOr(m, "id", "?") + "  " + strOr(m, "version", "?"));
        }
        lines.add("");
        return lines;
    }

    public static List<String> fmtModLogHealthSection(JsonObject optional) {
        List<String> lines = new ArrayList<>();
        if (optional == null || !optional.has("mod_log_errors")) {
            return lines;
        }
        JsonArray errors = optional.getAsJsonArray("mod_log_errors");
        if (errors.isEmpty()) {
            return lines;
        }
        lines.add("MOD LOG HEALTH");
        lines.add("-".repeat(40));
        int limit = Math.min(5, errors.size());
        for (int i = 0; i < limit; i++) {
            JsonObject e = errors.get(i).getAsJsonObject();
            String modId = modDisplayName(e);
            int total = integer(e, "total", 0);
            List<String> catBits = new ArrayList<>();
            JsonObject cats = obj(e, "by_category");
            if (cats != null) {
                for (String key : cats.keySet()) {
                    ModErrorCategory cat = categoryFromId(key);
                    String label = cat != null ? cat.briefLabel() : key.replace('_', ' ');
                    catBits.add(cats.get(key).getAsInt() + " " + label);
                }
            }
            String catPart = catBits.isEmpty() ? "" : " (" + String.join(", ", catBits) + ")";
            lines.add("  " + modId + ": " + total + catPart);
            if ("client_noise".equals(strOr(e, "mod_id", ""))) {
                lines.add("    What: " + ModErrorCategory.CLIENT_ON_SERVER_WHAT);
                lines.add("    Worry: " + ModErrorCategory.CLIENT_ON_SERVER_WORRY);
                String sample = str(e, "sample_line");
                if (sample != null && !sample.isBlank()) {
                    lines.add("    > " + sample);
                }
                lines.add("    See CLIENT-ONLY MODS ON SERVER for mods you can remove.");
            } else {
                String sample = str(e, "sample_line");
                if (sample != null && !sample.isBlank()) {
                    lines.add("    > " + sample);
                }
            }
        }
        lines.add("  See RECOMMENDED ACTIONS for fix guidance.");
        lines.add("");
        return lines;
    }

    public static boolean hasWarningModRecommendations(JsonObject optional) {
        if (optional == null || !optional.has("mod_recommendations")) {
            return false;
        }
        for (JsonElement el : optional.getAsJsonArray("mod_recommendations")) {
            if (!el.isJsonObject()) {
                continue;
            }
            String sev = strOr(el.getAsJsonObject(), "severity", "info");
            if ("warning".equals(sev) || "critical".equals(sev)) {
                return true;
            }
        }
        return false;
    }

    public static List<String> fmtModRecommendationActions(JsonObject optional, int max) {
        List<String> lines = new ArrayList<>();
        if (optional == null || !optional.has("mod_recommendations")) {
            return lines;
        }
        JsonArray recs = optional.getAsJsonArray("mod_recommendations");
        List<JsonObject> sorted = new ArrayList<>();
        for (JsonElement el : recs) {
            if (el.isJsonObject()) {
                sorted.add(el.getAsJsonObject());
            }
        }
        sorted.sort((a, b) -> Integer.compare(modRecSeverityRank(strOr(b, "severity", "info")),
                modRecSeverityRank(strOr(a, "severity", "info"))));
        int count = 0;
        for (JsonObject rec : sorted) {
            if (count >= max) {
                break;
            }
            String severity = strOr(rec, "severity", "info");
            if ("low".equals(severity) || "info".equals(severity)) {
                continue;
            }
            String fix = str(rec, "fix");
            if (fix == null || fix.isBlank()) {
                fix = str(rec, "why");
            }
            if (fix == null || fix.isBlank()) {
                continue;
            }
            String modId = modDisplayName(rec);
            int total = integer(rec, "count", 0);
            String header = formatModActionHeader(rec, modId, total);
            lines.add("  - " + header);
            lines.add("    Fix: " + fix);
            String sample = str(rec, "sample_line");
            if (sample != null && !sample.isBlank()) {
                lines.add("    > " + sample);
            }
            String hint = str(rec, "install_hint");
            if (hint != null && !hint.isBlank() && !hint.equals(fix)) {
                lines.add("    Hint: " + hint);
            }
            count++;
        }
        return lines;
    }

    public static String fmtClientClassInfoAction(JsonObject optional) {
        if (optional == null || !optional.has("mod_log_errors")) {
            return null;
        }
        for (JsonElement el : optional.getAsJsonArray("mod_log_errors")) {
            JsonObject row = el.getAsJsonObject();
            if ("client_noise".equals(strOr(row, "mod_id", ""))) {
                int total = integer(row, "total", 0);
                if (total > 0) {
                    return "  - Client-only class warnings (" + total + "x): usually safe on a healthy server. "
                            + "See CLIENT-ONLY MODS ON SERVER to reduce noise.";
                }
            }
        }
        return null;
    }

    public static List<String> fmtClientOnlyModsSection(JsonObject optional) {
        List<String> lines = new ArrayList<>();
        if (optional == null) {
            return lines;
        }
        JsonArray mods = optional.has("client_only_mods")
                ? optional.getAsJsonArray("client_only_mods") : null;
        int clientWarnings = 0;
        if (optional.has("client_only_mods_summary")) {
            clientWarnings = integer(optional.getAsJsonObject("client_only_mods_summary"),
                    "client_warning_count", 0);
        }
        if ((mods == null || mods.isEmpty()) && clientWarnings <= 0) {
            return lines;
        }
        lines.add("CLIENT-ONLY MODS ON SERVER");
        lines.add("-".repeat(40));
        if (clientWarnings > 0) {
            lines.add("  Client-class log warnings: " + clientWarnings
                    + " (usually harmless — see MOD LOG HEALTH)");
        }
        lines.add("  These mods are typically for the game client, not a dedicated server:");
        lines.add("");
        List<JsonObject> removable = new ArrayList<>();
        List<JsonObject> keep = new ArrayList<>();
        if (mods != null) {
            for (JsonElement el : mods) {
                JsonObject m = el.getAsJsonObject();
                if ("likely_removable".equals(strOr(m, "bucket", ""))) {
                    removable.add(m);
                } else {
                    keep.add(m);
                }
            }
        }
        if (!removable.isEmpty()) {
            lines.add("  Likely safe to remove from mods/:");
            for (JsonObject m : removable) {
                lines.add("    " + strOr(m, "mod_id", "?") + "  " + strOr(m, "version", "?")
                        + "  — " + strOr(m, "reason", ""));
            }
            lines.add("");
        }
        if (!keep.isEmpty()) {
            lines.add("  Keep (libraries / uncertain):");
            for (JsonObject m : keep) {
                lines.add("    " + strOr(m, "mod_id", "?") + "  — " + strOr(m, "reason", ""));
            }
            lines.add("");
        }
        lines.add("  Heuristic list — remove one at a time and restart if unsure.");
        lines.add("  Client mods belong in your client pack, not the server.");
        lines.add("");
        return lines;
    }

    private static String formatModActionHeader(JsonObject rec, String modId, int total) {
        StringBuilder sb = new StringBuilder("[").append(strOr(rec, "mod_id", modId)).append("] ");
        if (total > 0) {
            sb.append(total).append(" error(s)");
        }
        JsonObject cats = obj(rec, "by_category");
        if (cats != null && !cats.entrySet().isEmpty()) {
            List<String> catBits = new ArrayList<>();
            for (String key : cats.keySet()) {
                ModErrorCategory cat = categoryFromId(key);
                String label = cat != null ? cat.briefLabel() : key.replace('_', ' ');
                catBits.add(cats.get(key).getAsInt() + " " + label);
            }
            sb.append(" (").append(String.join(", ", catBits)).append(")");
        }
        return sb.toString();
    }

    private static String modDisplayName(JsonObject row) {
        String display = str(row, "display_name");
        if (display != null && !display.isBlank()) {
            return display;
        }
        return strOr(row, "mod_id", "?");
    }

    private static ModErrorCategory categoryFromId(String id) {
        for (ModErrorCategory c : ModErrorCategory.values()) {
            if (c.id().equals(id)) {
                return c;
            }
        }
        return null;
    }

    private static int modRecSeverityRank(String severity) {
        return switch (severity.toLowerCase(Locale.ROOT)) {
            case "critical" -> 4;
            case "warning" -> 3;
            case "info" -> 2;
            default -> 1;
        };
    }

    public static String formatSourcePathsFooter(JsonObject meta) {
        if (meta != null && meta.has("source_paths") && meta.get("source_paths").isJsonObject()) {
            JsonObject sp = meta.getAsJsonObject("source_paths");
            List<String> parts = new ArrayList<>();
            for (String key : List.of(
                    "logs", "crash_reports", "snapshot", "state", "reports_dir",
                    "journal", "backup", "audit")) {
                String val = str(sp, key);
                if (val != null && !val.isBlank()) {
                    parts.add(val);
                }
            }
            if (!parts.isEmpty()) {
                return "Log and system sources on disk: " + String.join(" | ", parts);
            }
        }
        String serverDir = meta != null ? str(meta, "server_dir") : null;
        if (serverDir != null && !serverDir.isBlank() && !"[not detected]".equals(serverDir)) {
            return "Log and system sources on disk: " + serverDir + "/logs/latest.log"
                    + " | " + serverDir + "/crash-reports/ | journalctl | Crafty audit.log";
        }
        return "Log and system sources on disk: logs/latest.log | crash-reports/ | journalctl | Crafty audit.log";
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
        JsonElement el = o.get(key);
        if (el.isJsonPrimitive() && el.getAsJsonPrimitive().isNumber()) {
            return el.getAsDouble();
        }
        return null;
    }

    private static Integer integer(JsonObject o, String key) {
        if (o == null || !o.has(key) || o.get(key).isJsonNull()) {
            return null;
        }
        JsonElement el = o.get(key);
        if (el.isJsonPrimitive() && el.getAsJsonPrimitive().isNumber()) {
            return el.getAsInt();
        }
        return null;
    }

    /**
     * Multi-line Spark profiler section for brief.txt (fresh profiles only).
     */
    public static List<String> formatSparkSection(JsonObject facts, int freshHours) {
        JsonObject optional = obj(facts, "optional");
        JsonObject profile = optional != null ? obj(optional, "spark_profile") : null;
        if (profile == null || !dev.mcstatus.watchtower.core.collect.SparkProfileFacts.isFresh(profile, freshHours)) {
            return null;
        }
        List<String> lines = new ArrayList<>();
        lines.add("");
        lines.add("SPARK PROFILER");
        lines.add("-".repeat(40));
        JsonObject verdict = obj(profile, "verdict");
        if (verdict != null && str(verdict, "headline") != null) {
            lines.add("  " + str(verdict, "headline"));
            if (str(verdict, "summary") != null) {
                lines.add("  " + str(verdict, "summary"));
            }
        }
        String oneLiner = formatSparkOneLiner(profile);
        if (oneLiner != null) {
            lines.add("  " + oneLiner);
        }
        JsonArray recs = array(profile, "recommendations");
        if (recs != null) {
            for (int i = 0; i < recs.size() && i < 2; i++) {
                JsonObject rec = recs.get(i).getAsJsonObject();
                if ("workflow".equals(str(rec, "category"))) {
                    continue;
                }
                if (str(rec, "title") != null) {
                    lines.add("  → " + str(rec, "title") + ": " + strOr(rec, "detail", ""));
                    break;
                }
            }
        }
        lines.add("  Full report: open Spark tab in Watchtower dashboard");
        lines.add("  Tip: /spark profiler stop --save-to-file — or drop .sparkprofile in watchtower/spark-upload/");
        return lines;
    }

    public static String formatSparkOneLiner(JsonObject profile) {
        if (profile == null) {
            return null;
        }
        JsonArray hints = array(profile, "mod_hints");
        JsonObject ctx = obj(profile, "context");
        if (hints == null || hints.isEmpty()) {
            return null;
        }
        JsonObject top = hints.get(0).getAsJsonObject();
        String mod = str(top, "mod_id");
        Double pct = dbl(top, "pct");
        if (mod == null || pct == null) {
            return null;
        }
        double tps = ctx != null && dbl(ctx, "tps_1m") != null ? dbl(ctx, "tps_1m") : 20;
        double mspt = ctx != null && dbl(ctx, "mspt_p95_1m") != null ? dbl(ctx, "mspt_p95_1m") : 0;
        if (dev.mcstatus.watchtower.core.collect.SparkProfileFacts.isAllocation(profile)) {
            return String.format(Locale.US, "Allocations: %s ~%.0f%% of sample (TPS %.1f, MSPT p95 %.0fms at capture)",
                    mod, pct, tps, mspt);
        }
        return String.format(Locale.US, "Server thread: %s ~%.0f%% (TPS %.1f, MSPT p95 %.0fms)",
                mod, pct, tps, mspt);
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

    private static Boolean boolObj(JsonObject o, String key) {
        if (o == null || !o.has(key) || o.get(key).isJsonNull()) {
            return null;
        }
        return o.get(key).getAsBoolean();
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
}
