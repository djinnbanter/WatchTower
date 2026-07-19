package dev.mcstatus.watchtower.core.collect;

import com.google.gson.GsonBuilder;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import dev.mcstatus.watchtower.core.report.ReportConfig;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;

/** Owns Modrinth network work and patches the latest facts artifact after a completed scan. */
public final class ModrinthScanJob {
    public static final String STATUS_FILENAME = "modrinth-status.json";

    public record ScanResult(boolean success, String message, JsonObject status) {
    }

    private ModrinthScanJob() {
    }

    public static ScanResult run(
            String serverDir, ReportConfig config, Path reportDir, ModrinthScanProgress progress) {
        ModrinthScanProgress observer = progress != null ? progress : ModrinthScanProgress.NOOP;
        Instant started = Instant.now();
        JsonObject status = baseStatus(config);
        Path statusFile = statusFile(serverDir);
        try {
            if (config == null || !config.modrinthLookup() || config.disasterRecovery()) {
                return finish(statusFile, status, started, false,
                        "Modrinth lookup is disabled or unavailable in disaster-recovery mode.", observer);
            }

            observer.stage("prepare", "Preparing Modrinth scan");
            Path factsFile = ReportArtifactFinder.findLatestFacts(reportDir);
            if (factsFile == null) {
                return finish(statusFile, status, started, false,
                        "No Watchtower facts report is available to enrich.", observer);
            }
            JsonObject facts = JsonParser.parseString(Files.readString(factsFile, StandardCharsets.UTF_8))
                    .getAsJsonObject();
            JsonObject optional = facts.has("optional") && facts.get("optional").isJsonObject()
                    ? facts.getAsJsonObject("optional") : null;
            if (optional == null || !optional.has("mods") || !optional.get("mods").isJsonArray()) {
                return finish(statusFile, status, started, false,
                        "Latest facts report does not contain optional.mods.", observer);
            }
            JsonArray mods = optional.getAsJsonArray("mods");
            List<ModrinthLookupService.Candidate> candidates = buildCandidates(optional, serverDir);
            stats(status).addProperty("jars_considered", candidates.size());
            stats(status).addProperty("jars_capped", ModrinthLookupService.maxJarsPerReport());
            stats(status).addProperty("truncated", countEligibleMods(mods, serverDir) > candidates.size());

            observer.progress(0, candidates.size());
            Path cacheFile = Path.of(serverDir, "watchtower", "modrinth-cache.json");
            Map<String, ModrinthLookupService.SideInfo> cachedByHash =
                    ModrinthLookupService.lookupCacheOnly(candidates, cacheFile);
            int cacheHits = cachedByHash.size();
            int cacheMisses = Math.max(0, candidates.size() - cacheHits);
            stats(status).addProperty("cache_hits", cacheHits);
            stats(status).addProperty("cache_misses", cacheMisses);
            stats(status).addProperty("cache_hit_rate",
                    candidates.isEmpty() ? 0 : cacheHits * 100.0 / candidates.size());
            Map<String, ModrinthLookupService.SideInfo> byHash =
                    ModrinthLookupService.lookup(candidates, cacheFile, config, new StageProgress(observer));
            Map<String, ModrinthLookupService.SideInfo> byId = new HashMap<>();
            Map<String, String> hashById = new HashMap<>();
            for (ModrinthLookupService.Candidate candidate : candidates) {
                try {
                    String hash = ModrinthLookupService.sha512Hex(candidate.jarPath());
                    hashById.put(candidate.modId(), hash);
                    ModrinthLookupService.SideInfo info = byHash.get(hash);
                    if (info != null && !info.miss()) {
                        byId.put(candidate.modId(), info);
                    }
                } catch (Exception ignored) {
                    // a vanished jar should not fail a scan
                }
            }
            String minecraftVersion = ModrinthLookupService.minecraftVersionFromFacts(facts);
            String loader = resolveLoader(config, facts);
            if (minecraftVersion != null && !minecraftVersion.isBlank()) {
                stats(status).addProperty("minecraft_version", minecraftVersion);
            } else {
                stats(status).addProperty("minecraft_version", "");
                stats(status).addProperty("compat_mc_missing", true);
            }
            observer.stage("compat", minecraftVersion != null && !minecraftVersion.isBlank()
                    ? "Checking compatible updates for MC " + minecraftVersion
                    : "Checking updates (Minecraft version unknown — loader filter only)");
            ModrinthLookupService.enrichCompatibleUpdates(byId, hashById, crashSuspects(optional),
                    loader, minecraftVersion, config.modrinthRateLimit(), observer);

            observer.stage("impact", "Analyzing update impact");
            ModrinthLookupService.applyIdentityToMods(mods, byId);
            JsonArray updates = ModUpdateImpactAnalyzer.enrich(
                    mods, ModrinthLookupService.buildUpdatesSummary(mods), byId);
            if (updates.isEmpty()) {
                optional.remove("modrinth_updates");
            } else {
                optional.add("modrinth_updates", updates);
            }

            observer.stage("persist", "Saving Modrinth results");
            for (Map.Entry<String, ModrinthLookupService.SideInfo> entry : byId.entrySet()) {
                String hash = hashById.get(entry.getKey());
                if (hash != null) {
                    byHash.put(hash, entry.getValue());
                }
            }
            // Persist cache before side re-score so ModSideScorer can apply fresh Modrinth hits.
            ModrinthLookupService.persistCache(cacheFile, byHash);
            ModSideScorer.apply(optional, config, serverDir);
            Files.writeString(factsFile, new GsonBuilder().setPrettyPrinting().create().toJson(facts),
                    StandardCharsets.UTF_8);

            enrichStats(status, candidates, byHash, byId, updates, started);
            observer.stage("done", "Modrinth scan complete");
            return finish(statusFile, status, started, true, null, observer);
        } catch (Exception e) {
            return finish(statusFile, status, started, false,
                    e.getMessage() == null ? "Modrinth scan failed." : e.getMessage(), observer);
        }
    }

