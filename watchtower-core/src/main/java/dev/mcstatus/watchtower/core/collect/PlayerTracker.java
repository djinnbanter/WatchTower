package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Track join/leave events within the lookback window (ported from Python).
 */
public final class PlayerTracker {

    private final ZonedDateTime windowEnd;
    private final Map<String, ZonedDateTime> online = new HashMap<>();
    private int peakConcurrent;
    private final Set<String> uniquePlayers = new HashSet<>();
    private double totalSeconds;
    private final List<JsonObject> sessions = new ArrayList<>();
    private final List<PlayerEvent> events = new ArrayList<>();

    public PlayerTracker(ZonedDateTime windowEnd) {
        this.windowEnd = windowEnd;
    }

    private void updatePeak() {
        peakConcurrent = Math.max(peakConcurrent, online.size());
    }

    public void join(String name, ZonedDateTime when) {
        uniquePlayers.add(name);
        events.add(new PlayerEvent(when, "join", name));
        online.putIfAbsent(name, when);
        updatePeak();
    }

    public void leave(String name, ZonedDateTime when) {
        events.add(new PlayerEvent(when, "leave", name));
        ZonedDateTime start = online.remove(name);
        if (start != null) {
            double secs = Math.max(0.0, CollectSupport.epochSeconds(when) - CollectSupport.epochSeconds(start));
            totalSeconds += secs;
            JsonObject session = new JsonObject();
            session.addProperty("player", name);
            session.addProperty("join", CollectSupport.iso(start));
            session.addProperty("leave", CollectSupport.iso(when));
            session.addProperty("minutes", Math.round(secs / 60.0 * 10.0) / 10.0);
            sessions.add(session);
        }
        updatePeak();
    }

    public void disconnectAllAt(ZonedDateTime when) {
        for (String name : new ArrayList<>(online.keySet())) {
            leave(name, when);
        }
    }

    public int concurrentAt(ZonedDateTime when) {
        Set<String> atTime = new HashSet<>();
        List<PlayerEvent> sorted = new ArrayList<>(events);
        sorted.sort(Comparator.comparing(e -> e.when));
        for (PlayerEvent ev : sorted) {
            if (ev.when.isAfter(when)) {
                break;
            }
            if ("join".equals(ev.action)) {
                atTime.add(ev.name);
            } else if ("leave".equals(ev.action)) {
                atTime.remove(ev.name);
            }
        }
        return atTime.size();
    }

    public JsonObject finalizeStats() {
        for (Map.Entry<String, ZonedDateTime> entry : new ArrayList<>(online.entrySet())) {
            double secs = Math.max(0.0,
                    CollectSupport.epochSeconds(windowEnd) - CollectSupport.epochSeconds(entry.getValue()));
            totalSeconds += secs;
            JsonObject session = new JsonObject();
            session.addProperty("player", entry.getKey());
            session.addProperty("join", CollectSupport.iso(entry.getValue()));
            session.add("leave", null);
            session.addProperty("minutes", Math.round(secs / 60.0 * 10.0) / 10.0);
            sessions.add(session);
        }
        online.clear();

        JsonObject result = new JsonObject();
        result.addProperty("peak_concurrent", peakConcurrent);
        result.addProperty("unique_players", uniquePlayers.size());
        result.addProperty("player_hours", Math.round(totalSeconds / 3600.0 * 10.0) / 10.0);
        JsonArray sessionArr = new JsonArray();
        int start = Math.max(0, sessions.size() - 20);
        for (int i = start; i < sessions.size(); i++) {
            sessionArr.add(sessions.get(i));
        }
        result.add("sessions", sessionArr);
        return result;
    }

    public static void replayPlayerEvents(PlayerTracker tracker, List<PlayerRawEvent> rawEvents) {
        List<PlayerRawEvent> sorted = new ArrayList<>(rawEvents);
        sorted.sort(Comparator.comparing(e -> e.when));
        for (PlayerRawEvent ev : sorted) {
            switch (ev.action) {
                case "join" -> tracker.join(ev.name, ev.when);
                case "leave" -> tracker.leave(ev.name, ev.when);
                case "server_stop", "server_start" -> tracker.disconnectAllAt(ev.when);
                default -> { }
            }
        }
    }

    public record PlayerRawEvent(ZonedDateTime when, String action, String name) {
    }

    private record PlayerEvent(ZonedDateTime when, String action, String name) {
    }
}
