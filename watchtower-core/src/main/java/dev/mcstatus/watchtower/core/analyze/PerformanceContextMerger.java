package dev.mcstatus.watchtower.core.analyze;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.ops.OpsCacheSchema;

import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

/**
 * Merges ops-cache activity, lag issues, and pin incidents into related events for the Performance tab.
 */
public final class PerformanceContextMerger {

    public static final int MAX_RELATED_EVENTS = 50;

    private PerformanceContextMerger() {
    }

    public static JsonArray buildRelatedEvents(PerformanceContext context) {
        List<JsonObject> events = new ArrayList<>();
        if (context == null) {
            return toArray(events);
        }
        long start = context.windowStartEpochSec();
        Set<String> seen = new HashSet<>();

        JsonObject opsCache = context.opsCache();
        if (opsCache != null && opsCache.has(OpsCacheSchema.ACTIVITY)) {
            JsonObject activity = opsCache.getAsJsonObject(OpsCacheSchema.ACTIVITY);
            if (activity.has(OpsCacheSchema.ACTIVITY_EVENTS)) {
                for (JsonElement el : activity.getAsJsonArray(OpsCacheSchema.ACTIVITY_EVENTS)) {
                    if (!el.isJsonObject()) {
                        continue;
                    }
                    JsonObject ev = el.getAsJsonObject();
                    String type = str(ev, OpsCacheSchema.EVENT_TYPE);
                    if (!"performance_spike".equals(type) && !"tick_lag".equals(type)) {
                        continue;
                    }
                    addIfInWindow(events, seen, ev, type, start);
                }
            }
        }

        if (opsCache != null && opsCache.has(OpsCacheSchema.LAG_ISSUES)) {
            JsonObject lagIssues = opsCache.getAsJsonObject(OpsCacheSchema.LAG_ISSUES);
            if (lagIssues.has(OpsCacheSchema.LAG_ISSUES_ENTRIES)) {
                for (JsonElement el : lagIssues.getAsJsonArray(OpsCacheSchema.LAG_ISSUES_ENTRIES)) {
                    if (!el.isJsonObject()) {
                        continue;
                    }
                    JsonObject entry = el.getAsJsonObject();
                    JsonObject ev = new JsonObject();
                    String time = str(entry, "time");
                    if (time == null) {
                        continue;
                    }
                    ev.addProperty(OpsCacheSchema.EVENT_TIME, time);
                    ev.addProperty(OpsCacheSchema.EVENT_TYPE, "lag_incident");
                    ev.addProperty(OpsCacheSchema.EVENT_DETAIL,
                            entry.has("title") ? entry.get("title").getAsString()
                                    : "Lag incident detected");
                    ev.addProperty(OpsCacheSchema.EVENT_SOURCE, str(entry, "source"));
                    if (entry.has("incident_id")) {
                        ev.addProperty(OpsCacheSchema.EVENT_INCIDENT_ID, entry.get("incident_id").getAsString());
                    }
                    addIfInWindow(events, seen, ev, "lag_incident", start);
                }
            }
        }

        for (JsonObject incident : context.incidents()) {
            JsonObject ev = new JsonObject();
            String time = incident.has("pinned_at") ? incident.get("pinned_at").getAsString()
                    : incident.has("id") ? incident.get("id").getAsString() : null;
            if (time == null) {
                continue;
            }
            ev.addProperty(OpsCacheSchema.EVENT_TIME, time);
            ev.addProperty(OpsCacheSchema.EVENT_TYPE, "pin");
            String detail = incident.has("note") ? incident.get("note").getAsString()
                    : incident.has("narrative") ? incident.get("narrative").getAsString()
                    : "Manual lag pin";
            ev.addProperty(OpsCacheSchema.EVENT_DETAIL, detail);
            ev.addProperty(OpsCacheSchema.EVENT_SOURCE, "pin");
            if (incident.has("id")) {
                ev.addProperty(OpsCacheSchema.EVENT_INCIDENT_ID, incident.get("id").getAsString());
            }
            addIfInWindow(events, seen, ev, "pin", start);
        }

        events.sort(Comparator.comparingLong((JsonObject e) -> -eventEpoch(e)));
        return toArray(events.subList(0, Math.min(MAX_RELATED_EVENTS, events.size())));
    }