    /** Loads the persisted endpoint-shaped status snapshot, returning an empty object if missing. */
    public static JsonObject loadStatus(Path statusFile) {
        try {
            return statusFile != null && Files.isRegularFile(statusFile)
                    ? JsonParser.parseString(Files.readString(statusFile, StandardCharsets.UTF_8)).getAsJsonObject()
                    : new JsonObject();
        } catch (Exception ignored) {
            return new JsonObject();
        }
    }

    /** Shared candidate ordering for dedicated scan and report-time cache application. */
    public static List<ModrinthLookupService.Candidate> buildCandidates(JsonObject optional, String serverDir) {
        List<ModrinthLookupService.Candidate> out = new ArrayList<>();
        if (optional == null || !optional.has("mods") || !optional.get("mods").isJsonArray()) {
            return out;
        }
        JsonArray mods = optional.getAsJsonArray("mods");
        List<String> order = new ArrayList<>(crashSuspects(optional));
        for (String id : List.of("create", "flywheel", "chunky", "squaremap", "bluemap", "spark")) {
            if (findMod(mods, id) != null && !order.contains(id)) {
                order.add(id);
            }
        }
        for (JsonElement el : mods) {
            if (el.isJsonObject()) {
                String id = string(el.getAsJsonObject(), "id");
                if (id != null && !id.isBlank() && !order.contains(id)) {
                    order.add(id);
                }
            }
        }
        Set<String> added = new HashSet<>();
        for (String id : order) {
            if (out.size() >= ModrinthLookupService.maxJarsPerReport() || !added.add(id)) {
                continue;
            }
            Path jar = resolveJar(mods, id, serverDir);
            if (jar != null) {
                out.add(new ModrinthLookupService.Candidate(id, jar));
            }
        }
        return out;
    }

