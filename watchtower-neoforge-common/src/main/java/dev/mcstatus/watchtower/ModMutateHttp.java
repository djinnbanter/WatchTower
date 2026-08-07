package dev.mcstatus.watchtower;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.sun.net.httpserver.HttpExchange;
import dev.mcstatus.watchtower.core.analyze.ModRestartNudge;
import dev.mcstatus.watchtower.core.analyze.WorldRiskAnalyzer;
import dev.mcstatus.watchtower.core.auth.AccountCapabilities;
import dev.mcstatus.watchtower.core.auth.DashboardAuthRecord;
import dev.mcstatus.watchtower.core.auth.DashboardAuthStore;
import dev.mcstatus.watchtower.core.auth.SessionManager;
import dev.mcstatus.watchtower.core.collect.ModJarMetadataReader;
import dev.mcstatus.watchtower.core.collect.ModMutateBackupStore;
import dev.mcstatus.watchtower.core.collect.ModMutateImpactFingerprint;
import dev.mcstatus.watchtower.core.collect.ModMutateJob;
import dev.mcstatus.watchtower.core.report.ReportConfig;
import dev.mcstatus.watchtower.core.report.StateManager;
import dev.mcstatus.watchtower.runtime.ServerContext;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

/**
 * Dashboard HTTP handlers for assisted mod mutate ({@code /api/mods/mutate/...}).
 * Called from thin wrappers in {@link DashboardHttpServer}.
 */
public final class ModMutateHttp {
    private static final Gson GSON = new Gson();

    private ModMutateHttp() {
    }

    public static void handleStatus(
            HttpExchange ex,
            ServerContext serverContext,
            WatchtowerRuntimeState state) throws IOException {
        if (!"GET".equalsIgnoreCase(ex.getRequestMethod())) {
            DashboardAuthHttp.sendText(ex, 405, "Method not allowed");
            return;
        }
        JsonObject out = new JsonObject();
        boolean busy = state != null && state.isMutateBusy();
        out.addProperty("busy", busy);
        ModMutateJob active = state != null ? state.getActiveMutateJob() : null;
        if (active != null) {
            out.addProperty("job_id", active.id);
            out.addProperty("kind", active.kind);
            out.addProperty("state", active.state);
            if (active.actor_name != null) {
                out.addProperty("actor", active.actor_name);
            }
            if (active.actor_id != null) {
                out.addProperty("actor_id", active.actor_id);
            }
            if (active.mod_id != null) {
                out.addProperty("mod_id", active.mod_id);
            }
        }
        boolean needsRestart = false;
        if (serverContext != null) {
            try {
                JsonObject pending = StateManager.getModRestartPending(WatchtowerPaths.statePath(serverContext));
                JsonObject nudge = ModRestartNudge.toMeta(pending, true);
                needsRestart = nudge.has("active") && nudge.get("active").getAsBoolean();
                out.add("needs_restart_detail", nudge);
            } catch (Exception ignored) {
            }
        }
        out.addProperty("needs_restart", needsRestart);
        out.addProperty("live_server", true);
        DashboardAuthHttp.sendJson(ex, 200, out);
    }

    public static void handleVersions(
            HttpExchange ex,
            ServerContext serverContext) throws IOException {
        if (!"GET".equalsIgnoreCase(ex.getRequestMethod())) {
            DashboardAuthHttp.sendText(ex, 405, "Method not allowed");
            return;
        }
        if (serverContext == null) {
            DashboardAuthHttp.sendText(ex, 503, "Server not ready");
            return;
        }
        String modId = queryParam(ex, "mod_id");
        String projectId = queryParam(ex, "project_id");
        if ((projectId == null || projectId.isBlank()) && modId != null && !modId.isBlank()) {
            projectId = ModMutateRunner.resolveProjectId(serverContext.serverDirectory(), modId);
        }
        if (projectId == null || projectId.isBlank()) {
            sendError(ex, 400, "missing_project",
                    "Provide project_id or a mod_id with a known Modrinth project");
            return;
        }
        try {
            ReportConfig config = ModReportConfig.forServer(serverContext);
            JsonArray versions = ModMutateRunner.fetchProjectVersions(
                    projectId, config, serverContext.serverDirectory(),
                    ModMutateRunner.defaultMetadataFetcher());
            JsonObject out = new JsonObject();
            out.addProperty("project_id", projectId);
            if (modId != null && !modId.isBlank()) {
                out.addProperty("mod_id", modId);
            }
            out.add("versions", versions);
            DashboardAuthHttp.sendJson(ex, 200, out);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            sendError(ex, 502, "modrinth_interrupted", "Interrupted while talking to Modrinth");
        } catch (Exception e) {
            sendError(ex, 502, "modrinth_error",
                    e.getMessage() != null ? e.getMessage() : "Could not list Modrinth versions");
        }
    }

