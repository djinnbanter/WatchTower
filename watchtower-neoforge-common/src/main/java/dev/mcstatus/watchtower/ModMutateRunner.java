package dev.mcstatus.watchtower;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import dev.mcstatus.watchtower.core.analyze.ModRestartNudge;
import dev.mcstatus.watchtower.core.collect.ModJarMetadataCache;
import dev.mcstatus.watchtower.core.collect.ModJarMetadataReader;
import dev.mcstatus.watchtower.core.collect.ModJarPaths;
import dev.mcstatus.watchtower.core.collect.ModJarSwap;
import dev.mcstatus.watchtower.core.collect.ModMutateJob;
import dev.mcstatus.watchtower.core.collect.ModrinthFileFetcher;
import dev.mcstatus.watchtower.core.collect.ModrinthLookupService;
import dev.mcstatus.watchtower.core.ops.OpsCacheSchema;
import dev.mcstatus.watchtower.core.report.ReportConfig;
import dev.mcstatus.watchtower.core.report.StateManager;
import dev.mcstatus.watchtower.runtime.ModRuntime;
import dev.mcstatus.watchtower.runtime.ServerContext;

import java.io.IOException;
import java.net.URI;
import java.net.URLEncoder;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Stream;

/**
 * Async assisted mod-mutate runner. Invoked after {@link WatchtowerRuntimeState#tryBeginMutate}.
 * Never restarts the game server; sets {@link ModRestartNudge} on successful disk changes.
 */
public final class ModMutateRunner {
    private static final String USER_AGENT = "WatchTower/mod-mutate";
    private static final String VERSION_URL = "https://api.modrinth.com/v2/version/";
    private static final String PROJECT_VERSIONS_URL = "https://api.modrinth.com/v2/project/";

    @FunctionalInterface
    public interface VersionMetadataFetcher {
        String getJson(String url) throws IOException, InterruptedException;
    }

    public record PrimaryFile(String url, String filename, String sha512, String versionNumber) {
    }

    private ModMutateRunner() {
    }

    public static CompletableFuture<Void> continueAfterBegin(
            ServerContext server,
            WatchtowerRuntimeState state,
            ModMutateJob job) {
        return continueAfterBegin(server, state, job, new ModrinthFileFetcher(), defaultMetadataFetcher());
    }

    public static CompletableFuture<Void> continueAfterBegin(
            ServerContext server,
            WatchtowerRuntimeState state,
            ModMutateJob job,
            ModrinthFileFetcher.ByteDownloader downloader) {
        return continueAfterBegin(
                server, state, job, new ModrinthFileFetcher(downloader), defaultMetadataFetcher());
    }

    public static CompletableFuture<Void> continueAfterBegin(
            ServerContext server,
            WatchtowerRuntimeState state,
            ModMutateJob job,
            ModrinthFileFetcher fetcher,
            VersionMetadataFetcher metadataFetcher) {
        if (job == null) {
            return CompletableFuture.completedFuture(null);
        }
        return CompletableFuture.runAsync(() -> {
            try {
                runJob(server, state, job, fetcher, metadataFetcher);
            } catch (Exception e) {
                ModRuntime.logger().warn("[Watchtower] Mod mutate job {} failed", job.id, e);
                failJob(state, job, "internal_error",
                        e.getMessage() != null ? e.getMessage() : "Mutate job failed", true);
            } finally {
                wipeStaging(server, job.id);
                state.finishMutate(job.id);
            }
        });
    }

    private static void runJob(
            ServerContext server,
            WatchtowerRuntimeState state,
            ModMutateJob job,
            ModrinthFileFetcher fetcher,
            VersionMetadataFetcher metadataFetcher) throws Exception {
        Path modsDir = server.serverDirectory().resolve("mods");
        Path backupsDir = WatchtowerPaths.modBackupsDir(server);
        Path stagingRoot = WatchtowerPaths.modStagingDir(server).resolve(job.id).normalize();

        String kind = job.kind != null ? job.kind : "";
        switch (kind) {
            case ModMutateJob.KIND_SWAP -> runSwap(server, state, job, fetcher, metadataFetcher,
                    modsDir, backupsDir, stagingRoot);
            case ModMutateJob.KIND_BATCH_SWAP -> runBatch(server, state, job, fetcher, metadataFetcher,
                    modsDir, backupsDir, stagingRoot);
            case ModMutateJob.KIND_INSTALL -> runInstall(server, state, job, fetcher, metadataFetcher,
                    modsDir, stagingRoot);
            case ModMutateJob.KIND_QUARANTINE -> runQuarantine(server, state, job, modsDir, backupsDir);
            case ModMutateJob.KIND_UNDO -> runUndo(server, state, job, modsDir, backupsDir);
            default -> failJob(state, job, "unknown_kind", "Unknown mutate job kind: " + kind, false);
        }
    }

