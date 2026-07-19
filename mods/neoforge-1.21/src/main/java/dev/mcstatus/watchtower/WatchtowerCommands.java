package dev.mcstatus.watchtower;

import com.google.gson.JsonObject;
import com.mojang.brigadier.CommandDispatcher;
import com.mojang.brigadier.arguments.IntegerArgumentType;
import com.mojang.brigadier.arguments.StringArgumentType;
import com.mojang.brigadier.builder.LiteralArgumentBuilder;
import net.minecraft.commands.CommandSourceStack;
import net.minecraft.commands.Commands;
import net.minecraft.network.chat.Component;
import dev.mcstatus.watchtower.core.WatchtowerFiles;
import net.minecraft.server.MinecraftServer;
import net.minecraft.server.level.ServerPlayer;

import dev.mcstatus.watchtower.core.auth.GeneratedCredentials;
import dev.mcstatus.watchtower.core.report.ReportSchedule;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import java.util.stream.Stream;

public final class WatchtowerCommands {
    private static final DateTimeFormatter TIME_FMT =
            DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss").withZone(ZoneId.systemDefault());

    private WatchtowerCommands() {
    }

    public static void register(
            CommandDispatcher<CommandSourceStack> dispatcher,
            WatchtowerRuntimeState state,
            WatchtowerScheduler scheduler
    ) {
        LiteralArgumentBuilder<CommandSourceStack> root = Commands.literal("watchtower")
                .requires(src -> src.hasPermission(commandPermissionLevel()));

        root.then(Commands.literal("run")
                .executes(ctx -> executeRun(ctx, state, scheduler, null))
                .then(Commands.argument("lookbackHours", IntegerArgumentType.integer(1, 720))
                        .executes(ctx -> executeRun(
                                ctx, state, scheduler,
                                IntegerArgumentType.getInteger(ctx, "lookbackHours")))));

        root.then(Commands.literal("status").executes(ctx -> {
            MinecraftServer server = ctx.getSource().getServer();
            WatchtowerSampler.Sample sample = WatchtowerSampler.collect(server);
            StringBuilder sb = new StringBuilder();
            sb.append(String.format("TPS %.2f | MSPT %.1f ms | Players %d",
                    sample.tps(), sample.mspt(), sample.playersOnline()));
            List<String> onlineNames = sample.players().stream()
                    .map(WatchtowerSampler.PlayerSample::name)
                    .toList();
            if (!onlineNames.isEmpty() && onlineNames.size() <= 3) {
                sb.append(" — ").append(String.join(", ", onlineNames));
            }
            TickMetrics.SessionMspt session = sample.sessionMspt();
            if (session != null && session.since() != null) {
                sb.append(String.format(" | Session max MSPT %.0f", session.max()));
            }
            if (sample.entities() >= 0) {
                sb.append(String.format(" | Entities %,d | Chunks %,d", sample.entities(), sample.chunks()));
            }
            sb.append(String.format(" | Mods %d", sample.modCount()));

            Path snapshot = SnapshotWriter.snapshotPath(server);
            try {
                if (Files.isRegularFile(snapshot)) {
                    long ageSec = (System.currentTimeMillis() - Files.getLastModifiedTime(snapshot).toMillis()) / 1000;
                    sb.append(String.format(" | Snapshot %ds ago", ageSec));
                }
            } catch (Exception ignored) {
            }

            Path statePath = WatchtowerPaths.statePath(server);
            try {
                if (Files.isRegularFile(statePath)) {
                    String stateText = Files.readString(statePath, StandardCharsets.UTF_8);
                    int tpsSamples = countJsonArrayEntries(stateText, "tps_samples");
                    sb.append(String.format(" | Trend samples %d", tpsSamples));
                }
            } catch (Exception ignored) {
            }

            state.getLastReportFinished().ifPresentOrElse(
                    finished -> sb.append(" | Last report ")
                            .append(TIME_FMT.format(finished))
                            .append(state.isLastReportSuccess() ? " OK" : " FAILED")
                            .append(String.format(" (%d active, %d historical issues)",
                                    state.getLastActiveIssueCount(), state.getLastHistoricalIssueCount())),
                    () -> sb.append(" | No report run yet")
            );

            if (state.isReportRunning()) {
                sb.append(" | Report running...");
            }

            if (!state.getLastBriefPath().isBlank()) {
                sb.append(" | Brief: ").append(state.getLastBriefPath());
            }

            ctx.getSource().sendSuccess(() -> Component.literal(sb.toString()), false);
            return 1;
        }));

        root.then(Commands.literal("issues").executes(ctx -> {
            MinecraftServer server = ctx.getSource().getServer();
            List<FactsReader.IssueSummary> issues = state.getLastActiveIssues();
            if (issues.isEmpty()) {
                String facts = state.getLastFactsPath();
                if (facts != null && !facts.isBlank()) {
                    issues = FactsReader.readIssueCounts(Path.of(facts)).activeIssues();
                }
            }
            if (issues.isEmpty()) {
                ctx.getSource().sendSuccess(
                        () -> Component.literal("No active issues in the last report."),
                        false
                );
                return 1;
            }
            int max = Math.min(issues.size(), 12);
            for (int i = 0; i < max; i++) {
                FactsReader.IssueSummary issue = issues.get(i);
                final String line = String.format("[%s] %s",
                        issue.severity().toUpperCase(), issue.message());
                ctx.getSource().sendSuccess(() -> Component.literal(line), false);
                if ("CRASH_REPORT".equals(issue.id()) && issue.detailLine() != null
                        && !issue.detailLine().isBlank()) {
                    final String detail = "  → " + issue.detailLine();
                    ctx.getSource().sendSuccess(() -> Component.literal(detail), false);
                }
            }
            if (issues.size() > max) {
                final int remaining = issues.size() - max;
                ctx.getSource().sendSuccess(
                        () -> Component.literal("... and " + remaining + " more"),
                        false
                );
            }
            return 1;
        }));

        root.then(Commands.literal("brief").executes(ctx -> {
            MinecraftServer server = ctx.getSource().getServer();
            Path brief = resolveBriefPath(server, state);
            if (brief == null || !Files.isRegularFile(brief)) {
                ctx.getSource().sendFailure(Component.literal("No brief report found. Run /watchtower run first."));
                return 0;
            }
            try {
                List<String> lines = Files.readAllLines(brief, StandardCharsets.UTF_8);
                int max = Math.min(lines.size(), 24);
                for (int i = 0; i < max; i++) {
                    final String line = lines.get(i);
                    ctx.getSource().sendSuccess(() -> Component.literal(line), false);
                }
                if (lines.size() > max) {
                    ctx.getSource().sendSuccess(
                            () -> Component.literal("... (" + brief + ")"),
                            false
                    );
                }
            } catch (Exception e) {
                ctx.getSource().sendFailure(Component.literal("Failed to read brief: " + e.getMessage()));
                return 0;
            }
            return 1;
        }));

        root.then(Commands.literal("pin")
                .executes(ctx -> executePin(ctx, null))
                .then(Commands.argument("note", StringArgumentType.greedyString())
                        .executes(ctx -> executePin(ctx, StringArgumentType.getString(ctx, "note")))));

        root.then(Commands.literal("url").executes(ctx -> {
            MinecraftServer server = ctx.getSource().getServer();
            String host = WatchtowerConfig.DASHBOARD_BIND_HOST.get();
            int port = WatchtowerConfig.DASHBOARD_PORT.get();
            String displayHost = "0.0.0.0".equals(host) ? resolvePublicHost(server) : host;
            String url = "http://" + displayHost + ":" + port;
            ctx.getSource().sendSuccess(() -> Component.literal("Dashboard: " + url), false);
            if ("0.0.0.0".equals(host)) {
                ctx.getSource().sendSuccess(() -> Component.literal(
                        "Warning: dashboard binds to all interfaces (0.0.0.0). Use firewall or bind to 127.0.0.1."), false);
            }
            return 1;
        }));

        root.then(Commands.literal("diagnostics").executes(ctx -> {
            MinecraftServer server = ctx.getSource().getServer();
            ServerPlayer player = ctx.getSource().getPlayer();
            if (!EngineProbe.isAvailable()) {
                ctx.getSource().sendFailure(Component.literal("[Watchtower] " + EngineProbe.getFailureReason()));
                return 0;
            }
            ctx.getSource().sendSuccess(() -> Component.literal("Building diagnostics package..."), false);
            Path reportDir = WatchtowerPaths.reportDir(server);
            Path serverDir = server.getServerDirectory();
            CompletableFuture.supplyAsync(() -> {
                try {
                    Path facts = DiagnosticsPackager.findLatestFacts(reportDir);
                    Path brief = DiagnosticsPackager.findLatestBrief(reportDir);
                    if (facts == null) {
                        return "No facts report found. Run /watchtower run first.";
                    }
                    DiagnosticsPackager.PackResult result =
                            DiagnosticsPackager.packageDiagnostics(reportDir, serverDir, facts, brief);
                    return "Diagnostics: " + result.zipPath() + " ("
                            + DiagnosticsPackager.formatSize(result.sizeBytes()) + ")";
                } catch (Exception e) {
                    WatchtowerMod.LOGGER.warn("[Watchtower] Diagnostics failed", e);
                    return "Diagnostics failed: " + (e.getMessage() != null ? e.getMessage() : "unknown error");
                }
            }).thenAccept(msg -> server.execute(() -> {
                if (msg.startsWith("Diagnostics:")) {
                    ctx.getSource().sendSuccess(() -> Component.literal("[Watchtower] " + msg), false);
                    ReportRunner.sendFeedback(server, player, msg);
                } else {
                    ctx.getSource().sendFailure(Component.literal("[Watchtower] " + msg));
                }
            }));
            return 1;
        }));

        LiteralArgumentBuilder<CommandSourceStack> schedule = Commands.literal("schedule");
        schedule.then(Commands.literal("show").executes(ctx -> {
            ReportSchedule effectiveSchedule = scheduler.effectiveSchedule();
            if (!effectiveSchedule.isEnabled()) {
                ctx.getSource().sendSuccess(() -> Component.literal("Scheduled reports: off"), false);
            } else if (effectiveSchedule.mode() == ReportSchedule.ScheduleMode.WALL_CLOCK) {
                String times = effectiveSchedule.wallClockHours().stream()
                        .map(ReportSchedule::formatHour)
                        .reduce((a, b) -> a + " and " + b)
                        .orElse("00:00");
                ctx.getSource().sendSuccess(
                        () -> Component.literal("Scheduled reports: twice daily at " + times + " (server time)"),
                        false
                );
            } else {
                ctx.getSource().sendSuccess(
                        () -> Component.literal("Scheduled reports: every " + effectiveSchedule.intervalMinutes() + " minutes"),
                        false
                );
            }
            return 1;
        }));

        schedule.then(Commands.literal("off").executes(ctx -> {
            try {
                WatchtowerConfWriter.persistReportSchedule(ctx.getSource().getServer(), ReportSchedule.off());
            } catch (IOException e) {
                scheduler.setReportSchedule(ReportSchedule.off());
                WatchtowerMod.LOGGER.warn("Failed to persist schedule off: {}", e.toString());
            }
            ctx.getSource().sendSuccess(() -> Component.literal("Scheduled reports disabled."), true);
            return 1;
        }));

        schedule.then(Commands.literal("set")
                .then(Commands.argument("minutes", IntegerArgumentType.integer(1, 10080))
                        .executes(ctx -> {
                            int minutes = IntegerArgumentType.getInteger(ctx, "minutes");
                            try {
                                WatchtowerConfWriter.persistReportSchedule(
                                        ctx.getSource().getServer(),
                                        ReportSchedule.interval(minutes)
                                );
                            } catch (IOException e) {
                                scheduler.setReportSchedule(ReportSchedule.interval(minutes));
                                WatchtowerMod.LOGGER.warn("Failed to persist schedule: {}", e.toString());
                            }
                            ctx.getSource().sendSuccess(
                                    () -> Component.literal("Scheduled reports every " + minutes + " minutes."),
                                    true
                            );
                            return 1;
                        })));

        root.then(schedule);

        LiteralArgumentBuilder<CommandSourceStack> dashboard = Commands.literal("dashboard")
                .requires(src -> src.hasPermission(4));
        dashboard.then(Commands.literal("reset-password")
                .executes(ctx -> executeDashboardResetPassword(ctx, false))
                .then(Commands.literal("clear-2fa")
                        .executes(ctx -> executeDashboardResetPassword(ctx, true))));
        root.then(dashboard);

        dispatcher.register(root);
    }

