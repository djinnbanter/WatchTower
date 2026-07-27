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
 * Scores mods for client-only likelihood using TOML, logs, heuristics, dependencies,
 * optional jar scan, and optional Modrinth Layer-2 signals.
 */
public final class ModSideScorer {

    public enum Bucket {
        LIKELY_REMOVABLE("likely_removable"),
        CLIENT_LIBRARY("client_library"),
        UNCERTAIN("uncertain"),
        TEST_REMOVE("test_remove"),
        SERVER_REQUIRED("server_required");

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
            "emi", "jade", "jei", "rei"
    );

    /** Hard denylist — never suggest remove. */
    public static final Set<String> SERVER_REQUIRED_IDS = Set.of(
            "create", "flywheel", "registrate"
    );

    /** Protected whenever Create is present. */
    public static final Set<String> CREATE_ECOSYSTEM_IDS = Set.of(
            "ponder", "flywheel", "registrate"
    );

    /** Client-heavy but may have optional server components. */
    public static final Set<String> HYBRID_IDS = Set.of(
            "xaerominimap", "xaeroworldmap", "xaerotrainmap"
    );

    private static final Set<String> LIKELY_REMOVABLE_IDS = Set.of(
            "modmenu", "appleskin",
            "lambdynlights", "veil", "spruceui", "yeetusexperimentus",
            "sound_physics_remastered", "statuemenus", "trashslot"
    );

    private static final double BYTECODE_CLIENT_RATIO = 0.15;
    private static final int PROTECTION_DEPTH = 6;
    private static final String TEST_REMOVE_ADVICE =
            "We're not sure — remove from server mods/ one at a time, restart, and watch for errors before deleting from the pack.";
    private static final String HYBRID_REASON =
            "Client map UI — some packs sync waypoints via an optional server component. Verify before removing.";

    private ModSideScorer() {
    }

    public static void apply(JsonObject optional, ReportConfig config, String serverDir) {
        if (optional == null || !optional.has("mods")) {
            return;
        }
        JsonArray mods = optional.getAsJsonArray("mods");
        Map<String, Integer> logWarnings = logWarningsByMod(optional);
        ModDependencyGraph graph = ModDependencyGraph.fromMods(mods);
        Set<String> ignored = ignoredIds(optional);
        Set<String> protectedIds = protectedIds(mods, graph);
        int scanBudget = config.modSideScanMaxJars();
        int scanned = 0;

        Map<String, Score> layer1Scores = new HashMap<>();
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
            if (protectedIds.contains(id)) {
                continue;
            }
            Score score = scoreMod(id, mod, logWarnings, graph, null);
            if (score.bucket() != null) {
                candidateIds.add(id);
                layer1Scores.put(id, score);
            }
        }

        Map<String, ModrinthLookupService.SideInfo> modrinthById = Map.of();
        if (config.modrinthLookup() && !config.disasterRecovery()) {
            List<ModrinthLookupService.Candidate> candidates = ModrinthScanJob.buildCandidates(optional, serverDir);
            Path cacheFile = serverDir != null && !serverDir.isBlank()
                    ? Path.of(serverDir, "watchtower", "modrinth-cache.json")
                    : null;
            Map<Path, String> hashByPath = new HashMap<>();
            ModrinthLookupService.hashCandidates(candidates, hashByPath, ModrinthScanProgress.NOOP);
            Map<String, ModrinthLookupService.SideInfo> byHash =
                    ModrinthLookupService.lookupCacheOnly(candidates, cacheFile, hashByPath);
            Map<String, ModrinthLookupService.SideInfo> byId = new HashMap<>();
            for (ModrinthLookupService.Candidate c : candidates) {
                String hash = hashByPath.get(c.jarPath());
                if (hash == null) {
                    continue;
                }
                ModrinthLookupService.SideInfo info = byHash.get(hash);
                if (info != null && !info.miss()) {
                    byId.put(c.modId(), info);
                }
            }
            ModrinthLookupService.applyIdentityToMods(mods, byId, config.loader());
            JsonArray updates = ModrinthLookupService.buildUpdatesSummary(mods);
            updates = ModUpdateImpactAnalyzer.enrich(mods, updates, byId);
            if (updates.size() > 0) {
                optional.add("modrinth_updates", updates);
            } else {
                optional.remove("modrinth_updates");
            }
            modrinthById = byId;
        }

