package dev.mcstatus.watchtower;

import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.incident.IncidentWriter;
import dev.mcstatus.watchtower.core.ops.ActivityLedgerScanner;
import dev.mcstatus.watchtower.core.ops.LagIssueBuilder;
import dev.mcstatus.watchtower.core.ops.OpsCacheWriter;
import dev.mcstatus.watchtower.core.report.ReportConfig;
import dev.mcstatus.watchtower.core.report.StateManager;
import net.minecraft.server.MinecraftServer;

import java.io.IOException;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;

/**
 * Always-on lag spike detection hooked from live metrics ticks.
 */
public final class LagSpikeDetector {

    private static final int SUSTAINED_SAMPLES = 3;
    private static final int HEALTHY_RESET_SAMPLES = 10;
    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_OFFSET_DATE_TIME;

    private LagSpikeDetector() {
    }

    public static void onLiveSample(MinecraftServer server, double tps, double mspt) {
        if (server == null) {
            return;
        }
        try {
            ReportConfig config = ModReportConfig.forServer(server);
            if (!config.lagIncidentEnabled()) {
                return;
            }

            PathRefs paths = new PathRefs(server);
            boolean breached = mspt > config.msptWarn() || tps < config.tpsWarn();
            int streak = StateManager.getLagBreachStreak(paths.statePath);
            int healthy = StateManager.getLagHealthyStreak(paths.statePath);

            if (breached) {
                StateManager.setLagHealthyStreak(paths.statePath, 0);
                streak++;
                StateManager.setLagBreachStreak(paths.statePath, streak);
                if (streak >= SUSTAINED_SAMPLES) {
                    maybeCapture(server, config, paths, tps, mspt);
                }
            } else {
                StateManager.setLagBreachStreak(paths.statePath, 0);
                healthy++;
                StateManager.setLagHealthyStreak(paths.statePath, healthy);
                if (healthy >= HEALTHY_RESET_SAMPLES) {
                    OpsCacheWriter.updateLagIssueResolution(
                            paths.opsCachePath, tps, mspt, config.tpsWarn(), config.msptWarn());
                }
            }
        } catch (Exception e) {
            WatchtowerMod.LOGGER.debug("Lag spike detector tick failed: {}", e.toString());
        }
    }

    private static void maybeCapture(MinecraftServer server, ReportConfig config, PathRefs paths,
                                     double tps, double mspt) throws IOException {
        long now = Instant.now().getEpochSecond();
        long last = StateManager.getLastLagIncidentAt(paths.statePath);
        if (now - last < config.lagIncidentCooldownSec()) {
            return;
        }

        String trigger = mspt > config.msptWarn() ? "auto_mspt" : "auto_tps";
        JsonObject incident = OpsScanService.buildManualIncident(server, null, trigger);
        incident.addProperty("source", "auto");
        incident.addProperty("severity", severity(mspt, tps, config));

        ActivityLedgerScanner.ScanResult tail = ActivityLedgerScanner.scanTail(
                server.getServerDirectory().toAbsolutePath().toString(),
                ActivityLedgerScanner.DEFAULT_TAIL_LINES,
                config.tickLagThrottleMs());
        JsonObject ctx = tail.context();
        if (incident.has("context")) {
            for (String key : ctx.keySet()) {
                incident.getAsJsonObject("context").add(key, ctx.get(key));
            }
        } else {
            incident.add("context", ctx);
        }
        incident.addProperty("narrative", LagIssueBuilder.buildNarrative(incident));
        incident.add("findings", LagIssueBuilder.buildFindings(incident));
        String suspect = LagIssueBuilder.primarySuspect(incident);
        if (suspect != null) {
            incident.addProperty("primary_suspect", suspect);
        }

        String id = incident.has("id") ? incident.get("id").getAsString() : IncidentWriter.newIncidentId(Instant.now());
        incident.addProperty("id", id);
        incident.addProperty("pinned_at", ZonedDateTime.now(ZoneId.systemDefault()).format(ISO));

        IncidentWriter.write(paths.incidentsDir, incident, config.incidentMaxFiles());
        StateManager.setLastLagIncidentAt(paths.statePath, now);
        StateManager.setLagBreachStreak(paths.statePath, 0);

        JsonObject lagIssue = LagIssueBuilder.buildPeekEntry(incident);
        JsonObject lagEvent = ActivityLedgerScanner.lagIncidentEvent(id, Instant.now());
        OpsCacheWriter.applyLagIncident(paths.opsCachePath, paths.statePath, incident, lagIssue, lagEvent);

        WatchtowerMod.LOGGER.info("Watchtower auto-captured lag incident {} (MSPT {}, TPS {})",
                id, String.format("%.1f", mspt), String.format("%.1f", tps));
    }

    private static String severity(double mspt, double tps, ReportConfig config) {
        if (mspt > config.msptWarn() * 2 || tps < 15) {
            return "critical";
        }
        return "warning";
    }

    private record PathRefs(
            java.nio.file.Path statePath,
            java.nio.file.Path opsCachePath,
            java.nio.file.Path incidentsDir
    ) {
        PathRefs(MinecraftServer server) {
            this(
                    WatchtowerPaths.statePath(server),
                    WatchtowerPaths.opsCachePath(server),
                    WatchtowerPaths.incidentsDir(server)
            );
        }
    }
}
