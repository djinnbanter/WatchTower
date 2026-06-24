package dev.mcstatus.watchtower.core.report;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Correlates bundled log files into restart attempts and detects missing crash reports.
 */
public final class DrLogCorrelation {

    private static final long PAIR_DEBUG_SEC = 5L * 60L;
    private static final long PAIR_CRASH_SEC = 10L * 60L;
    private static final Pattern FAILURE_LINE = Pattern.compile(
            "(?i)(ERROR|FATAL|Exception|Mod loading has failed|Failed to start|ModLoadingException|did not reach)");
    private static final Pattern CRASH_TIME = Pattern.compile("(?m)^Time:\\s*(.+)$");

    private DrLogCorrelation() {
    }

    public enum CorrelationStatus {
        complete,
        logs_only,
        crash_only,
        mismatch
    }

    public record AttemptCorrelation(
            int attempt,
            String startedAt,
            List<String> regularLogs,
            List<String> debugLogs,
            List<String> crashReports,
            CorrelationStatus status,
            String userMessage,
            boolean failureSignals,
            JsonObject failureLine
    ) {
    }

    public record CorrelationResult(List<AttemptCorrelation> attempts) {
    }

    public static CorrelationResult correlate(DrLogFileSelector.DrLogSelection selection) {
        List<DrLogFileSelector.SelectedLogFile> regular = selection.regular();
        List<AttemptCorrelation> attempts = new ArrayList<>();

        if (regular.isEmpty() && selection.crash().isEmpty()) {
            return new CorrelationResult(List.of());
        }

        int attemptNum = 0;
        for (DrLogFileSelector.SelectedLogFile reg : regular) {
            attemptNum++;
            List<String> regPaths = List.of(reg.zipEntryPath());
            List<String> dbgPaths = matchDebug(selection.debug(), reg.mtimeEpochSec());
            List<String> crashPaths = matchCrash(selection.crash(), reg.mtimeEpochSec());
            boolean failure = hasFailureSignals(reg.sourcePath());
            JsonObject failureLine = failure ? findFailureLine(reg) : null;
            CorrelationStatus status = resolveStatus(regPaths, dbgPaths, crashPaths, failure, reg, selection.debug());
            String startedAt = Instant.ofEpochSecond(reg.mtimeEpochSec())
                    .atZone(ZoneId.systemDefault())
                    .format(DateTimeFormatter.ISO_OFFSET_DATE_TIME);
            String msg = userMessage(attemptNum, startedAt, status, failure);
            attempts.add(new AttemptCorrelation(
                    attemptNum, startedAt, regPaths, dbgPaths, crashPaths, status, msg, failure, failureLine));
        }

        for (DrLogFileSelector.SelectedLogFile crash : selection.crash()) {
            if (attempts.stream().anyMatch(a -> a.crashReports().contains(crash.zipEntryPath()))) {
                continue;
            }
            attempts.add(new AttemptCorrelation(
                    ++attemptNum,
                    Instant.ofEpochSecond(crash.mtimeEpochSec()).atZone(ZoneId.systemDefault())
                            .format(DateTimeFormatter.ISO_OFFSET_DATE_TIME),
                    List.of(),
                    List.of(),
                    List.of(crash.zipEntryPath()),
                    CorrelationStatus.crash_only,
                    "Crash report " + crash.sourcePath().getFileName()
                            + " has no matching regular log in the lookback window.",
                    false,
                    null));
        }

        attempts.sort(Comparator.comparingInt(AttemptCorrelation::attempt));
        return new CorrelationResult(attempts);
    }

    public static JsonArray toJsonArray(CorrelationResult result) {
        JsonArray arr = new JsonArray();
        for (AttemptCorrelation a : result.attempts()) {
            JsonObject o = new JsonObject();
            o.addProperty("attempt", a.attempt());
            o.addProperty("started_at", a.startedAt());
            o.add("regular_logs", stringArray(a.regularLogs()));
            o.add("debug_logs", stringArray(a.debugLogs()));
            o.add("crash_reports", stringArray(a.crashReports()));
            o.addProperty("correlation_status", a.status().name());
            o.addProperty("user_message", a.userMessage());
            o.addProperty("failure_signals", a.failureSignals());
            if (a.failureLine() != null) {
                o.add("failure_line", a.failureLine());
            }
            arr.add(o);
        }
        return arr;
    }

