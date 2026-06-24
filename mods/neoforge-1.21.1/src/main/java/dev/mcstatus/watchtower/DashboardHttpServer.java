package dev.mcstatus.watchtower;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.sun.net.httpserver.Headers;
import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;
import dev.mcstatus.watchtower.core.WatchtowerFiles;
import dev.mcstatus.watchtower.core.report.StateManager;
import dev.mcstatus.watchtower.core.analyze.BackupStatusResolver;
import dev.mcstatus.watchtower.core.analyze.PreCrashContextBuilder;
import dev.mcstatus.watchtower.core.analyze.PerformanceDashboardBuilder;
import dev.mcstatus.watchtower.core.analyze.PerformanceContext;
import dev.mcstatus.watchtower.core.analyze.PerformanceInsightEngine;
import dev.mcstatus.watchtower.core.analyze.RssHeapEvaluator;
import dev.mcstatus.watchtower.core.analyze.ScorecardBuilder;
import dev.mcstatus.watchtower.core.live.PerformanceRollupWriter;
import dev.mcstatus.watchtower.core.collect.CrashMtimeScanner;
import dev.mcstatus.watchtower.core.collect.CraftyCollector;
import dev.mcstatus.watchtower.core.collect.ExternalBackupDetector;
import dev.mcstatus.watchtower.core.incident.IncidentReader;
import dev.mcstatus.watchtower.core.ops.ActivityLedgerScanner;
import dev.mcstatus.watchtower.core.ops.OpsCacheReader;
import dev.mcstatus.watchtower.core.ops.OpsCacheSchema;
import dev.mcstatus.watchtower.core.ops.OpsCacheWriter;
import dev.mcstatus.watchtower.core.fs.FsBrowseService;
import dev.mcstatus.watchtower.core.panel.PanelInfo;
import dev.mcstatus.watchtower.core.panel.PanelLabels;
import dev.mcstatus.watchtower.core.panel.PanelResolver;
import dev.mcstatus.watchtower.core.collect.HostMetricsCollector;
import dev.mcstatus.watchtower.core.collect.ReportArtifactFinder;
import dev.mcstatus.watchtower.core.collect.SparkCollector;
import dev.mcstatus.watchtower.core.collect.SparkProfileBuilder;
import dev.mcstatus.watchtower.core.collect.SparkProfileEntry;
import dev.mcstatus.watchtower.core.collect.SparkProfileFacts;
import dev.mcstatus.watchtower.core.report.OverviewMetaBuilder;
import dev.mcstatus.watchtower.core.report.ReportConfig;
import dev.mcstatus.watchtower.core.report.ReportSchedule;
import dev.mcstatus.watchtower.core.report.SupportBundlePackager;
import dev.mcstatus.watchtower.core.update.ReleaseVersionChecker;
import dev.mcstatus.watchtower.core.util.TimeParse;
import net.minecraft.server.MinecraftServer;
import net.neoforged.fml.ModList;

import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.InetSocketAddress;
import java.net.URLDecoder;
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
import java.util.Map;
import java.util.Set;
import java.util.concurrent.Executors;
import java.util.stream.Stream;

/**
 * Embedded dashboard HTTP server (JDK HttpServer).
 */
public final class DashboardHttpServer {
    private static final Gson GSON = new GsonBuilder().create();
    private static final String WEB_PREFIX = "assets/watchtower/web/";
    private static final String FAVICON_RESOURCE = WEB_PREFIX + "assets/watchtower-icon-simple.png";

    private HttpServer server;
    private MinecraftServer minecraftServer;

    public void start(MinecraftServer mcServer) {
        if (!WatchtowerConfig.DASHBOARD_ENABLED.get()) {
            return;
        }
        stop();
        this.minecraftServer = mcServer;
        try {
            String host = WatchtowerConfig.DASHBOARD_BIND_HOST.get();
            int port = WatchtowerConfig.DASHBOARD_PORT.get();
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
            server.createContext("/api/performance/export", this::handlePerformanceExport);
            server.createContext("/api/server/icon", this::handleServerIcon);
            server.createContext("/api/support/bundle", this::handleSupportBundle);
            server.createContext("/api/reports/latest", this::handleReportsLatest);
            server.createContext("/api/reports/index", this::handleReportsIndex);
            server.createContext("/api/reports/get", this::handleReportsGet);
            server.createContext("/api/reports/status", this::handleReportsStatus);
            server.createContext("/api/activity", this::handleActivity);
            server.createContext("/api/activity/scan", this::handleActivityScan);
            server.createContext("/api/onboarding/audit", this::handleOnboardingAudit);
            server.createContext("/api/incidents", this::handleIncidents);
            server.createContext("/api/incidents/get", this::handleIncidentGet);
            server.createContext("/api/incidents/pin", this::handleIncidentPin);
            server.createContext("/api/issues/peek", this::handleIssuesPeek);
            server.createContext("/api/reports/run", this::handleReportsRun);
            server.createContext("/api/crashes/acks", this::handleCrashAcks);
            server.createContext("/api/crashes/ack", this::handleCrashAck);
            server.createContext("/api/crashes/context", this::handleCrashContext);
            server.createContext("/api/crashes/report", this::handleCrashReport);
            server.createContext("/api/crashes/scan", this::handleCrashScan);
            server.createContext("/api/mods/scan", this::handleModsScan);
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
            WatchtowerMod.LOGGER.info("Watchtower dashboard: http://{}:{}", host, port);
        } catch (IOException e) {
            WatchtowerMod.LOGGER.error("Failed to start dashboard HTTP server", e);
        }
    }