    private static void runSwap(
            ServerContext server,
            WatchtowerRuntimeState state,
            ModMutateJob job,
            ModrinthFileFetcher fetcher,
            VersionMetadataFetcher metadataFetcher,
            Path modsDir,
            Path backupsDir,
            Path stagingRoot) throws Exception {
        SwapOutcome outcome = applyOneSwap(server, state, job, null, fetcher, metadataFetcher,
                modsDir, backupsDir, stagingRoot);
        if (outcome.ok()) {
            job.backup_id = outcome.backupId();
            job.jar_basename = outcome.jarBasename();
            job.transition(ModMutateJob.STATE_DONE);
            state.updateMutateJob(job);
            recordRestartNudge(server, outcome.jarBasename());
            refreshJarMetadataCache(server, "mutate_swap");
        } else {
            failJob(state, job, outcome.errorCode(), outcome.message(), outcome.retryable());
        }
    }

    private static void runBatch(
            ServerContext server,
            WatchtowerRuntimeState state,
            ModMutateJob job,
            ModrinthFileFetcher fetcher,
            VersionMetadataFetcher metadataFetcher,
            Path modsDir,
            Path backupsDir,
            Path stagingRoot) throws Exception {
        boolean continueOnFailure = Boolean.TRUE.equals(job.continue_on_failure);
        boolean anyOk = false;
        boolean anyFail = false;
        String lastError = null;
        String lastCode = null;
        boolean lastRetryable = false;

        if (job.steps == null || job.steps.isEmpty()) {
            failJob(state, job, "empty_batch", "Batch has no steps", false);
            return;
        }

        job.transition(ModMutateJob.STATE_FETCHING);
        state.updateMutateJob(job);

        for (int i = 0; i < job.steps.size(); i++) {
            ModMutateJob.Step step = job.steps.get(i);
            Path stepStaging = stagingRoot.resolve("step-" + i).normalize();
            SwapOutcome outcome = applyOneSwap(server, state, job, step, fetcher, metadataFetcher,
                    modsDir, backupsDir, stepStaging);
            if (outcome.ok()) {
                anyOk = true;
                step.state = ModMutateJob.STATE_DONE;
                step.backup_id = outcome.backupId();
                step.error = null;
                step.error_code = null;
                recordRestartNudge(server, outcome.jarBasename());
            } else {
                anyFail = true;
                step.state = ModMutateJob.STATE_FAILED;
                step.error = outcome.message();
                step.error_code = outcome.errorCode();
                lastError = outcome.message();
                lastCode = outcome.errorCode();
                lastRetryable = outcome.retryable();
                if (!continueOnFailure) {
                    // Mark remaining as cancelled
                    for (int j = i + 1; j < job.steps.size(); j++) {
                        ModMutateJob.Step rest = job.steps.get(j);
                        if (rest.state == null || rest.state.isBlank()) {
                            rest.state = ModMutateJob.STATE_CANCELLED;
                            rest.error = "Skipped after earlier failure";
                            rest.error_code = "aborted";
                        }
                    }
                    break;
                }
            }
            state.updateMutateJob(job);
        }

        if (anyFail && !anyOk) {
            failJob(state, job, lastCode != null ? lastCode : "batch_failed",
                    lastError != null ? lastError : "Batch failed", lastRetryable);
        } else if (anyFail) {
            int failed = 0;
            int ok = 0;
            for (ModMutateJob.Step s : job.steps) {
                if (ModMutateJob.STATE_DONE.equals(s.state)) {
                    ok++;
                } else if (ModMutateJob.STATE_FAILED.equals(s.state)) {
                    failed++;
                }
            }
            failJob(state, job, "batch_partial",
                    "Batch finished with " + ok + " applied and " + failed + " failed"
                            + (lastError != null ? ": " + lastError : ""),
                    lastRetryable);
        } else {
            job.transition(ModMutateJob.STATE_VERIFYING);
            job.transition(ModMutateJob.STATE_APPLYING);
            job.transition(ModMutateJob.STATE_DONE);
            state.updateMutateJob(job);
            refreshJarMetadataCache(server, "mutate_batch");
        }
    }