        List<JsonObject> detected = new ArrayList<>();

        for (JsonElement el : mods) {
            if (!el.isJsonObject()) {
                continue;
            }
            JsonObject mod = el.getAsJsonObject();
            String id = str(mod, "id");
            if (id == null || id.isBlank() || isExcluded(id)) {
                continue;
            }

            if (protectedIds.contains(id)) {
                List<String> signals = new ArrayList<>();
                if (SERVER_REQUIRED_IDS.contains(id)) {
                    signals.add("SERVER_REQUIRED_IDS");
                } else if (CREATE_ECOSYSTEM_IDS.contains(id) && modPresent(mods, "create")) {
                    signals.add("ecosystem:create");
                } else {
                    signals.add("dependent_of:create");
                }
                writeModFields(mod, Bucket.SERVER_REQUIRED, signals, graph.dependentsCount(id));
                continue;
            }

            ModJarSideScanner.ScanResult scan = null;
            if (config.modSideScan() && scanned < scanBudget) {
                Score prelim = layer1Scores.get(id);
                if (prelim == null || prelim.confidence() == Confidence.LOW
                        || prelim.bucket() == Bucket.UNCERTAIN || prelim.bucket() == Bucket.TEST_REMOVE) {
                    Path jar = ModJarSideScanner.modJarPath(serverDir, id);
                    if (jar != null) {
                        try {
                            scan = ModJarSideScanner.scan(jar);
                            scanned++;
                        } catch (Exception ex) {
                            // optional scan — never block report
                        }
                    }
                }
            }
            Score score = scoreMod(id, mod, logWarnings, graph, scan);
            ModrinthLookupService.SideInfo mr = modrinthById.get(id);
            if (score.bucket() == null) {
                if (mr != null && !mr.miss()) {
                    score = mergeModrinth(score, mr);
                }
                if (score.bucket() == null) {
                    writeModFields(mod, null, List.of(), graph.dependentsCount(id));
                    continue;
                }
            } else if (mr != null) {
                score = mergeModrinth(score, mr);
            }
            if (score.bucket() == Bucket.LIKELY_REMOVABLE
                    && graph.hasServerDependents(id, candidateIds)) {
                score = score.withBucket(Bucket.UNCERTAIN, Confidence.MEDIUM,
                        "Other mods depend on this jar — review dependents before removing.");
            }

            writeModFields(mod, score.bucket(), score.signals(), graph.dependentsCount(id));

            if (ignored.contains(id)) {
                continue;
            }
            if (score.bucket() == Bucket.SERVER_REQUIRED) {
                continue;
            }
            detected.add(toEntry(id, mod, score, graph));
        }

        if (!detected.isEmpty()) {
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
    }

    /** Pure Layer-1 + Modrinth merge for unit tests. */
    public static Score mergeModrinth(Score layer1, ModrinthLookupService.SideInfo info) {
        if (layer1 == null || info == null || info.miss()) {
            return layer1;
        }
        String server = normalizeSide(info.serverSide());
        String client = normalizeSide(info.clientSide());
        List<String> signals = new ArrayList<>(layer1.signals());

        if ("required".equals(server) && "unsupported".equals(client)) {
            signals.add("modrinth:server_required");
            return new Score(Bucket.SERVER_REQUIRED, Confidence.HIGH, signals,
                    "Modrinth marks this mod as server-required",
                    "Do not remove — required on dedicated servers.");
        }
        if ("required".equals(client) && "unsupported".equals(server)) {
            if (layer1.bucket() == Bucket.SERVER_REQUIRED) {
                return layer1;
            }
            signals.add("modrinth:client_only");
            String reason = layer1.reason() != null && !layer1.reason().isBlank()
                    ? layer1.reason()
                    : "Modrinth marks this mod as client-only";
            return new Score(Bucket.LIKELY_REMOVABLE, Confidence.HIGH, signals,
                    reason,
                    removalAdviceFor(Bucket.LIKELY_REMOVABLE));
        }
        if ("optional".equals(server) && "optional".equals(client)) {
            signals.add("modrinth:optional_both");
            if (layer1.bucket() == null) {
                return new Score(Bucket.UNCERTAIN, Confidence.MEDIUM, signals,
                        "Modrinth lists both client and server as optional",
                        removalAdviceFor(Bucket.UNCERTAIN));
            }
            return new Score(layer1.bucket(), layer1.confidence(), signals, layer1.reason(), layer1.removalAdvice());
        }
        return layer1;
    }

