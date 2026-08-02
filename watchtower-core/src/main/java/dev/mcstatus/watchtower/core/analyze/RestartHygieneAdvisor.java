package dev.mcstatus.watchtower.core.analyze;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Uptime & restart hygiene advisor (1.1.6). Pure evaluation — never restarts or schedules.
 *
 * <p>Suggests a maintenance restart when JVM uptime is long enough and recent GC/heap
 * metrics degrade versus the prior window. Quiet windows are UTC-canonical ISO instants.
 */
public final class RestartHygieneAdvisor {

    public static final long MIN_UPTIME_SEC = 36L * 3600L;
    public static final int MIN_SAMPLE_MINUTES = 180;
    public static final double GC_RISE_ABS = 0.5;
    public static final double GC_RISE_REL = 0.20;
    public static final double HEAP_SOFT_PCT = 85.0;
    public static final double HEAP_RISE_ABS = 10.0;
    public static final double GC_WARN_PCT = 10.0;
    public static final double HEAP_WARN_PCT = 90.0;
    public static final int MIN_CELL_SAMPLES = 10;

    private RestartHygieneAdvisor() {
    }

    /**
     * Evaluate restart hygiene. Input fields:
     * enabled, now (ISO), uptime_sec, current_stats, prior_stats, hour_of_week[].
     */
    public static JsonObject evaluate(JsonObject input) {
        if (input == null) {
            input = new JsonObject();
        }
        Instant now = parseNow(input);
        String checkedAt = now.toString();

        if (!bool(input, "enabled", true)) {
            return suppressed("disabled", checkedAt);
        }

        Double uptimeSec = jsonDouble(input, "uptime_sec");
        if (uptimeSec == null || uptimeSec < MIN_UPTIME_SEC) {
            return suppressed("low_uptime", checkedAt);
        }

        JsonObject current = obj(input, "current_stats");
        JsonObject prior = obj(input, "prior_stats");
        if (current == null || prior == null) {
            return suppressed("insufficient_metrics", checkedAt);
        }
        int curSamples = (int) dbl(current, "sample_minutes", 0);
        int priorSamples = (int) dbl(prior, "sample_minutes", 0);
        if (curSamples < MIN_SAMPLE_MINUTES || priorSamples < MIN_SAMPLE_MINUTES) {
            return suppressed("insufficient_metrics", checkedAt);
        }

        Double curGc = jsonDouble(current, "gc_pause_pct_avg");
        Double priorGc = jsonDouble(prior, "gc_pause_pct_avg");
        Double curHeap = jsonDouble(current, "heap_pressure_pct_p95");
        if (curHeap == null) {
            curHeap = jsonDouble(current, "heap_pressure_pct_avg");
        }
        Double priorHeap = jsonDouble(prior, "heap_pressure_pct_p95");
        if (priorHeap == null) {
            priorHeap = jsonDouble(prior, "heap_pressure_pct_avg");
        }

        boolean gcRising = false;
        double gcDeltaPct = 0;
        if (curGc != null && priorGc != null) {
            double abs = curGc - priorGc;
            double rel = priorGc > 0 ? abs / priorGc : (abs > 0 ? 1.0 : 0);
            gcRising = abs >= GC_RISE_ABS && rel >= GC_RISE_REL;
            if (priorGc > 0) {
                gcDeltaPct = round1((abs / priorGc) * 100.0);
            } else if (abs > 0) {
                gcDeltaPct = 100.0;
            }
        }

        boolean heapBad = false;
        if (curHeap != null) {
            if (curHeap >= HEAP_SOFT_PCT) {
                heapBad = true;
            } else if (priorHeap != null && (curHeap - priorHeap) >= HEAP_RISE_ABS) {
                heapBad = true;
            }
        }

        if (!gcRising && !heapBad) {
            return suppressed("healthy_metrics", checkedAt);
        }

        JsonArray signals = new JsonArray();
        if (gcRising && curGc != null && priorGc != null) {
            JsonObject sig = new JsonObject();
            sig.addProperty("id", "gc_rising");
            sig.addProperty("current", round2(curGc));
            sig.addProperty("prior", round2(priorGc));
            sig.addProperty("delta_pct", gcDeltaPct);
            signals.add(sig);
        }
        if (curHeap != null) {
            JsonObject sig = new JsonObject();
            sig.addProperty("id", heapBad ? "heap_pressure" : "heap_stable");
            sig.addProperty("current", round2(curHeap));
            if (priorHeap != null) {
                sig.addProperty("prior", round2(priorHeap));
            }
            signals.add(sig);
        }

        boolean warn = (curGc != null && curGc >= GC_WARN_PCT)
                || (curHeap != null && curHeap >= HEAP_WARN_PCT);
        String severity = warn ? "warning" : "info";

        JsonObject out = new JsonObject();
        out.addProperty("active", true);
        out.addProperty("severity", severity);
        out.addProperty("headline", "Consider a maintenance restart");
        out.addProperty("uptime_sec", Math.round(uptimeSec));
        out.add("signals", signals);
        out.addProperty("checked_at", checkedAt);

        JsonArray hourOfWeek = arr(input, "hour_of_week");
        JsonObject quiet = findNextQuietWindow(hourOfWeek, now);
        if (quiet != null) {
            out.add("quiet_window", quiet);
        }
        return out;
    }

