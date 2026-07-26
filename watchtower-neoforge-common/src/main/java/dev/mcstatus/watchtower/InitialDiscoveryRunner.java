package dev.mcstatus.watchtower;

import com.google.gson.GsonBuilder;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import dev.mcstatus.watchtower.core.ops.OpsCacheWriter;
import dev.mcstatus.watchtower.core.report.ReportConfig;
import dev.mcstatus.watchtower.core.report.ReportEngine;
import dev.mcstatus.watchtower.core.report.ReportProgress;
import dev.mcstatus.watchtower.core.report.ReportRetentionPolicy;
import dev.mcstatus.watchtower.runtime.ModRuntime;
import dev.mcstatus.watchtower.runtime.ServerContext;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import java.util.function.Consumer;

/**
 * Wizard Initial discovery — first-run <strong>deep audit</strong> baseline via {@link ReportEngine}.
 * Writes BAU facts/brief and reconciles ops-cache; continuous Watching/Scanning handle deltas after that.
 */
public final class InitialDiscoveryRunner {

    public static final String STATUS_FILENAME = "discovery-status.json";

    /** Ordered ReportEngine stages surfaced in the wizard checklist. */
    private static final List<String> STAGE_ORDER = List.of(
            "window", "collect", "analyze", "enrich", "write", "finalize", "done"
    );

    private static final Map<String, String> STAGE_LABELS = Map.of(
            "window", "Computing time window",
            "collect", "Collecting logs, crashes, mods, host metrics",
            "analyze", "Analyzing health and crashes",
            "enrich", "Enriching incidents and scorecard",
            "write", "Writing facts and brief",
            "finalize", "Saving state and ops cache",
            "done", "Done"
    );

    private InitialDiscoveryRunner() {
    }

    public static CompletableFuture<Void> runAsync(
            ServerContext server,
            WatchtowerRuntimeState state,
            Consumer<String> feedback
    ) {
        if (!state.tryBeginDiscovery()) {
            feedback.accept("Initial discovery already running.");
            return CompletableFuture.completedFuture(null);
        }
        return continueAfterBegin(server, state, feedback);
    }

    public static CompletableFuture<Void> continueAfterBegin(
            ServerContext server,
            WatchtowerRuntimeState state,
            Consumer<String> feedback
    ) {
        if (!WatchtowerSetup.isReady()) {
            JsonObject status = failStatus(WatchtowerSetup.getMessage());
            persistStatus(server, status);
            state.finishDiscovery(false, WatchtowerSetup.getMessage(), status);
            feedback.accept(WatchtowerSetup.getMessage());
            return CompletableFuture.completedFuture(null);
        }
        if (!EngineProbe.isAvailable()) {
            String reason = EngineProbe.getFailureReason();
            JsonObject status = failStatus(reason);
            persistStatus(server, status);
            state.finishDiscovery(false, reason, status);
            feedback.accept(reason);
            return CompletableFuture.completedFuture(null);
        }
        // Hold report lock so Support compose / schedule cannot overlap the baseline audit.
        if (!state.tryBeginReport()) {
            String msg = "A report or support compose is already running. Try again in a moment.";
            JsonObject status = failStatus(msg);
            persistStatus(server, status);
            state.finishDiscovery(false, msg, status);
            feedback.accept(msg);
            return CompletableFuture.completedFuture(null);
        }

        feedback.accept("Starting initial deep audit…");
        applyStage(state, "window", STAGE_LABELS.get("window"), "Preparing baseline lookback…");

        // First-run baseline: no orTimeout — large packs can exceed the TOML report timeout.
        return CompletableFuture
                .supplyAsync(() -> runDeepAudit(server, state))
                .handle((result, err) -> {
                    if (err != null) {
                        String msg = err.getCause() != null && err.getCause().getMessage() != null
                                ? err.getCause().getMessage()
                                : (err.getMessage() != null ? err.getMessage() : "Initial deep audit failed");
                        ModRuntime.logger().warn("[Watchtower] Initial discovery failed", err);
                        JsonObject status = failStatus(msg);
                        persistStatus(server, status);
                        return new Outcome(false, msg, status, null);
                    }
                    return result;
                })
                .thenCompose(outcome -> finishOnServerThread(server, state, feedback, outcome));
    }

