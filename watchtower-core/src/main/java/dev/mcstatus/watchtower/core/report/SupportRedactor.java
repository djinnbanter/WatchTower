package dev.mcstatus.watchtower.core.report;

import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Always-on redaction for support bundle text artifacts.
 * Does not alter binary Spark profiles.
 */
public final class SupportRedactor {

    private static final Pattern IPV4 = Pattern.compile(
            "\\b(?:(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?)\\.){3}(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?)\\b");
    private static final Pattern IPV6 = Pattern.compile(
            "\\b(?:[0-9a-fA-F]{1,4}:){2,7}[0-9a-fA-F]{1,4}\\b");
    private static final Pattern UUID = Pattern.compile(
            "\\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\\b");
    private static final Pattern SECRET_ASSIGN = Pattern.compile(
            "(?i)^(\\s*(?:[A-Za-z0-9_.\\-]*?)?"
                    + "(?:password|passwd|token|secret|webhook|api[_-]?key|rcon[_-]?password"
                    + "|auth[_-]?token|client[_-]?secret|access[_-]?key)\\s*[=:]\\s*)(.*)$");

    private SupportRedactor() {
    }

    public static String redactText(String input) {
        if (input == null || input.isEmpty()) {
            return input == null ? "" : input;
        }
        String[] lines = input.split("\n", -1);
        StringBuilder out = new StringBuilder(input.length());
        for (int i = 0; i < lines.length; i++) {
            if (i > 0) {
                out.append('\n');
            }
            out.append(redactLine(lines[i]));
        }
        return out.toString();
    }

    public static String redactLine(String line) {
        if (line == null || line.isEmpty()) {
            return line == null ? "" : line;
        }
        var m = SECRET_ASSIGN.matcher(line);
        String scrubbed;
        if (m.matches()) {
            scrubbed = m.group(1) + "[REDACTED]";
        } else {
            scrubbed = line;
        }
        scrubbed = IPV4.matcher(scrubbed).replaceAll("[IP_REDACTED]");
        scrubbed = IPV6.matcher(scrubbed).replaceAll("[IP_REDACTED]");
        scrubbed = UUID.matcher(scrubbed).replaceAll("[UUID_REDACTED]");
        return scrubbed;
    }

    public static String redactConfOrToml(String input) {
        return redactText(input);
    }

    /** Redact IP-like strings inside JSON text without parsing structure. */
    public static String redactJsonText(String json) {
        return redactText(json);
    }

    public static boolean looksLikeSecretKey(String key) {
        if (key == null || key.isBlank()) {
            return false;
        }
        String k = key.toLowerCase(Locale.ROOT);
        return k.contains("password")
                || k.contains("passwd")
                || k.contains("token")
                || k.contains("secret")
                || k.contains("webhook")
                || k.contains("api_key")
                || k.contains("apikey")
                || k.contains("rcon");
    }
}
