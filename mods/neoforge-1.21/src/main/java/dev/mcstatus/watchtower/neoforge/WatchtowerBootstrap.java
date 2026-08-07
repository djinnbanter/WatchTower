package dev.mcstatus.watchtower.neoforge;

import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.AlwaysOnOpsLogScheduler;
import dev.mcstatus.watchtower.BackupPollScheduler;
import dev.mcstatus.watchtower.BackupVerifyScheduler;
import dev.mcstatus.watchtower.BootStartupProfileScheduler;
import dev.mcstatus.watchtower.DashboardAuthServices;
import dev.mcstatus.watchtower.ActivityGapBackfillScheduler;
import dev.mcstatus.watchtower.ExternalKillPostmortemScheduler;
import dev.mcstatus.watchtower.ModsDeepJobScheduler;
import dev.mcstatus.watchtower.DashboardHttpServer;
import dev.mcstatus.watchtower.HostCpuProbe;
import dev.mcstatus.watchtower.LiveMetricsService;
import dev.mcstatus.watchtower.OpsPollScheduler;
import dev.mcstatus.watchtower.PlayerDirectoryPollScheduler;
import dev.mcstatus.watchtower.SupportComposeRunner;
import dev.mcstatus.watchtower.WatchtowerConfWriter;
import dev.mcstatus.watchtower.WatchtowerPaths;
import dev.mcstatus.watchtower.WatchtowerRuntimeState;
import dev.mcstatus.watchtower.WatchtowerScheduler;
import dev.mcstatus.watchtower.WatchtowerSetup;
import dev.mcstatus.watchtower.core.report.ReportSchedule;
import dev.mcstatus.watchtower.core.report.StateManager;
import dev.mcstatus.watchtower.runtime.ModRuntime;
import dev.mcstatus.watchtower.runtime.ServerContext;
import net.minecraft.server.MinecraftServer;
import net.neoforged.bus.api.SubscribeEvent;
import net.neoforged.fml.common.EventBusSubscriber;
import net.neoforged.neoforge.event.RegisterCommandsEvent;
import net.neoforged.neoforge.event.server.ServerStartedEvent;
import net.neoforged.neoforge.event.server.ServerStoppingEvent;
import net.neoforged.neoforge.event.tick.ServerTickEvent;

import java.io.IOException;
import java.nio.file.Path;
import java.time.Instant;

@EventBusSubscriber(modid = WatchtowerMod.MOD_ID)
public final class WatchtowerBootstrap {
    private static final WatchtowerRuntimeState STATE = new WatchtowerRuntimeState();
    private static final WatchtowerScheduler SCHEDULER = new WatchtowerScheduler();
    private static final DashboardHttpServer HTTP = new DashboardHttpServer();

    private WatchtowerBootstrap() {
    }

    public static WatchtowerRuntimeState getState() {
        return STATE;
    }

    public static WatchtowerScheduler getScheduler() {
        return SCHEDULER;
    }

    private static void applyReportScheduleFromConf(ServerContext ctx) {
        try {
            Path conf = WatchtowerPaths.confPath(ctx);
            ReportSchedule schedule = WatchtowerConfWriter.loadReportSchedule(conf);
            SCHEDULER.applyScheduleFromConf(schedule);
            Path statePath = WatchtowerPaths.statePath(ctx);
            SCHEDULER.loadPersistedScheduleState(
                    StateManager.getLastScheduledSlot(statePath),
                    StateManager.getLastScheduledReportAt(statePath)
            );
        } catch (IOException e) {
            WatchtowerMod.LOGGER.warn("Could not read report schedule from watchtower.conf: {}", e.toString());
        }
    }

    @SubscribeEvent
    public static void onRegisterCommands(RegisterCommandsEvent event) {
        WatchtowerCommands.register(event.getDispatcher(), STATE, SCHEDULER);
    }

