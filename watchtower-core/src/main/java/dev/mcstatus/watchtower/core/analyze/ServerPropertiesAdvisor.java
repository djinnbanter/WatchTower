package dev.mcstatus.watchtower.core.analyze;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonPrimitive;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Adaptive server.properties advice for Spark captures (and reusable by launch audit).
 * Soft “consider” language only — never writes files.
 */
public final class ServerPropertiesAdvisor {

    public static final String VERDICT_FINE = "fine";
    public static final String VERDICT_CONSIDER_LOWERING = "consider_lowering";
    public static final String VERDICT_CONSIDER_RAISING = "consider_raising";
    public static final String VERDICT_UNKNOWN = "unknown";

    private static final Set<String> ADVISED_KEYS = Set.of(
            "view-distance",
            "simulation-distance",
            "player-idle-timeout",
            "sync-chunk-writes",
            "region-file-compression",
            "entity-broadcast-range-percentage",
            "max-chained-neighbor-updates",
            "network-compression-threshold",
            "max-tick-time",
            "use-native-transport",
            "spawn-protection",
            "pause-when-empty-seconds",
            "rate-limit");

    private ServerPropertiesAdvisor() {
    }

    public record HostSignals(
            double cpuPct,
            double heapPct,
            double ramPct,
            double swapPct,
            double ramTotalGb,
            int players,
            double msptP95,
            double tps
    ) {
        public static HostSignals empty() {
            return new HostSignals(0, 0, 0, 0, 0, 0, 0, 20);
        }
    }

    /** Build host signals from a Spark profile facts object. */
    public static HostSignals hostSignalsFromProfile(JsonObject profile) {
        if (profile == null) {
            return HostSignals.empty();
        }
        JsonObject system = object(profile, "system");
        JsonObject context = object(profile, "context");
        JsonObject cpu = object(system, "cpu");
        JsonObject memory = object(system, "memory");
        JsonObject heap = object(context, "jvm_heap");

        double cpuPct = number(cpu, "process_1m", 0);
        if (!"percent".equalsIgnoreCase(text(cpu, "usage_unit", "percent"))) {
            cpuPct = cpuPct * 100.0;
        }
        double usedMb = number(heap, "used_mb", 0);
        double maxMb = number(heap, "max_mb", 0);
        double heapPct = maxMb > 0 ? (usedMb / maxMb) * 100.0 : 0;
        double ramUsed = number(memory, "physical_used_gb", 0);
        double ramTotal = number(memory, "physical_total_gb", 0);
        double ramPct = ramTotal > 0 ? (ramUsed / ramTotal) * 100.0 : 0;
        double swapUsed = number(memory, "swap_used_gb", 0);
        double swapTotal = number(memory, "swap_total_gb", 0);
        double swapPct = swapTotal > 0 ? (swapUsed / swapTotal) * 100.0 : 0;
        int players = (int) Math.round(number(context, "players", 0));
        double mspt = number(context, "mspt_p95_1m", number(context, "mspt_mean_1m", 0));
        double tps = number(context, "tps_1m", number(context, "tps", 20));
        return new HostSignals(cpuPct, heapPct, ramPct, swapPct, ramTotal, players, mspt, tps);
    }

    /**
     * Advise on selected (or full) properties. Only emits rows for keys present in {@code props}
     * that are in the advised performance set.
     */
    public static JsonArray advise(JsonObject props, HostSignals host) {
        JsonArray out = new JsonArray();
        if (props == null || props.entrySet().isEmpty()) {
            return out;
        }
        HostSignals signals = host != null ? host : HostSignals.empty();
        DistancePlan distances = planDistances(props, signals);

        for (String key : orderedKeys(props)) {
            if (!ADVISED_KEYS.contains(key) || !props.has(key) || props.get(key).isJsonNull()) {
                continue;
            }
            String current = primitiveString(props.get(key));
            JsonObject row = switch (key) {
                case "view-distance" -> adviseViewDistance(current, distances, signals);
                case "simulation-distance" -> adviseSimulationDistance(current, distances, signals);
                case "sync-chunk-writes" -> adviseSyncChunkWrites(current);
                case "entity-broadcast-range-percentage" -> adviseEntityBroadcast(current, props, signals);
                case "player-idle-timeout" -> adviseIdleTimeout(current, signals);
                case "max-chained-neighbor-updates" -> adviseChainedNeighbor(current);
                case "network-compression-threshold" -> adviseCompression(current);
                case "max-tick-time" -> adviseMaxTickTime(current);
                case "use-native-transport" -> adviseNativeTransport(current);
                case "region-file-compression" -> adviseRegionCompression(current);
                case "spawn-protection" -> adviseSpawnProtection(current);
                case "pause-when-empty-seconds" -> advisePauseWhenEmpty(current);
                case "rate-limit" -> adviseRateLimit(current);
                default -> null;
            };
            if (row != null) {
                out.add(row);
            }
        }
        return out;
    }

