package dev.mcstatus.watchtower.core.rules;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import dev.mcstatus.watchtower.core.report.StateManager;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.regex.PatternSyntaxException;

/**
 * Merges conf {@code issue_suppressions} with {@code state.json} suppressed_issues (CA-27).
 * Filters Issues queue only — never crash groups (G-05 safe).
 */
public final class IssueSuppressionStore {

    private final Set<String> confIds;
    private final Pattern confRegex;
    private final List<Suppression> stateEntries;
    private final Path statePath;

    public record Suppression(String id, String at, String by) {
        public JsonObject toJson() {
            JsonObject o = new JsonObject();
            o.addProperty("id", id);
            if (at != null) {
                o.addProperty("at", at);
            }
            if (by != null) {
                o.addProperty("by", by);
            }
            return o;
        }
    }

    private IssueSuppressionStore(
            Set<String> confIds,
            Pattern confRegex,
            List<Suppression> stateEntries,
            Path statePath
    ) {
        this.confIds = Set.copyOf(confIds);
        this.confRegex = confRegex;
        this.stateEntries = List.copyOf(stateEntries);
        this.statePath = statePath;
    }

    public static IssueSuppressionStore load(Path statePath, String confCsv, String confRegex) {
        Set<String> ids = parseCsv(confCsv);
        Pattern pat = null;
        if (confRegex != null && !confRegex.isBlank()) {
            try {
                pat = Pattern.compile(confRegex, Pattern.CASE_INSENSITIVE);
            } catch (PatternSyntaxException ignored) {
                pat = null;
            }
        }
        List<Suppression> state = new ArrayList<>();
        if (statePath != null && Files.isRegularFile(statePath)) {
            try {
                JsonArray arr = StateManager.getSuppressedIssues(statePath);
                for (JsonElement el : arr) {
                    if (!el.isJsonObject()) {
                        continue;
                    }
                    JsonObject o = el.getAsJsonObject();
                    String id = o.has("id") ? o.get("id").getAsString() : null;
                    if (id == null || id.isBlank()) {
                        continue;
                    }
                    state.add(new Suppression(
                            id,
                            o.has("at") ? o.get("at").getAsString() : null,
                            o.has("by") ? o.get("by").getAsString() : "operator"
                    ));
                }
            } catch (Exception ignored) {
                // soft-fail
            }
        }
        return new IssueSuppressionStore(ids, pat, state, statePath);
    }

    public boolean isSuppressed(String issueId) {
        if (issueId == null || issueId.isBlank()) {
            return false;
        }
        String id = issueId.trim();
        for (String c : confIds) {
            if (c.equalsIgnoreCase(id)) {
                return true;
            }
        }
        if (confRegex != null && confRegex.matcher(id).find()) {
            return true;
        }
        for (Suppression s : stateEntries) {
            if (s.id().equalsIgnoreCase(id)) {
                return true;
            }
        }
        return false;
    }

    public JsonArray filterActive(JsonArray issues) {
        JsonArray out = new JsonArray();
        if (issues == null) {
            return out;
        }
        for (JsonElement el : issues) {
            if (!el.isJsonObject()) {
                out.add(el);
                continue;
            }
            JsonObject issue = el.getAsJsonObject();
            String id = issueIdOf(issue);
            if (isSuppressed(id)) {
                continue;
            }
            out.add(issue.deepCopy());
        }
        return out;
    }

    public JsonArray filterSuppressedOnly(JsonArray issues) {
        JsonArray out = new JsonArray();
        if (issues == null) {
            return out;
        }
        for (JsonElement el : issues) {
            if (!el.isJsonObject()) {
                continue;
            }
            JsonObject issue = el.getAsJsonObject();
            String id = issueIdOf(issue);
            if (isSuppressed(id)) {
                JsonObject copy = issue.deepCopy();
                copy.addProperty("suppressed", true);
                out.add(copy);
            }
        }
        return out;
    }

    public JsonObject snapshot() {
        JsonObject o = new JsonObject();
        JsonArray conf = new JsonArray();
        for (String id : confIds) {
            conf.add(id);
        }
        o.add("conf_ids", conf);
        if (confRegex != null) {
            o.addProperty("conf_regex", confRegex.pattern());
        }
        JsonArray state = new JsonArray();
        for (Suppression s : stateEntries) {
            state.add(s.toJson());
        }
        o.add("state", state);
        JsonArray all = new JsonArray();
        Set<String> seen = new LinkedHashSet<>();
        for (String id : confIds) {
            if (seen.add(id.toUpperCase(Locale.ROOT))) {
                JsonObject e = new JsonObject();
                e.addProperty("id", id);
                e.addProperty("source", "conf");
                all.add(e);
            }
        }
        for (Suppression s : stateEntries) {
            if (seen.add(s.id().toUpperCase(Locale.ROOT))) {
                JsonObject e = s.toJson();
                e.addProperty("source", "state");
                all.add(e);
            }
        }
        o.add("merged", all);
        return o;
    }

    public boolean suppress(String issueId, String by) throws IOException {
        if (issueId == null || issueId.isBlank() || statePath == null) {
            return false;
        }
        String id = issueId.trim();
        JsonArray arr = StateManager.getSuppressedIssues(statePath);
        for (JsonElement el : arr) {
            if (el.isJsonObject()) {
                JsonObject o = el.getAsJsonObject();
                if (o.has("id") && id.equalsIgnoreCase(o.get("id").getAsString())) {
                    return true;
                }
            }
        }
        JsonObject entry = new JsonObject();
        entry.addProperty("id", id);
        entry.addProperty("at", Instant.now().toString());
        entry.addProperty("by", by != null ? by : "operator");
        arr.add(entry);
        StateManager.setSuppressedIssues(statePath, arr);
        return true;
    }

    public boolean unsuppress(String issueId) throws IOException {
        if (issueId == null || issueId.isBlank() || statePath == null) {
            return false;
        }
        String id = issueId.trim();
        JsonArray arr = StateManager.getSuppressedIssues(statePath);
        JsonArray next = new JsonArray();
        boolean removed = false;
        for (JsonElement el : arr) {
            if (el.isJsonObject()) {
                JsonObject o = el.getAsJsonObject();
                if (o.has("id") && id.equalsIgnoreCase(o.get("id").getAsString())) {
                    removed = true;
                    continue;
                }
            }
            next.add(el);
        }
        if (removed) {
            StateManager.setSuppressedIssues(statePath, next);
        }
        return removed;
    }

    public static String issueIdOf(JsonObject issue) {
        if (issue == null) {
            return "";
        }
        for (String key : List.of("id", "issue_id", "code", "type")) {
            if (issue.has(key) && !issue.get(key).isJsonNull()) {
                try {
                    return issue.get(key).getAsString();
                } catch (Exception ignored) {
                    // continue
                }
            }
        }
        return "";
    }

    private static Set<String> parseCsv(String csv) {
        Set<String> out = new LinkedHashSet<>();
        if (csv == null || csv.isBlank()) {
            return out;
        }
        for (String part : csv.split(",")) {
            String t = part.trim();
            if (!t.isEmpty()) {
                out.add(t);
            }
        }
        return out;
    }
}
