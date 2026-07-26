package dev.mcstatus.watchtower;

import dev.mcstatus.watchtower.core.ops.OpsCacheWriter;
import dev.mcstatus.watchtower.core.report.ReportSchedule;
import dev.mcstatus.watchtower.core.report.StateManager;
import dev.mcstatus.watchtower.core.report.SupportComposeOptions;
import dev.mcstatus.watchtower.core.report.SupportComposer;
import dev.mcstatus.watchtower.runtime.ModRuntime;
import dev.mcstatus.watchtower.runtime.ServerContext;

import java.io.IOException;
import java.util.concurrent.CompletableFuture;
import java.util.function.Consumer;

/**
 * Async Support compose — scheduled tick, dashboard compose, and CLI.
 * Never runs full {@link dev.mcstatus.watchtower.core.report.ReportEngine} / StagingBuilder.
 */
public final class SupportComposeRunner {

    private SupportComposeRunner() {
    }

    public static CompletableFuture<Void> runAsync(
            ServerContext server,
            WatchtowerRuntimeState state,
            Consumer<String> feedback
    ) {
        return runAsync(server, state, feedback, false, SupportComposeOptions.quickDefaults());
    }

    public static CompletableFuture<Void> runAsync(
            ServerContext server,
            WatchtowerRuntimeState state,
            Consumer<String> feedback,
            boolean scheduled
    ) {
        return runAsync(server, state, feedback, scheduled, SupportComposeOptions.quickDefaults());
    }

    public static CompletableFuture<Void> runAsync(
            ServerContext server,
            WatchtowerRuntimeState state,
            Consumer<String> feedback,
            boolean scheduled,
            SupportComposeOptions options
    ) {
        if (!state.tryBeginReport()) {
            feedback.accept("Support compose already running.");
            return CompletableFuture.completedFuture(null);
        }
        state.setReportStage("compose", "Composing support bundle");
        return continueAfterBegin(server, state, feedback, scheduled, options);
    }

    public static CompletableFuture<Void> continueAfterBegin(
            ServerContext server,
            WatchtowerRuntimeState state,
            Consumer<String> feedback,
            boolean scheduled
    ) {
        return continueAfterBegin(server, state, feedback, scheduled, SupportComposeOptions.quickDefaults());
    }

    public static CompletableFuture<Void> continueAfterBegin(
            ServerContext server,
            WatchtowerRuntimeState state,
            Consumer<String> feedback,
            boolean scheduled,
            SupportComposeOptions options
    ) {
        if (!WatchtowerSetup.isReady()) {
            state.finishReport(false, WatchtowerSetup.getMessage(), null, null, null,
                    FactsReader.IssueCounts.empty());
            feedback.accept(WatchtowerSetup.getMessage());
            return CompletableFuture.completedFuture(null);
        }
        if (!EngineProbe.isAvailable()) {
            String reason = EngineProbe.getFailureReason();
            state.finishReport(false, reason, null, null, null, FactsReader.IssueCounts.empty());
            feedback.accept(reason);
            return CompletableFuture.completedFuture(null);
        }

        SupportComposeOptions opts = options != null ? options : SupportComposeOptions.quickDefaults();
        feedback.accept("Composing support bundle from continuous data...");
        return CompletableFuture
                .supplyAsync(() -> {
                    try {
                        return SupportComposeService.compose(server, opts);
                    } catch (Exception e) {
                        throw new RuntimeException(e);
                    }
                })
                .handle((result, err) -> {
                    if (err != null) {
                        String msg = err.getCause() != null && err.getCause().getMessage() != null
                                ? err.getCause().getMessage()
                                : (err.getMessage() != null ? err.getMessage() : "Support compose failed");
                        ModRuntime.logger().warn("[Watchtower] Support compose failed: {}", msg);
                        return new ComposeOutcome(false, msg, null);
                    }
                    return new ComposeOutcome(true, "Support bundle ready", result);
                })
                .thenAccept(outcome -> server.execute(() ->
                        finishOnServerThread(server, state, feedback, outcome, scheduled)));
    }

    private static void finishOnServerThread(
            ServerContext server,
            WatchtowerRuntimeState state,
            Consumer<String> feedback,
            ComposeOutcome outcome,
            boolean scheduled
    ) {
        SupportComposer.ComposeResult result = outcome.result();
        String brief = result != null && result.briefPath() != null ? result.briefPath().toString() : "";
        String facts = result != null && result.factsPath() != null ? result.factsPath().toString() : "";
        String zip = result != null && result.zipPath() != null ? result.zipPath().toString() : "";
        state.finishReport(outcome.success(), outcome.message(), brief, facts, zip, FactsReader.IssueCounts.empty());

        if (outcome.success() && result != null) {
            try {
                OpsCacheWriter.applySupportComposeAt(WatchtowerPaths.opsCachePath(server));
            } catch (IOException e) {
                ModRuntime.logger().warn("[Watchtower] Failed to record support compose timestamp", e);
            }
            if (scheduled) {
                WatchtowerScheduler scheduler = ModRuntime.scheduler();
                if (scheduler != null) {
                    scheduler.onReportCompleted(true);
                    try {
                        StateManager.updateScheduleState(
                                WatchtowerPaths.statePath(server),
                                scheduler.lastWallClockSlotFired(),
                                ReportSchedule.toIso(java.time.LocalDateTime.now(ReportSchedule.serverZone()))
                        );
                    } catch (IOException e) {
                        ModRuntime.logger().warn("[Watchtower] Failed to persist schedule state", e);
                    }
                }
            }
            String msg = zip + " (" + DiagnosticsPackager.formatSize(result.sizeBytes()) + ")";
            ModRuntime.logger().info("[Watchtower] Support compose finished: {}", msg);
            feedback.accept("Support bundle: " + msg);
        } else {
            feedback.accept(outcome.message());
        }
    }

    private record ComposeOutcome(boolean success, String message, SupportComposer.ComposeResult result) {
    }
}