    /** Convenience: read selected props + host from a Spark profile and attach advice. */
    public static void attachToProfile(JsonObject profile) {
        if (profile == null) {
            return;
        }
        JsonObject capture = object(profile, "capture");
        JsonObject selected = object(capture, "selected_server_properties");
        if (selected.entrySet().isEmpty()) {
            // Fall back to parsing full server.properties blob when selected is empty.
            selected = parseServerPropertiesBlob(object(capture, "server_configurations"));
        }
        JsonArray advice = advise(selected, hostSignalsFromProfile(profile));
        if (!advice.isEmpty()) {
            profile.add("settings_advice", advice);
        }
    }

    private static JsonObject parseServerPropertiesBlob(JsonObject configs) {
        JsonObject out = new JsonObject();
        if (!configs.has("server.properties") || !configs.get("server.properties").isJsonPrimitive()) {
            return out;
        }
        try {
            JsonObject parsed = com.google.gson.JsonParser.parseString(
                    configs.get("server.properties").getAsString()).getAsJsonObject();
            for (String key : ADVISED_KEYS) {
                if (parsed.has(key) && parsed.get(key).isJsonPrimitive()) {
                    out.add(key, parsed.get(key));
                }
            }
        } catch (Exception ignored) {
            return out;
        }
        return out;
    }

    private record DistancePlan(int view, int sim, String bandView, String bandSim, List<String> drivers, String reason) {
    }

    private static DistancePlan planDistances(JsonObject props, HostSignals host) {
        int currentView = parseInt(primitiveString(props.get("view-distance")), 10);
        int currentSim = parseInt(primitiveString(props.get("simulation-distance")), Math.min(10, currentView));

        int view;
        int sim;
        // RAM + player tier baselines (GameTeam-style).
        if (host.players() >= 15 || host.ramPct() >= 75) {
            view = 6;
            sim = 4;
        } else if (host.players() <= 5 && host.ramTotalGb() >= 16 && host.ramPct() < 60) {
            view = 9;
            sim = 5;
        } else if (host.players() <= 5 && host.ramPct() < 70) {
            view = 8;
            sim = 5;
        } else {
            view = 7;
            sim = 4;
        }

        List<String> drivers = new ArrayList<>();
        StringBuilder reason = new StringBuilder();

        boolean cpuHot = host.cpuPct() >= 70;
        boolean tickHot = host.msptP95() >= 40 || host.tps() < 18;
        boolean cpuPressure = cpuHot || tickHot;
        boolean memPressure = host.heapPct() >= 80 || host.ramPct() >= 85;
        boolean swapPressure = host.swapPct() >= 10;

        if (cpuPressure) {
            sim = Math.max(3, sim - (host.cpuPct() >= 85 || host.msptP95() >= 50 ? 2 : 1));
            if (cpuHot) {
                drivers.add("cpu");
            }
            if (host.msptP95() >= 40) {
                drivers.add("mspt");
            }
            if (host.tps() < 18) {
                drivers.add("tps");
            }
            if (cpuHot) {
                reason.append(String.format(Locale.US, "CPU %.0f%% — prefer lowering simulation-distance first. ", host.cpuPct()));
            }
            if (host.msptP95() >= 40) {
                reason.append(String.format(Locale.US, "MSPT p95 %.0fms — prefer lowering simulation-distance first. ", host.msptP95()));
            } else if (host.tps() < 18 && !cpuHot) {
                reason.append(String.format(Locale.US, "TPS %.1f — prefer lowering simulation-distance first. ", host.tps()));
            }
        }
        if (memPressure) {
            view = Math.max(4, view - (host.heapPct() >= 90 || host.ramPct() >= 90 ? 2 : 1));
            if (host.heapPct() >= 80) {
                drivers.add("heap");
            }
            if (host.ramPct() >= 85) {
                drivers.add("ram");
            }
            reason.append(String.format(Locale.US,
                    "Memory pressure (heap %.0f%%, RAM %.0f%%) — lower view-distance. ",
                    host.heapPct(), host.ramPct()));
        }
        if (swapPressure) {
            view = Math.max(4, view - 2);
            sim = Math.max(3, sim - 1);
            drivers.add("swap");
            reason.append(String.format(Locale.US,
                    "Swap %.0f%% in use — cut distances more aggressively. ", host.swapPct()));
        }
        if (host.players() > 0) {
            drivers.add("players");
        }

        // Never recommend raising distances when under pressure; when calm, don't push above current.
        if (cpuPressure || memPressure || swapPressure) {
            view = Math.min(view, currentView);
            sim = Math.min(sim, currentSim);
        } else {
            // Calm: recommend current if already in a healthy band, else gently suggest the tier target
            // but never above current (we don't push people to raise without evidence).
            if (currentView >= 4 && currentView <= 10) {
                view = currentView;
            } else if (currentView > 10) {
                view = Math.min(view, currentView);
            } else {
                view = Math.max(view, currentView);
            }
            if (currentSim >= 3 && currentSim <= 8) {
                sim = Math.min(currentSim, view);
            } else if (currentSim > 8) {
                sim = Math.min(sim, currentSim);
            }
        }

        sim = Math.min(sim, view);
        view = Math.max(4, Math.min(32, view));
        sim = Math.max(3, Math.min(view, sim));

        if (reason.isEmpty()) {
            reason.append("Based on player count and host memory for a modded dedicated server.");
        }

        LinkedHashSet<String> unique = new LinkedHashSet<>(drivers);
        return new DistancePlan(
                view,
                sim,
                "6–10",
                "4–8",
                List.copyOf(unique),
                reason.toString().trim());
    }

