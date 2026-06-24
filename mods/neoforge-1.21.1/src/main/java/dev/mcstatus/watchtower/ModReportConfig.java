package dev.mcstatus.watchtower;

import dev.mcstatus.watchtower.core.panel.PanelInfo;
import dev.mcstatus.watchtower.core.panel.PanelLabels;
import dev.mcstatus.watchtower.core.panel.PanelResolver;
import dev.mcstatus.watchtower.core.report.ReportConfig;
import net.minecraft.server.MinecraftServer;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Loads report configuration from watchtower/watchtower.conf and server context.
 */
public final class ModReportConfig {

    private static final Pattern KEY_VALUE = Pattern.compile("^([A-Z_][A-Z0-9_]*)=(.*)$");

    private ModReportConfig() {
    }

    public static ReportConfig forServer(MinecraftServer server) throws IOException {
        return forServer(server, ReportRunOptions.empty());
    }

    public static ReportConfig forServer(MinecraftServer server, ReportRunOptions opts) throws IOException {
        Path conf = WatchtowerPaths.confPath(server);
        Map<String, String> map = new HashMap<>();
        if (Files.isRegularFile(conf)) {
            for (String line : Files.readAllLines(conf, StandardCharsets.UTF_8)) {
                line = line.strip();
                if (line.isEmpty() || line.startsWith("#")) {
                    continue;
                }
                Matcher m = KEY_VALUE.matcher(line);
                if (m.matches()) {
                    map.put(m.group(1), m.group(2).strip());
                }
            }
        }

        map.put("SERVER_DIR", server.getServerDirectory().toAbsolutePath().toString());
        map.put("STATE_FILE", WatchtowerPaths.statePath(server).toAbsolutePath().toString());
        map.put("JAVA_RUNNING", "true");
        map.put("LOADER", "neoforge");

        PanelInfo panel = PanelResolver.resolve(map, server.getServerDirectory());
        map.put("PANEL_DETECTED", panel.panelId());
        if (panel.panelRoot() != null) {
            map.put("PANEL_ROOT", panel.panelRoot());
        }
        if ("crafty".equals(panel.panelId()) && panel.panelRoot() != null) {
            map.put("CRAFTY_APP", panel.panelRoot());
        }
        map.put("PANEL_RUNNING", String.valueOf(panel.panelRunning()));
        map.put("PANEL_HAS_DAEMON", String.valueOf(panel.hasPanelDaemon()));
        map.put("PANEL_DISPLAY_NAME", PanelLabels.displayName(panel.panelId()));

        try {
            int lookback = WatchtowerConfig.LOOKBACK_HOURS.get();
            if (opts != null && opts.lookbackHours() != null) {
                lookback = Math.max(1, Math.min(720, opts.lookbackHours()));
            }
            map.put("LOOKBACK_HOURS", String.valueOf(lookback));
            boolean incremental = WatchtowerConfig.INCREMENTAL.get();
            if (opts != null && opts.incremental() != null) {
                incremental = opts.incremental();
            }
            map.put("INCREMENTAL", incremental ? "true" : "false");
            if (opts != null && opts.since() != null && !opts.since().isBlank()) {
                map.put("SINCE", opts.since().strip());
            }
        } catch (IllegalStateException ignored) {
        }

        if (!map.containsKey("LOG_GZIP_COUNT")) {
            map.put("LOG_GZIP_COUNT", "12");
        }

        return ReportConfig.fromMap(map);
    }
}