    private static void runInstall(
            ServerContext server,
            WatchtowerRuntimeState state,
            ModMutateJob job,
            ModrinthFileFetcher fetcher,
            VersionMetadataFetcher metadataFetcher,
            Path modsDir,
            Path stagingRoot) throws Exception {
        String live = resolveLiveJarBasename(server.serverDirectory(), job.mod_id, job.jar_basename);
        if (live != null) {
            failJob(state, job, "already_installed",
                    "Mod already has a jar in mods/: " + live, false);
            return;
        }

        if (job.project_id == null || job.project_id.isBlank()) {
            failJob(state, job, "missing_project", "modrinth_project_id required", false);
            return;
        }
        PrimaryFile primary = fetchPrimaryFile(
                job.version_id, job.project_id, job.expected_sha512, metadataFetcher);
        if (primary == null) {
            failJob(state, job, "version_not_found",
                    "Modrinth version not found, has no file, or does not belong to this project", true);
            return;
        }
        if (job.expected_sha512 != null && !job.expected_sha512.isBlank()
                && !job.expected_sha512.equalsIgnoreCase(primary.sha512())) {
            failJob(state, job, "hash_mismatch",
                    "Expected hash does not match Modrinth primary file", false);
            return;
        }

        job.transition(ModMutateJob.STATE_FETCHING);
        state.updateMutateJob(job);
        Files.createDirectories(stagingRoot);
        ModrinthFileFetcher.Result fetched = fetcher.fetchAndVerify(
                URI.create(primary.url()),
                stagingRoot,
                primary.filename(),
                primary.sha512());
        if (!fetched.ok()) {
            failJob(state, job, fetched.errorCode(), fetched.message(),
                    "download_failed".equals(fetched.errorCode()) || "interrupted".equals(fetched.errorCode()));
            return;
        }

        job.transition(ModMutateJob.STATE_VERIFYING);
        state.updateMutateJob(job);
        job.transition(ModMutateJob.STATE_APPLYING);
        state.updateMutateJob(job);

        String basename = ModJarPaths.safeSegment(primary.filename());
        if (basename == null) {
            failJob(state, job, "invalid_filename", "Modrinth filename is not a safe jar name", false);
            return;
        }
        Path dest = ModJarPaths.resolveTopLevelJar(modsDir, basename);
        if (dest == null) {
            failJob(state, job, "invalid_filename", "Install path rejected", false);
            return;
        }
        if (Files.exists(dest)) {
            failJob(state, job, "already_installed", "A jar with that name already exists in mods/", false);
            return;
        }
        Files.createDirectories(modsDir);
        Files.copy(fetched.file().path(), dest, StandardCopyOption.REPLACE_EXISTING);

        job.jar_basename = basename;
        job.backup_id = null; // install has no prior jar to back up
        job.expected_sha512 = primary.sha512();
        job.transition(ModMutateJob.STATE_DONE);
        state.updateMutateJob(job);
        recordRestartNudge(server, basename);
        refreshJarMetadataCache(server, "mutate_install");
        ModRuntime.logger().info("[Watchtower] Installed mod {} as {} (job {})",
                job.mod_id, basename, job.id);
    }

