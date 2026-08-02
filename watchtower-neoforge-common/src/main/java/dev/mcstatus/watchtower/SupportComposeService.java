package dev.mcstatus.watchtower;

import dev.mcstatus.watchtower.core.collect.SparkPaths;
import dev.mcstatus.watchtower.core.panel.PanelLabels;
import dev.mcstatus.watchtower.core.report.ReportConfig;
import dev.mcstatus.watchtower.core.report.SupportComposeOptions;
import dev.mcstatus.watchtower.core.report.SupportComposer;
import dev.mcstatus.watchtower.core.report.SupportEnvironmentBuilder;
import dev.mcstatus.watchtower.runtime.ServerContext;

import java.io.IOException;
import java.nio.file.Path;

/**
 * Server-context bridge for {@link SupportComposer} (dashboard Support + CLI diagnostics/run).
 */
public final class SupportComposeService {

    private SupportComposeService() {
    }

    public static SupportComposer.ComposeResult compose(ServerContext server) throws IOException {
        return compose(server, SupportComposeOptions.quickDefaults());
    }

    public static SupportComposer.ComposeResult compose(ServerContext server, SupportComposeOptions options)
            throws IOException {
        if (server == null) {
            throw new IOException("Server not ready");
        }
        ReportConfig config = ModReportConfig.forServer(server);
        Path serverDir = server.serverDirectory().toAbsolutePath().normalize();
        Path sparkDir = SparkPaths.uploadDir(serverDir, config);
        if (!SparkPaths.isUnderRoot(serverDir, sparkDir)) {
            sparkDir = serverDir.resolve("watchtower").resolve("spark-upload");
        }
        SupportEnvironmentBuilder.Context env = new SupportEnvironmentBuilder.Context(
                server.modVersion(),
                server.minecraftVersion(),
                config.loader(),
                null,
                config.hostname(),
                config.panelDetected(),
                config.javaRunning(),
                System.getProperty("os.name", ""),
                System.getProperty("os.arch", ""));
        // A containerized game JVM cannot see the host panel daemon, so a false probe must read as unknown.
        Boolean panelRunning = PanelLabels.shouldSuppressPanelDown(config.panelDetected())
                ? null
                : config.panelRunning();
        return SupportComposer.compose(new SupportComposer.ComposeRequest(
                WatchtowerPaths.reportDir(server),
                serverDir,
                WatchtowerPaths.opsCachePath(server),
                WatchtowerPaths.performanceRollupsPath(server),
                config.hostname(),
                config.loader(),
                config.panelDetected(),
                config.javaRunning(),
                config.logStaleMinutes(),
                options != null ? options : SupportComposeOptions.quickDefaults(),
                env,
                sparkDir,
                server.modVersion(),
                server.minecraftVersion(),
                panelRunning));
    }
}