    private static JsonArray stringArray(List<String> items) {
        JsonArray arr = new JsonArray();
        for (String s : items) {
            arr.add(s);
        }
        return arr;
    }

    private static List<String> matchDebug(List<DrLogFileSelector.SelectedLogFile> debug, long regMtime) {
        List<String> out = new ArrayList<>();
        for (DrLogFileSelector.SelectedLogFile d : debug) {
            if (Math.abs(d.mtimeEpochSec() - regMtime) <= PAIR_DEBUG_SEC) {
                out.add(d.zipEntryPath());
            }
        }
        return out;
    }

    private static List<String> matchCrash(List<DrLogFileSelector.SelectedLogFile> crashes, long regMtime) {
        List<String> out = new ArrayList<>();
        for (DrLogFileSelector.SelectedLogFile c : crashes) {
            long crashTime = parseCrashTimeSec(c.sourcePath());
            long ref = crashTime > 0 ? crashTime : c.mtimeEpochSec();
            if (Math.abs(ref - regMtime) <= PAIR_CRASH_SEC) {
                out.add(c.zipEntryPath());
            }
        }
        return out;
    }

    private static long parseCrashTimeSec(java.nio.file.Path crashFile) {
        try {
            String head = Files.readString(crashFile, StandardCharsets.UTF_8);
            if (head.length() > 8000) {
                head = head.substring(0, 8000);
            }
            var m = CRASH_TIME.matcher(head);
            if (m.find()) {
                String raw = m.group(1).trim();
                try {
                    return java.time.LocalDateTime.parse(raw,
                                    DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"))
                            .atZone(ZoneId.systemDefault()).toEpochSecond();
                } catch (Exception ignored) {
                }
            }
        } catch (IOException ignored) {
        }
        return 0L;
    }

    private static JsonObject findFailureLine(DrLogFileSelector.SelectedLogFile reg) {
        return DrCrashLoopAnalyzer.findFirstFailureLine(reg.sourcePath(), reg.zipEntryPath());
    }

    private static boolean hasFailureSignals(java.nio.file.Path logFile) {
        try {
            String content = Files.readString(logFile, StandardCharsets.UTF_8);
            if (content.length() > 500_000) {
                content = content.substring(content.length() - 500_000);
            }
            return FAILURE_LINE.matcher(content).find();
        } catch (IOException e) {
            return false;
        }
    }

    private static CorrelationStatus resolveStatus(
            List<String> reg,
            List<String> dbg,
            List<String> crash,
            boolean failure,
            DrLogFileSelector.SelectedLogFile regFile,
            List<DrLogFileSelector.SelectedLogFile> allDebug
    ) {
        if (!crash.isEmpty()) {
            return CorrelationStatus.complete;
        }
        if (failure) {
            return CorrelationStatus.logs_only;
        }
        for (DrLogFileSelector.SelectedLogFile d : allDebug) {
            if (dbg.contains(d.zipEntryPath()) && Math.abs(d.mtimeEpochSec() - regFile.mtimeEpochSec()) > PAIR_DEBUG_SEC) {
                return CorrelationStatus.mismatch;
            }
        }
        return reg.isEmpty() ? CorrelationStatus.crash_only : CorrelationStatus.complete;
    }

    private static String userMessage(int attempt, String startedAt, CorrelationStatus status, boolean failure) {
        String timeShort = startedAt.length() >= 16 ? startedAt.substring(11, 16) : startedAt;
        if (status == CorrelationStatus.logs_only) {
            return String.format(Locale.US,
                    "Restart attempt #%d (%s) shows a startup failure but no crash report was written — "
                            + "common when the process was killed before Minecraft could write crash-reports/.",
                    attempt, timeShort);
        }
        if (status == CorrelationStatus.crash_only) {
            return String.format(Locale.US,
                    "Crash report for attempt #%d (%s) has no matching regular log in the lookback window.",
                    attempt, timeShort);
        }
        if (status == CorrelationStatus.mismatch) {
            return String.format(Locale.US,
                    "Attempt #%d (%s) log timestamps may be from different restarts — review all bundled files.",
                    attempt, timeShort);
        }
        if (failure) {
            return String.format(Locale.US, "Attempt #%d (%s) includes failure signals with matched crash report.", attempt, timeShort);
        }
        return String.format(Locale.US, "Attempt #%d (%s) bundled.", attempt, timeShort);
    }
}
