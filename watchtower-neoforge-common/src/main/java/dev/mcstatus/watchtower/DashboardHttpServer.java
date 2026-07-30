package dev.mcstatus.watchtower;

import dev.mcstatus.watchtower.runtime.ModRuntime;

import dev.mcstatus.watchtower.runtime.ServerContext;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.sun.net.httpserver.Headers;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import dev.mcstatus.watchtower.core.WatchtowerFiles;
import dev.mcstatus.watchtower.core.auth.SessionManager;
import dev.mcstatus.watchtower.core.report.StateManager;
import dev.mcstatus.watchtower.core.rules.CrashRuleModels;
import dev.mcstatus.watchtower.core.rules.CrashRuleRegistry;
import dev.mcstatus.watchtower.core.rules.CrashRuleSchema;
import dev.mcstatus.watchtower.core.rules.CrashRuleValidator;
import dev.mcstatus.watchtower.core.rules.IssueSuppressionStore;
import dev.mcstatus.watchtower.core.analyze.BackupStatusResolver;
import dev.mcstatus.watchtower.core.analyze.CrashFingerprintGrouper;
import dev.mcstatus.watchtower.core.analyze.PreCrashContextBuilder;
import dev.mcstatus.watchtower.core.analyze.PerformanceDashboardBuilder;
import dev.mcstatus.watchtower.core.analyze.PerformanceBaselineTracker;
import dev.mcstatus.watchtower.core.analyze.PerformanceContext;
import dev.mcstatus.watchtower.core.analyze.PerformanceInsightEngine;
import dev.mcstatus.watchtower.core.analyze.RssHeapEvaluator;
import dev.mcstatus.watchtower.core.analyze.ConfigLaunchAdvisor;
import dev.mcstatus.watchtower.core.analyze.RestartHygieneAdvisor;
import dev.mcstatus.watchtower.core.analyze.SafeRestartAdvisor;
import dev.mcstatus.watchtower.core.collect.ServerPropertiesReader;
import dev.mcstatus.watchtower.core.analyze.ScorecardBuilder;
import dev.mcstatus.watchtower.core.live.PerformanceRollupWriter;
import dev.mcstatus.watchtower.core.collect.CrashMtimeScanner;
import dev.mcstatus.watchtower.core.collect.CraftyCollector;
import dev.mcstatus.watchtower.core.collect.ExternalBackupDetector;
import dev.mcstatus.watchtower.core.collect.GzipLineReader;
import dev.mcstatus.watchtower.core.collect.ModDependencyGraph;
import dev.mcstatus.watchtower.core.collect.ModForensicsCollector;
import dev.mcstatus.watchtower.core.collect.ForensicsFindService;
import dev.mcstatus.watchtower.core.collect.CorruptedJarScanner;
import dev.mcstatus.watchtower.core.collect.ConfigHealthScanner;
import dev.mcstatus.watchtower.core.collect.JarClassIndex;
import dev.mcstatus.watchtower.core.collect.ModJarMetadataReader;
import dev.mcstatus.watchtower.core.incident.IncidentReader;
import dev.mcstatus.watchtower.core.ops.ActivityLedgerScanner;
import dev.mcstatus.watchtower.core.ops.IssuesLiveEvaluators;
import dev.mcstatus.watchtower.core.ops.IssuesLiveRecord;
import dev.mcstatus.watchtower.core.ops.IssuesLiveSchema;
import dev.mcstatus.watchtower.core.ops.IssuesLiveStore;
import dev.mcstatus.watchtower.core.ops.OpsCacheReader;
import dev.mcstatus.watchtower.core.ops.OpsCacheSchema;
import dev.mcstatus.watchtower.core.ops.OpsModsTreeSource;
import dev.mcstatus.watchtower.core.ops.OpsCacheWriter;
import dev.mcstatus.watchtower.core.fs.FsBrowseService;
import dev.mcstatus.watchtower.core.panel.PanelInfo;
import dev.mcstatus.watchtower.core.panel.PanelLabels;
import dev.mcstatus.watchtower.core.panel.PanelResolver;
import dev.mcstatus.watchtower.core.collect.HostMetricsCollector;
import dev.mcstatus.watchtower.core.collect.ReportArtifactFinder;
import dev.mcstatus.watchtower.core.collect.ModrinthScanJob;
import dev.mcstatus.watchtower.core.collect.SparkBytebinImport;
import dev.mcstatus.watchtower.core.collect.SparkCallTrees;
import dev.mcstatus.watchtower.core.collect.SparkCollector;
import dev.mcstatus.watchtower.core.collect.SparkHeapCollector;
import dev.mcstatus.watchtower.core.collect.SparkPaths;
import dev.mcstatus.watchtower.core.collect.SparkProfileBuilder;
import dev.mcstatus.watchtower.core.collect.SparkProfileEntry;
import dev.mcstatus.watchtower.core.collect.SparkProfileFacts;
import dev.mcstatus.watchtower.core.collect.SparkProfileScan;
import dev.mcstatus.watchtower.core.collect.SparkProfileUpload;
import dev.mcstatus.watchtower.core.collect.SparkSkippedProfile;
import dev.mcstatus.watchtower.core.report.OverviewMetaBuilder;
import dev.mcstatus.watchtower.core.report.ReportConfig;
import dev.mcstatus.watchtower.core.report.ReportSchedule;
import dev.mcstatus.watchtower.core.report.SupportBundleCatalog;
import dev.mcstatus.watchtower.core.report.SupportComposeOptions;
import dev.mcstatus.watchtower.core.report.SupportSafePaths;
import dev.mcstatus.watchtower.core.update.ReleaseVersionChecker;
import dev.mcstatus.watchtower.core.util.TimeParse;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.Executors;
import java.util.stream.Stream;

/**
 * Embedded dashboard HTTP server (JDK HttpServer).
 */
public final class DashboardHttpServer {
    private static final Gson GSON = new GsonBuilder().create();
    private static final String WEB_PREFIX = "assets/watchtower/web/";
    private static final String FAVICON_RESOURCE = WEB_PREFIX + "assets/watchtower-icon-simple.png";
    private static final int FORENSICS_FIND_RATE_LIMIT = 10;
    private static final long FORENSICS_FIND_WINDOW_MS = 60_000L;
    /** Endpoints that write their own detailed audit row; skip the generic api_write entry. */
    private static final Set<String> SELF_AUDITED = Set.of(
            "/api/settings",
            "/api/issues/ack",
            "/api/issues/acknowledge-all",
            "/api/issues/suppress",
            "/api/issues/unsuppress",
            "/api/crashes/ack",
            "/api/crashes/acknowledge-all",
            "/api/accounts",
            "/api/accounts/update",
            "/api/accounts/delete",
            "/api/accounts/reset-password");

    private HttpServer server;
    private ServerContext serverContext;
    /** IP to request timestamps in the last minute for find-class/package rate limit. */
    private final ConcurrentHashMap<String, List<Long>> forensicsFindRate = new ConcurrentHashMap<>();
    /** Parsed Spark profiles, invalidated by normalized path + mtime + size. */
    private final ConcurrentHashMap<String, CachedSparkProfile> sparkProfileCache = new ConcurrentHashMap<>();

    private record CachedSparkProfile(String key, JsonObject profile, JsonObject fullCallTree) {
    }

    public void start(ServerContext mcServer) {
        if (!ModRuntime.config().dashboardEnabled()) {
            return;
        }
        stop();
        this.serverContext = mcServer;
        try {
            String host = ModRuntime.config().dashboardBindHost();
            int port = ModRuntime.config().dashboardPort();
            server = HttpServer.create(new InetSocketAddress(host, port), 0);
            server.createContext("/", this::handleRoot);
            server.createContext("/api/live", this::handleLive);
            server.createContext("/api/players", this::handlePlayers);
            server.createContext("/api/samples", this::handleSamples);
            server.createContext("/api/config", this::handleConfig);
            server.createContext("/api/settings", this::handleSettings);
            server.createContext("/api/data-sources", this::handleDataSources);
            server.createContext("/api/update/check", this::handleUpdateCheck);
            server.createContext("/api/overview/meta", this::handleOverviewMeta);
            server.createContext("/api/performance/rollups", this::handlePerformanceRollups);
            server.createContext("/api/performance/insights", this::handlePerformanceInsights);
            server.createContext("/api/performance/dashboard", this::handlePerformanceDashboard);
            server.createContext("/api/performance/baseline", this::handlePerformanceBaseline);
            server.createContext("/api/performance/export", this::handlePerformanceExport);
            server.createContext("/api/server/icon", this::handleServerIcon);
            server.createContext("/api/support/bundle", this::handleSupportBundle);
            server.createContext("/api/support/catalog", this::handleSupportCatalog);
            server.createContext("/api/support/compose", this::handleSupportCompose);
            server.createContext("/api/reports/latest", this::handleReportsLatest);
            server.createContext("/api/reports/index", this::handleReportsIndex);
            server.createContext("/api/reports/get", this::handleReportsGet);
            server.createContext("/api/reports/status", this::handleReportsStatus);
            server.createContext("/api/activity", this::handleActivity);
            server.createContext("/api/activity/scan", this::handleActivityScan);
            server.createContext("/api/onboarding/audit", this::handleOnboardingAudit);
            server.createContext("/api/onboarding/discovery/start", this::handleDiscoveryStart);
            server.createContext("/api/onboarding/discovery/status", this::handleDiscoveryStatus);
            server.createContext("/api/config-audit", this::handleConfigAudit);
            server.createContext("/api/weekly-digest", this::handleWeeklyDigest);
            server.createContext("/api/incidents", this::handleIncidents);
            server.createContext("/api/incidents/get", this::handleIncidentGet);
            server.createContext("/api/incidents/pin", this::handleIncidentPin);
            server.createContext("/api/issues/peek", this::handleIssuesPeek);
            server.createContext("/api/issues/acks", this::handleIssueAcks);
            server.createContext("/api/issues/ack", this::handleIssueAck);
            server.createContext("/api/issues/acknowledge-all", this::handleIssueAckAll);
            server.createContext("/api/issues/suppressions", this::handleIssueSuppressions);
            server.createContext("/api/issues/suppress", this::handleIssueSuppress);
            server.createContext("/api/issues/unsuppress", this::handleIssueUnsuppress);
            server.createContext("/api/rules", this::handleRulesList);
            server.createContext("/api/rules/get", this::handleRulesGet);
            server.createContext("/api/rules/validate", this::handleRulesValidate);
            server.createContext("/api/reports/run", this::handleReportsRun);
            server.createContext("/api/modrinth/status", this::handleModrinthStatus);
            server.createContext("/api/modrinth/scan", this::handleModrinthScan);
            server.createContext("/api/crashes/acks", this::handleCrashAcks);
            server.createContext("/api/crashes/ack", this::handleCrashAck);
            server.createContext("/api/crashes/acknowledge-all", this::handleCrashAckAll);
            server.createContext("/api/crashes/context", this::handleCrashContext);
            server.createContext("/api/crashes/report", this::handleCrashReport);
            server.createContext("/api/crashes/scan", this::handleCrashScan);
            server.createContext("/api/crashes", this::handleCrashesGrouped);
            server.createContext("/api/inbox/dismiss", this::handleInboxDismiss);
            server.createContext("/api/inbox", this::handleInboxGet);
            server.createContext("/api/logs/list", this::handleLogsList);
            // Alias for older dashboard builds that called /api/logs/index
            server.createContext("/api/logs/index", this::handleLogsList);
            server.createContext("/api/logs/content", this::handleLogsContent);
            server.createContext("/api/mods/scan", this::handleModsScan);
            server.createContext("/api/mods/tree", this::handleModsTree);
            server.createContext("/api/mods/forensics/status", this::handleModsForensicsStatus);
            server.createContext("/api/mods/forensics/find-class", this::handleModsForensicsFindClass);
            server.createContext("/api/mods/forensics/find-package", this::handleModsForensicsFindPackage);
            server.createContext("/api/mods/forensics/scan-corrupt", this::handleModsForensicsScanCorrupt);
            server.createContext("/api/mods/forensics/config-health", this::handleModsForensicsConfigHealth);
            server.createContext("/api/ops-cache", this::handleOpsCache);
            server.createContext("/api/client-mods/ignores", this::handleClientModIgnores);
            server.createContext("/api/client-mods/ignore", this::handleClientModIgnore);
            server.createContext("/api/backups/scan", this::handleBackupScan);
            server.createContext("/api/backups/dirs", this::handleBackupDirs);
            server.createContext("/api/backups/heartbeat", this::handleBackupHeartbeat);
            server.createContext("/api/backups/external", this::handleBackupExternal);
            server.createContext("/api/backups/external/test", this::handleBackupExternalTest);
            server.createContext("/api/spark/profiles", this::handleSparkProfiles);
            server.createContext("/api/spark/profile", this::handleSparkProfile);
            server.createContext("/api/spark/import", this::handleSparkImport);
            server.createContext("/api/spark/upload", this::handleSparkUpload);
            server.createContext("/api/spark/tree", this::handleSparkTree);
            server.createContext("/api/spark/compare", this::handleSparkCompare);
            server.createContext("/api/fs/roots", this::handleFsRoots);
            server.createContext("/api/fs/list", this::handleFsList);
            server.createContext("/api/auth/session", this::handleAuthSession);
            server.createContext("/api/auth/login", this::handleAuthLogin);
            server.createContext("/api/auth/totp", this::handleAuthTotp);
            server.createContext("/api/auth/logout", this::handleAuthLogout);
            server.createContext("/api/auth/change-password", this::handleAuthChangePassword);
            server.createContext("/api/auth/change-username", this::handleAuthChangeUsername);
            server.createContext("/api/auth/totp/setup", this::handleAuthTotpSetup);
            server.createContext("/api/auth/totp/confirm", this::handleAuthTotpConfirm);
            server.createContext("/api/auth/totp/disable", this::handleAuthTotpDisable);
            server.createContext("/api/auth/recovery/regenerate", this::handleAuthRecoveryRegenerate);
            server.setExecutor(Executors.newCachedThreadPool(r -> {
                Thread t = new Thread(r, "watchtower-http");
                t.setDaemon(true);
                return t;
            }));
            server.start();
            ModRuntime.logger().info("Watchtower dashboard: http://{}:{}", host, port);
        } catch (IOException e) {
            ModRuntime.logger().error("Failed to start dashboard HTTP server", e);
        }
    }

    public void stop() {
        if (server != null) {
            server.stop(0);
            server = null;
        }
        sparkProfileCache.clear();
        serverContext = null;
    }

    private void handleRoot(HttpExchange ex) throws IOException {
        if (!"GET".equalsIgnoreCase(ex.getRequestMethod())) {
            send(ex, 405, "text/plain", "Method not allowed");
            return;
        }
        String path = ex.getRequestURI().getPath();
        if ("/favicon.ico".equals(path) || "/favicon.png".equals(path)) {
            serveResource(ex, FAVICON_RESOURCE, "image/png");
            return;
        }
        if ("/".equals(path) || path.isEmpty() || path.endsWith(".html")) {
            serveDashboardIndex(ex);
            return;
        }
        String name = path.startsWith("/") ? path.substring(1) : path;
        if (name.isEmpty() || name.contains("..")) {
            send(ex, 404, "text/plain", "Not found");
            return;
        }
        serveResource(ex, WEB_PREFIX + name, contentTypeForWebAsset(name));
    }

    private void serveDashboardIndex(HttpExchange ex) throws IOException {
        try (InputStream in = DashboardHttpServer.class.getClassLoader().getResourceAsStream(WEB_PREFIX + "index.html")) {
            if (in == null) {
                send(ex, 404, "text/plain", "Not found: " + WEB_PREFIX + "index.html");
                return;
            }
            String html = new String(in.readAllBytes(), StandardCharsets.UTF_8);
            html = injectEmbeddedFlag(html);
            byte[] bytes = html.getBytes(StandardCharsets.UTF_8);
            Headers h = ex.getResponseHeaders();
            DashboardAuthHttp.applySecurityHeaders(h);
            h.set("Content-Type", "text/html; charset=utf-8");
            // Always revalidate shell so jar updates aren't stuck behind a cached index.html.
            h.set("Cache-Control", "no-store");
            ex.sendResponseHeaders(200, bytes.length);
            try (OutputStream os = ex.getResponseBody()) {
                os.write(bytes);
            }
        }
    }

    /**
     * Source {@code index.html} is shared with static preview (no embedded flag).
     * Inject {@code data-embedded="true"} so the browser uses LiveSource, not fixtures.
     * Must tolerate extra attrs on {@code <html>} (e.g. {@code data-skin="aero"}).
     */
    static String injectEmbeddedFlag(String html) {
        if (html == null || html.contains("data-embedded=\"true\"")) {
            return html;
        }
        return html.replaceFirst(
                "(?i)(<html\\b)([^>]*)(>)",
                "$1$2 data-embedded=\"true\"$3"
        );
    }

    private static String contentTypeForWebAsset(String name) {
        if (name.endsWith(".css")) {
            return "text/css; charset=utf-8";
        }
    if (name.endsWith(".js") || name.endsWith(".mjs")) {
            return "application/javascript; charset=utf-8";
        }
        if (name.endsWith(".map")) {
            return "application/json; charset=utf-8";
        }
        if (name.endsWith(".woff")) {
            return "font/woff";
        }
        if (name.endsWith(".ttf")) {
            return "font/ttf";
        }
        if (name.endsWith(".png")) {
            return "image/png";
        }
        if (name.endsWith(".svg")) {
            return "image/svg+xml";
        }
        if (name.endsWith(".ico")) {
            return "image/x-icon";
        }
        if (name.endsWith(".json")) {
            return "application/json; charset=utf-8";
        }
        if (name.endsWith(".woff2")) {
            return "font/woff2";
        }
        return "application/octet-stream";
    }

    private void handleAuthSession(HttpExchange ex) throws IOException {
        DashboardAuthHttp.handleSession(ex, resolveHostname());
    }

    private void handleAuthLogin(HttpExchange ex) throws IOException {
        DashboardAuthHttp.handleLogin(ex);
    }

    private void handleAuthTotp(HttpExchange ex) throws IOException {
        DashboardAuthHttp.handleTotp(ex);
    }

    private void handleAuthLogout(HttpExchange ex) throws IOException {
        DashboardAuthHttp.handleLogout(ex);
    }

    private void handleAuthChangePassword(HttpExchange ex) throws IOException {
        DashboardAuthHttp.handleChangePassword(ex);
    }

    private void handleAuthChangeUsername(HttpExchange ex) throws IOException {
        DashboardAuthHttp.handleChangeUsername(ex);
    }

    private void handleAuthTotpSetup(HttpExchange ex) throws IOException {
        DashboardAuthHttp.handleTotpSetup(ex, "Watchtower " + resolveHostname());
    }

    private void handleAuthTotpConfirm(HttpExchange ex) throws IOException {
        DashboardAuthHttp.handleTotpConfirm(ex);
    }

    private void handleAuthTotpDisable(HttpExchange ex) throws IOException {
        DashboardAuthHttp.handleTotpDisable(ex);
    }

    private void handleAuthRecoveryRegenerate(HttpExchange ex) throws IOException {
        DashboardAuthHttp.handleRecoveryRegenerate(ex);
    }

    private boolean requireApiAuth(HttpExchange ex) throws IOException {
        SessionManager.SessionState session = DashboardAuthHttp.requireFullSession(ex);
        if (session == null) {
            return false;
        }
        String method = ex.getRequestMethod();
        boolean write = !"GET".equalsIgnoreCase(method) && !"HEAD".equalsIgnoreCase(method);
        if (write) {
            String ip = DashboardAuthHttp.clientIp(ex);
            if (!session.role().canWrite()) {
                DashboardAudit.recordDenied(session, DashboardAuthHttp.requestTarget(ex), ip);
                DashboardAuthHttp.sendReadOnly(ex);
                return false;
            }
            if (!SELF_AUDITED.contains(ex.getRequestURI().getPath())) {
                DashboardAudit.record("api_write", session, DashboardAuthHttp.requestTarget(ex), null, ip);
            }
        }
        OpsPollScheduler.get().refreshSchedule();
        return true;
    }

    private void handleLive(HttpExchange ex) throws IOException {
        if (!"GET".equalsIgnoreCase(ex.getRequestMethod())) {
            send(ex, 405, "text/plain", "Method not allowed");
            return;
        }
        if (!requireApiAuth(ex)) {
            return;
        }
        JsonObject body = LiveMetricsService.get().getLiveResponse();
        body.addProperty("hostname", resolveHostname());
        sendJson(ex, 200, body);
    }