    public static void handleSwap(
            HttpExchange ex,
            ServerContext serverContext,
            WatchtowerRuntimeState state) throws IOException {
        if (!requireMutatePost(ex, serverContext, state)) {
            return;
        }
        JsonObject body = parseBody(ex);
        if (!requireConfirm(ex, body)) {
            return;
        }
        String modId = text(body, "mod_id");
        String versionId = firstText(body, "modrinth_version_id", "version_id");
        if (modId.isBlank() || versionId.isBlank()) {
            sendError(ex, 400, "invalid_request", "mod_id and modrinth_version_id are required");
            return;
        }
        if (!requireImpactFingerprint(ex, serverContext, body, modId, versionId)) {
            return;
        }
        SessionManager.SessionState session = DashboardAuthHttp.sessionOf(ex);
        ModMutateJob job = ModMutateJob.newSwap(
                session.accountId(),
                session.username(),
                modId,
                text(body, "jar"),
                text(body, "project_id"),
                versionId,
                blankToNull(text(body, "expected_sha512")),
                text(body, "impact_fingerprint"));
        startJob(ex, serverContext, state, job, "mod_swap");
    }

    public static void handleBatch(
            HttpExchange ex,
            ServerContext serverContext,
            WatchtowerRuntimeState state) throws IOException {
        if (!requireMutatePost(ex, serverContext, state)) {
            return;
        }
        JsonObject body = parseBody(ex);
        if (!requireConfirm(ex, body)) {
            return;
        }
        String fingerprint = text(body, "impact_fingerprint");
        if (fingerprint.isBlank()) {
            sendError(ex, 400, "impact_fingerprint_required",
                    "Confirm again after reviewing impact — impact_fingerprint is required");
            return;
        }
        if (!body.has("steps") || !body.get("steps").isJsonArray() || body.getAsJsonArray("steps").isEmpty()) {
            sendError(ex, 400, "invalid_request", "steps array is required");
            return;
        }
        List<ModMutateJob.Step> steps = new ArrayList<>();
        String stepErr = parseBatchSteps(body.getAsJsonArray("steps"), steps);
        if (stepErr != null) {
            if ("invalid_step".equals(stepErr)) {
                sendError(ex, 400, "invalid_step",
                        batchStepErrorMessage(body.getAsJsonArray("steps")));
            } else {
                sendError(ex, 400, "invalid_request", "steps array is required");
            }
            return;
        }
        boolean continueOnFailure = body.has("continue_on_failure")
                && !body.get("continue_on_failure").isJsonNull()
                && body.get("continue_on_failure").getAsBoolean();
        boolean allowNonSafe = body.has("allow_non_safe")
                && !body.get("allow_non_safe").isJsonNull()
                && body.get("allow_non_safe").getAsBoolean();
        if (!verifyBatchFingerprint(ex, serverContext, fingerprint, steps, allowNonSafe)) {
            return;
        }
        SessionManager.SessionState session = DashboardAuthHttp.sessionOf(ex);
        ModMutateJob job = ModMutateJob.newBatchSwap(
                session.accountId(),
                session.username(),
                steps,
                fingerprint,
                continueOnFailure);
        startJob(ex, serverContext, state, job, "mod_batch");
    }

