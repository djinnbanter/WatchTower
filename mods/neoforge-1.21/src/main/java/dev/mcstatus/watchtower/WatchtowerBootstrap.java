package dev.mcstatus.watchtower;

import dev.mcstatus.watchtower.core.report.ReportSchedule;
import dev.mcstatus.watchtower.core.report.StateManager;
import net.minecraft.server.MinecraftServer;
import net.neoforged.bus.api.SubscribeEvent;
import net.neoforged.fml.common.EventBusSubscriber;
import net.neoforged.neoforge.event.RegisterCommandsEvent;
import net.neoforged.neoforge.event.server.ServerStartedEvent;
import net.neoforged.neoforge.event.server.ServerStoppingEvent;
import net.neoforged.neoforge.event.tick.ServerTickEvent;

import java.io.IOException;
import java.nio.file.Path;

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

    private static void applyReportScheduleFromConf(MinecraftServer server) {
        try {
            Path conf = WatchtowerPaths.confPath(server);
            ReportSchedule schedule = WatchtowerConfWriter.loadReportSchedule(conf);
            SCHEDULER.applyScheduleFromConf(schedule);
            Path statePath = WatchtowerPaths.statePath(server);
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
        try {
            WatchtowerSetup.ensureReady(server);
        } catch (Exception e) {
            WatchtowerMod.LOGGER.error("Watchtower setup failed: {}", e.toString(), e);
        }
        TickMetrics.reset();
        HostCpuProbe.reset();
        applyReportScheduleFromConf(server);
        SCHEDULER.resetReportSchedule();
        LiveMetricsService.get().bindServer(server);
        OpsPollScheduler.get().bind(server);
        AlwaysOnOpsLogScheduler.get().bind(server);
        BackupPollScheduler.get().bind(server);
        SCHEDULER.sampleNow(server);
        try {
            if (WatchtowerConfig.DASHBOARD_ENABLED.get()) {
                DashboardAuthServices.init(server);
            }
        } catch (IOException e) {
            WatchtowerMod.LOGGER.error("Dashboard auth init failed: {}", e.toString(), e);
        }
        HTTP.start(server);
        if (WatchtowerSetup.isReady()) {
            WatchtowerMod.LOGGER.info(
                    "Watchtower ready. Reports: {}",
                    WatchtowerPaths.reportDir(server)
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
        MinecraftServer server = event.getServer();
        SCHEDULER.onServerTick(server, STATE, () ->
                ReportRunner.runAsync(
                        server,
                        STATE,
                        msg -> ReportRunner.sendFeedback(server, null, msg),
                        ReportRunOptions.forScheduledRun()
                )
        );
    }

    @SubscribeEvent
    public static void onServerStopping(ServerStoppingEvent event) {
        MinecraftServer server = event.getServer();
        HTTP.stop();
        OpsPollScheduler.get().unbind();
        AlwaysOnOpsLogScheduler.get().unbind();
        BackupPollScheduler.get().unbind();
        DashboardAuthServices.shutdown();
        SCHEDULER.sampleNow(server);
        LiveMetricsService.get().unbindServer();
    }
}
