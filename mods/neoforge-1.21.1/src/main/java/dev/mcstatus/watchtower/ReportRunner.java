package dev.mcstatus.watchtower;

import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.ops.OpsCacheWriter;
import dev.mcstatus.watchtower.core.report.ReportConfig;
import dev.mcstatus.watchtower.core.report.ReportEngine;
import dev.mcstatus.watchtower.core.report.ReportRetentionPolicy;
import dev.mcstatus.watchtower.core.report.ReportSchedule;
import dev.mcstatus.watchtower.core.report.StateManager;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerPlayer;

import java.io.IOException;
import java.nio.file.Path;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.TimeUnit;
import java.util.function.Consumer;

public final class ReportRunner {

    private ReportRunner() {
    }

    public static CompletableFuture<Void> runAsync(
            MinecraftServer server,
            WatchtowerRuntimeState state,
            Consumer<String> feedback
    ) {
        return runAsync(server, state, feedback, ReportRunOptions.empty());
    }

    public static CompletableFuture<Void> runAsync(
            MinecraftServer server,
            WatchtowerRuntimeState state,
            Consumer<String> feedback,
            ReportRunOptions options
    ) {
        if (!state.tryBeginReport()) {
            feedback.accept("A report is already running.");
            return CompletableFuture.completedFuture(null);
        }

        if (!WatchtowerSetup.isReady()) {
            state.finishReport(false, WatchtowerSetup.getMessage(), null, null, null, null);
            feedback.accept(WatchtowerSetup.getMessage());
            return CompletableFuture.completedFuture(null);
        }

        if (!EngineProbe.isAvailable()) {
            String reason = EngineProbe.getFailureReason();
            state.finishReport(false, reason, null, null, null, null);
            feedback.accept(reason);
            return CompletableFuture.completedFuture(null);
        }

        feedback.accept("Starting health report...");

        int timeoutMinutes = reportTimeoutMinutes();
        try {
            return CompletableFuture
                    .supplyAsync(() -> runReport(server, options))
                    .orTimeout(timeoutMinutes, TimeUnit.MINUTES)
                    .handle((result, err) -> {
                        if (err != null) {
                            String msg = err instanceof java.util.concurrent.TimeoutException
                                    ? "Report timed out after " + timeoutMinutes + " minutes"
                                    : "Report error: " + err.getMessage();
                            WatchtowerMod.LOGGER.warn("[Watchtower] {}", msg);
                            return ReportEngine.ReportResult.failure(msg);
                        }
                        return result;
                    })
                    .thenAccept(result -> finishOnServerThread(server, state, feedback, result, options));
        } catch (LinkageError e) {
            String msg = EngineProbe.getFailureReason();
            WatchtowerMod.LOGGER.error("[Watchtower] Report engine linkage error", e);
            state.finishReport(false, msg, null, null, null, null);
            feedback.accept(msg);
            return CompletableFuture.completedFuture(null);
        }
    }

    private static ReportEngine.ReportResult runReport(MinecraftServer server, ReportRunOptions options) {
        try {
            ReportConfig config = ModReportConfig.forServer(server, options != null ? options : ReportRunOptions.empty());
            Path reportDir = WatchtowerPaths.reportDir(server);
            WatchtowerMod.LOGGER.info("[Watchtower] Running pure-Java report");
            return ReportEngine.run(config, reportDir);
        } catch (Exception e) {
            WatchtowerMod.LOGGER.warn("[Watchtower] Report failed", e);
            return ReportEngine.ReportResult.failure(e.getMessage() != null ? e.getMessage() : "Report failed");
        }
    }

    private static void finishOnServerThread(
            MinecraftServer server,
            WatchtowerRuntimeState state,
            Consumer<String> feedback,
            ReportEngine.ReportResult result,
            ReportRunOptions options
    ) {
        String briefPath = result.briefPath() != null ? result.briefPath().toString() : "";
        String factsPath = result.factsPath() != null ? result.factsPath().toString() : "";
        FactsReader.IssueCounts issueCounts = result.success() && result.facts() != null
                ? FactsReader.readIssueCountsFromJson(result.facts())
                : FactsReader.IssueCounts.empty();

        server.execute(() -> {
            state.finishReport(result.success(), result.message(), briefPath, factsPath, "", issueCounts);
            if (result.success()) {
                try {
                    DrReadmeWriter.writeAfterSuccessfulReport(server);
                } catch (IOException e) {
                    WatchtowerMod.LOGGER.warn("[Watchtower] Failed to write DR-README.txt", e);
                }
                Path opsCachePath = WatchtowerPaths.opsCachePath(server);
                Path rollupsPath = WatchtowerPaths.performanceRollupsPath(server);
                Path statePath = WatchtowerPaths.statePath(server);
                if (result.facts() != null) {
                    try {
                        OpsCacheWriter.reconcileFromFacts(
                                opsCachePath,
                                statePath,
                                rollupsPath,
                                result.facts(),
                                ModReportConfig.forServer(server).lookbackHours());
                    } catch (IOException e) {
                        WatchtowerMod.LOGGER.warn("[Watchtower] Ops cache reconcile failed", e);
                    }
                }
                if (options != null && options.scheduled()) {
                    WatchtowerScheduler scheduler = WatchtowerBootstrap.getScheduler();
                    scheduler.onReportCompleted(true);
                    try {
                        StateManager.updateScheduleState(
                                statePath,
                                scheduler.lastWallClockSlotFired(),
                                ReportSchedule.toIso(java.time.LocalDateTime.now(ReportSchedule.serverZone()))
                        );
                    } catch (IOException e) {
                        WatchtowerMod.LOGGER.warn("[Watchtower] Failed to persist schedule state", e);
                    }
                }
                try {
                    ReportConfig retentionConfig = ModReportConfig.forServer(server);
                    int pruned = ReportRetentionPolicy.prune(
                            WatchtowerPaths.reportDir(server),
                            retentionConfig.reportRetentionCount(),
                            retentionConfig.reportRetentionDays());
                    if (pruned > 0) {
                        WatchtowerMod.LOGGER.info("[Watchtower] Pruned {} old report artifact(s)", pruned);
                    }
                } catch (IOException e) {
                    WatchtowerMod.LOGGER.warn("[Watchtower] Report retention prune failed", e);
                }
                StringBuilder sb = new StringBuilder(result.message());
                sb.append(String.format(" — %d active, %d historical",
                        issueCounts.activeCount(), issueCounts.historicalCount()));
                if (!briefPath.isBlank()) {
                    sb.append(" | Brief: ").append(briefPath);
                }
                feedback.accept(sb.toString());
            } else {
                feedback.accept(result.message());
            }
        });
    }

    private static int reportTimeoutMinutes() {
        try {
            return WatchtowerConfig.REPORT_TIMEOUT_MINUTES.get();
        } catch (IllegalStateException e) {
            return 15;
        }
    }

    public static void sendFeedback(MinecraftServer server, ServerPlayer player, String message) {
        WatchtowerMod.LOGGER.info("[Watchtower] {}", message);
        if (player != null) {
            player.sendSystemMessage(net.minecraft.network.chat.Component.literal("[Watchtower] " + message));
        }
    }
}