    private static Outcome runDeepAudit(ServerContext server, WatchtowerRuntimeState state) {
        Instant started = Instant.now();
        JsonObject status = new JsonObject();
        JsonObject counts = new JsonObject();
        status.addProperty("running", true);
        status.add("counts", counts);

        try {
            try {
                SnapshotWriter.write(server, server.collectSample());
            } catch (Exception e) {
                ModRuntime.logger().warn("[Watchtower] Pre-discovery snapshot refresh failed: {}", e.toString());
            }

            // Full baseline: non-incremental, conf lookback, no wall-clock timeout.
            ReportRunOptions options = new ReportRunOptions(null, null, false, false, true);
            ReportConfig config = ModReportConfig.forServer(server, options);
            Path reportDir = WatchtowerPaths.reportDir(server);

            ReportProgress progress = new ReportProgress() {
                @Override
                public void stage(String id, String label) {
                    applyStage(state, id, label != null ? label : STAGE_LABELS.getOrDefault(id, id), null);
                }

                @Override
                public void detail(String message) {
                    state.setDiscoveryDetail(message);
                    state.setReportDetail(message);
                }

                @Override
                public void units(int done, int total) {
                    state.setDiscoveryUnits(done, total);
                }

                @Override
                public void found(String key, int count) {
                    state.putDiscoveryCount(key, count);
                }
            };

            ReportEngine.ReportResult result = ReportEngine.run(config, reportDir, progress);
            long elapsedMs = Duration.between(started, Instant.now()).toMillis();
            status.addProperty("elapsed_ms", elapsedMs);

            if (!result.success() || result.facts() == null) {
                String msg = result.message() != null ? result.message() : "Initial deep audit failed";
                status.addProperty("running", false);
                status.addProperty("success", false);
                status.addProperty("error", msg);
                status.addProperty("message", msg);
                status.addProperty("stage", state.getDiscoveryStage());
                status.addProperty("stage_label", state.getDiscoveryStageLabel());
                return new Outcome(false, msg, status, result);
            }

            fillCountsFromFacts(counts, result.facts());
            // Preserve live inventory counts gathered mid-run (e.g. log file total).
            JsonObject liveCounts = state.getDiscoveryCounts();
            if (liveCounts != null) {
                for (String key : List.of("logs", "crashes", "jars")) {
                    if (liveCounts.has(key) && (!counts.has(key) || counts.get(key).getAsInt() == 0)) {
                        counts.addProperty(key, liveCounts.get(key).getAsInt());
                    }
                }
            }
            applyStage(state, "done", STAGE_LABELS.get("done"), "Baseline facts written");
            state.setDiscoveryCounts(counts);

            status.addProperty("running", false);
            status.addProperty("success", true);
            status.addProperty("stage", "done");
            status.addProperty("stage_label", STAGE_LABELS.get("done"));
            status.add("counts", counts.deepCopy());
            if (result.factsPath() != null) {
                status.addProperty("facts_path", result.factsPath().toString());
            }
            if (result.briefPath() != null) {
                status.addProperty("brief_path", result.briefPath().toString());
            }
            JsonObject lastRun = new JsonObject();
            lastRun.addProperty("started_at", started.toString());
            lastRun.addProperty("finished_at", Instant.now().toString());
            lastRun.addProperty("duration_ms", elapsedMs);
            status.add("last_run", lastRun);

            String msg = String.format(
                    "Initial deep audit complete (%s) — baseline facts ready for the dashboard",
                    formatDuration(elapsedMs));
            status.addProperty("message", msg);
            return new Outcome(true, msg, status, result);
        } catch (Exception e) {
            String msg = e.getMessage() != null ? e.getMessage() : "Initial deep audit failed";
            ModRuntime.logger().warn("[Watchtower] Initial discovery error", e);
            JsonObject fail = failStatus(msg);
            fail.add("counts", counts);
            fail.addProperty("elapsed_ms", Duration.between(started, Instant.now()).toMillis());
            return new Outcome(false, msg, fail, null);
        }
    }

