package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.report.ReportConfig;

import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Scores mods for client-only likelihood using TOML, logs, heuristics, dependencies, and optional jar scan.
 */
public final class ModSideScorer {

    public enum Bucket {
        LIKELY_REMOVABLE("likely_removable"),
        CLIENT_LIBRARY("client_library"),
        UNCERTAIN("uncertain"),
        TEST_REMOVE("test_remove");

        private final String id;

        Bucket(String id) {
            this.id = id;
        }

        public String id() {
            return id;
        }
    }

    public enum Confidence {
        HIGH("high"),
        MEDIUM("medium"),
        LOW("low");

        private final String id;

        Confidence(String id) {
            this.id = id;
        }

        public String id() {
            return id;
        }
    }

    private static final Set<String> EXCLUDE_IDS = Set.of(
            "minecraft", "neoforge", "forge", "fabric_api", "forgified_fabric_api",
            "cloth_config", "yet_another_config_lib_v3", "c2me_client_uncapvd"
    );

    private static final Set<String> LIBRARY_IDS = Set.of(
            "xaerolib", "lambdynlights_api", "lambdynlights_runtime", "connectorextras"
    );

    private static final Set<String> UNCERTAIN_IDS = Set.of(
            "emi", "jade", "jei", "rei", "create", "flywheel"
    );

    private static final Set<String> LIKELY_REMOVABLE_IDS = Set.of(
            "modmenu", "appleskin", "xaerominimap", "xaeroworldmap", "xaerotrainmap",
            "lambdynlights", "veil", "ponder", "spruceui", "yeetusexperimentus",
            "sound_physics_remastered", "statuemenus", "trashslot"
    );

    private static final double BYTECODE_CLIENT_RATIO = 0.15;
    private static final String TEST_REMOVE_ADVICE =
            "We're not sure — remove from server mods/ one at a time, restart, and watch for errors before deleting from the pack.";

    private ModSideScorer() {
    }

    public static void apply(JsonObject optional, ReportConfig config, String serverDir) {
        if (optional == null || !optional.has("mods")) {
            return;
        }
        JsonArray mods = optional.getAsJsonArray("mods");
        Map<String, Integer> logWarnings = logWarningsByMod(optional);
        ModDependencyGraph graph = ModDependencyGraph.fromMods(mods);
        int scanBudget = config.modSideScanMaxJars();
        int scanned = 0;

        List<JsonObject> detected = new ArrayList<>();
        Set<String> candidateIds = new HashSet<>();

        for (JsonElement el : mods) {
            if (!el.isJsonObject()) {
                continue;
            }
            JsonObject mod = el.getAsJsonObject();
            String id = str(mod, "id");
            if (id == null || id.isBlank() || isExcluded(id)) {
                continue;
            }
            Score score = scoreMod(id, mod, logWarnings, graph, null);
            if (score.bucket() != null) {
                candidateIds.add(id);
            }
        }

        for (JsonElement el : mods) {
            if (!el.isJsonObject()) {
                continue;
            }
            JsonObject mod = el.getAsJsonObject();
            String id = str(mod, "id");
            if (id == null || id.isBlank() || isExcluded(id)) {
                continue;
            }
            ModJarSideScanner.ScanResult scan = null;
            if (config.modSideScan() && scanned < scanBudget) {
                Score prelim = scoreMod(id, mod, logWarnings, graph, null);
                if (prelim.bucket() == null || prelim.confidence() == Confidence.LOW
                        || prelim.bucket() == Bucket.UNCERTAIN || prelim.bucket() == Bucket.TEST_REMOVE) {
                    Path jar = ModJarSideScanner.modJarPath(serverDir, id);
                    if (jar != null) {
                        try {
                            scan = ModJarSideScanner.scan(jar);
                            scanned++;
                        } catch (Exception ignored) {
                            // optional scan — never block report
                        }
                    }
                }
            }
            Score score = scoreMod(id, mod, logWarnings, graph, scan);
            if (score.bucket() == null) {
                continue;
            }
            if (score.bucket() == Bucket.LIKELY_REMOVABLE
                    && graph.hasServerDependents(id, candidateIds)) {
                score = score.withBucket(Bucket.UNCERTAIN, Confidence.MEDIUM,
                        "Other mods depend on this jar — review dependents before removing.");
            }
            detected.add(toEntry(id, mod, score, graph));
        }

        if (detected.isEmpty()) {
            return;
        }
        detected.sort(Comparator.comparing(o -> o.get("mod_id").getAsString()));
        JsonArray arr = new JsonArray();
        detected.forEach(arr::add);
        optional.add("client_only_mods", arr);

        int removable = 0;
        int testRemove = 0;
        for (JsonObject d : detected) {
            if (Bucket.LIKELY_REMOVABLE.id().equals(str(d, "bucket"))) {
                removable++;
            } else if (Bucket.TEST_REMOVE.id().equals(str(d, "bucket"))) {
                testRemove++;
            }
        }
        int clientWarnings = clientWarningCount(optional);
        JsonObject summary = new JsonObject();
        summary.addProperty("detected", detected.size());
        summary.addProperty("likely_removable_count", removable);
        summary.addProperty("test_remove_count", testRemove);
        summary.addProperty("client_warning_count", clientWarnings);
        optional.add("client_only_mods_summary", summary);
    }

