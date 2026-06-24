package dev.mcstatus.watchtower.cli;

import dev.mcstatus.watchtower.core.WatchtowerFiles;
import dev.mcstatus.watchtower.core.panel.PanelInfo;
import dev.mcstatus.watchtower.core.panel.PanelLabels;
import dev.mcstatus.watchtower.core.panel.PanelResolver;
import dev.mcstatus.watchtower.core.report.ReportConfig;
import dev.mcstatus.watchtower.core.report.ReportPreset;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Builds {@link ReportConfig} for headless live reports from server directory + preset.
 */
final class HeadlessReportConfig {

    private static final Pattern KEY_VALUE = Pattern.compile("^([A-Z_][A-Z0-9_]*)=(.*)$");

    private HeadlessReportConfig() {
    }

    static ReportConfig forPreset(
            Path serverDir,
            ReportPreset preset,
            Integer lookbackOverride,
            Boolean incrementalOverride) throws IOException {
        Map<String, String> map = loadConf(serverDir);
        int lookback = lookbackOverride != null ? lookbackOverride : preset.lookbackHours();
        boolean incremental = incrementalOverride != null ? incrementalOverride : preset.incremental();

        map.put("SERVER_DIR", serverDir.toAbsolutePath().toString());
        map.put("STATE_FILE", serverDir.resolve("watchtower/" + WatchtowerFiles.STATE_FILENAME).toAbsolutePath().toString());
        map.put("REPORT_MODE", "live");
        map.put("LOOKBACK_HOURS", String.valueOf(lookback));
        map.put("INCREMENTAL", incremental ? "true" : "false");
        map.put("JAVA_RUNNING", "false");
        map.put("PANEL_RUNNING", "false");
        map.put("LOADER", detectLoader(serverDir));

        if (!map.containsKey("PANEL")) {
            map.put("PANEL", "auto");
        }

        PanelInfo panel = PanelResolver.resolve(map, serverDir);
        map.put("PANEL_DETECTED", panel.panelId());
        if (panel.panelRoot() != null) {
            map.put("PANEL_ROOT", panel.panelRoot());
        }
        if ("crafty".equals(panel.panelId()) && panel.panelRoot() != null) {
            map.put("CRAFTY_APP", panel.panelRoot());
        }
        map.put("PANEL_HAS_DAEMON", String.valueOf(panel.hasPanelDaemon()));
        map.put("PANEL_DISPLAY_NAME", PanelLabels.displayName(panel.panelId()));

        if (!map.containsKey("LOG_GZIP_COUNT")) {
            map.put("LOG_GZIP_COUNT", "12");
        }

        return ReportConfig.fromMap(map);
    }

    private static Map<String, String> loadConf(Path serverDir) throws IOException {
        Map<String, String> map = new HashMap<>();
        Path conf = serverDir.resolve("watchtower/" + WatchtowerFiles.CONF_FILENAME);
        if (!Files.isRegularFile(conf)) {
            return map;
        }
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
        return map;
    }

    private static String detectLoader(Path serverDir) {
        if (Files.isDirectory(serverDir.resolve("libraries/net/neoforged"))) {
            return "neoforge";
        }
        if (Files.isDirectory(serverDir.resolve("libraries/net/minecraftforge"))) {
            return "forge";
        }
        if (Files.isDirectory(serverDir.resolve(".fabric"))) {
            return "fabric";
        }
        return "neoforge";
    }
}
