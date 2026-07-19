package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import dev.mcstatus.watchtower.core.report.ReportConfig;

import java.io.IOException;
import java.io.InputStream;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.security.MessageDigest;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.HexFormat;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Opt-in Modrinth Layer-2 lookup by jar SHA-512. Resolves project identity, installed version,
 * and optional loader/MC-compatible update links. Zero network when disabled or in DR mode.
 * Never downloads jars.
 */
public final class ModrinthLookupService {

    private static final String VERSION_FILES_URL = "https://api.modrinth.com/v2/version_files";
    private static final String PROJECTS_URL = "https://api.modrinth.com/v2/projects?ids=";
    private static final String PROJECT_VERSIONS_URL = "https://api.modrinth.com/v2/project/";
    private static final String VERSION_URL = "https://api.modrinth.com/v2/version/";
    private static final String USER_AGENT = "djinnbanter/WatchTower (mod side lookup)";
    private static final int SCHEMA = 3;
    private static final int MAX_CACHE_ENTRIES = 5000;
    private static final int MAX_JARS_PER_REPORT = 512;
    private static final int MAX_COMPAT_FETCHES = 256;
    private static final int HASH_CHUNK_SIZE = 128;
    private static final int PROJECT_ID_CHUNK_SIZE = 100;
    private static final int DESCRIPTION_MAX_CHARS = 800;
    private static final long HIT_TTL_SECONDS = 30L * 24 * 3600;
    private static final long MISS_RETRY_SECONDS = 7L * 24 * 3600;

    /** Dependency declared on a Modrinth version (candidate update). */
    public record VersionDependency(String projectId, String versionId, String dependencyType) {
    }

    /** Test seam — when non-null, used instead of live HTTP. */
    static volatile HttpTransport transportForTests;
    static final AtomicInteger httpClientCreationsForTests = new AtomicInteger();

    public record Candidate(String modId, Path jarPath) {
    }

    /**
     * Project side metadata plus optional installed-version, links, and compatible-update fields.
     * Compact constructors preserved for existing callers/tests.
     */
    public record SideInfo(
            String projectId,
            String slug,
            String clientSide,
            String serverSide,
            String title,
            boolean miss,
            String versionId,
            String versionNumber,
            boolean outdated,
            String compatibleVersionId,
            String compatibleVersionNumber,
            String compatibleUrl,
            String wikiUrl,
            String sourceUrl,
            String issuesUrl,
            String discordUrl,
            String iconUrl,
            String description,
            List<VersionDependency> compatibleDependencies) {

        public SideInfo {
            compatibleDependencies = compatibleDependencies == null
                    ? List.of()
                    : List.copyOf(compatibleDependencies);
        }

        public SideInfo(
                String projectId,
                String slug,
                String clientSide,
                String serverSide,
                String title,
                boolean miss) {
            this(projectId, slug, clientSide, serverSide, title, miss,
                    null, null, false, null, null, null,
                    null, null, null, null, null, null, List.of());
        }

        /** 12-arg form used by tests and crash-suspect rebuild. */
        public SideInfo(
                String projectId,
                String slug,
                String clientSide,
                String serverSide,
                String title,
                boolean miss,
                String versionId,
                String versionNumber,
                boolean outdated,
                String compatibleVersionId,
                String compatibleVersionNumber,
                String compatibleUrl) {
            this(projectId, slug, clientSide, serverSide, title, miss,
                    versionId, versionNumber, outdated, compatibleVersionId, compatibleVersionNumber, compatibleUrl,
                    null, null, null, null, null, null, List.of());
        }

        /** 18-arg form without deps (cache load / project fetch). */
        public SideInfo(
                String projectId,
                String slug,
                String clientSide,
                String serverSide,
                String title,
                boolean miss,
                String versionId,
                String versionNumber,
                boolean outdated,
                String compatibleVersionId,
                String compatibleVersionNumber,
                String compatibleUrl,
                String wikiUrl,
                String sourceUrl,
                String issuesUrl,
                String discordUrl,
                String iconUrl,
                String description) {
            this(projectId, slug, clientSide, serverSide, title, miss,
                    versionId, versionNumber, outdated, compatibleVersionId, compatibleVersionNumber, compatibleUrl,
                    wikiUrl, sourceUrl, issuesUrl, discordUrl, iconUrl, description, List.of());
        }

        public static SideInfo missInfo() {
            return new SideInfo(null, null, "unknown", "unknown", null, true);
        }

        public SideInfo withVersion(String versionId, String versionNumber) {
            return new SideInfo(projectId, slug, clientSide, serverSide, title, miss,
                    versionId, versionNumber, outdated, compatibleVersionId, compatibleVersionNumber, compatibleUrl,
                    wikiUrl, sourceUrl, issuesUrl, discordUrl, iconUrl, description, compatibleDependencies);
        }

        public SideInfo withCompatibleUpdate(
                boolean outdated,
                String compatibleVersionId,
                String compatibleVersionNumber,
                String compatibleUrl) {
            return withCompatibleUpdate(outdated, compatibleVersionId, compatibleVersionNumber, compatibleUrl,
                    compatibleDependencies);
        }

        public SideInfo withCompatibleUpdate(
                boolean outdated,
                String compatibleVersionId,
                String compatibleVersionNumber,
                String compatibleUrl,
                List<VersionDependency> compatibleDependencies) {
            List<VersionDependency> deps = compatibleDependencies == null
                    ? List.of()
                    : List.copyOf(compatibleDependencies);
            return new SideInfo(projectId, slug, clientSide, serverSide, title, miss,
                    versionId, versionNumber, outdated, compatibleVersionId, compatibleVersionNumber, compatibleUrl,
                    wikiUrl, sourceUrl, issuesUrl, discordUrl, iconUrl, description, deps);
        }

        public SideInfo withLinks(
                String wikiUrl,
                String sourceUrl,
                String issuesUrl,
                String discordUrl,
                String iconUrl,
                String description) {
            return new SideInfo(projectId, slug, clientSide, serverSide, title, miss,
                    versionId, versionNumber, outdated, compatibleVersionId, compatibleVersionNumber, compatibleUrl,
                    wikiUrl, sourceUrl, issuesUrl, discordUrl, iconUrl, description, compatibleDependencies);
        }

        public String projectUrl() {
            if (slug == null || slug.isBlank()) {
                return null;
            }
            return "https://modrinth.com/mod/" + slug;
        }

        public String versionUrl() {
            if (slug == null || slug.isBlank() || versionId == null || versionId.isBlank()) {
                return null;
            }
            return "https://modrinth.com/mod/" + slug + "/version/" + versionId;
        }

        public String bestCtaUrl() {
            if (outdated && compatibleUrl != null && !compatibleUrl.isBlank()) {
                return compatibleUrl;
            }
            String v = versionUrl();
            if (v != null) {
                return v;
            }
            return projectUrl();
        }
    }