    private record Score(Bucket bucket, Confidence confidence, List<String> signals, String reason,
                         String removalAdvice) {
        Score withBucket(Bucket bucket, Confidence confidence, String reason) {
            return new Score(bucket, confidence, signals, reason, removalAdvice);
        }
    }

    private static Score scoreMod(
            String id,
            JsonObject mod,
            Map<String, Integer> logWarnings,
            ModDependencyGraph graph,
            ModJarSideScanner.ScanResult scan) {
        List<String> signals = new ArrayList<>();
        int points = 0;
        Bucket heuristicBucket = heuristicBucket(id, mod);
        if (heuristicBucket != null) {
            signals.add("heuristic");
            points += heuristicBucket == Bucket.LIKELY_REMOVABLE ? 3 : 2;
        }

        String displayName = str(mod, "display_name");
        String description = str(mod, "description");
        if (mentionsClient(displayName) || mentionsClient(description)) {
            signals.add("toml");
            points += 2;
        }
        if ("LIBRARY".equalsIgnoreCase(str(mod, "mod_type"))) {
            signals.add("toml");
            points += 1;
        }

        int warnCount = logWarnings.getOrDefault(id, 0);
        if (warnCount > 0) {
            signals.add("log_client_refs");
            points += warnCount >= 5 ? 4 : 2;
        }

        if (scan != null && scan.totalClasses() > 0) {
            signals.add("bytecode_scan");
            if (scan.clientRatio() >= BYTECODE_CLIENT_RATIO) {
                points += 4;
            } else if (scan.clientRatio() > 0) {
                points += 1;
            }
        }

        Bucket bucket = heuristicBucket;
        Confidence confidence;
        String reason;
        String advice;

        if (points == 0 && bucket == null) {
            return new Score(null, Confidence.LOW, signals, null, null);
        }

        if (bucket == null) {
            if (points >= 5) {
                bucket = Bucket.LIKELY_REMOVABLE;
            } else if (points >= 3) {
                bucket = Bucket.UNCERTAIN;
            } else {
                bucket = Bucket.TEST_REMOVE;
            }
        }

        if (points >= 6 && !signals.isEmpty()) {
            confidence = Confidence.HIGH;
        } else if (points >= 3) {
            confidence = Confidence.MEDIUM;
        } else {
            confidence = Confidence.LOW;
            bucket = Bucket.TEST_REMOVE;
        }

        if (confidence == Confidence.LOW) {
            bucket = Bucket.TEST_REMOVE;
            advice = TEST_REMOVE_ADVICE;
        } else {
            advice = removalAdviceFor(bucket);
        }

        reason = reasonFor(id, bucket, mod, warnCount);
        return new Score(bucket, confidence, signals, reason, advice);
    }

    private static JsonObject toEntry(String id, JsonObject mod, Score score, ModDependencyGraph graph) {
        JsonObject entry = new JsonObject();
        entry.addProperty("mod_id", id);
        entry.addProperty("version", strOr(mod, "version", "?"));
        entry.addProperty("bucket", score.bucket().id());
        entry.addProperty("confidence", score.confidence().id());
        entry.addProperty("reason", score.reason());
        entry.addProperty("removal_advice", score.removalAdvice());
        String display = str(mod, "display_name");
        if (display != null && !display.isBlank()) {
            entry.addProperty("display_name", display);
        }
        JsonArray signals = new JsonArray();
        score.signals().forEach(signals::add);
        entry.add("signals", signals);
        List<String> dependents = graph.dependentsOf(id);
        if (!dependents.isEmpty()) {
            JsonArray depArr = new JsonArray();
            dependents.forEach(depArr::add);
            entry.add("dependents", depArr);
        }
        return entry;
    }

    private static Map<String, Integer> logWarningsByMod(JsonObject optional) {
        Map<String, Integer> map = new HashMap<>();
        if (!optional.has("client_class_warnings_by_mod")) {
            return map;
        }
        for (JsonElement el : optional.getAsJsonArray("client_class_warnings_by_mod")) {
            JsonObject row = el.getAsJsonObject();
            String modId = str(row, "mod_id");
            if (modId != null) {
                map.put(modId, row.has("count") ? row.get("count").getAsInt() : 0);
            }
        }
        return map;
    }

