package dev.mcstatus.watchtower.core.report;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Detects crash-loop patterns across restart attempts in a DR bundle window.
 */
public final class DrCrashLoopAnalyzer {

    private static final Pattern MOD_ID = Pattern.compile("(?i)(?:Mod (?:File|ID)|mod id)[^\\n]*?\\b([a-z][a-z0-9_]{1,63})\\b");
    private static final Pattern SUSPECT_MOD = Pattern.compile("(?i)suspect[_ ]?mod[_ ]?id[\"']?\\s*[:=]\\s*[\"']?([a-z][a-z0-9_]{1,63})");
    private static final Pattern FAILURE_LINE = Pattern.compile(
            "(?i)(ERROR|FATAL|Exception|Mod loading has failed|Failed to start|ModLoadingException)");

    private DrCrashLoopAnalyzer() {
    }

    public static void applyToFacts(
            JsonObject facts,
            DrLogCorrelation.CorrelationResult correlation,
            DrLogFileSelector.DrLogSelection selection
    ) {
        if (facts == null || correlation == null) {
            return;
        }
        int attempts = correlation.attempts().size();
        long logsOnly = correlation.attempts().stream()
                .filter(a -> a.status() == DrLogCorrelation.CorrelationStatus.logs_only && a.failureSignals())
                .count();
        long failureAttempts = correlation.attempts().stream()
                .filter(DrLogCorrelation.AttemptCorrelation::failureSignals).count();

        Map<String, Integer> modCounts = new HashMap<>();
        collectModsFromFacts(facts, modCounts);
        JsonArray loopEvidence = new JsonArray();
        for (DrLogCorrelation.AttemptCorrelation a : correlation.attempts()) {
            if (!a.failureSignals()) {
                continue;
            }
            for (DrLogFileSelector.SelectedLogFile f : selection.regular()) {
                if (a.regularLogs().contains(f.zipEntryPath())) {
                    collectModsFromLog(f.sourcePath(), modCounts);
                    addFailureEvidence(loopEvidence, f, a);
                }
            }
        }

        String topMod = modCounts.entrySet().stream()
                .max(Map.Entry.comparingByValue())
                .map(Map.Entry::getKey)
                .orElse(null);

        if (attempts >= 2 || failureAttempts >= 2) {
            String msg = attempts >= 2
                    ? String.format(Locale.US,
                    "%d restart attempts since last successful start — server appears stuck in a crash loop.",
                    attempts)
                    : "Multiple failure signals detected since last successful start.";
            if (topMod != null) {
                msg += " Repeated mod signal: " + topMod + ".";
            }
            addDrIssue(facts, "CRASH_LOOP", "critical", msg,
                    List.of("Fix the root cause (often a mod or config from the latest crash/log), then restart once."),
                    loopEvidence);
        }

        if (logsOnly > 0) {
            JsonArray missingEv = new JsonArray();
            for (DrLogCorrelation.AttemptCorrelation a : correlation.attempts()) {
                if (a.status() == DrLogCorrelation.CorrelationStatus.logs_only && a.failureSignals()
                        && a.failureLine() != null) {
                    missingEv.add(a.failureLine());
                    if (missingEv.size() >= 3) {
                        break;
                    }
                }
            }
            addDrIssue(facts, "MISSING_CRASH_REPORT", "warning",
                    String.format(Locale.US,
                            "%d restart attempt(s) show failure in logs but no crash report was written.",
                            logsOnly),
                    List.of("Check panel/OOM killer logs; crash-reports/ may be empty for hard kills — use bundled regular/debug logs."),
                    missingEv);
        }
    }

    public static void addDrIssue(
            JsonObject facts,
            String id,
            String severity,
            String message,
            List<String> fixSteps,
            JsonArray evidence
    ) {
        JsonObject issue = new JsonObject();
        issue.addProperty("id", id);
        issue.addProperty("severity", severity);
        issue.addProperty("active", true);
        issue.addProperty("message", message);
        if (fixSteps != null && !fixSteps.isEmpty()) {
            issue.addProperty("fix", String.join(" ", fixSteps));
            JsonArray fixes = new JsonArray();
            for (String s : fixSteps) {
                fixes.add(s);
            }
            issue.add("fix_steps", fixes);
        }
        if (evidence != null && !evidence.isEmpty()) {
            issue.add("evidence", evidence);
        }
        addIssue(facts, issue);
    }

    private static void addFailureEvidence(JsonArray arr, DrLogFileSelector.SelectedLogFile f,
                                            DrLogCorrelation.AttemptCorrelation a) {
        if (a.failureLine() != null) {
            arr.add(a.failureLine());
            return;
        }
        JsonObject ev = findFirstFailureLine(f.sourcePath(), f.zipEntryPath());
        if (ev != null && arr.size() < 5) {
            arr.add(ev);
        }
    }

    static JsonObject findFirstFailureLine(java.nio.file.Path logFile, String zipEntry) {
        try {
            List<String> lines = Files.readAllLines(logFile, StandardCharsets.UTF_8);
            int start = Math.max(0, lines.size() - 5000);
            for (int i = start; i < lines.size(); i++) {
                String line = lines.get(i);
                if (FAILURE_LINE.matcher(line).find()) {
                    JsonObject ev = new JsonObject();
                    ev.addProperty("file", zipEntry);
                    ev.addProperty("line", i + 1);
                    String quote = line.strip();
                    if (quote.length() > 300) {
                        quote = quote.substring(0, 300);
                    }
                    ev.addProperty("quote", quote);
                    return ev;
                }
            }
        } catch (IOException ignored) {
        }
        return null;
    }

    private static void collectModsFromFacts(JsonObject facts, Map<String, Integer> modCounts) {
        if (!facts.has("optional") || !facts.get("optional").isJsonObject()) {
            return;
        }
        JsonObject opt = facts.getAsJsonObject("optional");
        if (!opt.has("crash_summaries") || !opt.get("crash_summaries").isJsonArray()) {
            return;
        }
        for (var el : opt.getAsJsonArray("crash_summaries")) {
            if (!el.isJsonObject()) {
                continue;
            }
            JsonObject c = el.getAsJsonObject();
            if (c.has("suspect_mod_id") && !c.get("suspect_mod_id").getAsString().isBlank()) {
                modCounts.merge(c.get("suspect_mod_id").getAsString().toLowerCase(Locale.ROOT), 1, Integer::sum);
            }
        }
    }

    private static void collectModsFromLog(java.nio.file.Path logFile, Map<String, Integer> modCounts) {
        try {
            String content = Files.readString(logFile, StandardCharsets.UTF_8);
            if (content.length() > 300_000) {
                content = content.substring(content.length() - 300_000);
            }
            Matcher m = Pattern.compile("(?i)\\bMod (?:File|ID)[^\\n]*?\\b([a-z][a-z0-9_]{1,63})\\b").matcher(content);
            while (m.find()) {
                modCounts.merge(m.group(1).toLowerCase(Locale.ROOT), 1, Integer::sum);
            }
        } catch (IOException ignored) {
        }
    }

    private static void addIssue(JsonObject facts, JsonObject issue) {
        JsonArray issues = facts.has("issues") && facts.get("issues").isJsonArray()
                ? facts.getAsJsonArray("issues")
                : new JsonArray();
        for (var el : issues) {
            if (el.isJsonObject() && issue.get("id").getAsString().equals(el.getAsJsonObject().get("id").getAsString())) {
                return;
            }
        }
        issues.add(issue);
        facts.add("issues", issues);
    }
}