    private static void runQuarantine(
            ServerContext server,
            WatchtowerRuntimeState state,
            ModMutateJob job,
            Path modsDir,
            Path backupsDir) {
        String jar = resolveLiveJarBasename(server.serverDirectory(), job.mod_id, job.jar_basename);
        if (jar == null) {
            failJob(state, job, "not_found", "No live jar found for mod", false);
            return;
        }
        job.jar_basename = jar;
        job.transition(ModMutateJob.STATE_BACKING_UP);
        state.updateMutateJob(job);
        job.transition(ModMutateJob.STATE_APPLYING);
        state.updateMutateJob(job);

        ModJarSwap.Result result = ModJarSwap.quarantine(
                modsDir, backupsDir, job.mod_id, jar,
                new ModJarSwap.SwapMeta(null, "quarantined", job.id, job.actor_id, job.actor_name, null));
        if (!result.ok()) {
            failJob(state, job, result.errorCode(), result.message(), false);
            return;
        }
        job.backup_id = result.backupId();
        job.transition(ModMutateJob.STATE_DONE);
        state.updateMutateJob(job);
        recordRestartNudge(server, jar);
        refreshJarMetadataCache(server, "mutate_quarantine");
    }

    private static void runUndo(
            ServerContext server,
            WatchtowerRuntimeState state,
            ModMutateJob job,
            Path modsDir,
            Path backupsDir) {
        job.transition(ModMutateJob.STATE_APPLYING);
        state.updateMutateJob(job);

        ModJarSwap.Result result;
        if (job.backup_id != null && !job.backup_id.isBlank()) {
            result = ModJarSwap.undo(modsDir, backupsDir, job.backup_id);
        } else if (job.mod_id != null && !job.mod_id.isBlank()) {
            result = ModJarSwap.undoLatest(modsDir, backupsDir, job.mod_id);
        } else {
            failJob(state, job, "invalid_undo", "Provide backup_id or mod_id", false);
            return;
        }
        if (!result.ok()) {
            failJob(state, job, result.errorCode(), result.message(), false);
            return;
        }
        job.backup_id = result.backupId();
        job.jar_basename = result.jarBasename();
        job.transition(ModMutateJob.STATE_DONE);
        state.updateMutateJob(job);
        recordRestartNudge(server, result.jarBasename());
        refreshJarMetadataCache(server, "mutate_undo");
    }

    private record SwapOutcome(
            boolean ok, String backupId, String jarBasename, String errorCode, String message, boolean retryable) {
        static SwapOutcome success(String backupId, String jar) {
            return new SwapOutcome(true, backupId, jar, null, null, false);
        }

        static SwapOutcome fail(String code, String message, boolean retryable) {
            return new SwapOutcome(false, null, null, code, message, retryable);
        }
    }