    interface HttpTransport {
        String postJson(String url, String body) throws IOException, InterruptedException;

        String getJson(String url) throws IOException, InterruptedException;
    }

    private ModrinthLookupService() {
    }

    public static int maxJarsPerReport() {
        return MAX_JARS_PER_REPORT;
    }

    public static Map<String, SideInfo> lookup(List<Candidate> candidates, Path cacheFile, ReportConfig config) {
        return lookup(candidates, cacheFile, config, ModrinthScanProgress.NOOP);
    }

    /** Performs the network lookup used exclusively by the dedicated Modrinth scan. */
    public static Map<String, SideInfo> lookup(
            List<Candidate> candidates, Path cacheFile, ReportConfig config, ModrinthScanProgress progress) {
        if (config == null || !config.modrinthLookup() || config.disasterRecovery()) {
            return Map.of();
        }
        if (candidates == null || candidates.isEmpty()) {
            return Map.of();
        }
        ModrinthScanProgress observer = progress != null ? progress : ModrinthScanProgress.NOOP;

        Map<String, SideInfo> cache = loadCache(cacheFile);
        Instant now = Instant.now();
        Map<String, SideInfo> result = new LinkedHashMap<>();
        List<Candidate> needFetch = new ArrayList<>();
        Set<String> seenHashes = new HashSet<>();

        int hashed = 0;
        int hashTotal = Math.min(candidates.size(), MAX_JARS_PER_REPORT);
        observer.stage("hash", "Hashing installed mod jars");
        for (Candidate c : candidates) {
            if (c == null || c.jarPath() == null || !Files.isRegularFile(c.jarPath())) {
                continue;
            }
            if (result.size() + needFetch.size() >= MAX_JARS_PER_REPORT) {
                break;
            }
            String hash;
            try {
                hash = sha512Hex(c.jarPath());
                hashed++;
                observer.progress(hashed, hashTotal);
            } catch (Exception e) {
                continue;
            }
            if (!seenHashes.add(hash)) {
                continue;
            }
            SideInfo cached = cache.get(hash);
            if (cached != null && isFresh(cached, now)) {
                result.put(hash, cached);
            } else {
                needFetch.add(c);
            }
        }

        observer.stage("cache", "Checking Modrinth cache");
        observer.detail(needFetch.size() + " jars need Modrinth lookup");
        if (!needFetch.isEmpty()) {
            try {
                Map<String, SideInfo> fetched = fetchBatch(needFetch, config.modrinthRateLimit(), observer);
                result.putAll(fetched);
                cache.putAll(fetched);
                saveCache(cacheFile, cache);
            } catch (RateLimitExceeded ignored) {
                // Keep partial results; never break a report
                saveCache(cacheFile, cache);
            } catch (Exception ignored) {
                // never break a report
            }
        }
        return result;
    }

    /** Hashes local jars and returns existing cache entries only. This method never creates HTTP. */
    public static Map<String, SideInfo> lookupCacheOnly(List<Candidate> candidates, Path cacheFile) {
        if (candidates == null || candidates.isEmpty()) {
            return Map.of();
        }
        Map<String, SideInfo> cache = loadCache(cacheFile);
        Map<String, SideInfo> result = new LinkedHashMap<>();
        Set<String> seen = new HashSet<>();
        for (Candidate candidate : candidates) {
            if (candidate == null || candidate.jarPath() == null || !Files.isRegularFile(candidate.jarPath())) {
                continue;
            }
            try {
                String hash = sha512Hex(candidate.jarPath());
                if (seen.add(hash) && cache.containsKey(hash)) {
                    result.put(hash, cache.get(hash));
                }
            } catch (Exception ignored) {
                // cache application must never break report generation
            }
        }
        return result;
    }

    /**
     * For resolved projects, fetch newest loader/MC-compatible version and mark outdated when
     * the installed jar hash differs. Mutates values in {@code byModId}.
     *
     * @param installedHashByModId SHA-512 of the installed jar per mod id
     * @param priorityModIds       checked first (crash suspects, create/flywheel, …)
     */
    public static void enrichCompatibleUpdates(
            Map<String, SideInfo> byModId,
            Map<String, String> installedHashByModId,
            Set<String> priorityModIds,
            String loader,
            String minecraftVersion,
            int rateLimit) {
        enrichCompatibleUpdates(byModId, installedHashByModId, priorityModIds, loader, minecraftVersion,
                rateLimit, ModrinthScanProgress.NOOP);
    }