    private static CompletableFuture<Void> finishOnServerThread(
            ServerContext server,
            WatchtowerRuntimeState state,
            Consumer<String> feedback,
            Outcome outcome
    ) {
        CompletableFuture<Void> done = new CompletableFuture<>();
        server.execute(() -> {
            try {
                ReportEngine.ReportResult result = outcome.result();
                String briefPath = result != null && result.briefPath() != null
                        ? result.briefPath().toString() : "";
                String factsPath = result != null && result.factsPath() != null
                        ? result.factsPath().toString() : "";
                FactsReader.IssueCounts issueCounts = outcome.success() && result != null && result.facts() != null
                        ? FactsReader.readIssueCountsFromJson(result.facts())
                        : FactsReader.IssueCounts.empty();

                state.finishReport(
                        outcome.success(),
                        outcome.message(),
                        briefPath,
                        factsPath,
                        "",
                        issueCounts);

                if (outcome.success() && result != null && result.facts() != null) {
                    try {
                        DrReadmeWriter.writeAfterSuccessfulReport(server);
                    } catch (IOException e) {
                        ModRuntime.logger().warn("[Watchtower] Failed to write DR-README.txt", e);
                    }
                    Path opsCachePath = WatchtowerPaths.opsCachePath(server);
                    Path rollupsPath = WatchtowerPaths.performanceRollupsPath(server);
                    Path statePath = WatchtowerPaths.statePath(server);
                    try {
                        OpsCacheWriter.reconcileFromFacts(
                                opsCachePath,
                                statePath,
                                rollupsPath,
                                result.facts(),
                                ModReportConfig.forServer(server).lookbackHours());
                    } catch (IOException e) {
                        ModRuntime.logger().warn("[Watchtower] Ops cache reconcile failed", e);
                    }
                    try {
                        ReportConfig retentionConfig = ModReportConfig.forServer(server);
                        int pruned = ReportRetentionPolicy.prune(
                                WatchtowerPaths.reportDir(server),
                                retentionConfig.reportRetentionCount(),
                                retentionConfig.reportRetentionDays());
                        if (pruned > 0) {
                            ModRuntime.logger().info("[Watchtower] Pruned {} old report artifact(s)", pruned);
                        }
                    } catch (IOException e) {
                        ModRuntime.logger().warn("[Watchtower] Report retention prune failed", e);
                    }
                }

                persistStatus(server, outcome.status());
                state.finishDiscovery(outcome.success(), outcome.message(), outcome.status());
                if (outcome.success()) {
                    ModRuntime.logger().info("[Watchtower] {}", outcome.message());
                } else {
                    ModRuntime.logger().warn("[Watchtower] {}", outcome.message());
                }
                feedback.accept(outcome.message());
                done.complete(null);
            } catch (Exception e) {
                ModRuntime.logger().warn("[Watchtower] Discovery finish failed", e);
                try {
                    state.finishReport(false, e.getMessage(), null, null, null, null);
                } catch (Exception ignored) {
                }
                try {
                    state.finishDiscovery(false, e.getMessage(), failStatus(e.getMessage()));
                } catch (Exception ignored) {
                }
                done.completeExceptionally(e);
            }
        });
        return done;
    }

    private static void applyStage(
            WatchtowerRuntimeState state,
            String id,
            String label,
            String detail
    ) {
        String stageId = id == null ? "" : id;
        String stageLabel = label != null ? label : STAGE_LABELS.getOrDefault(stageId, stageId);
        state.setDiscoveryStage(stageId, stageLabel);
        state.setReportStage(stageId, stageLabel);
        if (detail != null) {
            state.setDiscoveryDetail(detail);
            state.setReportDetail(detail);
        }
        int idx = STAGE_ORDER.indexOf(stageId);
        if (idx < 0) {
            idx = 0;
        }
        // Keep collect-phase unit progress from scanners; other stages use coarse stage bar.
        if (!"collect".equals(stageId)) {
            int done = "done".equals(stageId) ? STAGE_ORDER.size() : Math.max(1, idx + 1);
            state.setDiscoveryUnits(done, STAGE_ORDER.size());
        }
    }

    /**
     * Populate wizard count tiles from written facts. Schema matches {@link FactsBuilder} /
     * {@link FactsReader}: {@code optional.crash_summaries[]}, {@code optional.mods[]},
     * {@code issues[]} (array of issue objects with optional {@code historical} flag).
     */
    static void fillCountsFromFacts(JsonObject counts, JsonObject facts) {
        if (facts == null || counts == null) {
            return;
        }
        try {
            if (facts.has("optional") && facts.get("optional").isJsonObject()) {
                JsonObject opt = facts.getAsJsonObject("optional");
                // Actual facts schema uses crash_summaries; keep legacy key fallbacks.
                if (opt.has("crash_summaries") && opt.get("crash_summaries").isJsonArray()) {
                    counts.addProperty("crashes", opt.getAsJsonArray("crash_summaries").size());
                } else if (opt.has("crash_reports") && opt.get("crash_reports").isJsonArray()) {
                    counts.addProperty("crashes", opt.getAsJsonArray("crash_reports").size());
                } else if (opt.has("crashes") && opt.get("crashes").isJsonArray()) {
                    counts.addProperty("crashes", opt.getAsJsonArray("crashes").size());
                }
                if (opt.has("mods") && opt.get("mods").isJsonArray()) {
                    counts.addProperty("jars", opt.getAsJsonArray("mods").size());
                }
                if (opt.has("activity_events") && opt.get("activity_events").isJsonArray()) {
                    counts.addProperty("activity_events", opt.getAsJsonArray("activity_events").size());
                }
            }
            if (!counts.has("crashes")
                    && facts.has("minecraft")
                    && facts.get("minecraft").isJsonObject()) {
                JsonObject mc = facts.getAsJsonObject("minecraft");
                if (mc.has("new_crash_reports") && mc.get("new_crash_reports").isJsonArray()) {
                    counts.addProperty("crashes", mc.getAsJsonArray("new_crash_reports").size());
                }
            }
            // issues is a JsonArray (not { active: [] }); count non-historical as active.
            if (facts.has("issues") && facts.get("issues").isJsonArray()) {
                FactsReader.IssueCounts issueCounts = FactsReader.readIssueCountsFromJson(facts);
                counts.addProperty("active_issues", issueCounts.activeCount());
            } else if (facts.has("issues") && facts.get("issues").isJsonObject()) {
                JsonObject issues = facts.getAsJsonObject("issues");
                if (issues.has("active") && issues.get("active").isJsonArray()) {
                    counts.addProperty("active_issues", issues.getAsJsonArray("active").size());
                }
            }
            // After a successful facts write, unknown inventory is "0" not "missing".
            if (!counts.has("crashes")) {
                counts.addProperty("crashes", 0);
            }
            if (!counts.has("active_issues")) {
                counts.addProperty("active_issues", 0);
            }
        } catch (Exception ignored) {
        }
    }