    public void stop() {
        if (server != null) {
            server.stop(0);
            server = null;
        }
        minecraftServer = null;
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
            if (!html.contains("data-embedded=\"true\"")) {
                html = html.replaceFirst(
                        "<html lang=\"en\" data-theme=\"dark\">",
                        "<html lang=\"en\" data-theme=\"dark\" data-embedded=\"true\">"
                );
            }
            byte[] bytes = html.getBytes(StandardCharsets.UTF_8);
            Headers h = ex.getResponseHeaders();
            DashboardAuthHttp.applySecurityHeaders(h);
            h.set("Content-Type", "text/html; charset=utf-8");
            ex.sendResponseHeaders(200, bytes.length);
            try (OutputStream os = ex.getResponseBody()) {
                os.write(bytes);
            }
        }
    }

    private static String contentTypeForWebAsset(String name) {
        if (name.endsWith(".css")) {
            return "text/css; charset=utf-8";
        }
        if (name.endsWith(".js")) {
            return "application/javascript; charset=utf-8";
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
        if (DashboardAuthHttp.requireFullSession(ex) != null) {
            OpsPollScheduler.get().refreshSchedule();
            return true;
        }
        return false;
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
        if (minecraftServer == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        JsonObject roster = PlayerRosterService.get().getRoster(minecraftServer);
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
        int maxMinutes = WatchtowerConfig.LIVE_RETENTION_HOURS.get() * 60;
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
        cfg.addProperty("live_sample_interval_sec", WatchtowerConfig.LIVE_SAMPLE_INTERVAL_SECONDS.get());
        cfg.addProperty("live_retention_hours", WatchtowerConfig.LIVE_RETENTION_HOURS.get());
        cfg.addProperty("embedded", true);
        cfg.addProperty("hostname", resolveHostname());
        String bindHost = WatchtowerConfig.DASHBOARD_BIND_HOST.get();
        cfg.addProperty("dashboard_bind_host", bindHost);
        cfg.addProperty("bind_exposed", "0.0.0.0".equals(bindHost));
        cfg.addProperty("auth_required", true);
        String version = ModList.get().getModContainerById(WatchtowerMod.MOD_ID)
                .map(c -> c.getModInfo().getVersion().toString())
                .orElse("unknown");
        cfg.addProperty("mod_version", version);
        cfg.addProperty("report_timeout_minutes", WatchtowerConfig.REPORT_TIMEOUT_MINUTES.get());
        if (minecraftServer != null) {
            Path iconPath = minecraftServer.getServerDirectory().resolve("server-icon.png");
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
        if (minecraftServer == null) {
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
                Path conf = WatchtowerPaths.confPath(minecraftServer);
                Map<String, String> map = WatchtowerConfWriter.readMap(conf);
                String text = Files.isRegularFile(conf) ? Files.readString(conf, StandardCharsets.UTF_8) : "";

                if (json.has("reportScheduleMode") && !json.get("reportScheduleMode").isJsonNull()) {
                    String mode = json.get("reportScheduleMode").getAsString().trim().toLowerCase();
                    if ("off".equals(mode)) {
                        WatchtowerConfWriter.persistReportSchedule(minecraftServer, ReportSchedule.off());
                    } else if (ReportSchedule.MODE_WALL_CLOCK.equals(mode)) {
                        String hoursRaw = json.has("reportWallClockHours")
                                ? json.get("reportWallClockHours").getAsString()
                                : ReportSchedule.wallClockHoursToString(ReportSchedule.DEFAULT_WALL_CLOCK_HOURS);
                        WatchtowerConfWriter.persistReportSchedule(
                                minecraftServer,
                                ReportSchedule.wallClock(ReportSchedule.parseHours(hoursRaw))
                        );
                    } else if (json.has("reportIntervalMinutes") && !json.get("reportIntervalMinutes").isJsonNull()) {
                        int minutes = Math.max(1, Math.min(10080, json.get("reportIntervalMinutes").getAsInt()));
                        WatchtowerConfWriter.persistReportSchedule(minecraftServer, ReportSchedule.interval(minutes));
                    }
                } else if (json.has("reportIntervalMinutes") && !json.get("reportIntervalMinutes").isJsonNull()) {
                    int minutes = json.get("reportIntervalMinutes").getAsInt();
                    minutes = Math.max(0, Math.min(10080, minutes));
                    if (minutes <= 0) {
                        WatchtowerConfWriter.persistReportSchedule(minecraftServer, ReportSchedule.off());
                    } else {
                        WatchtowerConfWriter.persistReportSchedule(minecraftServer, ReportSchedule.interval(minutes));
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
                if (json.has("lookbackHours") || json.has("incremental")
                        || json.has("tpsWarn") || json.has("msptWarn")) {
                    Files.writeString(conf, text, StandardCharsets.UTF_8);
                }

                JsonObject out = new JsonObject();
                out.addProperty("ok", true);
                out.add("settings", buildSettingsJson());
                sendJson(ex, 200, out);
            } catch (Exception e) {
                WatchtowerMod.LOGGER.warn("Settings save failed: {}", e.toString());
                JsonObject err = new JsonObject();
                err.addProperty("error", e.getMessage() != null ? e.getMessage() : "save failed");
                sendJson(ex, 500, err);
            }
            return;
        }
        send(ex, 405, "text/plain", "Method not allowed");
    }

    private JsonObject buildSettingsJson() throws IOException {
        Path conf = WatchtowerPaths.confPath(minecraftServer);
        Map<String, String> map = new HashMap<>(WatchtowerConfWriter.readMap(conf));
        map.put("SERVER_DIR", minecraftServer.getServerDirectory().toAbsolutePath().toString());
        ReportConfig config = ModReportConfig.forServer(minecraftServer);
        PanelInfo panel = PanelResolver.resolve(map, minecraftServer.getServerDirectory());

        JsonObject out = new JsonObject();
        WatchtowerScheduler scheduler = WatchtowerBootstrap.getScheduler();
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
        String backupDir = map.getOrDefault("BACKUP_DIR", "");
        out.addProperty("backup_dir", backupDir != null ? backupDir : "");
        String backupDirs = map.getOrDefault("BACKUP_DIRS", "");
        out.addProperty("backup_dirs", backupDirs != null ? backupDirs : "");
        out.addProperty("backup_external_configured", config.isExternalBackupConfigured());
        out.addProperty("backup_webhook_enabled",
                config.backupWebhookToken() != null && !config.backupWebhookToken().isBlank());
        out.addProperty("backup_suppress_local_missing", config.backupSuppressLocalMissing());
        out.addProperty("backup_tracking_mode", BackupExternalConfigService.deriveTrackingMode(config));
        out.addProperty("dashboard_port", WatchtowerConfig.DASHBOARD_PORT.get());
        Path markerPath = ExternalBackupDetector.resolveMarkerPath(
                minecraftServer.getServerDirectory().toAbsolutePath().toString(), config);
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
        out.addProperty("tps_warn", config.tpsWarn());
        out.addProperty("mspt_warn", config.msptWarn());
        out.addProperty("metrics_context_banner", config.metricsContextBanner());
        out.addProperty("update_check", config.updateCheck());
        out.addProperty("hostname", resolveHostname());
        out.addProperty("ops_poll_sec", config.opsPollSec());
        out.addProperty("ops_log_scan_sec", config.opsLogScanSec());
        out.addProperty("report_retention_count", config.reportRetentionCount());
        out.addProperty("report_retention_days", config.reportRetentionDays());
        try {
            out.addProperty("live_sample_interval_seconds", WatchtowerConfig.LIVE_SAMPLE_INTERVAL_SECONDS.get());
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
        if (minecraftServer == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        JsonObject out = new JsonObject();

        String liveAt = resolveLiveAt();
        if (liveAt != null) {
            out.addProperty("live_at", liveAt);
        }

        try {
            JsonObject opsCache = OpsCacheReader.load(WatchtowerPaths.opsCachePath(minecraftServer));
            if (opsCache.has(OpsCacheSchema.UPDATED_AT)) {
                out.addProperty("ops_scan_at", opsCache.get(OpsCacheSchema.UPDATED_AT).getAsString());
            }
        } catch (IOException ignored) {
        }

        try {
            Path reportDir = WatchtowerPaths.reportDir(minecraftServer);
            Path factsPath = ReportArtifactFinder.findLatestFacts(reportDir);
            if (factsPath != null && Files.isRegularFile(factsPath)) {
                out.addProperty("full_report_at", Files.getLastModifiedTime(factsPath).toInstant().toString());
            }
        } catch (IOException ignored) {
        }

        WatchtowerScheduler scheduler = WatchtowerBootstrap.getScheduler();
        out.addProperty("next_scheduled_minutes", scheduler.minutesUntilNextReport());

        ReportConfig config = ModReportConfig.forServer(minecraftServer);
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
        if (minecraftServer == null) {
            return null;
        }
        try {
            Path livePath = WatchtowerPaths.liveHistoryPath(minecraftServer);
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
        if (minecraftServer == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        Path conf = WatchtowerPaths.confPath(minecraftServer);
        Map<String, String> map = WatchtowerConfWriter.readMap(conf);
        ReportConfig config = ModReportConfig.forServer(minecraftServer);
        boolean enabled = WatchtowerConfWriter.readBool(map, "UPDATE_CHECK", config.updateCheck());
        String version = ModList.get().getModContainerById(WatchtowerMod.MOD_ID)
                .map(c -> c.getModInfo().getVersion().toString())
                .orElse("unknown");
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
        if (minecraftServer == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        Path icon = minecraftServer.getServerDirectory().resolve("server-icon.png");
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
        if (minecraftServer == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        Path reportDir = WatchtowerPaths.reportDir(minecraftServer);
        Path serverDir = minecraftServer.getServerDirectory();
        Path conf = WatchtowerPaths.confPath(minecraftServer);
        Map<String, String> map = WatchtowerConfWriter.readMap(conf);
        ReportConfig config = ModReportConfig.forServer(minecraftServer);
        PanelInfo panel = PanelResolver.resolve(map, serverDir);
        String version = ModList.get().getModContainerById(WatchtowerMod.MOD_ID)
                .map(c -> c.getModInfo().getVersion().toString())
                .orElse("unknown");

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
        applyScorecardAndOpsMeta(meta, reportDir, config, optional);
        sendJson(ex, 200, meta);
    }

    private void applyScorecardAndOpsMeta(JsonObject meta, Path reportDir, ReportConfig config, JsonObject optional) {
        if (minecraftServer == null) {
            return;
        }
        Path opsCachePath = WatchtowerPaths.opsCachePath(minecraftServer);
        Path rollupsPath = WatchtowerPaths.performanceRollupsPath(minecraftServer);
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
                JsonObject sparkTldr = new JsonObject();
                if (sparkProfile.has("verdict")) {
                    JsonObject verdict = sparkProfile.getAsJsonObject("verdict");
                    if (verdict.has("headline")) {
                        sparkTldr.addProperty("label", verdict.get("headline").getAsString());
                    }
                    if (verdict.has("grade")) {
                        sparkTldr.addProperty("grade", verdict.get("grade").getAsString());
                    }
                }
                if (sparkProfile.has("mod_hints") && !sparkProfile.getAsJsonArray("mod_hints").isEmpty()) {
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
                sparkTldr.addProperty("fresh", true);
                meta.add("spark_tldr", sparkTldr);
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
                lastBackup, backupExternal, config.backupWarnDays()));
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
    }

    private int scorecardLowTpsThresholdFromConf() {
        if (minecraftServer == null) {
            return 5;
        }
        try {
            Map<String, String> map = WatchtowerConfWriter.readMap(WatchtowerPaths.confPath(minecraftServer));
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
        if (minecraftServer == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        String window = parseQueryParam(ex.getRequestURI().getQuery(), "window");
        if (window == null || window.isBlank()) {
            window = "7d";
        }
        try {
            ReportConfig config = ModReportConfig.forServer(minecraftServer);
            if (!config.l1RollupEnabled()) {
                JsonObject disabled = new JsonObject();
                disabled.addProperty("enabled", false);
                disabled.addProperty("window", window);
                sendJson(ex, 200, disabled);
                return;
            }
            int hours = PerformanceInsightEngine.windowToHours(window);
            Path rollupsPath = WatchtowerPaths.performanceRollupsPath(minecraftServer);
            List<JsonObject> rows = LiveMetricsService.get().rollupWriter().loadRowsForHours(hours);
            if (rows.isEmpty()) {
                rows = PerformanceRollupWriter.loadRowsFromFile(rollupsPath, hours);
            }
            JsonObject out = PerformanceInsightEngine.analyze(rows, window, config.msptWarn(), config.tpsWarn());
            sendJson(ex, 200, out);
        } catch (Exception e) {
            WatchtowerMod.LOGGER.warn("Performance insights failed: {}", e.toString());
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
        if (minecraftServer == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        String window = parseQueryParam(ex.getRequestURI().getQuery(), "window");
        if (window == null || window.isBlank()) {
            window = "7d";
        }
        try {
            ReportConfig config = ModReportConfig.forServer(minecraftServer);
            if (!config.l1RollupEnabled()) {
                JsonObject disabled = new JsonObject();
                disabled.addProperty("enabled", false);
                disabled.addProperty("window", window);
                sendJson(ex, 200, disabled);
                return;
            }
            int hours = PerformanceInsightEngine.windowToHours(window);
            Path rollupsPath = WatchtowerPaths.performanceRollupsPath(minecraftServer);
            int loadHours = Math.min(hours * 2, config.l1RetentionDays() * 24);
            List<JsonObject> rows = LiveMetricsService.get().rollupWriter().loadRowsForHours(loadHours);
            if (rows.isEmpty()) {
                rows = PerformanceRollupWriter.loadRowsFromFile(rollupsPath, loadHours);
            }

            Path opsCachePath = WatchtowerPaths.opsCachePath(minecraftServer);
            JsonObject opsCache = OpsCacheReader.load(opsCachePath);
            List<JsonObject> incidents = IncidentReader.listSummaries(
                    WatchtowerPaths.incidentsDir(minecraftServer), 50);

            JsonObject scorecardPerf = null;
            try {
                Path reportDir = WatchtowerPaths.reportDir(minecraftServer);
                Path factsPath = ReportArtifactFinder.findLatestFacts(reportDir);
                JsonObject facts = null;
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

            long windowStart = java.time.Instant.now().getEpochSecond() - (long) hours * 3600L;
            PerformanceContext ctx = new PerformanceContext(opsCache, incidents, scorecardPerf, windowStart);
            JsonObject out = PerformanceDashboardBuilder.build(rows, window, config.msptWarn(), config.tpsWarn(), ctx);
            sendJson(ex, 200, out);
        } catch (Exception e) {
            WatchtowerMod.LOGGER.warn("Performance dashboard failed: {}", e.toString());
            JsonObject err = new JsonObject();
            err.addProperty("error", e.getMessage() != null ? e.getMessage() : "dashboard failed");
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
        if (minecraftServer == null) {
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
            ReportConfig config = ModReportConfig.forServer(minecraftServer);
            int hours = PerformanceInsightEngine.windowToHours(window);
            Path rollupsPath = WatchtowerPaths.performanceRollupsPath(minecraftServer);
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
            WatchtowerMod.LOGGER.warn("Performance export failed: {}", e.toString());
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

    private void handleSupportBundle(HttpExchange ex) throws IOException {
        if (!"GET".equalsIgnoreCase(ex.getRequestMethod())) {
            send(ex, 405, "text/plain", "Method not allowed");
            return;
        }
        if (!requireApiAuth(ex)) {
            return;
        }
        if (minecraftServer == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        Path reportDir = WatchtowerPaths.reportDir(minecraftServer);
        Path facts = ReportArtifactFinder.findLatestFacts(reportDir);
        Path brief = ReportArtifactFinder.findLatestBrief(reportDir);
        if (facts == null) {
            JsonObject err = new JsonObject();
            err.addProperty("error", "no_report");
            sendJson(ex, 404, err);
            return;
        }
        SupportBundlePackager.BundleResult result =
                SupportBundlePackager.packageSupportBundle(reportDir, facts, brief);
        byte[] bytes = Files.readAllBytes(result.zipPath());
        Headers h = ex.getResponseHeaders();
        DashboardAuthHttp.applySecurityHeaders(h);
        h.set("Content-Type", "application/zip");
        h.set("Content-Disposition", "attachment; filename=\"" + result.zipPath().getFileName() + "\"");
        ex.sendResponseHeaders(200, bytes.length);
        try (OutputStream os = ex.getResponseBody()) {
            os.write(bytes);
        }
    }

    private void handleReportsLatest(HttpExchange ex) throws IOException {
        if (!"GET".equalsIgnoreCase(ex.getRequestMethod())) {
            send(ex, 405, "text/plain", "Method not allowed");
            return;
        }
        if (!requireApiAuth(ex)) {
            return;
        }
        if (minecraftServer == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        Path facts = findLatestFacts(WatchtowerPaths.reportDir(minecraftServer));
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
        if (minecraftServer == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        JsonArray reports = new JsonArray();
        Path dir = WatchtowerPaths.reportDir(minecraftServer);
        if (Files.isDirectory(dir)) {
            try (Stream<Path> stream = Files.list(dir)) {
                List<Path> facts = stream
                        .filter(p -> p.getFileName().toString().startsWith(WatchtowerFiles.FACTS_PREFIX)
                                && p.getFileName().toString().endsWith(".json"))
                        .sorted(Comparator.comparing(p -> {
                            try {
                                return Files.getLastModifiedTime((Path) p).toInstant();
                            } catch (IOException e) {
                                return Instant.EPOCH;
                            }
                        }).reversed())
                        .toList();
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
            }
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
        if (minecraftServer == null) {
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
        Path dir = WatchtowerPaths.reportDir(minecraftServer);
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
        if (minecraftServer == null) {
            return "server";
        }
        try {
            Path facts = findLatestFacts(WatchtowerPaths.reportDir(minecraftServer));
            if (facts != null) {
                JsonObject meta = GSON.fromJson(Files.readString(facts), JsonObject.class)
                        .getAsJsonObject("meta");
                if (meta != null && meta.has("hostname") && !meta.get("hostname").isJsonNull()) {
                    return meta.get("hostname").getAsString();
                }
            }
        } catch (IOException ignored) {
        }
        return minecraftServer.getServerDirectory().getFileName().toString();
    }

    private void handleReportsStatus(HttpExchange ex) throws IOException {
        if (!"GET".equalsIgnoreCase(ex.getRequestMethod())) {
            send(ex, 405, "text/plain", "Method not allowed");
            return;
        }
        if (!requireApiAuth(ex)) {
            return;
        }
        WatchtowerRuntimeState state = WatchtowerBootstrap.getState();
        JsonObject out = new JsonObject();
        out.addProperty("running", state.isReportRunning());
        state.getLastReportStarted().ifPresent(t -> out.addProperty("started_at", t.toString()));
        state.getLastReportFinished().ifPresent(t -> out.addProperty("finished_at", t.toString()));
        out.addProperty("success", state.isLastReportSuccess());
        out.addProperty("message", state.getLastReportMessage());
        String factsPath = state.getLastFactsPath();
        if (factsPath != null && !factsPath.isBlank()) {
            out.addProperty("facts_path", factsPath);
        }
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
        if (minecraftServer == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        int hours = parseHoursQuery(ex.getRequestURI().getQuery(), 24);
        int maxHours = WatchtowerConfig.LIVE_RETENTION_HOURS.get();
        hours = Math.max(1, Math.min(maxHours, hours));
        long cutoff = Instant.now().getEpochSecond() - (long) hours * 3600L;

        JsonArray events = new JsonArray();
        Set<String> seen = new HashSet<>();

        try {
            JsonObject opsCache = OpsCacheReader.load(WatchtowerPaths.opsCachePath(minecraftServer));
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

        Path dir = WatchtowerPaths.reportDir(minecraftServer);
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

    private void handleOnboardingAudit(HttpExchange ex) throws IOException {
        if (!"POST".equalsIgnoreCase(ex.getRequestMethod())) {
            send(ex, 405, "text/plain", "Method not allowed");
            return;
        }
        if (!requireApiAuth(ex)) {
            return;
        }
        if (minecraftServer == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        JsonObject out = new JsonObject();
        JsonObject items = new JsonObject();
        out.addProperty("phase", "discovery");
        try {
            ActivityLedgerScanner.ScanResult activity = OpsScanService.scanActivity(minecraftServer);
            items.addProperty("activity_new", activity.newCount());
            items.addProperty("activity_events", activity.events().size());
        } catch (Exception e) {
            WatchtowerMod.LOGGER.warn("Onboarding activity scan failed: {}", e.toString());
            items.addProperty("activity_error", e.getMessage() != null ? e.getMessage() : "failed");
        }
        try {
            CrashMtimeScanner.ScanResult crashes = OpsScanService.scanCrashes(minecraftServer);
            items.addProperty("crashes_new", crashes.newCount());
            items.addProperty("crashes_unreviewed", crashes.unreviewed());
        } catch (Exception e) {
            WatchtowerMod.LOGGER.warn("Onboarding crash scan failed: {}", e.toString());
            items.addProperty("crashes_error", e.getMessage() != null ? e.getMessage() : "failed");
        }
        try {
            OpsScanService.scanOpsLog(minecraftServer);
            JsonArray runningMods = OpsScanService.scanRunningMods(minecraftServer);
            items.addProperty("mods_running", runningMods.size());
        } catch (Exception e) {
            WatchtowerMod.LOGGER.warn("Onboarding mod scan failed: {}", e.toString());
            items.addProperty("mods_error", e.getMessage() != null ? e.getMessage() : "failed");
        }
        try {
            OpsScanService.scanBackupsLive(minecraftServer);
            OpsScanService.scanBackupExternal(minecraftServer);
            items.addProperty("backups_scanned", true);
        } catch (Exception e) {
            WatchtowerMod.LOGGER.warn("Onboarding backup scan failed: {}", e.toString());
            items.addProperty("backups_error", e.getMessage() != null ? e.getMessage() : "failed");
        }
        out.add("items", items);
        sendJson(ex, 200, out);
    }

    private void handleActivityScan(HttpExchange ex) throws IOException {
        if (!"POST".equalsIgnoreCase(ex.getRequestMethod())) {
            send(ex, 405, "text/plain", "Method not allowed");
            return;
        }
        if (!requireApiAuth(ex)) {
            return;
        }
        if (minecraftServer == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        try {
            ActivityLedgerScanner.ScanResult scan = OpsScanService.scanActivity(minecraftServer);
            JsonObject out = new JsonObject();
            out.addProperty("scanned_at", scan.scannedAt().toString());
            out.addProperty("new_count", scan.newCount());
            JsonArray events = new JsonArray();
            scan.events().forEach(events::add);
            out.add("events", events);
            sendJson(ex, 200, out);
        } catch (Exception e) {
            WatchtowerMod.LOGGER.warn("Activity scan failed: {}", e.toString());
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
        if (minecraftServer == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        JsonObject out = new JsonObject();
        out.add("incidents", IncidentReader.toJsonArray(
                IncidentReader.listSummaries(WatchtowerPaths.incidentsDir(minecraftServer), 50)));
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
        if (minecraftServer == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        String id = parseQueryParam(ex.getRequestURI().getQuery(), "id");
        JsonObject incident = IncidentReader.loadById(WatchtowerPaths.incidentsDir(minecraftServer), id);
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
        if (minecraftServer == null) {
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
        JsonObject incident = OpsScanService.buildManualIncident(minecraftServer, note, "manual");
        OpsScanService.writeIncident(minecraftServer, incident);
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
        if (minecraftServer == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        JsonObject opsCache = OpsCacheReader.load(WatchtowerPaths.opsCachePath(minecraftServer));
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
        out.addProperty("stale_report", WatchtowerBootstrap.getState().getLastReportFinished().isEmpty());
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
        if (minecraftServer == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        try {
            dev.mcstatus.watchtower.core.ops.OpsLogTailScanner.ScanResult scan =
                    OpsScanService.scanOpsLog(minecraftServer);
            JsonArray runningMods = OpsScanService.scanRunningMods(minecraftServer);
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
            WatchtowerMod.LOGGER.warn("Mod scan failed: {}", e.toString());
            JsonObject err = new JsonObject();
            err.addProperty("error", e.getMessage() != null ? e.getMessage() : "scan failed");
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
        if (!"POST".equalsIgnoreCase(ex.getRequestMethod())) {
            send(ex, 405, "text/plain", "Method not allowed");
            return;
        }
        if (!requireApiAuth(ex)) {
            return;
        }
        if (minecraftServer == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        WatchtowerRuntimeState state = WatchtowerBootstrap.getState();
        if (state.isReportRunning()) {
            JsonObject busy = new JsonObject();
            busy.addProperty("status", "already_running");
            sendJson(ex, 409, busy);
            return;
        }
        String body = new String(ex.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
        ReportRunOptions opts = ReportRunOptions.empty();
        if (body != null && !body.isBlank()) {
            JsonObject json = GSON.fromJson(body, JsonObject.class);
            Integer lookback = json.has("lookbackHours") && !json.get("lookbackHours").isJsonNull()
                    ? json.get("lookbackHours").getAsInt() : null;
            String since = json.has("since") && !json.get("since").isJsonNull()
                    ? json.get("since").getAsString() : null;
            Boolean incremental = json.has("incremental") ? json.get("incremental").getAsBoolean() : null;
            opts = new ReportRunOptions(lookback, since, incremental);
        }
        ReportRunOptions finalOpts = opts;
        minecraftServer.execute(() -> ReportRunner.runAsync(
                minecraftServer,
                WatchtowerBootstrap.getState(),
                msg -> WatchtowerMod.LOGGER.info("[Watchtower] {}", msg),
                finalOpts
        ));
        JsonObject ok = new JsonObject();
        ok.addProperty("status", "started");
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
        if (minecraftServer == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        JsonObject acks = StateManager.getAcknowledgedCrashes(WatchtowerPaths.statePath(minecraftServer));
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
        if (minecraftServer == null) {
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
        Path statePath = WatchtowerPaths.statePath(minecraftServer);
        if (reviewed) {
            String category = json.has("category") && !json.get("category").isJsonNull()
                    ? json.get("category").getAsString() : null;
            String plainEnglish = json.has("plain_english") && !json.get("plain_english").isJsonNull()
                    ? json.get("plain_english").getAsString() : null;
            StateManager.acknowledgeCrash(statePath, file, Instant.now(), "dashboard", category, plainEnglish);
        } else {
            StateManager.unacknowledgeCrash(statePath, file);
        }
        JsonObject out = new JsonObject();
        out.addProperty("ok", true);
        out.add("acknowledged_crashes", StateManager.getAcknowledgedCrashes(statePath));
        sendJson(ex, 200, out);
    }

    private void handleClientModIgnores(HttpExchange ex) throws IOException {
        if (!"GET".equalsIgnoreCase(ex.getRequestMethod())) {
            send(ex, 405, "text/plain", "Method not allowed");
            return;
        }
        if (!requireApiAuth(ex)) {
            return;
        }
        if (minecraftServer == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        JsonObject ignores = StateManager.getIgnoredClientMods(WatchtowerPaths.statePath(minecraftServer));
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
        if (minecraftServer == null) {
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
        Path statePath = WatchtowerPaths.statePath(minecraftServer);
        if (ignored) {
            String note = json.has("note") && !json.get("note").isJsonNull()
                    ? json.get("note").getAsString() : null;
            StateManager.ignoreClientMod(statePath, modId, Instant.now(), "dashboard", note);
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
        if (minecraftServer == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        try {
            ReportConfig config = ModReportConfig.forServer(minecraftServer);
            double cutoff = Instant.now().getEpochSecond() - (long) config.lookbackHours() * 3600L;
            JsonObject staging = new JsonObject();
            staging.add("optional", new JsonObject());
            CraftyCollector.scanBackups(staging, config.serverDir(), cutoff, config);
            JsonObject optional = staging.getAsJsonObject("optional");
            JsonObject lastBackup = optional.has("last_backup")
                    ? optional.getAsJsonObject("last_backup") : null;
            JsonElement inventory = optional.has("backup_inventory")
                    ? optional.get("backup_inventory") : null;
            OpsCacheWriter.applyBackupsLive(
                    WatchtowerPaths.opsCachePath(minecraftServer),
                    WatchtowerPaths.statePath(minecraftServer),
                    lastBackup,
                    inventory);
            JsonObject out = new JsonObject();
            if (lastBackup != null) {
                out.add("last_backup", lastBackup);
            }
            if (inventory != null) {
                out.add("backup_inventory", inventory);
            }
            sendJson(ex, 200, out);
        } catch (Exception e) {
            WatchtowerMod.LOGGER.warn("Backup scan failed: {}", e.toString());
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
        if (minecraftServer == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        try {
            ReportConfig config = ModReportConfig.forServer(minecraftServer);
            Path root = Path.of(config.serverDir()).toAbsolutePath().normalize();
            JsonObject out = new JsonObject();
            out.addProperty("spark_enabled", config.sparkEnabled());
            JsonArray searchDirs = new JsonArray();
            for (SparkCollector.SearchDir dir : SparkCollector.searchDirs(root, config)) {
                searchDirs.add(root.relativize(dir.path().toAbsolutePath().normalize()).toString().replace('\\', '/') + "/");
            }
            out.add("search_dirs", searchDirs);
            JsonArray profiles = new JsonArray();
            for (SparkProfileEntry entry : SparkCollector.listProfiles(config.serverDir(), config)) {
                profiles.add(entry.toJson());
            }
            out.add("profiles", profiles);
            out.addProperty("report_profile_path", resolveReportSparkProfilePath(minecraftServer));
            sendJson(ex, 200, out);
        } catch (Exception e) {
            WatchtowerMod.LOGGER.warn("Spark profile list failed: {}", e.toString());
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
        if (minecraftServer == null) {
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
            ReportConfig config = ModReportConfig.forServer(minecraftServer);
            if (!config.sparkEnabled()) {
                JsonObject err = new JsonObject();
                err.addProperty("error", "spark_disabled");
                sendJson(ex, 400, err);
                return;
            }
            var result = SparkCollector.readProfile(config.serverDir(), config, sourcePath);
            if (result.isEmpty()) {
                JsonObject err = new JsonObject();
                err.addProperty("error", "profile_not_found");
                sendJson(ex, 404, err);
                return;
            }
            JsonObject profile = SparkProfileBuilder.build(result.get(), config.serverDir(), config);
            if (profile == null) {
                JsonObject err = new JsonObject();
                err.addProperty("error", "profile_parse_failed");
                sendJson(ex, 404, err);
                return;
            }
            JsonObject out = new JsonObject();
            out.add(SparkProfileFacts.KEY, profile);
            sendJson(ex, 200, out);
        } catch (Exception e) {
            WatchtowerMod.LOGGER.warn("Spark profile parse failed: {}", e.toString());
            JsonObject err = new JsonObject();
            err.addProperty("error", e.getMessage() != null ? e.getMessage() : "parse failed");
            sendJson(ex, 500, err);
        }
    }

    private String resolveReportSparkProfilePath(MinecraftServer server) {
        try {
            Path facts = findLatestFacts(WatchtowerPaths.reportDir(server));
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
            return sparkProfile.get("source_path").getAsString();
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
        if (minecraftServer == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        try {
            ReportConfig config = ModReportConfig.forServer(minecraftServer);
            JsonArray lastSearch = null;
            Path facts = findLatestFacts(WatchtowerPaths.reportDir(minecraftServer));
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
        if (minecraftServer == null) {
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
        if (minecraftServer == null) {
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
            ReportConfig before = ModReportConfig.forServer(minecraftServer);
            String merged = WatchtowerConfWriter.mergeBackupDirs(String.join(",", before.backupDirs()), dirs);
            Path conf = WatchtowerPaths.confPath(minecraftServer);
            WatchtowerConfWriter.upsertKey(conf, "BACKUP_DIRS", merged);

            ReportConfig config = ModReportConfig.forServer(minecraftServer);
            double cutoff = Instant.now().getEpochSecond() - (long) config.lookbackHours() * 3600L;
            JsonObject staging = new JsonObject();
            staging.add("optional", new JsonObject());
            CraftyCollector.scanBackups(staging, config.serverDir(), cutoff, config);
            JsonObject optional = staging.getAsJsonObject("optional");
            JsonObject lastBackup = optional.has("last_backup")
                    ? optional.getAsJsonObject("last_backup") : null;
            com.google.gson.JsonElement inventory = optional.has("backup_inventory")
                    ? optional.get("backup_inventory") : null;
            OpsCacheWriter.applyBackupsLive(
                    WatchtowerPaths.opsCachePath(minecraftServer),
                    WatchtowerPaths.statePath(minecraftServer),
                    lastBackup,
                    inventory);

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
            WatchtowerMod.LOGGER.warn("Backup dirs save failed: {}", e.toString());
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
        if (minecraftServer == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        String body = new String(ex.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
        JsonObject json = body != null && !body.isBlank()
                ? GSON.fromJson(body, JsonObject.class) : new JsonObject();
        try {
            Path conf = WatchtowerPaths.confPath(minecraftServer);
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
            WatchtowerMod.LOGGER.warn("Backup external config save failed: {}", e.toString());
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
        if (minecraftServer == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        try {
            ReportConfig config = ModReportConfig.forServer(minecraftServer);
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
            WatchtowerMod.LOGGER.warn("Backup external test failed: {}", e.toString());
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
        if (minecraftServer == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        ReportConfig config;
        try {
            config = ModReportConfig.forServer(minecraftServer);
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
            WatchtowerMod.LOGGER.warn("Backup heartbeat failed: {}", e.toString());
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
                minecraftServer.getServerDirectory().toAbsolutePath().toString(), config);
        if (markerPath != null) {
            ExternalBackupDetector.writeMarker(markerPath, payload);
        }
        JsonObject backupExternal = ExternalBackupDetector.normalizePayload(
                payload, markerPath, config.backupWarnDays(), via, now);
        OpsCacheWriter.applyBackupExternal(
                WatchtowerPaths.opsCachePath(minecraftServer),
                WatchtowerPaths.statePath(minecraftServer),
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
        if (minecraftServer == null) {
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
            Path factsPath = findLatestFacts(WatchtowerPaths.reportDir(minecraftServer));
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
            Path crashPath = minecraftServer.getServerDirectory().resolve("crash-reports").resolve(bareFile);
            if (Files.isRegularFile(crashPath)) {
                crashEpoch = Files.getLastModifiedTime(crashPath).toInstant().getEpochSecond();
            }
        }
        if (crashEpoch <= 0) {
            send(ex, 404, "text/plain", "Crash not found");
            return;
        }

        Path logPath = minecraftServer.getServerDirectory().resolve("logs").resolve("latest.log");
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

    private void handleCrashReport(HttpExchange ex) throws IOException {
        if (!"GET".equalsIgnoreCase(ex.getRequestMethod())) {
            send(ex, 405, "text/plain", "Method not allowed");
            return;
        }
        if (!requireApiAuth(ex)) {
            return;
        }
        if (minecraftServer == null) {
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
        Path crashPath = minecraftServer.getServerDirectory().resolve("crash-reports").resolve(bareFile);
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
        if (minecraftServer == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        try {
            Path statePath = WatchtowerPaths.statePath(minecraftServer);
            Path opsCachePath = WatchtowerPaths.opsCachePath(minecraftServer);
            Path rollupsPath = WatchtowerPaths.performanceRollupsPath(minecraftServer);
            String serverDir = minecraftServer.getServerDirectory().toAbsolutePath().toString();
            CrashMtimeScanner.ScanResult scan = CrashMtimeScanner.scan(serverDir, statePath);
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
            WatchtowerMod.LOGGER.warn("Crash scan failed: {}", e.toString());
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
        if (minecraftServer == null) {
            send(ex, 503, "text/plain", "Server not ready");
            return;
        }
        sendJson(ex, 200, OpsCacheReader.load(WatchtowerPaths.opsCachePath(minecraftServer)));
    }

    private static Path findLatestFacts(Path dir) throws IOException {
        if (!Files.isDirectory(dir)) {
            return null;
        }
        try (Stream<Path> stream = Files.list(dir)) {
            return stream
                    .filter(p -> p.getFileName().toString().startsWith(WatchtowerFiles.FACTS_PREFIX)
                            && p.getFileName().toString().endsWith(".json"))
                    .max(Comparator.comparing(p -> {
                        try {
                            return Files.getLastModifiedTime(p).toInstant();
                        } catch (IOException e) {
                            return Instant.EPOCH;
                        }
                    }))
                    .orElse(null);
        }
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
            ex.sendResponseHeaders(200, bytes.length);
            try (OutputStream os = ex.getResponseBody()) {
                os.write(bytes);
            }
        }
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
