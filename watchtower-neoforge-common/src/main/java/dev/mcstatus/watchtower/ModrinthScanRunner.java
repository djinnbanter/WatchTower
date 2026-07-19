package dev.mcstatus.watchtower;

import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.collect.ModrinthScanJob;
import dev.mcstatus.watchtower.core.collect.ModrinthScanProgress;
import dev.mcstatus.watchtower.core.report.ReportConfig;
import net.minecraft.server.MinecraftServer;

import java.nio.file.Path;
import java.util.concurrent.CompletableFuture;
import java.util.function.Consumer;

/** Runs {@link ModrinthScanJob} off the server thread with live progress into runtime state. */
public final class ModrinthScanRunner {

    private ModrinthScanRunner() {
    }

    /**
     * Continue after {@link WatchtowerRuntimeState#tryBeginModrinthScan()} already succeeded
     * so status polls never race the async start.
     */
    public static CompletableFuture<Void> continueAfterBegin(
            MinecraftServer server,
            WatchtowerRuntimeState state,
            Consumer<String> feedback
    ) {
        if (!WatchtowerSetup.isReady()) {
            state.finishModrinthScan(false, WatchtowerSetup.getMessage(), null);
            feedback.accept(WatchtowerSetup.getMessage());
            return CompletableFuture.completedFuture(null);
        }
        if (!EngineProbe.isAvailable()) {
            String reason = EngineProbe.getFailureReason();
            state.finishModrinthScan(false, reason, null);
            feedback.accept(reason);
            return CompletableFuture.completedFuture(null);
        }

        feedback.accept("Starting Modrinth scan...");
        state.setModrinthScanStage("prepare", "Preparing Modrinth scan");

        return CompletableFuture
                .supplyAsync(() -> runScan(server, state))
                .handle((result, err) -> {
                    if (err != null) {
                        String msg = err.getMessage() != null ? err.getMessage() : "Modrinth scan failed";
                        WatchtowerMod.LOGGER.warn("[Watchtower] Modrinth scan error", err);
                        return new ModrinthScanJob.ScanResult(false, msg, null);
                    }
                    return result;
                })
                .thenAccept(result -> {
                    boolean ok = result != null && result.success();
                    String msg = result != null ? result.message() : "Modrinth scan failed";
                    JsonObject status = result != null ? result.status() : null;
                    state.finishModrinthScan(ok, msg, status);
                    if (ok) {
                        WatchtowerMod.LOGGER.info("[Watchtower] {}", msg);
                    } else {
                        WatchtowerMod.LOGGER.warn("[Watchtower] {}", msg);
                    }
                    feedback.accept(msg);
                });
    }

    private static ModrinthScanJob.ScanResult runScan(MinecraftServer server, WatchtowerRuntimeState state) {
        try {
            ReportConfig config = ModReportConfig.forServer(server, ReportRunOptions.empty());
            String serverDir = server.getServerDirectory().toAbsolutePath().normalize().toString();
            Path reportDir = WatchtowerPaths.reportDir(server);
            ModrinthScanProgress progress = new ModrinthScanProgress() {
                @Override
                public void stage(String id, String label) {
                    state.setModrinthScanStage(id, label);
                }

                @Override
                public void detail(String message) {
                    state.setModrinthScanDetail(message);
                }

                @Override
                public void progress(int done, int total) {
                    state.setModrinthScanUnits(done, total);
                }

                @Override
                public void batch(int index, int count, int size) {
                    state.setModrinthScanBatch(index, count, size);
                }

                @Override
                public void etaSeconds(Integer seconds) {
                    state.setModrinthScanEtaSeconds(seconds);
                }
            };
            return ModrinthScanJob.run(serverDir, config, reportDir, progress);
        } catch (Exception e) {
            WatchtowerMod.LOGGER.warn("[Watchtower] Modrinth scan failed", e);
            return new ModrinthScanJob.ScanResult(
                    false,
                    e.getMessage() != null ? e.getMessage() : "Modrinth scan failed",
                    null);
        }
    }
}
