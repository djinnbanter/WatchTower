package dev.mcstatus.watchtower.core.panel;

import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.analyze.ReportPipeline;
import dev.mcstatus.watchtower.core.collect.CraftyCollector;
import dev.mcstatus.watchtower.core.report.ReportConfig;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashMap;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

class PanelResolverTest {

    @TempDir
    Path temp;

    @Test
    void craftyFromServerLayout() throws Exception {
        Path craftyRoot = temp.resolve("crafty-4");
        Path serverDir = craftyRoot.resolve("servers/uuid-1");
        Files.createDirectories(serverDir);
        Files.createDirectories(craftyRoot.resolve("app"));
        Files.writeString(craftyRoot.resolve("app/main.py"), "# crafty\n");

        PanelInfo info = resolve(Map.of("PANEL", "auto"), serverDir);
        assertEquals("crafty", info.panelId());
        assertEquals(craftyRoot.toString(), info.panelRoot());
        assertTrue(info.lifecycleSupported());
        assertTrue(info.hasPanelDaemon());
    }

    @Test
    void craftyRootIsParentOfServersNotApp() throws Exception {
        Path craftyRoot = temp.resolve("var/opt/minecraft/crafty/crafty-4");
        Path serverDir = craftyRoot.resolve("servers/00000000-0000-0000-0000-000000000001");
        Files.createDirectories(serverDir);
        Files.createDirectories(craftyRoot.resolve("logs"));
        Files.writeString(craftyRoot.resolve("logs/audit.log"), "");

        PanelInfo info = resolve(Map.of("PANEL", "auto"), serverDir);
        assertEquals("crafty", info.panelId());
        assertEquals(craftyRoot.toString(), info.panelRoot());
    }

    @Test
    void pterodactylVolumesLayout() throws Exception {
        Path root = temp.resolve("pterodactyl");
        Path serverDir = root.resolve("volumes/uuid-1");
        Files.createDirectories(serverDir);
        Map<String, String> conf = Map.of(
                "PANEL", "auto",
                "PTERO_ROOT", root.toString()
        );
        PanelInfo info = resolve(conf, serverDir);
        assertEquals("pterodactyl", info.panelId());
        assertEquals(root.toString(), info.panelRoot());
        assertTrue(info.hasPanelDaemon());
    }

    @Test
    void pelicanVolumesLayout() throws Exception {
        Path root = temp.resolve("pelican");
        Path serverDir = root.resolve("volumes/uuid-2");
        Files.createDirectories(serverDir);
        PanelInfo info = resolve(Map.of(
                "PANEL", "auto",
                "PELICAN_ROOT", root.toString()
        ), serverDir);
        assertEquals("pelican", info.panelId());
    }

    @Test
    void pufferPanelServersLayout() throws Exception {
        Path root = temp.resolve("pufferpanel");
        Path serverDir = root.resolve("servers/1");
        Files.createDirectories(serverDir);
        PanelInfo info = resolve(Map.of("PANEL", "auto"), serverDir);
        assertEquals("pufferpanel", info.panelId());
    }

    @Test
    void ampInstancesLayout() throws Exception {
        Path ampData = temp.resolve("home/amp/.ampdata");
        Path serverDir = ampData.resolve("Instances/MyServer");
        Files.createDirectories(serverDir);
        PanelInfo info = resolve(Map.of("PANEL", "auto"), serverDir);
        assertEquals("amp", info.panelId());
        assertEquals(ampData.toString(), info.panelRoot());
    }

    @Test
    void forcedAmpWithOverride() throws Exception {
        Path ampData = temp.resolve("custom/.ampdata");
        Files.createDirectories(ampData.resolve("Instances/srv"));
        PanelInfo info = resolve(Map.of(
                "PANEL", "amp",
                "AMP_ROOT", ampData.toString()
        ), temp.resolve("unrelated/server"));
        assertEquals("amp", info.panelId());
        assertEquals(ampData.toString(), info.panelRoot());
    }

    @Test
    void multicraftServersLayout() throws Exception {
        Path root = temp.resolve("multicraft");
        Path serverDir = root.resolve("servers/1");
        Files.createDirectories(serverDir);
        PanelInfo info = resolve(Map.of(
                "PANEL", "auto",
                "MULTICRAFT_ROOT", root.toString()
        ), serverDir);
        assertEquals("multicraft", info.panelId());
    }

    @Test
    void mcsManagerRoot() throws Exception {
        Path root = temp.resolve("mcsmanager");
        Path serverDir = root.resolve("data/servers/s1");
        Files.createDirectories(serverDir);
        PanelInfo info = resolve(Map.of(
                "PANEL", "auto",
                "MCSM_ROOT", root.toString()
        ), serverDir);
        assertEquals("mcsmanager", info.panelId());
    }

    @Test
    void mineosServersLayout() throws Exception {
        Path serversRoot = temp.resolve("var/games/minecraft/servers");
        Path serverDir = serversRoot.resolve("survival");
        Files.createDirectories(serverDir);
        PanelInfo info = resolve(Map.of("PANEL", "auto"), serverDir);
        assertEquals("mineos", info.panelId());
    }

    @Test
    void dockerPathHeuristic() throws Exception {
        Path serverDir = temp.resolve("docker/containers/abc/data");
        Files.createDirectories(serverDir);
        PanelInfo info = resolve(Map.of("PANEL", "auto"), serverDir);
        assertEquals("docker", info.panelId());
        assertFalse(info.hasPanelDaemon());
    }