    public static void handleInstall(
            HttpExchange ex,
            ServerContext serverContext,
            WatchtowerRuntimeState state) throws IOException {
        if (!requireMutatePost(ex, serverContext, state)) {
            return;
        }
        JsonObject body = parseBody(ex);
        if (!requireConfirm(ex, body)) {
            return;
        }
        String modId = text(body, "mod_id");
        String versionId = firstText(body, "modrinth_version_id", "version_id");
        String projectId = text(body, "project_id");
        if (modId.isBlank() || versionId.isBlank()) {
            sendError(ex, 400, "invalid_request", "mod_id and modrinth_version_id are required");
            return;
        }
        if (!requireImpactFingerprint(ex, serverContext, body, modId, versionId)) {
            return;
        }
        SessionManager.SessionState session = DashboardAuthHttp.sessionOf(ex);
        ModMutateJob job = ModMutateJob.newInstall(
                session.accountId(),
                session.username(),
                modId,
                blankToNull(projectId),
                versionId,
                blankToNull(text(body, "expected_sha512")),
                text(body, "impact_fingerprint"));
        startJob(ex, serverContext, state, job, "mod_install");
    }

    public static void handleQuarantine(
            HttpExchange ex,
            ServerContext serverContext,
            WatchtowerRuntimeState state) throws IOException {
        if (!requireMutatePost(ex, serverContext, state)) {
            return;
        }
        JsonObject body = parseBody(ex);
        if (!requireConfirm(ex, body)) {
            return;
        }
        String modId = text(body, "mod_id");
        String jar = firstText(body, "jar", "jar_basename");
        if (modId.isBlank() && (jar == null || jar.isBlank())) {
            sendError(ex, 400, "invalid_request", "mod_id or jar is required");
            return;
        }
        JsonObject worldRisk = emptyWorldRisk();
        try {
            ReportConfig config = ModReportConfig.forServer(serverContext);
            if (config.worldRiskEnabled()) {
                String idForRisk = blankToNull(modId);
                Path modsDir = serverContext.serverDirectory().resolve("mods");
                Path jarPath = null;
                String jarName = blankToNull(jar);
                if (jarName != null) {
                    jarPath = modsDir.resolve(Path.of(jarName).getFileName().toString());
                }
                if (idForRisk == null && jarName != null) {
                    for (var entry : ModJarMetadataReader.readFromModsDir(
                            serverContext.serverDirectory().toString())) {
                        if (jarName.equals(entry.jarFile()) || jarName.equalsIgnoreCase(entry.jarFile())) {
                            idForRisk = entry.id();
                            break;
                        }
                    }
                }
                if (idForRisk != null) {
                    worldRisk = WorldRiskAnalyzer.evaluateMod(
                            idForRisk,
                            serverContext.serverDirectory(),
                            jarPath,
                            OpsScanService.liveDimensionIds(serverContext));
                }
            }
        } catch (Exception ignored) {
            worldRisk = emptyWorldRisk();
        }
        if (needsWorldRiskConfirm(body, worldRisk)) {
            JsonObject err = new JsonObject();
            err.addProperty("error", "world_risk_confirm_required");
            err.addProperty("error_code", "world_risk_confirm_required");
            err.addProperty("message",
                    "This mod may break the world if removed — set confirm_world_risk:true after reviewing");
            err.add("world_risk", worldRisk);
            DashboardAuthHttp.sendJson(ex, 400, err);
            return;
        }
        SessionManager.SessionState session = DashboardAuthHttp.sessionOf(ex);
        ModMutateJob job = ModMutateJob.newQuarantine(
                session.accountId(),
                session.username(),
                blankToNull(modId),
                blankToNull(jar));
        startJob(ex, serverContext, state, job, "mod_quarantine");
    }

    public static void handleUndo(
            HttpExchange ex,
            ServerContext serverContext,
            WatchtowerRuntimeState state) throws IOException {
        if (!requireMutatePost(ex, serverContext, state)) {
            return;
        }
        JsonObject body = parseBody(ex);
        if (!requireConfirm(ex, body)) {
            return;
        }
        String backupId = text(body, "backup_id");
        String modId = text(body, "mod_id");
        if (backupId.isBlank() && modId.isBlank()) {
            sendError(ex, 400, "invalid_request", "Provide backup_id or mod_id");
            return;
        }
        SessionManager.SessionState session = DashboardAuthHttp.sessionOf(ex);
        ModMutateJob job = ModMutateJob.newUndo(
                session.accountId(),
                session.username(),
                blankToNull(backupId),
                blankToNull(modId));
        startJob(ex, serverContext, state, job, "mod_swap_undo");
    }