    public static void enrichCompatibleUpdates(
            Map<String, SideInfo> byModId,
            Map<String, String> installedHashByModId,
            Set<String> priorityModIds,
            String loader,
            String minecraftVersion,
            int rateLimit,
            ModrinthScanProgress progress) {
        if (byModId == null || byModId.isEmpty()) {
            return;
        }
        ModrinthScanProgress observer = progress != null ? progress : ModrinthScanProgress.NOOP;
        String mrLoader = normalizeLoader(loader);
        // Loader always normalizes; MC may be blank — then fetchCompatible uses loader-only queries.
        String mc = minecraftVersion != null ? minecraftVersion.trim() : "";
        if (mrLoader.isBlank()) {
            return;
        }

        List<String> order = new ArrayList<>();
        if (priorityModIds != null) {
            for (String id : priorityModIds) {
                if (byModId.containsKey(id) && !order.contains(id)) {
                    order.add(id);
                }
            }
        }
        for (String id : byModId.keySet()) {
            if (!order.contains(id)) {
                order.add(id);
            }
        }

        int fetched = 0;
        int total = Math.min(MAX_COMPAT_FETCHES, order.size());
        for (String modId : order) {
            if (fetched >= MAX_COMPAT_FETCHES) {
                break;
            }
            SideInfo info = byModId.get(modId);
            if (info == null || info.miss() || info.projectId() == null) {
                continue;
            }
            String installedHash = installedHashByModId != null ? installedHashByModId.get(modId) : null;
            try {
                SideInfo updated = fetchCompatible(info, installedHash, mrLoader, mc, rateLimit);
                if (updated != null) {
                    byModId.put(modId, updated);
                    fetched++;
                    observer.progress(fetched, total);
                }
            } catch (RateLimitExceeded ignored) {
                // Second 429 after Retry-After — skip remaining Modrinth work for this report.
                break;
            } catch (Exception ignored) {
                // never break a report
            }
        }
    }

    /** Write Modrinth identity / update fields onto matching mods[] rows. */
    public static void applyIdentityToMods(JsonArray mods, Map<String, SideInfo> byModId) {
        if (mods == null || byModId == null || byModId.isEmpty()) {
            return;
        }
        for (JsonElement el : mods) {
            if (!el.isJsonObject()) {
                continue;
            }
            JsonObject mod = el.getAsJsonObject();
            String id = str(mod, "id");
            if (id == null) {
                continue;
            }
            SideInfo info = byModId.get(id);
            if (info == null || info.miss()) {
                continue;
            }
            if (info.projectId() != null) {
                mod.addProperty("modrinth_project_id", info.projectId());
            }
            if (info.slug() != null) {
                mod.addProperty("modrinth_slug", info.slug());
            }
            if (info.title() != null) {
                mod.addProperty("modrinth_title", info.title());
            }
            String projectUrl = info.projectUrl();
            if (projectUrl != null) {
                mod.addProperty("modrinth_url", projectUrl);
            }
            if (info.versionId() != null) {
                mod.addProperty("modrinth_version_id", info.versionId());
            }
            if (info.versionNumber() != null) {
                mod.addProperty("modrinth_version_number", info.versionNumber());
            }
            String versionUrl = info.versionUrl();
            if (versionUrl != null) {
                mod.addProperty("modrinth_version_url", versionUrl);
            }
            mod.addProperty("modrinth_outdated", info.outdated());
            if (info.compatibleVersionId() != null) {
                mod.addProperty("modrinth_compatible_version_id", info.compatibleVersionId());
            }
            if (info.compatibleVersionNumber() != null) {
                mod.addProperty("modrinth_compatible_version_number", info.compatibleVersionNumber());
            }
            if (info.compatibleUrl() != null) {
                mod.addProperty("modrinth_compatible_url", info.compatibleUrl());
            }
            if (info.outdated() && info.compatibleVersionNumber() != null) {
                String loaderLabel = "NeoForge";
                mod.addProperty("modrinth_update_label",
                        loaderLabel + " build " + info.compatibleVersionNumber() + " available");
            }
            String cta = info.bestCtaUrl();
            if (cta != null) {
                mod.addProperty("modrinth_cta_url", cta);
            }
            if (info.wikiUrl() != null && !info.wikiUrl().isBlank()) {
                mod.addProperty("modrinth_wiki_url", info.wikiUrl());
            }
            if (info.sourceUrl() != null && !info.sourceUrl().isBlank()) {
                mod.addProperty("modrinth_source_url", info.sourceUrl());
            }
            if (info.issuesUrl() != null && !info.issuesUrl().isBlank()) {
                mod.addProperty("modrinth_issues_url", info.issuesUrl());
            }
            if (info.discordUrl() != null && !info.discordUrl().isBlank()) {
                mod.addProperty("modrinth_discord_url", info.discordUrl());
            }
            if (info.iconUrl() != null && !info.iconUrl().isBlank()) {
                mod.addProperty("modrinth_icon_url", info.iconUrl());
            }
            if (info.description() != null && !info.description().isBlank()) {
                mod.addProperty("modrinth_description", info.description());
            }
        }
    }

    /** Build {@code optional.modrinth_updates[]} from mods that are outdated. */
    public static JsonArray buildUpdatesSummary(JsonArray mods) {
        JsonArray out = new JsonArray();
        if (mods == null) {
            return out;
        }
        for (JsonElement el : mods) {
            if (!el.isJsonObject()) {
                continue;
            }
            JsonObject mod = el.getAsJsonObject();
            if (!mod.has("modrinth_outdated") || !mod.get("modrinth_outdated").getAsBoolean()) {
                continue;
            }
            JsonObject row = new JsonObject();
            String id = str(mod, "id");
            if (id == null) {
                continue;
            }
            row.addProperty("mod_id", id);
            if (mod.has("modrinth_title")) {
                row.addProperty("title", mod.get("modrinth_title").getAsString());
            } else if (mod.has("display_name")) {
                row.addProperty("title", mod.get("display_name").getAsString());
            } else {
                row.addProperty("title", id);
            }
            if (mod.has("version")) {
                row.addProperty("current_version", mod.get("version").getAsString());
            }
            if (mod.has("modrinth_compatible_version_number")) {
                row.addProperty("latest_compatible",
                        mod.get("modrinth_compatible_version_number").getAsString());
            }
            if (mod.has("modrinth_compatible_url")) {
                row.addProperty("modrinth_compatible_url",
                        mod.get("modrinth_compatible_url").getAsString());
            } else if (mod.has("modrinth_cta_url")) {
                row.addProperty("modrinth_compatible_url", mod.get("modrinth_cta_url").getAsString());
            }
            if (mod.has("modrinth_update_label")) {
                row.addProperty("label", mod.get("modrinth_update_label").getAsString());
            }
            // Create/Flywheel pairing hint
            if ("create".equals(id) || "flywheel".equals(id)) {
                row.addProperty("related_pair", "create".equals(id) ? "flywheel" : "create");
            }
            out.add(row);
        }
        return out;
    }