    public static JsonObject loadStatus(Path statusFile) {
        try {
            if (statusFile != null && Files.isRegularFile(statusFile)) {
                return JsonParser.parseString(Files.readString(statusFile, StandardCharsets.UTF_8))
                        .getAsJsonObject();
            }
        } catch (Exception ignored) {
        }
        return new JsonObject();
    }

    public static JsonObject buildLiveStatus(WatchtowerRuntimeState state, Path statusFile) {
        JsonObject loaded = loadStatus(statusFile);
        JsonObject base = loaded.entrySet().isEmpty() && state.getLastDiscoveryStatus() != null
                ? state.getLastDiscoveryStatus().deepCopy()
                : loaded;
        final JsonObject out = base != null ? base : new JsonObject();
        out.addProperty("running", state.isDiscoveryRunning());
        if (state.isDiscoveryRunning()) {
            String stage = state.getDiscoveryStage();
            if (stage != null && !stage.isBlank()) {
                out.addProperty("stage", stage);
            }
            String label = state.getDiscoveryStageLabel();
            if (label != null && !label.isBlank()) {
                out.addProperty("stage_label", label);
            }
            String detail = state.getDiscoveryStageDetail();
            if (detail != null && !detail.isBlank()) {
                out.addProperty("stage_detail", detail);
            }
            JsonObject progress = new JsonObject();
            progress.addProperty("done", state.getDiscoveryProgressDone());
            progress.addProperty("total", state.getDiscoveryProgressTotal());
            out.add("progress", progress);
            out.add("counts", state.getDiscoveryCounts());
            state.getLastDiscoveryStarted().ifPresent(i -> {
                JsonObject last = out.has("last_run") && out.get("last_run").isJsonObject()
                        ? out.getAsJsonObject("last_run") : new JsonObject();
                last.addProperty("started_at", i.toString());
                out.add("last_run", last);
                out.addProperty("elapsed_ms", Duration.between(i, Instant.now()).toMillis());
            });
        } else {
            if (state.getLastDiscoveryFinished().isPresent()) {
                out.addProperty("success", state.isLastDiscoverySuccess());
                if (!state.getLastDiscoveryMessage().isBlank()) {
                    out.addProperty("message", state.getLastDiscoveryMessage());
                    if (!state.isLastDiscoverySuccess()) {
                        out.addProperty("error", state.getLastDiscoveryMessage());
                    }
                }
            }
        }
        return out;
    }

    private static void persistStatus(ServerContext server, JsonObject status) {
        if (server == null || status == null) {
            return;
        }
        try {
            Path file = WatchtowerPaths.watchtowerRoot(server).resolve(STATUS_FILENAME);
            Files.createDirectories(file.getParent());
            Files.writeString(file, new GsonBuilder().setPrettyPrinting().create().toJson(status),
                    StandardCharsets.UTF_8);
        } catch (Exception e) {
            ModRuntime.logger().debug("Failed to persist discovery status: {}", e.toString());
        }
    }

    private static JsonObject failStatus(String message) {
        JsonObject status = new JsonObject();
        status.addProperty("running", false);
        status.addProperty("success", false);
        status.addProperty("error", message == null ? "failed" : message);
        status.addProperty("message", message == null ? "failed" : message);
        return status;
    }

    private static String formatDuration(long elapsedMs) {
        long sec = Math.max(0, elapsedMs / 1000);
        if (sec < 60) {
            return sec + "s";
        }
        long m = sec / 60;
        long s = sec % 60;
        return m + "m " + String.format("%02d", s) + "s";
    }

    private record Outcome(
            boolean success,
            String message,
            JsonObject status,
            ReportEngine.ReportResult result
    ) {
    }
}
