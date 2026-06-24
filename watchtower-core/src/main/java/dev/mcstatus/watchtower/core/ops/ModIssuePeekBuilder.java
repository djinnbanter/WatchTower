package dev.mcstatus.watchtower.core.ops;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.analyze.ModErrorCategory;
import dev.mcstatus.watchtower.core.analyze.ModHintEngine;

import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;

/**
 * Builds live mod issue peek entries from scan-sourced mod log error aggregates.
 */
public final class ModIssuePeekBuilder {

    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_OFFSET_DATE_TIME;
    private static final int MAX_PEEK_ENTRIES = 5;

    private ModIssuePeekBuilder() {
    }

    public static JsonArray buildPeekEntries(JsonArray modLogErrors) {
        return buildPeekEntries(modLogErrors, 0);
    }

    public static JsonArray buildPeekEntries(JsonArray modLogErrors, int seqBase) {
        if (modLogErrors == null || modLogErrors.isEmpty()) {
            return new JsonArray();
        }
        List<JsonObject> ranked = new ArrayList<>();
        for (JsonElement el : modLogErrors) {
            if (!el.isJsonObject()) {
                continue;
            }
            JsonObject row = el.getAsJsonObject();
            String modId = row.has("mod_id") ? row.get("mod_id").getAsString() : "";
            if ("client_noise".equals(modId)) {
                continue;
            }
            ranked.add(row);
        }
        ranked.sort(Comparator
                .comparingInt((JsonObject o) -> severityRank(o)).reversed()
                .thenComparing(Comparator.<JsonObject>comparingInt(
                        o -> o.has("total") ? o.get("total").getAsInt() : 0).reversed()));

        JsonArray out = new JsonArray();
        int seq = seqBase;
        for (JsonObject row : ranked) {
            if (out.size() >= MAX_PEEK_ENTRIES) {
                break;
            }
            out.add(buildPeekEntry(row, seq++));
        }
        return out;
    }

    public static JsonObject buildPeekEntry(JsonObject modErrorRow) {
        return buildPeekEntry(modErrorRow, 0);
    }

    public static JsonObject buildPeekEntry(JsonObject modErrorRow, int seq) {
        String modId = modErrorRow.has("mod_id") ? modErrorRow.get("mod_id").getAsString() : "unknown";
        int total = modErrorRow.has("total") ? modErrorRow.get("total").getAsInt() : 1;
        String topCat = modErrorRow.has("top_category") ? modErrorRow.get("top_category").getAsString() : "logger_error";
        String categoryLabel = modErrorRow.has("category_label")
                ? modErrorRow.get("category_label").getAsString()
                : topCat.replace('_', ' ');

        JsonObject entry = new JsonObject();
        entry.addProperty("id", "MOD-" + modId + "-" + seq);
        entry.addProperty("mod_id", modId);
        entry.addProperty("severity", severityName(severityRank(modErrorRow)));
        entry.addProperty("time", ZonedDateTime.now(ZoneId.systemDefault()).format(ISO));
        entry.addProperty("title", String.format(Locale.US, "%s — %d log error%s (%s)",
                modId, total, total == 1 ? "" : "s", categoryLabel));
        entry.addProperty("narrative", buildNarrative(modId, total, categoryLabel, modErrorRow));
        entry.addProperty("top_category", topCat);
        if (modErrorRow.has("sample_line")) {
            entry.addProperty("sample_line", modErrorRow.get("sample_line").getAsString());
        }
        entry.addProperty("source", OpsCacheSchema.SOURCE_SCAN);
        entry.addProperty("resolved", false);

        JsonArray hints = new JsonArray();
        String sample = modErrorRow.has("sample_line") ? modErrorRow.get("sample_line").getAsString() : null;
        JsonObject bundle = ModHintEngine.buildHintBundle(modId, topCat, sample);
        if (bundle.has("hints")) {
            bundle.getAsJsonArray("hints").forEach(hints::add);
        } else {
            ModHintEngine.buildHintStrings(modId, topCat, sample).forEach(hints::add);
        }
        entry.add("hints", hints);
        if (bundle.has("fix_steps")) {
            entry.add("fix_steps", bundle.getAsJsonArray("fix_steps").deepCopy());
        }
        if (bundle.has("doc_url")) {
            entry.addProperty("doc_url", bundle.get("doc_url").getAsString());
        }
        if (bundle.has("tech_hint_id")) {
            entry.addProperty("tech_hint_id", bundle.get("tech_hint_id").getAsString());
        }
        return entry;
    }

    private static String buildNarrative(String modId, int total, String categoryLabel, JsonObject row) {
        StringBuilder sb = new StringBuilder();
        sb.append(String.format(Locale.US, "%s logged %d error line%s in the scan window",
                modId, total, total == 1 ? "" : "s"));
        if (categoryLabel != null && !categoryLabel.isBlank()) {
            sb.append(" (").append(categoryLabel).append(")");
        }
        sb.append(".");
        if (row.has("sample_line")) {
            String sample = row.get("sample_line").getAsString();
            if (sample.length() > 100) {
                sample = sample.substring(0, 100) + "…";
            }
            sb.append(" Sample: ").append(sample);
        }
        return sb.toString();
    }

    private static int severityRank(JsonObject row) {
        if (!row.has("top_category")) {
            return ModErrorCategory.LOGGER_ERROR.severityRank();
        }
        String id = row.get("top_category").getAsString();
        for (ModErrorCategory c : ModErrorCategory.values()) {
            if (c.id().equals(id)) {
                return c.severityRank();
            }
        }
        return ModErrorCategory.LOGGER_ERROR.severityRank();
    }

    private static String severityName(int rank) {
        if (rank >= 4) {
            return "critical";
        }
        if (rank >= 2) {
            return "warning";
        }
        return "info";
    }
}
