package dev.mcstatus.watchtower.core.analyze;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.collect.ServerPropertiesReader;

import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;

/**
 * Read-only launch &amp; config audit for dedicated servers (1.1.2).
 * Soft “consider” language only — never writes files.
 */
public final class ConfigLaunchAdvisor {

    public static final String VERDICT_FINE = "fine";
    public static final String VERDICT_CONSIDER_LOWERING = "consider_lowering";
    public static final String VERDICT_CONSIDER_RAISING = "consider_raising";
    public static final String VERDICT_MISSING = "missing";
    public static final String VERDICT_UNKNOWN = "unknown";

    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_OFFSET_DATE_TIME;

    private ConfigLaunchAdvisor() {
    }

    public static JsonObject build(ServerPropertiesReader.Result props, JsonObject jvmHealth) {
        JsonObject out = new JsonObject();
        out.addProperty("updated_at", Instant.now().atOffset(ZoneOffset.UTC).format(ISO));
        out.addProperty("source", "server.properties");
        out.addProperty("path", "server.properties");
        out.addProperty("read_only", true);

        if (props == null || !props.available()) {
            out.addProperty("status", "unavailable");
            out.addProperty("detail", props != null && props.error() != null
                    ? props.error()
                    : "Could not read server.properties");
            out.add("properties", new JsonArray());
            out.add("summary", summary(0, 0, 0));
            attachJvm(out, jvmHealth);
            return out;
        }

        out.addProperty("status", "ok");
        if (props.path() != null) {
            out.addProperty("path", props.path().getFileName().toString());
        }

        JsonArray rows = new JsonArray();
        addIntKey(rows, props, "view-distance", "View distance",
                6, 10, 3, 10,
                "6–10",
                "Higher view-distance loads more chunks per player — often the first place modded servers cut lag.",
                "Very low view-distance can feel abrupt for players; consider raising if intentional.");
        // simulation-distance: skip if absent (older MC)
        if (props.get("simulation-distance") != null) {
            addIntKey(rows, props, "simulation-distance", "Simulation distance",
                    4, 8, 3, 10,
                    "4–8",
                    "Higher simulation-distance keeps more chunks ticking — consider lowering on busy modded servers.",
                    "Very low simulation-distance can stall farms and redstone; consider raising if intentional.");
        }
        addMaxTickTime(rows, props);
        addCompression(rows, props);
        addSyncChunkWrites(rows, props);
        if (props.get("entity-broadcast-range-percentage") != null) {
            addEntityBroadcast(rows, props);
        }

        int fine = 0;
        int consider = 0;
        int missing = 0;
        for (int i = 0; i < rows.size(); i++) {
            String v = rows.get(i).getAsJsonObject().get("verdict").getAsString();
            if (VERDICT_FINE.equals(v)) {
                fine++;
            } else if (VERDICT_MISSING.equals(v)) {
                missing++;
            } else if (VERDICT_CONSIDER_LOWERING.equals(v) || VERDICT_CONSIDER_RAISING.equals(v)) {
                consider++;
            }
        }

        out.add("properties", rows);
        out.add("summary", summary(fine, consider, missing));
        attachJvm(out, jvmHealth);
        return out;
    }