    /** Read at command execution time — config is not loaded during RegisterCommandsEvent. */
    private static int commandPermissionLevel() {
        try {
            return WatchtowerConfig.COMMAND_PERMISSION_LEVEL.get();
        } catch (IllegalStateException e) {
            return 2;
        }
    }

    private static int executeDashboardResetPassword(
            com.mojang.brigadier.context.CommandContext<CommandSourceStack> ctx,
            boolean clear2fa
    ) {
        var store = DashboardAuthServices.store();
        if (store == null) {
            ctx.getSource().sendFailure(Component.literal("[Watchtower] Dashboard auth is not initialized."));
            return 0;
        }
        try {
            GeneratedCredentials creds = store.resetPassword(clear2fa);
            DashboardAuthServices.invalidateAllSessions();
            WatchtowerMod.LOGGER.info(
                    "[Watchtower] Dashboard login — user: {} password: {} (change on first login)",
                    creds.username(),
                    creds.password()
            );
            String extra = clear2fa ? " 2FA cleared." : "";
            ctx.getSource().sendSuccess(() -> Component.literal(
                    "[Watchtower] Dashboard password reset. New credentials logged once to latest.log." + extra
            ), false);
            return 1;
        } catch (Exception e) {
            ctx.getSource().sendFailure(Component.literal("[Watchtower] Password reset failed: " + e.getMessage()));
            return 0;
        }
    }

