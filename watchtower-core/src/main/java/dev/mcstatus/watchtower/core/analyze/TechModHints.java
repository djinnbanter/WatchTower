package dev.mcstatus.watchtower.core.analyze;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

import java.util.List;

/**
 * Static hint cards for common tech mods (Create, KubeJS, AE2).
 */
public final class TechModHints {

    public record HintCard(
            String id,
            String modId,
            String title,
            String summary,
            List<String> fixSteps,
            String docUrl
    ) {
    }

    private TechModHints() {
    }

    public static HintCard kubejsScript() {
        return new HintCard(
                "kubejs_script",
                "kubejs",
                "KubeJS script error",
                "KubeJS logged a script error — usually a syntax or missing-item problem in server_scripts.",
                List.of(
                        "Open `kubejs/server_scripts/` and check the file named in the log line.",
                        "Fix syntax errors or wrong item IDs, then `/reload` or restart.",
                        "Compare with a known-good pack if the script was added recently."
                ),
                "https://kubejs.com/wiki"
        );
    }

    public static HintCard createContraption() {
        return new HintCard(
                "create_contraption",
                "create",
                "Create contraption issue",
                "Create logged a contraption/collision error — often a stuck or oversized build.",
                List.of(
                        "Find the contraption controller block and break it to stop the assembly.",
                        "Reduce stress or split the contraption into smaller sections.",
                        "Check for entities/items jamming glue or mechanical bearings."
                ),
                "https://github.com/Creators-of-Create/Create/wiki"
        );
    }

    public static HintCard ae2Grid() {
        return new HintCard(
                "ae2_grid",
                "ae2",
                "AE2 grid issue",
                "Applied Energistics logged a channel, power, or grid error.",
                List.of(
                        "Ensure the ME controller has power and enough channels for connected devices.",
                        "Check for subnetworks without a controller or overloaded dense cables.",
                        "Update AE2 and companion mods to matching pack versions."
                ),
                "https://guide.appliedenergistics2.org/"
        );
    }

    public static JsonObject toJson(HintCard card) {
        JsonObject out = new JsonObject();
        out.addProperty("tech_hint_id", card.id());
        out.addProperty("mod_id", card.modId());
        out.addProperty("title", card.title());
        out.addProperty("summary", card.summary());
        JsonArray steps = new JsonArray();
        card.fixSteps().forEach(steps::add);
        out.add("fix_steps", steps);
        if (card.docUrl() != null) {
            out.addProperty("doc_url", card.docUrl());
        }
        return out;
    }
}