    public record Score(Bucket bucket, Confidence confidence, List<String> signals, String reason,
                        String removalAdvice) {
        Score withBucket(Bucket bucket, Confidence confidence, String reason) {
            return new Score(bucket, confidence, signals, reason, removalAdvice);
        }
    }

    static Set<String> protectedIds(JsonArray mods, ModDependencyGraph graph) {
        Set<String> seeds = new HashSet<>();
        for (JsonElement el : mods) {
            if (!el.isJsonObject()) {
                continue;
            }
            String id = str(el.getAsJsonObject(), "id");
            if (id == null) {
                continue;
            }
            if (SERVER_REQUIRED_IDS.contains(id)) {
                seeds.add(id);
            }
        }
        if (modPresent(mods, "create")) {
            for (JsonElement el : mods) {
                if (!el.isJsonObject()) {
                    continue;
                }
                String id = str(el.getAsJsonObject(), "id");
                if (id != null && CREATE_ECOSYSTEM_IDS.contains(id)) {
                    seeds.add(id);
                }
            }
        }
        return graph.expandProtected(seeds, PROTECTION_DEPTH);
    }

    private static Score scoreMod(
            String id,
            JsonObject mod,
            Map<String, Integer> logWarnings,
            ModDependencyGraph graph,
            ModJarSideScanner.ScanResult scan) {
        List<String> signals = new ArrayList<>();
        int points = 0;

        if (HYBRID_IDS.contains(id)) {
            signals.add("heuristic");
            return new Score(Bucket.UNCERTAIN, Confidence.MEDIUM, signals, HYBRID_REASON,
                    removalAdviceFor(Bucket.UNCERTAIN));
        }

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
        }

        // Known uncertain / library heuristics should not collapse into test_remove.
        if (confidence == Confidence.LOW
                && heuristicBucket != Bucket.UNCERTAIN
                && heuristicBucket != Bucket.CLIENT_LIBRARY) {
            bucket = Bucket.TEST_REMOVE;
            advice = TEST_REMOVE_ADVICE;
        } else {
            if (confidence == Confidence.LOW && heuristicBucket != null) {
                bucket = heuristicBucket;
                confidence = Confidence.MEDIUM;
            }
            advice = removalAdviceFor(bucket);
        }