    @Test
    void nativeFallback() throws Exception {
        Path serverDir = temp.resolve("opt/minecraft");
        Files.createDirectories(serverDir);
        PanelInfo info = resolve(Map.of("PANEL", "auto"), serverDir);
        assertEquals("none", info.panelId());
        assertFalse(info.hasPanelDaemon());
    }

    @Test
    void panelNoneSkipsDetection() throws Exception {
        Path craftyRoot = temp.resolve("crafty-4");
        Path serverDir = craftyRoot.resolve("servers/uuid");
        Files.createDirectories(serverDir);
        Files.createDirectories(craftyRoot.resolve("app"));
        Files.writeString(craftyRoot.resolve("app/main.py"), "# crafty\n");

        PanelInfo info = resolve(Map.of("PANEL", "none"), serverDir);
        assertEquals("none", info.panelId());
    }

    @Test
    void forcedCraftyMissingLayoutIsUnknown() throws Exception {
        Path serverDir = temp.resolve("plain/server");
        Files.createDirectories(serverDir);
        PanelInfo info = resolve(Map.of("PANEL", "crafty"), serverDir);
        assertEquals("unknown", info.panelId());
    }

    @Test
    void invalidPanelModeIsUnknown() throws Exception {
        PanelInfo info = resolve(Map.of("PANEL", "not-a-panel"), temp.resolve("srv"));
        assertEquals("unknown", info.panelId());
    }

    @Test
    void craftyBeatsLowerPriorityWhenLayoutMatches() throws Exception {
        Path craftyRoot = temp.resolve("crafty-4");
        Path serverDir = craftyRoot.resolve("servers/uuid");
        Files.createDirectories(serverDir);
        Files.createDirectories(craftyRoot.resolve("app"));
        Files.writeString(craftyRoot.resolve("app/main.py"), "# crafty\n");

        PanelInfo info = resolve(Map.of("PANEL", "auto"), serverDir);
        assertEquals("crafty", info.panelId());
    }

    @Test
    void craftyAuditLifecycleWhenRootResolved() throws Exception {
        Path craftyRoot = temp.resolve("crafty-4");
        Path serverDir = craftyRoot.resolve("servers/uuid");
        Files.createDirectories(serverDir);
        Files.createDirectories(craftyRoot.resolve("app"));
        Files.writeString(craftyRoot.resolve("app/main.py"), "# crafty\n");
        Files.createDirectories(craftyRoot.resolve("logs"));
        String auditLine = """
                {"time":"2026-06-16 10:00:00,000","log_msg":"start_server for uuid"}
                """;
        Files.writeString(craftyRoot.resolve("logs/audit.log"), auditLine, StandardCharsets.UTF_8);

        PanelInfo panel = resolve(Map.of("PANEL", "auto"), serverDir);
        assertEquals("crafty", panel.panelId());

        Map<String, String> env = new HashMap<>();
        env.put("CRAFTY_APP", panel.panelRoot());
        env.put("SERVER_DIR", serverDir.toString());
        ReportConfig config = ReportConfig.fromMap(env);

        JsonObject staging = new JsonObject();
        staging.add("optional", new JsonObject());
        staging.add("events", new com.google.gson.JsonArray());
        double cutoff = 0;
        CraftyCollector.scanCraftyAudit(staging, cutoff, config);

        JsonObject optional = staging.getAsJsonObject("optional");
        assertTrue(optional.has("crafty_commands"), "expected crafty_commands from audit.log");
        assertTrue(optional.has("panel_command_counts"));
    }

    @Test
    void briefUnknownPanelDoesNotShowDown() {
        JsonObject staging = PanelBriefFixtures.baseStaging("unknown", false);
        String brief = ReportPipeline.writeBrief(ReportPipeline.buildFacts(staging));
        assertTrue(brief.contains("Panel: unknown"));
        assertTrue(brief.contains("Panel: unknown") || brief.contains("AT A GLANCE"));
        int glanceIdx = brief.indexOf("AT A GLANCE");
        String glanceSection = brief.substring(glanceIdx, Math.min(brief.length(), glanceIdx + 200));
        assertTrue(glanceSection.contains("unknown"), "AT A GLANCE should show unknown, not DOWN");
        assertFalse(glanceSection.contains("Panel: DOWN"));
    }

    @Test
    void briefNonePanelShowsNa() {
        JsonObject staging = PanelBriefFixtures.baseStaging("none", false);
        String brief = ReportPipeline.writeBrief(ReportPipeline.buildFacts(staging));
        int glanceIdx = brief.indexOf("AT A GLANCE");
        String glanceSection = brief.substring(glanceIdx, Math.min(brief.length(), glanceIdx + 200));
        assertTrue(glanceSection.contains("n/a"));
        assertFalse(brief.contains("Panel process:"));
    }

    @Test
    void briefPterodactylDownWhenDaemonBacked() {
        JsonObject staging = PanelBriefFixtures.baseStaging("pterodactyl", false);
        String brief = ReportPipeline.writeBrief(ReportPipeline.buildFacts(staging));
        assertTrue(brief.contains("Panel process: NOT RUNNING"));
        int glanceIdx = brief.indexOf("AT A GLANCE");
        String glanceSection = brief.substring(glanceIdx, Math.min(brief.length(), glanceIdx + 200));
        assertTrue(glanceSection.contains("DOWN"));
    }

    private static PanelInfo resolve(Map<String, String> conf, Path serverDir) {
        Map<String, String> map = new HashMap<>(conf);
        return PanelResolver.resolve(map, serverDir);
    }
}