    public static void handleJobGet(
            HttpExchange ex,
            WatchtowerRuntimeState state) throws IOException {
        if (!"GET".equalsIgnoreCase(ex.getRequestMethod())) {
            DashboardAuthHttp.sendText(ex, 405, "Method not allowed");
            return;
        }
        String path = ex.getRequestURI().getPath();
        String prefix = "/api/mods/mutate/jobs/";
        String jobId = path.startsWith(prefix) ? path.substring(prefix.length()) : "";
        if (jobId.contains("/")) {
            jobId = jobId.substring(0, jobId.indexOf('/'));
        }
        jobId = jobId.trim();
        if (jobId.isBlank()) {
            // Exact /api/mods/mutate/jobs with no id
            sendError(ex, 400, "missing_job_id", "Job id required");
            return;
        }
        ModMutateJob job = state != null ? state.getMutateJob(jobId) : null;
        if (job == null) {
            sendError(ex, 404, "not_found", "No mutate job with that id");
            return;
        }
        DashboardAuthHttp.sendJson(ex, 200, GSON.toJsonTree(job).getAsJsonObject());
    }

    public static void handleBackups(
            HttpExchange ex,
            ServerContext serverContext) throws IOException {
        if (!"GET".equalsIgnoreCase(ex.getRequestMethod())) {
            DashboardAuthHttp.sendText(ex, 405, "Method not allowed");
            return;
        }
        if (serverContext == null) {
            DashboardAuthHttp.sendText(ex, 503, "Server not ready");
            return;
        }
        String modId = queryParam(ex, "mod_id");
        ModMutateBackupStore store = new ModMutateBackupStore(WatchtowerPaths.modBackupsDir(serverContext));
        List<ModMutateBackupStore.BackupRecord> list = store.listBackups(modId);
        JsonObject out = new JsonObject();
        out.add("backups", GSON.toJsonTree(list));
        DashboardAuthHttp.sendJson(ex, 200, out);
    }

    /**
     * Require {@code mods.mutate}. Returns false after sending 403.
     */
    public static boolean requireModsMutate(HttpExchange ex, SessionManager.SessionState session)
            throws IOException {
        if (session == null) {
            sendError(ex, 401, "unauthorized", "Unauthorized");
            return false;
        }
        DashboardAuthStore store = DashboardAuthServices.store();
        DashboardAuthRecord account = store != null ? store.findById(session.accountId()) : null;
        if (!AccountCapabilities.canMutateMods(account)) {
            JsonObject err = new JsonObject();
            err.addProperty("error", "capability_required");
            err.addProperty("capability", AccountCapabilities.MODS_MUTATE);
            err.addProperty("message",
                    "Owner must grant mod jar change permission (mods.mutate) for this account");
            DashboardAuthHttp.sendJson(ex, 403, err);
            return false;
        }
        return true;
    }

    private static boolean requireMutatePost(
            HttpExchange ex,
            ServerContext serverContext,
            WatchtowerRuntimeState state) throws IOException {
        if (!"POST".equalsIgnoreCase(ex.getRequestMethod())) {
            DashboardAuthHttp.sendText(ex, 405, "Method not allowed");
            return false;
        }
        if (serverContext == null) {
            DashboardAuthHttp.sendText(ex, 503, "Server not ready");
            return false;
        }
        SessionManager.SessionState session = DashboardAuthHttp.sessionOf(ex);
        if (!requireModsMutate(ex, session)) {
            return false;
        }
        try {
            ReportConfig config = ModReportConfig.forServer(serverContext);
            if (!config.modMutateEnabled()) {
                sendError(ex, 403, "feature_disabled",
                        "Assisted mod jar changes are disabled (MOD_MUTATE_ENABLED=false)");
                return false;
            }
        } catch (Exception e) {
            sendError(ex, 500, "config_error", "Could not load WatchTower config");
            return false;
        }
        if (state != null && state.isMutateBusy()) {
            JsonObject err = new JsonObject();
            err.addProperty("error", "mutate_busy");
            err.addProperty("error_code", "mutate_busy");
            err.addProperty("message", "Another mod change is already running");
            ModMutateJob active = state.getActiveMutateJob();
            if (active != null) {
                err.addProperty("job_id", active.id);
            }
            DashboardAuthHttp.sendJson(ex, 409, err);
            return false;
        }
        return true;
    }

    /**
     * Recompute fingerprint from ops-cache impact + requested version; reject stale/mismatched confirms.
     */
    static boolean isBlankImpactFingerprint(JsonObject body) {
        return text(body, "impact_fingerprint").isBlank();
    }