    private static JsonObject adviseViewDistance(String current, DistancePlan plan, HostSignals host) {
        int cur = parseInt(current, -1);
        String recommended = String.valueOf(plan.view());
        String verdict = VERDICT_FINE;
        if (cur > plan.view()) {
            verdict = VERDICT_CONSIDER_LOWERING;
        } else if (cur >= 0 && cur < 4) {
            verdict = VERDICT_CONSIDER_RAISING;
        }
        String detail = cur == plan.view()
                ? "View distance " + current + " matches the adaptive target for this capture."
                : plan.reason() + " Suggested view-distance=" + recommended + " (band " + plan.bandView() + ").";
        return row("view-distance", "View distance", current, recommended, plan.bandView(), verdict, detail, plan.drivers());
    }

    private static JsonObject adviseSimulationDistance(String current, DistancePlan plan, HostSignals host) {
        int cur = parseInt(current, -1);
        String recommended = String.valueOf(plan.sim());
        String verdict = VERDICT_FINE;
        if (cur > plan.sim()) {
            verdict = VERDICT_CONSIDER_LOWERING;
        } else if (cur >= 0 && cur < 3) {
            verdict = VERDICT_CONSIDER_RAISING;
        }
        String detail = cur == plan.sim()
                ? "Simulation distance " + current + " matches the adaptive target for this capture."
                : plan.reason() + " Suggested simulation-distance=" + recommended
                + " (band " + plan.bandSim() + "). Keep sim ≤ view.";
        return row("simulation-distance", "Simulation distance", current, recommended, plan.bandSim(),
                verdict, detail, plan.drivers());
    }

    private static JsonObject adviseSyncChunkWrites(String current) {
        boolean on = parseBool(current, true);
        String recommended = "false";
        String verdict = on ? VERDICT_CONSIDER_LOWERING : VERDICT_FINE;
        String detail = on
                ? "sync-chunk-writes=true can stutter the tick loop on dedicated hosts — consider false (Paper already forces this)."
                : "Async chunk writes (false) — fine for dedicated servers.";
        return row("sync-chunk-writes", "Sync chunk writes", current, recommended, "false",
                verdict, detail, List.of());
    }

    private static JsonObject adviseEntityBroadcast(String current, JsonObject props, HostSignals host) {
        int cur = parseInt(current, 100);
        int view = parseInt(primitiveString(props.get("view-distance")), 10);
        boolean pressure = host.cpuPct() >= 70 || host.msptP95() >= 40 || view >= 12;
        int target = pressure && cur >= 100 ? (view >= 16 ? 50 : 75) : Math.min(cur, 100);
        if (cur <= 100 && !pressure) {
            target = cur;
        }
        String recommended = String.valueOf(target);
        String verdict = cur > target ? VERDICT_CONSIDER_LOWERING : VERDICT_FINE;
        List<String> drivers = new ArrayList<>();
        if (pressure) {
            if (host.cpuPct() >= 70) {
                drivers.add("cpu");
            }
            if (view >= 12) {
                drivers.add("view-distance");
            }
        }
        String detail = cur > 100
                ? "Entity broadcast above 100% tracks farther than default and can cost more in dense areas."
                : (cur > target
                ? "With high view-distance/CPU pressure, consider lowering entity broadcast toward " + recommended + "%."
                : "Entity broadcast " + current + "% is in a common range.");
        return row("entity-broadcast-range-percentage", "Entity broadcast range", current, recommended,
                "50–100", verdict, detail, drivers);
    }

