package dev.mcstatus.watchtower.core.panel;

import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Display names and panel-down messages by panel id.
 */
public final class PanelLabels {

    private static final Set<String> DAEMON_PANELS = Set.of(
            "crafty", "pterodactyl", "pelican", "bloom", "pufferpanel", "mcsmanager",
            "amp", "multicraft", "mineos", "tcadmin", "wisp", "pebblehost"
    );

    private static final Map<String, String> DISPLAY_NAMES = Map.ofEntries(
            Map.entry("crafty", "Crafty"),
            Map.entry("pterodactyl", "Pterodactyl"),
            Map.entry("pelican", "Pelican"),
            Map.entry("bloom", "bloom.host"),
            Map.entry("pufferpanel", "PufferPanel"),
            Map.entry("mcsmanager", "MCSManager"),
            Map.entry("amp", "CubeCoders AMP"),
            Map.entry("multicraft", "Multicraft"),
            Map.entry("mineos", "MineOS"),
            Map.entry("discopanel", "DiscoPanel"),
            Map.entry("docker", "Docker"),
            Map.entry("none", "Native"),
            Map.entry("unknown", "Unknown"),
            Map.entry("tcadmin", "TCAdmin"),
            Map.entry("wisp", "WISP"),
            Map.entry("pebblehost", "PebbleHost")
    );

    private static final Map<String, String> DOWN_MESSAGES = Map.ofEntries(
            Map.entry("crafty", "Crafty panel process is not running."),
            Map.entry("pterodactyl", "Pterodactyl Wings is not running."),
            Map.entry("pelican", "Pelican Wings is not running."),
            Map.entry("bloom", "bloom.host Wings is not running."),
            Map.entry("pufferpanel", "PufferPanel daemon is not running."),
            Map.entry("mcsmanager", "MCSManager daemon is not running."),
            Map.entry("amp", "CubeCoders AMP is not running."),
            Map.entry("multicraft", "Multicraft daemon is not running."),
            Map.entry("mineos", "MineOS panel is not running."),
            Map.entry("tcadmin", "TCAdmin service is not running."),
            Map.entry("wisp", "WISP panel is not running."),
            Map.entry("pebblehost", "Host panel service is not running.")
    );

    private PanelLabels() {
    }

    public static boolean hasDaemon(String panelId) {
        return panelId != null && DAEMON_PANELS.contains(panelId);
    }

    public static String displayName(String panelId) {
        if (panelId == null) {
            return "Unknown";
        }
        return DISPLAY_NAMES.getOrDefault(panelId, panelId);
    }

    public static String panelDownMessage(String panelId) {
        return DOWN_MESSAGES.getOrDefault(panelId, "Management panel is not running.");
    }

    public static String glanceStatus(String panelId, boolean panelRunning) {
        if (panelId == null || "unknown".equals(panelId)) {
            return "unknown";
        }
        if ("none".equals(panelId)) {
            return "n/a";
        }
        if ("docker".equals(panelId) || "discopanel".equals(panelId)) {
            return "container";
        }
        if (!hasDaemon(panelId)) {
            return "n/a";
        }
        return panelRunning ? "RUNNING" : "DOWN";
    }

    public static boolean isKnownPanelId(String id) {
        if (id == null || id.isBlank()) {
            return false;
        }
        String lower = id.toLowerCase(Locale.ROOT);
        return DISPLAY_NAMES.containsKey(lower) || "auto".equals(lower);
    }

    public static boolean isWingsFamily(String panelId) {
        if (panelId == null) {
            return false;
        }
        String id = panelId.toLowerCase(Locale.ROOT);
        return "pterodactyl".equals(id) || "pelican".equals(id) || "bloom".equals(id);
    }

    /** Suppress false PANEL_DOWN when the game JVM cannot see the panel daemon (typical panel containers). */
    public static boolean shouldSuppressPanelDown(String panelId) {
        return ProcessChecks.isDockerContainer()
                && (hasDaemon(panelId) || isWingsFamily(panelId));
    }
}
