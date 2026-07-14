package dev.mcstatus.watchtower.core.analyze;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

/**
 * CA Connector hygiene: warn when Sinytra Connector is present with Fabric-only
 * Sodium / Iris / Lithium (optional.connector_warnings[]). Non-blocking vs crash Fix (G-05).
 */
public final class ConnectorHygieneScanner {

    private record Analogue(String fabricId, String analogueId, String analogueName) {
    }

    private static final Analogue[] ANALOGUES = {
            new Analogue("sodium", "embeddium", "Embeddium"),
            new Analogue("iris", "oculus", "Oculus"),
            new Analogue("lithium", "radium", "Radium"),
    };

    private ConnectorHygieneScanner() {
    }

    public static JsonArray scan(JsonArray mods) {
        JsonArray out = new JsonArray();
        ModListGate gate = ModListGate.fromMods(mods);
        if (!gate.hasConnector()) {
            return out;
        }
        for (Analogue a : ANALOGUES) {
            if (!gate.requiresMod(a.fabricId())) {
                continue;
            }
            JsonObject row = new JsonObject();
            row.addProperty("mod_id", a.fabricId());
            row.addProperty("analogue_id", a.analogueId());
            row.addProperty("analogue_name", a.analogueName());
            row.addProperty("severity", "info");
            row.addProperty("boot_only", true);
            row.addProperty("blocking", false);
            String jar = jarFor(mods, a.fabricId());
            if (jar != null) {
                row.addProperty("jar_name", jar);
            }
            row.addProperty("message", "Connector is present with Fabric mod '" + a.fabricId()
                    + "' — prefer " + a.analogueName() + " (" + a.analogueId()
                    + ") on dedicated servers.");
            out.add(row);
        }
        return out;
    }

    private static String jarFor(JsonArray mods, String modId) {
        if (mods == null) {
            return null;
        }
        for (JsonElement el : mods) {
            if (!el.isJsonObject()) {
                continue;
            }
            JsonObject m = el.getAsJsonObject();
            String id = m.has("id") && !m.get("id").isJsonNull() ? m.get("id").getAsString() : null;
            if (id == null && m.has("mod_id") && !m.get("mod_id").isJsonNull()) {
                id = m.get("mod_id").getAsString();
            }
            if (id != null && id.equalsIgnoreCase(modId)) {
                if (m.has("jar_file") && !m.get("jar_file").isJsonNull()) {
                    return m.get("jar_file").getAsString();
                }
                if (m.has("jar") && !m.get("jar").isJsonNull()) {
                    return m.get("jar").getAsString();
                }
            }
        }
        return null;
    }
}
