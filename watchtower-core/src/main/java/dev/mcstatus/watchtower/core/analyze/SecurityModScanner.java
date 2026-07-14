package dev.mcstatus.watchtower.core.analyze;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

/**
 * Denylist scan for known malicious / backdoor mods (CA IrlandaCore).
 * Emits optional.security_flags[] and is always critical (parallel to crash Fix).
 */
public final class SecurityModScanner {

    private static final String[] DENYLIST = {"irlandacore"};

    private SecurityModScanner() {
    }

    public static JsonArray scan(JsonArray mods) {
        JsonArray out = new JsonArray();
        ModListGate gate = ModListGate.fromMods(mods);
        for (String id : DENYLIST) {
            if (!gate.requiresMod(id)) {
                continue;
            }
            JsonObject row = new JsonObject();
            row.addProperty("mod_id", id);
            row.addProperty("flag", "SECURITY_BACKDOOR_MOD");
            row.addProperty("severity", "critical");
            row.addProperty("message",
                    "Mod '" + id + "' is a known creative-mode backdoor — remove it from mods/ immediately.");
            out.add(row);
        }
        return out;
    }
}