    /**
     * Second-pass after crash_summaries exist: ensure crash suspects get Modrinth identity
     * and compatible-update links. No-op when lookup disabled or DR.
     */
    public static void enrichCrashSuspects(JsonObject optional, ReportConfig config, String serverDir) {
        if (optional == null || !optional.has("mods") || !optional.get("mods").isJsonArray()) {
            return;
        }
        JsonArray mods = optional.getAsJsonArray("mods");
        JsonArray updates = ModUpdateImpactAnalyzer.enrich(mods, buildUpdatesSummary(mods), Map.of());
        if (updates.isEmpty()) {
            optional.remove("modrinth_updates");
        } else {
            optional.add("modrinth_updates", updates);
        }
    }

    private static boolean modIdPresent(JsonArray mods, String id) {
        return findMod(mods, id) != null;
    }

    private static JsonObject findMod(JsonArray mods, String id) {
        if (mods == null || id == null) {
            return null;
        }
        for (JsonElement el : mods) {
            if (!el.isJsonObject()) {
                continue;
            }
            JsonObject mod = el.getAsJsonObject();
            if (id.equalsIgnoreCase(str(mod, "id"))) {
                return mod;
            }
        }
        return null;
    }

    private static Path jarForMod(JsonArray mods, String id, String serverDir) {
        JsonObject mod = findMod(mods, id);
        if (mod != null && serverDir != null && !serverDir.isBlank()) {
            String jarFile = str(mod, "jar_file");
            if (jarFile != null && !jarFile.isBlank()) {
                Path jar = Path.of(serverDir, "mods", jarFile);
                if (Files.isRegularFile(jar)) {
                    return jar;
                }
            }
        }
        return ModJarSideScanner.modJarPath(serverDir, id);
    }

    public static String sha512Hex(Path jar) throws Exception {
        MessageDigest digest = MessageDigest.getInstance("SHA-512");
        try (InputStream in = Files.newInputStream(jar)) {
            byte[] buf = new byte[8192];
            int n;
            while ((n = in.read(buf)) >= 0) {
                digest.update(buf, 0, n);
            }
        }
        return HexFormat.of().formatHex(digest.digest());
    }

    public static String normalizeLoader(String loader) {
        if (loader == null || loader.isBlank()) {
            return "neoforge";
        }
        String l = loader.trim().toLowerCase(Locale.ROOT);
        if (l.contains("fabric")) {
            return "fabric";
        }
        if (l.contains("quilt")) {
            return "quilt";
        }
        // forge / neoforge / unknown → neoforge (1.21 primary line)
        return "neoforge";
    }

    public static String minecraftVersionFromMods(JsonArray mods) {
        if (mods == null) {
            return null;
        }
        for (JsonElement el : mods) {
            if (!el.isJsonObject()) {
                continue;
            }
            JsonObject mod = el.getAsJsonObject();
            if ("minecraft".equalsIgnoreCase(str(mod, "id"))) {
                String v = str(mod, "version");
                if (v != null && !v.isBlank() && !"?".equals(v)) {
                    // Strip build suffixes like 1.21.1-...
                    int dash = v.indexOf('-');
                    return dash > 0 ? v.substring(0, dash) : v;
                }
            }
        }
        return null;
    }

    /**
     * Resolve Minecraft version for Modrinth compatible-update queries.
     * Live NeoForge facts omit a {@code minecraft} mod row from {@code optional.mods}, so we also
     * read spark / startup platform blocks, {@code +mc} version suffixes, and NeoForge version mapping.
     */
    public static String minecraftVersionFromFacts(JsonObject facts) {
        if (facts == null) {
            return null;
        }
        JsonObject optional = facts.has("optional") && facts.get("optional").isJsonObject()
                ? facts.getAsJsonObject("optional") : null;
        if (facts.has("meta") && facts.get("meta").isJsonObject()) {
            String explicit = normalizeMcVersion(str(facts.getAsJsonObject("meta"), "minecraft_version"));
            if (explicit != null) {
                return explicit;
            }
        }
        if (optional != null) {
            if (optional.has("watchtower_native") && optional.get("watchtower_native").isJsonObject()) {
                String fromNative = normalizeMcVersion(
                        str(optional.getAsJsonObject("watchtower_native"), "minecraft_version"));
                if (fromNative != null) {
                    return fromNative;
                }
            }
            String fromPlatform = platformMinecraft(optional.get("spark_profile"));
            if (fromPlatform == null) {
                fromPlatform = platformMinecraft(optional.get("spark"));
            }
            if (fromPlatform == null) {
                fromPlatform = platformMinecraft(optional.get("startup_profile"));
            }
            if (fromPlatform != null) {
                return fromPlatform;
            }
            if (optional.has("mods") && optional.get("mods").isJsonArray()) {
                String fromMods = minecraftVersionFromMods(optional.getAsJsonArray("mods"));
                if (fromMods != null) {
                    return fromMods;
                }
                String fromSuffix = minecraftFromModVersionSuffixes(optional.getAsJsonArray("mods"));
                if (fromSuffix != null) {
                    return fromSuffix;
                }
                String fromLoader = minecraftFromNeoForgeMod(optional.getAsJsonArray("mods"));
                if (fromLoader != null) {
                    return fromLoader;
                }
            }
        }
        return null;
    }

