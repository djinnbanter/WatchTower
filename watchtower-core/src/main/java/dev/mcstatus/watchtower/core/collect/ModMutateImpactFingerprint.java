package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.util.ArrayList;
import java.util.List;

/**
 * Stable impact fingerprint shared by dashboard confirm UI and server verify.
 * Format: {@code ifp_<fnv1a32hex>} over a versioned newline-joined payload.
 */
public final class ModMutateImpactFingerprint {
    private ModMutateImpactFingerprint() {
    }

    /**
     * @param blockersJson canonical JSON for blockers (use {@code "[]"} when empty)
     */
    public static String compute(
            String modId,
            String versionId,
            String verdict,
            String summary,
            String blockersJson) {
        String raw = String.join(
                "\n",
                "v1",
                nullToEmpty(modId),
                nullToEmpty(versionId),
                nullToEmpty(verdict),
                nullToEmpty(summary),
                blockersJson == null || blockersJson.isBlank() ? "[]" : blockersJson.trim());
        return "ifp_" + Integer.toUnsignedString(fnv1a32(raw), 16);
    }

    public static String compute(
            String modId,
            String versionId,
            String verdict,
            String summary,
            JsonElement blockers) {
        return compute(modId, versionId, verdict, summary, blockersCanonical(blockers));
    }

    /** Stable blockers token: sorted {@code mod_id} list as {@code [a, b]} (Java List.toString style). */
    public static String blockersCanonical(JsonElement blockers) {
        if (blockers == null || blockers.isJsonNull() || !blockers.isJsonArray()) {
            return "[]";
        }
        List<String> ids = new ArrayList<>();
        for (JsonElement el : blockers.getAsJsonArray()) {
            if (el == null || !el.isJsonObject()) {
                continue;
            }
            JsonObject o = el.getAsJsonObject();
            String id = null;
            if (o.has("mod_id") && !o.get("mod_id").isJsonNull()) {
                id = o.get("mod_id").getAsString();
            } else if (o.has("id") && !o.get("id").isJsonNull()) {
                id = o.get("id").getAsString();
            }
            if (id != null && !id.isBlank()) {
                ids.add(id.trim());
            }
        }
        ids.sort(String::compareTo);
        return ids.toString();
    }

    /** Batch: bind sorted {@code mod_id:version_id} pairs into versionId slot. */
    public static String computeBatch(
            String stepKeysSortedCsv,
            String verdict,
            String summary,
            String blockersJson) {
        return compute("batch", stepKeysSortedCsv, verdict, summary, blockersJson);
    }

    public static boolean matches(String provided, String expected) {
        if (provided == null || expected == null) {
            return false;
        }
        return provided.trim().equalsIgnoreCase(expected.trim());
    }

    private static String nullToEmpty(String s) {
        return s == null ? "" : s.trim();
    }

    /** FNV-1a 32-bit, matching the dashboard TypeScript helper. */
    static int fnv1a32(String raw) {
        int h = (int) 2166136261L;
        for (int i = 0; i < raw.length(); i++) {
            h ^= raw.charAt(i);
            h *= 16777619;
        }
        return h;
    }
}