    @SubscribeEvent
    public static void onServerStarted(ServerStartedEvent event) {
        MinecraftServer server = event.getServer();
        ServerContext ctx = new NeoForgeServerContext(server);
        ModRuntime.set(ctx, new NeoForgeModRuntimeConfig());
        ModRuntime.bindServices(STATE, SCHEDULER);
        try {
            WatchtowerSetup.ensureReady(ctx);
        } catch (Exception e) {
            WatchtowerMod.LOGGER.error("Watchtower setup failed: {}", e.toString(), e);
        }
        TickMetrics.reset();
        TickMetrics.setPhase("loading_world");
        HostCpuProbe.reset();
        applyReportScheduleFromConf(ctx);
        SCHEDULER.resetReportSchedule();
        LiveMetricsService.get().bindServer(ctx);
        OpsPollScheduler.get().bind(ctx);
        AlwaysOnOpsLogScheduler.get().bind(ctx);
        BackupPollScheduler.get().bind(ctx);
        BackupVerifyScheduler.get().bind(ctx);
        PlayerDirectoryPollScheduler.get().bind(ctx);
        BootStartupProfileScheduler.start(ctx);
        ExternalKillPostmortemScheduler.start(ctx);
        HangWatchdog.start(ctx);
        ModsDeepJobScheduler.startBootSeed(ctx);
        ActivityGapBackfillScheduler.startBootCatchup(ctx);
        SCHEDULER.sampleNow(ctx);
        TickMetrics.setPhase("ticking");
        try {
            if (ModRuntime.config().dashboardEnabled()) {
                DashboardAuthServices.init(ctx);
            }
        } catch (IOException e) {
            WatchtowerMod.LOGGER.error("Dashboard auth init failed: {}", e.toString(), e);
            DashboardAuthServices.markUnavailable(e.toString());
        }
        HTTP.start(ctx);
        if (WatchtowerSetup.isReady()) {
            WatchtowerMod.LOGGER.info(
                    "Watchtower ready. Reports: {}",
                    WatchtowerPaths.reportDir(ctx)
            );
        } else {
            WatchtowerMod.LOGGER.warn(
                    "Watchtower initialized with reports disabled: {}",
                    WatchtowerSetup.getMessage()
            );
        }
    }

    @SubscribeEvent
    public static void onServerTick(ServerTickEvent.Post event) {
        ServerContext ctx = ModRuntime.context();
        if (ctx == null) {
            return;
        }
        SCHEDULER.onServerTick(ctx, STATE, () ->
                SupportComposeRunner.runAsync(
                        ctx,
                        STATE,
                        msg -> WatchtowerCommands.sendFeedback(event.getServer(), null, msg),
                        true
                )
        );
    }

    @SubscribeEvent
    public static void onServerStopping(ServerStoppingEvent event) {
        STATE.releaseRunningLocksOnStop();
        ServerContext ctx = ModRuntime.context();
        HTTP.stop();
        OpsPollScheduler.get().unbind();
        AlwaysOnOpsLogScheduler.get().unbind();
        BackupPollScheduler.get().unbind();
        BackupVerifyScheduler.get().unbind();
        PlayerDirectoryPollScheduler.get().unbind();
        BootStartupProfileScheduler.stop();
        ExternalKillPostmortemScheduler.stop();
        HangWatchdog.stop();
        ModsDeepJobScheduler.stop();
        ActivityGapBackfillScheduler.stop();
        DashboardAuthServices.shutdown();
        if (ctx != null) {
            try {
                JsonObject patch = new JsonObject();
                patch.addProperty("clean_stop_at", Instant.now().toString());
                StateManager.updateExternalKillSession(WatchtowerPaths.statePath(ctx), patch);
            } catch (Exception e) {
                WatchtowerMod.LOGGER.debug("External-kill clean-stop marker failed: {}", e.toString());
            }
            SCHEDULER.sampleNow(ctx);
        }
        LiveMetricsService.get().unbindServer();
        TickMetrics.setPhase("unknown");
        ModRuntime.clear();
    }
}