    /**
     * Shared swap routine for single and batch steps.
     * When {@code step} is non-null, fields are read from the step and job-level state
     * transitions are skipped (batch keeps the parent job non-terminal until the end).
     */
    private static SwapOutcome applyOneSwap(
            ServerContext server,
            WatchtowerRuntimeState state,
            ModMutateJob job,
            ModMutateJob.Step step,
            ModrinthFileFetcher fetcher,
            VersionMetadataFetcher metadataFetcher,
            Path modsDir,
            Path backupsDir,
            Path stagingRoot) throws Exception {
        String modId = step != null ? step.mod_id : job.mod_id;
        String jarHint = step != null ? step.jar_basename : job.jar_basename;
        String versionId = step != null ? step.version_id : job.version_id;
        String projectId = step != null ? step.project_id : job.project_id;
        String expectedSha = step != null ? step.expected_sha512 : job.expected_sha512;
        boolean batchStep = step != null;

        if (versionId == null || versionId.isBlank()) {
            return SwapOutcome.fail("missing_version", "modrinth_version_id required", false);
        }
        if (projectId == null || projectId.isBlank()) {
            // Resolve from ops-cache when client omitted it
            projectId = resolveProjectId(server.serverDirectory(), modId);
        }
        if (projectId == null || projectId.isBlank()) {
            return SwapOutcome.fail("missing_project", "modrinth_project_id required", false);
        }

        String liveJar = resolveLiveJarBasename(server.serverDirectory(), modId, jarHint);
        if (liveJar == null) {
            return SwapOutcome.fail("not_found",
                    "No live jar found for mod " + (modId != null ? modId : ""), false);
        }
        if (batchStep) {
            step.jar_basename = liveJar;
            step.state = ModMutateJob.STATE_FETCHING;
        } else {
            job.jar_basename = liveJar;
            job.transition(ModMutateJob.STATE_FETCHING);
        }
        state.updateMutateJob(job);

        PrimaryFile primary = fetchPrimaryFile(versionId, projectId, expectedSha, metadataFetcher);
        if (primary == null) {
            return SwapOutcome.fail("version_not_found",
                    "Modrinth version not found, has no file, or does not belong to this project", true);
        }
        String sha = (expectedSha != null && !expectedSha.isBlank()) ? expectedSha.trim() : primary.sha512();
        if (sha == null || sha.isBlank()) {
            return SwapOutcome.fail("missing_hash", "Modrinth file has no sha512", false);
        }
        if (expectedSha != null && !expectedSha.isBlank()
                && !expectedSha.equalsIgnoreCase(primary.sha512())) {
            return SwapOutcome.fail("hash_mismatch",
                    "Expected hash does not match Modrinth primary file", false);
        }

        Files.createDirectories(stagingRoot);
        ModrinthFileFetcher.Result fetched = fetcher.fetchAndVerify(
                URI.create(primary.url()),
                stagingRoot,
                primary.filename(),
                sha);
        if (!fetched.ok()) {
            boolean retryable = "download_failed".equals(fetched.errorCode())
                    || "interrupted".equals(fetched.errorCode());
            return SwapOutcome.fail(fetched.errorCode(), fetched.message(), retryable);
        }

        if (batchStep) {
            step.state = ModMutateJob.STATE_VERIFYING;
        } else {
            job.transition(ModMutateJob.STATE_VERIFYING);
        }
        state.updateMutateJob(job);

        if (batchStep) {
            step.state = ModMutateJob.STATE_BACKING_UP;
        } else {
            job.transition(ModMutateJob.STATE_BACKING_UP);
        }
        state.updateMutateJob(job);

        if (batchStep) {
            step.state = ModMutateJob.STATE_APPLYING;
        } else {
            job.transition(ModMutateJob.STATE_APPLYING);
        }
        state.updateMutateJob(job);

        ModJarSwap.Result applied = ModJarSwap.applySwap(
                modsDir,
                backupsDir,
                fetched.file().path(),
                modId,
                liveJar,
                new ModJarSwap.SwapMeta(
                        null,
                        primary.versionNumber(),
                        job.id,
                        job.actor_id,
                        job.actor_name,
                        primary.filename()));
        if (!applied.ok()) {
            return SwapOutcome.fail(applied.errorCode(), applied.message(), false);
        }
        return SwapOutcome.success(applied.backupId(), applied.jarBasename());
    }

    public static PrimaryFile fetchPrimaryFile(
            String versionId,
            String expectedProjectId,
            String expectedSha512Ignored,
            VersionMetadataFetcher metadataFetcher) throws IOException, InterruptedException {
        if (versionId == null || versionId.isBlank() || metadataFetcher == null) {
            return null;
        }
        String body = metadataFetcher.getJson(VERSION_URL + versionId.trim());
        if (body == null || body.isBlank()) {
            return null;
        }
        JsonObject version = JsonParser.parseString(body).getAsJsonObject();
        if (expectedProjectId != null && !expectedProjectId.isBlank()) {
            String actualProject = str(version, "project_id");
            if (actualProject == null || !expectedProjectId.trim().equalsIgnoreCase(actualProject.trim())) {
                return null;
            }
        }
        return pickPrimaryFile(version);
    }

    static PrimaryFile pickPrimaryFile(JsonObject version) {
        if (version == null || !version.has("files") || !version.get("files").isJsonArray()) {
            return null;
        }
        JsonArray files = version.getAsJsonArray("files");
        JsonObject chosen = null;
        for (JsonElement el : files) {
            if (!el.isJsonObject()) {
                continue;
            }
            JsonObject f = el.getAsJsonObject();
            if (f.has("primary") && f.get("primary").getAsBoolean()) {
                chosen = f;
                break;
            }
            if (chosen == null) {
                chosen = f;
            }
        }
        if (chosen == null) {
            return null;
        }
        String url = str(chosen, "url");
        String filename = str(chosen, "filename");
        String sha512 = null;
        if (chosen.has("hashes") && chosen.get("hashes").isJsonObject()) {
            sha512 = str(chosen.getAsJsonObject("hashes"), "sha512");
        }
        if (url == null || filename == null || sha512 == null) {
            return null;
        }
        return new PrimaryFile(url, filename, sha512, str(version, "version_number"));
    }