    private static ScanResult finish(Path statusFile, JsonObject status, Instant started, boolean success,
                                     String error, ModrinthScanProgress observer) {
        Instant finished = Instant.now();
        status.addProperty("running", false);
        status.addProperty("success", success);
        if (error == null) status.remove("error"); else status.addProperty("error", error);
        status.addProperty("stage", "done");
        status.addProperty("stage_label", success ? "Modrinth scan complete" : "Modrinth scan failed");
        JsonObject last = new JsonObject();
        last.addProperty("started_at", started.toString());
        last.addProperty("finished_at", finished.toString());
        last.addProperty("duration_ms", Duration.between(started, finished).toMillis());
        last.addProperty("success", success);
        if (error != null) last.addProperty("error", error);
        status.add("last_run", last);
        try {
            if (statusFile != null) {
                Files.createDirectories(statusFile.getParent());
                Files.writeString(statusFile, new GsonBuilder().setPrettyPrinting().create().toJson(status),
                        StandardCharsets.UTF_8);
            }
        } catch (Exception ignored) {
            // status persistence is best effort; return the in-memory payload either way
        }
        observer.stage("done", success ? "Modrinth scan complete" : "Modrinth scan failed");
        return new ScanResult(success, error != null ? error : "Modrinth scan complete.", status);
    }

    private static JsonObject baseStatus(ReportConfig config) {
        JsonObject status = new JsonObject();
        status.addProperty("enabled", config != null && config.modrinthLookup());
        status.addProperty("running", false);
        status.addProperty("stage", "prepare");
        status.addProperty("stage_label", "Preparing Modrinth scan");
        status.addProperty("stage_detail", "");
        JsonObject progress = new JsonObject(); progress.addProperty("done", 0); progress.addProperty("total", 0);
        status.add("progress", progress);
        JsonObject batch = new JsonObject(); batch.addProperty("index", 0); batch.addProperty("count", 0); batch.addProperty("size", 0);
        status.add("batch", batch);
        status.add("eta_seconds", com.google.gson.JsonNull.INSTANCE);
        JsonObject stats = new JsonObject();
        for (String key : List.of("jars_considered", "jars_capped", "cache_entries", "cache_hits",
                "cache_misses", "api_requests", "rate_limit_waits", "matched", "unresolved", "outdated",
                "coverage_pct", "hash_batches", "project_batches", "bytes_hashed", "jars_per_minute",
                "oldest_cache_age_seconds")) {
            stats.addProperty(key, 0);
        }
        stats.addProperty("truncated", false);
        stats.addProperty("cache_hit_rate", 0);
        stats.addProperty("rps", 0);
        JsonObject sides = new JsonObject();
        for (String key : List.of("server_required", "client_only", "both", "other")) sides.addProperty(key, 0);
        stats.add("side_tag_mix", sides);
        stats.add("top_outdated", new JsonArray());
        status.add("stats", stats);
        return status;
    }

    private static void enrichStats(JsonObject status, List<ModrinthLookupService.Candidate> candidates,
                                    Map<String, ModrinthLookupService.SideInfo> byHash,
                                    Map<String, ModrinthLookupService.SideInfo> byId, JsonArray updates, Instant started) {
        JsonObject s = stats(status);
        s.addProperty("cache_entries", byHash.size());
        s.addProperty("matched", byId.size());
        s.addProperty("unresolved", Math.max(0, candidates.size() - byId.size()));
        s.addProperty("outdated", updates.size());
        s.addProperty("coverage_pct", candidates.isEmpty() ? 0 : byId.size() * 100 / candidates.size());
        s.addProperty("bytes_hashed", candidates.stream().mapToLong(c -> {
            try { return Files.size(c.jarPath()); } catch (Exception ignored) { return 0; }
        }).sum());
        s.addProperty("jars_per_minute", candidates.isEmpty() ? 0 : candidates.size() * 60_000L
                / Math.max(1, Duration.between(started, Instant.now()).toMillis()));
        JsonArray top = new JsonArray();
        for (JsonElement update : updates) {
            if (top.size() == 5) break;
            JsonObject row = update.getAsJsonObject();
            JsonObject compact = new JsonObject();
            compact.addProperty("mod_id", string(row, "mod_id"));
            compact.addProperty("title", string(row, "title"));
            top.add(compact);
        }
        s.add("top_outdated", top);
    }