    private static String platformMinecraft(JsonElement blockEl) {
        if (blockEl == null || !blockEl.isJsonObject()) {
            return null;
        }
        JsonObject block = blockEl.getAsJsonObject();
        if (!block.has("platform") || !block.get("platform").isJsonObject()) {
            return null;
        }
        return normalizeMcVersion(str(block.getAsJsonObject("platform"), "minecraft"));
    }

    private static String minecraftFromModVersionSuffixes(JsonArray mods) {
        if (mods == null) {
            return null;
        }
        for (JsonElement el : mods) {
            if (!el.isJsonObject()) {
                continue;
            }
            String v = str(el.getAsJsonObject(), "version");
            if (v == null || v.isBlank()) {
                continue;
            }
            // +mc1.21.1 or -mc1.21.1
            java.util.regex.Matcher m = java.util.regex.Pattern
                    .compile("(?i)[+-]mc(\\d+\\.\\d+(?:\\.\\d+)?)")
                    .matcher(v);
            if (m.find()) {
                return m.group(1);
            }
        }
        return null;
    }

    private static String minecraftFromNeoForgeMod(JsonArray mods) {
        if (mods == null) {
            return null;
        }
        for (JsonElement el : mods) {
            if (!el.isJsonObject()) {
                continue;
            }
            JsonObject mod = el.getAsJsonObject();
            String id = str(mod, "id");
            if (id == null || (!"neoforge".equalsIgnoreCase(id) && !"forge".equalsIgnoreCase(id))) {
                continue;
            }
            String mapped = neoForgeVersionToMinecraft(str(mod, "version"));
            if (mapped != null) {
                return mapped;
            }
        }
        return null;
    }

    /** Map NeoForge {@code 21.1.x} → Minecraft {@code 1.21.1}. */
    static String neoForgeVersionToMinecraft(String neoVersion) {
        if (neoVersion == null || neoVersion.isBlank()) {
            return null;
        }
        java.util.regex.Matcher m = java.util.regex.Pattern
                .compile("^(\\d+)\\.(\\d+)(?:\\.\\d+)?")
                .matcher(neoVersion.trim());
        if (!m.find()) {
            return null;
        }
        return "1." + m.group(1) + "." + m.group(2);
    }

    private static String normalizeMcVersion(String v) {
        if (v == null || v.isBlank() || "?".equals(v)) {
            return null;
        }
        String t = v.trim();
        int dash = t.indexOf('-');
        if (dash > 0) {
            t = t.substring(0, dash);
        }
        return t.matches("\\d+\\.\\d+(?:\\.\\d+)?") ? t : null;
    }

    /** Test hook. */
    public static void resetForTests() {
        transportForTests = null;
        httpClientCreationsForTests.set(0);
    }

    public static void seedTransportForTests(HttpTransport transport) {
        transportForTests = transport;
    }

    public static int httpClientCreationsForTests() {
        return httpClientCreationsForTests.get();
    }

    private static boolean isFresh(SideInfo info, Instant now) {
        return info != null;
    }

    private static Map<String, SideInfo> fetchBatch(
            List<Candidate> needFetch, int rateLimit, ModrinthScanProgress progress)
            throws IOException, InterruptedException {
        HttpTransport transport = transportForTests != null ? transportForTests : liveTransport();
        List<String> hashes = new ArrayList<>();
        for (Candidate c : needFetch) {
            try {
                String hash = sha512Hex(c.jarPath());
                if (!hashes.contains(hash)) {
                    hashes.add(hash);
                }
            } catch (Exception ignored) {
                // skip
            }
        }
        if (hashes.isEmpty()) {
            return Map.of();
        }

        Map<String, String> projectByHash = new HashMap<>();
        Map<String, String> versionIdByHash = new HashMap<>();
        Map<String, String> versionNumberByHash = new HashMap<>();
        Set<String> projectIds = new HashSet<>();

        for (int i = 0; i < hashes.size(); i += HASH_CHUNK_SIZE) {
            List<String> chunk = hashes.subList(i, Math.min(i + HASH_CHUNK_SIZE, hashes.size()));
            progress.batch(i / HASH_CHUNK_SIZE + 1, (hashes.size() + HASH_CHUNK_SIZE - 1) / HASH_CHUNK_SIZE,
                    chunk.size());
            throttle(rateLimit);
            JsonObject body = new JsonObject();
            JsonArray hashArr = new JsonArray();
            chunk.forEach(hashArr::add);
            body.add("hashes", hashArr);
            body.addProperty("algorithm", "sha512");
            String versionBody = transport.postJson(VERSION_FILES_URL, body.toString());
            if (versionBody == null || versionBody.isBlank()) {
                continue;
            }
            JsonObject versions = JsonParser.parseString(versionBody).getAsJsonObject();
            for (String hash : chunk) {
                if (!versions.has(hash) || versions.get(hash).isJsonNull()) {
                    continue;
                }
                JsonObject ver = versions.getAsJsonObject(hash);
                if (ver.has("project_id") && !ver.get("project_id").isJsonNull()) {
                    String projectId = ver.get("project_id").getAsString();
                    projectByHash.put(hash, projectId);
                    projectIds.add(projectId);
                }
                if (ver.has("id") && !ver.get("id").isJsonNull()) {
                    versionIdByHash.put(hash, ver.get("id").getAsString());
                }
                if (ver.has("version_number") && !ver.get("version_number").isJsonNull()) {
                    versionNumberByHash.put(hash, ver.get("version_number").getAsString());
                }
            }
        }

        Map<String, JsonObject> projects = new HashMap<>();
        if (!projectIds.isEmpty()) {
            List<String> idList = new ArrayList<>(projectIds);
            for (int i = 0; i < idList.size(); i += PROJECT_ID_CHUNK_SIZE) {
                List<String> chunk = idList.subList(i, Math.min(i + PROJECT_ID_CHUNK_SIZE, idList.size()));
                progress.batch(i / PROJECT_ID_CHUNK_SIZE + 1,
                        (idList.size() + PROJECT_ID_CHUNK_SIZE - 1) / PROJECT_ID_CHUNK_SIZE, chunk.size());
                throttle(rateLimit);
                JsonArray ids = new JsonArray();
                chunk.forEach(ids::add);
                String url = PROJECTS_URL + encodeIds(ids);
                String projectsBody = transport.getJson(url);
                if (projectsBody == null || projectsBody.isBlank()) {
                    continue;
                }
                JsonArray arr = JsonParser.parseString(projectsBody).getAsJsonArray();
                for (JsonElement el : arr) {
                    if (!el.isJsonObject()) {
                        continue;
                    }
                    JsonObject p = el.getAsJsonObject();
                    if (p.has("id")) {
                        projects.put(p.get("id").getAsString(), p);
                    }
                }
            }
        }

        Instant fetchedAt = Instant.now();
        Map<String, SideInfo> out = new LinkedHashMap<>();
        for (String hash : hashes) {
            String projectId = projectByHash.get(hash);
            if (projectId == null) {
                out.put(hash, withFetchedAt(SideInfo.missInfo(), fetchedAt));
                continue;
            }
            JsonObject p = projects.get(projectId);
            if (p == null) {
                out.put(hash, withFetchedAt(SideInfo.missInfo(), fetchedAt));
                continue;
            }
            SideInfo info = new SideInfo(
                    projectId,
                    str(p, "slug"),
                    strOr(p, "client_side", "unknown"),
                    strOr(p, "server_side", "unknown"),
                    str(p, "title"),
                    false,
                    versionIdByHash.get(hash),
                    versionNumberByHash.get(hash),
                    false,
                    null,
                    null,
                    null,
                    blankToNull(str(p, "wiki_url")),
                    blankToNull(str(p, "source_url")),
                    blankToNull(str(p, "issues_url")),
                    blankToNull(str(p, "discord_url")),
                    blankToNull(str(p, "icon_url")),
                    truncateDescription(str(p, "description")));
            out.put(hash, withFetchedAt(info, fetchedAt));
        }
        return out;
    }