    /**
     * List compatible Modrinth versions for a project (loader + MC from platform / config).
     */
    public static JsonArray fetchProjectVersions(
            String projectId,
            ReportConfig config,
            Path serverDir,
            VersionMetadataFetcher metadataFetcher) throws IOException, InterruptedException {
        if (projectId == null || projectId.isBlank() || metadataFetcher == null) {
            return new JsonArray();
        }
        String loader = ModrinthLookupService.normalizeLoader(config != null ? config.loader() : "neoforge");
        String mc = ModrinthLookupService.minecraftVersionFromServerDir(
                serverDir != null ? serverDir.toString() : null);
        String loaders = URLEncoder.encode("[\"%s\"]".formatted(loader), StandardCharsets.UTF_8);
        String url = PROJECT_VERSIONS_URL + projectId.trim() + "/version?loaders=" + loaders;
        if (mc != null && !mc.isBlank()) {
            String games = URLEncoder.encode("[\"%s\"]".formatted(mc), StandardCharsets.UTF_8);
            url += "&game_versions=" + games;
        }
        String body = metadataFetcher.getJson(url);
        if (body == null || body.isBlank()) {
            return new JsonArray();
        }
        JsonElement parsed = JsonParser.parseString(body);
        JsonArray versions = parsed.isJsonArray() ? parsed.getAsJsonArray() : new JsonArray();
        return ModrinthLookupService.preferMatchingGameVersion(versions, mc);
    }

    /** True when jarBasename is owned by modId (metadata id match, else basename prefix match). */
    static boolean jarHintBelongsToMod(Path serverDir, String modId, String jarBasename) {
        if (jarBasename == null || jarBasename.isBlank()) {
            return false;
        }
        if (modId == null || modId.isBlank()) {
            return true;
        }
        String wanted = modId.trim();
        String jar = jarBasename.trim();
        try {
            for (ModJarMetadataReader.ModEntry entry : ModJarMetadataReader.readFromModsDir(serverDir.toString())) {
                if (entry.jarFile() == null || !jar.equalsIgnoreCase(entry.jarFile())) {
                    continue;
                }
                if (entry.id() != null && wanted.equalsIgnoreCase(entry.id())) {
                    return true;
                }
                // Metadata says this jar belongs to a different mod id
                if (entry.id() != null && !entry.id().isBlank()) {
                    return false;
                }
            }
        } catch (Exception ignored) {
        }
        return jarBasenameMatchesModId(jar, wanted);
    }

    /**
     * Resolve live jar basename from mods/ metadata and ops-cache JSON.
     * When jarHint points at an existing file that does not belong to modId, ignore the hint
     * and continue with modId-based resolution (do not swap/quarantine the wrong jar).
     */
    public static String resolveLiveJarBasename(Path serverDir, String modId, String jarHint) {
        if (jarHint != null && !jarHint.isBlank()) {
            String safe = ModJarPaths.safeSegment(jarHint.trim());
            if (safe != null) {
                Path live = ModJarPaths.resolveTopLevelJar(serverDir.resolve("mods"), safe);
                if (live != null && Files.isRegularFile(live)) {
                    if (jarHintBelongsToMod(serverDir, modId, safe)) {
                        return safe;
                    }
                    // Mismatch: ignore hint; fall through to modId resolution
                }
            }
        }
        if (modId == null || modId.isBlank()) {
            return null;
        }
        String wanted = modId.trim();

        try {
            for (ModJarMetadataReader.ModEntry entry : ModJarMetadataReader.readFromModsDir(serverDir.toString())) {
                if (entry.id() != null && wanted.equalsIgnoreCase(entry.id())
                        && entry.jarFile() != null && !entry.jarFile().isBlank()) {
                    return entry.jarFile();
                }
            }
        } catch (Exception ignored) {
        }

        String fromOps = findJarInOpsCache(serverDir, wanted);
        if (fromOps != null) {
            Path live = ModJarPaths.resolveTopLevelJar(serverDir.resolve("mods"), fromOps);
            if (live != null && Files.isRegularFile(live)
                    && jarHintBelongsToMod(serverDir, wanted, fromOps)) {
                return fromOps;
            }
        }

        // Fallback: exact stem / modid- prefix only (never bare substring — avoids create vs somecreatemod)
        Path mods = serverDir.resolve("mods");
        if (Files.isDirectory(mods)) {
            List<String> matches = new ArrayList<>();
            try (DirectoryStream<Path> stream = Files.newDirectoryStream(mods, "*.jar")) {
                for (Path p : stream) {
                    String name = p.getFileName().toString();
                    if (jarBasenameMatchesModId(name, wanted)) {
                        matches.add(name);
                    }
                }
            } catch (IOException ignored) {
            }
            if (matches.size() == 1) {
                return matches.get(0);
            }
        }
        return null;
    }