    /**
     * Require impact_fingerprint in body and verify against ops-cache impact + version.
     * Sends 400/409 and returns false on failure.
     */
    static boolean requireImpactFingerprint(
            HttpExchange ex,
            ServerContext serverContext,
            JsonObject body,
            String modId,
            String versionId) throws IOException {
        if (isBlankImpactFingerprint(body)) {
            sendError(ex, 400, "impact_fingerprint_required",
                    "Confirm again after reviewing impact — impact_fingerprint is required");
            return false;
        }
        return verifySwapFingerprint(
                ex, serverContext, text(body, "impact_fingerprint"), modId, versionId);
    }

    private static boolean verifySwapFingerprint(
            HttpExchange ex,
            ServerContext serverContext,
            String provided,
            String modId,
            String versionId) throws IOException {
        ImpactSnapshot impact = loadImpactSnapshot(serverContext.serverDirectory(), modId);
        String expected = ModMutateImpactFingerprint.compute(
                modId,
                versionId,
                impact.verdict(),
                impact.summary(),
                impact.blockersCanonical());
        if (!ModMutateImpactFingerprint.matches(provided, expected)) {
            sendError(ex, 409, "impact_fingerprint_mismatch",
                    "Impact changed or version does not match what you confirmed — review again and confirm");
            return false;
        }
        return true;
    }

    private static boolean verifyBatchFingerprint(
            HttpExchange ex,
            ServerContext serverContext,
            String provided,
            List<ModMutateJob.Step> steps,
            boolean allowNonSafe) throws IOException {
        Path serverDir = serverContext.serverDirectory();
        String keys = steps.stream()
                .map(s -> (s.mod_id != null ? s.mod_id.trim() : "")
                        + ":"
                        + (s.version_id != null ? s.version_id.trim() : ""))
                .sorted(Comparator.naturalOrder())
                .collect(Collectors.joining(","));

        String worstVerdict = "";
        boolean needsNonSafe = false;
        JsonArray blockers = new JsonArray();
        List<String> modIdsSorted = steps.stream()
                .map(s -> s.mod_id != null ? s.mod_id.trim() : "")
                .filter(id -> !id.isEmpty())
                .sorted(Comparator.naturalOrder())
                .distinct()
                .collect(Collectors.toList());

        for (ModMutateJob.Step s : steps) {
            ImpactSnapshot impact = loadImpactSnapshot(serverDir, s.mod_id);
            worstVerdict = worseVerdict(worstVerdict, impact.verdict());
            if (isNonSafeVerdict(impact.verdict())) {
                needsNonSafe = true;
            }
            JsonObject row = new JsonObject();
            row.addProperty("mod_id", s.mod_id != null ? s.mod_id : "");
            row.addProperty("modrinth_version_id", s.version_id != null ? s.version_id : "");
            blockers.add(row);
        }

        if (needsNonSafe && !allowNonSafe) {
            sendError(ex, 400, "non_safe_confirm_required",
                    "This batch includes Caution or Break updates — confirm allow_non_safe after reviewing impact");
            return false;
        }

        String summary = "batch:" + String.join(",", modIdsSorted);
        // Fingerprint verdict: worst ops-cache impact across selected mods (not client-supplied)
        String expected = ModMutateImpactFingerprint.computeBatch(
                keys,
                worstVerdict,
                summary,
                ModMutateImpactFingerprint.blockersCanonical(blockers));
        if (!ModMutateImpactFingerprint.matches(provided, expected)) {
            sendError(ex, 409, "impact_fingerprint_mismatch",
                    "Batch selection or impact changed — review again and confirm");
            return false;
        }
        return true;
    }