    private static String blankToNull(String v) {
        return v == null || v.isBlank() ? null : v;
    }

    private static String truncateDescription(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String t = raw.strip();
        if (t.length() <= DESCRIPTION_MAX_CHARS) {
            return t;
        }
        return t.substring(0, DESCRIPTION_MAX_CHARS - 1) + "…";
    }

    private static SideInfo fetchCompatible(
            SideInfo info,
            String installedHash,
            String loader,
            String mcVersion,
            int rateLimit) throws IOException, InterruptedException {
        HttpTransport transport = transportForTests != null ? transportForTests : liveTransport();
        JsonArray arr = fetchProjectVersions(transport, info.projectId(), loader, mcVersion, rateLimit);
        // Exact MC filter sometimes returns empty (1.21 vs 1.21.1). Retry loader-only, then prefer MC match.
        if (arr.isEmpty() && mcVersion != null && !mcVersion.isBlank()) {
            arr = preferMatchingGameVersion(
                    fetchProjectVersions(transport, info.projectId(), loader, null, rateLimit),
                    mcVersion);
        }
        if (arr == null || arr.isEmpty()) {
            return info;
        }
        // API returns newest first
        JsonObject newest = arr.get(0).getAsJsonObject();
        String compatId = str(newest, "id");
        String compatNum = str(newest, "version_number");
        String compatUrl = (info.slug() != null && compatId != null)
                ? "https://modrinth.com/mod/" + info.slug() + "/version/" + compatId
                : info.projectUrl();

        String newestHash = primaryFileSha512(newest);
        boolean outdated = false;
        if (installedHash != null && newestHash != null) {
            outdated = !installedHash.equalsIgnoreCase(newestHash);
        } else if (compatId != null && info.versionId() != null) {
            outdated = !compatId.equals(info.versionId());
        }

        List<VersionDependency> deps = parseVersionDependencies(newest);
        if (deps.isEmpty() && compatId != null) {
            try {
                deps = fetchVersionDependencies(transport, compatId, rateLimit);
            } catch (Exception ignored) {
                // keep empty — analyzer will mark unknown
            }
        }

        return info.withCompatibleUpdate(outdated, compatId, compatNum, compatUrl, deps);
    }

    private static JsonArray fetchProjectVersions(
            HttpTransport transport,
            String projectId,
            String loader,
            String mcVersion,
            int rateLimit) throws IOException, InterruptedException {
        throttle(rateLimit);
        String loaders = URLEncoder.encode("[\"%s\"]".formatted(loader), StandardCharsets.UTF_8);
        String url = PROJECT_VERSIONS_URL + projectId + "/version?loaders=" + loaders;
        if (mcVersion != null && !mcVersion.isBlank()) {
            String games = URLEncoder.encode("[\"%s\"]".formatted(mcVersion), StandardCharsets.UTF_8);
            url += "&game_versions=" + games;
        }
        String body = transport.getJson(url);
        if (body == null || body.isBlank()) {
            return new JsonArray();
        }
        JsonElement parsed = JsonParser.parseString(body);
        return parsed.isJsonArray() ? parsed.getAsJsonArray() : new JsonArray();
    }

