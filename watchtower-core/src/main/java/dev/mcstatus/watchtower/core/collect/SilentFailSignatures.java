package dev.mcstatus.watchtower.core.collect;

import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Known silent-fail log signatures (KubeJS, CraftTweaker, datapack JSON, /reload).
 * Same-line path capture only — no multi-line stack lookback.
 */
public final class SilentFailSignatures {

    public record Signature(
            String kind,
            String severity,
            String title,
            Pattern trigger,
            int pathGroup,
            int lineGroup,
            List<String> fixSteps
    ) {
    }

    public record Hit(
            String kind,
            String severity,
            String title,
            String path,
            Integer line,
            String sampleLine
    ) {
    }

    public static final List<Signature> ALL = List.of(
            new Signature(
                    "kubejs",
                    "warning",
                    "KubeJS script error",
                    Pattern.compile(
                            "\\[KubeJS(?:\\s+Server)?/\\].*(?:ERROR|Exception|Error|failed)"
                                    + "(?:.*?\\b(kubejs/[\\w./-]+\\.js)(?::(\\d+))?)?",
                            Pattern.CASE_INSENSITIVE),
                    1,
                    2,
                    List.of(
                            "Open the script at the reported path and check the last edited recipe/event handler.",
                            "Run /reload (or KubeJS's reload command) after fixing the syntax to confirm it clears.")),
            new Signature(
                    "crafttweaker",
                    "warning",
                    "CraftTweaker script error",
                    Pattern.compile(
                            "\\[CraftTweaker[^\\]]*\\].*?(?:ERROR|error|Error)"
                                    + "(?:.*?\\b(scripts/[\\w./-]+\\.zs)(?:\\s+line\\s+(\\d+))?)?",
                            Pattern.CASE_INSENSITIVE),
                    1,
                    2,
                    List.of(
                            "Open the .zs script at the reported path and check the reported line.",
                            "Re-run /reload once fixed to confirm it clears.")),
            new Signature(
                    "datapack_json",
                    "warning",
                    "Datapack JSON failed to parse",
                    Pattern.compile(
                            "Couldn't parse (?:data file|element) '?([\\w:./]+)'?",
                            Pattern.CASE_INSENSITIVE),
                    1,
                    0,
                    List.of(
                            "Validate the referenced JSON file — trailing commas are the most common cause.",
                            "Re-run /reload after fixing the file.")),
            new Signature(
                    "reload_failed",
                    "info",
                    "/reload command failed",
                    Pattern.compile(
                            "Failed to execute reload|Reload failed",
                            Pattern.CASE_INSENSITIVE),
                    0,
                    0,
                    List.of(
                            "Check the log lines immediately above this one for the underlying error.",
                            "Fix the reported file, then re-run /reload."))
    );

    private SilentFailSignatures() {
    }

    /**
     * Match the first signature against {@code line}. Returns null when blank or no match.
     */
    public static Hit match(String line) {
        if (line == null || line.isBlank()) {
            return null;
        }
        for (Signature sig : ALL) {
            Matcher m = sig.trigger().matcher(line);
            if (!m.find()) {
                continue;
            }
            String path = null;
            Integer lineNum = null;
            if (sig.pathGroup() > 0) {
                try {
                    String g = m.group(sig.pathGroup());
                    if (g != null && !g.isBlank()) {
                        path = g.strip();
                    }
                } catch (IllegalArgumentException | IndexOutOfBoundsException ignored) {
                    // optional capture
                }
            }
            if (sig.lineGroup() > 0) {
                try {
                    String g = m.group(sig.lineGroup());
                    if (g != null && !g.isBlank()) {
                        lineNum = Integer.parseInt(g);
                    }
                } catch (IllegalArgumentException | IndexOutOfBoundsException ignored) {
                    // optional capture
                }
            }
            String sample = line.length() > 240 ? line.substring(0, 240) : line;
            return new Hit(sig.kind(), sig.severity(), sig.title(), path, lineNum, sample);
        }
        return null;
    }

    /** Fix steps for a known kind, or empty list. */
    public static List<String> fixStepsFor(String kind) {
        if (kind == null || kind.isBlank()) {
            return List.of();
        }
        for (Signature sig : ALL) {
            if (sig.kind().equalsIgnoreCase(kind)) {
                return sig.fixSteps();
            }
        }
        return List.of();
    }
}