        reason = reasonFor(id, bucket, mod, warnCount);
        return new Score(bucket, confidence, signals, reason, advice);
    }

    private static Path resolveModJar(JsonArray mods, String id, String serverDir) {
        if (id == null || serverDir == null || serverDir.isBlank()) {
            return ModJarSideScanner.modJarPath(serverDir, id);
        }
        for (JsonElement el : mods) {
            if (!el.isJsonObject()) {
                continue;
            }
            JsonObject mod = el.getAsJsonObject();
            if (!id.equals(str(mod, "id"))) {
                continue;
            }
            String jarFile = str(mod, "jar_file");
            if (jarFile != null && !jarFile.isBlank()) {
                Path jar = Path.of(serverDir, "mods", jarFile);
                if (java.nio.file.Files.isRegularFile(jar)) {
                    return jar;
                }
            }
            break;
        }
        return ModJarSideScanner.modJarPath(serverDir, id);
    }

    private static Set<String> crashSuspectModIds(JsonObject optional) {
        Set<String> ids = new HashSet<>();
        if (optional == null || !optional.has("crash_summaries") || !optional.get("crash_summaries").isJsonArray()) {
            return ids;
        }
        for (JsonElement el : optional.getAsJsonArray("crash_summaries")) {
            if (!el.isJsonObject()) {
                continue;
            }
            JsonObject row = el.getAsJsonObject();
            for (String key : List.of("primary_mod_id", "stall_mod_id", "suspect_mod_id", "linked_mod_id")) {
                String v = str(row, key);
                if (v != null && !v.isBlank()) {
                    ids.add(v.toLowerCase(Locale.ROOT));
                }
            }
        }
        return ids;
    }

    private static void writeModFields(JsonObject mod, Bucket bucket, List<String> signals, int dependentsCount) {
        if (bucket != null) {
            mod.addProperty("side_score", bucket.id());
        }
        if (signals != null && !signals.isEmpty()) {
            JsonArray arr = new JsonArray();
            signals.forEach(arr::add);
            mod.add("side_signals", arr);
        }
        mod.addProperty("dependents_count", dependentsCount);
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

    private static Set<String> ignoredIds(JsonObject optional) {
        Set<String> ignored = new HashSet<>();
        if (!optional.has("ignored_client_mods") || !optional.get("ignored_client_mods").isJsonObject()) {
            return ignored;
        }
        JsonObject map = optional.getAsJsonObject("ignored_client_mods");
        for (String key : map.keySet()) {
            JsonElement el = map.get(key);
            if (el != null && !el.isJsonNull() && el.getAsBoolean()) {
                ignored.add(key);
            }
        }
        return ignored;
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
        if (UNCERTAIN_IDS.contains(id) || "ponder".equals(id)) {
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
        if (UNCERTAIN_IDS.contains(id) || HYBRID_IDS.contains(id) || "ponder".equals(id)) {
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
        if (bucket == Bucket.UNCERTAIN && HYBRID_IDS.contains(id)) {
            return HYBRID_REASON;
        }
        String desc = str(mod, "description");
        if (desc != null && !desc.isBlank() && desc.length() <= 120) {
            return desc;
        }
        return switch (bucket) {
            case LIKELY_REMOVABLE -> switch (id) {
                case "modmenu" -> "Mod list menu — client UI only";
                case "appleskin" -> "Hunger/saturation HUD — client only";
                case "lambdynlights" -> "Dynamic lights — client rendering";
                case "veil" -> "Client rendering/shaders";
                default -> warnCount > 0
                        ? "Client classes referenced in logs (" + warnCount + " warnings)"
                        : "Typically client-only on a dedicated server";
            };
            case CLIENT_LIBRARY -> "Client-oriented library — may be required by other mods";
            case UNCERTAIN -> "May provide server features — review before removing";
            case TEST_REMOVE -> "Insufficient signals — test removal one mod at a time";
            case SERVER_REQUIRED -> "Server-required gameplay or library mod";
        };
    }

    private static String removalAdviceFor(Bucket bucket) {
        return switch (bucket) {
            case LIKELY_REMOVABLE -> "Safe to remove from server mods/ on a dedicated host — keep a backup of the jar.";
            case CLIENT_LIBRARY -> "Do not remove unless you know no other mods need it.";
            case UNCERTAIN -> "Check mod documentation; some features may run on dedicated servers.";
            case TEST_REMOVE -> TEST_REMOVE_ADVICE;
            case SERVER_REQUIRED -> "Do not remove — required on dedicated servers.";
        };
    }

    private static boolean isExcluded(String id) {
        if (EXCLUDE_IDS.contains(id)) {
            return true;
        }
        String low = id.toLowerCase(Locale.ROOT);
        return low.startsWith("fabric_") && !low.contains("bridge");
    }

    private static boolean modPresent(JsonArray mods, String id) {
        for (JsonElement el : mods) {
            if (el.isJsonObject() && id.equals(str(el.getAsJsonObject(), "id"))) {
                return true;
            }
        }
        return false;
    }

    private static String normalizeSide(String side) {
        return side == null ? "unknown" : side.strip().toLowerCase(Locale.ROOT);
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