    /**
     * Parse batch steps. Returns null on success (out filled).
     * On failure returns error code: "invalid_request" or "invalid_step".
     */
    static String parseBatchSteps(JsonArray steps, List<ModMutateJob.Step> out) {
        if (steps == null || steps.isEmpty()) {
            return "invalid_request";
        }
        for (JsonElement el : steps) {
            if (el == null || !el.isJsonObject()) {
                out.clear();
                return "invalid_step";
            }
            JsonObject s = el.getAsJsonObject();
            ModMutateJob.Step step = new ModMutateJob.Step();
            step.mod_id = text(s, "mod_id");
            step.jar_basename = blankToNull(text(s, "jar"));
            if (step.jar_basename == null) {
                step.jar_basename = blankToNull(text(s, "jar_basename"));
            }
            step.project_id = blankToNull(text(s, "project_id"));
            step.version_id = firstText(s, "modrinth_version_id", "version_id");
            step.expected_sha512 = blankToNull(text(s, "expected_sha512"));
            step.state = ModMutateJob.STATE_QUEUED;
            if (step.mod_id.isBlank() || step.version_id == null || step.version_id.isBlank()) {
                out.clear();
                return "invalid_step";
            }
            out.add(step);
        }
        if (out.isEmpty()) {
            return "invalid_request";
        }
        return null;
    }

    static String batchStepErrorMessage(JsonArray steps) {
        for (JsonElement el : steps) {
            if (el == null || !el.isJsonObject()) {
                return "Each step must be a JSON object";
            }
            JsonObject s = el.getAsJsonObject();
            String modId = text(s, "mod_id");
            String versionId = firstText(s, "modrinth_version_id", "version_id");
            if (modId.isBlank() || versionId == null || versionId.isBlank()) {
                return "Each step needs mod_id and modrinth_version_id";
            }
        }
        return "Each step must be a JSON object";
    }

    /**
     * @return true when high world risk and body lacks confirm_world_risk:true
     */
    static boolean needsWorldRiskConfirm(JsonObject body, JsonObject worldRisk) {
        if (worldRisk == null || !worldRisk.has("level") || worldRisk.get("level").isJsonNull()) {
            return false;
        }
        boolean high = "high".equalsIgnoreCase(worldRisk.get("level").getAsString());
        if (!high) {
            return false;
        }
        boolean confirmed = body != null
                && body.has("confirm_world_risk")
                && !body.get("confirm_world_risk").isJsonNull()
                && body.get("confirm_world_risk").getAsBoolean();
        return !confirmed;
    }

    static JsonObject emptyWorldRisk() {
        JsonObject worldRisk = new JsonObject();
        worldRisk.addProperty("level", "none");
        worldRisk.add("reasons", new JsonArray());
        return worldRisk;
    }

    static boolean isNonSafeVerdict(String verdict) {
        if (verdict == null || verdict.isBlank()) {
            return false;
        }
        String v = verdict.trim().toLowerCase(java.util.Locale.ROOT);
        return "caution".equals(v) || "break".equals(v) || "unknown".equals(v);
    }

    /** Higher rank wins: break > caution > unknown > safe > empty. */
    static String worseVerdict(String a, String b) {
        return verdictRank(a) >= verdictRank(b) ? normalizeVerdict(a) : normalizeVerdict(b);
    }

    private static int verdictRank(String verdict) {
        String v = normalizeVerdict(verdict);
        return switch (v) {
            case "break" -> 4;
            case "caution" -> 3;
            case "unknown" -> 2;
            case "safe" -> 1;
            default -> 0;
        };
    }

    private static String normalizeVerdict(String verdict) {
        return verdict == null ? "" : verdict.trim().toLowerCase(java.util.Locale.ROOT);
    }

    private record ImpactSnapshot(String verdict, String summary, String blockersCanonical) {
        static ImpactSnapshot empty() {
            return new ImpactSnapshot("", "", "[]");
        }
    }

    private static ImpactSnapshot loadImpactSnapshot(Path serverDir, String modId) {
        if (serverDir == null || modId == null || modId.isBlank()) {
            return ImpactSnapshot.empty();
        }
        Path ops = WatchtowerPaths.opsCachePath(serverDir);
        if (!Files.isRegularFile(ops)) {
            return ImpactSnapshot.empty();
        }
        try {
            JsonObject root = com.google.gson.JsonParser.parseString(
                    Files.readString(ops, StandardCharsets.UTF_8)).getAsJsonObject();
            JsonArray updates = null;
            if (root.has("optional") && root.get("optional").isJsonObject()) {
                JsonObject optional = root.getAsJsonObject("optional");
                if (optional.has("modrinth_updates") && optional.get("modrinth_updates").isJsonArray()) {
                    updates = optional.getAsJsonArray("modrinth_updates");
                }
            }
            if (updates == null && root.has("modrinth_updates") && root.get("modrinth_updates").isJsonArray()) {
                updates = root.getAsJsonArray("modrinth_updates");
            }
            if (updates == null) {
                return ImpactSnapshot.empty();
            }
            String wanted = modId.trim();
            for (JsonElement el : updates) {
                if (!el.isJsonObject()) {
                    continue;
                }
                JsonObject u = el.getAsJsonObject();
                String id = text(u, "mod_id");
                if (id.isBlank()) {
                    id = text(u, "id");
                }
                if (!wanted.equalsIgnoreCase(id)) {
                    continue;
                }
                String verdict = text(u, "impact_verdict");
                String summary = text(u, "impact_summary");
                JsonElement blockers = u.has("blockers") ? u.get("blockers") : null;
                return new ImpactSnapshot(
                        verdict,
                        summary,
                        ModMutateImpactFingerprint.blockersCanonical(blockers));
            }
        } catch (Exception ignored) {
        }
        return ImpactSnapshot.empty();
    }