    private static int executeRun(
            com.mojang.brigadier.context.CommandContext<CommandSourceStack> ctx,
            WatchtowerRuntimeState state,
            WatchtowerScheduler scheduler,
            Integer lookbackHours
    ) {
        MinecraftServer server = ctx.getSource().getServer();
        ServerPlayer player = ctx.getSource().getPlayer();
        scheduler.sampleNow(server);
        ReportRunOptions opts = lookbackHours != null
                ? new ReportRunOptions(lookbackHours, null, null)
                : ReportRunOptions.empty();
        try {
            ReportRunner.runAsync(
                    server,
                    state,
                    msg -> ReportRunner.sendFeedback(server, player, msg),
                    opts
            );
        } catch (Throwable e) {
            String reason = EngineProbe.isAvailable()
                    ? (e.getMessage() != null ? e.getMessage() : "Report failed to start")
                    : EngineProbe.getFailureReason();
            WatchtowerMod.LOGGER.error("[Watchtower] Failed to start report", e);
            ctx.getSource().sendFailure(Component.literal("[Watchtower] " + reason));
            return 0;
        }
        if (!EngineProbe.isAvailable()) {
            ctx.getSource().sendFailure(Component.literal("[Watchtower] " + EngineProbe.getFailureReason()));
            return 0;
        }
        String msg = lookbackHours != null
                ? "Watchtower report started (" + lookbackHours + "h lookback)."
                : "Watchtower report started.";
        ctx.getSource().sendSuccess(() -> Component.literal(msg), true);
        return 1;
    }