    private static JsonObject adviseIdleTimeout(String current, HostSignals host) {
        int cur = parseInt(current, -1);
        String recommended = cur == 0 ? "30" : (cur > 0 ? current : "30");
        String verdict = cur == 0 ? VERDICT_CONSIDER_RAISING : VERDICT_FINE;
        List<String> drivers = host.players() > 0 ? List.of("players") : List.of();
        String detail = cur == 0
                ? "player-idle-timeout=0 never kicks AFK players — they can keep chunks loaded. Consider 30–60 minutes."
                : "Idle kick is enabled (" + current + " minutes).";
        return row("player-idle-timeout", "Player idle timeout", current, recommended, "30–60",
                verdict, detail, drivers);
    }

    private static JsonObject adviseChainedNeighbor(String current) {
        int cur = parseInt(current, 1_000_000);
        String recommended = cur >= 500_000 ? "100000" : current;
        String verdict = cur >= 500_000 ? VERDICT_CONSIDER_LOWERING : VERDICT_FINE;
        String detail = cur >= 500_000
                ? "Neighbor-update chain limit " + current + " is very high — consider 100000 to limit redstone/hopper storms."
                : "Neighbor-update chain limit looks reasonable.";
        return row("max-chained-neighbor-updates", "Max chained neighbor updates", current, recommended,
                "100000", verdict, detail, List.of());
    }

    private static JsonObject adviseCompression(String current) {
        int cur = parseInt(current, 256);
        String recommended = "256";
        String verdict = VERDICT_FINE;
        if (cur == 0 || cur > 1024) {
            verdict = cur == 0 ? VERDICT_CONSIDER_RAISING : VERDICT_CONSIDER_LOWERING;
        } else if (cur >= 64 && cur <= 512) {
            recommended = current;
        }
        String detail = cur == 0
                ? "Compression is off (0). Consider 256 to reduce bandwidth."
                : (cur > 1024
                ? cur + " is high — packets compress less often. Consider 256."
                : "Compression threshold " + current + " is in a common range.");
        return row("network-compression-threshold", "Network compression", current, recommended, "256",
                verdict, detail, List.of());
    }

    private static JsonObject adviseMaxTickTime(String current) {
        int cur = parseInt(current, 60000);
        String recommended = (cur == -1 || cur >= 60000) ? current : "60000";
        if (cur > 0 && cur < 60000) {
            recommended = "60000";
        } else if (cur == -1) {
            recommended = "-1";
        } else if (cur >= 60000) {
            recommended = current;
        }
        String verdict = (cur == -1 || cur >= 60000) ? VERDICT_FINE : VERDICT_CONSIDER_RAISING;
        String detail = (cur == -1 || cur >= 60000)
                ? "Watchdog headroom looks fine for modded dedicated servers."
                : cur + "ms is below 60000 — the watchdog can kill a modded server during heavy ticks.";
        return row("max-tick-time", "Max tick time", current, recommended, "60000 or -1",
                verdict, detail, List.of());
    }

    private static JsonObject adviseNativeTransport(String current) {
        boolean on = parseBool(current, true);
        String recommended = "true";
        String verdict = on ? VERDICT_FINE : VERDICT_CONSIDER_RAISING;
        String detail = on
                ? "Native transport enabled — fine on Linux."
                : "Consider use-native-transport=true on Linux for optimized networking.";
        return row("use-native-transport", "Native transport", current, recommended, "true",
                verdict, detail, List.of());
    }

    private static JsonObject adviseRegionCompression(String current) {
        String v = current == null ? "" : current.trim().toLowerCase(Locale.ROOT);
        String recommended = ("lz4".equals(v) || "deflate".equals(v)) ? current : "deflate";
        String verdict = VERDICT_FINE;
        String detail = "deflate is the common default; lz4 is fine on modern JVMs.";
        return row("region-file-compression", "Region file compression", current, recommended, "deflate",
                verdict, detail, List.of());
    }

