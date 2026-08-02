package dev.mcstatus.watchtower.core.collect;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Known Forge/NeoForge/Fabric join-rejection log signatures (pack sync mismatches).
 * Anchored on disconnect / lost-connection lines; ordinary kicks/timeouts do not match.
 */
public final class JoinRejectionSignatures {

    public record Hit(
            String kind,
            String platform,
            String player,
            List<String> modIds,
            String reason,
            String sampleLine,
            String confidence
    ) {
    }

    private static final Pattern ANCHOR = Pattern.compile(
            "lost connection:|Disconnecting|disconnected",
            Pattern.CASE_INSENSITIVE);

    private static final Pattern PLAYER_BEFORE_LOST = Pattern.compile(
            "(?:\\]:\\s+)?(\\S+)\\s+lost connection:",
            Pattern.CASE_INSENSITIVE);

    private static final Pattern BRACKET_LIST = Pattern.compile("\\[([^\\]]+)\\]");

    private static final Pattern MOD_AT_VERSION = Pattern.compile(
            "\\b([a-z0-9_.-]+)@([0-9][\\w.+-]*)",
            Pattern.CASE_INSENSITIVE);

    private static final Pattern REQUIRED_MODS = Pattern.compile(
            "Missing required mods?:\\s*\\[([^\\]]+)\\]",
            Pattern.CASE_INSENSITIVE);

    private static final Pattern MISMATCHED_CHANNELS = Pattern.compile(
            "mismatched channels?:\\s*\\[([^\\]]+)\\]",
            Pattern.CASE_INSENSITIVE);

    private JoinRejectionSignatures() {
    }

    /**
     * Match a single log line. Returns null when blank or not a join/pack rejection.
     */
    public static Hit match(String line) {
        if (line == null || line.isBlank()) {
            return null;
        }
        if (!ANCHOR.matcher(line).find()) {
            return null;
        }
        String lower = line.toLowerCase(Locale.ROOT);
        if (isOrdinaryDisconnect(lower)) {
            return null;
        }

        String kind = classifyKind(lower);
        if (kind == null) {
            return null;
        }

        String platform = detectPlatform(lower);
        String player = extractPlayer(line);
        String reason = extractReason(line);
        List<String> modIds = extractModIds(line, kind);
        String confidence;
        if (!modIds.isEmpty()) {
            confidence = "high";
        } else if (!"unknown_pack".equals(kind)) {
            confidence = "medium";
        } else {
            confidence = "low";
        }
        String sample = line.length() > 240 ? line.substring(0, 240) : line;
        return new Hit(kind, platform, player, List.copyOf(modIds), reason, sample, confidence);
    }

    /** Fix steps for a known kind, or empty list. */
    public static List<String> fixStepsFor(String kind) {
        if (kind == null || kind.isBlank()) {
            return List.of();
        }
        return switch (kind.toLowerCase(Locale.ROOT)) {
            case "mismatched_channel" -> List.of(
                    "Install/update the listed mods on the client to match the server.",
                    "Remove client mods that register network channels the server does not have.");
            case "missing_mod" -> List.of(
                    "Install the missing mod(s) on the client (same version as the server).");
            case "wrong_version" -> List.of(
                    "Update the named mod(s) on the client to the server's version.");
            case "registry" -> List.of(
                    "Client and server registries disagree — sync the pack (same loader + same mod set).");
            case "unknown_pack" -> List.of(
                    "Client was rejected for a pack/network mismatch — compare mods folders.");
            default -> List.of();
        };
    }

    private static boolean isOrdinaryDisconnect(String lower) {
        if (lower.contains("timed out")) {
            return true;
        }
        if (lower.contains("you are not whitelisted") || lower.contains("not whitelisted")) {
            return true;
        }
        if (lower.contains("failed to verify username")) {
            return true;
        }
        // Plain kick without pack language
        if (lower.contains("kicked")
                && !lower.contains("mod")
                && !lower.contains("channel")
                && !lower.contains("registry")) {
            return true;
        }
        if (lower.contains("internal exception")
                && !lower.contains("mod")
                && !lower.contains("channel")
                && !lower.contains("registry")) {
            return true;
        }
        return false;
    }