    private static int clientWarningCount(JsonObject optional) {
        if (!optional.has("mod_log_errors")) {
            return 0;
        }
        for (JsonElement el : optional.getAsJsonArray("mod_log_errors")) {
            JsonObject row = el.getAsJsonObject();
            if ("client_noise".equals(str(row, "mod_id"))) {
                return row.has("total") ? row.get("total").getAsInt() : 0;
            }
        }
        return 0;
    }

    private static Bucket heuristicBucket(String id, JsonObject mod) {
        if (mod.has("client_only") && mod.get("client_only").getAsBoolean()) {
            return bucketForKnown(id);
        }
        if (LIKELY_REMOVABLE_IDS.contains(id)) {
            return Bucket.LIKELY_REMOVABLE;
        }
        if (LIBRARY_IDS.contains(id)) {
            return Bucket.CLIENT_LIBRARY;
        }
        if (UNCERTAIN_IDS.contains(id)) {
            return Bucket.UNCERTAIN;
        }
        String low = id.toLowerCase(Locale.ROOT);
        if (low.startsWith("fabric_") || low.startsWith("connectorextras_")) {
            if (low.contains("energy_bridge")) {
                return null;
            }
            if (low.contains("_bridge") || low.contains("modmenu") || low.contains("jei")
                    || low.contains("rei") || low.contains("emi")) {
                return Bucket.LIKELY_REMOVABLE;
            }
            return Bucket.CLIENT_LIBRARY;
        }
        if (low.contains("minimap") || low.contains("worldmap") || low.contains("dynlights")
                || low.contains("modmenu") || low.contains("appleskin")) {
            return Bucket.LIKELY_REMOVABLE;
        }
        if (low.endsWith("_client") || low.contains("client_")) {
            return Bucket.CLIENT_LIBRARY;
        }
        return null;
    }

    private static Bucket bucketForKnown(String id) {
        if (LIBRARY_IDS.contains(id)) {
            return Bucket.CLIENT_LIBRARY;
        }
        if (UNCERTAIN_IDS.contains(id)) {
            return Bucket.UNCERTAIN;
        }
        return Bucket.LIKELY_REMOVABLE;
    }

    private static boolean mentionsClient(String text) {
        if (text == null || text.isBlank()) {
            return false;
        }
        String low = text.toLowerCase(Locale.ROOT);
        return low.contains("client") || low.contains("hud") || low.contains("minimap")
                || low.contains("world map") || low.contains("worldmap") || low.contains("rendering")
                || low.contains("shader");
    }

    private static String reasonFor(String id, Bucket bucket, JsonObject mod, int warnCount) {
        String desc = str(mod, "description");
        if (desc != null && !desc.isBlank() && desc.length() <= 120) {
            return desc;
        }
        return switch (bucket) {
            case LIKELY_REMOVABLE -> switch (id) {
                case "modmenu" -> "Mod list menu — client UI only";
                case "appleskin" -> "Hunger/saturation HUD — client only";
                case "xaerominimap" -> "Minimap UI — client only on dedicated servers";
                case "xaeroworldmap" -> "World map UI — client only on dedicated servers";
                case "xaerotrainmap" -> "Train map UI — client only";
                case "lambdynlights" -> "Dynamic lights — client rendering";
                case "veil" -> "Client rendering/shaders";
                case "ponder" -> "Create ponder scenes — client UI";
                default -> warnCount > 0
                        ? "Client classes referenced in logs (" + warnCount + " warnings)"
                        : "Typically client-only on a dedicated server";
            };
            case CLIENT_LIBRARY -> "Client-oriented library — may be required by other mods";
            case UNCERTAIN -> "May provide server features — review before removing";
            case TEST_REMOVE -> "Insufficient signals — test removal one mod at a time";
        };
    }

    private static String removalAdviceFor(Bucket bucket) {
        return switch (bucket) {
            case LIKELY_REMOVABLE -> "Safe to remove from server mods/ on a dedicated host — keep a backup of the jar.";
            case CLIENT_LIBRARY -> "Do not remove unless you know no other mods need it.";
            case UNCERTAIN -> "Check mod documentation; some features may run on dedicated servers.";
            case TEST_REMOVE -> TEST_REMOVE_ADVICE;
        };
    }

    private static boolean isExcluded(String id) {
        if (EXCLUDE_IDS.contains(id)) {
            return true;
        }
        String low = id.toLowerCase(Locale.ROOT);
        return low.startsWith("fabric_") && !low.contains("bridge");
    }

    private static String str(JsonObject o, String key) {
        if (o == null || !o.has(key) || o.get(key).isJsonNull()) {
            return null;
        }
        return o.get(key).getAsString();
    }

    private static String strOr(JsonObject o, String key, String def) {
        String v = str(o, key);
        return v != null ? v : def;
    }
}
