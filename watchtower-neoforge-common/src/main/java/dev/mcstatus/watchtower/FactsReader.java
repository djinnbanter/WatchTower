package dev.mcstatus.watchtower;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

public final class FactsReader {
    public record IssueSummary(String id, String severity, String message, String detailLine) {
        public IssueSummary(String severity, String message) {
            this(null, severity, message, null);
        }
    }

    public record IssueCounts(int activeCount, int historicalCount, List<IssueSummary> activeIssues) {
        public static IssueCounts empty() {
            return new IssueCounts(0, 0, List.of());
        }
    }

    private FactsReader() {
    }

    public static IssueCounts readIssueCounts(Path factsPath) {
        if (factsPath == null || !Files.isRegularFile(factsPath)) {
            return IssueCounts.empty();
        }
        try {
            String text = Files.readString(factsPath, StandardCharsets.UTF_8);
            JsonObject root = JsonParser.parseString(text).getAsJsonObject();
            return parseIssues(root);
        } catch (IOException | RuntimeException e) {
            WatchtowerMod.LOGGER.debug("Failed to read facts issues: {}", e.toString());
            return IssueCounts.empty();
        }
    }

    public static IssueCounts readIssueCountsFromJson(JsonObject root) {
        if (root == null) {
            return IssueCounts.empty();
        }
        try {
            return parseIssues(root);
        } catch (RuntimeException e) {
            return IssueCounts.empty();
        }
    }

    public static String crashDetailLine(JsonObject facts) {
        if (facts == null || !facts.has("optional")) {
            return null;
        }
        JsonObject optional = facts.getAsJsonObject("optional");
        if (!optional.has("crash_summaries")) {
            return null;
        }
        JsonArray summaries = optional.getAsJsonArray("crash_summaries");
        if (summaries.isEmpty()) {
            return null;
        }
        JsonObject first = summaries.get(0).getAsJsonObject();
        String exception = stringField(first, "exception");
        String modFile = stringField(first, "mod_file");
        if (exception != null && !exception.isBlank() && modFile != null && !modFile.isBlank()) {
            return exception + " (" + modFile + ")";
        }
        if (exception != null && !exception.isBlank()) {
            return exception;
        }
        return stringField(first, "summary");
    }

    private static IssueCounts parseIssues(JsonObject root) {
        if (!root.has("issues") || !root.get("issues").isJsonArray()) {
            return IssueCounts.empty();
        }
        String crashDetail = crashDetailLine(root);
        JsonArray issues = root.getAsJsonArray("issues");
        int active = 0;
        int historical = 0;
        List<IssueSummary> activeList = new ArrayList<>();
        for (JsonElement el : issues) {
            if (!el.isJsonObject()) {
                continue;
            }
            JsonObject issue = el.getAsJsonObject();
            boolean isHistorical = issue.has("historical") && issue.get("historical").getAsBoolean();
            if (isHistorical) {
                historical++;
            } else {
                active++;
                String id = issue.has("id") ? issue.get("id").getAsString() : null;
                String severity = issue.has("severity") ? issue.get("severity").getAsString() : "info";
                String message = issue.has("message") ? issue.get("message").getAsString() : "";
                String detail = "CRASH_REPORT".equals(id) ? crashDetail : null;
                activeList.add(new IssueSummary(id, severity, message, detail));
            }
        }
        return new IssueCounts(active, historical, List.copyOf(activeList));
    }

    private static String stringField(JsonObject obj, String key) {
        if (!obj.has(key) || obj.get(key).isJsonNull()) {
            return null;
        }
        return obj.get(key).getAsString();
    }
}