    private void handlePlayers(HttpExchange ex) throws IOException {
        if (!"GET".equalsIgnoreCase(ex.getRequestMethod())) {
            send(ex, 405, "text/plain", "Method not allowed");
            return;
        }
        if (!requireApiAuth(ex)) {
            return;
        }
        if (serverContext == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        JsonObject roster = PlayerRosterService.get().getRoster(serverContext);
        JsonObject out = new JsonObject();
        out.add("player_directory", roster);
        sendJson(ex, 200, out);
    }

    private void handleSamples(HttpExchange ex) throws IOException {
        if (!"GET".equalsIgnoreCase(ex.getRequestMethod())) {
            send(ex, 405, "text/plain", "Method not allowed");
            return;
        }
        if (!requireApiAuth(ex)) {
            return;
        }
        int maxMinutes = ModRuntime.config().liveRetentionHours() * 60;
        Integer minutes = null;
        Integer hours = null;
        Integer maxPoints = null;
        String q = ex.getRequestURI().getQuery();
        if (q != null) {
            for (String part : q.split("&")) {
                if (part.startsWith("minutes=")) {
                    try {
                        minutes = Integer.parseInt(part.substring(8));
                    } catch (NumberFormatException ignored) {
                    }
                } else if (part.startsWith("hours=")) {
                    try {
                        hours = Integer.parseInt(part.substring(6));
                    } catch (NumberFormatException ignored) {
                    }
                } else if (part.startsWith("max_points=")) {
                    try {
                        maxPoints = Integer.parseInt(part.substring(11));
                    } catch (NumberFormatException ignored) {
                    }
                }
            }
        }
        int resolvedMaxPoints = maxPoints != null ? maxPoints : 2000;
        if (minutes != null) {
            minutes = Math.max(1, Math.min(maxMinutes, minutes));
            sendJson(ex, 200, LiveMetricsService.get().store().getSamplesForMinutes(minutes, resolvedMaxPoints));
            return;
        }
        int resolvedHours = hours != null ? hours : 24;
        resolvedHours = Math.max(1, Math.min(2160, resolvedHours));
        sendJson(ex, 200, LiveMetricsService.get().store().getSamples(resolvedHours, resolvedMaxPoints));
    }

    private void handleConfig(HttpExchange ex) throws IOException {
        if (!"GET".equalsIgnoreCase(ex.getRequestMethod())) {
            send(ex, 405, "text/plain", "Method not allowed");
            return;
        }
        JsonObject cfg = new JsonObject();
        cfg.addProperty("live_sample_interval_sec", ModRuntime.config().liveSampleIntervalSeconds());
        cfg.addProperty("live_retention_hours", ModRuntime.config().liveRetentionHours());
        cfg.addProperty("embedded", true);
        cfg.addProperty("hostname", resolveHostname());
        String bindHost = ModRuntime.config().dashboardBindHost();
        cfg.addProperty("dashboard_bind_host", bindHost);
        cfg.addProperty("bind_exposed", "0.0.0.0".equals(bindHost));
        cfg.addProperty("auth_required", true);
        String version = serverContext.modVersion();
        cfg.addProperty("mod_version", version);
        cfg.addProperty("report_timeout_minutes", ModRuntime.config().reportTimeoutMinutes());
        if (serverContext != null) {
            Path iconPath = serverContext.serverDirectory().resolve("server-icon.png");
            if (Files.isRegularFile(iconPath)) {
                try {
                    cfg.addProperty("server_icon_mtime", Files.getLastModifiedTime(iconPath).toMillis());
                } catch (IOException ignored) {
                }
            }
        }
        sendJson(ex, 200, cfg);
    }

    private void handleSettings(HttpExchange ex) throws IOException {
        if (serverContext == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        String method = ex.getRequestMethod();
        if ("GET".equalsIgnoreCase(method)) {
            if (!requireApiAuth(ex)) {
                return;
            }
            sendJson(ex, 200, buildSettingsJson());
            return;
        }
        if ("POST".equalsIgnoreCase(method)) {
            if (!requireApiAuth(ex)) {
                return;
            }
            String body = new String(ex.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
            JsonObject json = body != null && !body.isBlank()
                    ? GSON.fromJson(body, JsonObject.class) : new JsonObject();
            try {
                Path conf = WatchtowerPaths.confPath(serverContext);
                JsonObject previous = buildSettingsJson();
                String text = Files.isRegularFile(conf) ? Files.readString(conf, StandardCharsets.UTF_8) : "";

                if (json.has("reportScheduleMode") && !json.get("reportScheduleMode").isJsonNull()) {
                    String mode = json.get("reportScheduleMode").getAsString().trim().toLowerCase();
                    if ("off".equals(mode)) {
                        WatchtowerConfWriter.persistReportSchedule(serverContext, ReportSchedule.off());
                    } else if (ReportSchedule.MODE_WALL_CLOCK.equals(mode)) {
                        String hoursRaw = json.has("reportWallClockHours")
                                ? json.get("reportWallClockHours").getAsString()
                                : ReportSchedule.wallClockHoursToString(ReportSchedule.DEFAULT_WALL_CLOCK_HOURS);
                        WatchtowerConfWriter.persistReportSchedule(
                                serverContext,
                                ReportSchedule.wallClock(ReportSchedule.parseHours(hoursRaw))
                        );
                    } else if (json.has("reportIntervalMinutes") && !json.get("reportIntervalMinutes").isJsonNull()) {
                        int minutes = Math.max(1, Math.min(10080, json.get("reportIntervalMinutes").getAsInt()));
                        WatchtowerConfWriter.persistReportSchedule(serverContext, ReportSchedule.interval(minutes));
                    }
                } else if (json.has("reportIntervalMinutes") && !json.get("reportIntervalMinutes").isJsonNull()) {
                    int minutes = json.get("reportIntervalMinutes").getAsInt();
                    minutes = Math.max(0, Math.min(10080, minutes));
                    if (minutes <= 0) {
                        WatchtowerConfWriter.persistReportSchedule(serverContext, ReportSchedule.off());
                    } else {
                        WatchtowerConfWriter.persistReportSchedule(serverContext, ReportSchedule.interval(minutes));
                    }
                }
                if (json.has("lookbackHours") && !json.get("lookbackHours").isJsonNull()) {
                    int hours = Math.max(1, Math.min(720, json.get("lookbackHours").getAsInt()));
                    text = WatchtowerConfWriter.upsertLine(text, "LOOKBACK_HOURS", String.valueOf(hours));
                }
                if (json.has("incremental") && !json.get("incremental").isJsonNull()) {
                    boolean incremental = json.get("incremental").getAsBoolean();
                    text = WatchtowerConfWriter.upsertLine(text, "INCREMENTAL", incremental ? "true" : "false");
                }
                if (json.has("tpsWarn") && !json.get("tpsWarn").isJsonNull()) {
                    double tpsWarn = Math.max(1.0, Math.min(20.0, json.get("tpsWarn").getAsDouble()));
                    text = WatchtowerConfWriter.upsertLine(text, "TPS_WARN", String.valueOf(tpsWarn));
                }
                if (json.has("msptWarn") && !json.get("msptWarn").isJsonNull()) {
                    double msptWarn = Math.max(1.0, Math.min(500.0, json.get("msptWarn").getAsDouble()));
                    text = WatchtowerConfWriter.upsertLine(text, "MSPT_WARN", String.valueOf(msptWarn));
                }
                if (json.has("modrinthLookup") && !json.get("modrinthLookup").isJsonNull()) {
                    boolean modrinthLookup = json.get("modrinthLookup").getAsBoolean();
                    text = WatchtowerConfWriter.upsertLine(text, "MODRINTH_LOOKUP",
                            modrinthLookup ? "true" : "false");
                }
                if (json.has("modrinthAutoScanOnModChanges") && !json.get("modrinthAutoScanOnModChanges").isJsonNull()) {
                    boolean autoScan = json.get("modrinthAutoScanOnModChanges").getAsBoolean();
                    text = WatchtowerConfWriter.upsertLine(text, "MODRINTH_AUTO_SCAN_ON_MOD_CHANGES",
                            autoScan ? "true" : "false");
                }
                if (json.has("sparkAutoCaptureOnLag") && !json.get("sparkAutoCaptureOnLag").isJsonNull()) {
                    boolean autoSpark = json.get("sparkAutoCaptureOnLag").getAsBoolean();
                    text = WatchtowerConfWriter.upsertLine(text, "SPARK_AUTO_CAPTURE_ON_LAG",
                            autoSpark ? "true" : "false");
                }
                if (json.has("baselineAutoCapture") && !json.get("baselineAutoCapture").isJsonNull()) {
                    boolean autoBase = json.get("baselineAutoCapture").getAsBoolean();
                    text = WatchtowerConfWriter.upsertLine(text, "BASELINE_AUTO_CAPTURE",
                            autoBase ? "true" : "false");
                }
                if (json.has("baselineRegressionThresholdPct") && !json.get("baselineRegressionThresholdPct").isJsonNull()) {
                    double thr = Math.max(1.0, Math.min(100.0, json.get("baselineRegressionThresholdPct").getAsDouble()));
                    text = WatchtowerConfWriter.upsertLine(text, "BASELINE_REGRESSION_THRESHOLD_PCT",
                            String.valueOf(thr));
                }
                if (json.has("sparkEnabled") && !json.get("sparkEnabled").isJsonNull()) {
                    boolean sparkEnabled = json.get("sparkEnabled").getAsBoolean();
                    text = WatchtowerConfWriter.upsertLine(text, "SPARK_ENABLED",
                            sparkEnabled ? "true" : "false");
                }
                if (json.has("sparkAutoCaptureWindowSec") && !json.get("sparkAutoCaptureWindowSec").isJsonNull()) {
                    int windowSec = Math.max(5, Math.min(300, json.get("sparkAutoCaptureWindowSec").getAsInt()));
                    text = WatchtowerConfWriter.upsertLine(text, "SPARK_AUTO_CAPTURE_WINDOW_SEC",
                            String.valueOf(windowSec));
                }
                if (json.has("sparkAutoCaptureCooldownSec") && !json.get("sparkAutoCaptureCooldownSec").isJsonNull()) {
                    int cooldownSec = Math.max(60, Math.min(86400, json.get("sparkAutoCaptureCooldownSec").getAsInt()));
                    text = WatchtowerConfWriter.upsertLine(text, "SPARK_AUTO_CAPTURE_COOLDOWN_SEC",
                            String.valueOf(cooldownSec));
                }
                if (json.has("updateCheck") && !json.get("updateCheck").isJsonNull()) {
                    boolean updateCheck = json.get("updateCheck").getAsBoolean();
                    text = WatchtowerConfWriter.upsertLine(text, "UPDATE_CHECK",
                            updateCheck ? "true" : "false");
                }
                if (json.has("metricsContextBanner") && !json.get("metricsContextBanner").isJsonNull()) {
                    boolean banner = json.get("metricsContextBanner").getAsBoolean();
                    text = WatchtowerConfWriter.upsertLine(text, "METRICS_CONTEXT_BANNER",
                            banner ? "true" : "false");
                }
                if (json.has("diskWarnPct") && !json.get("diskWarnPct").isJsonNull()) {
                    int diskWarn = Math.max(50, Math.min(99, json.get("diskWarnPct").getAsInt()));
                    text = WatchtowerConfWriter.upsertLine(text, "DISK_WARN_PCT", String.valueOf(diskWarn));
                }
                if (json.has("diskFillWarnDays") && !json.get("diskFillWarnDays").isJsonNull()) {
                    int fillDays = Math.max(1, Math.min(365, json.get("diskFillWarnDays").getAsInt()));
                    text = WatchtowerConfWriter.upsertLine(text, "DISK_FILL_WARN_DAYS", String.valueOf(fillDays));
                }
                if (json.has("diskIoLatencyWarnMs") && !json.get("diskIoLatencyWarnMs").isJsonNull()) {
                    double latencyMs = Math.max(1.0, Math.min(5000.0, json.get("diskIoLatencyWarnMs").getAsDouble()));
                    text = WatchtowerConfWriter.upsertLine(text, "DISK_IO_LATENCY_WARN_MS",
                            String.valueOf(latencyMs));
                }
                if (json.has("opsPollSec") && !json.get("opsPollSec").isJsonNull()) {
                    int opsPoll = Math.max(15, Math.min(3600, json.get("opsPollSec").getAsInt()));
                    text = WatchtowerConfWriter.upsertLine(text, "OPS_POLL_SEC", String.valueOf(opsPoll));
                }
                if (json.has("opsLogScanSec") && !json.get("opsLogScanSec").isJsonNull()) {
                    int logScan = Math.max(15, Math.min(3600, json.get("opsLogScanSec").getAsInt()));
                    text = WatchtowerConfWriter.upsertLine(text, "OPS_LOG_SCAN_SEC", String.valueOf(logScan));
                }
                if (json.has("reportRetentionDays") && !json.get("reportRetentionDays").isJsonNull()) {
                    int retentionDays = Math.max(1, Math.min(3650, json.get("reportRetentionDays").getAsInt()));
                    text = WatchtowerConfWriter.upsertLine(text, "REPORT_RETENTION_DAYS",
                            String.valueOf(retentionDays));
                }
                if (json.has("reportRetentionCount") && !json.get("reportRetentionCount").isJsonNull()) {
                    int retentionCount = Math.max(1, Math.min(500, json.get("reportRetentionCount").getAsInt()));
                    text = WatchtowerConfWriter.upsertLine(text, "REPORT_RETENTION_COUNT",
                            String.valueOf(retentionCount));
                }
                boolean wroteConf = json.has("lookbackHours") || json.has("incremental")
                        || json.has("tpsWarn") || json.has("msptWarn")
                        || json.has("modrinthLookup") || json.has("modrinthAutoScanOnModChanges")
                        || json.has("sparkAutoCaptureOnLag")
                        || json.has("baselineAutoCapture")
                        || json.has("baselineRegressionThresholdPct")
                        || json.has("sparkEnabled")
                        || json.has("sparkAutoCaptureWindowSec")
                        || json.has("sparkAutoCaptureCooldownSec")
                        || json.has("updateCheck")
                        || json.has("metricsContextBanner")
                        || json.has("diskWarnPct")
                        || json.has("diskFillWarnDays")
                        || json.has("diskIoLatencyWarnMs")
                        || json.has("opsPollSec")
                        || json.has("opsLogScanSec")
                        || json.has("reportRetentionDays")
                        || json.has("reportRetentionCount");
                if (wroteConf) {
                    Files.writeString(conf, text, StandardCharsets.UTF_8);
                }

                JsonObject applied = buildSettingsJson();
                String changed = changedSettingKeys(previous, applied);
                DashboardAudit.record("settings_changed", DashboardAuthHttp.sessionOf(ex),
                        null, changed.isEmpty() ? "no effective change" : changed,
                        DashboardAuthHttp.clientIp(ex));

                JsonObject out = new JsonObject();
                out.addProperty("ok", true);
                out.add("settings", applied);
                sendJson(ex, 200, out);
            } catch (Exception e) {
                ModRuntime.logger().warn("Settings save failed: {}", e.toString());
                JsonObject err = new JsonObject();
                err.addProperty("error", e.getMessage() != null ? e.getMessage() : "save failed");
                sendJson(ex, 500, err);
            }
            return;
        }
        send(ex, 405, "text/plain", "Method not allowed");
    }

    /** Diff settings snapshots into `key old -> new` pairs; cap at 12 with a trailing (+N more). */
    private static String changedSettingKeys(JsonObject previous, JsonObject applied) {
        Set<String> keys = new HashSet<>();
        if (previous != null) {
            keys.addAll(previous.keySet());
        }
        if (applied != null) {
            keys.addAll(applied.keySet());
        }
        List<String> pairs = new ArrayList<>();
        int overflow = 0;
        for (String key : keys.stream().sorted().toList()) {
            String oldVal = settingDisplayValue(previous, key);
            String newVal = settingDisplayValue(applied, key);
            if (Objects.equals(oldVal, newVal)) {
                continue;
            }
            if (pairs.size() < 12) {
                pairs.add(key + " " + oldVal + " -> " + newVal);
            } else {
                overflow++;
            }
        }
        if (pairs.isEmpty()) {
            return "";
        }
        String joined = String.join(", ", pairs);
        if (overflow > 0) {
            joined += " (+" + overflow + " more)";
        }
        return joined;
    }

    private static String settingDisplayValue(JsonObject obj, String key) {
        if (obj == null || !obj.has(key) || obj.get(key).isJsonNull()) {
            return "";
        }
        JsonElement el = obj.get(key);
        if (el.isJsonPrimitive()) {
            return el.getAsString();
        }
        return el.toString();
    }

    private JsonObject buildSettingsJson() throws IOException {
        Path conf = WatchtowerPaths.confPath(serverContext);
        Map<String, String> map = new HashMap<>(WatchtowerConfWriter.readMap(conf));
        map.put("SERVER_DIR", serverContext.serverDirectory().toAbsolutePath().toString());
        ReportConfig config = ModReportConfig.forServer(serverContext);
        PanelInfo panel = PanelResolver.resolve(map, serverContext.serverDirectory());

        JsonObject out = new JsonObject();
        WatchtowerScheduler scheduler = ModRuntime.requireScheduler();
        ReportSchedule schedule = scheduler.effectiveSchedule();
        int interval = scheduler.effectiveReportMinutes();
        out.addProperty("report_interval_minutes", interval);
        out.addProperty("report_schedule_mode", schedule.mode() == ReportSchedule.ScheduleMode.WALL_CLOCK
                ? ReportSchedule.MODE_WALL_CLOCK
                : schedule.mode() == ReportSchedule.ScheduleMode.INTERVAL
                ? ReportSchedule.MODE_INTERVAL
                : "off");
        out.addProperty("report_wall_clock_hours",
                ReportSchedule.wallClockHoursToString(
                        schedule.mode() == ReportSchedule.ScheduleMode.WALL_CLOCK
                                ? schedule.wallClockHours()
                                : ReportSchedule.DEFAULT_WALL_CLOCK_HOURS));
        out.addProperty("next_report_in_minutes", scheduler.minutesUntilNextReport());
        String nextAt = scheduler.nextReportAtIso();
        if (nextAt != null) {
            out.addProperty("next_report_at", nextAt);
        }
        out.addProperty("lookback_hours", WatchtowerConfWriter.readInt(map, "LOOKBACK_HOURS", config.lookbackHours()));
        out.addProperty("incremental", WatchtowerConfWriter.readBool(map, "INCREMENTAL", config.incremental()));
        out.addProperty("modrinth_lookup", WatchtowerConfWriter.readBool(map, "MODRINTH_LOOKUP", config.modrinthLookup()));
        out.addProperty("modrinth_auto_scan_on_mod_changes",
                WatchtowerConfWriter.readBool(map, "MODRINTH_AUTO_SCAN_ON_MOD_CHANGES", config.modrinthAutoScanOnModChanges()));
        out.addProperty("spark_enabled",
                WatchtowerConfWriter.readBool(map, "SPARK_ENABLED", config.sparkEnabled()));
        out.addProperty("spark_mod_loaded", serverContext.isModLoaded("spark"));
        out.addProperty("spark_auto_capture_on_lag",
                WatchtowerConfWriter.readBool(map, "SPARK_AUTO_CAPTURE_ON_LAG", config.sparkAutoCaptureOnLag()));
        out.addProperty("spark_auto_capture_window_sec",
                WatchtowerConfWriter.readInt(map, "SPARK_AUTO_CAPTURE_WINDOW_SEC", config.sparkAutoCaptureWindowSec()));
        out.addProperty("spark_auto_capture_cooldown_sec",
                WatchtowerConfWriter.readInt(map, "SPARK_AUTO_CAPTURE_COOLDOWN_SEC", config.sparkAutoCaptureCooldownSec()));
        out.addProperty("baseline_auto_capture",
                WatchtowerConfWriter.readBool(map, "BASELINE_AUTO_CAPTURE", config.baselineAutoCapture()));
        out.addProperty("baseline_regression_threshold_pct",
                WatchtowerConfWriter.readDouble(map, "BASELINE_REGRESSION_THRESHOLD_PCT",
                        config.baselineRegressionThresholdPct()));
        String backupDir = map.getOrDefault("BACKUP_DIR", "");
        out.addProperty("backup_dir", backupDir != null ? backupDir : "");
        String backupDirs = map.getOrDefault("BACKUP_DIRS", "");
        out.addProperty("backup_dirs", backupDirs != null ? backupDirs : "");
        out.addProperty("backup_external_configured", config.isExternalBackupConfigured());
        out.addProperty("backup_webhook_enabled",
                config.backupWebhookToken() != null && !config.backupWebhookToken().isBlank());
        out.addProperty("backup_suppress_local_missing", config.backupSuppressLocalMissing());
        out.addProperty("backup_tracking_enabled", config.backupTrackingEnabled());
        out.addProperty("backup_tracking_mode", BackupExternalConfigService.deriveTrackingMode(config));
        out.addProperty("dashboard_port", ModRuntime.config().dashboardPort());
        Path markerPath = ExternalBackupDetector.resolveMarkerPath(
                serverContext.serverDirectory().toAbsolutePath().toString(), config);
        if (markerPath != null) {
            out.addProperty("backup_external_marker", markerPath.toString());
        }
        String markerRel = map.getOrDefault("BACKUP_EXTERNAL_MARKER", "");
        if (markerRel != null && !markerRel.isBlank()) {
            out.addProperty("backup_external_marker_rel", markerRel);
        } else if (config.backupExternalMarker() != null && !config.backupExternalMarker().isBlank()) {
            out.addProperty("backup_external_marker_rel", config.backupExternalMarker());
        }
        out.addProperty("panel", panel.panelId());
        out.addProperty("panel_display_name", PanelLabels.displayName(panel.panelId()));
        out.addProperty("tps_warn", WatchtowerConfWriter.readDouble(map, "TPS_WARN", config.tpsWarn()));
        out.addProperty("mspt_warn", WatchtowerConfWriter.readDouble(map, "MSPT_WARN", config.msptWarn()));
        out.addProperty("disk_warn_pct", WatchtowerConfWriter.readInt(map, "DISK_WARN_PCT", config.diskWarnPct()));
        out.addProperty("disk_fill_warn_days",
                WatchtowerConfWriter.readInt(map, "DISK_FILL_WARN_DAYS", config.diskFillWarnDays()));
        out.addProperty("disk_io_latency_warn_ms",
                WatchtowerConfWriter.readDouble(map, "DISK_IO_LATENCY_WARN_MS", config.diskIoLatencyWarnMs()));
        out.addProperty("metrics_context_banner",
                WatchtowerConfWriter.readBool(map, "METRICS_CONTEXT_BANNER", config.metricsContextBanner()));
        out.addProperty("update_check",
                WatchtowerConfWriter.readBool(map, "UPDATE_CHECK", config.updateCheck()));
        out.addProperty("hostname", resolveHostname());
        out.addProperty("ops_poll_sec", WatchtowerConfWriter.readInt(map, "OPS_POLL_SEC", config.opsPollSec()));
        out.addProperty("ops_log_scan_sec",
                WatchtowerConfWriter.readInt(map, "OPS_LOG_SCAN_SEC", config.opsLogScanSec()));
        out.addProperty("report_retention_count",
                WatchtowerConfWriter.readInt(map, "REPORT_RETENTION_COUNT", config.reportRetentionCount()));
        out.addProperty("report_retention_days",
                WatchtowerConfWriter.readInt(map, "REPORT_RETENTION_DAYS", config.reportRetentionDays()));
        try {
            out.addProperty("live_sample_interval_seconds", ModRuntime.config().liveSampleIntervalSeconds());
        } catch (IllegalStateException e) {
            out.addProperty("live_sample_interval_seconds", 1);
        }
        return out;
    }

    private void handleDataSources(HttpExchange ex) throws IOException {
        if (!"GET".equalsIgnoreCase(ex.getRequestMethod())) {
            send(ex, 405, "text/plain", "Method not allowed");
            return;
        }
        if (!requireApiAuth(ex)) {
            return;
        }
        if (serverContext == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        JsonObject out = new JsonObject();

        String liveAt = resolveLiveAt();
        if (liveAt != null) {
            out.addProperty("live_at", liveAt);
        }

        try {
            JsonObject opsCache = OpsCacheReader.load(WatchtowerPaths.opsCachePath(serverContext));
            if (opsCache.has(OpsCacheSchema.UPDATED_AT)) {
                out.addProperty("ops_scan_at", opsCache.get(OpsCacheSchema.UPDATED_AT).getAsString());
            }
            if (opsCache.has(IssuesLiveSchema.ISSUES_LIVE_UPDATED_AT)) {
                out.addProperty("issues_live_at",
                        opsCache.get(IssuesLiveSchema.ISSUES_LIVE_UPDATED_AT).getAsString());
            } else if (opsCache.has(IssuesLiveSchema.ISSUES_LIVE)) {
                out.addProperty("issues_live_at",
                        opsCache.has(OpsCacheSchema.UPDATED_AT)
                                ? opsCache.get(OpsCacheSchema.UPDATED_AT).getAsString() : "");
            }
            if (opsCache.has(OpsCacheSchema.LAST_SUPPORT_COMPOSE_AT)) {
                out.addProperty("support_compose_at",
                        opsCache.get(OpsCacheSchema.LAST_SUPPORT_COMPOSE_AT).getAsString());
            }
        } catch (IOException ignored) {
        }

        try {
            Path reportDir = WatchtowerPaths.reportDir(serverContext);
            Path factsPath = ReportArtifactFinder.findLatestFacts(reportDir);
            if (factsPath != null && Files.isRegularFile(factsPath)) {
                out.addProperty("full_report_at", Files.getLastModifiedTime(factsPath).toInstant().toString());
            }
        } catch (IOException ignored) {
        }

        WatchtowerScheduler scheduler = ModRuntime.requireScheduler();
        out.addProperty("next_scheduled_minutes", scheduler.minutesUntilNextReport());

        ReportConfig config = ModReportConfig.forServer(serverContext);
        out.addProperty("ops_log_scan_sec", config.opsLogScanSec());
        out.addProperty("ops_poll_sec", config.opsPollSec());

        sendJson(ex, 200, out);
    }

    private String resolveLiveAt() {
        try {
            JsonObject live = LiveMetricsService.get().getLiveResponse();
            if (live.has("latest") && live.get("latest").isJsonObject()) {
                JsonObject latest = live.getAsJsonObject("latest");
                if (latest.has("polled_at") && !latest.get("polled_at").isJsonNull()) {
                    return latest.get("polled_at").getAsString();
                }
                if (latest.has("time") && !latest.get("time").isJsonNull()) {
                    return latest.get("time").getAsString();
                }
            }
        } catch (Exception ignored) {
        }
        if (serverContext == null) {
            return null;
        }
        try {
            Path livePath = WatchtowerPaths.liveHistoryPath(serverContext);
            if (Files.isRegularFile(livePath)) {
                return Files.getLastModifiedTime(livePath).toInstant().toString();
            }
        } catch (IOException ignored) {
        }
        return null;
    }

    private void handleUpdateCheck(HttpExchange ex) throws IOException {
        if (!"GET".equalsIgnoreCase(ex.getRequestMethod())) {
            send(ex, 405, "text/plain", "Method not allowed");
            return;
        }
        if (!requireApiAuth(ex)) {
            return;
        }
        if (serverContext == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        Path conf = WatchtowerPaths.confPath(serverContext);
        Map<String, String> map = WatchtowerConfWriter.readMap(conf);
        ReportConfig config = ModReportConfig.forServer(serverContext);
        boolean enabled = WatchtowerConfWriter.readBool(map, "UPDATE_CHECK", config.updateCheck());
        String version = serverContext.modVersion();
        sendJson(ex, 200, ReleaseVersionChecker.check(version, enabled));
    }

    private void handleServerIcon(HttpExchange ex) throws IOException {
        if (!"GET".equalsIgnoreCase(ex.getRequestMethod())) {
            send(ex, 405, "text/plain", "Method not allowed");
            return;
        }
        if (!requireApiAuth(ex)) {
            return;
        }
        if (serverContext == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        Path icon = serverContext.serverDirectory().resolve("server-icon.png");
        if (!Files.isRegularFile(icon)) {
            send(ex, 404, "text/plain", "No server icon");
            return;
        }
        byte[] bytes = Files.readAllBytes(icon);
        Headers h = ex.getResponseHeaders();
        DashboardAuthHttp.applySecurityHeaders(h);
        h.set("Content-Type", "image/png");
        h.set("Cache-Control", "private, max-age=300");
        ex.sendResponseHeaders(200, bytes.length);
        try (OutputStream os = ex.getResponseBody()) {
            os.write(bytes);
        }
    }

    private void handleOverviewMeta(HttpExchange ex) throws IOException {
        if (!"GET".equalsIgnoreCase(ex.getRequestMethod())) {
            send(ex, 405, "text/plain", "Method not allowed");
            return;
        }
        if (!requireApiAuth(ex)) {
            return;
        }
        if (serverContext == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        Path reportDir = WatchtowerPaths.reportDir(serverContext);
        Path serverDir = serverContext.serverDirectory();
        Path conf = WatchtowerPaths.confPath(serverContext);
        Map<String, String> map = WatchtowerConfWriter.readMap(conf);
        ReportConfig config = ModReportConfig.forServer(serverContext);
        PanelInfo panel = PanelResolver.resolve(map, serverDir);
        String version = serverContext.modVersion();

        JsonObject optional = new JsonObject();
        JsonObject systemBasics = HostMetricsCollector.collectSystemBasics(serverDir.toAbsolutePath().toString());
        try {
            Path factsPath = ReportArtifactFinder.findLatestFacts(reportDir);
            if (factsPath != null && Files.isRegularFile(factsPath)) {
                JsonObject facts = GSON.fromJson(Files.readString(factsPath, StandardCharsets.UTF_8), JsonObject.class);
                if (facts.has("optional")) {
                    optional = facts.getAsJsonObject("optional");
                }
                if (facts.has("system") && facts.get("system").isJsonObject()) {
                    JsonObject fromFacts = facts.getAsJsonObject("system");
                    for (String key : fromFacts.keySet()) {
                        if (!systemBasics.has(key)) {
                            systemBasics.add(key, fromFacts.get(key));
                        }
                    }
                }
            }
        } catch (IOException ignored) {
        }

        JsonObject meta = OverviewMetaBuilder.build(
                reportDir, serverDir, panel.panelId(), systemBasics, optional, version, config);
        JsonObject updateCheck = meta.has("update_check") ? meta.getAsJsonObject("update_check") : new JsonObject();
        updateCheck.addProperty("checked_at", Instant.now().toString());
        meta.add("update_check", updateCheck);
        applyRssHint(meta, config);
        applyScorecardAndOpsMeta(meta, reportDir, config, optional, systemBasics);
        sendJson(ex, 200, meta);
    }

    private void applyScorecardAndOpsMeta(
            JsonObject meta, Path reportDir, ReportConfig config, JsonObject optional, JsonObject systemBasics) {
        if (serverContext == null) {
            return;
        }
        Path opsCachePath = WatchtowerPaths.opsCachePath(serverContext);
        Path rollupsPath = WatchtowerPaths.performanceRollupsPath(serverContext);
        JsonObject facts = null;
        try {
            Path factsPath = ReportArtifactFinder.findLatestFacts(reportDir);
            if (factsPath != null && Files.isRegularFile(factsPath)) {
                facts = GSON.fromJson(Files.readString(factsPath, StandardCharsets.UTF_8), JsonObject.class);
            }
        } catch (IOException ignored) {
        }
        JsonObject opsCache;
        try {
            opsCache = OpsCacheReader.load(opsCachePath);
        } catch (IOException e) {
            opsCache = OpsCacheReader.empty();
        }
        if (opsCache.has(OpsCacheSchema.UPDATED_AT)) {
            meta.addProperty("ops_cache_updated_at", opsCache.get(OpsCacheSchema.UPDATED_AT).getAsString());
        }
        if (opsCache.has(OpsCacheSchema.LAST_SUPPORT_COMPOSE_AT)
                && !opsCache.get(OpsCacheSchema.LAST_SUPPORT_COMPOSE_AT).isJsonNull()) {
            meta.addProperty("last_support_compose_at",
                    opsCache.get(OpsCacheSchema.LAST_SUPPORT_COMPOSE_AT).getAsString());
        }
        if (opsCache.has(OpsCacheSchema.REPORT_RECONCILE_AT)) {
            meta.addProperty("report_reconcile_at", opsCache.get(OpsCacheSchema.REPORT_RECONCILE_AT).getAsString());
        }
        double tpsWarn = config.tpsWarn();
        double msptWarn = config.msptWarn();
        int lowTpsThreshold = scorecardLowTpsThresholdFromConf();
        JsonObject scorecard = ScorecardBuilder.build(
                facts, opsCache, rollupsPath, tpsWarn, msptWarn, lowTpsThreshold);
        meta.add("scorecard", scorecard);
        if (config.l1RollupEnabled()) {
            try {
                int hours = PerformanceInsightEngine.windowToHours("7d");
                List<JsonObject> rows = PerformanceRollupWriter.loadRowsFromFile(rollupsPath, hours);
                if (rows.size() >= 60) {
                    JsonObject insights = PerformanceInsightEngine.analyze(
                            rows, "7d", config.msptWarn(), config.tpsWarn());
                    if (insights.has("insights") && !insights.getAsJsonArray("insights").isEmpty()) {
                        JsonObject top = insights.getAsJsonArray("insights").get(0).getAsJsonObject();
                        JsonObject tldr = new JsonObject();
                        if (top.has("title")) {
                            tldr.addProperty("label", top.get("title").getAsString());
                        }
                        if (top.has("detail")) {
                            tldr.addProperty("detail", top.get("detail").getAsString());
                        }
                        tldr.addProperty("window", "7d");
                        meta.add("performance_insights_tldr", tldr);
                    }
                }
                // Prefer baseline regression teaser when active (1.1.2)
                try {
                    Path statePath = WatchtowerPaths.statePath(serverContext);
                    JsonObject baseline = PerformanceBaselineTracker.getBaseline(statePath);
                    if (baseline != null && !rows.isEmpty()) {
                        JsonObject modsInv = opsCache.has(OpsCacheSchema.MODS_INVENTORY)
                                && opsCache.get(OpsCacheSchema.MODS_INVENTORY).isJsonObject()
                                ? opsCache.getAsJsonObject(OpsCacheSchema.MODS_INVENTORY) : null;
                        JsonObject eval = PerformanceBaselineTracker.evaluate(
                                baseline, rows, config.baselineRegressionThresholdPct(), modsInv);
                        if (eval.has("active") && eval.get("active").getAsBoolean()) {
                            JsonObject baseTldr = new JsonObject();
                            if (eval.has("label")) {
                                baseTldr.addProperty("label", eval.get("label").getAsString());
                            }
                            if (eval.has("detail")) {
                                baseTldr.addProperty("detail", eval.get("detail").getAsString());
                            }
                            baseTldr.addProperty("window", "7d");
                            baseTldr.addProperty("kind", "baseline_regression");
                            meta.add("baseline_regression_tldr", baseTldr);
                            meta.add("performance_insights_tldr", baseTldr);
                        }
                    }
                } catch (Exception ignoredBaseline) {
                }
            } catch (Exception ignored) {
            }
        }
        JsonObject crashes = scorecard.has("crashes") ? scorecard.getAsJsonObject("crashes") : new JsonObject();
        if (crashes.has("latest_label")) {
            JsonObject tldr = new JsonObject();
            tldr.addProperty("label", crashes.get("latest_label").getAsString());
            if (crashes.has("latest_file")) {
                tldr.addProperty("file", crashes.get("latest_file").getAsString());
            }
            if (crashes.has("latest_at")) {
                tldr.addProperty("at", crashes.get("latest_at").getAsString());
            }
            if (crashes.has("unreviewed")) {
                tldr.addProperty("unreviewed", crashes.get("unreviewed").getAsInt());
            }
            meta.add("crash_tldr", tldr);
        }
        if (opsCache.has(OpsCacheSchema.LAG_ISSUES)) {
            JsonObject lagIssues = opsCache.getAsJsonObject(OpsCacheSchema.LAG_ISSUES);
            if (lagIssues.has(OpsCacheSchema.LAG_ISSUES_ACTIVE_COUNT)
                    && lagIssues.get(OpsCacheSchema.LAG_ISSUES_ACTIVE_COUNT).getAsInt() > 0
                    && lagIssues.has(OpsCacheSchema.LAG_ISSUES_ENTRIES)
                    && !lagIssues.getAsJsonArray(OpsCacheSchema.LAG_ISSUES_ENTRIES).isEmpty()) {
                JsonObject latest = lagIssues.getAsJsonArray(OpsCacheSchema.LAG_ISSUES_ENTRIES).get(0).getAsJsonObject();
                JsonObject lagTldr = new JsonObject();
                if (latest.has("title")) {
                    lagTldr.addProperty("label", latest.get("title").getAsString());
                }
                if (latest.has("narrative")) {
                    lagTldr.addProperty("narrative", latest.get("narrative").getAsString());
                }
                if (latest.has("incident_id")) {
                    lagTldr.addProperty("incident_id", latest.get("incident_id").getAsString());
                }
                if (latest.has("severity")) {
                    lagTldr.addProperty("severity", latest.get("severity").getAsString());
                }
                meta.add("lag_tldr", lagTldr);
            }
        }
        if (facts != null && facts.has("optional") && facts.getAsJsonObject("optional").has("spark_profile")) {
            JsonObject sparkProfile = facts.getAsJsonObject("optional").getAsJsonObject("spark_profile");
            if (sparkProfile.has("fresh") && sparkProfile.get("fresh").getAsBoolean()) {
                JsonObject sparkTldr = sparkTldrFromProfile(sparkProfile);
                if (sparkTldr != null) {
                    meta.add("spark_tldr", sparkTldr);
                }
            }
        }
        // Continuous path: fresh on-disk / auto-capture Spark without a report embed
        if (!meta.has("spark_tldr") && config.sparkEnabled()) {
            try {
                var collected = SparkCollector.collect(config.serverDir(), config);
                if (collected.isPresent()) {
                    JsonObject diskProfile = SparkProfileBuilder.build(
                            collected.get(), config.serverDir(), config);
                    if (diskProfile != null
                            && diskProfile.has("fresh")
                            && diskProfile.get("fresh").getAsBoolean()) {
                        JsonObject sparkTldr = sparkTldrFromProfile(diskProfile);
                        if (sparkTldr != null) {
                            meta.add("spark_tldr", sparkTldr);
                        }
                    }
                }
            } catch (Exception | LinkageError ignored) {
                // optional Overview peek — never fail meta for Spark parse issues
            }
        }
        meta.addProperty("ops_poll_active", OpsPollScheduler.get().isPollActive());
        meta.addProperty("ops_log_scan_active", AlwaysOnOpsLogScheduler.get().isActive());
        meta.addProperty("backup_poll_active", BackupPollScheduler.get().isActive());
        if (opsCache.has(OpsCacheSchema.BACKUPS_LIVE)) {
            JsonObject backupsLive = opsCache.getAsJsonObject(OpsCacheSchema.BACKUPS_LIVE);
            if (backupsLive.has("scanned_at")) {
                meta.addProperty("backups_scanned_at", backupsLive.get("scanned_at").getAsString());
            }
        }
        if (opsCache.has(OpsCacheSchema.LOG_STALE)) {
            JsonObject ls = opsCache.getAsJsonObject(OpsCacheSchema.LOG_STALE);
            if (ls.has("active") && ls.get("active").getAsBoolean()) {
                JsonObject tldr = new JsonObject();
                tldr.addProperty("active", true);
                if (ls.has("gap_minutes")) {
                    tldr.addProperty("gap_minutes", ls.get("gap_minutes").getAsDouble());
                }
                if (ls.has("last_mtime")) {
                    tldr.addProperty("last_mtime", ls.get("last_mtime").getAsString());
                }
                meta.add("log_stale_tldr", tldr);
            }
        }
        if (opsCache.has(OpsCacheSchema.ACTIVITY)) {
            JsonObject activity = opsCache.getAsJsonObject(OpsCacheSchema.ACTIVITY);
            if (activity.has(OpsCacheSchema.ACTIVITY_SCANNED_AT)) {
                meta.addProperty("activity_scanned_at", activity.get(OpsCacheSchema.ACTIVITY_SCANNED_AT).getAsString());
            }
        }
        if (opsCache.has(OpsCacheSchema.MOD_LOG_ERRORS)) {
            JsonObject modBlock = opsCache.getAsJsonObject(OpsCacheSchema.MOD_LOG_ERRORS);
            if (modBlock.has(OpsCacheSchema.MOD_LOG_SCANNED_AT)) {
                meta.addProperty("mods_scanned_at", modBlock.get(OpsCacheSchema.MOD_LOG_SCANNED_AT).getAsString());
            }
        }
        if (opsCache.has(OpsCacheSchema.RUNNING_MODS)) {
            JsonObject rm = opsCache.getAsJsonObject(OpsCacheSchema.RUNNING_MODS);
            if (rm.has(OpsCacheSchema.RUNNING_MODS_COUNT)) {
                meta.addProperty("running_mod_count", rm.get(OpsCacheSchema.RUNNING_MODS_COUNT).getAsInt());
            }
        }
        if (opsCache.has(OpsCacheSchema.MOD_ISSUES)) {
            JsonObject modIssues = opsCache.getAsJsonObject(OpsCacheSchema.MOD_ISSUES);
            if (modIssues.has(OpsCacheSchema.MOD_ISSUES_ACTIVE_COUNT)
                    && modIssues.get(OpsCacheSchema.MOD_ISSUES_ACTIVE_COUNT).getAsInt() > 0
                    && modIssues.has(OpsCacheSchema.MOD_ISSUES_ENTRIES)
                    && !modIssues.getAsJsonArray(OpsCacheSchema.MOD_ISSUES_ENTRIES).isEmpty()) {
                JsonObject latest = modIssues.getAsJsonArray(OpsCacheSchema.MOD_ISSUES_ENTRIES).get(0).getAsJsonObject();
                JsonObject modTldr = new JsonObject();
                if (latest.has("title")) {
                    modTldr.addProperty("label", latest.get("title").getAsString());
                }
                if (latest.has("mod_id")) {
                    modTldr.addProperty("mod_id", latest.get("mod_id").getAsString());
                }
                if (latest.has("severity")) {
                    modTldr.addProperty("severity", latest.get("severity").getAsString());
                }
                modTldr.addProperty("count", modIssues.get(OpsCacheSchema.MOD_ISSUES_ACTIVE_COUNT).getAsInt());
                meta.add("mod_tldr", modTldr);
            }
        }
        if (opsCache.has(OpsCacheSchema.RIGHT_NOW)) {
            meta.add(OpsCacheSchema.RIGHT_NOW, opsCache.getAsJsonObject(OpsCacheSchema.RIGHT_NOW).deepCopy());
        }
        if (opsCache.has(OpsCacheSchema.MODS_INVENTORY)) {
            JsonObject inv = opsCache.getAsJsonObject(OpsCacheSchema.MODS_INVENTORY);
            if (inv.has("tldr")) {
                JsonObject tldr = new JsonObject();
                tldr.addProperty("label", inv.get("tldr").getAsString());
                if (inv.has("diff") && inv.getAsJsonObject("diff").has("added_count")) {
                    tldr.addProperty("added_count", inv.getAsJsonObject("diff").get("added_count").getAsInt());
                }
                if (inv.has("diff") && inv.getAsJsonObject("diff").has("removed_count")) {
                    tldr.addProperty("removed_count", inv.getAsJsonObject("diff").get("removed_count").getAsInt());
                }
                meta.add("mods_changed_tldr", tldr);
            }
        }
        if (opsCache.has(OpsCacheSchema.DISK_JUMP)) {
            JsonObject diskJump = opsCache.getAsJsonObject(OpsCacheSchema.DISK_JUMP);
            if (diskJump.has("active") && diskJump.get("active").getAsBoolean()) {
                JsonObject tldr = new JsonObject();
                tldr.addProperty("active", true);
                if (diskJump.has("message")) {
                    tldr.addProperty("label", diskJump.get("message").getAsString());
                }
                if (diskJump.has("delta_pct")) {
                    tldr.addProperty("delta_pct", diskJump.get("delta_pct").getAsDouble());
                }
                meta.add("disk_jump_tldr", tldr);
            }
        }
        if (opsCache.has(OpsCacheSchema.DISK_PROJECTION)
                && opsCache.get(OpsCacheSchema.DISK_PROJECTION).isJsonObject()) {
            JsonObject proj = opsCache.getAsJsonObject(OpsCacheSchema.DISK_PROJECTION);
            meta.add("disk_projection", proj.deepCopy());
            if ("filling".equals(proj.has("verdict") ? proj.get("verdict").getAsString() : "")
                    && proj.has("days_until_full")
                    && !proj.get("days_until_full").isJsonNull()
                    && proj.get("days_until_full").getAsDouble() <= config.diskFillWarnDays()) {
                JsonObject tldr = new JsonObject();
                tldr.addProperty("active", true);
                if (proj.has("message")) {
                    tldr.addProperty("label", proj.get("message").getAsString());
                }
                tldr.addProperty("days_until_full", proj.get("days_until_full").getAsDouble());
                if (proj.has("confidence")) {
                    tldr.addProperty("confidence", proj.get("confidence").getAsString());
                }
                meta.add("disk_projection_tldr", tldr);
            }
        }
        JsonObject lastBackup = optional != null && optional.has("last_backup") && optional.get("last_backup").isJsonObject()
                ? optional.getAsJsonObject("last_backup") : null;
        JsonObject backupExternal = opsCache.has(OpsCacheSchema.BACKUP_EXTERNAL)
                ? opsCache.getAsJsonObject(OpsCacheSchema.BACKUP_EXTERNAL)
                : (optional != null && optional.has("backup_external") && optional.get("backup_external").isJsonObject()
                ? optional.getAsJsonObject("backup_external") : null);
        boolean localConfigured = config.hasBackupDirs();
        boolean externalConfigured = backupExternal != null && backupExternal.has("configured")
                && backupExternal.get("configured").getAsBoolean();
        BackupStatusResolver.Resolved backupResolved = BackupStatusResolver.resolve(
                lastBackup, backupExternal, localConfigured, externalConfigured, config.backupSuppressLocalMissing());
        meta.addProperty("backup_mode", BackupStatusResolver.modeId(backupResolved.mode()));
        meta.add("backup_nudge", dev.mcstatus.watchtower.core.analyze.DiskNudgeEvaluator.evaluateBackup(
                lastBackup, backupExternal, config.backupWarnDays(), config.backupTrackingEnabled()));
        if (externalConfigured && backupExternal != null) {
            JsonObject extTldr = new JsonObject();
            String status = backupExternal.has("status") ? backupExternal.get("status").getAsString() : "unknown";
            if (backupExternal.has("source")) {
                extTldr.addProperty("source", backupExternal.get("source").getAsString());
            }
            if (backupExternal.has("age_hours")) {
                extTldr.addProperty("age_hours", backupExternal.get("age_hours").getAsDouble());
            }
            if (backupExternal.has("stale")) {
                extTldr.addProperty("stale", backupExternal.get("stale").getAsBoolean());
            }
            extTldr.addProperty("status", status);
            boolean stale = backupExternal.has("stale") && backupExternal.get("stale").getAsBoolean();
            if ("success".equals(status) && !stale) {
                extTldr.addProperty("label", "External backup OK");
            } else if ("stale".equals(status) || stale) {
                extTldr.addProperty("label", "External backup stale");
            } else if ("missing".equals(status)) {
                extTldr.addProperty("label", "External backup missing");
            } else if ("running".equals(status)) {
                extTldr.addProperty("label", "External backup running");
            }
            meta.add("backup_external_tldr", extTldr);
        }

        attachSafeRestart(meta, opsCache, optional, systemBasics, config);
        attachRestartHygiene(meta, rollupsPath, systemBasics, config);
    }

    private void attachRestartHygiene(
            JsonObject meta,
            Path rollupsPath,
            JsonObject systemBasics,
            ReportConfig config) {
        try {
            JsonObject input = new JsonObject();
            input.addProperty("enabled", config.restartHygieneEnabled());
            Instant now = Instant.now();
            input.addProperty("now", now.toString());

            Double uptimeSec = null;
            try {
                JsonObject live = LiveMetricsService.get().getLiveResponse();
                JsonObject latest = live.has("latest") && live.get("latest").isJsonObject()
                        ? live.getAsJsonObject("latest") : live;
                if (latest.has("java_uptime_sec") && !latest.get("java_uptime_sec").isJsonNull()) {
                    uptimeSec = latest.get("java_uptime_sec").getAsDouble();
                }
            } catch (Exception ignored) {
            }
            if (uptimeSec == null && systemBasics != null
                    && systemBasics.has("java_uptime_sec") && !systemBasics.get("java_uptime_sec").isJsonNull()) {
                uptimeSec = systemBasics.get("java_uptime_sec").getAsDouble();
            }
            if (uptimeSec != null) {
                input.addProperty("uptime_sec", uptimeSec);
            }

            if (config.l1RollupEnabled() && rollupsPath != null) {
                int hours = PerformanceInsightEngine.windowToHours("7d");
                List<JsonObject> rows = PerformanceRollupWriter.loadRowsFromFile(rollupsPath, hours);
                long nowEpoch = now.getEpochSecond();
                long currentStart = nowEpoch - 12L * 3600L;
                long priorStart = nowEpoch - 24L * 3600L;
                List<JsonObject> current = new ArrayList<>();
                List<JsonObject> prior = new ArrayList<>();
                for (JsonObject row : rows) {
                    long epoch = PerformanceInsightEngine.rowEpochPublic(row);
                    if (epoch >= currentStart) {
                        current.add(row);
                    } else if (epoch >= priorStart) {
                        prior.add(row);
                    }
                }
                input.add("current_stats", PerformanceInsightEngine.buildRamSizingStats(current));
                input.add("prior_stats", PerformanceInsightEngine.buildRamSizingStats(prior));
                input.add("hour_of_week", PerformanceInsightEngine.buildHourOfWeek(rows));
            }

            meta.add("restart_hygiene", RestartHygieneAdvisor.evaluate(input));
        } catch (Exception ignored) {
            // Non-fatal: Overview hides inactive/missing advice
        }
    }

    private void attachSafeRestart(
            JsonObject meta,
            JsonObject opsCache,
            JsonObject optional,
            JsonObject systemBasics,
            ReportConfig config) {
        try {
            JsonObject input = new JsonObject();
            input.addProperty("backup_warn_days", config.backupWarnDays());
            input.addProperty("disk_warn_pct", config.diskWarnPct());
            input.addProperty("lookback_hours", config.lookbackHours());
            input.addProperty("backup_tracking_enabled", config.backupTrackingEnabled());

            if (optional != null) {
                if (optional.has("last_backup") && optional.get("last_backup").isJsonObject()) {
                    input.add("last_backup", optional.getAsJsonObject("last_backup").deepCopy());
                }
                if (optional.has("backup_external") && optional.get("backup_external").isJsonObject()) {
                    input.add("backup_external", optional.getAsJsonObject("backup_external").deepCopy());
                }
                if (optional.has("chunky_pregen") && optional.get("chunky_pregen").isJsonObject()) {
                    input.add("chunky_pregen", optional.getAsJsonObject("chunky_pregen").deepCopy());
                }
                if (optional.has("dh_pregen") && optional.get("dh_pregen").isJsonObject()) {
                    input.add("dh_pregen", optional.getAsJsonObject("dh_pregen").deepCopy());
                }
            }
            if (opsCache != null) {
                if (opsCache.has(OpsCacheSchema.BACKUPS_LIVE) && opsCache.get(OpsCacheSchema.BACKUPS_LIVE).isJsonObject()) {
                    input.add("backups_live", opsCache.getAsJsonObject(OpsCacheSchema.BACKUPS_LIVE).deepCopy());
                }
                if (opsCache.has(OpsCacheSchema.BACKUP_EXTERNAL)
                        && opsCache.get(OpsCacheSchema.BACKUP_EXTERNAL).isJsonObject()) {
                    input.add("backup_external", opsCache.getAsJsonObject(OpsCacheSchema.BACKUP_EXTERNAL).deepCopy());
                }
            }
            if (meta.has("disk_nudge") && meta.get("disk_nudge").isJsonObject()) {
                input.add("disk_nudge", meta.getAsJsonObject("disk_nudge").deepCopy());
            }
            if (meta.has("scorecard") && meta.get("scorecard").isJsonObject()) {
                JsonObject sc = meta.getAsJsonObject("scorecard");
                if (sc.has("grade")) {
                    input.addProperty("scorecard_grade", sc.get("grade").getAsString());
                }
                if (sc.has("crashes") && sc.get("crashes").isJsonObject()) {
                    input.add("crashes", sc.getAsJsonObject("crashes").deepCopy());
                }
            }

            try {
                JsonObject live = LiveMetricsService.get().getLiveResponse();
                JsonObject latest = live.has("latest") && live.get("latest").isJsonObject()
                        ? live.getAsJsonObject("latest") : live;
                if (latest.has("players_online") && !latest.get("players_online").isJsonNull()) {
                    input.addProperty("players_online", latest.get("players_online").getAsInt());
                }
                if (latest.has("disk_use_pct") && !latest.get("disk_use_pct").isJsonNull()) {
                    input.addProperty("disk_use_pct", latest.get("disk_use_pct").getAsDouble());
                }
                if (live.has("chunky_pregen") && live.get("chunky_pregen").isJsonObject()) {
                    input.add("chunky_pregen", live.getAsJsonObject("chunky_pregen").deepCopy());
                }
                if (live.has("dh_pregen") && live.get("dh_pregen").isJsonObject()) {
                    input.add("dh_pregen", live.getAsJsonObject("dh_pregen").deepCopy());
                }
            } catch (Exception ignored) {
            }

            if (!input.has("disk_use_pct") && systemBasics != null
                    && systemBasics.has("disk_use_pct") && !systemBasics.get("disk_use_pct").isJsonNull()) {
                input.addProperty("disk_use_pct", systemBasics.get("disk_use_pct").getAsDouble());
            }

            if (meta.has("safe_restart") && meta.get("safe_restart").isJsonObject()) {
                input.add("previous", meta.getAsJsonObject("safe_restart").deepCopy());
            }

            meta.add("safe_restart", SafeRestartAdvisor.evaluate(input));
        } catch (Exception ignored) {
            // Non-fatal: Overview card hides when absent
        }
    }

    private int scorecardLowTpsThresholdFromConf() {
        if (serverContext == null) {
            return 5;
        }
        try {
            Map<String, String> map = WatchtowerConfWriter.readMap(WatchtowerPaths.confPath(serverContext));
            String raw = map.get("SCORECARD_LOW_TPS_MINUTES_24H");
            if (raw != null && !raw.isBlank()) {
                return Math.max(1, Integer.parseInt(raw.strip()));
            }
        } catch (Exception ignored) {
        }
        return 5;
    }

    private void handlePerformanceRollups(HttpExchange ex) throws IOException {
        if (!"GET".equalsIgnoreCase(ex.getRequestMethod())) {
            send(ex, 405, "text/plain", "Method not allowed");
            return;
        }
        if (!requireApiAuth(ex)) {
            return;
        }
        int hours = 24;
        String q = ex.getRequestURI().getQuery();
        if (q != null) {
            for (String part : q.split("&")) {
                if (part.startsWith("hours=")) {
                    try {
                        hours = Integer.parseInt(part.substring(6));
                    } catch (NumberFormatException ignored) {
                    }
                }
            }
        }
        hours = Math.max(1, Math.min(2160, hours));
        sendJson(ex, 200, LiveMetricsService.get().rollupWriter().buildApiResponse(hours));
    }

    private void handlePerformanceInsights(HttpExchange ex) throws IOException {
        if (!"GET".equalsIgnoreCase(ex.getRequestMethod())) {
            send(ex, 405, "text/plain", "Method not allowed");
            return;
        }
        if (!requireApiAuth(ex)) {
            return;
        }
        if (serverContext == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        String window = parseQueryParam(ex.getRequestURI().getQuery(), "window");
        if (window == null || window.isBlank()) {
            window = "7d";
        }
        try {
            ReportConfig config = ModReportConfig.forServer(serverContext);
            if (!config.l1RollupEnabled()) {
                JsonObject disabled = new JsonObject();
                disabled.addProperty("enabled", false);
                disabled.addProperty("window", window);
                sendJson(ex, 200, disabled);
                return;
            }
            int hours = PerformanceInsightEngine.windowToHours(window);
            Path rollupsPath = WatchtowerPaths.performanceRollupsPath(serverContext);
            List<JsonObject> rows = LiveMetricsService.get().rollupWriter().loadRowsForHours(hours);
            if (rows.isEmpty()) {
                rows = PerformanceRollupWriter.loadRowsFromFile(rollupsPath, hours);
            }
            JsonObject out = PerformanceInsightEngine.analyze(rows, window, config.msptWarn(), config.tpsWarn());
            sendJson(ex, 200, out);
        } catch (Exception e) {
            ModRuntime.logger().warn("Performance insights failed: {}", e.toString());
            JsonObject err = new JsonObject();
            err.addProperty("error", e.getMessage() != null ? e.getMessage() : "insights failed");
            sendJson(ex, 500, err);
        }
    }

    private void handlePerformanceDashboard(HttpExchange ex) throws IOException {
        // Response contract: PerformanceDashboardBuilderTest + PerformanceDashboardBuilder.build
        if (!"GET".equalsIgnoreCase(ex.getRequestMethod())) {
            send(ex, 405, "text/plain", "Method not allowed");
            return;
        }
        if (!requireApiAuth(ex)) {
            return;
        }
        if (serverContext == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        String window = parseQueryParam(ex.getRequestURI().getQuery(), "window");
        if (window == null || window.isBlank()) {
            window = "7d";
        }
        try {
            ReportConfig config = ModReportConfig.forServer(serverContext);
            if (!config.l1RollupEnabled()) {
                JsonObject disabled = new JsonObject();
                disabled.addProperty("enabled", false);
                disabled.addProperty("window", window);
                sendJson(ex, 200, disabled);
                return;
            }
            int hours = PerformanceInsightEngine.windowToHours(window);
            Path rollupsPath = WatchtowerPaths.performanceRollupsPath(serverContext);
            int loadHours = Math.min(hours * 2, config.l1RetentionDays() * 24);
            List<JsonObject> rows = LiveMetricsService.get().rollupWriter().loadRowsForHours(loadHours);
            if (rows.isEmpty()) {
                rows = PerformanceRollupWriter.loadRowsFromFile(rollupsPath, loadHours);
            }

            Path opsCachePath = WatchtowerPaths.opsCachePath(serverContext);
            JsonObject opsCache = OpsCacheReader.load(opsCachePath);
            List<JsonObject> incidents = IncidentReader.listSummaries(
                    WatchtowerPaths.incidentsDir(serverContext), 50);

            JsonObject scorecardPerf = null;
            JsonObject facts = null;
            try {
                Path reportDir = WatchtowerPaths.reportDir(serverContext);
                Path factsPath = ReportArtifactFinder.findLatestFacts(reportDir);
                if (factsPath != null && Files.isRegularFile(factsPath)) {
                    facts = GSON.fromJson(Files.readString(factsPath, StandardCharsets.UTF_8), JsonObject.class);
                }
                JsonObject scorecard = ScorecardBuilder.build(
                        facts,
                        opsCache,
                        rollupsPath,
                        config.tpsWarn(),
                        config.msptWarn(),
                        scorecardLowTpsThresholdFromConf());
                if (scorecard.has("performance")) {
                    scorecardPerf = scorecard.getAsJsonObject("performance");
                }
            } catch (Exception ignored) {
            }

            Double xmxGb = null;
            String xmxSource = null;
            try {
                JsonObject liveResp = LiveMetricsService.get().getLiveResponse();
                if (liveResp != null && liveResp.has("latest") && liveResp.get("latest").isJsonObject()) {
                    JsonObject latest = liveResp.getAsJsonObject("latest");
                    if (latest.has("jvm_health_live") && latest.get("jvm_health_live").isJsonObject()) {
                        JsonObject jh = latest.getAsJsonObject("jvm_health_live");
                        if (jh.has("xmx_gb") && !jh.get("xmx_gb").isJsonNull()) {
                            xmxGb = jh.get("xmx_gb").getAsDouble();
                            xmxSource = "live";
                        } else if (jh.has("heap_max_gb") && !jh.get("heap_max_gb").isJsonNull()) {
                            xmxGb = jh.get("heap_max_gb").getAsDouble();
                            xmxSource = "live";
                        }
                    }
                    if (xmxGb == null && latest.has("heap_mb") && latest.get("heap_mb").isJsonObject()) {
                        JsonObject heap = latest.getAsJsonObject("heap_mb");
                        if (heap.has("max") && !heap.get("max").isJsonNull()) {
                            xmxGb = heap.get("max").getAsDouble() / 1024.0;
                            xmxSource = "live";
                        }
                    }
                }
            } catch (Exception ignored) {
            }
            if (xmxGb == null && facts != null && facts.has("optional") && facts.get("optional").isJsonObject()) {
                JsonObject optional = facts.getAsJsonObject("optional");
                if (optional.has("jvm_health") && optional.get("jvm_health").isJsonObject()) {
                    JsonObject jh = optional.getAsJsonObject("jvm_health");
                    if (jh.has("xmx_gb") && !jh.get("xmx_gb").isJsonNull()) {
                        xmxGb = jh.get("xmx_gb").getAsDouble();
                        xmxSource = "report";
                    } else if (jh.has("heap_max_gb") && !jh.get("heap_max_gb").isJsonNull()) {
                        xmxGb = jh.get("heap_max_gb").getAsDouble();
                        xmxSource = "report";
                    }
                }
            }

            long windowStart = java.time.Instant.now().getEpochSecond() - (long) hours * 3600L;
            Path statePath = WatchtowerPaths.statePath(serverContext);
            JsonObject perfBaseline = null;
            try {
                boolean critical = false;
                int unreviewed = 0;
                if (scorecardPerf != null) {
                    // scorecard performance block may not carry grade — check full scorecard via ops
                }
                try {
                    JsonObject scorecardFull = ScorecardBuilder.build(
                            facts, opsCache, rollupsPath,
                            config.tpsWarn(), config.msptWarn(), scorecardLowTpsThresholdFromConf());
                    if (scorecardFull.has("grade") && "critical".equalsIgnoreCase(
                            scorecardFull.get("grade").getAsString())) {
                        critical = true;
                    }
                    if (scorecardFull.has("crashes") && scorecardFull.get("crashes").isJsonObject()) {
                        JsonObject cr = scorecardFull.getAsJsonObject("crashes");
                        if (cr.has("unreviewed")) {
                            unreviewed = cr.get("unreviewed").getAsInt();
                        } else if (cr.has("unreviewed_groups")) {
                            unreviewed = cr.get("unreviewed_groups").getAsInt();
                        }
                    }
                } catch (Exception ignored) {
                }
                int healthyStreak = StateManager.getLagHealthyStreak(statePath);
                PerformanceBaselineTracker.maybeAutoCapture(
                        statePath, rows, config.baselineAutoCapture(),
                        healthyStreak, critical, unreviewed);
                perfBaseline = PerformanceBaselineTracker.getBaseline(statePath);
            } catch (Exception e) {
                ModRuntime.logger().debug("Perf baseline auto-capture skipped: {}", e.toString());
            }
            Double diskFreeGb = null;
            Double diskUsePct = null;
            JsonObject storageOptional = null;
            try {
                JsonObject liveResp = LiveMetricsService.get().getLiveResponse();
                if (liveResp != null && liveResp.has("latest") && liveResp.get("latest").isJsonObject()) {
                    JsonObject latest = liveResp.getAsJsonObject("latest");
                    if (latest.has("disk_free_gb") && !latest.get("disk_free_gb").isJsonNull()) {
                        diskFreeGb = latest.get("disk_free_gb").getAsDouble();
                    }
                    if (latest.has("disk_use_pct") && !latest.get("disk_use_pct").isJsonNull()) {
                        diskUsePct = latest.get("disk_use_pct").getAsDouble();
                    }
                }
            } catch (Exception ignoredDisk) {
            }
            if (facts != null && facts.has("optional") && facts.get("optional").isJsonObject()) {
                JsonObject optional = facts.getAsJsonObject("optional");
                if (optional.has("storage") && optional.get("storage").isJsonObject()) {
                    storageOptional = optional.getAsJsonObject("storage");
                }
                if (diskFreeGb == null && optional.has("disk_projection")
                        && optional.get("disk_projection").isJsonObject()) {
                    JsonObject dp = optional.getAsJsonObject("disk_projection");
                    if (dp.has("disk_free_gb") && !dp.get("disk_free_gb").isJsonNull()) {
                        diskFreeGb = dp.get("disk_free_gb").getAsDouble();
                    }
                    if (diskUsePct == null && dp.has("disk_use_pct") && !dp.get("disk_use_pct").isJsonNull()) {
                        diskUsePct = dp.get("disk_use_pct").getAsDouble();
                    }
                }
            }

            PerformanceContext ctx = new PerformanceContext(
                    opsCache, incidents, scorecardPerf, windowStart, xmxGb, xmxSource,
                    perfBaseline, config.baselineRegressionThresholdPct(),
                    diskFreeGb, diskUsePct, storageOptional,
                    config.diskFillWarnDays(), config.diskFillLookbackHours(),
                    config.diskFillMinSpanHours(), config.diskFillOutlierGb(),
                    config.diskIoLatencyWarnMs());
            JsonObject out = PerformanceDashboardBuilder.build(rows, window, config.msptWarn(), config.tpsWarn(), ctx);
            sendJson(ex, 200, out);
        } catch (Exception e) {
            ModRuntime.logger().warn("Performance dashboard failed: {}", e.toString());
            JsonObject err = new JsonObject();
            err.addProperty("error", e.getMessage() != null ? e.getMessage() : "dashboard failed");
            sendJson(ex, 500, err);
        }
    }

    private void handlePerformanceBaseline(HttpExchange ex) throws IOException {
        if (!"POST".equalsIgnoreCase(ex.getRequestMethod())) {
            send(ex, 405, "text/plain", "Method not allowed");
            return;
        }
        if (!requireApiAuth(ex)) {
            return;
        }
        if (serverContext == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        try {
            String body = new String(ex.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
            JsonObject json = body != null && !body.isBlank()
                    ? GSON.fromJson(body, JsonObject.class) : new JsonObject();
            String action = json.has("action") ? json.get("action").getAsString() : "set_now";
            if (!"set_now".equals(action)) {
                JsonObject err = new JsonObject();
                err.addProperty("error", "unsupported action");
                sendJson(ex, 400, err);
                return;
            }
            ReportConfig config = ModReportConfig.forServer(serverContext);
            Path rollupsPath = WatchtowerPaths.performanceRollupsPath(serverContext);
            // Need ≥7d for evaluate(); setBaselineNow still uses last 24h from these rows.
            int loadHours = Math.min(
                    Math.max(PerformanceBaselineTracker.COMPARE_WINDOW_HOURS, 168),
                    config.l1RetentionDays() * 24);
            List<JsonObject> rows = LiveMetricsService.get().rollupWriter().loadRowsForHours(loadHours);
            if (rows.isEmpty()) {
                rows = PerformanceRollupWriter.loadRowsFromFile(rollupsPath, loadHours);
            }
            Path statePath = WatchtowerPaths.statePath(serverContext);
            JsonObject baseline = PerformanceBaselineTracker.setBaselineNow(statePath, rows);
            JsonObject opsCache = OpsCacheReader.load(WatchtowerPaths.opsCachePath(serverContext));
            JsonObject modsInv = opsCache.has(OpsCacheSchema.MODS_INVENTORY)
                    && opsCache.get(OpsCacheSchema.MODS_INVENTORY).isJsonObject()
                    ? opsCache.getAsJsonObject(OpsCacheSchema.MODS_INVENTORY) : null;
            JsonObject eval = PerformanceBaselineTracker.evaluate(
                    baseline, rows, config.baselineRegressionThresholdPct(), modsInv);
            JsonObject out = new JsonObject();
            out.addProperty("ok", true);
            out.add("baseline", baseline);
            out.add("baseline_regression", eval);
            sendJson(ex, 200, out);
        } catch (Exception e) {
            ModRuntime.logger().warn("Performance baseline set failed: {}", e.toString());
            JsonObject err = new JsonObject();
            err.addProperty("error", e.getMessage() != null ? e.getMessage() : "baseline failed");
            sendJson(ex, 500, err);
        }
    }

    private void handlePerformanceExport(HttpExchange ex) throws IOException {
        if (!"GET".equalsIgnoreCase(ex.getRequestMethod())) {
            send(ex, 405, "text/plain", "Method not allowed");
            return;
        }
        if (!requireApiAuth(ex)) {
            return;
        }
        if (serverContext == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        String window = parseQueryParam(ex.getRequestURI().getQuery(), "window");
        if (window == null || window.isBlank()) {
            window = "7d";
        }
        String format = parseQueryParam(ex.getRequestURI().getQuery(), "format");
        if (format != null && !format.isBlank() && !"csv".equalsIgnoreCase(format)) {
            send(ex, 400, "text/plain", "Only format=csv is supported");
            return;
        }
        try {
            ReportConfig config = ModReportConfig.forServer(serverContext);
            int hours = PerformanceInsightEngine.windowToHours(window);
            Path rollupsPath = WatchtowerPaths.performanceRollupsPath(serverContext);
            List<JsonObject> rows = LiveMetricsService.get().rollupWriter().loadRowsForHours(hours);
            if (rows.isEmpty()) {
                rows = PerformanceRollupWriter.loadRowsFromFile(rollupsPath, hours);
            }
            String csv = PerformanceInsightEngine.rowsToCsv(rows);
            String filename = "watchtower-performance-" + window + ".csv";
            Headers h = ex.getResponseHeaders();
            DashboardAuthHttp.applySecurityHeaders(h);
            h.set("Content-Type", "text/csv; charset=utf-8");
            h.set("Content-Disposition", "attachment; filename=\"" + filename + "\"");
            byte[] bytes = csv.getBytes(StandardCharsets.UTF_8);
            ex.sendResponseHeaders(200, bytes.length);
            try (OutputStream os = ex.getResponseBody()) {
                os.write(bytes);
            }
        } catch (Exception e) {
            ModRuntime.logger().warn("Performance export failed: {}", e.toString());
            send(ex, 500, "text/plain", "export failed");
        }
    }

    private static String parseQueryParam(String query, String key) {
        if (query == null) {
            return null;
        }
        for (String part : query.split("&")) {
            if (part.startsWith(key + "=")) {
                return part.substring(key.length() + 1);
            }
        }
        return null;
    }

    private static void applyRssHint(JsonObject meta, ReportConfig config) {
        try {
            JsonObject live = LiveMetricsService.get().getLiveResponse();
            JsonObject latest = live.has("latest") && live.get("latest").isJsonObject()
                    ? live.getAsJsonObject("latest") : live;
            Double rss = latest.has("java_rss_gb") && !latest.get("java_rss_gb").isJsonNull()
                    ? latest.get("java_rss_gb").getAsDouble() : null;
            Double heapMaxGb = null;
            if (latest.has("heap_mb") && latest.get("heap_mb").isJsonObject()) {
                JsonObject heap = latest.getAsJsonObject("heap_mb");
                if (heap.has("max")) {
                    heapMaxGb = heap.get("max").getAsDouble() / 1024.0;
                }
            }
            if (heapMaxGb == null && latest.has("java_xmx_gb") && !latest.get("java_xmx_gb").isJsonNull()) {
                heapMaxGb = latest.get("java_xmx_gb").getAsDouble();
            }
            meta.add("rss_hint", RssHeapEvaluator.evaluate(rss, heapMaxGb, config.rssHeapRatioWarn()));
        } catch (Exception ignored) {
            meta.add("rss_hint", RssHeapEvaluator.evaluate(null, null, config.rssHeapRatioWarn()));
        }
    }

    private void handleSupportCatalog(HttpExchange ex) throws IOException {
        if (!"GET".equalsIgnoreCase(ex.getRequestMethod())) {
            send(ex, 405, "text/plain", "Method not allowed");
            return;
        }
        if (!requireApiAuth(ex)) {
            return;
        }
        if (serverContext == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        ReportConfig config = ModReportConfig.forServer(serverContext);
        Path serverDir = serverContext.serverDirectory();
        Path sparkDir = SparkPaths.uploadDir(serverDir, config);
        if (!SparkPaths.isUnderRoot(serverDir, sparkDir)) {
            sparkDir = serverDir.resolve("watchtower").resolve("spark-upload");
        }
        JsonObject catalog = SupportBundleCatalog.build(new SupportBundleCatalog.Request(
                serverDir,
                WatchtowerPaths.opsCachePath(serverContext),
                WatchtowerPaths.performanceRollupsPath(serverContext),
                WatchtowerPaths.liveHistoryPath(serverContext),
                WatchtowerPaths.snapshotPath(serverContext),
                sparkDir));
        sendJson(ex, 200, catalog);
    }

    private void handleSupportCompose(HttpExchange ex) throws IOException {
        if (!"POST".equalsIgnoreCase(ex.getRequestMethod())) {
            send(ex, 405, "text/plain", "Method not allowed");
            return;
        }
        if (!requireApiAuth(ex)) {
            return;
        }
        if (serverContext == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        Path opsCache = WatchtowerPaths.opsCachePath(serverContext);
        Path rollups = WatchtowerPaths.performanceRollupsPath(serverContext);
        if (!Files.isRegularFile(opsCache) && !Files.isRegularFile(rollups)) {
            JsonObject err = new JsonObject();
            err.addProperty("error", "no_data");
            err.addProperty("message", "No ops-cache yet — wait for background Scanning, then retry Support.");
            sendJson(ex, 404, err);
            return;
        }
        String body = new String(ex.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
        JsonObject json = body != null && !body.isBlank()
                ? GSON.fromJson(body, JsonObject.class) : new JsonObject();
        SupportComposeOptions options = SupportComposeOptions.fromJson(json != null ? json : new JsonObject());
        WatchtowerRuntimeState state = ModRuntime.requireState();
        if (!state.tryBeginReport()) {
            JsonObject busy = new JsonObject();
            busy.addProperty("status", "already_running");
            busy.addProperty("running", true);
            busy.addProperty("mode", "support_compose");
            sendJson(ex, 409, busy);
            return;
        }
        state.setReportStage("compose", "Composing support bundle");
        SupportComposeOptions finalOptions = options;
        serverContext.execute(() -> SupportComposeRunner.continueAfterBegin(
                serverContext, state, msg -> ModRuntime.logger().info("[Watchtower] {}", msg), false, finalOptions));
        JsonObject ok = new JsonObject();
        ok.addProperty("status", "started");
        ok.addProperty("mode", "support_compose");
        ok.addProperty("running", true);
        ok.addProperty("preset", options.preset().name());
        ok.addProperty("message", "Composing support bundle. Poll /api/reports/status, then GET /api/support/bundle.");
        sendJson(ex, 202, ok);
    }

    private void handleSupportBundle(HttpExchange ex) throws IOException {
        if (!"GET".equalsIgnoreCase(ex.getRequestMethod())) {
            send(ex, 405, "text/plain", "Method not allowed");
            return;
        }
        if (!requireApiAuth(ex)) {
            return;
        }
        if (serverContext == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        WatchtowerRuntimeState state = ModRuntime.requireState();
        if (state.isReportRunning()) {
            JsonObject err = new JsonObject();
            err.addProperty("error", "compose_running");
            err.addProperty("message", "Support compose still running — wait for zip_ready.");
            sendJson(ex, 409, err);
            return;
        }
        Path zipPath = resolveSupportZipDownload(ex, state);
        if (zipPath == null || !Files.isRegularFile(zipPath)) {
            JsonObject err = new JsonObject();
            err.addProperty("error", "not_ready");
            err.addProperty("message", "No support zip ready — POST /api/support/compose first.");
            sendJson(ex, 404, err);
            return;
        }
        long size = Files.size(zipPath);
        Headers h = ex.getResponseHeaders();
        DashboardAuthHttp.applySecurityHeaders(h);
        h.set("Content-Type", "application/zip");
        h.set("Content-Disposition", "attachment; filename=\"" + zipPath.getFileName() + "\"");
        ex.sendResponseHeaders(200, size);
        try (InputStream in = Files.newInputStream(zipPath); OutputStream os = ex.getResponseBody()) {
            in.transferTo(os);
        }
    }

    private Path resolveSupportZipDownload(HttpExchange ex, WatchtowerRuntimeState state) {
        Path reportDir = WatchtowerPaths.reportDir(serverContext);
        String query = ex.getRequestURI().getQuery();
        String requested = null;
        if (query != null) {
            for (String part : query.split("&")) {
                int eq = part.indexOf('=');
                if (eq > 0 && "path".equals(part.substring(0, eq))) {
                    requested = URLDecoder.decode(part.substring(eq + 1), StandardCharsets.UTF_8);
                }
            }
        }
        if (requested != null && !requested.isBlank()) {
            String bare = Path.of(requested).getFileName().toString();
            if (!SupportSafePaths.isSafeBasename(bare) || !bare.startsWith("watchtower-support-") || !bare.endsWith(".zip")) {
                return null;
            }
            return SupportSafePaths.resolveBasename(reportDir, bare);
        }
        String last = state.getLastFullPath();
        if (last != null && !last.isBlank()) {
            Path p = Path.of(last);
            Path bare = SupportSafePaths.resolveBasename(reportDir, p.getFileName().toString());
            if (bare != null && Files.isRegularFile(bare)
                    && bare.getFileName().toString().startsWith("watchtower-support-")) {
                return bare;
            }
        }
        return null;
    }

    private void handleReportsLatest(HttpExchange ex) throws IOException {
        if (!"GET".equalsIgnoreCase(ex.getRequestMethod())) {
            send(ex, 405, "text/plain", "Method not allowed");
            return;
        }
        if (!requireApiAuth(ex)) {
            return;
        }
        if (serverContext == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        Path facts = findLatestFacts(WatchtowerPaths.reportDir(serverContext));
        if (facts == null) {
            JsonObject empty = new JsonObject();
            empty.addProperty("error", "no_report");
            sendJson(ex, 404, empty);
            return;
        }
        Path brief = Path.of(facts.toString().replace("facts-", "brief-").replace(".json", ".txt"));
        if (!Files.isRegularFile(brief)) {
            brief = null;
        }
        JsonObject out = new JsonObject();
        out.addProperty("facts_path", facts.toString());
        out.add("facts", GSON.fromJson(Files.readString(facts), JsonObject.class));
        if (brief != null) {
            out.addProperty("brief_path", brief.toString());
            out.addProperty("brief", Files.readString(brief));
        }
        sendJson(ex, 200, out);
    }

    private void handleReportsIndex(HttpExchange ex) throws IOException {
        if (!"GET".equalsIgnoreCase(ex.getRequestMethod())) {
            send(ex, 405, "text/plain", "Method not allowed");
            return;
        }
        if (!requireApiAuth(ex)) {
            return;
        }
        if (serverContext == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        JsonArray reports = new JsonArray();
        Path dir = WatchtowerPaths.reportDir(serverContext);
        // BAU index excludes Support-compose facts (-support-); /api/reports/get may still load by explicit name.
        List<Path> facts = ReportArtifactFinder.listFactsFiles(dir);
        int i = 0;
        for (Path p : facts) {
            JsonObject entry = new JsonObject();
            entry.addProperty("id", i == 0 ? "latest" : "prev-" + i);
            String factsName = p.getFileName().toString();
            entry.addProperty("label", factsName.replace(WatchtowerFiles.FACTS_PREFIX, "").replace(".json", ""));
            entry.addProperty("facts", factsName);
            String briefName = factsName.replace("facts-", "brief-").replace(".json", ".txt");
            entry.addProperty("brief", briefName);
            enrichReportIndexMeta(entry, p);
            reports.add(entry);
            i++;
        }
        JsonObject out = new JsonObject();
        out.add("reports", reports);
        sendJson(ex, 200, out);
    }

    /** Peek-read meta from facts JSON for friendly dashboard labels (no full parse). */
    private static void enrichReportIndexMeta(JsonObject entry, Path factsPath) {
        try {
            JsonObject root = GSON.fromJson(Files.readString(factsPath), JsonObject.class);
            if (root == null || !root.has("meta") || !root.get("meta").isJsonObject()) {
                return;
            }
            JsonObject meta = root.getAsJsonObject("meta");
            copyMetaString(entry, meta, "generated");
            copyMetaString(entry, meta, "window_start");
            if (meta.has("lookback_hours") && !meta.get("lookback_hours").isJsonNull()) {
                entry.addProperty("lookback_hours", meta.get("lookback_hours").getAsInt());
            }
        } catch (IOException | RuntimeException ignored) {
        }
    }

    private static void copyMetaString(JsonObject entry, JsonObject meta, String key) {
        if (meta.has(key) && meta.get(key).isJsonPrimitive()) {
            entry.addProperty(key, meta.get(key).getAsString());
        }
    }

    private void handleReportsGet(HttpExchange ex) throws IOException {
        if (!"GET".equalsIgnoreCase(ex.getRequestMethod())) {
            send(ex, 405, "text/plain", "Method not allowed");
            return;
        }
        if (!requireApiAuth(ex)) {
            return;
        }
        if (serverContext == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        String factsName = null;
        String q = ex.getRequestURI().getQuery();
        if (q != null) {
            for (String part : q.split("&")) {
                if (part.startsWith("facts=")) {
                    factsName = part.substring(6);
                }
            }
        }
        if (factsName == null || factsName.isBlank()) {
            send(ex, 400, "text/plain", "Missing facts parameter");
            return;
        }
        if (!factsName.startsWith(WatchtowerFiles.FACTS_PREFIX) || !factsName.endsWith(".json")) {
            send(ex, 400, "text/plain", "Invalid facts filename");
            return;
        }
        Path dir = WatchtowerPaths.reportDir(serverContext);
        Path facts = dir.resolve(factsName).normalize();
        if (!facts.startsWith(dir) || !Files.isRegularFile(facts)) {
            send(ex, 404, "text/plain", "Report not found");
            return;
        }
        Path brief = Path.of(facts.toString().replace("facts-", "brief-").replace(".json", ".txt"));
        if (!Files.isRegularFile(brief)) {
            brief = null;
        }
        JsonObject out = new JsonObject();
        out.addProperty("facts_path", facts.toString());
        out.add("facts", GSON.fromJson(Files.readString(facts), JsonObject.class));
        if (brief != null) {
            out.addProperty("brief_path", brief.toString());
            out.addProperty("brief", Files.readString(brief));
        }
        sendJson(ex, 200, out);
    }

    private String resolveHostname() {
        if (serverContext == null) {
            return "server";
        }
        try {
            Path facts = findLatestFacts(WatchtowerPaths.reportDir(serverContext));
            if (facts != null) {
                JsonObject meta = GSON.fromJson(Files.readString(facts), JsonObject.class)
                        .getAsJsonObject("meta");
                if (meta != null && meta.has("hostname") && !meta.get("hostname").isJsonNull()) {
                    return meta.get("hostname").getAsString();
                }
            }
        } catch (IOException ignored) {
        }
        return serverContext.serverDirectory().getFileName().toString();
    }

    private void handleReportsStatus(HttpExchange ex) throws IOException {
        if (!"GET".equalsIgnoreCase(ex.getRequestMethod())) {
            send(ex, 405, "text/plain", "Method not allowed");
            return;
        }
        if (!requireApiAuth(ex)) {
            return;
        }
        WatchtowerRuntimeState state = ModRuntime.requireState();
        JsonObject out = new JsonObject();
        out.addProperty("running", state.isReportRunning());
        if (state.isReportRunning()) {
            String stage = state.getReportStage();
            if (stage != null && !stage.isBlank()) {
                out.addProperty("stage", stage);
            }
            String stageLabel = state.getReportStageLabel();
            if (stageLabel != null && !stageLabel.isBlank()) {
                out.addProperty("stage_label", stageLabel);
            }
            String stageDetail = state.getReportStageDetail();
            if (stageDetail != null && !stageDetail.isBlank()) {
                out.addProperty("stage_detail", stageDetail);
            }
        }
        state.getLastReportStarted().ifPresent(t -> out.addProperty("started_at", t.toString()));
        state.getLastReportFinished().ifPresent(t -> out.addProperty("finished_at", t.toString()));
        out.addProperty("success", state.isLastReportSuccess());
        out.addProperty("message", state.getLastReportMessage());
        out.addProperty("mode", "support_compose");
        String factsPath = state.getLastFactsPath();
        if (factsPath != null && !factsPath.isBlank()) {
            out.addProperty("facts_path", factsPath);
        }
        String zipPath = state.getLastFullPath();
        boolean zipReady = false;
        if (zipPath != null && !zipPath.isBlank()) {
            out.addProperty("zip_path", zipPath);
            try {
                Path p = Path.of(zipPath);
                zipReady = !state.isReportRunning()
                        && state.isLastReportSuccess()
                        && Files.isRegularFile(p)
                        && p.getFileName().toString().startsWith("watchtower-support-");
            } catch (Exception ignored) {
            }
        }
        out.addProperty("zip_ready", zipReady);
        sendJson(ex, 200, out);
    }

    private void handleActivity(HttpExchange ex) throws IOException {
        if (!"GET".equalsIgnoreCase(ex.getRequestMethod())) {
            send(ex, 405, "text/plain", "Method not allowed");
            return;
        }
        if (!requireApiAuth(ex)) {
            return;
        }
        if (serverContext == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        int hours = parseHoursQuery(ex.getRequestURI().getQuery(), 24);
        int maxHours = ModRuntime.config().liveRetentionHours();
        hours = Math.max(1, Math.min(maxHours, hours));
        long cutoff = Instant.now().getEpochSecond() - (long) hours * 3600L;

        JsonArray events = new JsonArray();
        Set<String> seen = new HashSet<>();

        try {
            JsonObject opsCache = OpsCacheReader.load(WatchtowerPaths.opsCachePath(serverContext));
            if (opsCache.has(OpsCacheSchema.ACTIVITY)) {
                JsonObject activity = opsCache.getAsJsonObject(OpsCacheSchema.ACTIVITY);
                if (activity.has(OpsCacheSchema.ACTIVITY_EVENTS)) {
                    for (JsonElement el : activity.getAsJsonArray(OpsCacheSchema.ACTIVITY_EVENTS)) {
                        if (!el.isJsonObject()) {
                            continue;
                        }
                        JsonObject ev = el.getAsJsonObject();
                        if (addActivityEventIfInWindow(ev, seen, cutoff)) {
                            events.add(ev.deepCopy());
                        }
                    }
                }
            }
        } catch (IOException ignored) {
        }

        Path dir = WatchtowerPaths.reportDir(serverContext);
        if (Files.isDirectory(dir)) {
            try (Stream<Path> stream = Files.list(dir)) {
                List<Path> facts = stream
                        .filter(p -> p.getFileName().toString().startsWith(WatchtowerFiles.FACTS_PREFIX)
                                && p.getFileName().toString().endsWith(".json"))
                        .toList();
                for (Path p : facts) {
                    try {
                        JsonObject root = GSON.fromJson(Files.readString(p), JsonObject.class);
                        if (!root.has("events")) {
                            continue;
                        }
                        JsonArray arr = root.getAsJsonArray("events");
                        for (var el : arr) {
                            if (!el.isJsonObject()) {
                                continue;
                            }
                            JsonObject ev = el.getAsJsonObject();
                            if (addActivityEventIfInWindow(ev, seen, cutoff)) {
                                events.add(ev.deepCopy());
                            }
                            if (events.size() >= 2000) {
                                break;
                            }
                        }
                    } catch (Exception ignored) {
                    }
                    if (events.size() >= 2000) {
                        break;
                    }
                }
            }
        }

        JsonArray sorted = sortActivityEvents(events);
        JsonObject out = new JsonObject();
        out.add("events", sorted);
        out.addProperty("hours", hours);
        out.addProperty("count", sorted.size());
        try {
            JsonObject opsCache = OpsCacheReader.load(WatchtowerPaths.opsCachePath(serverContext));
            if (opsCache.has(OpsCacheSchema.INCIDENT_STORIES)
                    && opsCache.get(OpsCacheSchema.INCIDENT_STORIES).isJsonArray()) {
                out.add("incident_stories", opsCache.getAsJsonArray(OpsCacheSchema.INCIDENT_STORIES).deepCopy());
            } else {
                out.add("incident_stories", new JsonArray());
            }
        } catch (IOException e) {
            out.add("incident_stories", new JsonArray());
        }
        sendJson(ex, 200, out);
    }

    private static boolean addActivityEventIfInWindow(JsonObject ev, Set<String> seen, long cutoff) {
        if (!ev.has("time")) {
            return false;
        }
        String timeStr = ev.get("time").getAsString();
        Instant instant = TimeParse.parseTime(timeStr);
        if (instant == null || instant.getEpochSecond() < cutoff) {
            return false;
        }
        String type = ev.has("type") ? ev.get("type").getAsString() : "";
        String detail = ev.has("detail") ? ev.get("detail").getAsString() : "";
        String key = timeStr + "|" + type + "|" + detail;
        return seen.add(key);
    }

    private static JsonArray sortActivityEvents(JsonArray events) {
        JsonArray sorted = new JsonArray();
        List<JsonObject> list = new java.util.ArrayList<>();
        for (var el : events) {
            list.add(el.getAsJsonObject());
        }
        list.sort((a, b) -> {
            Instant ta = a.has("time") ? TimeParse.parseTime(a.get("time").getAsString()) : null;
            Instant tb = b.has("time") ? TimeParse.parseTime(b.get("time").getAsString()) : null;
            if (ta == null || tb == null) {
                return 0;
            }
            return tb.compareTo(ta);
        });
        list.forEach(sorted::add);
        return sorted;
    }

    private void handleConfigAudit(HttpExchange ex) throws IOException {
        if (!"GET".equalsIgnoreCase(ex.getRequestMethod())) {
            send(ex, 405, "text/plain", "Method not allowed");
            return;
        }
        if (!requireApiAuth(ex)) {
            return;
        }
        if (serverContext == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        try {
            ReportConfig config = ModReportConfig.forServer(serverContext);
            if (!config.configAuditEnabled()) {
                JsonObject disabled = new JsonObject();
                disabled.addProperty("status", "disabled");
                disabled.addProperty("read_only", true);
                disabled.addProperty("source", "server.properties");
                disabled.addProperty("path", "server.properties");
                disabled.add("properties", new JsonArray());
                JsonObject summary = new JsonObject();
                summary.addProperty("fine", 0);
                summary.addProperty("consider", 0);
                summary.addProperty("missing", 0);
                disabled.add("summary", summary);
                sendJson(ex, 200, disabled);
                return;
            }
            ServerPropertiesReader.Result props = ServerPropertiesReader.read(serverContext.serverDirectory());
            JsonObject jvmHealth = null;
            try {
                JsonObject live = LiveMetricsService.get().getLiveResponse();
                if (live != null && live.has("latest") && live.get("latest").isJsonObject()) {
                    JsonObject latest = live.getAsJsonObject("latest");
                    if (latest.has("jvm_health_live") && latest.get("jvm_health_live").isJsonObject()) {
                        jvmHealth = latest.getAsJsonObject("jvm_health_live");
                    }
                }
            } catch (Exception ignored) {
            }
            if (jvmHealth == null) {
                try {
                    Path factsPath = findLatestFacts(WatchtowerPaths.reportDir(serverContext));
                    if (factsPath != null && Files.isRegularFile(factsPath)) {
                        JsonObject root = GSON.fromJson(Files.readString(factsPath), JsonObject.class);
                        if (root != null && root.has("optional") && root.get("optional").isJsonObject()) {
                            JsonObject optional = root.getAsJsonObject("optional");
                            if (optional.has("jvm_health") && optional.get("jvm_health").isJsonObject()) {
                                jvmHealth = optional.getAsJsonObject("jvm_health");
                            }
                        }
                    }
                } catch (Exception ignored) {
                }
            }
            sendJson(ex, 200, ConfigLaunchAdvisor.build(props, jvmHealth));
        } catch (Exception e) {
            ModRuntime.logger().warn("Config audit failed: {}", e.toString());
            JsonObject err = new JsonObject();
            err.addProperty("status", "unavailable");
            err.addProperty("read_only", true);
            err.addProperty("detail", e.getMessage() != null ? e.getMessage() : "Config audit failed");
            err.add("properties", new JsonArray());
            sendJson(ex, 200, err);
        }
    }

    private void handleWeeklyDigest(HttpExchange ex) throws IOException {
        String method = ex.getRequestMethod();
        if (!"GET".equalsIgnoreCase(method) && !"POST".equalsIgnoreCase(method)) {
            send(ex, 405, "text/plain", "Method not allowed");
            return;
        }
        if (!requireApiAuth(ex)) {
            return;
        }
        if (serverContext == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        if ("GET".equalsIgnoreCase(method)) {
            try {
                JsonObject opsCache = OpsCacheReader.load(WatchtowerPaths.opsCachePath(serverContext));
                if (opsCache.has(OpsCacheSchema.WEEKLY_DIGEST)
                        && opsCache.get(OpsCacheSchema.WEEKLY_DIGEST).isJsonObject()) {
                    sendJson(ex, 200, opsCache.getAsJsonObject(OpsCacheSchema.WEEKLY_DIGEST).deepCopy());
                } else {
                    JsonObject empty = new JsonObject();
                    empty.add("history", new JsonArray());
                    sendJson(ex, 200, empty);
                }
            } catch (IOException e) {
                JsonObject empty = new JsonObject();
                empty.add("history", new JsonArray());
                sendJson(ex, 200, empty);
            }
            return;
        }
        try {
            String body = new String(ex.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
            JsonObject json = body != null && !body.isBlank()
                    ? GSON.fromJson(body, JsonObject.class) : new JsonObject();
            String action = json != null && json.has("action") ? json.get("action").getAsString() : "";
            if (!"generate_now".equals(action)) {
                JsonObject err = new JsonObject();
                err.addProperty("ok", false);
                err.addProperty("error", "unsupported action");
                sendJson(ex, 400, err);
                return;
            }
            ReportConfig config = ModReportConfig.forServer(serverContext);
            if (!config.weeklyDigestEnabled()) {
                JsonObject err = new JsonObject();
                err.addProperty("ok", false);
                err.addProperty("reason", "disabled");
                sendJson(ex, 409, err);
                return;
            }
            JsonObject entry = OpsScanService.buildWeeklyDigest(serverContext, "manual");
            if (entry == null) {
                JsonObject err = new JsonObject();
                err.addProperty("ok", false);
                err.addProperty("reason", "disabled");
                sendJson(ex, 409, err);
                return;
            }
            JsonObject out = new JsonObject();
            out.addProperty("ok", true);
            out.add("digest", entry);
            sendJson(ex, 200, out);
        } catch (Exception e) {
            ModRuntime.logger().warn("Weekly digest generate failed: {}", e.toString());
            JsonObject err = new JsonObject();
            err.addProperty("ok", false);
            err.addProperty("error", e.getMessage() != null ? e.getMessage() : "digest failed");
            sendJson(ex, 500, err);
        }
    }

    private void handleOnboardingAudit(HttpExchange ex) throws IOException {
        if (!"POST".equalsIgnoreCase(ex.getRequestMethod())) {
            send(ex, 405, "text/plain", "Method not allowed");
            return;
        }
        if (!requireApiAuth(ex)) {
            return;
        }
        if (serverContext == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        // Alias: kick Initial discovery (wizard uses /discovery/* for progress).
        WatchtowerRuntimeState state = ModRuntime.requireState();
        if (!state.tryBeginDiscovery()) {
            JsonObject busy = new JsonObject();
            busy.addProperty("phase", "discovery");
            busy.addProperty("status", "already_running");
            busy.addProperty("running", true);
            sendJson(ex, 409, busy);
            return;
        }
        serverContext.execute(() -> InitialDiscoveryRunner.continueAfterBegin(
                serverContext, state, msg -> ModRuntime.logger().info("[Watchtower] {}", msg)));
        JsonObject out = new JsonObject();
        out.addProperty("phase", "discovery");
        out.addProperty("status", "started");
        out.addProperty("running", true);
        out.addProperty("message",
                "Initial deep audit started — poll GET /api/onboarding/discovery/status");
        sendJson(ex, 202, out);
    }

    private void handleDiscoveryStart(HttpExchange ex) throws IOException {
        if (!"POST".equalsIgnoreCase(ex.getRequestMethod())) {
            send(ex, 405, "text/plain", "Method not allowed");
            return;
        }
        if (!requireApiAuth(ex)) {
            return;
        }
        if (serverContext == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        WatchtowerRuntimeState state = ModRuntime.requireState();
        if (!state.tryBeginDiscovery()) {
            JsonObject busy = new JsonObject();
            busy.addProperty("status", "already_running");
            busy.addProperty("running", true);
            sendJson(ex, 409, busy);
            return;
        }
        serverContext.execute(() -> InitialDiscoveryRunner.continueAfterBegin(
                serverContext, state, msg -> ModRuntime.logger().info("[Watchtower] {}", msg)));
        JsonObject ok = new JsonObject();
        ok.addProperty("status", "started");
        ok.addProperty("running", true);
        ok.addProperty("message",
                "Initial deep audit started — building baseline facts for the dashboard.");
        sendJson(ex, 202, ok);
    }

    private void handleDiscoveryStatus(HttpExchange ex) throws IOException {
        if (!"GET".equalsIgnoreCase(ex.getRequestMethod())) {
            send(ex, 405, "text/plain", "Method not allowed");
            return;
        }
        if (!requireApiAuth(ex)) {
            return;
        }
        WatchtowerRuntimeState state = ModRuntime.requireState();
        Path statusFile = serverContext != null
                ? WatchtowerPaths.watchtowerRoot(serverContext).resolve(InitialDiscoveryRunner.STATUS_FILENAME)
                : null;
        sendJson(ex, 200, InitialDiscoveryRunner.buildLiveStatus(state, statusFile));
    }

    private void handleActivityScan(HttpExchange ex) throws IOException {
        if (!"POST".equalsIgnoreCase(ex.getRequestMethod())) {
            send(ex, 405, "text/plain", "Method not allowed");
            return;
        }
        if (!requireApiAuth(ex)) {
            return;
        }
        if (serverContext == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        try {
            ActivityLedgerScanner.ScanResult scan = OpsScanService.scanActivity(serverContext);
            JsonObject out = new JsonObject();
            out.addProperty("scanned_at", scan.scannedAt().toString());
            out.addProperty("new_count", scan.newCount());
            JsonArray events = new JsonArray();
            scan.events().forEach(events::add);
            out.add("events", events);
            sendJson(ex, 200, out);
        } catch (Exception e) {
            ModRuntime.logger().warn("Activity scan failed: {}", e.toString());
            JsonObject err = new JsonObject();
            err.addProperty("error", e.getMessage() != null ? e.getMessage() : "scan failed");
            sendJson(ex, 500, err);
        }
    }

    private void handleIncidents(HttpExchange ex) throws IOException {
        if (!"GET".equalsIgnoreCase(ex.getRequestMethod())) {
            send(ex, 405, "text/plain", "Method not allowed");
            return;
        }
        if (!requireApiAuth(ex)) {
            return;
        }
        if (serverContext == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        JsonObject out = new JsonObject();
        out.add("incidents", IncidentReader.toJsonArray(
                IncidentReader.listSummaries(WatchtowerPaths.incidentsDir(serverContext), 50)));
        sendJson(ex, 200, out);
    }

    private void handleIncidentGet(HttpExchange ex) throws IOException {
        if (!"GET".equalsIgnoreCase(ex.getRequestMethod())) {
            send(ex, 405, "text/plain", "Method not allowed");
            return;
        }
        if (!requireApiAuth(ex)) {
            return;
        }
        if (serverContext == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        String id = parseQueryParam(ex.getRequestURI().getQuery(), "id");
        JsonObject incident = IncidentReader.loadById(WatchtowerPaths.incidentsDir(serverContext), id);
        if (incident == null) {
            send(ex, 404, "text/plain", "Incident not found");
            return;
        }
        sendJson(ex, 200, incident);
    }

    private void handleIncidentPin(HttpExchange ex) throws IOException {
        if (!"POST".equalsIgnoreCase(ex.getRequestMethod())) {
            send(ex, 405, "text/plain", "Method not allowed");
            return;
        }
        if (!requireApiAuth(ex)) {
            return;
        }
        if (serverContext == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        String note = null;
        try {
            String body = new String(ex.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
            if (!body.isBlank()) {
                JsonObject json = GSON.fromJson(body, JsonObject.class);
                if (json.has("note") && !json.get("note").isJsonNull()) {
                    note = json.get("note").getAsString();
                }
            }
        } catch (Exception ignored) {
        }
        JsonObject incident = OpsScanService.buildManualIncident(serverContext, note, "manual");
        OpsScanService.writeIncident(serverContext, incident);
        JsonObject out = new JsonObject();
        out.addProperty("id", incident.get("id").getAsString());
        out.add("incident", incident);
        sendJson(ex, 200, out);
    }

    private void handleIssuesPeek(HttpExchange ex) throws IOException {
        if (!"GET".equalsIgnoreCase(ex.getRequestMethod())) {
            send(ex, 405, "text/plain", "Method not allowed");
            return;
        }
        if (!requireApiAuth(ex)) {
            return;
        }
        if (serverContext == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        JsonObject opsCache = OpsCacheReader.load(WatchtowerPaths.opsCachePath(serverContext));
        JsonObject out = new JsonObject();
        out.addProperty("source", "ops_cache");
        JsonArray lagIssues = new JsonArray();
        if (opsCache.has(OpsCacheSchema.LAG_ISSUES)) {
            JsonObject block = opsCache.getAsJsonObject(OpsCacheSchema.LAG_ISSUES);
            if (block.has(OpsCacheSchema.LAG_ISSUES_ENTRIES)) {
                for (JsonElement el : block.getAsJsonArray(OpsCacheSchema.LAG_ISSUES_ENTRIES)) {
                    lagIssues.add(el.deepCopy());
                }
            }
        }
        out.add("lag_issues", lagIssues);
        JsonArray modIssues = new JsonArray();
        if (opsCache.has(OpsCacheSchema.MOD_ISSUES)) {
            JsonObject block = opsCache.getAsJsonObject(OpsCacheSchema.MOD_ISSUES);
            if (block.has(OpsCacheSchema.MOD_ISSUES_ENTRIES)) {
                for (JsonElement el : block.getAsJsonArray(OpsCacheSchema.MOD_ISSUES_ENTRIES)) {
                    modIssues.add(el.deepCopy());
                }
            }
        }
        out.add("mod_issues", modIssues);
        if (opsCache.has(OpsCacheSchema.LOG_STALE)) {
            JsonObject ls = opsCache.getAsJsonObject(OpsCacheSchema.LOG_STALE);
            if (ls.has("active") && ls.get("active").getAsBoolean()) {
                JsonObject entry = ls.deepCopy();
                entry.addProperty("id", "LOG_STALE");
                entry.addProperty("title", "Log output stale");
                entry.addProperty("severity", "warning");
                if (ls.has("gap_minutes")) {
                    double gap = ls.get("gap_minutes").getAsDouble();
                    entry.addProperty("narrative",
                            String.format("%.0f minutes since latest.log was last written", gap));
                }
                out.add("log_stale", entry);
            }
        }
        out.addProperty("stale_report", ModRuntime.requireState().getLastReportFinished().isEmpty());
        sendJson(ex, 200, out);
    }

    private void handleIssueAcks(HttpExchange ex) throws IOException {
        if (!"GET".equalsIgnoreCase(ex.getRequestMethod())) {
            send(ex, 405, "text/plain", "Method not allowed");
            return;
        }
        if (!requireApiAuth(ex)) {
            return;
        }
        if (serverContext == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        JsonObject acks = StateManager.getAcknowledgedIssues(WatchtowerPaths.statePath(serverContext));
        JsonObject out = new JsonObject();
        out.add("acknowledged_issues", acks);
        sendJson(ex, 200, out);
    }

    private void handleIssueAck(HttpExchange ex) throws IOException {
        if (!"POST".equalsIgnoreCase(ex.getRequestMethod())) {
            send(ex, 405, "text/plain", "Method not allowed");
            return;
        }
        if (!requireApiAuth(ex)) {
            return;
        }
        if (serverContext == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        String body = new String(ex.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
        JsonObject json = body != null && !body.isBlank()
                ? GSON.fromJson(body, JsonObject.class) : new JsonObject();
        String id = json.has("id") && !json.get("id").isJsonNull()
                ? json.get("id").getAsString() : null;
        if (id == null || id.isBlank()) {
            send(ex, 400, "text/plain", "Missing id");
            return;
        }
        boolean reviewed = !json.has("reviewed") || json.get("reviewed").getAsBoolean();
        Path statePath = WatchtowerPaths.statePath(serverContext);
        if (reviewed) {
            StateManager.acknowledgeIssue(statePath, id, Instant.now(), DashboardAuthHttp.actorOf(ex));
        } else {
            StateManager.unacknowledgeIssue(statePath, id);
        }
        DashboardAudit.record(reviewed ? "issue_acked" : "issue_unacked",
                DashboardAuthHttp.sessionOf(ex), id, null, DashboardAuthHttp.clientIp(ex));
        syncIssuesLiveAck(id, reviewed);
        JsonObject out = new JsonObject();
        out.addProperty("ok", true);
        out.add("acknowledged_issues", StateManager.getAcknowledgedIssues(statePath));
        sendJson(ex, 200, out);
    }

    private void syncIssuesLiveAck(String id, boolean reviewed) {
        if (serverContext == null || id == null || id.isBlank()) {
            return;
        }
        try {
            Path opsCachePath = WatchtowerPaths.opsCachePath(serverContext);
            Path statePath = WatchtowerPaths.statePath(serverContext);
            String ledgerId = IssuesLiveStore.canonicalIssueKey(id);
            if (ledgerId.isBlank()) {
                return;
            }
            synchronized (dev.mcstatus.watchtower.core.util.WatchtowerPathLocks.lockFor(opsCachePath)) {
                JsonObject cache = OpsCacheReader.load(opsCachePath);
                List<IssuesLiveRecord> existing = IssuesLiveStore.readAll(cache);
                String now = Instant.now().toString();
                List<IssuesLiveRecord> next;
                if (reviewed) {
                    next = IssuesLiveStore.markReviewed(existing, ledgerId, now);
                } else {
                    next = new ArrayList<>();
                    String nk = ledgerId.trim().toUpperCase(java.util.Locale.ROOT);
                    boolean found = false;
                    for (IssuesLiveRecord r : existing) {
                        if (r.normalizedKey().equals(nk) || r.id().equalsIgnoreCase(ledgerId)) {
                            found = true;
                            next.add(r.toBuilder()
                                    .status(IssuesLiveSchema.STATUS_OPEN)
                                    .lastSeen(now)
                                    .build());
                        } else {
                            next.add(r);
                        }
                    }
                    if (!found) {
                        next.add(IssuesLiveRecord.builder()
                                .id(ledgerId)
                                .key(ledgerId)
                                .status(IssuesLiveSchema.STATUS_OPEN)
                                .firstSeen(now)
                                .lastSeen(now)
                                .build());
                    }
                }
                IssuesLiveStore.writeAll(cache, next, now);
                cache.addProperty(OpsCacheSchema.SCHEMA_VERSION_KEY, OpsCacheSchema.SCHEMA_VERSION);
                cache.addProperty(OpsCacheSchema.UPDATED_AT, now);
                cache.addProperty(OpsCacheSchema.OPS_CACHE_SEQ, StateManager.incrementOpsCacheSeq(statePath));
                OpsCacheWriter.writeAtomic(opsCachePath, cache);
            }
        } catch (Exception e) {
            ModRuntime.logger().debug("issues_live ack sync failed: {}", e.toString());
        }
    }

    private void handleIssueAckAll(HttpExchange ex) throws IOException {
        if (!"POST".equalsIgnoreCase(ex.getRequestMethod())) {
            send(ex, 405, "text/plain", "Method not allowed");
            return;
        }
        if (!requireApiAuth(ex)) {
            return;
        }
        if (serverContext == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        String body = new String(ex.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
        JsonObject json = body != null && !body.isBlank()
                ? GSON.fromJson(body, JsonObject.class) : new JsonObject();
        List<String> ids = new ArrayList<>();
        if (json.has("ids") && json.get("ids").isJsonArray()) {
            for (JsonElement el : json.getAsJsonArray("ids")) {
                if (el != null && el.isJsonPrimitive()) {
                    String id = el.getAsString();
                    if (id != null && !id.isBlank()) {
                        ids.add(id.trim());
                    }
                }
            }
        }
        Path statePath = WatchtowerPaths.statePath(serverContext);
        int acknowledged = StateManager.acknowledgeAllIssues(
                statePath, ids, Instant.now(), DashboardAuthHttp.actorOf(ex));
        DashboardAudit.record("issue_acked", DashboardAuthHttp.sessionOf(ex),
                null, acknowledged + " issues", DashboardAuthHttp.clientIp(ex));
        for (String id : ids) {
            syncIssuesLiveAck(id, true);
        }
        JsonObject out = new JsonObject();
        out.addProperty("ok", true);
        out.addProperty("acknowledged", acknowledged);
        out.add("acknowledged_issues", StateManager.getAcknowledgedIssues(statePath));
        sendJson(ex, 200, out);
    }

    private void handleIssueSuppressions(HttpExchange ex) throws IOException {
        if (!"GET".equalsIgnoreCase(ex.getRequestMethod())) {
            send(ex, 405, "text/plain", "Method not allowed");
            return;
        }
        if (!requireApiAuth(ex)) {
            return;
        }
        if (serverContext == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        try {
            ReportConfig config = ModReportConfig.forServer(serverContext);
            IssueSuppressionStore store = IssueSuppressionStore.load(
                    WatchtowerPaths.statePath(serverContext),
                    config.issueSuppressions(),
                    config.issueSuppressionRegex());
            sendJson(ex, 200, store.snapshot());
        } catch (Exception e) {
            JsonObject err = new JsonObject();
            err.addProperty("error", e.getMessage() != null ? e.getMessage() : "load failed");
            sendJson(ex, 500, err);
        }
    }

    private void handleIssueSuppress(HttpExchange ex) throws IOException {
        if (!"POST".equalsIgnoreCase(ex.getRequestMethod())) {
            send(ex, 405, "text/plain", "Method not allowed");
            return;
        }
        if (!requireApiAuth(ex)) {
            return;
        }
        if (serverContext == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        String body = new String(ex.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
        if (body.length() > 4096) {
            send(ex, 413, "text/plain", "Payload too large");
            return;
        }
        JsonObject json = body != null && !body.isBlank()
                ? GSON.fromJson(body, JsonObject.class) : new JsonObject();
        String issueId = json.has("issue_id") && !json.get("issue_id").isJsonNull()
                ? json.get("issue_id").getAsString() : null;
        if (issueId == null || issueId.isBlank()) {
            send(ex, 400, "text/plain", "issue_id required");
            return;
        }
        try {
            ReportConfig config = ModReportConfig.forServer(serverContext);
            Path statePath = WatchtowerPaths.statePath(serverContext);
            IssueSuppressionStore store = IssueSuppressionStore.load(
                    statePath, config.issueSuppressions(), config.issueSuppressionRegex());
            store.suppress(issueId.trim(), DashboardAuthHttp.actorOf(ex));
            DashboardAudit.record("issue_suppressed", DashboardAuthHttp.sessionOf(ex),
                    issueId.trim(), null, DashboardAuthHttp.clientIp(ex));
            store = IssueSuppressionStore.load(
                    statePath, config.issueSuppressions(), config.issueSuppressionRegex());
            JsonObject out = new JsonObject();
            out.addProperty("ok", true);
            out.add("suppressions", store.snapshot());
            sendJson(ex, 200, out);
        } catch (Exception e) {
            JsonObject err = new JsonObject();
            err.addProperty("error", e.getMessage() != null ? e.getMessage() : "suppress failed");
            sendJson(ex, 500, err);
        }
    }

    private void handleIssueUnsuppress(HttpExchange ex) throws IOException {
        if (!"POST".equalsIgnoreCase(ex.getRequestMethod())) {
            send(ex, 405, "text/plain", "Method not allowed");
            return;
        }
        if (!requireApiAuth(ex)) {
            return;
        }
        if (serverContext == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        String body = new String(ex.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
        if (body.length() > 4096) {
            send(ex, 413, "text/plain", "Payload too large");
            return;
        }
        JsonObject json = body != null && !body.isBlank()
                ? GSON.fromJson(body, JsonObject.class) : new JsonObject();
        String issueId = json.has("issue_id") && !json.get("issue_id").isJsonNull()
                ? json.get("issue_id").getAsString() : null;
        if (issueId == null || issueId.isBlank()) {
            send(ex, 400, "text/plain", "issue_id required");
            return;
        }
        try {
            ReportConfig config = ModReportConfig.forServer(serverContext);
            Path statePath = WatchtowerPaths.statePath(serverContext);
            IssueSuppressionStore store = IssueSuppressionStore.load(
                    statePath, config.issueSuppressions(), config.issueSuppressionRegex());
            boolean removed = store.unsuppress(issueId.trim());
            DashboardAudit.record("issue_unsuppressed", DashboardAuthHttp.sessionOf(ex),
                    issueId.trim(), null, DashboardAuthHttp.clientIp(ex));
            store = IssueSuppressionStore.load(
                    statePath, config.issueSuppressions(), config.issueSuppressionRegex());
            JsonObject out = new JsonObject();
            out.addProperty("ok", true);
            out.addProperty("removed", removed);
            out.add("suppressions", store.snapshot());
            sendJson(ex, 200, out);
        } catch (Exception e) {
            JsonObject err = new JsonObject();
            err.addProperty("error", e.getMessage() != null ? e.getMessage() : "unsuppress failed");
            sendJson(ex, 500, err);
        }
    }

    private CrashRuleRegistry loadRulesRegistry() throws IOException {
        ReportConfig config = ModReportConfig.forServer(serverContext);
        Path serverDir = serverContext.serverDirectory().toAbsolutePath();
        return CrashRuleRegistry.load(serverDir, config.crashRuleBuiltin(), config.crashRulePacks());
    }

    private void handleRulesList(HttpExchange ex) throws IOException {
        if (!"GET".equalsIgnoreCase(ex.getRequestMethod())) {
            send(ex, 405, "text/plain", "Method not allowed");
            return;
        }
        if (!requireApiAuth(ex)) {
            return;
        }
        if (serverContext == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        try {
            CrashRuleRegistry reg = loadRulesRegistry();
            JsonObject out = new JsonObject();
            JsonArray packs = new JsonArray();
            for (CrashRuleModels.CrashRulePack pack : reg.packs()) {
                JsonObject p = new JsonObject();
                p.addProperty("id", pack.id());
                p.addProperty("name", pack.name());
                p.addProperty("priority", pack.priority());
                p.addProperty("builtin", pack.builtin());
                p.addProperty("source", pack.sourcePath() != null ? pack.sourcePath() : "");
                JsonArray rules = new JsonArray();
                for (CrashRuleModels.CrashRule rule : pack.rules()) {
                    JsonObject r = new JsonObject();
                    r.addProperty("id", rule.id());
                    r.addProperty("priority", rule.priority());
                    if (rule.description() != null) {
                        r.addProperty("description", rule.description());
                    }
                    rules.add(r);
                }
                p.add("rules", rules);
                packs.add(p);
            }
            out.add("packs", packs);
            JsonArray warnings = new JsonArray();
            for (String w : reg.warnings()) {
                warnings.add(w);
            }
            out.add("warnings", warnings);
            sendJson(ex, 200, out);
        } catch (Exception e) {
            JsonObject err = new JsonObject();
            err.addProperty("error", e.getMessage() != null ? e.getMessage() : "rules load failed");
            sendJson(ex, 500, err);
        }
    }

    private void handleRulesGet(HttpExchange ex) throws IOException {
        if (!"GET".equalsIgnoreCase(ex.getRequestMethod())) {
            send(ex, 405, "text/plain", "Method not allowed");
            return;
        }
        if (!requireApiAuth(ex)) {
            return;
        }
        if (serverContext == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        String id = parseQueryParam(ex.getRequestURI().getQuery(), "id");
        if (id == null || id.isBlank()) {
            send(ex, 400, "text/plain", "id required (rule id or packId/ruleId)");
            return;
        }
        try {
            CrashRuleRegistry reg = loadRulesRegistry();
            String packId = null;
            String ruleId = id.trim();
            if (ruleId.contains("/")) {
                int slash = ruleId.indexOf('/');
                packId = ruleId.substring(0, slash);
                ruleId = ruleId.substring(slash + 1);
            }
            CrashRuleRegistry.ResolvedRule rr = reg.findRule(packId, ruleId);
            if (rr == null) {
                send(ex, 404, "text/plain", "Rule not found");
                return;
            }
            JsonObject out = new JsonObject();
            out.addProperty("pack_id", rr.pack().id());
            out.addProperty("pack_name", rr.pack().name());
            out.addProperty("builtin", rr.pack().builtin());
            out.addProperty("rule_id", rr.rule().id());
            out.addProperty("priority", rr.rule().priority());
            if (rr.rule().description() != null) {
                out.addProperty("description", rr.rule().description());
            }
            if (rr.rule().emit() != null) {
                JsonObject emit = new JsonObject();
                CrashRuleModels.EmitSpec e = rr.rule().emit();
                if (e.failureKind() != null) {
                    emit.addProperty("failure_kind", e.failureKind());
                }
                if (e.primaryModId() != null) {
                    emit.addProperty("primary_mod_id", e.primaryModId());
                }
                if (e.confidence() != null) {
                    emit.addProperty("confidence", e.confidence());
                }
                if (e.issueId() != null) {
                    emit.addProperty("issue_id", e.issueId());
                }
                emit.addProperty("override", e.override());
                JsonArray hints = new JsonArray();
                for (String h : e.fixHints()) {
                    hints.add(h);
                }
                emit.add("fix_hints", hints);
                out.add("emit", emit);
            }
            sendJson(ex, 200, out);
        } catch (Exception e) {
            JsonObject err = new JsonObject();
            err.addProperty("error", e.getMessage() != null ? e.getMessage() : "rules get failed");
            sendJson(ex, 500, err);
        }
    }

    private void handleRulesValidate(HttpExchange ex) throws IOException {
        if (!"POST".equalsIgnoreCase(ex.getRequestMethod())) {
            send(ex, 405, "text/plain", "Method not allowed");
            return;
        }
        if (!requireApiAuth(ex)) {
            return;
        }
        String body = new String(ex.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
        if (body.length() > 256_000) {
            send(ex, 413, "text/plain", "Payload too large");
            return;
        }
        String yaml = body;
        try {
            JsonObject json = GSON.fromJson(body, JsonObject.class);
            if (json != null && json.has("yaml") && !json.get("yaml").isJsonNull()) {
                yaml = json.get("yaml").getAsString();
            }
        } catch (Exception ignored) {
            // treat as raw YAML
        }
        CrashRuleValidator.Result result = CrashRuleSchema.validate(yaml != null ? yaml : "");
        JsonObject out = new JsonObject();
        out.addProperty("valid", result.valid());
        JsonArray errors = new JsonArray();
        for (String e : result.errors()) {
            errors.add(e);
        }
        out.add("errors", errors);
        sendJson(ex, 200, out);
    }

    private void handleModsScan(HttpExchange ex) throws IOException {
        if (!"POST".equalsIgnoreCase(ex.getRequestMethod())) {
            send(ex, 405, "text/plain", "Method not allowed");
            return;
        }
        if (!requireApiAuth(ex)) {
            return;
        }
        if (serverContext == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        try {
            dev.mcstatus.watchtower.core.ops.OpsLogTailScanner.ScanResult scan =
                    OpsScanService.scanOpsLog(serverContext);
            JsonArray runningMods = OpsScanService.scanRunningMods(serverContext);
            JsonObject out = new JsonObject();
            out.addProperty("scanned_at", scan.scannedAt().toString());
            out.addProperty("new_mod_error_count", scan.modLogErrors().size());
            out.addProperty("mod_error_count", scan.modLogErrors().size());
            out.addProperty("running_mod_count", runningMods.size());
            out.add("mod_log_errors", scan.modLogErrors().deepCopy());
            out.add("running_mods", runningMods.deepCopy());
            JsonArray kube = new JsonArray();
            scan.kubejsFailures().forEach(kube::add);
            out.add("kubejs_failures", kube);
            sendJson(ex, 200, out);
        } catch (Exception e) {
            ModRuntime.logger().warn("Mod scan failed: {}", e.toString());
            JsonObject err = new JsonObject();
            err.addProperty("error", e.getMessage() != null ? e.getMessage() : "scan failed");
            sendJson(ex, 500, err);
        }
    }

    private void handleModsForensicsStatus(HttpExchange ex) throws IOException {
        if (!"GET".equalsIgnoreCase(ex.getRequestMethod())) {
            send(ex, 405, "text/plain", "Method not allowed");
            return;
        }
        if (!requireApiAuth(ex)) {
            return;
        }
        if (serverContext == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        try {
            ReportConfig config = ModReportConfig.forServer(serverContext);
            JsonObject lastScan = null;
            Path factsPath = findLatestFacts(WatchtowerPaths.reportDir(serverContext));
            if (factsPath != null && Files.isRegularFile(factsPath)) {
                JsonObject facts = GSON.fromJson(Files.readString(factsPath, StandardCharsets.UTF_8), JsonObject.class);
                if (facts != null && facts.has("optional") && facts.get("optional").isJsonObject()) {
                    JsonObject optional = facts.getAsJsonObject("optional");
                    if (optional.has("mod_forensics") && optional.get("mod_forensics").isJsonObject()) {
                        JsonObject mf = optional.getAsJsonObject("mod_forensics");
                        lastScan = new JsonObject();
                        if (mf.has("class_index_built_at")) {
                            lastScan.addProperty("at", mf.get("class_index_built_at").getAsString());
                        }
                        int corrupt = 0;
                        if (mf.has("corrupt_jars") && mf.get("corrupt_jars").isJsonArray()) {
                            corrupt = mf.getAsJsonArray("corrupt_jars").size();
                        }
                        lastScan.addProperty("corrupt_jars", corrupt);
                        int configIssues = 0;
                        if (optional.has("config_health") && optional.get("config_health").isJsonArray()) {
                            configIssues = optional.getAsJsonArray("config_health").size();
                        }
                        lastScan.addProperty("config_issues", configIssues);
                        boolean stderrMerged = mf.has("stderr_sources")
                                && mf.get("stderr_sources").isJsonArray()
                                && mf.getAsJsonArray("stderr_sources").size() > 0;
                        lastScan.addProperty("stderr_merged", stderrMerged);
                    }
                }
            }
            String indexState = ModForensicsCollector.STATE_IDLE;
            String builtAt = null;
            int jarCount = 0;
            int entryCount = 0;
            boolean stale = false;
            if (config.modForensicsScan()) {
                Path modsDir = serverContext.serverDirectory().resolve("mods");
                Path cache = JarClassIndex.defaultCachePath(
                        serverContext.serverDirectory().toAbsolutePath().toString());
                if (cache != null && Files.isRegularFile(cache)) {
                    try {
                        JarClassIndex index = JarClassIndex.loadCached(modsDir, cache);
                        if (index != null) {
                            indexState = ModForensicsCollector.STATE_READY;
                            builtAt = index.stats().builtAt();
                            jarCount = index.stats().jarCount();
                            entryCount = index.stats().entryCount();
                            stale = false;
                        } else {
                            // Cache present but fingerprint mismatch — report stale without jar walk.
                            indexState = ModForensicsCollector.STATE_READY;
                            JarClassIndex.BuildStats peek = JarClassIndex.peekCacheStats(cache);
                            if (peek != null) {
                                builtAt = peek.builtAt();
                                jarCount = peek.jarCount();
                                entryCount = peek.entryCount();
                            }
                            stale = true;
                        }
                    } catch (Exception ignored) {
                        indexState = ModForensicsCollector.STATE_ERROR;
                    }
                }
            } else {
                indexState = ModForensicsCollector.STATE_SKIPPED;
            }
            JsonObject status = ModForensicsCollector.status(
                    config, indexState, builtAt, jarCount, entryCount, stale, lastScan);
            try {
                JsonObject cache = OpsCacheReader.load(WatchtowerPaths.opsCachePath(serverContext));
                if (cache != null && cache.has(OpsCacheSchema.MODS_DEEP)
                        && cache.get(OpsCacheSchema.MODS_DEEP).isJsonObject()) {
                    status.add("mods_deep", cache.getAsJsonObject(OpsCacheSchema.MODS_DEEP).deepCopy());
                }
            } catch (Exception ignored) {
            }
            JsonObject job = ModsDeepJobScheduler.lastStatus();
            if (job != null) {
                status.add("mods_deep_job", job);
            }
            status.addProperty("mods_deep_running", ModsDeepJobScheduler.isRunning());
            if (status.has("config") && status.get("config").isJsonObject()) {
                JsonObject cfg = status.getAsJsonObject("config");
                cfg.addProperty("mods_deep_on_jar_change", config.modsDeepOnJarChange());
                cfg.addProperty("mods_deep_seed_on_boot", config.modsDeepSeedOnBoot());
                cfg.addProperty("mods_deep_max_jars_per_wake", config.modsDeepMaxJarsPerWake());
            }
            sendJson(ex, 200, status);
        } catch (Exception e) {
            ModRuntime.logger().warn("Forensics status failed: {}", e.toString());
            JsonObject err = new JsonObject();
            err.addProperty("error", e.getMessage() != null ? e.getMessage() : "status failed");
            sendJson(ex, 500, err);
        }
    }

    private void handleModsForensicsFindClass(HttpExchange ex) throws IOException {
        if (!"POST".equalsIgnoreCase(ex.getRequestMethod())) {
            send(ex, 405, "text/plain", "Method not allowed");
            return;
        }
        if (!requireApiAuth(ex)) {
            return;
        }
        if (serverContext == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        if (!allowForensicsFind(ex)) {
            send(ex, 429, "text/plain", "Rate limit: 10 find requests per minute");
            return;
        }
        try {
            ReportConfig config = ModReportConfig.forServer(serverContext);
            if (!config.modForensicsScan()) {
                JsonObject skipped = new JsonObject();
                skipped.addProperty("state", ModForensicsCollector.STATE_SKIPPED);
                skipped.addProperty("error", "MOD_FORENSICS_SCAN is disabled");
                skipped.add("matches", new JsonArray());
                sendJson(ex, 503, skipped);
                return;
            }
            String body = new String(ex.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
            JsonObject json = body.isBlank() ? new JsonObject() : GSON.fromJson(body, JsonObject.class);
            String className = json != null && json.has("class") ? json.get("class").getAsString() : null;
            boolean includeNested = json == null || !json.has("include_nested")
                    || json.get("include_nested").getAsBoolean();
            if (className == null || className.isBlank()) {
                send(ex, 400, "text/plain", "class required");
                return;
            }
            Path serverDir = serverContext.serverDirectory().toAbsolutePath();
            Path modsDir = serverDir.resolve("mods");
            Path cache = JarClassIndex.defaultCachePath(serverDir.toString());
            JsonArray mods = ModJarMetadataReader.listModsFromDir(serverDir.toString());
            JsonObject result = ForensicsFindService.findClass(
                    config, modsDir, mods, cache, className, includeNested);
            sendJson(ex, 200, result);
        } catch (Exception e) {
            ModRuntime.logger().warn("Forensics find-class failed: {}", e.toString());
            JsonObject err = new JsonObject();
            err.addProperty("error", e.getMessage() != null ? e.getMessage() : "find-class failed");
            sendJson(ex, 500, err);
        }
    }

    private void handleModsForensicsFindPackage(HttpExchange ex) throws IOException {
        if (!"POST".equalsIgnoreCase(ex.getRequestMethod())) {
            send(ex, 405, "text/plain", "Method not allowed");
            return;
        }
        if (!requireApiAuth(ex)) {
            return;
        }
        if (serverContext == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        if (!allowForensicsFind(ex)) {
            send(ex, 429, "text/plain", "Rate limit: 10 find requests per minute");
            return;
        }
        try {
            ReportConfig config = ModReportConfig.forServer(serverContext);
            if (!config.modForensicsScan()) {
                JsonObject skipped = new JsonObject();
                skipped.addProperty("state", ModForensicsCollector.STATE_SKIPPED);
                skipped.addProperty("error", "MOD_FORENSICS_SCAN is disabled");
                skipped.add("matches", new JsonArray());
                sendJson(ex, 503, skipped);
                return;
            }
            String body = new String(ex.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
            JsonObject json = body.isBlank() ? new JsonObject() : GSON.fromJson(body, JsonObject.class);
            String pkg = json != null && json.has("package") ? json.get("package").getAsString() : null;
            String mode = json != null && json.has("mode") ? json.get("mode").getAsString() : "prefix";
            if (pkg == null || pkg.isBlank()) {
                send(ex, 400, "text/plain", "package required");

                return;
            }
            Path serverDir = serverContext.serverDirectory().toAbsolutePath();
            Path modsDir = serverDir.resolve("mods");
            Path cache = JarClassIndex.defaultCachePath(serverDir.toString());
            JsonArray mods = ModJarMetadataReader.listModsFromDir(serverDir.toString());
            JsonObject result = ForensicsFindService.findPackage(
                    config, modsDir, mods, cache, pkg, mode);
            sendJson(ex, 200, result);
        } catch (Exception e) {
            ModRuntime.logger().warn("Forensics find-package failed: {}", e.toString());

            JsonObject err = new JsonObject();
            err.addProperty("error", e.getMessage() != null ? e.getMessage() : "find-package failed");

            sendJson(ex, 500, err);
        }
    }

    private void handleModsForensicsScanCorrupt(HttpExchange ex) throws IOException {
        if (!"POST".equalsIgnoreCase(ex.getRequestMethod())) {
            send(ex, 405, "text/plain", "Method not allowed");
            return;
        }
        if (!requireApiAuth(ex)) {
            return;
        }
        if (serverContext == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        try {
            ReportConfig config = ModReportConfig.forServer(serverContext);
            if (!config.modForensicsScan()) {
                JsonObject skipped = new JsonObject();
                skipped.addProperty("state", ModForensicsCollector.STATE_SKIPPED);
                skipped.addProperty("error", "MOD_FORENSICS_SCAN is disabled");
                sendJson(ex, 503, skipped);
                return;
            }
            if (!config.forensicsCorruptJarWalk()) {
                JsonObject skipped = new JsonObject();
                skipped.addProperty("state", ModForensicsCollector.STATE_SKIPPED);
                skipped.addProperty("error", "FORENSICS_CORRUPT_JAR_WALK is disabled");
                skipped.add("corrupt", new JsonArray());
                sendJson(ex, 400, skipped);
                return;
            }
            Path modsDir = serverContext.serverDirectory().resolve("mods");
            var hits = CorruptedJarScanner.scanModsDir(modsDir);
            JsonObject out = new JsonObject();
            out.addProperty("scanned", hits.size());
            out.add("corrupt", CorruptedJarScanner.toJson(hits));
            sendJson(ex, 200, out);
        } catch (Exception e) {
            ModRuntime.logger().warn("Forensics scan-corrupt failed: {}", e.toString());
            JsonObject err = new JsonObject();
            err.addProperty("error", e.getMessage() != null ? e.getMessage() : "scan-corrupt failed");
            sendJson(ex, 500, err);
        }
    }

    private void handleModsForensicsConfigHealth(HttpExchange ex) throws IOException {
        if (!"GET".equalsIgnoreCase(ex.getRequestMethod())) {
            send(ex, 405, "text/plain", "Method not allowed");
            return;
        }
        if (!requireApiAuth(ex)) {
            return;
        }
        if (serverContext == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        try {
            ReportConfig config = ModReportConfig.forServer(serverContext);
            if (!config.modForensicsScan()) {
                JsonObject skipped = new JsonObject();
                skipped.addProperty("state", ModForensicsCollector.STATE_SKIPPED);
                skipped.add("issues", new JsonArray());
                sendJson(ex, 503, skipped);
                return;
            }
            Path factsPath = findLatestFacts(WatchtowerPaths.reportDir(serverContext));
            if (factsPath != null && Files.isRegularFile(factsPath)) {
                JsonObject facts = GSON.fromJson(Files.readString(factsPath, StandardCharsets.UTF_8), JsonObject.class);
                if (facts != null && facts.has("optional") && facts.get("optional").isJsonObject()) {
                    JsonObject optional = facts.getAsJsonObject("optional");
                    if (optional.has("config_health") && optional.get("config_health").isJsonArray()) {
                        JsonObject out = new JsonObject();
                        out.addProperty("scanned_at", Instant.now().toString());
                        out.add("issues", optional.getAsJsonArray("config_health").deepCopy());
                        sendJson(ex, 200, out);
                        return;
                    }
                }
            }
            Path serverDir = serverContext.serverDirectory().toAbsolutePath();
            var issues = ConfigHealthScanner.scan(serverDir);
            JsonObject out = new JsonObject();
            out.addProperty("scanned_at", Instant.now().toString());
            out.add("issues", ConfigHealthScanner.toJson(issues));
            sendJson(ex, 200, out);
        } catch (Exception e) {
            ModRuntime.logger().warn("Forensics config-health failed: {}", e.toString());
            JsonObject err = new JsonObject();
            err.addProperty("error", e.getMessage() != null ? e.getMessage() : "config-health failed");
            sendJson(ex, 500, err);
        }
    }

    private boolean allowForensicsFind(HttpExchange ex) {
        String ip = "unknown";
        try {
            if (ex.getRemoteAddress() != null && ex.getRemoteAddress().getAddress() != null) {
                ip = ex.getRemoteAddress().getAddress().getHostAddress();
            }
        } catch (Exception ignored) {
            // keep unknown
        }
        long now = System.currentTimeMillis();
        List<Long> times = forensicsFindRate.computeIfAbsent(ip, k -> new ArrayList<>());
        synchronized (times) {
            times.removeIf(t -> now - t > FORENSICS_FIND_WINDOW_MS);
            if (times.size() >= FORENSICS_FIND_RATE_LIMIT) {
                return false;
            }
            times.add(now);
            return true;
        }
    }

    private void handleModsTree(HttpExchange ex) throws IOException {

        if (!"GET".equalsIgnoreCase(ex.getRequestMethod())) {
            send(ex, 405, "text/plain", "Method not allowed");
            return;
        }
        if (!requireApiAuth(ex)) {
            return;
        }
        if (serverContext == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        String modId = parseQueryParam(ex.getRequestURI().getQuery(), "mod_id");
        if (modId == null || modId.isBlank()) {
            send(ex, 400, "text/plain", "mod_id required");
            return;
        }
        JsonArray mods = null;
        String source = "facts";
        Path factsPath = findLatestFacts(WatchtowerPaths.reportDir(serverContext));
        if (factsPath != null && Files.isRegularFile(factsPath)) {
            try {
                JsonObject facts = GSON.fromJson(Files.readString(factsPath, StandardCharsets.UTF_8), JsonObject.class);
                JsonObject optional = facts != null && facts.has("optional") && facts.get("optional").isJsonObject()
                        ? facts.getAsJsonObject("optional") : null;
                if (optional != null && optional.has("mods") && optional.get("mods").isJsonArray()) {
                    mods = optional.getAsJsonArray("mods");
                }
            } catch (Exception e) {
                ModRuntime.logger().debug("Mods tree facts read failed: {}", e.toString());
            }
        }
        if (mods == null || mods.size() == 0) {
            try {
                JsonObject opsCache = OpsCacheReader.load(WatchtowerPaths.opsCachePath(serverContext));
                mods = OpsModsTreeSource.resolveModsArray(opsCache);
                source = "ops-cache";
            } catch (Exception e) {
                ModRuntime.logger().debug("Mods tree ops-cache read failed: {}", e.toString());
                mods = new JsonArray();
            }
        }
        if (mods == null || mods.size() == 0) {
            JsonObject empty = new JsonObject();
            empty.addProperty("error", "scanning_pending");
            empty.addProperty("message",
                    "No mod dependency data yet — Scanning fills mods_light / running_mods while the server runs.");
            sendJson(ex, 404, empty);
            return;
        }
        try {
            JsonObject match = null;
            for (JsonElement el : mods) {
                if (!el.isJsonObject()) {
                    continue;
                }
                JsonObject mod = el.getAsJsonObject();
                if (modId.equals(mod.has("id") && !mod.get("id").isJsonNull()
                        ? mod.get("id").getAsString() : null)) {
                    match = mod;
                    break;
                }
            }
            if (match == null) {
                JsonObject err = new JsonObject();
                err.addProperty("error", "mod_not_found");
                err.addProperty("message", "Mod not found in Scanning / report data");
                sendJson(ex, 404, err);
                return;
            }
            ModDependencyGraph graph = ModDependencyGraph.fromMods(mods);
            JsonObject out = new JsonObject();
            out.addProperty("mod_id", modId);
            out.addProperty("source", source);
            if (match.has("side_score") && !match.get("side_score").isJsonNull()) {
                out.addProperty("side_score", match.get("side_score").getAsString());
            }
            out.add("dependents", graph.toTree(modId, ModDependencyGraph.Direction.DEPENDENTS, 6));
            out.add("dependencies", graph.toTree(modId, ModDependencyGraph.Direction.DEPENDENCIES, 6));
            sendJson(ex, 200, out);
        } catch (Exception e) {
            ModRuntime.logger().warn("Mods tree failed: {}", e.toString());
            JsonObject err = new JsonObject();
            err.addProperty("error", e.getMessage() != null ? e.getMessage() : "tree failed");
            sendJson(ex, 500, err);
        }
    }

    private static int parseHoursQuery(String q, int defaultHours) {
        if (q == null) {
            return defaultHours;
        }
        for (String part : q.split("&")) {
            if (part.startsWith("hours=")) {
                try {
                    return Integer.parseInt(part.substring(6));
                } catch (NumberFormatException ignored) {
                }
            }
        }
        return defaultHours;
    }

    private void handleReportsRun(HttpExchange ex) throws IOException {
        // Legacy alias for POST /api/support/compose (Quick preset unless body supplies options).
        if (!"POST".equalsIgnoreCase(ex.getRequestMethod())) {
            send(ex, 405, "text/plain", "Method not allowed");
            return;
        }
        if (!requireApiAuth(ex)) {
            return;
        }
        if (serverContext == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        Path opsCache = WatchtowerPaths.opsCachePath(serverContext);
        Path rollups = WatchtowerPaths.performanceRollupsPath(serverContext);
        if (!Files.isRegularFile(opsCache) && !Files.isRegularFile(rollups)) {
            JsonObject err = new JsonObject();
            err.addProperty("error", "no_data");
            err.addProperty("message", "No ops-cache yet — wait for background Scanning, then retry Support.");
            sendJson(ex, 404, err);
            return;
        }
        String body = new String(ex.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
        JsonObject json = body != null && !body.isBlank()
                ? GSON.fromJson(body, JsonObject.class) : new JsonObject();
        SupportComposeOptions options = json != null && json.has("preset")
                ? SupportComposeOptions.fromJson(json)
                : SupportComposeOptions.quickDefaults();
        WatchtowerRuntimeState state = ModRuntime.requireState();
        if (!state.tryBeginReport()) {
            JsonObject busy = new JsonObject();
            busy.addProperty("status", "already_running");
            busy.addProperty("running", true);
            busy.addProperty("mode", "support_compose");
            sendJson(ex, 409, busy);
            return;
        }
        state.setReportStage("compose", "Composing support bundle");
        SupportComposeOptions finalOptions = options;
        serverContext.execute(() -> SupportComposeRunner.continueAfterBegin(
                serverContext, state, msg -> ModRuntime.logger().info("[Watchtower] {}", msg), false, finalOptions));
        JsonObject ok = new JsonObject();
        ok.addProperty("status", "started");
        ok.addProperty("mode", "support_compose");
        ok.addProperty("running", true);
        ok.addProperty("message",
                "Composing support bundle from continuous data. Poll /api/reports/status, then GET /api/support/bundle.");
        sendJson(ex, 202, ok);
    }

    private void handleModrinthStatus(HttpExchange ex) throws IOException {
        if (!"GET".equalsIgnoreCase(ex.getRequestMethod())) {
            send(ex, 405, "text/plain", "Method not allowed");
            return;
        }
        if (!requireApiAuth(ex)) {
            return;
        }
        WatchtowerRuntimeState state = ModRuntime.requireState();
        ReportConfig config = serverContext != null
                ? ModReportConfig.forServer(serverContext, ReportRunOptions.empty())
                : null;
        boolean enabled = config != null && config.modrinthLookup() && !config.disasterRecovery();

        Path statusFile = serverContext != null
                ? WatchtowerPaths.watchtowerRoot(serverContext).resolve(ModrinthScanJob.STATUS_FILENAME)
                : null;
        JsonObject loaded = ModrinthScanJob.loadStatus(statusFile);
        final JsonObject out = (state.getLastModrinthStatus() != null && loaded.entrySet().isEmpty())
                ? state.getLastModrinthStatus().deepCopy()
                : loaded;
        out.addProperty("enabled", enabled);
        out.addProperty("running", state.isModrinthScanRunning());
        if (state.isModrinthScanRunning()) {
            String stage = state.getModrinthStage();
            if (stage != null && !stage.isBlank()) {
                out.addProperty("stage", stage);
            }
            String stageLabel = state.getModrinthStageLabel();
            if (stageLabel != null && !stageLabel.isBlank()) {
                out.addProperty("stage_label", stageLabel);
            }
            String stageDetail = state.getModrinthStageDetail();
            if (stageDetail != null && !stageDetail.isBlank()) {
                out.addProperty("stage_detail", stageDetail);
            }
            JsonObject progress = new JsonObject();
            progress.addProperty("done", state.getModrinthProgressDone());
            progress.addProperty("total", state.getModrinthProgressTotal());
            out.add("progress", progress);
            JsonObject batch = new JsonObject();
            batch.addProperty("index", state.getModrinthBatchIndex());
            batch.addProperty("count", state.getModrinthBatchCount());
            batch.addProperty("size", state.getModrinthBatchSize());
            out.add("batch", batch);
            if (state.getModrinthEtaSeconds() != null) {
                out.addProperty("eta_seconds", state.getModrinthEtaSeconds());
            } else {
                out.add("eta_seconds", com.google.gson.JsonNull.INSTANCE);
            }
            out.add("success", com.google.gson.JsonNull.INSTANCE);
            out.remove("error");
        } else if (out.has("success") && !out.get("success").isJsonNull()) {
            // keep persisted success
        } else {
            out.addProperty("success", state.isLastModrinthScanSuccess());
            String msg = state.getLastModrinthScanMessage();
            if (msg != null && !msg.isBlank() && !state.isLastModrinthScanSuccess()) {
                out.addProperty("error", msg);
            }
        }
        JsonObject lastRun = out.has("last_run") && out.get("last_run").isJsonObject()
                ? out.getAsJsonObject("last_run") : new JsonObject();
        state.getLastModrinthScanStarted().ifPresent(t -> {
            if (!lastRun.has("started_at")) {
                lastRun.addProperty("started_at", t.toString());
            }
        });
        state.getLastModrinthScanFinished().ifPresent(t -> lastRun.addProperty("finished_at", t.toString()));
        if (lastRun.size() > 0) {
            out.add("last_run", lastRun);
        }
        sendJson(ex, 200, out);
    }

    private void handleModrinthScan(HttpExchange ex) throws IOException {
        if (!"POST".equalsIgnoreCase(ex.getRequestMethod())) {
            send(ex, 405, "text/plain", "Method not allowed");
            return;
        }
        if (!requireApiAuth(ex)) {
            return;
        }
        if (serverContext == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        ReportConfig config = ModReportConfig.forServer(serverContext, ReportRunOptions.empty());
        if (!config.modrinthLookup() || config.disasterRecovery()) {
            JsonObject disabled = new JsonObject();
            disabled.addProperty("status", "disabled");
            disabled.addProperty("enabled", false);
            disabled.addProperty("error", "Modrinth lookup is disabled. Enable it in Settings → Monitoring.");
            sendJson(ex, 400, disabled);
            return;
        }
        WatchtowerRuntimeState state = ModRuntime.requireState();
        if (!state.tryBeginModrinthScan()) {
            JsonObject busy = new JsonObject();
            busy.addProperty("status", "already_running");
            busy.addProperty("running", true);
            sendJson(ex, 409, busy);
            return;
        }
        state.setModrinthScanStage("prepare", "Preparing Modrinth scan");
        serverContext.execute(() -> ModrinthScanRunner.continueAfterBegin(
                serverContext,
                ModRuntime.requireState(),
                msg -> ModRuntime.logger().info("[Watchtower] {}", msg)
        ));
        JsonObject ok = new JsonObject();
        ok.addProperty("status", "started");
        ok.addProperty("running", true);
        ok.addProperty("enabled", true);
        ok.addProperty("stage", "prepare");
        ok.addProperty("stage_label", "Preparing Modrinth scan");
        sendJson(ex, 202, ok);
    }

    private void handleCrashAcks(HttpExchange ex) throws IOException {
        if (!"GET".equalsIgnoreCase(ex.getRequestMethod())) {
            send(ex, 405, "text/plain", "Method not allowed");
            return;
        }
        if (!requireApiAuth(ex)) {
            return;
        }
        if (serverContext == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        JsonObject acks = StateManager.getAcknowledgedCrashes(WatchtowerPaths.statePath(serverContext));
        JsonObject out = new JsonObject();
        out.add("acknowledged_crashes", acks);
        sendJson(ex, 200, out);
    }

    private void handleCrashAck(HttpExchange ex) throws IOException {
        if (!"POST".equalsIgnoreCase(ex.getRequestMethod())) {
            send(ex, 405, "text/plain", "Method not allowed");
            return;
        }
        if (!requireApiAuth(ex)) {
            return;
        }
        if (serverContext == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        String body = new String(ex.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
        JsonObject json = body != null && !body.isBlank()
                ? GSON.fromJson(body, JsonObject.class) : new JsonObject();
        String file = json.has("file") && !json.get("file").isJsonNull()
                ? json.get("file").getAsString() : null;
        if (file == null || file.isBlank()) {
            send(ex, 400, "text/plain", "Missing file");
            return;
        }
        boolean reviewed = !json.has("reviewed") || json.get("reviewed").getAsBoolean();
        Path statePath = WatchtowerPaths.statePath(serverContext);
        if (reviewed) {
            String category = json.has("category") && !json.get("category").isJsonNull()
                    ? json.get("category").getAsString() : null;
            String plainEnglish = json.has("plain_english") && !json.get("plain_english").isJsonNull()
                    ? json.get("plain_english").getAsString() : null;
            StateManager.acknowledgeCrash(statePath, file, Instant.now(),
                    DashboardAuthHttp.actorOf(ex), category, plainEnglish);
        } else {
            StateManager.unacknowledgeCrash(statePath, file);
        }
        DashboardAudit.record(reviewed ? "crash_acked" : "crash_unacked",
                DashboardAuthHttp.sessionOf(ex), file, null, DashboardAuthHttp.clientIp(ex));
        try {
            OpsCacheWriter.applyCrashAcks(
                    WatchtowerPaths.opsCachePath(serverContext), statePath);
        } catch (Exception e) {
            ModRuntime.logger().debug("crash ack ops-cache sync failed: {}", e.toString());
        }
        JsonObject out = new JsonObject();
        out.addProperty("ok", true);
        out.add("acknowledged_crashes", StateManager.getAcknowledgedCrashes(statePath));
        sendJson(ex, 200, out);
    }

    private void handleCrashesGrouped(HttpExchange ex) throws IOException {
        if (!"GET".equalsIgnoreCase(ex.getRequestMethod())) {
            send(ex, 405, "text/plain", "Method not allowed");
            return;
        }
        if (!requireApiAuth(ex)) {
            return;
        }
        if (serverContext == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        sendJson(ex, 200, buildGroupedCrashesResponse());
    }

    private void handleCrashAckAll(HttpExchange ex) throws IOException {
        if (!"POST".equalsIgnoreCase(ex.getRequestMethod())) {
            send(ex, 405, "text/plain", "Method not allowed");
            return;
        }
        if (!requireApiAuth(ex)) {
            return;
        }
        if (serverContext == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        String body = new String(ex.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
        JsonObject json = body != null && !body.isBlank()
                ? GSON.fromJson(body, JsonObject.class) : new JsonObject();
        String fingerprint = json.has("fingerprint") && !json.get("fingerprint").isJsonNull()
                ? json.get("fingerprint").getAsString() : null;
        String scope = json.has("scope") && !json.get("scope").isJsonNull()
                ? json.get("scope").getAsString() : "unreviewed";

        Path statePath = WatchtowerPaths.statePath(serverContext);
        JsonObject grouped = buildGroupedCrashesResponse();
        List<String> toAck = new ArrayList<>();
        Map<String, Integer> groupMemberCounts = new HashMap<>();
        if (grouped.has("groups") && grouped.get("groups").isJsonArray()) {
            for (JsonElement gel : grouped.getAsJsonArray("groups")) {
                JsonObject group = gel.getAsJsonObject();
                String fp = group.has("fingerprint") ? group.get("fingerprint").getAsString() : "";
                if (fingerprint != null && !fingerprint.isBlank() && !fingerprint.equals(fp)) {
                    continue;
                }
                if (fingerprint == null && scope != null && !"unreviewed".equalsIgnoreCase(scope)
                        && !"all".equalsIgnoreCase(scope)) {
                    continue;
                }
                int memberAcked = 0;
                if (group.has("members") && group.get("members").isJsonArray()) {
                    for (JsonElement mel : group.getAsJsonArray("members")) {
                        JsonObject member = mel.getAsJsonObject();
                        boolean acknowledged = member.has("acknowledged")
                                && member.get("acknowledged").getAsBoolean();
                        if (acknowledged && (fingerprint == null || !"all".equalsIgnoreCase(scope))) {
                            continue;
                        }
                        String file = member.has("file") ? member.get("file").getAsString() : null;
                        if (file != null && !file.isBlank()) {
                            toAck.add(file);
                            memberAcked++;
                        }
                    }
                }
                if (memberAcked > 0 && fp != null && !fp.isBlank()) {
                    groupMemberCounts.put(fp, memberAcked);
                }
            }
        }

        Instant now = Instant.now();
        int acknowledged = StateManager.acknowledgeAllCrashes(
                statePath, toAck, now, DashboardAuthHttp.actorOf(ex));
        for (Map.Entry<String, Integer> e : groupMemberCounts.entrySet()) {
            StateManager.recordAcknowledgedGroup(
                    statePath, e.getKey(), now, DashboardAuthHttp.actorOf(ex), e.getValue());
        }
        DashboardAudit.record("crash_acked", DashboardAuthHttp.sessionOf(ex),
                null, acknowledged + " crash reports", DashboardAuthHttp.clientIp(ex));
        try {
            OpsCacheWriter.applyCrashAcks(
                    WatchtowerPaths.opsCachePath(serverContext), statePath);
        } catch (Exception e) {
            ModRuntime.logger().debug("crash ack-all ops-cache sync failed: {}", e.toString());
        }

        JsonObject out = buildGroupedCrashesResponse();
        out.addProperty("ok", true);
        out.addProperty("acknowledged", acknowledged);
        out.add("acknowledged_crashes", StateManager.getAcknowledgedCrashes(statePath));
        sendJson(ex, 200, out);
    }

    private void handleInboxGet(HttpExchange ex) throws IOException {
        if (!"GET".equalsIgnoreCase(ex.getRequestMethod())) {
            send(ex, 405, "text/plain", "Method not allowed");
            return;
        }
        if (!requireApiAuth(ex)) {
            return;
        }
        if (serverContext == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        Path statePath = WatchtowerPaths.statePath(serverContext);
        JsonObject dismissals = StateManager.getInboxDismissals(statePath);
        JsonObject grouped = buildGroupedCrashesResponse();
        JsonArray items = new JsonArray();

        if (grouped.has("groups") && grouped.get("groups").isJsonArray()) {
            for (JsonElement gel : grouped.getAsJsonArray("groups")) {
                JsonObject group = gel.getAsJsonObject();
                int unreviewed = group.has("unreviewed") ? group.get("unreviewed").getAsInt() : 0;
                if (unreviewed <= 0) {
                    continue;
                }
                String fp = group.has("fingerprint") ? group.get("fingerprint").getAsString() : "";
                String id = "crash:" + fp;
                if (dismissals.has(id)) {
                    continue;
                }
                String label = group.has("label") ? group.get("label").getAsString() : fp;
                int count = group.has("count") ? group.get("count").getAsInt() : unreviewed;
                String body = inboxBodyFromGroup(group);
                String failureKind = group.has("failure_kind") ? group.get("failure_kind").getAsString() : "";
                String severity = failureKind != null && failureKind.startsWith("watchdog")
                        ? "critical" : "warning";
                JsonObject item = new JsonObject();
                item.addProperty("id", id);
                item.addProperty("kind", "crash_group");
                item.addProperty("title", label + " (" + count + "×)");
                item.addProperty("body", body);
                item.addProperty("severity", severity);
                item.addProperty("href", "?tab=crashes&group=" + URLEncoder.encode(fp, StandardCharsets.UTF_8));
                if (group.has("last_at") && !group.get("last_at").isJsonNull()) {
                    item.addProperty("created_at", group.get("last_at").getAsString());
                }
                JsonObject meta = new JsonObject();
                meta.addProperty("fingerprint", fp);
                meta.addProperty("count", count);
                meta.addProperty("unreviewed", unreviewed);
                item.add("meta", meta);
                items.add(item);
            }
        }

        if (!dismissals.has("update")) {
            try {
                Path conf = WatchtowerPaths.confPath(serverContext);
                Map<String, String> map = WatchtowerConfWriter.readMap(conf);
                ReportConfig config = ModReportConfig.forServer(serverContext);
                boolean enabled = WatchtowerConfWriter.readBool(map, "UPDATE_CHECK", config.updateCheck());
                String version = serverContext.modVersion();
                JsonObject check = ReleaseVersionChecker.check(version, enabled);
                if (check.has("update_available") && check.get("update_available").getAsBoolean()) {
                    String latest = check.has("latest_version")
                            ? check.get("latest_version").getAsString() : "newer";
                    JsonObject item = new JsonObject();
                    item.addProperty("id", "update");
                    item.addProperty("kind", "update_check");
                    item.addProperty("title", "Watchtower update available");
                    item.addProperty("body", "Version " + latest + " is newer than " + version + ".");
                    item.addProperty("severity", "warning");
                    String href = check.has("modrinth_url")
                            ? check.get("modrinth_url").getAsString()
                            : "?tab=settings";
                    item.addProperty("href", href);
                    if (check.has("published_at") && !check.get("published_at").isJsonNull()) {
                        item.addProperty("created_at", check.get("published_at").getAsString());
                    }
                    JsonObject meta = new JsonObject();
                    meta.addProperty("current", version);
                    meta.addProperty("latest_version", latest);
                    item.add("meta", meta);
                    items.add(item);
                }
            } catch (Exception ignored) {
            }
        }

        // Modrinth compatible-update nudges from latest report (link-out only)
        if (items.size() < 20) {
            try {
                Path factsPath = findLatestFacts(WatchtowerPaths.reportDir(serverContext));
                if (factsPath != null) {
                    JsonObject facts = GSON.fromJson(Files.readString(factsPath), JsonObject.class);
                    JsonObject optional = facts.has("optional") && facts.get("optional").isJsonObject()
                            ? facts.getAsJsonObject("optional") : null;
                    if (optional != null && optional.has("modrinth_updates")
                            && optional.get("modrinth_updates").isJsonArray()) {
                        int added = 0;
                        for (JsonElement el : optional.getAsJsonArray("modrinth_updates")) {
                            if (added >= 5 || !el.isJsonObject()) {
                                break;
                            }
                            JsonObject upd = el.getAsJsonObject();
                            String modId = upd.has("mod_id") ? upd.get("mod_id").getAsString() : null;
                            if (modId == null || modId.isBlank()) {
                                continue;
                            }
                            String id = "mod_update:" + modId;
                            if (dismissals.has(id)) {
                                continue;
                            }
                            String titleName = upd.has("title") ? upd.get("title").getAsString() : modId;
                            String latest = upd.has("latest_compatible")
                                    ? upd.get("latest_compatible").getAsString() : null;
                            JsonObject item = new JsonObject();
                            item.addProperty("id", id);
                            item.addProperty("kind", "mod_update");
                            item.addProperty("title", titleName + " update available");
                            item.addProperty("body", latest != null
                                    ? ("NeoForge-compatible build " + latest + " is newer than the installed jar.")
                                    : "A newer loader-compatible build is on Modrinth.");
                            item.addProperty("severity", "info");
                            String href = upd.has("modrinth_compatible_url")
                                    ? upd.get("modrinth_compatible_url").getAsString()
                                    : ("?tab=mods&mod=" + URLEncoder.encode(modId, StandardCharsets.UTF_8));
                            item.addProperty("href", href);
                            JsonObject meta = new JsonObject();
                            meta.addProperty("mod_id", modId);
                            if (latest != null) {
                                meta.addProperty("latest_compatible", latest);
                            }
                            if (upd.has("related_pair") && !upd.get("related_pair").isJsonNull()) {
                                meta.addProperty("related_pair", upd.get("related_pair").getAsString());
                            }
                            item.add("meta", meta);
                            items.add(item);
                            added++;
                        }
                    }
                }
            } catch (Exception ignored) {
            }
        }

        JsonObject out = new JsonObject();
        out.add("items", items);
        sendJson(ex, 200, out);
    }

    private void handleInboxDismiss(HttpExchange ex) throws IOException {
        if (!"POST".equalsIgnoreCase(ex.getRequestMethod())) {
            send(ex, 405, "text/plain", "Method not allowed");
            return;
        }
        if (!requireApiAuth(ex)) {
            return;
        }
        if (serverContext == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        String body = new String(ex.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
        JsonObject json = body != null && !body.isBlank()
                ? GSON.fromJson(body, JsonObject.class) : new JsonObject();
        String id = json.has("id") && !json.get("id").isJsonNull()
                ? json.get("id").getAsString() : null;
        if (id == null || id.isBlank()) {
            send(ex, 400, "text/plain", "Missing id");
            return;
        }
        StateManager.dismissInboxItem(
                WatchtowerPaths.statePath(serverContext), id, Instant.now(), DashboardAuthHttp.actorOf(ex));
        JsonObject out = new JsonObject();
        out.addProperty("ok", true);
        sendJson(ex, 200, out);
    }

    private JsonObject buildGroupedCrashesResponse() throws IOException {
        Path statePath = WatchtowerPaths.statePath(serverContext);
        JsonObject acks = StateManager.getAcknowledgedCrashes(statePath);

        String scannedAt = null;
        JsonArray entries = new JsonArray();
        try {
            JsonObject opsCache = OpsCacheReader.load(WatchtowerPaths.opsCachePath(serverContext));
            if (opsCache.has(OpsCacheSchema.CRASHES)) {
                JsonObject crashes = opsCache.getAsJsonObject(OpsCacheSchema.CRASHES);
                if (crashes.has(OpsCacheSchema.CRASHES_SCANNED_AT)
                        && !crashes.get(OpsCacheSchema.CRASHES_SCANNED_AT).isJsonNull()) {
                    scannedAt = crashes.get(OpsCacheSchema.CRASHES_SCANNED_AT).getAsString();
                }
                if (crashes.has(OpsCacheSchema.CRASHES_ENTRIES)
                        && crashes.get(OpsCacheSchema.CRASHES_ENTRIES).isJsonArray()) {
                    entries = crashes.getAsJsonArray(OpsCacheSchema.CRASHES_ENTRIES);
                }
            }
            appendExternalKillRows(opsCache, entries);
        } catch (IOException ignored) {
        }

        JsonArray summaries = new JsonArray();
        try {
            Path factsPath = findLatestFacts(WatchtowerPaths.reportDir(serverContext));
            if (factsPath != null) {
                JsonObject facts = GSON.fromJson(Files.readString(factsPath), JsonObject.class);
                if (facts.has("optional") && facts.getAsJsonObject("optional").has("crash_summaries")
                        && facts.getAsJsonObject("optional").get("crash_summaries").isJsonArray()) {
                    summaries = facts.getAsJsonObject("optional").getAsJsonArray("crash_summaries");
                }
            }
        } catch (IOException ignored) {
        }

        JsonArray merged = mergeCrashRows(summaries, entries);
        JsonObject grouped = CrashFingerprintGrouper.group(merged, acks);
        JsonObject out = grouped != null ? grouped.deepCopy() : new JsonObject();
        if (scannedAt != null) {
            out.addProperty("scanned_at", scannedAt);
        }
        if (!out.has("count") && out.has("groups") && out.get("groups").isJsonArray()) {
            int count = 0;
            int unreviewed = 0;
            for (JsonElement gel : out.getAsJsonArray("groups")) {
                JsonObject g = gel.getAsJsonObject();
                count += g.has("count") ? g.get("count").getAsInt() : 0;
                unreviewed += g.has("unreviewed") ? g.get("unreviewed").getAsInt() : 0;
            }
            out.addProperty("count", count);
            if (!out.has("unreviewed")) {
                out.addProperty("unreviewed", unreviewed);
            }
        }
        return out;
    }

    /**
     * Append synthetic crash rows from the ops-cache {@code external_kill} block (and its recent history).
     * Built per request so they survive ops polls that rebuild {@code crashes.entries} from files.
     */
    private static void appendExternalKillRows(JsonObject opsCache, JsonArray entries) {
        if (opsCache == null || entries == null) {
            return;
        }
        if (!opsCache.has(OpsCacheSchema.EXTERNAL_KILL)
                || !opsCache.get(OpsCacheSchema.EXTERNAL_KILL).isJsonObject()) {
            return;
        }
        JsonObject ek = opsCache.getAsJsonObject(OpsCacheSchema.EXTERNAL_KILL);
        JsonObject row = externalKillToCrashRow(ek);
        if (row != null) {
            entries.add(row);
        }
        if (ek.has(OpsCacheSchema.EXTERNAL_KILL_RECENT)
                && ek.get(OpsCacheSchema.EXTERNAL_KILL_RECENT).isJsonArray()) {
            for (JsonElement el : ek.getAsJsonArray(OpsCacheSchema.EXTERNAL_KILL_RECENT)) {
                if (!el.isJsonObject()) {
                    continue;
                }
                JsonObject recentRow = externalKillToCrashRow(el.getAsJsonObject());
                if (recentRow != null) {
                    entries.add(recentRow);
                }
            }
        }
    }

    private static JsonObject externalKillToCrashRow(JsonObject ek) {
        if (ek == null || ek.size() == 0) {
            return null;
        }
        String subtype = ek.has("subtype") && !ek.get("subtype").isJsonNull()
                ? ek.get("subtype").getAsString() : "";
        String killedAt = ek.has("killed_at") && !ek.get("killed_at").isJsonNull()
                ? ek.get("killed_at").getAsString() : "";
        if (killedAt.isBlank() && ek.has("detected_at") && !ek.get("detected_at").isJsonNull()) {
            killedAt = ek.get("detected_at").getAsString();
        }
        if (killedAt.isBlank()) {
            return null;
        }
        JsonObject row = new JsonObject();
        row.addProperty("file", "external-kill-" + killedAt);
        long mtime = 0L;
        try {
            mtime = Instant.parse(killedAt).getEpochSecond();
        } catch (Exception ignored) {
        }
        row.addProperty("mtime", mtime);
        row.addProperty("size", 0);
        row.addProperty("source", "external_kill");
        row.addProperty("failure_kind", "external_kill");
        if (ek.has("display_label") && !ek.get("display_label").isJsonNull()) {
            row.add("display_label", ek.get("display_label"));
        }
        if (ek.has("plain_english") && !ek.get("plain_english").isJsonNull()) {
            row.add("plain_english", ek.get("plain_english"));
        }
        if (ek.has("likely_cause") && !ek.get("likely_cause").isJsonNull()) {
            row.add("likely_cause", ek.get("likely_cause"));
        }
        if (ek.has("confidence") && !ek.get("confidence").isJsonNull()) {
            row.add("confidence", ek.get("confidence"));
        }
        if (ek.has("fix_hints") && ek.get("fix_hints").isJsonArray()) {
            row.add("fix_hints", ek.get("fix_hints").deepCopy());
        }
        JsonObject details = new JsonObject();
        if (!subtype.isBlank()) {
            details.addProperty("external_kill_subtype", subtype);
            row.addProperty("subtype", subtype);
        }
        if (ek.has("kernel_log_readable") && !ek.get("kernel_log_readable").isJsonNull()) {
            details.add("kernel_log_readable", ek.get("kernel_log_readable"));
        }
        row.add("details", details);
        return row;
    }

    private static JsonArray mergeCrashRows(JsonArray summaries, JsonArray entries) {
        Map<String, JsonObject> entryByBare = new HashMap<>();
        if (entries != null) {
            for (JsonElement el : entries) {
                if (!el.isJsonObject()) {
                    continue;
                }
                JsonObject row = el.getAsJsonObject();
                String file = row.has("file") ? row.get("file").getAsString() : "";
                if (!file.isBlank()) {
                    entryByBare.put(bareCrashFile(file), row);
                }
            }
        }

        JsonArray out = new JsonArray();
        if (summaries != null && summaries.size() > 0) {
            Set<String> seen = new HashSet<>();
            for (JsonElement el : summaries) {
                if (!el.isJsonObject()) {
                    continue;
                }
                JsonObject row = el.getAsJsonObject().deepCopy();
                String file = row.has("file") ? row.get("file").getAsString() : "";
                String bare = bareCrashFile(file);
                seen.add(bare);
                JsonObject entry = entryByBare.get(bare);
                if (entry != null) {
                    if (entry.has("mtime") && !row.has("mtime")) {
                        row.add("mtime", entry.get("mtime"));
                    }
                    if (entry.has("size") && !row.has("size")) {
                        row.add("size", entry.get("size"));
                    }
                    if (entry.has("display_label") && !row.has("display_label")) {
                        row.add("display_label", entry.get("display_label"));
                    }
                    // Ops Scan enrich wins over weak/missing facts labels (e.g. stuck Unknown).
                    if (isWeakFailureKind(row) && !isWeakFailureKind(entry)) {
                        overlayCrashEnrich(row, entry);
                    } else if (isWeakDisplayLabel(row) && entry.has("display_label")
                            && !entry.get("display_label").isJsonNull()
                            && !entry.get("display_label").getAsString().isBlank()) {
                        row.add("display_label", entry.get("display_label"));
                    }
                }
                out.add(row);
            }
            // Include ops-only crashes not present in facts (continuous enrich of newer files).
            for (Map.Entry<String, JsonObject> e : entryByBare.entrySet()) {
                if (!seen.contains(e.getKey())) {
                    out.add(e.getValue().deepCopy());
                }
            }
            return out;
        }

        if (entries != null) {
            for (JsonElement el : entries) {
                if (el.isJsonObject()) {
                    out.add(el.getAsJsonObject().deepCopy());
                }
            }
        }
        return out;
    }

    private static boolean isWeakFailureKind(JsonObject row) {
        if (row == null || !row.has("failure_kind") || row.get("failure_kind").isJsonNull()) {
            return true;
        }
        String kind = row.get("failure_kind").getAsString();
        return kind == null || kind.isBlank() || "unknown".equalsIgnoreCase(kind);
    }

    private static boolean isWeakDisplayLabel(JsonObject row) {
        if (row == null || !row.has("display_label") || row.get("display_label").isJsonNull()) {
            return true;
        }
        String label = row.get("display_label").getAsString();
        if (label == null || label.isBlank()) {
            return true;
        }
        String lower = label.trim().toLowerCase(Locale.ROOT);
        return "unknown".equals(lower) || "watching server".equals(lower);
    }

    private static void overlayCrashEnrich(JsonObject target, JsonObject entry) {
        for (String key : List.of(
                "failure_kind", "primary_mod_id", "stall_mod_id", "suspect_mod_id",
                "exception", "plain_english", "likely_cause", "confidence", "category",
                "display_label", "fix_hints", "manual_review")) {
            if (entry.has(key) && !entry.get(key).isJsonNull()) {
                if (key.equals("fix_hints") && entry.get(key).isJsonArray()
                        && entry.getAsJsonArray(key).size() == 0) {
                    continue;
                }
                if (entry.get(key).isJsonPrimitive() && entry.get(key).getAsString().isBlank()) {
                    continue;
                }
                target.add(key, entry.get(key));
            }
        }
    }

    private static String bareCrashFile(String crashFile) {
        if (crashFile == null) {
            return "";
        }
        if (crashFile.startsWith("crash-reports/")) {
            return crashFile.substring("crash-reports/".length());
        }
        return crashFile;
    }

    private static String inboxBodyFromGroup(JsonObject group) {
        if (group.has("members") && group.get("members").isJsonArray()
                && group.getAsJsonArray("members").size() > 0) {
            JsonObject member = group.getAsJsonArray("members").get(0).getAsJsonObject();
            for (String key : List.of("plain_english", "display_label", "summary")) {
                if (member.has(key) && !member.get(key).isJsonNull()) {
                    String v = member.get(key).getAsString();
                    if (v != null && !v.isBlank()) {
                        return v.length() > 200 ? v.substring(0, 197) + "…" : v;
                    }
                }
            }
        }
        if (group.has("label") && !group.get("label").isJsonNull()) {
            return group.get("label").getAsString();
        }
        return "Unreviewed crash group";
    }

    private void handleClientModIgnores(HttpExchange ex) throws IOException {
        if (!"GET".equalsIgnoreCase(ex.getRequestMethod())) {
            send(ex, 405, "text/plain", "Method not allowed");
            return;
        }
        if (!requireApiAuth(ex)) {
            return;
        }
        if (serverContext == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        JsonObject ignores = StateManager.getIgnoredClientMods(WatchtowerPaths.statePath(serverContext));
        JsonObject out = new JsonObject();
        out.add("ignored_client_mods", ignores);
        sendJson(ex, 200, out);
    }

    private void handleClientModIgnore(HttpExchange ex) throws IOException {
        if (!"POST".equalsIgnoreCase(ex.getRequestMethod())) {
            send(ex, 405, "text/plain", "Method not allowed");
            return;
        }
        if (!requireApiAuth(ex)) {
            return;
        }
        if (serverContext == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        String body = new String(ex.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
        JsonObject json = body != null && !body.isBlank()
                ? GSON.fromJson(body, JsonObject.class) : new JsonObject();
        String modId = json.has("mod_id") && !json.get("mod_id").isJsonNull()
                ? json.get("mod_id").getAsString() : null;
        if (modId == null || modId.isBlank()) {
            send(ex, 400, "text/plain", "Missing mod_id");
            return;
        }
        boolean ignored = !json.has("ignored") || json.get("ignored").getAsBoolean();
        Path statePath = WatchtowerPaths.statePath(serverContext);
        if (ignored) {
            String note = json.has("note") && !json.get("note").isJsonNull()
                    ? json.get("note").getAsString() : null;
            StateManager.ignoreClientMod(statePath, modId, Instant.now(), DashboardAuthHttp.actorOf(ex), note);
        } else {
            StateManager.unignoreClientMod(statePath, modId);
        }
        JsonObject out = new JsonObject();
        out.addProperty("ok", true);
        out.add("ignored_client_mods", StateManager.getIgnoredClientMods(statePath));
        sendJson(ex, 200, out);
    }

    private void handleBackupScan(HttpExchange ex) throws IOException {
        if (!"POST".equalsIgnoreCase(ex.getRequestMethod())) {
            send(ex, 405, "text/plain", "Method not allowed");
            return;
        }
        if (!requireApiAuth(ex)) {
            return;
        }
        if (serverContext == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        try {
            ReportConfig config = ModReportConfig.forServer(serverContext);
            double cutoff = Instant.now().getEpochSecond()
                    - (long) IssuesLiveEvaluators.BACKUP_FRESH_HOURS * 3600L;
            JsonObject staging = new JsonObject();
            staging.add("optional", new JsonObject());
            CraftyCollector.scanBackups(staging, config.serverDir(), cutoff, config);
            JsonObject optional = staging.getAsJsonObject("optional");
            JsonObject lastBackup = optional.has("last_backup")
                    ? optional.getAsJsonObject("last_backup") : null;
            JsonElement inventory = optional.has("backup_inventory")
                    ? optional.get("backup_inventory") : null;
            OpsCacheWriter.applyBackupsLive(
                    WatchtowerPaths.opsCachePath(serverContext),
                    WatchtowerPaths.statePath(serverContext),
                    lastBackup,
                    inventory);
            OpsScanService.refreshIssuesLive(serverContext);
            JsonObject out = new JsonObject();
            if (lastBackup != null) {
                out.add("last_backup", lastBackup);
            }
            if (inventory != null) {
                out.add("backup_inventory", inventory);
            }
            sendJson(ex, 200, out);
        } catch (Exception e) {
            ModRuntime.logger().warn("Backup scan failed: {}", e.toString());
            JsonObject err = new JsonObject();
            err.addProperty("error", e.getMessage() != null ? e.getMessage() : "scan failed");
            sendJson(ex, 500, err);
        }
    }

    private void handleSparkProfiles(HttpExchange ex) throws IOException {
        if (!"GET".equalsIgnoreCase(ex.getRequestMethod())) {
            send(ex, 405, "text/plain", "Method not allowed");
            return;
        }
        if (!requireApiAuth(ex)) {
            return;
        }
        if (serverContext == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        try {
            ReportConfig config = ModReportConfig.forServer(serverContext);
            Path root = Path.of(config.serverDir()).toAbsolutePath().normalize();
            JsonObject out = new JsonObject();
            out.addProperty("spark_enabled", config.sparkEnabled());
            out.addProperty("enabled", config.sparkEnabled());
            JsonArray searchDirs = new JsonArray();
            for (SparkCollector.SearchDir dir : SparkCollector.searchDirs(root, config)) {
                searchDirs.add(root.relativize(dir.path().toAbsolutePath().normalize()).toString().replace('\\', '/') + "/");
            }
            out.add("search_dirs", searchDirs);
            SparkProfileScan scan = SparkCollector.scanProfiles(config.serverDir(), config);
            JsonArray profiles = new JsonArray();
            SparkProfileEntry newestAuto = null;
            for (SparkProfileEntry entry : scan.profiles()) {
                JsonObject row = entry.toJson();
                boolean autoCaptured = entry.sourceFile().toLowerCase(Locale.ROOT).startsWith("auto-");
                row.addProperty("auto_captured", autoCaptured);
                if (autoCaptured && newestAuto == null) {
                    newestAuto = entry;
                }
                profiles.add(row);
            }
            out.add("profiles", profiles);
            JsonArray skipped = new JsonArray();
            for (SparkSkippedProfile skip : scan.skipped()) {
                skipped.add(skip.toJson());
            }
            out.add("skipped", skipped);
            JsonArray heapArtifacts = new JsonArray();
            SparkHeapCollector.collect(config.serverDir(), config).ifPresent(heap -> {
                JsonObject row = new JsonObject();
                row.addProperty("source_path",
                        SparkCollector.relativeSourcePath(config.serverDir(), heap.sourcePath()));
                row.addProperty("source_file", heap.sourceFile());
                row.addProperty("source_kind", heap.sourceKind());
                row.addProperty("captured_at", SparkProfileFacts.formatCapturedAt(heap.capturedAt()));
                try {
                    row.addProperty("size_bytes", Files.size(heap.sourcePath()));
                } catch (IOException ignored) {
                    // Size is optional list metadata.
                }
                row.addProperty("pairing", "separate_artifact");
                heapArtifacts.add(row);
            });
            out.add("heap_artifacts", heapArtifacts);
            out.addProperty("report_profile_path", resolveReportSparkProfilePath(serverContext));
            JsonObject autoCapture = new JsonObject();
            autoCapture.addProperty("enabled", config.sparkAutoCaptureOnLag());
            autoCapture.addProperty("in_flight", SparkAutoCaptureTrigger.get().isInFlight());
            if (newestAuto != null) {
                out.addProperty("auto_profile_path", newestAuto.sourcePath());
                autoCapture.addProperty("reason", "tick_lag");
                autoCapture.addProperty("captured_at",
                        SparkProfileFacts.formatCapturedAt(newestAuto.capturedAt()));
                autoCapture.addProperty("source_path", newestAuto.sourcePath());
            }
            out.add("auto_capture", autoCapture);
            sendJson(ex, 200, out);
        } catch (Exception e) {
            ModRuntime.logger().warn("Spark profile list failed: {}", e.toString());
            JsonObject err = new JsonObject();
            err.addProperty("error", e.getMessage() != null ? e.getMessage() : "list failed");
            sendJson(ex, 500, err);
        }
    }

    private void handleSparkProfile(HttpExchange ex) throws IOException {
        if (!"GET".equalsIgnoreCase(ex.getRequestMethod())) {
            send(ex, 405, "text/plain", "Method not allowed");
            return;
        }
        if (!requireApiAuth(ex)) {
            return;
        }
        if (serverContext == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        String sourcePath = null;
        String q = ex.getRequestURI().getQuery();
        if (q != null) {
            for (String part : q.split("&")) {
                if (part.startsWith("path=")) {
                    sourcePath = URLDecoder.decode(part.substring(5), StandardCharsets.UTF_8);
                }
            }
        }
        if (sourcePath == null || sourcePath.isBlank()) {
            send(ex, 400, "text/plain", "Missing path parameter");
            return;
        }
        try {
            ReportConfig config = ModReportConfig.forServer(serverContext);
            if (!config.sparkEnabled()) {
                JsonObject err = new JsonObject();
                err.addProperty("error", "spark_disabled");
                sendJson(ex, 400, err);
                return;
            }
            JsonObject profile = loadSparkProfile(config, sourcePath);
            if (profile == null) {
                JsonObject err = new JsonObject();
                err.addProperty("error", "profile_not_found");
                sendJson(ex, 404, err);
                return;
            }
            JsonObject out = new JsonObject();
            out.add(SparkProfileFacts.KEY, profile);
            sendJson(ex, 200, out);
        } catch (Exception e) {
            ModRuntime.logger().warn("Spark profile parse failed: {}", e.toString());
            JsonObject err = new JsonObject();
            err.addProperty("error", e.getMessage() != null ? e.getMessage() : "parse failed");
            sendJson(ex, 500, err);
        }
    }

    private void handleSparkImport(HttpExchange ex) throws IOException {
        if (!"POST".equalsIgnoreCase(ex.getRequestMethod())) {
            send(ex, 405, "text/plain", "Method not allowed");
            return;
        }
        if (!requireApiAuth(ex)) {
            return;
        }
        if (serverContext == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        String body = new String(ex.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
        JsonObject req = body != null && !body.isBlank()
                ? GSON.fromJson(body, JsonObject.class) : new JsonObject();
        String url = req != null && req.has("url") && !req.get("url").isJsonNull()
                ? req.get("url").getAsString() : null;
        if (url == null || url.isBlank()) {
            JsonObject err = new JsonObject();
            err.addProperty("error", "invalid_spark_url");
            err.addProperty("message", "Missing url");
            sendJson(ex, 400, err);
            return;
        }
        try {
            ReportConfig config = ModReportConfig.forServer(serverContext);
            SparkBytebinImport.Result result = SparkBytebinImport.importFromUrl(config.serverDir(), config, url);
            if (result instanceof SparkBytebinImport.Result.Err err) {
                int status = switch (err.code()) {
                    case "spark_disabled", "invalid_spark_url", "invalid_server" -> 400;
                    case "not_found" -> 404;
                    case "parse_failed" -> 422;
                    default -> 502;
                };
                JsonObject out = new JsonObject();
                out.addProperty("error", err.code());
                out.addProperty("message", err.message());
                sendJson(ex, status, out);
                return;
            }
            SparkBytebinImport.Result.Ok ok = (SparkBytebinImport.Result.Ok) result;
            sparkProfileCache.clear();
            JsonObject out = new JsonObject();
            out.addProperty("ok", true);
            out.addProperty("source_path", ok.sourcePath());
            out.add("entry", ok.entry().toJson());
            sendJson(ex, 200, out);
        } catch (Exception e) {
            ModRuntime.logger().warn("Spark import failed: {}", e.toString());
            JsonObject err = new JsonObject();
            err.addProperty("error", e.getMessage() != null ? e.getMessage() : "import failed");
            sendJson(ex, 500, err);
        }
    }

    private void handleSparkUpload(HttpExchange ex) throws IOException {
        if (!"POST".equalsIgnoreCase(ex.getRequestMethod())) {
            send(ex, 405, "text/plain", "Method not allowed");
            return;
        }
        if (!requireApiAuth(ex)) {
            return;
        }
        if (serverContext == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        int declaredLength = parseInt(ex.getRequestHeaders().getFirst("Content-Length"), -1);
        if (declaredLength > SparkBytebinImport.MAX_DOWNLOAD_BYTES) {
            sendSparkError(ex, 413, "too_large", "Spark profile exceeds the 64 MB limit");
            return;
        }
        byte[] bytes = ex.getRequestBody().readNBytes(SparkBytebinImport.MAX_DOWNLOAD_BYTES + 1);
        if (bytes.length > SparkBytebinImport.MAX_DOWNLOAD_BYTES) {
            sendSparkError(ex, 413, "too_large", "Spark profile exceeds the 64 MB limit");
            return;
        }
        String requestedName = parseQueryParam(ex.getRequestURI().getQuery(), "name");
        try {
            ReportConfig config = ModReportConfig.forServer(serverContext);
            SparkProfileUpload.Result result =
                    SparkProfileUpload.save(config.serverDir(), config, requestedName, bytes);
            if (result instanceof SparkProfileUpload.Result.Err err) {
                int status = switch (err.code()) {
                    case "spark_disabled", "invalid_server", "empty_upload" -> 400;
                    case "too_large" -> 413;
                    case "parse_failed" -> 422;
                    default -> 500;
                };
                sendSparkError(ex, status, err.code(), err.message());
                return;
            }
            SparkProfileUpload.Result.Ok ok = (SparkProfileUpload.Result.Ok) result;
            sparkProfileCache.clear();
            JsonObject out = new JsonObject();
            out.addProperty("ok", true);
            out.addProperty("source_path", ok.sourcePath());
            out.add("entry", ok.entry().toJson());
            sendJson(ex, 201, out);
        } catch (Exception e) {
            ModRuntime.logger().warn("Spark upload failed: {}", e.toString());
            sendSparkError(ex, 500, "upload_failed",
                    e.getMessage() != null ? e.getMessage() : "upload failed");
        }
    }

    private JsonObject loadSparkProfile(ReportConfig config, String sourcePath) throws IOException {
        var result = SparkCollector.readProfile(config.serverDir(), config, sourcePath);
        if (result.isEmpty()) {
            return null;
        }
        var collected = result.get();
        Path file = collected.sourcePath().toAbsolutePath().normalize();
        String key = file + "|" + Files.getLastModifiedTime(file).toMillis() + "|" + Files.size(file);
        CachedSparkProfile cached = sparkProfileCache.get(collected.relativeSourcePath());
        if (cached != null && cached.key().equals(key)) {
            return cached.profile();
        }
        JsonObject profile = SparkProfileBuilder.build(collected, config.serverDir(), config);
        if (profile == null) {
            return null;
        }
        JsonObject fullCallTree = null;
        if (profile.has("call_tree") && profile.get("call_tree").isJsonObject()) {
            fullCallTree = profile.getAsJsonObject("call_tree");
            profile.add("call_tree", SparkCallTrees.slim(fullCallTree, SparkCallTrees.PROFILE_PREVIEW_NODES));
        }
        if (sparkProfileCache.size() >= 12) {
            sparkProfileCache.clear();
        }
        sparkProfileCache.put(collected.relativeSourcePath(),
                new CachedSparkProfile(key, profile, fullCallTree));
        return profile;
    }

    private void handleSparkTree(HttpExchange ex) throws IOException {
        if (!"GET".equalsIgnoreCase(ex.getRequestMethod())) {
            send(ex, 405, "text/plain", "Method not allowed");
            return;
        }
        if (!requireApiAuth(ex)) {
            return;
        }
        if (serverContext == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        String query = ex.getRequestURI().getQuery();
        String sourcePath = parseQueryParam(query, "path");
        if (sourcePath == null || sourcePath.isBlank()) {
            sendSparkError(ex, 400, "missing_path", "Missing path parameter");
            return;
        }
        try {
            ReportConfig config = ModReportConfig.forServer(serverContext);
            JsonObject profile = loadSparkProfile(config, sourcePath);
            if (profile == null) {
                sendSparkError(ex, 404, "profile_not_found", "Spark profile was not found");
                return;
            }
            int maxNodes = Math.max(25, Math.min(250_000,
                    parseInt(parseQueryParam(query, "max_nodes"), 250_000)));
            JsonObject out = new JsonObject();
            out.addProperty("analysis_version", intValue(profile, "analysis_version", 1));
            out.addProperty("source_path", sourcePath);
            out.addProperty("thread", parseQueryParam(query, "thread"));
            out.addProperty("window", parseQueryParam(query, "window"));
            out.addProperty("source", parseQueryParam(query, "source"));
            out.addProperty("search", parseQueryParam(query, "search"));
            out.addProperty("min_share", doubleValue(parseQueryParam(query, "min_share"), 0));
            out.addProperty("max_nodes", maxNodes);
            JsonElement tree = fullSparkTree(sourcePath, profile);
            if (tree != null && tree.isJsonObject()) {
                JsonObject bounded = boundedSparkTree(tree.getAsJsonObject(), query, maxNodes);
                out.add("tree", bounded);
                out.addProperty("truncated", booleanValue(bounded, "truncated", false));
                out.addProperty("returned_nodes", intValue(bounded, "nodes_emitted", 0));
            } else {
                JsonArray nodes = boundedMethodNodes(profile, query, maxNodes);
                out.add("nodes", nodes);
                out.addProperty("truncated",
                        profile.has("top_methods") && profile.getAsJsonArray("top_methods").size() > nodes.size());
                out.addProperty("returned_nodes", nodes.size());
                JsonArray caveats = new JsonArray();
                caveats.add("This profile predates the v2 call-tree contract; only flat hot methods are available.");
                out.add("caveats", caveats);
            }
            sendJson(ex, 200, out);
        } catch (Exception e) {
            ModRuntime.logger().warn("Spark tree failed: {}", e.toString());
            sendSparkError(ex, 500, "tree_failed",
                    e.getMessage() != null ? e.getMessage() : "tree failed");
        }
    }

    private void handleSparkCompare(HttpExchange ex) throws IOException {
        if (!"GET".equalsIgnoreCase(ex.getRequestMethod())) {
            send(ex, 405, "text/plain", "Method not allowed");
            return;
        }
        if (!requireApiAuth(ex)) {
            return;
        }
        if (serverContext == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        String query = ex.getRequestURI().getQuery();
        String baselinePath = parseQueryParam(query, "baseline");
        String targetPath = parseQueryParam(query, "target");
        if (baselinePath == null || targetPath == null) {
            sendSparkError(ex, 400, "missing_profile", "baseline and target are required");
            return;
        }
        try {
            ReportConfig config = ModReportConfig.forServer(serverContext);
            JsonObject baseline = loadSparkProfile(config, baselinePath);
            JsonObject target = loadSparkProfile(config, targetPath);
            if (baseline == null || target == null) {
                sendSparkError(ex, 404, "profile_not_found", "One or both Spark profiles were not found");
                return;
            }
            sendJson(ex, 200, buildSparkComparison(baselinePath, baseline, targetPath, target));
        } catch (Exception e) {
            ModRuntime.logger().warn("Spark compare failed: {}", e.toString());
            sendSparkError(ex, 500, "compare_failed",
                    e.getMessage() != null ? e.getMessage() : "compare failed");
        }
    }

    private static JsonObject buildSparkComparison(
            String baselinePath, JsonObject baseline, String targetPath, JsonObject target) {
        String baselineMode = sparkMode(baseline);
        String targetMode = sparkMode(target);
        String baselineThread = sparkThreadScope(baseline);
        String targetThread = sparkThreadScope(target);
        JsonArray warnings = new JsonArray();
        boolean compatible = baselineMode.equalsIgnoreCase(targetMode);
        if (!compatible) {
            warnings.add("Sampler modes differ; execution and allocation profiles cannot be compared.");
        }
        if (!baselineThread.equalsIgnoreCase(targetThread)) {
            compatible = false;
            warnings.add("Thread scopes differ; choose profiles captured from comparable threads.");
        }
        String baselineEngine = stringValue(baseline, "engine", "unknown");
        String targetEngine = stringValue(target, "engine", "unknown");
        if (!baselineEngine.equalsIgnoreCase(targetEngine)) {
            warnings.add("Profiler engines differ; sampling behavior may change source shares.");
        }
        double baselineDuration = numberValue(objectValue(baseline, "window"), "duration_sec");
        double targetDuration = numberValue(objectValue(target, "window"), "duration_sec");
        if (baselineDuration > 0 && targetDuration > 0
                && Math.max(baselineDuration, targetDuration) / Math.min(baselineDuration, targetDuration) >= 2) {
            warnings.add("Capture durations differ by at least 2×.");
        }
        JsonObject baselineSettings = objectValue(objectValue(baseline, "capture"), "profiler_settings");
        JsonObject targetSettings = objectValue(objectValue(target, "capture"), "profiler_settings");
        double baselineThreshold = numberValue(baselineSettings, "tick_length_threshold");
        double targetThreshold = numberValue(targetSettings, "tick_length_threshold");
        if (Double.compare(baselineThreshold, targetThreshold) != 0) {
            warnings.add("Tick filters differ; the profiles represent different tick populations.");
        }

        JsonObject out = new JsonObject();
        out.addProperty("compatible", compatible);
        out.addProperty("normalization", "share_and_capture_context");
        out.add("warnings", warnings);
        out.add("baseline", sparkCompareSnapshot(baselinePath, baseline));
        out.add("target", sparkCompareSnapshot(targetPath, target));

        JsonObject deltas = new JsonObject();
        JsonObject baseCtx = objectValue(baseline, "context");
        JsonObject targetCtx = objectValue(target, "context");
        addDelta(deltas, "tps", numberValue(baseCtx, "tps_1m"), numberValue(targetCtx, "tps_1m"));
        addDelta(deltas, "mspt_p95_ms", numberValue(baseCtx, "mspt_p95_1m"),
                numberValue(targetCtx, "mspt_p95_1m"));
        addDelta(deltas, "players", numberValue(baseCtx, "players"), numberValue(targetCtx, "players"));
        addDelta(deltas, "entities", numberValue(baseCtx, "world_entities"),
                numberValue(targetCtx, "world_entities"));
        out.add("deltas", deltas);
        out.add("source_deltas", compareSourceShares(baseline, target));
        out.add("config_deltas", compareSparkConfigs(baseline, target));
        return out;
    }

    private static JsonObject sparkCompareSnapshot(String path, JsonObject profile) {
        JsonObject out = new JsonObject();
        out.addProperty("source_path", path);
        out.addProperty("captured_at", stringValue(profile, "captured_at", null));
        out.addProperty("mode", sparkMode(profile));
        out.addProperty("thread_scope", sparkThreadScope(profile));
        out.addProperty("duration_ms", numberValue(profile, "duration_ms"));
        JsonObject ctx = objectValue(profile, "context");
        out.addProperty("tps", numberValue(ctx, "tps_1m"));
        out.addProperty("mspt_p95_ms", numberValue(ctx, "mspt_p95_1m"));
        return out;
    }

    private static JsonArray compareSourceShares(JsonObject baseline, JsonObject target) {
        Map<String, Double> before = sparkSourceShares(baseline);
        Map<String, Double> after = sparkSourceShares(target);
        Set<String> ids = new HashSet<>(before.keySet());
        ids.addAll(after.keySet());
        List<String> ordered = new ArrayList<>(ids);
        ordered.sort(Comparator
                .comparingDouble((String id) -> Math.abs(after.getOrDefault(id, 0d)
                        - before.getOrDefault(id, 0d))).reversed()
                .thenComparing(String::compareTo));
        JsonArray out = new JsonArray();
        for (String id : ordered.stream().limit(40).toList()) {
            double base = before.getOrDefault(id, 0d);
            double next = after.getOrDefault(id, 0d);
            JsonObject row = new JsonObject();
            row.addProperty("source_id", id);
            row.addProperty("baseline_own_pct", base);
            row.addProperty("target_own_pct", next);
            row.addProperty("delta_own_pct", next - base);
            out.add(row);
        }
        return out;
    }

    private static Map<String, Double> sparkSourceShares(JsonObject profile) {
        JsonArray rows = profile.has("source_rollups") && profile.get("source_rollups").isJsonArray()
                ? profile.getAsJsonArray("source_rollups")
                : profile.has("mod_rollups") && profile.get("mod_rollups").isJsonArray()
                ? profile.getAsJsonArray("mod_rollups") : new JsonArray();
        Map<String, Double> out = new HashMap<>();
        for (JsonElement el : rows) {
            if (!el.isJsonObject()) {
                continue;
            }
            JsonObject row = el.getAsJsonObject();
            String id = stringValue(row, "source_id", stringValue(row, "mod_id", "unknown"));
            double pct = row.has("own_pct") ? numberValue(row, "own_pct") : numberValue(row, "pct");
            out.merge(id, pct, Double::sum);
        }
        return out;
    }

    private static JsonArray compareSparkConfigs(JsonObject baseline, JsonObject target) {
        JsonObject before = sparkServerProperties(baseline);
        JsonObject after = sparkServerProperties(target);
        JsonArray out = new JsonArray();
        for (String key : List.of(
                "view-distance",
                "simulation-distance",
                "max-tick-time",
                "sync-chunk-writes",
                "entity-broadcast-range-percentage")) {
            JsonElement left = before.get(key);
            JsonElement right = after.get(key);
            if (left == null && right == null) {
                continue;
            }
            String leftText = left == null || left.isJsonNull() ? null : left.getAsString();
            String rightText = right == null || right.isJsonNull() ? null : right.getAsString();
            if (java.util.Objects.equals(leftText, rightText)) {
                continue;
            }
            JsonObject row = new JsonObject();
            row.addProperty("key", key);
            if (leftText != null) {
                row.addProperty("baseline", leftText);
            }
            if (rightText != null) {
                row.addProperty("target", rightText);
            }
            out.add(row);
        }
        return out;
    }

    private static JsonObject sparkServerProperties(JsonObject profile) {
        JsonObject capture = objectValue(profile, "capture");
        JsonObject configs = objectValue(capture, "server_configurations");
        String raw = stringValue(configs, "server.properties", null);
        if (raw == null || raw.isBlank()) {
            return new JsonObject();
        }
        try {
            JsonObject parsed = GSON.fromJson(raw, JsonObject.class);
            return parsed != null ? parsed : new JsonObject();
        } catch (Exception ignored) {
            return new JsonObject();
        }
    }

    private JsonElement fullSparkTree(String sourcePath, JsonObject profile) {
        CachedSparkProfile cached = sourcePath != null ? sparkProfileCache.get(sourcePath) : null;
        if (cached != null && cached.fullCallTree() != null) {
            return cached.fullCallTree();
        }
        return findSparkTree(profile);
    }

    private static JsonElement findSparkTree(JsonObject profile) {
        if (profile.has("call_tree")) {
            return profile.get("call_tree");
        }
        JsonObject analysis = objectValue(profile, "analysis");
        if (analysis != null && analysis.has("call_tree")) {
            return analysis.get("call_tree");
        }
        if (profile.has("threads")) {
            return profile.get("threads");
        }
        return null;
    }

    private static JsonObject boundedSparkTree(JsonObject sourceTree, String query, int maxNodes) {
        JsonObject out = new JsonObject();
        for (Map.Entry<String, JsonElement> entry : sourceTree.entrySet()) {
            if (!"threads".equals(entry.getKey())
                    && !"nodes_emitted".equals(entry.getKey())
                    && !"truncated".equals(entry.getKey())) {
                out.add(entry.getKey(), entry.getValue().deepCopy());
            }
        }

        String requestedThread = parseQueryParam(query, "thread");
        String searchParam = parseQueryParam(query, "search");
        String sourceParam = parseQueryParam(query, "source");
        String search = searchParam != null ? searchParam.strip().toLowerCase(Locale.ROOT) : "";
        String source = sourceParam != null ? sourceParam.strip().toLowerCase(Locale.ROOT) : "";
        double minShare = Math.max(0d, doubleValue(parseQueryParam(query, "min_share"), 0d));
        int[] windowIndexes = selectedWindowIndexes(sourceTree, parseQueryParam(query, "window"));

        JsonArray sourceThreads = sourceTree.has("threads") && sourceTree.get("threads").isJsonArray()
                ? sourceTree.getAsJsonArray("threads") : new JsonArray();
        ApiTreeBudget budget = new ApiTreeBudget(maxNodes);
        JsonArray threads = new JsonArray();
        for (JsonElement element : sourceThreads) {
            if (!element.isJsonObject()) {
                continue;
            }
            JsonObject thread = element.getAsJsonObject();
            String name = stringValue(thread, "name", "");
            if (requestedThread != null && !requestedThread.isBlank()
                    && !name.equalsIgnoreCase(requestedThread)
                    && !stringValue(thread, "id", "").equalsIgnoreCase(requestedThread)) {
                continue;
            }
            double denominator = selectedWeight(thread, "inclusive_by_window",
                    numberValue(thread, "inclusive_weight"), windowIndexes);
            if (denominator <= 0) {
                denominator = 1d;
            }
            JsonObject filtered = copyTreeNode(thread, search, source, minShare,
                    windowIndexes, denominator, budget, true);
            if (filtered != null) {
                threads.add(filtered);
            }
            if (budget.remaining <= 0) {
                break;
            }
        }
        out.add("threads", threads);
        out.addProperty("nodes_emitted", budget.emitted);
        out.addProperty("truncated",
                budget.truncated || booleanValue(sourceTree, "truncated", false));
        if (windowIndexes.length > 0) {
            JsonArray selected = new JsonArray();
            for (int index : windowIndexes) {
                selected.add(index);
            }
            out.add("selected_window_indexes", selected);
        }
        out.addProperty("query_applied",
                !search.isBlank() || !source.isBlank() || minShare > 0 || windowIndexes.length > 0
                        || (requestedThread != null && !requestedThread.isBlank()));
        return out;
    }

    private static JsonObject copyTreeNode(
            JsonObject node,
            String search,
            String source,
            double minShare,
            int[] windowIndexes,
            double denominator,
            ApiTreeBudget budget,
            boolean threadRoot) {
        if (!threadRoot && budget.remaining <= 0) {
            budget.truncated = true;
            return null;
        }
        JsonArray originalChildren = node.has("children") && node.get("children").isJsonArray()
                ? node.getAsJsonArray("children") : new JsonArray();
        JsonArray children = new JsonArray();
        for (JsonElement childElement : originalChildren) {
            if (!childElement.isJsonObject()) {
                continue;
            }
            JsonObject child = copyTreeNode(childElement.getAsJsonObject(), search, source,
                    minShare, windowIndexes, denominator, budget, false);
            if (child != null) {
                children.add(child);
            }
            if (budget.remaining <= 0) {
                if (children.size() < originalChildren.size()) {
                    budget.truncated = true;
                }
                break;
            }
        }

        double inclusive = selectedWeight(node, "inclusive_by_window",
                numberValue(node, "inclusive_weight"), windowIndexes);
        double self = selectedWeight(node, "self_by_window",
                numberValue(node, "self_weight"), windowIndexes);
        double involvementPct = denominator > 0 ? inclusive * 100d / denominator : 0d;
        double ownPct = denominator > 0 ? self * 100d / denominator : 0d;
        String haystack = (stringValue(node, "class", "") + " "
                + stringValue(node, "method", "") + " "
                + stringValue(node, "name", "") + " "
                + stringValue(node, "mod_id", "") + " "
                + stringValue(node, "source", "")).toLowerCase(Locale.ROOT);
        boolean searchMatch = search.isBlank() || haystack.contains(search);
        boolean sourceMatch = source.isBlank()
                || stringValue(node, "mod_id", "").equalsIgnoreCase(source)
                || stringValue(node, "source", "").toLowerCase(Locale.ROOT).contains(source);
        boolean shareMatch = minShare <= 0 || ownPct >= minShare || involvementPct >= minShare;
        boolean directMatch = searchMatch && sourceMatch && shareMatch;
        if (!threadRoot && !directMatch && children.isEmpty()) {
            return null;
        }

        JsonObject out = new JsonObject();
        for (Map.Entry<String, JsonElement> entry : node.entrySet()) {
            String key = entry.getKey();
            if (!"children".equals(key)
                    && !"inclusive_weight".equals(key)
                    && !"self_weight".equals(key)
                    && !"involvement_pct".equals(key)
                    && !"own_pct".equals(key)) {
                out.add(key, entry.getValue().deepCopy());
            }
        }
        out.addProperty("inclusive_weight", inclusive);
        out.addProperty("self_weight", self);
        out.addProperty("involvement_pct", Math.round(involvementPct * 100d) / 100d);
        out.addProperty("own_pct", Math.round(ownPct * 100d) / 100d);
        out.add("children", children);
        if (!threadRoot) {
            budget.remaining--;
            budget.emitted++;
        }
        return out;
    }

    private static double selectedWeight(
            JsonObject node, String arrayKey, double fallback, int[] windowIndexes) {
        if (windowIndexes.length == 0 || !node.has(arrayKey) || !node.get(arrayKey).isJsonArray()) {
            return fallback;
        }
        JsonArray values = node.getAsJsonArray(arrayKey);
        double total = 0d;
        for (int index : windowIndexes) {
            if (index >= 0 && index < values.size() && !values.get(index).isJsonNull()) {
                total += values.get(index).getAsDouble();
            }
        }
        return total;
    }

    private static int[] selectedWindowIndexes(JsonObject tree, String requestedWindow) {
        if (requestedWindow == null || requestedWindow.isBlank()) {
            return new int[0];
        }
        JsonArray windows = tree.has("time_windows") && tree.get("time_windows").isJsonArray()
                ? tree.getAsJsonArray("time_windows") : new JsonArray();
        List<Integer> indexes = new ArrayList<>();
        for (String token : requestedWindow.split(",")) {
            String value = token.strip();
            if (value.isEmpty()) {
                continue;
            }
            int dash = value.indexOf('-');
            if (dash > 0) {
                int start = parseInt(value.substring(0, dash), -1);
                int end = parseInt(value.substring(dash + 1), -1);
                if (start >= 0 && end >= start && end - start <= 1_000) {
                    for (int i = start; i <= end; i++) {
                        addWindowIndex(indexes, windows, i);
                    }
                    continue;
                }
            }
            addWindowIndex(indexes, windows, parseInt(value, -1));
        }
        return indexes.stream().distinct().mapToInt(Integer::intValue).toArray();
    }

    private static void addWindowIndex(List<Integer> indexes, JsonArray windows, int requested) {
        if (requested < 0) {
            return;
        }
        for (int i = 0; i < windows.size(); i++) {
            if (!windows.get(i).isJsonNull() && windows.get(i).getAsLong() == requested) {
                indexes.add(i);
                return;
            }
        }
        if (requested < windows.size()) {
            indexes.add(requested);
        }
    }

    private static final class ApiTreeBudget {
        private int remaining;
        private int emitted;
        private boolean truncated;

        private ApiTreeBudget(int remaining) {
            this.remaining = remaining;
        }
    }

    private static JsonArray boundedMethodNodes(JsonObject profile, String query, int maxNodes) {
        JsonArray out = new JsonArray();
        if (!profile.has("top_methods") || !profile.get("top_methods").isJsonArray()) {
            return out;
        }
        String searchParam = parseQueryParam(query, "search");
        String sourceParam = parseQueryParam(query, "source");
        String search = searchParam != null ? searchParam.toLowerCase(Locale.ROOT) : "";
        String source = sourceParam != null ? sourceParam.toLowerCase(Locale.ROOT) : "";
        double minShare = doubleValue(parseQueryParam(query, "min_share"), 0);
        int count = 0;
        for (JsonElement el : profile.getAsJsonArray("top_methods")) {
            if (!el.isJsonObject() || count >= maxNodes) {
                break;
            }
            JsonObject row = el.getAsJsonObject();
            String haystack = row.toString().toLowerCase(Locale.ROOT);
            if (!search.isBlank() && !haystack.contains(search)) {
                continue;
            }
            if (!source.isBlank() && !haystack.contains(source)) {
                continue;
            }
            double pct = row.has("own_pct") ? numberValue(row, "own_pct") : numberValue(row, "pct");
            if (pct < minShare) {
                continue;
            }
            out.add(row.deepCopy());
            count++;
        }
        return out;
    }

    private static String sparkMode(JsonObject profile) {
        String mode = stringValue(profile, "mode", null);
        if (mode == null) {
            JsonObject config = objectValue(profile, "profile_config");
            mode = stringValue(config, "mode", "execution");
        }
        return mode;
    }

    private static String sparkThreadScope(JsonObject profile) {
        JsonObject thread = objectValue(profile, "server_thread");
        String scope = stringValue(thread, "name", null);
        if (scope == null) {
            JsonObject tree = objectValue(profile, "call_tree");
            if (tree != null && tree.has("threads") && tree.get("threads").isJsonArray()) {
                for (JsonElement element : tree.getAsJsonArray("threads")) {
                    if (!element.isJsonObject()) {
                        continue;
                    }
                    JsonObject candidate = element.getAsJsonObject();
                    if (booleanValue(candidate, "selected", false)) {
                        scope = stringValue(candidate, "name", null);
                        break;
                    }
                }
            }
        }
        if (scope == null) {
            scope = stringValue(profile, "thread_scope", "Server thread");
        }
        return scope;
    }

    private static void addDelta(JsonObject out, String key, double baseline, double target) {
        JsonObject value = new JsonObject();
        value.addProperty("baseline", baseline);
        value.addProperty("target", target);
        value.addProperty("delta", target - baseline);
        out.add(key, value);
    }

    private static JsonObject objectValue(JsonObject object, String key) {
        return object != null && object.has(key) && object.get(key).isJsonObject()
                ? object.getAsJsonObject(key) : null;
    }

    private static double numberValue(JsonObject object, String key) {
        return object != null && object.has(key) && !object.get(key).isJsonNull()
                ? object.get(key).getAsDouble() : 0d;
    }

    private static String stringValue(JsonObject object, String key, String fallback) {
        return object != null && object.has(key) && !object.get(key).isJsonNull()
                ? object.get(key).getAsString() : fallback;
    }

    private static int intValue(JsonObject object, String key, int fallback) {
        return object != null && object.has(key) && !object.get(key).isJsonNull()
                ? object.get(key).getAsInt() : fallback;
    }

    private static boolean booleanValue(JsonObject object, String key, boolean fallback) {
        return object != null && object.has(key) && !object.get(key).isJsonNull()
                ? object.get(key).getAsBoolean() : fallback;
    }

    private static double doubleValue(String value, double fallback) {
        if (value == null) {
            return fallback;
        }
        try {
            return Double.parseDouble(value);
        } catch (NumberFormatException ignored) {
            return fallback;
        }
    }

    private static int parseInt(String value, int fallback) {
        if (value == null) {
            return fallback;
        }
        try {
            return Integer.parseInt(value);
        } catch (NumberFormatException ignored) {
            return fallback;
        }
    }

    private static void sendSparkError(HttpExchange ex, int status, String code, String message)
            throws IOException {
        JsonObject err = new JsonObject();
        err.addProperty("error", code);
        err.addProperty("message", message);
        sendJson(ex, status, err);
    }

    private String resolveReportSparkProfilePath(ServerContext server) {
        try {
            Path facts = findLatestFacts(WatchtowerPaths.reportDir(serverContext));
            if (facts == null) {
                return null;
            }
            JsonObject parsed = GSON.fromJson(Files.readString(facts), JsonObject.class);
            if (parsed == null || !parsed.has("optional")) {
                return null;
            }
            JsonObject optional = parsed.getAsJsonObject("optional");
            if (!optional.has(SparkProfileFacts.KEY)) {
                return null;
            }
            JsonObject sparkProfile = optional.getAsJsonObject(SparkProfileFacts.KEY);
            if (!sparkProfile.has("source_path")) {
                return null;
            }
            String raw = sparkProfile.get("source_path").getAsString();
            ReportConfig config = ModReportConfig.forServer(server);
            return SparkCollector.normalizeSourcePath(config.serverDir(), raw);
        } catch (Exception ignored) {
            return null;
        }
    }

    private void handleFsRoots(HttpExchange ex) throws IOException {
        if (!"GET".equalsIgnoreCase(ex.getRequestMethod())) {
            send(ex, 405, "text/plain", "Method not allowed");
            return;
        }
        if (!requireApiAuth(ex)) {
            return;
        }
        if (serverContext == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        try {
            ReportConfig config = ModReportConfig.forServer(serverContext);
            JsonArray lastSearch = null;
            Path facts = findLatestFacts(WatchtowerPaths.reportDir(serverContext));
            if (facts != null) {
                JsonObject parsed = GSON.fromJson(Files.readString(facts), JsonObject.class);
                JsonObject optional = parsed.getAsJsonObject("optional");
                if (optional != null && optional.has("last_backup")) {
                    JsonObject last = optional.getAsJsonObject("last_backup");
                    if (last.has("search_dirs")) {
                        lastSearch = last.getAsJsonArray("search_dirs");
                    }
                }
            }
            JsonObject out = FsBrowseService.listRoots(config.serverDir(), config, lastSearch);
            sendJson(ex, 200, out);
        } catch (Exception e) {
            JsonObject err = new JsonObject();
            err.addProperty("error", e.getMessage() != null ? e.getMessage() : "browse failed");
            sendJson(ex, 500, err);
        }
    }

    private void handleFsList(HttpExchange ex) throws IOException {
        if (!"GET".equalsIgnoreCase(ex.getRequestMethod())) {
            send(ex, 405, "text/plain", "Method not allowed");
            return;
        }
        if (!requireApiAuth(ex)) {
            return;
        }
        if (serverContext == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        String path = null;
        String q = ex.getRequestURI().getQuery();
        if (q != null) {
            for (String part : q.split("&")) {
                if (part.startsWith("path=")) {
                    path = java.net.URLDecoder.decode(part.substring(5), StandardCharsets.UTF_8);
                }
            }
        }
        if (path == null || path.isBlank()) {
            send(ex, 400, "text/plain", "Missing path parameter");
            return;
        }
        try {
            JsonObject out = FsBrowseService.listDirectory(path);
            sendJson(ex, 200, out);
        } catch (IOException e) {
            JsonObject err = new JsonObject();
            err.addProperty("error", e.getMessage() != null ? e.getMessage() : "list failed");
            sendJson(ex, 400, err);
        }
    }

    private void handleBackupDirs(HttpExchange ex) throws IOException {
        if (!"POST".equalsIgnoreCase(ex.getRequestMethod())) {
            send(ex, 405, "text/plain", "Method not allowed");
            return;
        }
        if (!requireApiAuth(ex)) {
            return;
        }
        if (serverContext == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        String body = new String(ex.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
        JsonObject json = body != null && !body.isBlank()
                ? GSON.fromJson(body, JsonObject.class) : new JsonObject();
        List<String> dirs = new ArrayList<>();
        if (json.has("dirs") && json.get("dirs").isJsonArray()) {
            for (JsonElement el : json.getAsJsonArray("dirs")) {
                if (el.isJsonPrimitive()) {
                    String d = el.getAsString().strip();
                    if (!d.isEmpty()) {
                        dirs.add(d);
                    }
                }
            }
        }
        if (dirs.isEmpty()) {
            send(ex, 400, "text/plain", "Missing dirs");
            return;
        }
        for (String d : dirs) {
            if (!Files.isDirectory(Path.of(d))) {
                send(ex, 400, "text/plain", "Not a directory: " + d);
                return;
            }
        }
        try {
            ReportConfig before = ModReportConfig.forServer(serverContext);
            String merged = WatchtowerConfWriter.mergeBackupDirs(String.join(",", before.backupDirs()), dirs);
            Path conf = WatchtowerPaths.confPath(serverContext);
            WatchtowerConfWriter.upsertKey(conf, "BACKUP_DIRS", merged);

            ReportConfig config = ModReportConfig.forServer(serverContext);
            double cutoff = Instant.now().getEpochSecond()
                    - (long) IssuesLiveEvaluators.BACKUP_FRESH_HOURS * 3600L;
            JsonObject staging = new JsonObject();
            staging.add("optional", new JsonObject());
            CraftyCollector.scanBackups(staging, config.serverDir(), cutoff, config);
            JsonObject optional = staging.getAsJsonObject("optional");
            JsonObject lastBackup = optional.has("last_backup")
                    ? optional.getAsJsonObject("last_backup") : null;
            com.google.gson.JsonElement inventory = optional.has("backup_inventory")
                    ? optional.get("backup_inventory") : null;
            OpsCacheWriter.applyBackupsLive(
                    WatchtowerPaths.opsCachePath(serverContext),
                    WatchtowerPaths.statePath(serverContext),
                    lastBackup,
                    inventory);
            OpsScanService.refreshIssuesLive(serverContext);

            JsonObject out = new JsonObject();
            out.addProperty("ok", true);
            out.addProperty("saved_dirs", merged);
            if (optional.has("last_backup")) {
                out.add("last_backup", optional.get("last_backup"));
            }
            if (optional.has("backup_inventory")) {
                out.add("backup_inventory", optional.get("backup_inventory"));
            }
            sendJson(ex, 200, out);
        } catch (Exception e) {
            ModRuntime.logger().warn("Backup dirs save failed: {}", e.toString());
            JsonObject err = new JsonObject();
            err.addProperty("error", e.getMessage() != null ? e.getMessage() : "save failed");
            sendJson(ex, 500, err);
        }
    }

    private void handleBackupExternal(HttpExchange ex) throws IOException {
        if (!"POST".equalsIgnoreCase(ex.getRequestMethod())) {
            send(ex, 405, "text/plain", "Method not allowed");
            return;
        }
        if (!requireApiAuth(ex)) {
            return;
        }
        if (serverContext == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        String body = new String(ex.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
        JsonObject json = body != null && !body.isBlank()
                ? GSON.fromJson(body, JsonObject.class) : new JsonObject();
        try {
            Path conf = WatchtowerPaths.confPath(serverContext);
            BackupExternalConfigService.ApplyResult applied = BackupExternalConfigService.apply(conf, json);
            JsonObject out = new JsonObject();
            out.addProperty("ok", true);
            out.add("settings", buildSettingsJson());
            if (applied.hasGeneratedToken()) {
                out.addProperty("backup_webhook_token", applied.generatedToken());
            }
            sendJson(ex, 200, out);
        } catch (IllegalArgumentException e) {
            JsonObject err = new JsonObject();
            err.addProperty("error", e.getMessage());
            sendJson(ex, 400, err);
        } catch (Exception e) {
            ModRuntime.logger().warn("Backup external config save failed: {}", e.toString());
            JsonObject err = new JsonObject();
            err.addProperty("error", e.getMessage() != null ? e.getMessage() : "save failed");
            sendJson(ex, 500, err);
        }
    }

    private void handleBackupExternalTest(HttpExchange ex) throws IOException {
        if (!"POST".equalsIgnoreCase(ex.getRequestMethod())) {
            send(ex, 405, "text/plain", "Method not allowed");
            return;
        }
        if (!requireApiAuth(ex)) {
            return;
        }
        if (serverContext == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        try {
            ReportConfig config = ModReportConfig.forServer(serverContext);
            if (!config.isExternalBackupConfigured()) {
                send(ex, 400, "text/plain", "External backup not configured");
                return;
            }
            ZonedDateTime now = ZonedDateTime.now(ZoneId.systemDefault());
            JsonObject body = new JsonObject();
            body.addProperty("status", "ok");
            body.addProperty("source", "dashboard-test");
            JsonObject backupExternal = persistBackupHeartbeat(body, config, "dashboard-test", now);
            JsonObject out = new JsonObject();
            out.addProperty("ok", true);
            out.add("backup_external", backupExternal);
            sendJson(ex, 200, out);
        } catch (Exception e) {
            ModRuntime.logger().warn("Backup external test failed: {}", e.toString());
            JsonObject err = new JsonObject();
            err.addProperty("error", e.getMessage() != null ? e.getMessage() : "test failed");
            sendJson(ex, 500, err);
        }
    }

    private void handleBackupHeartbeat(HttpExchange ex) throws IOException {
        if (!"POST".equalsIgnoreCase(ex.getRequestMethod())) {
            send(ex, 405, "text/plain", "Method not allowed");
            return;
        }
        if (serverContext == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        ReportConfig config;
        try {
            config = ModReportConfig.forServer(serverContext);
        } catch (IOException e) {
            send(ex, 500, "text/plain", "Config error");
            return;
        }
        String expectedToken = config.backupWebhookToken();
        if (expectedToken == null || expectedToken.isBlank()) {
            send(ex, 404, "text/plain", "Webhook not enabled");
            return;
        }
        if (!requireBackupWebhookAuth(ex, expectedToken)) {
            send(ex, 401, "text/plain", "Unauthorized");
            return;
        }
        String body = new String(ex.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
        if (body.length() > 16_384) {
            send(ex, 413, "text/plain", "Payload too large");
            return;
        }
        JsonObject json = body != null && !body.isBlank()
                ? GSON.fromJson(body, JsonObject.class) : new JsonObject();
        try {
            ZonedDateTime now = ZonedDateTime.now(ZoneId.systemDefault());
            JsonObject backupExternal = persistBackupHeartbeat(json, config, "webhook", now);
            JsonObject out = new JsonObject();
            out.addProperty("ok", true);
            out.add("backup_external", backupExternal);
            sendJson(ex, 200, out);
        } catch (Exception e) {
            ModRuntime.logger().warn("Backup heartbeat failed: {}", e.toString());
            JsonObject err = new JsonObject();
            err.addProperty("error", e.getMessage() != null ? e.getMessage() : "heartbeat failed");
            sendJson(ex, 500, err);
        }
    }

    private JsonObject persistBackupHeartbeat(
            JsonObject json,
            ReportConfig config,
            String via,
            ZonedDateTime now
    ) throws IOException {
        JsonObject payload = ExternalBackupDetector.buildHeartbeatPayload(json, now);
        Path markerPath = ExternalBackupDetector.resolveMarkerPath(
                serverContext.serverDirectory().toAbsolutePath().toString(), config);
        if (markerPath != null) {
            ExternalBackupDetector.writeMarker(markerPath, payload);
        }
        JsonObject backupExternal = ExternalBackupDetector.normalizePayload(
                payload, markerPath, config.backupWarnDays(), via, now);
        OpsCacheWriter.applyBackupExternal(
                WatchtowerPaths.opsCachePath(serverContext),
                WatchtowerPaths.statePath(serverContext),
                backupExternal);
        return backupExternal;
    }

    private boolean requireBackupWebhookAuth(HttpExchange ex, String expectedToken) {
        String auth = ex.getRequestHeaders().getFirst("Authorization");
        if (auth != null && auth.regionMatches(true, 0, "Bearer ", 0, 7)) {
            return constantTimeEquals(auth.substring(7).strip(), expectedToken);
        }
        String headerToken = ex.getRequestHeaders().getFirst("X-Watchtower-Backup-Token");
        if (headerToken != null) {
            return constantTimeEquals(headerToken.strip(), expectedToken);
        }
        return false;
    }

    private static boolean constantTimeEquals(String a, String b) {
        if (a == null || b == null) {
            return false;
        }
        byte[] left = a.getBytes(StandardCharsets.UTF_8);
        byte[] right = b.getBytes(StandardCharsets.UTF_8);
        if (left.length != right.length) {
            return false;
        }
        int diff = 0;
        for (int i = 0; i < left.length; i++) {
            diff |= left[i] ^ right[i];
        }
        return diff == 0;
    }

    private void handleCrashContext(HttpExchange ex) throws IOException {
        if (!"GET".equalsIgnoreCase(ex.getRequestMethod())) {
            send(ex, 405, "text/plain", "Method not allowed");
            return;
        }
        if (!requireApiAuth(ex)) {
            return;
        }
        if (serverContext == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        String file = null;
        int minutes = 10;
        String q = ex.getRequestURI().getQuery();
        if (q != null) {
            for (String part : q.split("&")) {
                if (part.startsWith("file=")) {
                    file = java.net.URLDecoder.decode(part.substring(5), StandardCharsets.UTF_8);
                } else if (part.startsWith("minutes=")) {
                    try {
                        minutes = Integer.parseInt(part.substring(8));
                    } catch (NumberFormatException ignored) {
                    }
                }
            }
        }
        if (file == null || file.isBlank()) {
            send(ex, 400, "text/plain", "Missing file parameter");
            return;
        }
        minutes = Math.max(1, Math.min(60, minutes));
        String bareFile = file.startsWith("crash-reports/") ? file.substring("crash-reports/".length()) : file;

        JsonObject optional = new JsonObject();
        JsonArray events = new JsonArray();
        JsonObject summary = null;
        try {
            Path factsPath = findLatestFacts(WatchtowerPaths.reportDir(serverContext));
            if (factsPath != null) {
                JsonObject facts = GSON.fromJson(Files.readString(factsPath), JsonObject.class);
                if (facts.has("optional")) {
                    optional = facts.getAsJsonObject("optional");
                }
                if (facts.has("events")) {
                    events = facts.getAsJsonArray("events");
                }
                if (optional.has("crash_summaries")) {
                    for (JsonElement el : optional.getAsJsonArray("crash_summaries")) {
                        JsonObject row = el.getAsJsonObject();
                        String rowFile = row.has("file") ? row.get("file").getAsString() : "";
                        if (bareFile.equals(rowFile) || file.equals(rowFile)) {
                            summary = row;
                            break;
                        }
                    }
                }
            }
        } catch (IOException ignored) {
        }

        long crashEpoch = 0;
        if (summary != null && summary.has("time")) {
            Instant t = TimeParse.parseTime(summary.get("time").getAsString());
            if (t != null) {
                crashEpoch = t.getEpochSecond();
            }
        }
        if (crashEpoch <= 0) {
            Path crashPath = serverContext.serverDirectory().resolve("crash-reports").resolve(bareFile);
            if (Files.isRegularFile(crashPath)) {
                crashEpoch = Files.getLastModifiedTime(crashPath).toInstant().getEpochSecond();
            }
        }
        if (crashEpoch <= 0) {
            send(ex, 404, "text/plain", "Crash not found");
            return;
        }

        Path logPath = serverContext.serverDirectory().resolve("logs").resolve("latest.log");
        JsonObject preCrash = PreCrashContextBuilder.build(
                crashEpoch,
                minutes,
                LiveMetricsService.get().store(),
                logPath,
                optional,
                events);
        if (preCrash.has("unavailable_reason") && summary != null && summary.has("pre_crash")) {
            JsonObject persisted = summary.getAsJsonObject("pre_crash");
            if (persisted.has("tps") && persisted.getAsJsonObject("tps").has("points")
                    && persisted.getAsJsonObject("tps").getAsJsonArray("points").size() > 0) {
                preCrash = persisted.deepCopy();
            }
        }

        JsonObject out = new JsonObject();
        out.addProperty("file", bareFile);
        out.addProperty("minutes", minutes);
        out.add("pre_crash", preCrash);
        sendJson(ex, 200, out);
    }

    private static final int MAX_CRASH_REPORT_BYTES = 512 * 1024;
    private static final int MAX_LOG_BYTES = 1024 * 1024;
    private static final int DEFAULT_LOG_TAIL = 2000;
    private static final int MAX_LOG_TAIL = 20000;

    private void handleLogsList(HttpExchange ex) throws IOException {
        if (!"GET".equalsIgnoreCase(ex.getRequestMethod())) {
            send(ex, 405, "text/plain", "Method not allowed");
            return;
        }
        if (!requireApiAuth(ex)) {
            return;
        }
        if (serverContext == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        Path logsDir = serverContext.serverDirectory().resolve("logs");
        JsonArray files = new JsonArray();
        if (Files.isDirectory(logsDir)) {
            List<JsonObject> rows = new ArrayList<>();
            try (Stream<Path> stream = Files.list(logsDir)) {
                stream.filter(Files::isRegularFile)
                        .filter(p -> {
                            String name = p.getFileName().toString();
                            return "latest.log".equals(name)
                                    || "debug.log".equals(name)
                                    || name.endsWith(".log.gz");
                        })
                        .forEach(p -> {
                            try {
                                String name = p.getFileName().toString();
                                JsonObject row = new JsonObject();
                                row.addProperty("name", name);
                                row.addProperty("size", Files.size(p));
                                row.addProperty("mtime", Files.getLastModifiedTime(p).toMillis() / 1000L);
                                row.addProperty("gz", name.endsWith(".gz"));
                                rows.add(row);
                            } catch (IOException ignored) {
                            }
                        });
            }
            rows.sort(Comparator.comparingLong((JsonObject o) -> o.get("mtime").getAsLong()).reversed());
            for (JsonObject row : rows) {
                files.add(row);
            }
        }
        JsonObject out = new JsonObject();
        out.add("files", files);
        sendJson(ex, 200, out);
    }

    private void handleLogsContent(HttpExchange ex) throws IOException {
        if (!"GET".equalsIgnoreCase(ex.getRequestMethod())) {
            send(ex, 405, "text/plain", "Method not allowed");
            return;
        }
        if (!requireApiAuth(ex)) {
            return;
        }
        if (serverContext == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        String file = null;
        int tail = DEFAULT_LOG_TAIL;
        String q = ex.getRequestURI().getQuery();
        if (q != null) {
            for (String part : q.split("&")) {
                if (part.startsWith("file=")) {
                    file = URLDecoder.decode(part.substring(5), StandardCharsets.UTF_8);
                } else if (part.startsWith("tail=")) {
                    try {
                        tail = Integer.parseInt(part.substring(5));
                    } catch (NumberFormatException ignored) {
                    }
                }
            }
        }
        if (file == null || file.isBlank()) {
            send(ex, 400, "text/plain", "Missing file parameter");
            return;
        }
        if (file.contains("..") || file.contains("/") || file.contains("\\")) {
            send(ex, 400, "text/plain", "Invalid file");
            return;
        }
        if (!(file.endsWith(".log") || file.endsWith(".log.gz"))) {
            send(ex, 400, "text/plain", "Invalid file type");
            return;
        }
        final int tailLines = Math.max(1, Math.min(MAX_LOG_TAIL, tail));
        Path logPath = serverContext.serverDirectory().resolve("logs").resolve(file);
        if (!Files.isRegularFile(logPath)) {
            send(ex, 404, "text/plain", "Log file not found");
            return;
        }
        long size = Files.size(logPath);
        // Keep a ring of the last `tailLines` lines while scanning (works for gzip too).
        String[] ring = new String[tailLines];
        final int[] writtenHolder = new int[]{0};
        GzipLineReader.forEachLine(logPath, (lineNo, line) -> {
            ring[writtenHolder[0] % tailLines] = line;
            writtenHolder[0]++;
        });
        int written = writtenHolder[0];
        int keep = Math.min(written, tailLines);
        int start = written > tailLines ? written % tailLines : 0;
        StringBuilder sb = new StringBuilder();
        long outBytes = 0;
        boolean truncatedByBytes = false;
        int emitted = 0;
        for (int i = 0; i < keep; i++) {
            String line = written <= tailLines ? ring[i] : ring[(start + i) % tailLines];
            if (line == null) {
                continue;
            }
            long add = line.length() + (sb.length() > 0 ? 1L : 0L);
            if (outBytes + add > MAX_LOG_BYTES) {
                truncatedByBytes = true;
                break;
            }
            if (sb.length() > 0) {
                sb.append('\n');
            }
            sb.append(line);
            outBytes += add;
            emitted++;
        }
        boolean truncated = written > keep || truncatedByBytes;
        JsonObject out = new JsonObject();
        out.addProperty("file", file);
        out.addProperty("content", sb.toString());
        out.addProperty("truncated", truncated);
        out.addProperty("size", size);
        out.addProperty("lines", emitted);
        sendJson(ex, 200, out);
    }

    private void handleCrashReport(HttpExchange ex) throws IOException {
        if (!"GET".equalsIgnoreCase(ex.getRequestMethod())) {
            send(ex, 405, "text/plain", "Method not allowed");
            return;
        }
        if (!requireApiAuth(ex)) {
            return;
        }
        if (serverContext == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        String file = null;
        String q = ex.getRequestURI().getQuery();
        if (q != null) {
            for (String part : q.split("&")) {
                if (part.startsWith("file=")) {
                    file = java.net.URLDecoder.decode(part.substring(5), StandardCharsets.UTF_8);
                }
            }
        }
        if (file == null || file.isBlank()) {
            send(ex, 400, "text/plain", "Missing file parameter");
            return;
        }
        String bareFile = file.startsWith("crash-reports/") ? file.substring("crash-reports/".length()) : file;
        if (bareFile.contains("..") || bareFile.contains("/") || bareFile.contains("\\")) {
            send(ex, 400, "text/plain", "Invalid file");
            return;
        }
        Path crashPath = serverContext.serverDirectory().resolve("crash-reports").resolve(bareFile);
        if (!Files.isRegularFile(crashPath)) {
            send(ex, 404, "text/plain", "Crash report not found");
            return;
        }
        long size = Files.size(crashPath);
        boolean truncated = size > MAX_CRASH_REPORT_BYTES;
        byte[] bytes = Files.readAllBytes(crashPath);
        int limit = truncated ? MAX_CRASH_REPORT_BYTES : bytes.length;
        String content = new String(bytes, 0, limit, StandardCharsets.UTF_8);
        JsonObject out = new JsonObject();
        out.addProperty("file", bareFile);
        out.addProperty("content", content);
        out.addProperty("truncated", truncated);
        out.addProperty("size", size);
        sendJson(ex, 200, out);
    }

    private void handleCrashScan(HttpExchange ex) throws IOException {
        if (!"POST".equalsIgnoreCase(ex.getRequestMethod())) {
            send(ex, 405, "text/plain", "Method not allowed");
            return;
        }
        if (!requireApiAuth(ex)) {
            return;
        }
        if (serverContext == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        try {
            Path statePath = WatchtowerPaths.statePath(serverContext);
            Path opsCachePath = WatchtowerPaths.opsCachePath(serverContext);
            Path rollupsPath = WatchtowerPaths.performanceRollupsPath(serverContext);
            String serverDir = serverContext.serverDirectory().toAbsolutePath().toString();
            ReportConfig crashCfg = ModReportConfig.forServer(serverContext);
            // Manual Scan always force-reenriches so jar upgrades refresh Unknown labels.
            CrashMtimeScanner.ScanResult scan = CrashMtimeScanner.scan(
                    serverDir, statePath, crashCfg.crashEnrichOnMtime(), true);
            OpsCacheWriter.applyScanResult(
                    opsCachePath, statePath, rollupsPath, scan, OpsCacheSchema.SOURCE_SCAN);

            JsonObject out = new JsonObject();
            out.addProperty("scanned_at", scan.scannedAt().toString());
            out.addProperty("new_count", scan.newCount());
            out.addProperty("unreviewed", scan.unreviewed());
            JsonArray crashes = new JsonArray();
            for (CrashMtimeScanner.CrashEntry entry : scan.entries()) {
                JsonObject row = new JsonObject();
                row.addProperty("file", entry.file());
                row.addProperty("mtime", entry.mtime());
                row.addProperty("size", entry.size());
                if (entry.displayLabel() != null && !entry.displayLabel().isBlank()) {
                    row.addProperty("display_label", entry.displayLabel());
                }
                crashes.add(row);
            }
            out.add("crashes", crashes);
            sendJson(ex, 200, out);
        } catch (Exception e) {
            ModRuntime.logger().warn("Crash scan failed: {}", e.toString());
            JsonObject err = new JsonObject();
            err.addProperty("error", e.getMessage() != null ? e.getMessage() : "scan failed");
            sendJson(ex, 500, err);
        }
    }

    private void handleOpsCache(HttpExchange ex) throws IOException {
        if (!"GET".equalsIgnoreCase(ex.getRequestMethod())) {
            send(ex, 405, "text/plain", "Method not allowed");
            return;
        }
        if (!requireApiAuth(ex)) {
            return;
        }
        if (serverContext == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        sendJson(ex, 200, OpsCacheReader.load(WatchtowerPaths.opsCachePath(serverContext)));
    }

    private static Path findLatestFacts(Path dir) throws IOException {
        return ReportArtifactFinder.findLatestFacts(dir);
    }

    private void serveResource(HttpExchange ex, String classpath, String contentType) throws IOException {
        try (InputStream in = DashboardHttpServer.class.getClassLoader().getResourceAsStream(classpath)) {
            if (in == null) {
                send(ex, 404, "text/plain", "Not found: " + classpath);
                return;
            }
            byte[] bytes = in.readAllBytes();
            Headers h = ex.getResponseHeaders();
            DashboardAuthHttp.applySecurityHeaders(h);
            h.set("Content-Type", contentType);
            // Dashboard HTML/JS/CSS change with every mod jar; avoid stale preview-vs-live mismatch.
            if (classpath.endsWith(".html")
                    || classpath.endsWith(".js")
                    || classpath.endsWith(".css")
                    || classpath.endsWith("index.html")) {
                h.set("Cache-Control", "no-store");
            } else if (classpath.endsWith(".png")
                    || classpath.endsWith(".svg")
                    || classpath.endsWith(".woff2")
                    || classpath.endsWith(".ico")) {
                h.set("Cache-Control", "private, max-age=300");
            }
            ex.sendResponseHeaders(200, bytes.length);
            try (OutputStream os = ex.getResponseBody()) {
                os.write(bytes);
            }
        }
    }

    private static JsonObject sparkTldrFromProfile(JsonObject sparkProfile) {
        if (sparkProfile == null) {
            return null;
        }
        JsonObject sparkTldr = new JsonObject();
        if (sparkProfile.has("verdict") && sparkProfile.get("verdict").isJsonObject()) {
            JsonObject verdict = sparkProfile.getAsJsonObject("verdict");
            if (verdict.has("headline")) {
                sparkTldr.addProperty("label", verdict.get("headline").getAsString());
            }
            if (verdict.has("grade")) {
                sparkTldr.addProperty("grade", verdict.get("grade").getAsString());
            }
        }
        if (sparkProfile.has("mod_hints")
                && sparkProfile.get("mod_hints").isJsonArray()
                && !sparkProfile.getAsJsonArray("mod_hints").isEmpty()) {
            JsonObject top = sparkProfile.getAsJsonArray("mod_hints").get(0).getAsJsonObject();
            if (top.has("mod_id")) {
                sparkTldr.addProperty("mod_id", top.get("mod_id").getAsString());
            }
            if (top.has("pct")) {
                sparkTldr.addProperty("pct", top.get("pct").getAsDouble());
            }
        }
        if (sparkProfile.has("captured_at")) {
            sparkTldr.addProperty("captured_at", sparkProfile.get("captured_at").getAsString());
        }
        if (sparkProfile.has("source_path")) {
            sparkTldr.addProperty("source_path", sparkProfile.get("source_path").getAsString());
        }
        sparkTldr.addProperty("fresh", true);
        return sparkTldr.has("label") || sparkTldr.has("grade") || sparkTldr.has("mod_id")
                ? sparkTldr : null;
    }

    private static void sendJson(HttpExchange ex, int code, JsonObject json) throws IOException {
        byte[] bytes = GSON.toJson(json).getBytes(StandardCharsets.UTF_8);
        Headers h = ex.getResponseHeaders();
        DashboardAuthHttp.applySecurityHeaders(h);
        h.set("Content-Type", "application/json; charset=utf-8");
        ex.sendResponseHeaders(code, bytes.length);
        try (OutputStream os = ex.getResponseBody()) {
            os.write(bytes);
        }
    }

    private static void send(HttpExchange ex, int code, String type, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        Headers h = ex.getResponseHeaders();
        DashboardAuthHttp.applySecurityHeaders(h);
        h.set("Content-Type", type);
        ex.sendResponseHeaders(code, bytes.length);
        try (OutputStream os = ex.getResponseBody()) {
            os.write(bytes);
        }
    }
}
