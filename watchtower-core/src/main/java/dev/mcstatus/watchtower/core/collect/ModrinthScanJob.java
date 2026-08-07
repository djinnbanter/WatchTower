package dev.mcstatus.watchtower.core.collect;

import com.google.gson.GsonBuilder;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import dev.mcstatus.watchtower.core.collect.ModJarMetadataReader;
import dev.mcstatus.watchtower.core.collect.ReportArtifactFinder;
import dev.mcstatus.watchtower.core.ops.OpsCacheReader;
import dev.mcstatus.watchtower.core.ops.OpsCacheSchema;
import dev.mcstatus.watchtower.core.ops.OpsCacheWriter;
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
        Path opsCache = serverDir != null && !serverDir.isBlank()
                ? Path.of(serverDir, "watchtower", "ops-cache.json") : null;
        return run(serverDir, config, reportDir, opsCache, progress);
    }

    public static ScanResult run(
            String serverDir,
            ReportConfig config,
            Path reportDir,
            Path opsCachePath,
            ModrinthScanProgress progress) {
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
            JsonObject facts;
            JsonObject optional;
            boolean persistToFacts = factsFile != null && Files.isRegularFile(factsFile);

            if (persistToFacts) {
                facts = JsonParser.parseString(Files.readString(factsFile, StandardCharsets.UTF_8))
                        .getAsJsonObject();
                optional = facts.has("optional") && facts.get("optional").isJsonObject()
                        ? facts.getAsJsonObject("optional") : new JsonObject();
                if (!facts.has("optional")) {
                    facts.add("optional", optional);
                }
            } else {
                facts = buildSyntheticFacts(serverDir, config, opsCachePath);
                optional = facts.getAsJsonObject("optional");
            }

            if (optional == null || !optional.has("mods") || !optional.get("mods").isJsonArray()
                    || optional.getAsJsonArray("mods").isEmpty()) {
                return finish(statusFile, status, started, false,
                        "No mod inventory available — wait for Scanning or add jars to mods/.", observer);
            }
            JsonArray mods = optional.getAsJsonArray("mods");
            List<ModrinthLookupService.Candidate> candidates = buildCandidates(optional, serverDir);
            stats(status).addProperty("jars_considered", candidates.size());
            stats(status).addProperty("jars_capped", ModrinthLookupService.maxJarsPerReport());
            stats(status).addProperty("truncated", countEligibleMods(mods, serverDir) > candidates.size());

            observer.progress(0, candidates.size());
            Path cacheFile = Path.of(serverDir, "watchtower", "modrinth-cache.json");
            Map<Path, String> hashByPath = new HashMap<>();
            ModrinthLookupService.hashCandidates(candidates, hashByPath, observer);
            Map<String, ModrinthLookupService.SideInfo> cachedByHash =
                    ModrinthLookupService.lookupCacheOnly(candidates, cacheFile, hashByPath);
            int cacheHits = cachedByHash.size();
            int cacheMisses = Math.max(0, candidates.size() - cacheHits);
            stats(status).addProperty("cache_hits", cacheHits);
            stats(status).addProperty("cache_misses", cacheMisses);
            stats(status).addProperty("cache_hit_rate",
                    candidates.isEmpty() ? 0 : cacheHits * 100.0 / candidates.size());
            Map<String, ModrinthLookupService.SideInfo> byHash =
                    ModrinthLookupService.lookup(candidates, cacheFile, config,
                            new StageProgress(observer), hashByPath);
            Map<String, ModrinthLookupService.SideInfo> byId = new HashMap<>();
            Map<String, String> hashById = new HashMap<>();
            for (ModrinthLookupService.Candidate candidate : candidates) {
                String hash = hashByPath.get(candidate.jarPath());
                if (hash == null) {
                    continue;
                }
                hashById.put(candidate.modId(), hash);
                ModrinthLookupService.SideInfo info = byHash.get(hash);
                if (info != null && !info.miss()) {
                    byId.put(candidate.modId(), info);
                }
            }
            String minecraftVersion = ModrinthLookupService.resolveMinecraftVersion(facts, serverDir);
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
            ModrinthLookupService.applyIdentityToMods(mods, byId, loader);
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
            if (persistToFacts) {
                Files.writeString(factsFile, new GsonBuilder().setPrettyPrinting().create().toJson(facts),
                        StandardCharsets.UTF_8);
            } else if (opsCachePath != null) {
                OpsCacheWriter.applyModrinthScan(opsCachePath, optional);
            }

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

    private static JsonObject buildSyntheticFacts(String serverDir, ReportConfig config, Path opsCachePath) {
        JsonObject facts = new JsonObject();
        JsonObject meta = new JsonObject();
        if (config != null) {
            if (config.loader() != null) {
                meta.addProperty("loader", config.loader());
            }
            if (config.hostname() != null) {
                meta.addProperty("hostname", config.hostname());
            }
        }
        facts.add("meta", meta);

        JsonObject optional = new JsonObject();
        JsonArray mods = null;
        try {
            if (opsCachePath != null && Files.isRegularFile(opsCachePath)) {
                JsonObject cache = OpsCacheReader.load(opsCachePath);
                if (cache.has(OpsCacheSchema.RUNNING_MODS)
                        && cache.get(OpsCacheSchema.RUNNING_MODS).isJsonObject()) {
                    JsonObject running = cache.getAsJsonObject(OpsCacheSchema.RUNNING_MODS);
                    if (running.has(OpsCacheSchema.RUNNING_MODS_MODS)
                            && running.get(OpsCacheSchema.RUNNING_MODS_MODS).isJsonArray()) {
                        mods = running.getAsJsonArray(OpsCacheSchema.RUNNING_MODS_MODS).deepCopy();
                    }
                }
                mergeCrashSummariesFromOps(optional, cache);
            }
        } catch (Exception ignored) {
        }
        if (mods == null || mods.isEmpty()) {
            mods = ModJarMetadataReader.listModsFromDir(serverDir);
        }
        optional.add("mods", mods != null ? mods : new JsonArray());
        facts.add("optional", optional);
        return facts;
    }

    private static void mergeCrashSummariesFromOps(JsonObject optional, JsonObject cache) {
        if (cache == null || !cache.has(OpsCacheSchema.CRASHES)
                || !cache.get(OpsCacheSchema.CRASHES).isJsonObject()) {
            return;
        }
        JsonObject crashes = cache.getAsJsonObject(OpsCacheSchema.CRASHES);
        if (!crashes.has(OpsCacheSchema.CRASHES_ENTRIES)
                || !crashes.get(OpsCacheSchema.CRASHES_ENTRIES).isJsonArray()) {
            return;
        }
        JsonArray summaries = new JsonArray();
        for (JsonElement el : crashes.getAsJsonArray(OpsCacheSchema.CRASHES_ENTRIES)) {
            if (!el.isJsonObject()) {
                continue;
            }
            JsonObject entry = el.getAsJsonObject();
            JsonObject summary = new JsonObject();
            if (entry.has("primary_mod_id")) {
                summary.add("primary_mod_id", entry.get("primary_mod_id"));
            }
            if (entry.has("stall_mod_id")) {
                summary.add("stall_mod_id", entry.get("stall_mod_id"));
            }
            if (summary.size() > 0) {
                summaries.add(summary);
            }
        }
        if (!summaries.isEmpty()) {
            optional.add("crash_summaries", summaries);
        }
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
        long elapsedMs = Math.max(1, Duration.between(started, Instant.now()).toMillis());
        s.addProperty("jars_per_minute", candidates.isEmpty() ? 0 : candidates.size() * 60_000L / elapsedMs);
        ModrinthLookupService.ScanStats scanStats = ModrinthLookupService.lastScanStats();
        s.addProperty("api_requests", scanStats.apiRequests());
        s.addProperty("rate_limit_waits", scanStats.rateLimitWaits());
        s.addProperty("hash_batches", scanStats.hashBatches());
        s.addProperty("project_batches", scanStats.projectBatches());
        s.addProperty("rps", scanStats.apiRequests() * 1000.0 / elapsedMs);
        Instant now = Instant.now();
        long oldestAge = 0;
        int serverRequired = 0;
        int clientOnly = 0;
        int both = 0;
        int other = 0;
        for (ModrinthLookupService.SideInfo info : byHash.values()) {
            if (info == null) {
                continue;
            }
            long age = now.getEpochSecond() - info.fetchedAtOrEpoch().getEpochSecond();
            if (age > oldestAge) {
                oldestAge = age;
            }
            if (info.miss()) {
                other++;
                continue;
            }
            String client = info.clientSide() != null ? info.clientSide() : "unknown";
            String server = info.serverSide() != null ? info.serverSide() : "unknown";
            boolean serverReq = "required".equalsIgnoreCase(server);
            boolean clientReq = "required".equalsIgnoreCase(client);
            boolean clientUnsup = "unsupported".equalsIgnoreCase(client);
            boolean serverUnsup = "unsupported".equalsIgnoreCase(server);
            if (serverReq && clientUnsup) {
                serverRequired++;
            } else if (clientReq && serverUnsup) {
                clientOnly++;
            } else if (serverReq && clientReq) {
                both++;
            } else {
                other++;
            }
        }
        s.addProperty("oldest_cache_age_seconds", oldestAge);
        JsonObject sides = new JsonObject();
        sides.addProperty("server_required", serverRequired);
        sides.addProperty("client_only", clientOnly);
        sides.addProperty("both", both);
        sides.addProperty("other", other);
        s.add("side_tag_mix", sides);
        JsonArray top = new JsonArray();
        for (JsonElement update : updates) {
            if (top.size() == 5) break;
            JsonObject row = update.getAsJsonObject();
            JsonObject compact = new JsonObject();
            compact.addProperty("mod_id", string(row, "mod_id"));
            compact.addProperty("title", string(row, "title"));
            String icon = string(row, "icon_url");
            if (icon != null && !icon.isBlank()) {
                compact.addProperty("icon_url", icon);
            }
            String current = string(row, "current_version");
            if (current != null && !current.isBlank()) {
                compact.addProperty("current_version", current);
            }
            String latest = string(row, "latest_compatible");
            if (latest == null || latest.isBlank()) {
                latest = string(row, "compatible_version_number");
            }
            if (latest != null && !latest.isBlank()) {
                compact.addProperty("latest_compatible", latest);
            }
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
        if (id == null) {
            return null;
        }
        for (JsonElement e : mods) {
            if (e.isJsonObject() && id.equalsIgnoreCase(string(e.getAsJsonObject(), "id"))) {
                return e.getAsJsonObject();
            }
        }
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
