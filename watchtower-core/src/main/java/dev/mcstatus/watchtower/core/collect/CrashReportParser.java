package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Deep parse of Minecraft crash report text for narrative generation.
 */
public final class CrashReportParser {

    private static final Pattern DESCRIPTION = Pattern.compile("^Description:\\s*(.+)", Pattern.MULTILINE);
    private static final Pattern FAILURE_MESSAGE = Pattern.compile("^Failure message:\\s*(.+)", Pattern.MULTILINE);
    private static final Pattern CAUSED_BY = Pattern.compile("^Caused by:\\s*(.+)", Pattern.MULTILINE);
    private static final Pattern EXCEPTION_LINE = Pattern.compile(
            "^([a-z][\\w.$]*(?:Exception|Error)):\\s*(.+)", Pattern.MULTILINE);
    private static final Pattern WATCHDOG_MS = Pattern.compile(
            "single server tick took (\\d+) milliseconds", Pattern.CASE_INSENSITIVE);
    private static final Pattern STACK_FRAME = Pattern.compile("^\\tat\\s+(\\S+)\\((.+?)\\)");
    private static final Pattern MOD_FILE = Pattern.compile("Mod File:\\s*(.+)", Pattern.CASE_INSENSITIVE);
    private static final int MAX_FRAMES = 8;

    private CrashReportParser() {
    }

    public record ParsedCrash(
            String summary,
            String modFile,
            String exception,
            String description,
            String failureMessage,
            String rootException,
            String causedBy,
            JsonArray stackFrames,
            Integer watchdogTickMs) {

        public void applyTo(JsonObject report) {
            if (summary != null && !summary.isBlank()) {
                report.addProperty("summary", summary);
            }
            if (modFile != null && !modFile.isBlank()) {
                report.addProperty("mod_file", modFile);
            }
            if (exception != null && !exception.isBlank()) {
                report.addProperty("exception", exception);
            }
            if (description != null && !description.isBlank()) {
                report.addProperty("description", description);
            }
            if (failureMessage != null && !failureMessage.isBlank()) {
                report.addProperty("failure_message", failureMessage);
            }
            if (rootException != null && !rootException.isBlank()) {
                report.addProperty("root_exception", rootException);
            }
            if (causedBy != null && !causedBy.isBlank()) {
                report.addProperty("caused_by", causedBy);
            }
            if (stackFrames != null && !stackFrames.isEmpty()) {
                report.add("stack_frames", stackFrames);
            }
            if (watchdogTickMs != null) {
                report.addProperty("watchdog_tick_ms", watchdogTickMs);
            }
        }
    }

    public static ParsedCrash parse(String text, List<String> knownModIds) {
        if (text == null || text.isBlank()) {
            return empty();
        }
        String summary = CrashReportScanner.parseCrashSummary(text);
        String modFile = extractModFile(text);
        String description = matchGroup(DESCRIPTION, text);
        String failureMessage = matchGroup(FAILURE_MESSAGE, text);
        String rootException = firstException(text);
        String causedBy = firstCausedBy(text);
        String exception = causedBy != null && !causedBy.isBlank() ? causedBy : rootException;
        Integer watchdogMs = extractWatchdogMs(text, exception, summary);
        JsonArray frames = extractStackFrames(text, knownModIds);
        return new ParsedCrash(summary, modFile, exception, description, failureMessage,
                rootException, causedBy, frames, watchdogMs);
    }

    private static ParsedCrash empty() {
        return new ParsedCrash("", "", "", "", "", "", "", new JsonArray(), null);
    }

    private static String extractModFile(String text) {
        Matcher mod = MOD_FILE.matcher(text);
        return mod.find() ? stripJar(mod.group(1).strip()) : "";
    }

    private static String stripJar(String raw) {
        String s = raw;
        int slash = Math.max(s.lastIndexOf('/'), s.lastIndexOf('\\'));
        if (slash >= 0) {
            s = s.substring(slash + 1);
        }
        if (s.endsWith(".jar")) {
            s = s.substring(0, s.length() - 4);
        }
        int dash = s.lastIndexOf('-');
        if (dash > 0 && s.substring(dash + 1).matches("\\d+.*")) {
            s = s.substring(0, dash);
        }
        return s;
    }

    private static String matchGroup(Pattern pattern, String text) {
        Matcher m = pattern.matcher(text);
        return m.find() ? m.group(1).strip() : "";
    }

    private static String firstException(String text) {
        Matcher m = EXCEPTION_LINE.matcher(text);
        return m.find() ? truncate(m.group(0).strip(), 200) : "";
    }

    private static String firstCausedBy(String text) {
        Matcher m = CAUSED_BY.matcher(text);
        return m.find() ? truncate(m.group(1).strip(), 200) : "";
    }

    private static Integer extractWatchdogMs(String text, String exception, String summary) {
        String combined = (exception != null ? exception : "") + " " + (summary != null ? summary : "");
        Matcher m = WATCHDOG_MS.matcher(combined);
        if (m.find()) {
            return Integer.parseInt(m.group(1));
        }
        m = WATCHDOG_MS.matcher(text);
        return m.find() ? Integer.parseInt(m.group(1)) : null;
    }

    private static JsonArray extractStackFrames(String text, List<String> knownModIds) {
        Set<String> modSet = new HashSet<>();
        if (knownModIds != null) {
            knownModIds.forEach(id -> modSet.add(id.toLowerCase(Locale.ROOT)));
        }
        JsonArray arr = new JsonArray();
        for (String line : text.split("\\R")) {
            Matcher m = STACK_FRAME.matcher(line.strip());
            if (!m.find()) {
                continue;
            }
            String frame = m.group(1);
            if (!looksModRelated(frame, modSet)) {
                continue;
            }
            JsonObject row = new JsonObject();
            row.addProperty("method", frame);
            row.addProperty("source", m.group(2));
            String modId = guessModId(frame, modSet);
            if (modId != null) {
                row.addProperty("mod_id", modId);
            }
            arr.add(row);
            if (arr.size() >= MAX_FRAMES) {
                break;
            }
        }
        return arr;
    }

    private static boolean looksModRelated(String frame, Set<String> knownModIds) {
        if (frame.startsWith("net.minecraft.") || frame.startsWith("net.neoforged.")
                || frame.startsWith("java.") || frame.startsWith("sun.")) {
            return false;
        }
        String pkg = frame.contains(".") ? frame.substring(0, frame.indexOf('.')) : frame;
        if (knownModIds.contains(pkg.toLowerCase(Locale.ROOT))) {
            return true;
        }
        return !frame.startsWith("net.minecraft") && frame.contains(".");
    }

    private static String guessModId(String frame, Set<String> knownModIds) {
        String[] parts = frame.split("\\.");
        if (parts.length >= 2) {
            String candidate = parts[1].toLowerCase(Locale.ROOT);
            if (knownModIds.contains(candidate)) {
                return candidate;
            }
            if (!"minecraft".equals(candidate) && !"neoforged".equals(candidate)) {
                return candidate;
            }
        }
        return null;
    }

    private static String truncate(String s, int max) {
        return s.length() > max ? s.substring(0, max) : s;
    }
}
