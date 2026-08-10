package dev.mcstatus.watchtower.core.report;

import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Always-on redaction for support bundle text artifacts.
 * Binary Spark profiles are listed by name only — never packed raw.
 */
public final class SupportRedactor {

    private static final Pattern IPV4 = Pattern.compile(
            "\\b(?:(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?)\\.){3}(?:25[0-5]|2[0-4]\\d|[01]?\\d\\d?)\\b");
    /**
     * Full 8-group IPv6 (7 colons). A clock time has 2 colons and a jar manifest fingerprint has 5,
     * so neither can reach this arity.
     */
    private static final Pattern IPV6_FULL = Pattern.compile(
            "(?<![0-9A-Fa-f:])(?:[0-9A-Fa-f]{1,4}:){7}[0-9A-Fa-f]{1,4}(?![0-9A-Fa-f:])");
    /** Zero-compressed IPv6. Requires "::", which timestamps and colon-separated hashes never contain. */
    private static final Pattern IPV6_COMPRESSED = Pattern.compile(
            "(?<![0-9A-Fa-f:])(?:[0-9A-Fa-f]{1,4}(?::[0-9A-Fa-f]{1,4}){0,6})?::"
                    + "(?:[0-9A-Fa-f]{1,4}(?::[0-9A-Fa-f]{1,4}){0,6})?(?![0-9A-Fa-f:])");
    private static final Pattern UUID = Pattern.compile(
            "\\b[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}\\b");
    private static final Pattern SECRET_ASSIGN = Pattern.compile(
            "(?i)^(\\s*(?:[A-Za-z0-9_.\\-]*?)?"
                    + "(?:password|passwd|token|secret|webhook|api[_-]?key|rcon[_-]?password"
                    + "|auth[_-]?token|client[_-]?secret|access[_-]?key)\\s*[=:]\\s*)(.*)$");
    private static final Pattern INLINE_SECRET_ASSIGN = Pattern.compile(
            "(?i)((?:password|passwd|token|secret|webhook|api[_-]?key|rcon[_-]?password"
                    + "|auth[_-]?token|client[_-]?secret|access[_-]?key)\\s*[=:]\\s*)([^\"\\s,\\]}]+)");

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
            scrubbed = INLINE_SECRET_ASSIGN.matcher(line).replaceAll("$1[REDACTED]");
        }
        scrubbed = IPV4.matcher(scrubbed).replaceAll("[IP_REDACTED]");
        scrubbed = IPV6_FULL.matcher(scrubbed).replaceAll("[IP_REDACTED]");
        scrubbed = IPV6_COMPRESSED.matcher(scrubbed).replaceAll("[IP_REDACTED]");
        scrubbed = UUID.matcher(scrubbed).replaceAll("[UUID_REDACTED]");
        return scrubbed;
    }

    public static String redactConfOrToml(String input) {
        return redactText(input);
    }

    private static final Pattern JSON_QUOTED_SECRET = Pattern.compile(
            "(?i)(\"(?:password|passwd|token|secret|webhook|api[_-]?key|rcon[_-]?password"
                    + "|auth[_-]?token|client[_-]?secret|access[_-]?key)\"\\s*:\\s*\")([^\"]*)(\")");

    /** Redact IP-like strings and secret values inside JSON text without parsing structure. */
    public static String redactJsonText(String json) {
        String scrubbed = redactText(json);
        scrubbed = INLINE_SECRET_ASSIGN.matcher(scrubbed).replaceAll("$1[REDACTED]");
        return JSON_QUOTED_SECRET.matcher(scrubbed).replaceAll("$1[REDACTED]$3");
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
