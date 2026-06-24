package dev.mcstatus.watchtower.core.collect;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Parsed crash report fields for summaries and facts enrichment.
 */
public record CrashDetails(String summary, String modFile, String exception) {

    private static final Pattern MOD_FILE = Pattern.compile("Mod File:\\s*(.+)", Pattern.CASE_INSENSITIVE);
    private static final Pattern CAUSED_BY = Pattern.compile("Caused by:\\s*(.+)");

    public static CrashDetails parse(String text) {
        if (text == null || text.isBlank()) {
            return new CrashDetails("", "", "");
        }
        String summary = CrashReportScanner.parseCrashSummary(text);
        String modFile = "";
        String exception = "";
        Matcher mod = MOD_FILE.matcher(text);
        if (mod.find()) {
            modFile = stripJar(mod.group(1).strip());
        }
        for (String line : text.split("\\R")) {
            String trimmed = line.strip();
            if (trimmed.contains("Caused by:")) {
                Matcher cb = CAUSED_BY.matcher(trimmed);
                exception = cb.find() ? truncate(cb.group(1).strip(), 200) : truncate(trimmed, 200);
                break;
            }
            if (exception.isEmpty() && trimmed.matches("^[a-z][\\w.$]*(?:Exception|Error):.+")) {
                exception = truncate(trimmed, 200);
            }
        }
        return new CrashDetails(summary, modFile, exception);
    }

    public String displayLabel() {
        return formatLabel(exception, modFile, summary);
    }

    public static String formatLabel(String exception, String modFile, String summary) {
        String mf = validModFile(modFile, exception) ? modFile : "";
        if (exception != null && !exception.isBlank() && !mf.isBlank()) {
            return truncate(exception, 80) + " (" + mf + ")";
        }
        if (exception != null && !exception.isBlank()) {
            return truncate(exception, 120);
        }
        if (summary != null && !summary.isBlank() && !isWeakSummary(summary)) {
            return summary;
        }
        if (summary != null && !summary.isBlank()) {
            return summary;
        }
        return "";
    }

    private static boolean isWeakSummary(String summary) {
        return "Watching Server".equalsIgnoreCase(summary.strip());
    }

    private static boolean validModFile(String modFile, String exception) {
        if (modFile == null || modFile.isBlank()) {
            return false;
        }
        if (modFile.startsWith("java.lang.") || modFile.startsWith("net.minecraft.")) {
            return false;
        }
        if (exception != null && exception.contains(":")) {
            String exClass = exception.substring(0, exception.indexOf(':')).strip();
            if (modFile.equals(exClass)) {
                return false;
            }
        }
        return true;
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

    private static String truncate(String s, int max) {
        return s.length() > max ? s.substring(0, max) : s;
    }
}