    /** {@code modid.jar}, {@code modid-*.jar}, {@code modid+*.jar}, {@code modid_*.jar} only. */
    static boolean jarBasenameMatchesModId(String jarName, String modId) {
        if (jarName == null || modId == null || modId.isBlank()) {
            return false;
        }
        String lower = jarName.toLowerCase(Locale.ROOT);
        String id = modId.trim().toLowerCase(Locale.ROOT);
        if (!lower.endsWith(".jar")) {
            return false;
        }
        if (lower.equals(id + ".jar")) {
            return true;
        }
        return lower.startsWith(id + "-")
                || lower.startsWith(id + "+")
                || lower.startsWith(id + "_");
    }

    /** Find Modrinth project id for a local mod from ops-cache / facts enrichment. */
    public static String resolveProjectId(Path serverDir, String modId) {
        if (serverDir == null || modId == null || modId.isBlank()) {
            return null;
        }
        String wanted = modId.trim();
        Path ops = WatchtowerPaths.opsCachePath(serverDir);
        if (!Files.isRegularFile(ops)) {
            return null;
        }
        try {
            JsonObject root = JsonParser.parseString(Files.readString(ops, StandardCharsets.UTF_8)).getAsJsonObject();
            JsonArray mods = findModsArray(root);
            if (mods == null) {
                return null;
            }
            for (JsonElement el : mods) {
                if (!el.isJsonObject()) {
                    continue;
                }
                JsonObject m = el.getAsJsonObject();
                String id = firstStr(m, "id", "mod_id");
                if (id == null || !wanted.equalsIgnoreCase(id)) {
                    continue;
                }
                String project = firstStr(m, "modrinth_project_id", "project_id");
                if (project != null && !project.isBlank()) {
                    return project;
                }
            }
            // modrinth_updates rows
            if (root.has("optional") && root.get("optional").isJsonObject()) {
                JsonObject optional = root.getAsJsonObject("optional");
                if (optional.has("modrinth_updates") && optional.get("modrinth_updates").isJsonArray()) {
                    for (JsonElement el : optional.getAsJsonArray("modrinth_updates")) {
                        if (!el.isJsonObject()) {
                            continue;
                        }
                        JsonObject u = el.getAsJsonObject();
                        String mid = firstStr(u, "mod_id", "id");
                        if (mid != null && wanted.equalsIgnoreCase(mid)) {
                            String project = firstStr(u, "project_id", "modrinth_project_id");
                            if (project != null && !project.isBlank()) {
                                return project;
                            }
                        }
                    }
                }
            }
        } catch (Exception ignored) {
        }
        return null;
    }

    private static String findJarInOpsCache(Path serverDir, String modId) {
        Path ops = WatchtowerPaths.opsCachePath(serverDir);
        if (!Files.isRegularFile(ops)) {
            return null;
        }
        try {
            JsonObject root = JsonParser.parseString(Files.readString(ops, StandardCharsets.UTF_8)).getAsJsonObject();
            JsonArray mods = findModsArray(root);
            if (mods == null) {
                return null;
            }
            for (JsonElement el : mods) {
                if (!el.isJsonObject()) {
                    continue;
                }
                JsonObject m = el.getAsJsonObject();
                String id = firstStr(m, "id", "mod_id");
                if (id == null || !modId.equalsIgnoreCase(id)) {
                    continue;
                }
                String jar = firstStr(m, "jar_file", "jar");
                if (jar != null && !jar.isBlank()) {
                    return Path.of(jar).getFileName().toString();
                }
            }
        } catch (Exception ignored) {
        }
        return null;
    }