    public static JsonArray enrichCorrelations(
            JsonArray base,
            JsonObject busyQuiet,
            JsonArray relatedEvents
    ) {
        List<JsonObject> out = new ArrayList<>();
        for (int i = 0; i < base.size(); i++) {
            out.add(base.get(i).getAsJsonObject().deepCopy());
        }

        if (relatedEvents != null && relatedEvents.size() > 0 && busyQuiet != null) {
            Set<Integer> busyHours = new HashSet<>();
            JsonArray busy = busyQuiet.getAsJsonArray("busy_hours");
            for (int i = 0; i < busy.size(); i++) {
                busyHours.add(busy.get(i).getAsJsonObject().get("hour_utc").getAsInt());
            }
            if (!busyHours.isEmpty()) {
                int inBusy = 0;
                for (int i = 0; i < relatedEvents.size(); i++) {
                    JsonObject ev = relatedEvents.get(i).getAsJsonObject();
                    String type = str(ev, OpsCacheSchema.EVENT_TYPE);
                    if (!"lag_incident".equals(type) && !"tick_lag".equals(type)) {
                        continue;
                    }
                    int hour = hourFromEvent(ev);
                    if (hour >= 0 && busyHours.contains(hour)) {
                        inBusy++;
                    }
                }
                int lagLike = countLagLike(relatedEvents);
                if (lagLike > 0) {
                    int pct = Math.round(100f * inBusy / lagLike);
                    if (pct >= 40) {
                        out.add(0, correlation(
                                "lag_busy_hours",
                                "info",
                                "Lag events cluster in busy hours",
                                pct + "% of lag-related events in window fell in typically busy UTC hours."));
                    }
                }
            }
        }

        JsonArray arr = new JsonArray();
        for (int i = 0; i < Math.min(6, out.size()); i++) {
            arr.add(out.get(i));
        }
        return arr;
    }

    private static int countLagLike(JsonArray relatedEvents) {
        int n = 0;
        for (int i = 0; i < relatedEvents.size(); i++) {
            String type = str(relatedEvents.get(i).getAsJsonObject(), OpsCacheSchema.EVENT_TYPE);
            if ("lag_incident".equals(type) || "tick_lag".equals(type) || "performance_spike".equals(type)) {
                n++;
            }
        }
        return n;
    }

    private static int hourFromEvent(JsonObject ev) {
        String time = str(ev, OpsCacheSchema.EVENT_TIME);
        if (time == null) {
            time = str(ev, "ts");
        }
        if (time == null) {
            return -1;
        }
        try {
            return Instant.parse(time).atZone(java.time.ZoneOffset.UTC).getHour();
        } catch (Exception e) {
            return -1;
        }
    }

    private static void addIfInWindow(
            List<JsonObject> events,
            Set<String> seen,
            JsonObject ev,
            String type,
            long windowStart
    ) {
        long epoch = eventEpoch(ev);
        if (epoch < windowStart) {
            return;
        }
        String key = type + "|" + str(ev, OpsCacheSchema.EVENT_TIME) + "|" + str(ev, OpsCacheSchema.EVENT_DETAIL);
        if (!seen.add(key)) {
            return;
        }
        JsonObject normalized = new JsonObject();
        normalized.addProperty("ts", str(ev, OpsCacheSchema.EVENT_TIME));
        normalized.addProperty("type", type);
        normalized.addProperty("title", titleForType(type));
        normalized.addProperty("detail", str(ev, OpsCacheSchema.EVENT_DETAIL));
        normalized.addProperty("tab_link", tabForType(type));
        if (ev.has(OpsCacheSchema.EVENT_INCIDENT_ID)) {
            normalized.addProperty("incident_id", ev.get(OpsCacheSchema.EVENT_INCIDENT_ID).getAsString());
        }
        events.add(normalized);
    }

    private static String titleForType(String type) {
        return switch (type) {
            case "performance_spike" -> "Sticky lag after players left";
            case "tick_lag" -> "Server tick lag";
            case "lag_incident" -> "Lag incident";
            case "pin" -> "Lag pin snapshot";
            default -> type;
        };
    }

    private static String tabForType(String type) {
        return switch (type) {
            case "lag_incident" -> "issues";
            case "pin" -> "activity";
            default -> "activity";
        };
    }

    private static long eventEpoch(JsonObject ev) {
        String time = str(ev, OpsCacheSchema.EVENT_TIME);
        if (time == null) {
            time = ev.has("ts") ? ev.get("ts").getAsString() : null;
        }
        if (time == null) {
            return 0;
        }
        try {
            return Instant.parse(time).getEpochSecond();
        } catch (Exception e) {
            return 0;
        }
    }

    private static JsonObject correlation(String id, String severity, String title, String detail) {
        JsonObject o = new JsonObject();
        o.addProperty("id", id);
        o.addProperty("severity", severity);
        o.addProperty("title", title);
        o.addProperty("detail", detail);
        return o;
    }

    private static String str(JsonObject o, String key) {
        if (o == null || !o.has(key) || o.get(key).isJsonNull()) {
            return null;
        }
        return o.get(key).getAsString();
    }

    private static JsonArray toArray(List<JsonObject> items) {
        JsonArray arr = new JsonArray();
        items.forEach(arr::add);
        return arr;
    }
}
