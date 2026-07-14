package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Parse NeoForge / FML {@code -- Mod loading issue --} blocks and dependency/conflict banners
 * from log or crash text (CA-18 / G-10).
 */
public final class FmlIssueParser {

    private static final Pattern HEADER = Pattern.compile(
            "^-- Mod loading issue(?: for: ([\\w.-]+))? --\\s*$");
    private static final Pattern MOD_ID = Pattern.compile(
            "^\\s*Mod ID:\\s*(.+?)\\s*$", Pattern.CASE_INSENSITIVE);
    private static final Pattern MOD_FILE = Pattern.compile(
            "^\\s*Mod File:\\s*(.+?)\\s*$", Pattern.CASE_INSENSITIVE);
    private static final Pattern FAILURE = Pattern.compile(
            "^\\s*Failure message:\\s*(.+?)\\s*$", Pattern.CASE_INSENSITIVE);
    private static final Pattern ISSUE_KIND = Pattern.compile(
            "^\\s*Issue kind:\\s*(.+?)\\s*$", Pattern.CASE_INSENSITIVE);
    private static final Pattern JAR_NAME = Pattern.compile(
            "([\\w.+-]+\\.jar)", Pattern.CASE_INSENSITIVE);

    private FmlIssueParser() {
    }

    public static JsonArray parse(String text) {
        JsonArray out = new JsonArray();
        if (text == null || text.isBlank()) {
            return out;
        }
        List<Issue> issues = new ArrayList<>();
        parseMultiblock(text, issues);
        parseBanners(text, issues);
        issues.sort(Comparator.comparingInt(Issue::rank));
        for (Issue issue : issues) {
            out.add(issueToJson(issue));
        }
        return out;
    }

    /**
     * Known FML pattern hits for Issues / boot triage. Sorted by priority descending.
     * Rank-1 (priority ≥ 80) may inform boot {@code mod_load_dependency}; lower ranks are Issues-only.
     */
    public static JsonArray parseKnownPatternHits(String text) {
        JsonArray out = new JsonArray();
        if (text == null || text.isBlank()) {
            return out;
        }
        List<PatternHit> hits = new ArrayList<>();
        String[] lines = text.split("\\R");
        for (int i = 0; i < lines.length; i++) {
            String line = lines[i];
            BannerKind kind = detectBanner(line);
            if (kind == null) {
                continue;
            }
            if (!line.contains("]: ")) {
                continue;
            }
            if (i + 1 >= lines.length || !isMessageContinuation(lines[i + 1])) {
                continue;
            }
            Set<String> modIds = new LinkedHashSet<>();
            Set<String> jarNames = new LinkedHashSet<>();
            for (int j = i + 1; j < lines.length; j++) {
                if (!isMessageContinuation(lines[j])) {
                    break;
                }
                modIds.addAll(modIdsFromQuotedLabels(lines[j]));
                jarNames.addAll(jarNamesFromLine(lines[j]));
            }
            PatternHit hit = new PatternHit();
            hit.id = kind.id;
            hit.priority = kind.priority;
            hit.messageKey = kind.messageKey;
            hit.modIds.addAll(modIds);
            hit.jarNames.addAll(jarNames);
            hits.add(hit);
        }
        hits.sort(Comparator.comparingInt((PatternHit h) -> h.priority).reversed());
        for (PatternHit hit : hits) {
            JsonObject row = new JsonObject();
            row.addProperty("id", hit.id);
            row.addProperty("priority", hit.priority);
            row.addProperty("message_key", hit.messageKey);
            JsonArray mods = new JsonArray();
            hit.modIds.forEach(mods::add);
            row.add("mod_ids", mods);
            if (!hit.jarNames.isEmpty()) {
                JsonArray jars = new JsonArray();
                hit.jarNames.forEach(jars::add);
                row.add("jar_names", jars);
            }
            out.add(row);
        }
        return out;
    }

