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
     * Pair mod_runtime primaries with a subsequent watchdog within 120s.
     * Mutates summaries in place: shared {@code incident_id}, follow-up {@code failure_kind}
     * {@code watchdog_followup}, and {@code paired_primary_file}.
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
            if (!CrashClassifier.FK_MOD_RUNTIME.equals(kind)) {
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
                break;
            }
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
