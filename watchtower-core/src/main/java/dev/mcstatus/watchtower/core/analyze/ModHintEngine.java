package dev.mcstatus.watchtower.core.analyze;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

import java.util.ArrayList;
import java.util.List;

/**
 * Shared hint builder for live peek and full-report recommendations.
 */
public final class ModHintEngine {

    private ModHintEngine() {
    }

    public static JsonObject buildHintBundle(String modId, String topCategory, String sampleLine) {
        TechModLogClassifier.Hit techHit = sampleLine != null
                ? TechModLogClassifier.classify(sampleLine)
                : new TechModLogClassifier.Hit(TechModLogClassifier.TechCategory.NONE, null, null);
        if (techHit.category() != TechModLogClassifier.TechCategory.NONE) {
            return techCardToBundle(techHit);
        }
        return categoryBundle(modId, topCategory);
    }

    public static List<String> buildHintStrings(String modId, String topCategory, String sampleLine) {
        JsonObject bundle = buildHintBundle(modId, topCategory, sampleLine);
        List<String> hints = new ArrayList<>();
        if (bundle.has("hints")) {
            for (var el : bundle.getAsJsonArray("hints")) {
                hints.add(el.getAsString());
            }
        }
        return hints;
    }

    public static JsonObject categoryBundle(String modId, String topCategory) {
        JsonObject out = new JsonObject();
        JsonArray hints = new JsonArray();
        if ("recipe_compat".equals(topCategory) || "recipe_missing_item".equals(topCategory)) {
            hints.add("Recipe errors often mean a missing dependency mod or version mismatch — compare with a known-good pack.");
        } else if ("mod_load_failed".equals(topCategory) || "mod_corrupt".equals(topCategory)) {
            hints.add("Try removing and re-downloading the mod jar, or check NeoForge/mod version compatibility.");
        } else if ("registry_missing".equals(topCategory)) {
            hints.add("Registry errors may clear after adding the mod that provides the missing block/item.");
        } else {
            hints.add("Check Mods → Log errors for details and sample lines.");
        }
        hints.add("Run a full report for conflict analysis and fix steps for " + modId + ".");
        out.add("hints", hints);
        return out;
    }

    private static JsonObject techCardToBundle(TechModLogClassifier.Hit hit) {
        TechModHints.HintCard card = switch (hit.category()) {
            case KUBEJS_SCRIPT -> TechModHints.kubejsScript();
            case CREATE_CONTRAPTION -> TechModHints.createContraption();
            case AE2_GRID -> TechModHints.ae2Grid();
            case NONE -> null;
        };
        if (card == null) {
            return new JsonObject();
        }
        JsonObject out = TechModHints.toJson(card);
        JsonArray hints = new JsonArray();
        card.fixSteps().forEach(hints::add);
        out.add("hints", hints);
        if (hit.sampleLine() != null) {
            out.addProperty("sample_line", hit.sampleLine());
        }
        return out;
    }
}