    private static Path resolveBriefPath(MinecraftServer server, WatchtowerRuntimeState state) {
        String last = state.getLastBriefPath();
        if (last != null && !last.isBlank()) {
            Path p = Path.of(last);
            if (Files.isRegularFile(p)) {
                return p;
            }
        }

        Path reportsDir = WatchtowerPaths.reportDir(server);
        if (!Files.isDirectory(reportsDir)) {
            return null;
        }

        try (Stream<Path> stream = Files.list(reportsDir)) {
            return stream
                    .filter(p -> {
                        String name = p.getFileName().toString();
                        return name.startsWith(WatchtowerFiles.BRIEF_PREFIX) && name.endsWith(".txt");
                    })
                    .max((a, b) -> {
                        try {
                            return Files.getLastModifiedTime(a).compareTo(Files.getLastModifiedTime(b));
                        } catch (Exception e) {
                            return a.getFileName().toString().compareTo(b.getFileName().toString());
                        }
                    })
                    .orElse(null);
        } catch (Exception e) {
            WatchtowerMod.LOGGER.warn("Failed to locate brief report: {}", e.toString());
            return null;
        }
    }

    private static int countJsonArrayEntries(String json, String key) {
        int idx = json.indexOf("\"" + key + "\"");
        if (idx < 0) {
            return 0;
        }
        int start = json.indexOf('[', idx);
        if (start < 0) {
            return 0;
        }
        int depth = 0;
        int count = 0;
        for (int i = start; i < json.length(); i++) {
            char c = json.charAt(i);
            if (c == '[') {
                depth++;
            } else if (c == ']') {
                depth--;
                if (depth == 0) {
                    break;
                }
            } else if (c == '{' && depth == 1) {
                count++;
            }
        }
        return count;
    }

    private static int executePin(com.mojang.brigadier.context.CommandContext<CommandSourceStack> ctx, String note) {
        MinecraftServer server = ctx.getSource().getServer();
        try {
            JsonObject incident = OpsScanService.buildManualIncident(server, note, "manual");
            OpsScanService.writeIncident(server, incident);
            String id = incident.get("id").getAsString();
            String narrative = incident.has("narrative") ? incident.get("narrative").getAsString() : id;
            ctx.getSource().sendSuccess(() -> Component.literal("Lag incident pinned: " + id + " — " + narrative), false);
            return 1;
        } catch (Exception e) {
            ctx.getSource().sendFailure(Component.literal("Pin failed: " + e.getMessage()));
            return 0;
        }
    }

    private static String resolvePublicHost(MinecraftServer server) {
        try {
            String env = System.getenv("SERVER_IP");
            if (env != null && !env.isBlank()) {
                return env.strip();
            }
            return java.net.InetAddress.getLocalHost().getHostAddress();
        } catch (Exception e) {
            return "localhost";
        }
    }
}