    private static void addIntKey(
            JsonArray rows,
            ServerPropertiesReader.Result props,
            String key,
            String title,
            int fineLow,
            int fineHigh,
            int raiseBelowInclusive,
            int lowerAbove,
            String recommended,
            String lowerDetail,
            String raiseDetail
    ) {
        String raw = props.get(key);
        JsonObject row = baseRow(key, title, raw, recommended);
        if (raw == null || raw.isBlank()) {
            row.addProperty("verdict", VERDICT_MISSING);
            row.addProperty("detail", title + " is not set in server.properties.");
            rows.add(row);
            return;
        }
        Integer n = props.getInt(key);
        if (n == null) {
            row.addProperty("verdict", VERDICT_UNKNOWN);
            row.addProperty("detail", "Could not parse " + key + " as a number.");
            rows.add(row);
            return;
        }
        row.addProperty("value_num", n);
        if (n >= fineLow && n <= fineHigh) {
            row.addProperty("verdict", VERDICT_FINE);
            row.addProperty("detail", title + " " + n + " is in the usual range for modded dedicated servers.");
        } else if (n > lowerAbove) {
            row.addProperty("verdict", VERDICT_CONSIDER_LOWERING);
            row.addProperty("detail", n + " is above the usual " + fineLow + "–" + fineHigh
                    + " range for modded dedicated servers. " + lowerDetail);
        } else if (n <= raiseBelowInclusive) {
            row.addProperty("verdict", VERDICT_CONSIDER_RAISING);
            row.addProperty("detail", n + " is very low. " + raiseDetail);
        } else {
            // Between raiseBelow and fineLow (e.g. view-distance 4–5): treat as fine-ish / soft note
            row.addProperty("verdict", VERDICT_FINE);
            row.addProperty("detail", title + " " + n + " is a bit below the common 6–10 band but fine for many packs.");
        }
        rows.add(row);
    }

    private static void addMaxTickTime(JsonArray rows, ServerPropertiesReader.Result props) {
        String key = "max-tick-time";
        String raw = props.get(key);
        JsonObject row = baseRow(key, "Max tick time", raw, "60000 or -1");
        if (raw == null || raw.isBlank()) {
            row.addProperty("verdict", VERDICT_MISSING);
            row.addProperty("detail", "max-tick-time is not set.");
            rows.add(row);
            return;
        }
        Integer n = props.getInt(key);
        if (n == null) {
            row.addProperty("verdict", VERDICT_UNKNOWN);
            row.addProperty("detail", "Could not parse max-tick-time.");
            rows.add(row);
            return;
        }
        row.addProperty("value_num", n);
        if (n == -1 || n >= 60000) {
            row.addProperty("verdict", VERDICT_FINE);
            row.addProperty("detail", n == -1
                    ? "Watchdog is disabled (-1) — fine for many modded dedicated servers."
                    : "max-tick-time " + n + "ms gives the server room before a watchdog kill.");
        } else if (n > 0) {
            row.addProperty("verdict", VERDICT_CONSIDER_RAISING);
            row.addProperty("detail", n + "ms is below 60000 — the watchdog can kill a modded server during heavy ticks. Consider raising or setting -1.");
        } else {
            row.addProperty("verdict", VERDICT_UNKNOWN);
            row.addProperty("detail", "Unexpected max-tick-time value.");
        }
        rows.add(row);
    }

    private static void addCompression(JsonArray rows, ServerPropertiesReader.Result props) {
        String key = "network-compression-threshold";
        String raw = props.get(key);
        JsonObject row = baseRow(key, "Network compression", raw, "256");
        if (raw == null || raw.isBlank()) {
            row.addProperty("verdict", VERDICT_MISSING);
            row.addProperty("detail", "network-compression-threshold is not set.");
            rows.add(row);
            return;
        }
        Integer n = props.getInt(key);
        if (n == null) {
            row.addProperty("verdict", VERDICT_UNKNOWN);
            row.addProperty("detail", "Could not parse network-compression-threshold.");
            rows.add(row);
            return;
        }
        row.addProperty("value_num", n);
        if (n == 0) {
            row.addProperty("verdict", VERDICT_CONSIDER_RAISING);
            row.addProperty("detail", "Compression is off (0). Consider raising toward 256 to reduce bandwidth.");
        } else if (n > 1024) {
            row.addProperty("verdict", VERDICT_CONSIDER_LOWERING);
            row.addProperty("detail", n + " is high — packets compress less often. Consider lowering toward 256.");
        } else if (n >= 64 && n <= 512) {
            row.addProperty("verdict", VERDICT_FINE);
            row.addProperty("detail", "Compression threshold " + n + " is in a common range.");
        } else {
            row.addProperty("verdict", VERDICT_FINE);
            row.addProperty("detail", "Compression threshold " + n + " is acceptable.");
        }
        rows.add(row);
    }

