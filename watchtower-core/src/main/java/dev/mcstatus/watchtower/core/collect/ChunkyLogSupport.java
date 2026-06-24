package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonObject;

import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;

/**
 * Chunky world pregen log parsing (live tail + report scans).
 */
public final class ChunkyLogSupport {

    private ChunkyLogSupport() {
    }

    public static JsonObject buildEntryFromMatcher(Matcher cm, ZonedDateTime ts, String fileName, int lineNo) {
        String dimension = cm.group(1);
        long processed = Long.parseLong(cm.group(2));
        double pct = Double.parseDouble(cm.group(3));
        String eta = cm.group(4) != null ? cm.group(4).strip() : "";
        double rate = Double.parseDouble(cm.group(5));
        long total = pct > 0 ? Math.round(processed * 100.0 / pct) : 0;

        String quote = "[Chunky] Task running for " + dimension + ". Processed: " + processed
                + " chunks (" + pct + "%), ETA: " + eta + ", Rate: " + rate + " cps";

        JsonObject entry = new JsonObject();
        entry.addProperty("dimension", dimension);
        entry.addProperty("chunks", processed);
        entry.addProperty("total", total);
        entry.addProperty("pct", pct);
        entry.addProperty("cps", Math.round(rate * 10.0) / 10.0);
        entry.addProperty("rate", rate);
        if (!eta.isEmpty()) {
            entry.addProperty("eta", eta);
        } else {
            entry.add("eta", null);
        }
        entry.addProperty("time", CollectSupport.iso(ts));
        entry.addProperty("file", fileName);
        entry.addProperty("line", lineNo);
        entry.addProperty("quote", quote);
        return entry;
    }

    public static void applyEntry(ChunkyState state, JsonObject entry, ZonedDateTime ts) {
        if (state.first == null
                || ts.isBefore(CollectSupport.parseTime(state.first.get("time").getAsString()))) {
            state.first = entry.deepCopy();
        }
        if (state.last == null
                || ts.isAfter(CollectSupport.parseTime(state.last.get("time").getAsString()))) {
            state.last = entry.deepCopy();
        }
        if (entry.has("rate") && !entry.get("rate").isJsonNull()) {
            double rate = entry.get("rate").getAsDouble();
            if (rate > 0) {
                state.rateVals.add(rate);
            }
        }
        state.lastProgressEpoch = (long) CollectSupport.epochSeconds(ts);
        state.paused = false;
    }

    public static void markPaused(ChunkyState state, ZonedDateTime ts) {
        state.paused = true;
        if (ts != null) {
            state.lastProgressEpoch = (long) CollectSupport.epochSeconds(ts);
        }
    }

    public static JsonObject buildChunkyPregen(
            JsonObject first,
            JsonObject last,
            List<Double> rateVals,
            ZonedDateTime now,
            ZonedDateTime serverStarted,
            ChunkyState state) {
        if (last == null) {
            return null;
        }
        JsonObject chunky = new JsonObject();
        chunky.add("first", slice(first));
        chunky.add("last", slice(last));
        if (!rateVals.isEmpty()) {
            double avg = rateVals.stream().mapToDouble(Double::doubleValue).average().orElse(0);
            chunky.addProperty("cps_avg", Math.round(avg * 10.0) / 10.0);
        } else {
            chunky.add("cps_avg", null);
        }
        if (last.has("time")) {
            ZonedDateTime lastTs = CollectSupport.parseTime(last.get("time").getAsString());
            if (lastTs != null) {
                chunky.addProperty("hours_since_last",
                        Math.round((CollectSupport.epochSeconds(now) - CollectSupport.epochSeconds(lastTs))
                                / 3600.0 * 100.0) / 100.0);
            }
        }
        boolean paused = state != null && state.paused;
        if (serverStarted != null && last.has("time")) {
            ZonedDateTime lastTs = CollectSupport.parseTime(last.get("time").getAsString());
            if (lastTs != null && lastTs.isBefore(serverStarted)) {
                paused = true;
            }
        }
        chunky.addProperty("pregen_paused", paused);
        double hoursSince = chunky.has("hours_since_last") ? chunky.get("hours_since_last").getAsDouble() : 99;
        chunky.addProperty("pregen_active", !paused && hoursSince < 1);
        if (state != null) {
            chunky.addProperty("chunk_gen_failures", state.chunkGenFailures);
        }
        return chunky;
    }

    public static JsonObject slice(JsonObject entry) {
        if (entry == null) {
            return null;
        }
        JsonObject out = new JsonObject();
        for (String k : List.of("dimension", "chunks", "total", "cps", "rate", "pct", "eta", "time", "file", "line", "quote")) {
            if (entry.has(k)) {
                out.add(k, entry.get(k));
            }
        }
        return out;
    }

    public static final class ChunkyState {
        public JsonObject first;
        public JsonObject last;
        public final List<Double> rateVals = new ArrayList<>();
        public long lastProgressEpoch;
        public long lastProcessed = -1;
        public long lastProcessedChangeEpoch;
        public boolean paused;
        public int chunkGenFailures;
        public boolean taskConfused;
    }
}
