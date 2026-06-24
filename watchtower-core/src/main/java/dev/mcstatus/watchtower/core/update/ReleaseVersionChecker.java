package dev.mcstatus.watchtower.core.update;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Checks GitHub Releases for a newer Watchtower NeoForge 1.21.x artifact.
 */
public final class ReleaseVersionChecker {

    private static final Pattern TAG_VERSION = Pattern.compile("v?(\\d+(?:\\.\\d+)*[a-z]?)");
    private static final Pattern NEOFORGE_JAR = Pattern.compile(
            "watchtower-neoforge-(\\d+(?:\\.\\d+)*[a-z]?)\\+mc1\\.21\\.jar",
            Pattern.CASE_INSENSITIVE);
    private static final String GITHUB_RELEASES =
            "https://api.github.com/repos/djinnbanter/WatchTower/releases?per_page=10";
    private static final String MODRINTH_PROJECT = "https://modrinth.com/mod/watchtower";

    private static volatile JsonObject cached;
    private static volatile Instant cachedAt;
    private static final Duration CACHE_TTL = Duration.ofHours(24);

    private ReleaseVersionChecker() {
    }

    public static JsonObject check(String currentVersion, boolean enabled) {
        JsonObject out = new JsonObject();
        out.addProperty("enabled", enabled);
        out.addProperty("current", currentVersion != null ? currentVersion : "unknown");
        out.addProperty("modrinth_url", MODRINTH_PROJECT);
        if (!enabled) {
            out.addProperty("update_available", false);
            return out;
        }
        if (cached != null && cachedAt != null && Instant.now().isBefore(cachedAt.plus(CACHE_TTL))) {
            return cached.deepCopy();
        }
        try {
            JsonObject latest = fetchLatestRelease();
            if (latest == null) {
                out.addProperty("update_available", false);
                out.addProperty("error", "no_release");
                return out;
            }
            String latestVersion = latest.get("version").getAsString();
            boolean newer = compareWatchtowerVersions(latestVersion, currentVersion) > 0;
            out.addProperty("update_available", newer);
            out.addProperty("latest_version", latestVersion);
            out.addProperty("published_at", latest.get("published_at").getAsString());
            out.add("urls", latest.getAsJsonObject("urls"));
            cached = out.deepCopy();
            cachedAt = Instant.now();
            return out;
        } catch (Exception e) {
            out.addProperty("update_available", false);
            out.addProperty("error", e.getMessage() != null ? e.getMessage() : "check_failed");
            return out;
        }
    }

    static int compareWatchtowerVersions(String a, String b) {
        if (a == null || b == null) {
            return 0;
        }
        String na = normalizeVersion(a);
        String nb = normalizeVersion(b);
        int base = compareNumericVersions(stripSuffix(na), stripSuffix(nb));
        if (base != 0) {
            return base;
        }
        String sa = suffix(na);
        String sb = suffix(nb);
        if (sa.isEmpty() && sb.isEmpty()) {
            return 0;
        }
        if (sa.isEmpty()) {
            return -1;
        }
        if (sb.isEmpty()) {
            return 1;
        }
        return sa.compareTo(sb);
    }

    private static int compareNumericVersions(String a, String b) {
        String[] pa = a.split("[^0-9]+");
        String[] pb = b.split("[^0-9]+");
        int len = Math.max(pa.length, pb.length);
        for (int i = 0; i < len; i++) {
            int va = i < pa.length && !pa[i].isEmpty() ? Integer.parseInt(pa[i]) : 0;
            int vb = i < pb.length && !pb[i].isEmpty() ? Integer.parseInt(pb[i]) : 0;
            if (va != vb) {
                return Integer.compare(va, vb);
            }
        }
        return 0;
    }

    private static String normalizeVersion(String v) {
        Matcher m = TAG_VERSION.matcher(v);
        return m.find() ? m.group(1) : v;
    }

    private static String stripSuffix(String v) {
        int i = 0;
        while (i < v.length() && (Character.isDigit(v.charAt(i)) || v.charAt(i) == '.')) {
            i++;
        }
        return v.substring(0, i);
    }

    private static String suffix(String v) {
        int i = 0;
        while (i < v.length() && (Character.isDigit(v.charAt(i)) || v.charAt(i) == '.')) {
            i++;
        }
        return v.substring(i).toLowerCase(Locale.ROOT);
    }

    private static JsonObject fetchLatestRelease() throws IOException, InterruptedException {
        HttpClient client = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(10)).build();
        HttpRequest request = HttpRequest.newBuilder()
                .uri(URI.create(GITHUB_RELEASES))
                .timeout(Duration.ofSeconds(15))
                .header("Accept", "application/vnd.github+json")
                .header("User-Agent", "Watchtower-UpdateChecker")
                .GET()
                .build();
        HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
        if (response.statusCode() != 200) {
            throw new IOException("GitHub API HTTP " + response.statusCode());
        }
        JsonArray releases = JsonParser.parseString(response.body()).getAsJsonArray();
        for (JsonElement el : releases) {
            JsonObject release = el.getAsJsonObject();
            if (release.has("draft") && release.get("draft").getAsBoolean()) {
                continue;
            }
            JsonObject parsed = parseRelease(release);
            if (parsed != null) {
                return parsed;
            }
        }
        return null;
    }

    private static JsonObject parseRelease(JsonObject release) {
        JsonArray assets = release.getAsJsonArray("assets");
        if (assets == null) {
            return null;
        }
        for (JsonElement el : assets) {
            JsonObject asset = el.getAsJsonObject();
            String name = asset.get("name").getAsString();
            Matcher m = NEOFORGE_JAR.matcher(name);
            if (!m.find()) {
                continue;
            }
            JsonObject out = new JsonObject();
            out.addProperty("version", m.group(1));
            out.addProperty("published_at", release.get("published_at").getAsString());
            JsonObject urls = new JsonObject();
            urls.addProperty("github", asset.get("browser_download_url").getAsString());
            urls.addProperty("release_page", release.get("html_url").getAsString());
            urls.addProperty("modrinth", MODRINTH_PROJECT);
            out.add("urls", urls);
            return out;
        }
        return null;
    }

    /** Test hook — inject cached response without network. */
    public static void resetCacheForTests() {
        cached = null;
        cachedAt = null;
    }

    public static void seedCacheForTests(JsonObject value) {
        cached = value.deepCopy();
        cachedAt = Instant.now();
    }
}