    private static JsonObject stats(JsonObject status) { return status.getAsJsonObject("stats"); }

    /** Prefer config loader; fall back to facts.meta.loader when unset/unknown. */
    static String resolveLoader(ReportConfig config, JsonObject facts) {
        String loader = config != null ? config.loader() : null;
        if (loader != null && !loader.isBlank() && !"unknown".equalsIgnoreCase(loader.trim())) {
            return loader;
        }
        if (facts != null && facts.has("meta") && facts.get("meta").isJsonObject()) {
            JsonObject meta = facts.getAsJsonObject("meta");
            if (meta.has("loader") && meta.get("loader").isJsonPrimitive()) {
                String fromMeta = meta.get("loader").getAsString();
                if (fromMeta != null && !fromMeta.isBlank()) {
                    return fromMeta;
                }
            }
        }
        return loader != null ? loader : "neoforge";
    }

    private static Path statusFile(String serverDir) {
        return serverDir == null || serverDir.isBlank() ? null : Path.of(serverDir, "watchtower", STATUS_FILENAME);
    }
    private static int countEligibleMods(JsonArray mods, String serverDir) {
        int count = 0; for (JsonElement e : mods) if (e.isJsonObject() && resolveJar(mods, string(e.getAsJsonObject(), "id"), serverDir) != null) count++; return count;
    }
    private static Set<String> crashSuspects(JsonObject optional) {
        Set<String> ids = new java.util.LinkedHashSet<>();
        if (optional != null && optional.has("crash_summaries") && optional.get("crash_summaries").isJsonArray()) {
            for (JsonElement e : optional.getAsJsonArray("crash_summaries")) if (e.isJsonObject())
                for (String key : List.of("primary_mod_id", "stall_mod_id", "suspect_mod_id", "linked_mod_id")) {
                    String id = string(e.getAsJsonObject(), key); if (id != null && !id.isBlank()) ids.add(id.toLowerCase());
                }
        }
        return ids;
    }
    private static JsonObject findMod(JsonArray mods, String id) {
        for (JsonElement e : mods) if (e.isJsonObject() && id.equals(string(e.getAsJsonObject(), "id"))) return e.getAsJsonObject();
        return null;
    }
    private static Path resolveJar(JsonArray mods, String id, String serverDir) {
        JsonObject mod = findMod(mods, id);
        String file = string(mod, "jar_file");
        if (serverDir != null && !serverDir.isBlank() && file != null) {
            Path jar = Path.of(serverDir, "mods", file); if (Files.isRegularFile(jar)) return jar;
        }
        return ModJarSideScanner.modJarPath(serverDir, id);
    }
    private static String string(JsonObject object, String key) {
        return object != null && object.has(key) && !object.get(key).isJsonNull() ? object.get(key).getAsString() : null;
    }

    /** Routes generic lookup callbacks into endpoint-shaped scan stages. */
    private static final class StageProgress implements ModrinthScanProgress {
        private final ModrinthScanProgress delegate;
        private boolean batchesStarted;
        StageProgress(ModrinthScanProgress delegate) { this.delegate = delegate; }
        public void stage(String id, String label) { delegate.stage(id, label); }
        public void detail(String message) { delegate.detail(message); }
        public void progress(int done, int total) { delegate.progress(done, total); }
        public void batch(int index, int count, int size) {
            delegate.stage(batchesStarted ? "projects" : "version_files",
                    batchesStarted ? "Loading Modrinth projects" : "Resolving Modrinth version files");
            if (index == count) batchesStarted = true;
            delegate.batch(index, count, size);
        }
        public void etaSeconds(Integer seconds) { delegate.etaSeconds(seconds); }
    }
}