    private static JsonObject adviseSpawnProtection(String current) {
        int cur = parseInt(current, 16);
        String recommended = current;
        String verdict = VERDICT_FINE;
        String detail = "Spawn protection " + current + " is an ops choice — not a primary lag lever.";
        if (cur > 32) {
            recommended = "16";
            verdict = VERDICT_CONSIDER_LOWERING;
            detail = "Large spawn-protection radii rarely help performance; 16 is a common default.";
        }
        return row("spawn-protection", "Spawn protection", current, recommended, "0–16",
                verdict, detail, List.of());
    }

    private static JsonObject advisePauseWhenEmpty(String current) {
        int cur = parseInt(current, -1);
        String recommended = current;
        String verdict = VERDICT_FINE;
        String detail = "Pause-when-empty is an ops choice for idle hosts.";
        if (cur == 0) {
            recommended = "60";
            verdict = VERDICT_CONSIDER_RAISING;
            detail = "Consider pausing when empty to free idle CPU (e.g. 60 seconds).";
        }
        return row("pause-when-empty-seconds", "Pause when empty", current, recommended, "60 or -1",
                verdict, detail, List.of());
    }

    private static JsonObject adviseRateLimit(String current) {
        int cur = parseInt(current, 0);
        String recommended = current;
        String verdict = VERDICT_FINE;
        String detail = "Packet rate-limit " + current + " — leave alone unless you are mitigating connection abuse.";
        return row("rate-limit", "Rate limit", current, recommended, "0", verdict, detail, List.of());
    }

    private static JsonObject row(
            String key,
            String title,
            String value,
            String recommended,
            String band,
            String verdict,
            String detail,
            List<String> drivers
    ) {
        JsonObject row = new JsonObject();
        row.addProperty("key", key);
        row.addProperty("title", title);
        if (value != null) {
            row.addProperty("value", value);
        }
        if (recommended != null) {
            row.addProperty("recommended", recommended);
        }
        if (band != null) {
            row.addProperty("band", band);
        }
        row.addProperty("verdict", verdict);
        row.addProperty("detail", detail);
        JsonArray driverArr = new JsonArray();
        if (drivers != null) {
            for (String d : drivers) {
                if (d != null && !d.isBlank()) {
                    driverArr.add(d);
                }
            }
        }
        row.add("drivers", driverArr);
        return row;
    }

    private static List<String> orderedKeys(JsonObject props) {
        List<String> keys = new ArrayList<>();
        for (String key : ADVISED_KEYS) {
            if (props.has(key)) {
                keys.add(key);
            }
        }
        for (Map.Entry<String, JsonElement> e : props.entrySet()) {
            if (!keys.contains(e.getKey()) && ADVISED_KEYS.contains(e.getKey())) {
                keys.add(e.getKey());
            }
        }
        return keys;
    }

    private static JsonObject object(JsonObject parent, String key) {
        if (parent == null || !parent.has(key) || !parent.get(key).isJsonObject()) {
            return new JsonObject();
        }
        return parent.getAsJsonObject(key);
    }

    private static double number(JsonObject obj, String key, double fallback) {
        if (obj == null || !obj.has(key) || !obj.get(key).isJsonPrimitive()) {
            return fallback;
        }
        try {
            return obj.get(key).getAsDouble();
        } catch (Exception e) {
            return fallback;
        }
    }

    private static String text(JsonObject obj, String key, String fallback) {
        if (obj == null || !obj.has(key) || !obj.get(key).isJsonPrimitive()) {
            return fallback;
        }
        String v = obj.get(key).getAsString();
        return v == null || v.isBlank() ? fallback : v;
    }

    private static String primitiveString(JsonElement el) {
        if (el == null || el.isJsonNull() || !el.isJsonPrimitive()) {
            return "";
        }
        JsonPrimitive p = el.getAsJsonPrimitive();
        return p.isString() ? p.getAsString() : p.toString();
    }

    private static int parseInt(String raw, int fallback) {
        if (raw == null || raw.isBlank()) {
            return fallback;
        }
        try {
            return Integer.parseInt(raw.trim());
        } catch (NumberFormatException e) {
            return fallback;
        }
    }

    private static boolean parseBool(String raw, boolean fallback) {
        if (raw == null || raw.isBlank()) {
            return fallback;
        }
        String v = raw.trim().toLowerCase(Locale.ROOT);
        if ("true".equals(v)) {
            return true;
        }
        if ("false".equals(v)) {
            return false;
        }
        return fallback;
    }
}