    private static void parseMultiblock(String text, List<Issue> issues) {
        String[] lines = text.split("\\R");
        Issue current = null;
        StringBuilder messageBuf = new StringBuilder();
        for (String raw : lines) {
            String line = raw.stripTrailing();
            Matcher header = HEADER.matcher(line.strip());
            if (header.matches()) {
                if (current != null) {
                    finalizeIssue(current, messageBuf);
                    issues.add(current);
                }
                current = new Issue();
                if (header.group(1) != null && !header.group(1).isBlank()) {
                    current.modId = header.group(1).strip();
                    current.modIds.add(current.modId);
                }
                messageBuf.setLength(0);
                continue;
            }
            if (current == null) {
                continue;
            }
            if (line.strip().startsWith("-- ") && line.strip().endsWith(" --")) {
                finalizeIssue(current, messageBuf);
                issues.add(current);
                current = null;
                messageBuf.setLength(0);
                continue;
            }
            Matcher id = MOD_ID.matcher(line);
            if (id.matches()) {
                current.modId = id.group(1).strip();
                current.modIds.add(current.modId);
                continue;
            }
            Matcher file = MOD_FILE.matcher(line);
            if (file.matches()) {
                current.file = file.group(1).strip();
                current.jarNames.addAll(jarNamesFromLine(current.file));
                continue;
            }
            Matcher fail = FAILURE.matcher(line);
            if (fail.matches()) {
                current.message = fail.group(1).strip();
                continue;
            }
            Matcher kind = ISSUE_KIND.matcher(line);
            if (kind.matches()) {
                current.kind = normalizeKind(kind.group(1).strip());
                continue;
            }
            if (!line.isBlank() && !line.strip().equals("Details:")) {
                if (messageBuf.length() > 0) {
                    messageBuf.append(' ');
                }
                messageBuf.append(line.strip());
            }
        }
        if (current != null) {
            finalizeIssue(current, messageBuf);
            issues.add(current);
        }
    }

    private static void parseBanners(String text, List<Issue> issues) {
        String[] lines = text.split("\\R");
        for (int i = 0; i < lines.length; i++) {
            String line = lines[i];
            BannerKind kind = detectBanner(line);
            if (kind == null || !line.contains("]: ")) {
                continue;
            }
            if (i + 1 >= lines.length || !isMessageContinuation(lines[i + 1])) {
                continue;
            }
            Issue issue = new Issue();
            issue.kind = kind.issueKind;
            issue.banner = true;
            issue.priority = kind.priority;
            String after = line.substring(line.indexOf("]: ") + 3).strip();
            issue.message = after;
            StringBuilder msg = new StringBuilder(after);
            for (int j = i + 1; j < lines.length; j++) {
                if (!isMessageContinuation(lines[j])) {
                    break;
                }
                String cont = lines[j].stripLeading();
                if (msg.length() > 0) {
                    msg.append(' ');
                }
                msg.append(cont);
                issue.modIds.addAll(modIdsFromQuotedLabels(lines[j]));
                issue.jarNames.addAll(jarNamesFromLine(lines[j]));
            }
            issue.message = msg.toString().strip();
            if (!issue.modIds.isEmpty()) {
                issue.modId = issue.modIds.iterator().next();
            }
            issues.add(issue);
        }
    }

    private static BannerKind detectBanner(String line) {
        if (line == null) {
            return null;
        }
        String lower = line.toLowerCase(Locale.ROOT);
        if (lower.contains("missing or unsupported mandatory dependencies:")) {
            return BannerKind.MISSING_UNSUPPORTED;
        }
        if (lower.contains("conflicts between mods:")
                || lower.contains("incompatibilities between mods:")) {
            return BannerKind.CONFLICTS;
        }
        if (lower.contains("unsupported installed optional dependencies:")) {
            return BannerKind.OPTIONAL_UNSUPPORTED;
        }
        if (lower.contains("some of your mods are incompatible with the game or each other")) {
            return BannerKind.PRELOAD_INCOMPAT;
        }
        return null;
    }

    /**
     * Indented FML detail lines after a banner (and a few known non-timestamp continuations).
     */
    static boolean isMessageContinuation(String line) {
        if (line == null || line.isEmpty()) {
            return false;
        }
        String trimmed = line.strip();
        if (trimmed.equals("More details:")
                || trimmed.equals("A potential solution has been determined, this may resolve your problem:")) {
            return true;
        }
        char first = line.charAt(0);
        if (first != ' ' && first != '\t') {
            return false;
        }
        if (trimmed.contains("Issues may arise. Continue at your own risk.")) {
            return false;
        }
        return true;
    }

    static List<String> modIdsFromQuotedLabels(String line) {
        List<String> modIds = new ArrayList<>();
        if (line == null || line.isBlank()) {
            return modIds;
        }
        String[] parts = line.split("'");
        for (int i = 0; i < parts.length - 1; i++) {
            String prefix = parts[i];
            if (prefix.endsWith("Mod ID: ")
                    || prefix.endsWith("Requested by: ")
                    || prefix.endsWith("Mod ")
                    || prefix.endsWith("discourages ")) {
                String id = parts[i + 1].strip();
                if (!id.isEmpty() && !"[MISSING]".equalsIgnoreCase(id)) {
                    modIds.add(id);
                }
            }
        }
        return modIds;
    }

