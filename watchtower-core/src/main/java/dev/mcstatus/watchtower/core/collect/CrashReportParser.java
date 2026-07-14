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
 *
 * <p>1.0.13 additions: TRANSFORMER/mod@version stack → {@code primary_mod_id} (G-01);
 * watchdog duration in seconds → ms (G-03).
 */
public final class CrashReportParser {

    private static final Pattern DESCRIPTION = Pattern.compile("^Description:\\s*(.+)", Pattern.MULTILINE);
    private static final Pattern FAILURE_MESSAGE = Pattern.compile("^Failure message:\\s*(.+)", Pattern.MULTILINE);
    private static final Pattern CAUSED_BY = Pattern.compile("^Caused by:\\s*(.+)", Pattern.MULTILINE);
    private static final Pattern EXCEPTION_LINE = Pattern.compile(
            "^([a-z][\\w.$]*(?:Exception|Error)):\\s*(.+)", Pattern.MULTILINE);
    private static final Pattern WATCHDOG_MS = Pattern.compile(
            "single server tick took (\\d+) milliseconds", Pattern.CASE_INSENSITIVE);
    private static final Pattern WATCHDOG_SEC = Pattern.compile(
            "single server tick took ([\\d.]+)\\s*seconds", Pattern.CASE_INSENSITIVE);
    /** NeoForge/Fabric stack frame: {@code TRANSFORMER/modid@version/...}. */
    private static final Pattern TRANSFORMER_MOD = Pattern.compile(
            "TRANSFORMER/([a-z][\\w-]*)@[\\w.+-]+/", Pattern.CASE_INSENSITIVE);
    private static final Pattern STACK_FRAME = Pattern.compile("^\\tat\\s+(\\S+)\\((.+?)\\)");
    private static final Pattern MOD_FILE = Pattern.compile("Mod File:\\s*(.+)", Pattern.CASE_INSENSITIVE);
    private static final int MAX_FRAMES = 8;
    /** Corrupted watchdog counters exceed ~41 days in ms; fall back to nominal 60s. */
    private static final double WATCHDOG_SEC_CORRUPT_THRESHOLD = 3_600_000_000d;
    private static final int WATCHDOG_NOMINAL_MS = 60_000;
    private static final Set<String> VANILLA_TRANSFORMER_IDS = Set.of(
            "minecraft", "neoforge", "forge", "fabricloader", "java");

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
            Integer watchdogTickMs,
            String primaryModId) {

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
            if (primaryModId != null && !primaryModId.isBlank()) {
                report.addProperty("primary_mod_id", primaryModId);
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
        String primaryModId = extractPrimaryModId(text, frames);
        return new ParsedCrash(summary, modFile, exception, description, failureMessage,
                rootException, causedBy, frames, watchdogMs, primaryModId);
    }

    /**
     * Parse watchdog stall duration to milliseconds (G-03).
     * Prefers an explicit milliseconds match; otherwise converts seconds.
     * Implausibly large second counters (e.g. {@code 60000004.00 seconds}) map to a nominal 60s.
     */
    public static Integer extractWatchdogMs(String text) {
        return extractWatchdogMs(text, null, null);
    }

    private static ParsedCrash empty() {
        return new ParsedCrash("", "", "", "", "", "", "", new JsonArray(), null, null);
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
        Integer fromMs = matchWatchdogMilliseconds(combined);
        if (fromMs != null) {
            return fromMs;
        }
        fromMs = matchWatchdogMilliseconds(text);
        if (fromMs != null) {
            return fromMs;
        }
        Integer fromSec = matchWatchdogSeconds(combined);
        if (fromSec != null) {
            return fromSec;
        }
        return matchWatchdogSeconds(text);
    }

    private static Integer matchWatchdogMilliseconds(String haystack) {
        if (haystack == null || haystack.isBlank()) {
            return null;
        }
        Matcher m = WATCHDOG_MS.matcher(haystack);
        return m.find() ? Integer.parseInt(m.group(1)) : null;
    }

    private static Integer matchWatchdogSeconds(String haystack) {
        if (haystack == null || haystack.isBlank()) {
            return null;
        }
        Matcher m = WATCHDOG_SEC.matcher(haystack);
        if (!m.find()) {
            return null;
        }
        double seconds;
        try {
            seconds = Double.parseDouble(m.group(1));
        } catch (NumberFormatException e) {
            return WATCHDOG_NOMINAL_MS;
        }
        if (seconds > WATCHDOG_SEC_CORRUPT_THRESHOLD || seconds < 0) {
            return WATCHDOG_NOMINAL_MS;
        }
        long ms = Math.round(seconds * 1000d);
        if (ms > Integer.MAX_VALUE) {
            return WATCHDOG_NOMINAL_MS;
        }
        return (int) Math.max(1, ms);
    }

    /**
     * First non-vanilla TRANSFORMER/mod@version id in the report (G-01).
     */
    public static String extractPrimaryModId(String text) {
        return extractPrimaryModId(text, null);
    }

    private static String extractPrimaryModId(String text, JsonArray frames) {
        if (text != null) {
            Matcher m = TRANSFORMER_MOD.matcher(text);
            while (m.find()) {
                String id = m.group(1).toLowerCase(Locale.ROOT);
                if (!VANILLA_TRANSFORMER_IDS.contains(id) && isValidModId(id)) {
                    return id;
                }
            }
        }
        if (frames != null) {
            for (var el : frames) {
                if (!el.isJsonObject()) {
                    continue;
                }
                JsonObject row = el.getAsJsonObject();
                if (row.has("mod_id") && !row.get("mod_id").isJsonNull()) {
                    String id = row.get("mod_id").getAsString().toLowerCase(Locale.ROOT);
                    if (!VANILLA_TRANSFORMER_IDS.contains(id) && isValidModId(id)) {
                        return id;
                    }
                }
            }
        }
        return null;
    }

    private static boolean isValidModId(String id) {
        if (id == null || id.isBlank()) {
            return false;
        }
        String lower = id.toLowerCase(Locale.ROOT);
        return !lower.contains("<no mod")
                && !lower.equals("java.lang.error")
                && !lower.equals("error")
                && !lower.equals("null");
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
            Matcher xf = TRANSFORMER_MOD.matcher(line);
            String transformerId = null;
            if (xf.find()) {
                transformerId = xf.group(1).toLowerCase(Locale.ROOT);
            }
            if (transformerId == null && !looksModRelated(frame, modSet)) {
                continue;
            }
            JsonObject row = new JsonObject();
            row.addProperty("method", frame);
            row.addProperty("source", m.group(2));
            String modId = transformerId != null && !VANILLA_TRANSFORMER_IDS.contains(transformerId)
                    ? transformerId
                    : guessModId(frame, modSet);
            if (modId != null && isValidModId(modId) && !VANILLA_TRANSFORMER_IDS.contains(modId)) {
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
