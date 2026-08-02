package dev.mcstatus.watchtower.core.analyze;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.util.TimeParse;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * G-11: pair NPE/mod_runtime crashes with a watchdog within 120s (data only; UI in 1.0.14).
 */
public final class IncidentChainBuilder {

    private IncidentChainBuilder() {
    }

    /**
     * Pair mod_runtime / category=mod primaries with a subsequent watchdog within 120s.
     * Mutates summaries in place: shared {@code incident_id}, follow-up {@code failure_kind}
     * {@code watchdog_followup}, {@code paired_primary_file}, and primary mod ids from the prior crash.
     */
    public static void link(JsonArray summaries) {
        if (summaries == null || summaries.size() < 2) {
            return;
        }
        List<JsonObject> rows = new ArrayList<>();
        for (JsonElement el : summaries) {
            if (el.isJsonObject()) {
                rows.add(el.getAsJsonObject());
            }
        }
        rows.sort((a, b) -> {
            Instant ta = TimeParse.parseTime(str(a, "time"));
            Instant tb = TimeParse.parseTime(str(b, "time"));
            long ea = ta != null ? ta.getEpochSecond() : 0;
            long eb = tb != null ? tb.getEpochSecond() : 0;
            return Long.compare(ea, eb);
        });
        for (int i = 0; i < rows.size(); i++) {
            JsonObject primary = rows.get(i);
            String kind = str(primary, "failure_kind");
            if (!CrashClassifier.FK_MOD_RUNTIME.equals(kind)
                    && !"mod".equals(str(primary, "category"))) {
                continue;
            }
            Instant pt = TimeParse.parseTime(str(primary, "time"));
            if (pt == null) {
                continue;
            }
            for (int j = i + 1; j < rows.size(); j++) {
                JsonObject follow = rows.get(j);
                Instant ft = TimeParse.parseTime(str(follow, "time"));
                if (ft == null) {
                    continue;
                }
                long delta = ft.getEpochSecond() - pt.getEpochSecond();
                if (delta < 0 || delta > 120) {
                    break;
                }
                String fk = str(follow, "failure_kind");
                boolean watchdog = CrashClassifier.FK_WATCHDOG.equals(fk)
                        || CrashClassifier.FK_WATCHDOG_PREGEN.equals(fk)
                        || CrashClassifier.FK_WATCHDOG_FOLLOWUP.equals(fk)
                        || (str(follow, "exception") != null
                        && str(follow, "exception").contains("ServerHangWatchdog"));
                if (!watchdog) {
                    continue;
                }
                String incidentId = "inc-" + strOr(primary, "file", "x")
                        .replaceAll("[^a-zA-Z0-9._-]", "_");
                primary.addProperty("incident_id", incidentId);
                follow.addProperty("incident_id", incidentId);
                follow.addProperty("paired_primary_file", strOr(primary, "file", ""));
                follow.addProperty("failure_kind", CrashClassifier.FK_WATCHDOG_FOLLOWUP);
                String primaryMod = strOr(primary, "primary_mod_id", strOr(primary, "suspect_mod_id", ""));
                if (!primaryMod.isEmpty()) {
                    follow.addProperty("primary_mod_id", primaryMod);
                    follow.addProperty("suspect_mod_id", primaryMod);
                }
                if (!followTextContainsServerThread(follow)) {
                    follow.addProperty("missing_server_thread", true);
                }
                break;
            }
        }
    }

    private static boolean followTextContainsServerThread(JsonObject follow) {
        StringBuilder sb = new StringBuilder();
        append(sb, str(follow, "exception"));
        append(sb, str(follow, "description"));
        append(sb, str(follow, "summary"));
        append(sb, str(follow, "stack"));
        if (follow.has("stack_frames") && follow.get("stack_frames").isJsonArray()) {
            for (JsonElement el : follow.getAsJsonArray("stack_frames")) {
                if (el == null || el.isJsonNull()) {
                    continue;
                }
                if (el.isJsonPrimitive()) {
                    append(sb, el.getAsString());
                } else if (el.isJsonObject()) {
                    JsonObject frame = el.getAsJsonObject();
                    append(sb, str(frame, "raw"));
                    append(sb, str(frame, "class"));
                    append(sb, str(frame, "method"));
                    append(sb, str(frame, "mod_id"));
                }
            }
        }
        return sb.toString().contains("Server thread");
    }

    private static void append(StringBuilder sb, String value) {
        if (value != null && !value.isBlank()) {
            sb.append(value).append(' ');
        }
    }

    private static String str(JsonObject o, String key) {
        if (o == null || !o.has(key) || o.get(key).isJsonNull()) {
            return null;
        }
        return o.get(key).getAsString();
    }

    private static String strOr(JsonObject o, String key, String def) {
        String s = str(o, key);
        return s != null ? s : def;
    }
}
