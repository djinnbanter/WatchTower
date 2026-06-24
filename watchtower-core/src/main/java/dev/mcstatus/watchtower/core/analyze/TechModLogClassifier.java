package dev.mcstatus.watchtower.core.analyze;

import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Classifies log lines from common tech mods for richer hints.
 */
public final class TechModLogClassifier {

    public enum TechCategory {
        KUBEJS_SCRIPT,
        CREATE_CONTRAPTION,
        AE2_GRID,
        NONE
    }

    public record Hit(TechCategory category, String modId, String sampleLine) {
    }

    private static final Pattern KUBEJS = Pattern.compile("\\[KubeJS", Pattern.CASE_INSENSITIVE);
    private static final Pattern CREATE_COLLIDER = Pattern.compile(
            "ContinuousOBBCollider|mf\\.axis|Contraption", Pattern.CASE_INSENSITIVE);
    private static final Pattern AE2 = Pattern.compile(
            "appeng|Applied Energistics|ME (Grid|Network)|channel", Pattern.CASE_INSENSITIVE);

    private TechModLogClassifier() {
    }

    public static Hit classify(String line) {
        if (line == null || line.isBlank()) {
            return new Hit(TechCategory.NONE, null, null);
        }
        String lower = line.toLowerCase(Locale.ROOT);
        if (KUBEJS.matcher(line).find() && (lower.contains("error") || lower.contains("exception"))) {
            return new Hit(TechCategory.KUBEJS_SCRIPT, "kubejs", line);
        }
        if (CREATE_COLLIDER.matcher(line).find()) {
            return new Hit(TechCategory.CREATE_CONTRAPTION, "create", line);
        }
        if (AE2.matcher(line).find() && (lower.contains("error") || lower.contains("failed") || lower.contains("overload"))) {
            return new Hit(TechCategory.AE2_GRID, "ae2", line);
        }
        return new Hit(TechCategory.NONE, null, null);
    }

    public static String categoryId(TechCategory category) {
        return switch (category) {
            case KUBEJS_SCRIPT -> "kubejs_script";
            case CREATE_CONTRAPTION -> "create_contraption";
            case AE2_GRID -> "ae2_grid";
            case NONE -> null;
        };
    }
}