    private static boolean requireConfirm(HttpExchange ex, JsonObject body) throws IOException {
        boolean confirm = body != null && body.has("confirm") && !body.get("confirm").isJsonNull()
                && body.get("confirm").getAsBoolean();
        if (!confirm) {
            sendError(ex, 400, "confirm_required",
                    "Set confirm:true after reviewing the change");
            return false;
        }
        return true;
    }

    private static void startJob(
            HttpExchange ex,
            ServerContext serverContext,
            WatchtowerRuntimeState state,
            ModMutateJob job,
            String auditEvent) throws IOException {
        if (!state.tryBeginMutate(job)) {
            JsonObject err = new JsonObject();
            err.addProperty("error", "mutate_busy");
            err.addProperty("error_code", "mutate_busy");
            err.addProperty("message", "Another mod change is already running");
            ModMutateJob active = state.getActiveMutateJob();
            if (active != null) {
                err.addProperty("job_id", active.id);
            }
            DashboardAuthHttp.sendJson(ex, 409, err);
            return;
        }
        SessionManager.SessionState session = DashboardAuthHttp.sessionOf(ex);
        String detail = job.kind + " " + (job.mod_id != null ? job.mod_id : "")
                + (job.version_id != null ? " → " + job.version_id : "");
        DashboardAudit.record(auditEvent, session, job.id, detail.trim(),
                DashboardAuthHttp.clientIp(ex));

        ModMutateRunner.continueAfterBegin(serverContext, state, job);

        JsonObject out = new JsonObject();
        out.addProperty("ok", true);
        out.addProperty("job_id", job.id);
        out.addProperty("state", job.state);
        out.add("job", GSON.toJsonTree(job));
        DashboardAuthHttp.sendJson(ex, 202, out);
    }

    private static JsonObject parseBody(HttpExchange ex) throws IOException {
        String raw = new String(ex.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
        if (raw.isBlank()) {
            return new JsonObject();
        }
        try {
            return GSON.fromJson(raw, JsonObject.class);
        } catch (Exception e) {
            return new JsonObject();
        }
    }

    private static String text(JsonObject json, String key) {
        if (json == null || !json.has(key) || json.get(key).isJsonNull()) {
            return "";
        }
        try {
            return json.get(key).getAsString().trim();
        } catch (Exception e) {
            return "";
        }
    }

    private static String firstText(JsonObject json, String... keys) {
        for (String key : keys) {
            String v = text(json, key);
            if (!v.isBlank()) {
                return v;
            }
        }
        return "";
    }

    private static String blankToNull(String s) {
        return s == null || s.isBlank() ? null : s;
    }

    private static String queryParam(HttpExchange ex, String name) {
        String q = ex.getRequestURI().getQuery();
        if (q == null || q.isBlank()) {
            return null;
        }
        for (String part : q.split("&")) {
            int eq = part.indexOf('=');
            if (eq <= 0) {
                continue;
            }
            if (name.equals(part.substring(0, eq))) {
                return java.net.URLDecoder.decode(part.substring(eq + 1), StandardCharsets.UTF_8);
            }
        }
        return null;
    }

    private static void sendError(HttpExchange ex, int code, String error, String message)
            throws IOException {
        JsonObject err = new JsonObject();
        err.addProperty("error", error);
        err.addProperty("message", message);
        DashboardAuthHttp.sendJson(ex, code, err);
    }
}
