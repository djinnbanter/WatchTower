package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonObject;

import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.regex.Matcher;

/**
 * Shared DH pregen log parsing and state assembly (reports + live tail).
 */
public final class PregenLogSupport {

    private PregenLogSupport() {
    }

    public static JsonObject buildEntryFromMatcher(Matcher pm, ZonedDateTime ts, String fileName, int lineNo) {
        String pctRaw = pm.group(4);
        String eta = pm.group(5) != null ? pm.group(5).strip().replaceAll("\\)+$", "") : "";
        String quote = "Generated radius: " + pm.group(1) + " / " + pm.group(2) + " chunks ("
                + pm.group(3) + " cps"
                + (pctRaw != null ? ", " + pctRaw + "%)" : ")")
                + (!eta.isEmpty() ? ", ETA: " + eta : "");
        JsonObject entry = new JsonObject();
        entry.addProperty("chunks", Double.parseDouble(pm.group(1)));
        entry.addProperty("total", Integer.parseInt(pm.group(2)));
        entry.addProperty("cps", Integer.parseInt(pm.group(3)));
        if (pctRaw != null) {
            entry.addProperty("pct", Double.parseDouble(pctRaw));
        } else {
            entry.add("pct", null);
        }
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

    public static void applyEntry(PregenState state, JsonObject entry, ZonedDateTime ts) {
        if (CollectSupport.pregenMeaningful(entry)) {
            if (state.pregenFirst == null
                    || ts.isBefore(CollectSupport.parseTime(state.pregenFirst.get("time").getAsString()))) {
                state.pregenFirst = entry.deepCopy();
            }
        }
        if (state.pregenLast == null
                || ts.isAfter(CollectSupport.parseTime(state.pregenLast.get("time").getAsString()))) {
            state.pregenLast = entry.deepCopy();
        }
        if (entry.has("cps") && !entry.get("cps").isJsonNull()) {
            int cps = entry.get("cps").getAsInt();
            if (cps > 0) {
                state.cpsVals.add(cps);
            }
        }
    }

    public static JsonObject buildDhPregen(
            JsonObject pregenFirst,
            JsonObject pregenLast,
            List<Integer> cpsVals,
            ZonedDateTime now,
            ZonedDateTime serverStarted) {
        if (pregenLast == null) {
            return null;
        }
        JsonObject dh = new JsonObject();
        dh.add("first", slicePregen(pregenFirst));
        dh.add("last", slicePregen(pregenLast));
        if (!cpsVals.isEmpty()) {
            double avg = cpsVals.stream().mapToInt(Integer::intValue).average().orElse(0);
            dh.addProperty("cps_avg", Math.round(avg * 10.0) / 10.0);
        } else {
            dh.add("cps_avg", null);
        }
        if (pregenLast.has("time")) {
            ZonedDateTime lastPregen = CollectSupport.parseTime(pregenLast.get("time").getAsString());
            if (lastPregen != null) {
                dh.addProperty("hours_since_last",
                        Math.round((CollectSupport.epochSeconds(now) - CollectSupport.epochSeconds(lastPregen))
                                / 3600.0 * 100.0) / 100.0);
            }
        }
        if (serverStarted != null && pregenLast.has("time")) {
            ZonedDateTime lastPregen = CollectSupport.parseTime(pregenLast.get("time").getAsString());
            if (lastPregen != null) {
                boolean paused = lastPregen.isBefore(serverStarted);
                dh.addProperty("pregen_paused", paused);
                double hoursSince = dh.has("hours_since_last") ? dh.get("hours_since_last").getAsDouble() : 99;
                dh.addProperty("pregen_active", !paused && hoursSince < 1);
            }
        }
        return dh;
    }

    public static JsonObject slicePregen(JsonObject entry) {
        if (entry == null) {
            return null;
        }
        JsonObject out = new JsonObject();
        for (String k : List.of("chunks", "total", "cps", "pct", "eta", "time", "file", "line", "quote")) {
            if (entry.has(k)) {
                out.add(k, entry.get(k));
            }
        }
        return out;
    }

    public static final class PregenState {
        public JsonObject pregenFirst;
        public JsonObject pregenLast;
        public final List<Integer> cpsVals = new ArrayList<>();
    }
}