    /** Prefer versions whose game_versions include {@code mc} (or its major.minor parent). */
    static JsonArray preferMatchingGameVersion(JsonArray versions, String mc) {
        if (versions == null || versions.isEmpty() || mc == null || mc.isBlank()) {
            return versions == null ? new JsonArray() : versions;
        }
        JsonArray exact = new JsonArray();
        JsonArray parent = new JsonArray();
        String parentMc = parentMinecraftVersion(mc);
        for (JsonElement el : versions) {
            if (!el.isJsonObject()) {
                continue;
            }
            JsonObject v = el.getAsJsonObject();
            if (!v.has("game_versions") || !v.get("game_versions").isJsonArray()) {
                continue;
            }
            boolean hitExact = false;
            boolean hitParent = false;
            for (JsonElement gv : v.getAsJsonArray("game_versions")) {
                if (!gv.isJsonPrimitive()) {
                    continue;
                }
                String g = gv.getAsString();
                if (mc.equals(g)) {
                    hitExact = true;
                } else if (parentMc != null && parentMc.equals(g)) {
                    hitParent = true;
                }
            }
            if (hitExact) {
                exact.add(v);
            } else if (hitParent) {
                parent.add(v);
            }
        }
        if (!exact.isEmpty()) {
            return exact;
        }
        if (!parent.isEmpty()) {
            return parent;
        }
        // No MC overlap — do not treat a different-game-version release as an update.
        return new JsonArray();
    }

    static String parentMinecraftVersion(String mc) {
        if (mc == null || mc.isBlank()) {
            return null;
        }
        String[] parts = mc.trim().split("\\.");
        if (parts.length >= 3) {
            return parts[0] + "." + parts[1];
        }
        return null;
    }

    static List<VersionDependency> parseVersionDependencies(JsonObject version) {
        List<VersionDependency> out = new ArrayList<>();
        if (version == null || !version.has("dependencies") || !version.get("dependencies").isJsonArray()) {
            return out;
        }
        for (JsonElement el : version.getAsJsonArray("dependencies")) {
            if (!el.isJsonObject()) {
                continue;
            }
            JsonObject d = el.getAsJsonObject();
            String type = str(d, "dependency_type");
            if (type == null || type.isBlank()) {
                continue;
            }
            String projectId = str(d, "project_id");
            String versionId = str(d, "version_id");
            if ((projectId == null || projectId.isBlank()) && (versionId == null || versionId.isBlank())) {
                continue;
            }
            out.add(new VersionDependency(projectId, versionId, type.toLowerCase(Locale.ROOT)));
        }
        return out;
    }

    private static List<VersionDependency> fetchVersionDependencies(
            HttpTransport transport,
            String versionId,
            int rateLimit) throws IOException, InterruptedException {
        throttle(rateLimit);
        String body = transport.getJson(VERSION_URL + versionId);
        if (body == null || body.isBlank()) {
            return List.of();
        }
        JsonObject version = JsonParser.parseString(body).getAsJsonObject();
        return parseVersionDependencies(version);
    }

    private static String primaryFileSha512(JsonObject version) {
        if (version == null || !version.has("files") || !version.get("files").isJsonArray()) {
            return null;
        }
        for (JsonElement el : version.getAsJsonArray("files")) {
            if (!el.isJsonObject()) {
                continue;
            }
            JsonObject f = el.getAsJsonObject();
            boolean primary = f.has("primary") && f.get("primary").getAsBoolean();
            if (!primary) {
                continue;
            }
            if (f.has("hashes") && f.get("hashes").isJsonObject()) {
                return str(f.getAsJsonObject("hashes"), "sha512");
            }
        }
        // fallback first file
        JsonArray files = version.getAsJsonArray("files");
        if (files.size() > 0 && files.get(0).isJsonObject()) {
            JsonObject f = files.get(0).getAsJsonObject();
            if (f.has("hashes") && f.get("hashes").isJsonObject()) {
                return str(f.getAsJsonObject("hashes"), "sha512");
            }
        }
        return null;
    }

    private static final Map<SideInfo, Instant> FETCHED_AT = new HashMap<>();

    private static SideInfo withFetchedAt(SideInfo info, Instant at) {
        FETCHED_AT.put(info, at);
        return info;
    }

    private static Instant fetchedAtOf(SideInfo info) {
        return FETCHED_AT.getOrDefault(info, Instant.EPOCH);
    }

    private static HttpTransport liveTransport() {
        httpClientCreationsForTests.incrementAndGet();
        HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
        return new HttpTransport() {
            @Override
            public String postJson(String url, String body) throws IOException, InterruptedException {
                return sendWithRetry(client, HttpRequest.newBuilder()
                        .uri(URI.create(url))
                        .timeout(Duration.ofSeconds(30))
                        .header("Accept", "application/json")
                        .header("User-Agent", USER_AGENT)
                        .header("Content-Type", "application/json")
                        .POST(HttpRequest.BodyPublishers.ofString(body))
                        .build());
            }

            @Override
            public String getJson(String url) throws IOException, InterruptedException {
                return sendWithRetry(client, HttpRequest.newBuilder()
                        .uri(URI.create(url))
                        .timeout(Duration.ofSeconds(30))
                        .header("Accept", "application/json")
                        .header("User-Agent", USER_AGENT)
                        .GET()
                        .build());
            }
        };
    }

