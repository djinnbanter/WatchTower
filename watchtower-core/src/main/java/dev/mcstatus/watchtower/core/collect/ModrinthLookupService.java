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
    private static final String USER_AGENT = "djinnbanter/WatchTower (mod side lookup)";
    private static final int SCHEMA = 2;
    private static final int MAX_CACHE_ENTRIES = 2000;
    private static final int MAX_JARS_PER_REPORT = 40;
    private static final int MAX_COMPAT_FETCHES = 15;
    private static final long HIT_TTL_SECONDS = 30L * 24 * 3600;
    private static final long MISS_RETRY_SECONDS = 7L * 24 * 3600;

    /** Test seam — when non-null, used instead of live HTTP. */
    static volatile HttpTransport transportForTests;
    static final AtomicInteger httpClientCreationsForTests = new AtomicInteger();

    public record Candidate(String modId, Path jarPath) {
    }

    /**
     * Project side metadata plus optional installed-version and compatible-update fields.
     * Compact 6-arg constructor preserved for existing callers/tests.
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
            String compatibleUrl) {

        public SideInfo(
                String projectId,
                String slug,
                String clientSide,
                String serverSide,
                String title,
                boolean miss) {
            this(projectId, slug, clientSide, serverSide, title, miss,
                    null, null, false, null, null, null);
        }

        public static SideInfo missInfo() {
            return new SideInfo(null, null, "unknown", "unknown", null, true);
        }

        public SideInfo withVersion(String versionId, String versionNumber) {
            return new SideInfo(projectId, slug, clientSide, serverSide, title, miss,
                    versionId, versionNumber, outdated, compatibleVersionId, compatibleVersionNumber, compatibleUrl);
        }

        public SideInfo withCompatibleUpdate(
                boolean outdated,
                String compatibleVersionId,
                String compatibleVersionNumber,
                String compatibleUrl) {
            return new SideInfo(projectId, slug, clientSide, serverSide, title, miss,
                    versionId, versionNumber, outdated, compatibleVersionId, compatibleVersionNumber, compatibleUrl);
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
        if (config == null || !config.modrinthLookup() || config.disasterRecovery()) {
            return Map.of();
        }
        if (candidates == null || candidates.isEmpty()) {
            return Map.of();
        }

        Map<String, SideInfo> cache = loadCache(cacheFile);
        Instant now = Instant.now();
        Map<String, SideInfo> result = new LinkedHashMap<>();
        List<Candidate> needFetch = new ArrayList<>();
        Set<String> seenHashes = new HashSet<>();

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

        if (!needFetch.isEmpty()) {
            try {
                Map<String, SideInfo> fetched = fetchBatch(needFetch, config.modrinthRateLimit());
                result.putAll(fetched);
                cache.putAll(fetched);
                saveCache(cacheFile, cache);
            } catch (Exception ignored) {
                // never break a report
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
        if (byModId == null || byModId.isEmpty()) {
            return;
        }
        String mrLoader = normalizeLoader(loader);
        String mc = minecraftVersion != null ? minecraftVersion.trim() : "";
        if (mc.isBlank() || mrLoader.isBlank()) {
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
                }
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
        if (optional == null || config == null || !config.modrinthLookup()
                || !config.modrinthLookupOnReport() || config.disasterRecovery()) {
            return;
        }
        if (!optional.has("mods") || !optional.get("mods").isJsonArray()) {
            return;
        }
        JsonArray mods = optional.getAsJsonArray("mods");
        Set<String> suspects = new HashSet<>();
        if (optional.has("crash_summaries") && optional.get("crash_summaries").isJsonArray()) {
            for (JsonElement el : optional.getAsJsonArray("crash_summaries")) {
                if (!el.isJsonObject()) {
                    continue;
                }
                JsonObject row = el.getAsJsonObject();
                for (String key : List.of("primary_mod_id", "stall_mod_id", "suspect_mod_id", "linked_mod_id")) {
                    String v = str(row, key);
                    if (v != null && !v.isBlank()) {
                        suspects.add(v.toLowerCase(Locale.ROOT));
                    }
                }
            }
        }
        // Always refresh create/flywheel pair when present
        for (String id : List.of("create", "flywheel")) {
            if (modIdPresent(mods, id)) {
                suspects.add(id);
            }
        }
        if (suspects.isEmpty()) {
            return;
        }

        List<Candidate> need = new ArrayList<>();
        for (String id : suspects) {
            // Skip if already has CTA and not outdated-unknown
            JsonObject mod = findMod(mods, id);
            if (mod != null && mod.has("modrinth_url") && mod.has("modrinth_compatible_url")) {
                continue;
            }
            Path jar = jarForMod(mods, id, serverDir);
            if (jar != null) {
                need.add(new Candidate(id, jar));
            }
        }
        if (need.isEmpty()) {
            // Still rebuild summary from existing fields
            JsonArray updates = buildUpdatesSummary(mods);
            if (updates.size() > 0) {
                optional.add("modrinth_updates", updates);
            }
            return;
        }

        Path cacheFile = serverDir != null && !serverDir.isBlank()
                ? Path.of(serverDir, "watchtower", "modrinth-cache.json")
                : null;
        try {
            Map<String, SideInfo> byHash = lookup(need, cacheFile, config);
            Map<String, SideInfo> byId = new HashMap<>();
            Map<String, String> hashById = new HashMap<>();
            for (Candidate c : need) {
                try {
                    String hash = sha512Hex(c.jarPath());
                    hashById.put(c.modId(), hash);
                    SideInfo info = byHash.get(hash);
                    if (info != null && !info.miss()) {
                        byId.put(c.modId(), info);
                    }
                } catch (Exception ignored) {
                }
            }
            // Merge any existing identity already on mods into byId for pair update check
            for (String id : suspects) {
                if (byId.containsKey(id)) {
                    continue;
                }
                JsonObject mod = findMod(mods, id);
                if (mod == null || !mod.has("modrinth_project_id")) {
                    continue;
                }
                SideInfo info = new SideInfo(
                        str(mod, "modrinth_project_id"),
                        str(mod, "modrinth_slug"),
                        "unknown",
                        "unknown",
                        str(mod, "modrinth_title"),
                        false,
                        str(mod, "modrinth_version_id"),
                        str(mod, "modrinth_version_number"),
                        mod.has("modrinth_outdated") && mod.get("modrinth_outdated").getAsBoolean(),
                        str(mod, "modrinth_compatible_version_id"),
                        str(mod, "modrinth_compatible_version_number"),
                        str(mod, "modrinth_compatible_url"));
                byId.put(id, info);
                Path jar = jarForMod(mods, id, serverDir);
                if (jar != null) {
                    try {
                        hashById.put(id, sha512Hex(jar));
                    } catch (Exception ignored) {
                    }
                }
            }

            String mcVersion = minecraftVersionFromMods(mods);
            enrichCompatibleUpdates(
                    byId, hashById, suspects, config.loader(), mcVersion, config.modrinthRateLimit());
            applyIdentityToMods(mods, byId);
            JsonArray updates = buildUpdatesSummary(mods);
            if (updates.size() > 0) {
                optional.add("modrinth_updates", updates);
            } else {
                optional.remove("modrinth_updates");
            }
            if (cacheFile != null) {
                for (Map.Entry<String, SideInfo> e : byId.entrySet()) {
                    String hash = hashById.get(e.getKey());
                    if (hash != null) {
                        byHash.put(hash, e.getValue());
                    }
                }
                persistCache(cacheFile, byHash);
            }
        } catch (Exception ignored) {
            // never break a report
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

    private static Map<String, SideInfo> fetchBatch(List<Candidate> needFetch, int rateLimit)
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

        throttle(rateLimit);
        JsonObject body = new JsonObject();
        JsonArray hashArr = new JsonArray();
        hashes.forEach(hashArr::add);
        body.add("hashes", hashArr);
        body.addProperty("algorithm", "sha512");
        String versionBody = transport.postJson(VERSION_FILES_URL, body.toString());

        Map<String, String> projectByHash = new HashMap<>();
        Map<String, String> versionIdByHash = new HashMap<>();
        Map<String, String> versionNumberByHash = new HashMap<>();
        Set<String> projectIds = new HashSet<>();
        if (versionBody != null && !versionBody.isBlank()) {
            JsonObject versions = JsonParser.parseString(versionBody).getAsJsonObject();
            for (String hash : hashes) {
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
            throttle(rateLimit);
            JsonArray ids = new JsonArray();
            projectIds.forEach(ids::add);
            String url = PROJECTS_URL + encodeIds(ids);
            String projectsBody = transport.getJson(url);
            if (projectsBody != null && !projectsBody.isBlank()) {
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
                    null);
            out.put(hash, withFetchedAt(info, fetchedAt));
        }
        return out;
    }

    private static SideInfo fetchCompatible(
            SideInfo info,
            String installedHash,
            String loader,
            String mcVersion,
            int rateLimit) throws IOException, InterruptedException {
        HttpTransport transport = transportForTests != null ? transportForTests : liveTransport();
        throttle(rateLimit);
        String loaders = URLEncoder.encode("[\"%s\"]".formatted(loader), StandardCharsets.UTF_8);
        String games = URLEncoder.encode("[\"%s\"]".formatted(mcVersion), StandardCharsets.UTF_8);
        String url = PROJECT_VERSIONS_URL + info.projectId()
                + "/version?loaders=" + loaders + "&game_versions=" + games;
        String body = transport.getJson(url);
        if (body == null || body.isBlank()) {
            return info;
        }
        JsonArray arr = JsonParser.parseString(body).getAsJsonArray();
        if (arr.isEmpty()) {
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

        return info.withCompatibleUpdate(outdated, compatId, compatNum, compatUrl);
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
                HttpRequest request = HttpRequest.newBuilder()
                        .uri(URI.create(url))
                        .timeout(Duration.ofSeconds(15))
                        .header("Accept", "application/json")
                        .header("User-Agent", USER_AGENT)
                        .header("Content-Type", "application/json")
                        .POST(HttpRequest.BodyPublishers.ofString(body))
                        .build();
                HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
                if (response.statusCode() < 200 || response.statusCode() >= 300) {
                    throw new IOException("Modrinth HTTP " + response.statusCode());
                }
                return response.body();
            }

            @Override
            public String getJson(String url) throws IOException, InterruptedException {
                HttpRequest request = HttpRequest.newBuilder()
                        .uri(URI.create(url))
                        .timeout(Duration.ofSeconds(15))
                        .header("Accept", "application/json")
                        .header("User-Agent", USER_AGENT)
                        .GET()
                        .build();
                HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
                if (response.statusCode() < 200 || response.statusCode() >= 300) {
                    throw new IOException("Modrinth HTTP " + response.statusCode());
                }
                return response.body();
            }
        };
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
                        str(e, "compatible_url"));
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
