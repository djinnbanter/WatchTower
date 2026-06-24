package dev.mcstatus.watchtower.core.brief;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.util.TimeParse;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Timeline ranking and event labeling ported from mc-status-analyze.py.
 */
public final class TimelineRanker {

    public static final Map<String, Integer> EVENT_IMPORTANCE = Map.ofEntries(
            Map.entry("crash_report", 10),
            Map.entry("kernel_oom", 10),
            Map.entry("oom", 10),
            Map.entry("reboot", 10),
            Map.entry("clean_stop", 8),
            Map.entry("abnormal_stop", 8),
            Map.entry("server_start", 8),
            Map.entry("session_close", 9),
            Map.entry("panel_command", 6),
            Map.entry("pregen_milestone", 3)
    );

    private TimelineRanker() {
    }

    public static int eventScore(JsonObject e) {
        if (e.has("importance") && !e.get("importance").isJsonNull()) {
            return e.get("importance").getAsInt();
        }
        String type = str(e, "type");
        return EVENT_IMPORTANCE.getOrDefault(type != null ? type : "", 1);
    }

    public static List<JsonObject> rankedTimeline(JsonArray events, int limit) {
        if (events == null) {
            return List.of();
        }
        List<JsonObject> filtered = new ArrayList<>();
        for (JsonElement el : events) {
            JsonObject e = el.getAsJsonObject();
            if (!"cron_noise".equals(str(e, "type"))) {
                filtered.add(e);
            }
        }

        List<JsonObject> crashes = new ArrayList<>();
        List<JsonObject> sessions = new ArrayList<>();
        List<JsonObject> others = new ArrayList<>();
        for (JsonObject e : filtered) {
            String type = str(e, "type");
            if ("crash_report".equals(type)) {
                crashes.add(e);
            } else if ("session_close".equals(type)) {
                sessions.add(e);
            } else {
                others.add(e);
            }
        }

        sessions.sort(Comparator
                .comparingInt((JsonObject e) -> "su_crafty".equals(str(e, "subtype")) ? 0 : 1)
                .thenComparingDouble(e -> -TimeParse.timeSortKey(str(e, "time"))));

        List<JsonObject> keptSessions = new ArrayList<>();
        for (int i = 0; i < Math.min(3, sessions.size()); i++) {
            keptSessions.add(sessions.get(i));
        }

        List<JsonObject> merged = new ArrayList<>(others);
        merged.addAll(keptSessions);
        merged.sort(Comparator.comparingDouble(e -> -TimeParse.timeSortKey(str(e, "time"))));

        int otherLimit = Math.max(0, limit - crashes.size());
        List<JsonObject> outOthers = new ArrayList<>();
        Set<Integer> seenReboot = new HashSet<>();

        for (JsonObject e : merged) {
            if ("reboot".equals(str(e, "type"))) {
                int sig = (int) TimeParse.timeSortKey(str(e, "time"));
                if (seenReboot.contains(sig)) {
                    continue;
                }
                seenReboot.add(sig);
            }
            outOthers.add(e);
            if (outOthers.size() >= otherLimit) {
                break;
            }
        }

        List<JsonObject> result = new ArrayList<>(crashes);
        result.addAll(outOthers);
        result.sort(Comparator.comparingDouble(e -> -TimeParse.timeSortKey(str(e, "time"))));
        if (result.size() > limit) {
            return new ArrayList<>(result.subList(0, limit));
        }
        return result;
    }

    public static List<JsonObject> rankedTimeline(JsonArray events) {
        return rankedTimeline(events, 15);
    }

    private static final Map<String, String> EVENT_LABELS = Map.ofEntries(
            Map.entry("reboot", "System reboot"),
            Map.entry("kernel_oom", "Kernel OOM"),
            Map.entry("oom", "OutOfMemoryError in log"),
            Map.entry("crash_report", "Crash report"),
            Map.entry("clean_stop", "Clean server stop"),
            Map.entry("server_start", "Server started"),
            Map.entry("panel_command", "Panel command")
    );

    public static String eventLabel(JsonObject e) {
        String etype = strOr(e, "type", "event");
        String detail = str(e, "detail");
        if (detail != null && detail.length() > 120) {
            detail = detail.substring(0, 120);
        }
        String subtype = str(e, "subtype");
        String prefix;
        if ("session_close".equals(etype)) {
            if ("su_crafty".equals(subtype)) {
                prefix = "Crafty su session closed";
            } else if ("sshd".equals(subtype)) {
                prefix = "SSH session closed";
            } else {
                prefix = "User session closed";
            }
        } else {
            prefix = EVENT_LABELS.getOrDefault(etype, titleCase(etype.replace('_', ' ')));
        }
        if (detail != null && !detail.isEmpty()) {
            return prefix + ": " + detail;
        }
        return prefix;
    }

    private static String titleCase(String s) {
        String[] words = s.split(" ");
        StringBuilder sb = new StringBuilder();
        for (String w : words) {
            if (w.isEmpty()) {
                continue;
            }
            if (!sb.isEmpty()) {
                sb.append(' ');
            }
            sb.append(Character.toUpperCase(w.charAt(0)));
            if (w.length() > 1) {
                sb.append(w.substring(1).toLowerCase(Locale.ROOT));
            }
        }
        return sb.toString();
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
