package dev.mcstatus.watchtower.core.analyze;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.time.Instant;
import java.util.LinkedHashSet;
import java.util.Set;

/**
 * Pending "restart after mod jar change" nudge (1.1.19). Pure JSON helpers.
 */
public final class ModRestartNudge {

    public static final String STATE_KEY = "mod_restart_pending";

    private ModRestartNudge() {
    }

    /** Record a jar basename that needs a server restart to take effect. */
    public static JsonObject recordChange(JsonObject pendingOrNull, String jarBasename, Instant now) {
        JsonObject pending = pendingOrNull != null ? pendingOrNull.deepCopy() : new JsonObject();
        Set<String> jars = jarSet(pending);
        if (jarBasename != null && !jarBasename.isBlank()) {
            jars.add(jarBasename.trim());
        }
        return toPending(jars, pending.has("since") ? pending.get("since").getAsString() : now.toString(), now);
    }

    /**
     * Clear when boot epoch advances past {@code since}, or when jars empty.
     *
     * @param bootEpochSec current process start epoch seconds (nullable → only clear if empty)
     */
    public static JsonObject maybeClear(JsonObject pendingOrNull, Long bootEpochSec) {
        if (pendingOrNull == null || pendingOrNull.entrySet().isEmpty()) {
            return inactive();
        }
        Set<String> jars = jarSet(pendingOrNull);
        if (jars.isEmpty()) {
            return inactive();
        }
        if (bootEpochSec != null && pendingOrNull.has("since_epoch")) {
            long sinceEpoch = pendingOrNull.get("since_epoch").getAsLong();
            if (bootEpochSec > sinceEpoch) {
                return inactive();
            }
        }
        return toMeta(pendingOrNull, true);
    }

    public static JsonObject toMeta(JsonObject pendingOrNull, boolean forceActive) {
        if (pendingOrNull == null) {
            return inactive();
        }
        Set<String> jars = jarSet(pendingOrNull);
        boolean active = forceActive && !jars.isEmpty();
        if (!active && jars.isEmpty()) {
            return inactive();
        }
        JsonObject meta = new JsonObject();
        meta.addProperty("active", !jars.isEmpty());
        meta.addProperty("message", "Mod jars changed — restart when ready");
        JsonArray arr = new JsonArray();
        for (String j : jars) {
            arr.add(j);
        }
        meta.add("jars", arr);
        if (pendingOrNull.has("since")) {
            meta.addProperty("since", pendingOrNull.get("since").getAsString());
        }
        return meta;
    }

    public static JsonObject inactive() {
        JsonObject meta = new JsonObject();
        meta.addProperty("active", false);
        meta.add("jars", new JsonArray());
        return meta;
    }

    private static JsonObject toPending(Set<String> jars, String sinceIso, Instant now) {
        JsonObject pending = new JsonObject();
        pending.addProperty("since", sinceIso != null ? sinceIso : now.toString());
        pending.addProperty("since_epoch", now.getEpochSecond());
        JsonArray arr = new JsonArray();
        for (String j : jars) {
            arr.add(j);
        }
        pending.add("jars", arr);
        return pending;
    }

    private static Set<String> jarSet(JsonObject pending) {
        Set<String> jars = new LinkedHashSet<>();
        if (pending == null || !pending.has("jars") || !pending.get("jars").isJsonArray()) {
            return jars;
        }
        for (JsonElement el : pending.getAsJsonArray("jars")) {
            try {
                String s = el.getAsString();
                if (s != null && !s.isBlank()) {
                    jars.add(s);
                }
            } catch (Exception ignored) {
                // skip
            }
        }
        return jars;
    }
}