    /**
     * Rank adjacent two-hour UTC slots by avg_players then avg_mspt; fallback to best single hour.
     */
    public static JsonObject findNextQuietWindow(JsonArray hourOfWeek, Instant now) {
        if (hourOfWeek == null || hourOfWeek.size() == 0 || now == null) {
            return null;
        }
        Map<String, Cell> cells = new HashMap<>();
        for (JsonElement el : hourOfWeek) {
            if (!el.isJsonObject()) {
                continue;
            }
            JsonObject o = el.getAsJsonObject();
            int dow = (int) dbl(o, "dow", -1);
            int hour = (int) dbl(o, "hour_utc", -1);
            int samples = (int) dbl(o, "sample_minutes", 0);
            if (dow < 0 || hour < 0 || samples < MIN_CELL_SAMPLES) {
                continue;
            }
            cells.put(key(dow, hour), new Cell(
                    dow,
                    hour,
                    dbl(o, "avg_players", 0),
                    dbl(o, "avg_mspt", 0),
                    samples));
        }
        if (cells.isEmpty()) {
            return null;
        }

        ZonedDateTime zNow = now.atZone(ZoneOffset.UTC);
        List<Candidate> pairs = new ArrayList<>();
        List<Candidate> singles = new ArrayList<>();

        for (int dayOffset = 0; dayOffset < 7; dayOffset++) {
            ZonedDateTime day = zNow.plusDays(dayOffset).withMinute(0).withSecond(0).withNano(0);
            for (int hour = 0; hour < 24; hour++) {
                ZonedDateTime start = day.withHour(hour);
                if (!start.toInstant().isAfter(now)) {
                    continue;
                }
                int dow = start.getDayOfWeek().getValue() % 7;
                Cell a = cells.get(key(dow, hour));
                if (a == null) {
                    continue;
                }
                Instant startAt = start.toInstant();
                Instant endSingle = start.plusHours(1).toInstant();
                singles.add(new Candidate(startAt, endSingle, a.avgPlayers, a.avgMspt, a.samples));

                int nextHour = (hour + 1) % 24;
                ZonedDateTime nextStart = start.plusHours(1);
                int nextDow = nextStart.getDayOfWeek().getValue() % 7;
                Cell b = cells.get(key(nextDow, nextHour));
                if (b != null) {
                    double avgPlayers = (a.avgPlayers + b.avgPlayers) / 2.0;
                    double avgMspt = (a.avgMspt + b.avgMspt) / 2.0;
                    int samples = a.samples + b.samples;
                    pairs.add(new Candidate(
                            startAt, start.plusHours(2).toInstant(), avgPlayers, avgMspt, samples));
                }
            }
        }

        Candidate best = pickBest(pairs);
        if (best == null) {
            best = pickBest(singles);
        }
        if (best == null) {
            return null;
        }
        JsonObject quiet = new JsonObject();
        quiet.addProperty("next_start_at", best.startAt.toString());
        quiet.addProperty("next_end_at", best.endAt.toString());
        quiet.addProperty("avg_players", round2(best.avgPlayers));
        quiet.addProperty("avg_mspt", round1(best.avgMspt));
        quiet.addProperty("sample_minutes", best.samples);
        return quiet;
    }

    private static Candidate pickBest(List<Candidate> list) {
        if (list == null || list.isEmpty()) {
            return null;
        }
        list.sort(Comparator
                .comparingDouble((Candidate c) -> c.avgPlayers)
                .thenComparingDouble(c -> c.avgMspt)
                .thenComparing(c -> c.startAt));
        return list.getFirst();
    }

    private static JsonObject suppressed(String reason, String checkedAt) {
        JsonObject o = new JsonObject();
        o.addProperty("active", false);
        o.addProperty("suppressed_reason", reason);
        o.addProperty("checked_at", checkedAt);
        return o;
    }

    private static String key(int dow, int hour) {
        return dow + "|" + hour;
    }

    private static Instant parseNow(JsonObject input) {
        if (input.has("now") && !input.get("now").isJsonNull()) {
            try {
                return Instant.parse(input.get("now").getAsString());
            } catch (Exception ignored) {
            }
        }
        return Instant.now();
    }

    private static JsonObject obj(JsonObject o, String key) {
        if (o == null || !o.has(key) || !o.get(key).isJsonObject()) {
            return null;
        }
        return o.getAsJsonObject(key);
    }

    private static JsonArray arr(JsonObject o, String key) {
        if (o == null || !o.has(key) || !o.get(key).isJsonArray()) {
            return new JsonArray();
        }
        return o.getAsJsonArray(key);
    }

    private static boolean bool(JsonObject o, String key, boolean def) {
        if (o == null || !o.has(key) || o.get(key).isJsonNull()) {
            return def;
        }
        try {
            return o.get(key).getAsBoolean();
        } catch (Exception e) {
            return def;
        }
    }

    private static double dbl(JsonObject o, String key, double def) {
        Double v = jsonDouble(o, key);
        return v != null ? v : def;
    }

    private static Double jsonDouble(JsonObject o, String key) {
        if (o == null || !o.has(key) || o.get(key).isJsonNull()) {
            return null;
        }
        try {
            return o.get(key).getAsDouble();
        } catch (Exception e) {
            return null;
        }
    }

    private static double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }

    private static double round1(double v) {
        return Math.round(v * 10.0) / 10.0;
    }

    private record Cell(int dow, int hour, double avgPlayers, double avgMspt, int samples) {
    }

    private record Candidate(
            Instant startAt, Instant endAt, double avgPlayers, double avgMspt, int samples) {
    }
}
