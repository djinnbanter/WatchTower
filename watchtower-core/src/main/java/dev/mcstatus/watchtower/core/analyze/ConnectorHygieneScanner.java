package dev.mcstatus.watchtower.core.analyze;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

/**
 * Warn when Sinytra Connector is loaded — Fabric mods can be unstable.
 * Non-blocking vs crash Fix (G-05).
 */
public final class ConnectorHygieneScanner {

    private static final String MESSAGE =
            "Sinytra Connector loaded — Fabric mods can be unstable.";

    private ConnectorHygieneScanner() {
    }

    public static JsonArray scan(JsonArray mods) {
        JsonArray out = new JsonArray();
        ModListGate gate = ModListGate.fromMods(mods);
        if (!gate.hasConnector()) {
            return out;
        }
        JsonObject row = new JsonObject();
        row.addProperty("mod_id", preferredConnectorId(gate));
        row.addProperty("kind", "connector_present");
        row.addProperty("severity", "info");
        row.addProperty("boot_only", true);
        row.addProperty("blocking", false);
        row.addProperty("message", MESSAGE);
        out.add(row);
        return out;
    }

    private static String preferredConnectorId(ModListGate gate) {
        if (gate.requiresMod("connectormod")) {
            return "connectormod";
        }
        return "connector";
    }
}