    private static void addSyncChunkWrites(JsonArray rows, ServerPropertiesReader.Result props) {
        String key = "sync-chunk-writes";
        String raw = props.get(key);
        JsonObject row = baseRow(key, "Sync chunk writes", raw, "false");
        if (raw == null || raw.isBlank()) {
            row.addProperty("verdict", VERDICT_MISSING);
            row.addProperty("detail", "sync-chunk-writes is not set.");
            rows.add(row);
            return;
        }
        Boolean b = props.getBoolean(key);
        if (b == null) {
            row.addProperty("verdict", VERDICT_UNKNOWN);
            row.addProperty("detail", "Could not parse sync-chunk-writes.");
            rows.add(row);
            return;
        }
        if (b) {
            row.addProperty("verdict", VERDICT_CONSIDER_LOWERING);
            row.addProperty("detail", "sync-chunk-writes is true. Consider setting false on dedicated servers to reduce stutter from synchronous disk flushes.");
        } else {
            row.addProperty("verdict", VERDICT_FINE);
            row.addProperty("detail", "Async chunk writes (false) — fine for dedicated servers.");
        }
        rows.add(row);
    }

    private static void addEntityBroadcast(JsonArray rows, ServerPropertiesReader.Result props) {
        String key = "entity-broadcast-range-percentage";
        String raw = props.get(key);
        JsonObject row = baseRow(key, "Entity broadcast range", raw, "100");
        Integer n = props.getInt(key);
        if (n == null) {
            row.addProperty("verdict", VERDICT_UNKNOWN);
            row.addProperty("detail", "Could not parse entity-broadcast-range-percentage.");
            rows.add(row);
            return;
        }
        row.addProperty("value_num", n);
        if (n > 100) {
            row.addProperty("verdict", VERDICT_CONSIDER_LOWERING);
            row.addProperty("detail", n + "% sends entity updates farther than default. Consider lowering toward 100 or below on busy servers.");
        } else if (n >= 50) {
            row.addProperty("verdict", VERDICT_FINE);
            row.addProperty("detail", "Entity broadcast " + n + "% is in a common range.");
        } else {
            row.addProperty("verdict", VERDICT_FINE);
            row.addProperty("detail", "Entity broadcast " + n + "% is low — fine if intentional for performance.");
        }
        rows.add(row);
    }

    private static JsonObject baseRow(String key, String title, String raw, String recommended) {
        JsonObject row = new JsonObject();
        row.addProperty("key", key);
        row.addProperty("title", title);
        if (raw != null) {
            row.addProperty("value", raw);
        }
        if (recommended != null && !recommended.isBlank()) {
            row.addProperty("recommended", recommended);
        }
        row.addProperty("tab_link", "startup");
        return row;
    }

    private static JsonObject summary(int fine, int consider, int missing) {
        JsonObject s = new JsonObject();
        s.addProperty("fine", fine);
        s.addProperty("consider", consider);
        s.addProperty("missing", missing);
        return s;
    }

    private static void attachJvm(JsonObject out, JsonObject jvmHealth) {
        JsonObject jvm = new JsonObject();
        jvm.addProperty("tab_link", "insights");
        JsonObject params = new JsonObject();
        params.addProperty("view", "configs");
        jvm.add("tab_params", params);
        if (jvmHealth != null) {
            if (jvmHealth.has("flags_profile") && !jvmHealth.get("flags_profile").isJsonNull()) {
                jvm.addProperty("flags_profile", jvmHealth.get("flags_profile").getAsString());
            }
            if (jvmHealth.has("advice") && !jvmHealth.get("advice").isJsonNull()) {
                jvm.addProperty("advice", jvmHealth.get("advice").getAsString());
            }
            if (jvmHealth.has("verdict") && !jvmHealth.get("verdict").isJsonNull()) {
                jvm.addProperty("verdict", jvmHealth.get("verdict").getAsString());
            }
            if (jvmHealth.has("java_major") && !jvmHealth.get("java_major").isJsonNull()) {
                jvm.addProperty("java_major", jvmHealth.get("java_major").getAsInt());
            }
        } else {
            jvm.addProperty("advice", "Run a report or open Live to load JVM flag advice.");
        }
        out.add("jvm", jvm);
    }
}