    private static String sendWithRetry(HttpClient client, HttpRequest request)
            throws IOException, InterruptedException {
        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() == 429) {
            long waitSec = parseRetryAfterSeconds(response);
            Thread.sleep(Math.min(60_000L, Math.max(1000L, waitSec * 1000L)));
            response = client.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() == 429) {
                throw new RateLimitExceeded(parseRetryAfterSeconds(response));
            }
        }
        if (response.statusCode() < 200 || response.statusCode() >= 300) {
            throw new IOException("Modrinth HTTP " + response.statusCode());
        }
        return response.body();
    }

    private static long parseRetryAfterSeconds(HttpResponse<?> response) {
        return response.headers().firstValue("Retry-After")
                .map(v -> {
                    try {
                        return Long.parseLong(v.trim());
                    } catch (NumberFormatException e) {
                        return 5L;
                    }
                })
                .orElse(5L);
    }

    /** Thrown when Modrinth returns 429 after one Retry-After wait. */
    static final class RateLimitExceeded extends IOException {
        RateLimitExceeded(long retryAfterSeconds) {
            super("Modrinth rate limited; retry after " + retryAfterSeconds + "s");
        }
    }

    private static void throttle(int rateLimit) throws InterruptedException {
        int rps = Math.max(1, rateLimit);
        Thread.sleep(Math.max(0, 1000L / rps));
    }

    private static String encodeIds(JsonArray ids) {
        return URLEncoder.encode(ids.toString(), StandardCharsets.UTF_8);
    }

    private static Map<String, SideInfo> loadCache(Path cacheFile) {
        Map<String, SideInfo> map = new LinkedHashMap<>();
        if (cacheFile == null || !Files.isRegularFile(cacheFile)) {
            return map;
        }
        try {
            String raw = Files.readString(cacheFile);
            JsonObject root = JsonParser.parseString(raw).getAsJsonObject();
            if (!root.has("entries") || !root.get("entries").isJsonObject()) {
                return map;
            }
            Instant now = Instant.now();
            JsonObject entries = root.getAsJsonObject("entries");
            for (String hash : entries.keySet()) {
                JsonObject e = entries.getAsJsonObject(hash);
                Instant fetchedAt = Instant.parse(strOr(e, "fetched_at", Instant.EPOCH.toString()));
                boolean miss = e.has("miss") && e.get("miss").getAsBoolean();
                long age = now.getEpochSecond() - fetchedAt.getEpochSecond();
                if (miss && age > MISS_RETRY_SECONDS) {
                    continue;
                }
                if (!miss && age > HIT_TTL_SECONDS) {
                    continue;
                }
                boolean outdated = e.has("outdated") && e.get("outdated").getAsBoolean();
                SideInfo info = new SideInfo(
                        str(e, "project_id"),
                        str(e, "slug"),
                        strOr(e, "client_side", "unknown"),
                        strOr(e, "server_side", "unknown"),
                        str(e, "title"),
                        miss,
                        str(e, "version_id"),
                        str(e, "version_number"),
                        outdated,
                        str(e, "compatible_version_id"),
                        str(e, "compatible_version_number"),
                        str(e, "compatible_url"),
                        str(e, "wiki_url"),
                        str(e, "source_url"),
                        str(e, "issues_url"),
                        str(e, "discord_url"),
                        str(e, "icon_url"),
                        str(e, "description"));
                withFetchedAt(info, fetchedAt);
                map.put(hash, info);
            }
        } catch (Exception ignored) {
            return new LinkedHashMap<>();
        }
        return map;
    }

    /** Persist cache map to disk (used after compatible-update enrichment). */
    public static void persistCache(Path cacheFile, Map<String, SideInfo> cache) {
        saveCache(cacheFile, cache);
    }

    private static void saveCache(Path cacheFile, Map<String, SideInfo> cache) {
        if (cacheFile == null) {
            return;
        }
        try {
            Files.createDirectories(cacheFile.getParent());
            List<Map.Entry<String, SideInfo>> entries = new ArrayList<>(cache.entrySet());
            entries.sort(Comparator.comparing(e -> fetchedAtOf(e.getValue())));
            while (entries.size() > MAX_CACHE_ENTRIES) {
                Map.Entry<String, SideInfo> oldest = entries.remove(0);
                cache.remove(oldest.getKey());
            }
            JsonObject root = new JsonObject();
            root.addProperty("schema", SCHEMA);
            JsonObject entriesObj = new JsonObject();
            for (Map.Entry<String, SideInfo> e : cache.entrySet()) {
                SideInfo info = e.getValue();
                JsonObject row = new JsonObject();
                if (info.projectId() != null) {
                    row.addProperty("project_id", info.projectId());
                }
                if (info.slug() != null) {
                    row.addProperty("slug", info.slug());
                }
                row.addProperty("client_side", info.clientSide() != null ? info.clientSide() : "unknown");
                row.addProperty("server_side", info.serverSide() != null ? info.serverSide() : "unknown");
                if (info.title() != null) {
                    row.addProperty("title", info.title());
                }
                if (info.versionId() != null) {
                    row.addProperty("version_id", info.versionId());
                }
                if (info.versionNumber() != null) {
                    row.addProperty("version_number", info.versionNumber());
                }
                row.addProperty("outdated", info.outdated());
                if (info.compatibleVersionId() != null) {
                    row.addProperty("compatible_version_id", info.compatibleVersionId());
                }
                if (info.compatibleVersionNumber() != null) {
                    row.addProperty("compatible_version_number", info.compatibleVersionNumber());
                }
                if (info.compatibleUrl() != null) {
                    row.addProperty("compatible_url", info.compatibleUrl());
                }
                if (info.wikiUrl() != null) {
                    row.addProperty("wiki_url", info.wikiUrl());
                }
                if (info.sourceUrl() != null) {
                    row.addProperty("source_url", info.sourceUrl());
                }
                if (info.issuesUrl() != null) {
                    row.addProperty("issues_url", info.issuesUrl());
                }
                if (info.discordUrl() != null) {
                    row.addProperty("discord_url", info.discordUrl());
                }
                if (info.iconUrl() != null) {
                    row.addProperty("icon_url", info.iconUrl());
                }
                if (info.description() != null) {
                    row.addProperty("description", info.description());
                }
                row.addProperty("miss", info.miss());
                row.addProperty("fetched_at", fetchedAtOf(info).toString());
                entriesObj.add(e.getKey(), row);
            }
            root.add("entries", entriesObj);
            Files.writeString(cacheFile, root.toString());
        } catch (Exception ignored) {
            // best effort
        }
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