    private static String classifyKind(String lower) {
        if (lower.contains("mismatched channel") || lower.contains("incompatible mod set")) {
            return "mismatched_channel";
        }
        if (lower.contains("missing required mod") || lower.contains("mod rejection")) {
            return "missing_mod";
        }
        if (lower.contains("mod mismatch") || (lower.contains("required") && lower.contains("client has"))) {
            return "wrong_version";
        }
        if (lower.contains("registry") && (lower.contains("mismatch") || lower.contains("incompatible"))) {
            return "registry";
        }
        if (lower.contains("incompatible client")
                || lower.contains("incompatible mod")
                || lower.contains("network channel")
                || lower.contains("modrejection")
                || lower.contains("failed to connect to server")) {
            // Broad pack-ish language without a sharper classifier
            if (lower.contains("channel")) {
                return "mismatched_channel";
            }
            if (lower.contains("version") || lower.contains("@")) {
                return "wrong_version";
            }
            return "unknown_pack";
        }
        return null;
    }

    private static String detectPlatform(String lower) {
        if (lower.contains("neoforge") || lower.contains("incompatible mod set")) {
            return "neoforge";
        }
        if (lower.contains("fabric") || lower.contains("fabric-api") || lower.contains("incompatible client")) {
            return "fabric";
        }
        if (lower.contains("forge") && !lower.contains("neoforge")) {
            return "forge";
        }
        // Heuristics from fixture wording
        if (lower.contains("mismatched channel") || lower.contains("mod rejection")) {
            return "neoforge";
        }
        return "unknown";
    }

    private static String extractPlayer(String line) {
        Matcher m = PLAYER_BEFORE_LOST.matcher(line);
        if (m.find()) {
            String p = m.group(1).strip();
            // Drop logger class prefixes like "com.example.Player123" — keep last segment if dotted
            // but only when it looks like a package (starts lowercase after dots) — keep as-is for fixtures
            if (!p.isBlank() && !p.contains("/")) {
                return p;
            }
        }
        return "";
    }

    private static String extractReason(String line) {
        int idx = line.toLowerCase(Locale.ROOT).indexOf("lost connection:");
        String reason;
        if (idx >= 0) {
            reason = line.substring(idx + "lost connection:".length()).strip();
        } else {
            int bracket = line.indexOf("]: ");
            reason = bracket >= 0 && bracket + 3 < line.length()
                    ? line.substring(bracket + 3).strip()
                    : line.strip();
        }
        if (reason.length() > 200) {
            return reason.substring(0, 200);
        }
        return reason;
    }

    private static List<String> extractModIds(String line, String kind) {
        Set<String> ids = new LinkedHashSet<>();

        Matcher required = REQUIRED_MODS.matcher(line);
        if (required.find()) {
            addCommaSeparated(ids, required.group(1));
        }

        Matcher channels = MISMATCHED_CHANNELS.matcher(line);
        if (channels.find()) {
            addCommaSeparated(ids, channels.group(1));
        }

        Matcher atVer = MOD_AT_VERSION.matcher(line);
        while (atVer.find()) {
            addModId(ids, atVer.group(1));
        }

        // Fallback: any bracket list after pack keywords
        if (ids.isEmpty()) {
            Matcher brackets = BRACKET_LIST.matcher(line);
            while (brackets.find()) {
                String inner = brackets.group(1);
                if (inner.contains(":") || looksLikeModList(inner)) {
                    addCommaSeparated(ids, inner);
                }
            }
        }

        // Strip lone minecraft unless it is the only token
        if (ids.size() > 1) {
            ids.remove("minecraft");
        }

        return new ArrayList<>(ids);
    }

    private static boolean looksLikeModList(String inner) {
        String t = inner.strip().toLowerCase(Locale.ROOT);
        if (t.isEmpty() || t.contains("server thread") || t.contains("/info")) {
            return false;
        }
        return t.matches("[a-z0-9_.,:\\s@+-]+");
    }

    private static void addCommaSeparated(Set<String> ids, String inner) {
        for (String part : inner.split(",")) {
            addModId(ids, part.strip());
        }
    }

    private static void addModId(Set<String> ids, String raw) {
        if (raw == null || raw.isBlank()) {
            return;
        }
        String token = raw.strip();
        // create:main → create; keep namespaced path only as namespace
        int colon = token.indexOf(':');
        if (colon > 0) {
            token = token.substring(0, colon);
        }
        // strip @version if present
        int at = token.indexOf('@');
        if (at > 0) {
            token = token.substring(0, at);
        }
        token = token.strip().toLowerCase(Locale.ROOT);
        if (token.isEmpty() || token.equals("null")) {
            return;
        }
        // Skip timestamp-ish or pure numbers
        if (token.matches("\\d+") || token.contains("/")) {
            return;
        }
        ids.add(token);
    }
}