    private static List<String> jarNamesFromLine(String line) {
        List<String> jars = new ArrayList<>();
        if (line == null) {
            return jars;
        }
        Matcher m = JAR_NAME.matcher(line);
        while (m.find()) {
            jars.add(m.group(1));
        }
        return jars;
    }

    private static JsonObject issueToJson(Issue issue) {
        JsonObject row = new JsonObject();
        if (issue.modId != null) {
            row.addProperty("mod_id", issue.modId);
        }
        row.addProperty("kind", issue.kind != null ? issue.kind : "mod_load_failed");
        if (issue.message != null) {
            row.addProperty("message", issue.message);
        }
        if (issue.file != null) {
            row.addProperty("file", issue.file);
        }
        if (!issue.modIds.isEmpty()) {
            JsonArray arr = new JsonArray();
            issue.modIds.forEach(arr::add);
            row.add("mod_ids", arr);
        }
        if (!issue.jarNames.isEmpty()) {
            JsonArray arr = new JsonArray();
            issue.jarNames.forEach(arr::add);
            row.add("jar_names", arr);
        }
        if (issue.banner) {
            row.addProperty("banner", true);
            row.addProperty("priority", issue.priority);
            // Rank: priority ≥ 80 is boot-relevant (rank 1); lower is Issues-only (rank ≥ 2)
            row.addProperty("rank", issue.priority >= 80 ? 1 : 2);
        }
        return row;
    }

    private static void finalizeIssue(Issue issue, StringBuilder messageBuf) {
        if ((issue.message == null || issue.message.isBlank()) && messageBuf.length() > 0) {
            issue.message = messageBuf.toString().strip();
        }
        if (issue.kind == null || issue.kind.isBlank()) {
            issue.kind = inferKind(issue.message);
        } else {
            issue.kind = normalizeKind(issue.kind);
        }
        if (issue.modId != null && !issue.modId.isBlank()) {
            issue.modIds.add(issue.modId);
        }
    }

    private static String normalizeKind(String raw) {
        if (raw == null) {
            return "mod_load_failed";
        }
        String k = raw.strip().toLowerCase(Locale.ROOT).replace(' ', '_');
        if (k.contains("depend")) {
            return "mod_load_dependency";
        }
        if (k.contains("conflict") || k.contains("incompat")) {
            return "mod_load_dependency";
        }
        if (k.contains("corrupt")) {
            return "mod_corrupt";
        }
        if (k.contains("fail") || k.contains("load")) {
            return "mod_load_failed";
        }
        return k;
    }

    private static String inferKind(String message) {
        if (message == null) {
            return "mod_load_failed";
        }
        String lower = message.toLowerCase(Locale.ROOT);
        if (lower.contains("missing dependency") || lower.contains("requires")
                || lower.contains("mandatory depend") || lower.contains("conflicts between")
                || lower.contains("incompatibilit")) {
            return "mod_load_dependency";
        }
        if (lower.contains("corrupt") || lower.contains("does not exist")) {
            return "mod_corrupt";
        }
        return "mod_load_failed";
    }

    private enum BannerKind {
        MISSING_UNSUPPORTED("fml_missing_unsupported_dependencies", 100,
                "fml.missing_unsupported_dependencies", "mod_load_dependency"),
        CONFLICTS("fml_conflicts_between_mods", 90,
                "fml.conflicts_between_mods", "mod_load_dependency"),
        PRELOAD_INCOMPAT("fml_preload_incompatible", 85,
                "fml.preload_incompatible", "mod_load_dependency"),
        OPTIONAL_UNSUPPORTED("fml_unsupported_optional_dependencies", 40,
                "fml.unsupported_optional_dependencies", "mod_load_dependency");

        final String id;
        final int priority;
        final String messageKey;
        final String issueKind;

        BannerKind(String id, int priority, String messageKey, String issueKind) {
            this.id = id;
            this.priority = priority;
            this.messageKey = messageKey;
            this.issueKind = issueKind;
        }
    }

    private static final class PatternHit {
        String id;
        int priority;
        String messageKey;
        final Set<String> modIds = new LinkedHashSet<>();
        final Set<String> jarNames = new LinkedHashSet<>();
    }

    private static final class Issue {
        String modId;
        String kind;
        String message;
        String file;
        boolean banner;
        int priority;
        final Set<String> modIds = new LinkedHashSet<>();
        final Set<String> jarNames = new LinkedHashSet<>();

        int rank() {
            if ("mod_load_dependency".equals(kind)) {
                return 0;
            }
            if ("mod_corrupt".equals(kind)) {
                return 1;
            }
            return 2;
        }
    }
}