    private static JsonArray findModsArray(JsonObject root) {
        if (root == null) {
            return null;
        }
        if (root.has(OpsCacheSchema.RUNNING_MODS) && root.get(OpsCacheSchema.RUNNING_MODS).isJsonObject()) {
            JsonObject rm = root.getAsJsonObject(OpsCacheSchema.RUNNING_MODS);
            if (rm.has(OpsCacheSchema.RUNNING_MODS_MODS) && rm.get(OpsCacheSchema.RUNNING_MODS_MODS).isJsonArray()) {
                return rm.getAsJsonArray(OpsCacheSchema.RUNNING_MODS_MODS);
            }
        }
        if (root.has("optional") && root.get("optional").isJsonObject()) {
            JsonObject optional = root.getAsJsonObject("optional");
            if (optional.has("mods") && optional.get("mods").isJsonArray()) {
                return optional.getAsJsonArray("mods");
            }
        }
        if (root.has("mods") && root.get("mods").isJsonArray()) {
            return root.getAsJsonArray("mods");
        }
        return null;
    }

    private static void recordRestartNudge(ServerContext server, String jarBasename) {
        if (jarBasename == null || jarBasename.isBlank()) {
            return;
        }
        try {
            Path statePath = WatchtowerPaths.statePath(server);
            JsonObject pending = StateManager.getModRestartPending(statePath);
            pending = ModRestartNudge.recordChange(pending, jarBasename, Instant.now());
            StateManager.setModRestartPending(statePath, pending);
        } catch (Exception e) {
            ModRuntime.logger().debug("Failed to set mod restart nudge: {}", e.toString());
        }
    }

    private static void refreshJarMetadataCache(ServerContext server, String reason) {
        if (server == null) {
            return;
        }
        try {
            ModJarMetadataCache.get().invalidate(reason);
            ModJarMetadataCacheScheduler.requestRebuild(server, reason);
        } catch (Exception e) {
            ModRuntime.logger().debug("Mod jar metadata cache refresh failed: {}", e.toString());
        }
    }

    private static void failJob(
            WatchtowerRuntimeState state,
            ModMutateJob job,
            String code,
            String message,
            boolean retryable) {
        job.error_code = code;
        job.error = message != null ? message : "Mutate failed";
        job.retryable = retryable;
        job.transition(ModMutateJob.STATE_FAILED);
        state.updateMutateJob(job);
    }

    private static void wipeStaging(ServerContext server, String jobId) {
        if (jobId == null || jobId.isBlank()) {
            return;
        }
        Path staging = WatchtowerPaths.modStagingDir(server).resolve(jobId).normalize();
        Path root = WatchtowerPaths.modStagingDir(server).normalize();
        if (!staging.startsWith(root)) {
            return;
        }
        try {
            if (Files.isDirectory(staging)) {
                try (Stream<Path> walk = Files.walk(staging)) {
                    walk.sorted(Comparator.reverseOrder()).forEach(p -> {
                        try {
                            Files.deleteIfExists(p);
                        } catch (IOException ignored) {
                        }
                    });
                }
            }
        } catch (IOException ignored) {
        }
    }

    public static VersionMetadataFetcher defaultMetadataFetcher() {
        HttpClient client = HttpClient.newBuilder()
                .connectTimeout(Duration.ofSeconds(15))
                .followRedirects(HttpClient.Redirect.NORMAL)
                .build();
        return url -> {
            HttpRequest request = HttpRequest.newBuilder(URI.create(url))
                    .timeout(Duration.ofSeconds(30))
                    .header("User-Agent", USER_AGENT)
                    .GET()
                    .build();
            HttpResponse<String> response = client.send(request, HttpResponse.BodyHandlers.ofString());
            if (response.statusCode() < 200 || response.statusCode() >= 300) {
                throw new IOException("HTTP " + response.statusCode());
            }
            return response.body();
        };
    }

    private static String str(JsonObject o, String key) {
        if (o == null || !o.has(key) || o.get(key).isJsonNull()) {
            return null;
        }
        try {
            String v = o.get(key).getAsString();
            return v != null && !v.isBlank() ? v : null;
        } catch (Exception e) {
            return null;
        }
    }

    private static String firstStr(JsonObject o, String... keys) {
        for (String key : keys) {
            String v = str(o, key);
            if (v != null) {
                return v;
            }
        }
        return null;
    }
}
