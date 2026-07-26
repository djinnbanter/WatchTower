package dev.mcstatus.watchtower;

import dev.mcstatus.watchtower.runtime.ModRuntime;

import dev.mcstatus.watchtower.runtime.ServerContext;
import dev.mcstatus.watchtower.runtime.WatchtowerSample;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.Map;

/**
 * Writes {@code watchtower/DR-README.txt} after a successful in-game report.
 */
public final class DrReadmeWriter {

    private static final String FILENAME = "DR-README.txt";

    private DrReadmeWriter() {
    }

    public static Path drReadmePath(ServerContext server) {
        return WatchtowerPaths.reportDir(server).resolve(FILENAME);
    }

    public static void writeAfterSuccessfulReport(ServerContext server) throws IOException {
        Path path = drReadmePath(server);
        Files.createDirectories(path.getParent());
        Files.writeString(path, buildContent(server), StandardCharsets.UTF_8);
    }

    static String buildContent(ServerContext server) throws IOException {
        Path serverDir = server.serverDirectory().toAbsolutePath().normalize();
        String version = watchtowerVersion();
        String viewerUrl = readViewerUrl(server);

        String nl = System.lineSeparator();
        StringBuilder sb = new StringBuilder();
        sb.append("Watchtower — Disaster recovery").append(nl);
        sb.append("==============================").append(nl).append(nl);
        sb.append("If the server will not start, SSH to the host and run:").append(nl).append(nl);
        sb.append("  STEP 1 — in your server mods folder:").append(nl);
        sb.append("  cd ").append(serverDir.resolve("mods")).append(nl);
        sb.append("  java -jar watchtower-cli-").append(version).append(".jar dr").append(nl);
        sb.append(nl);
        sb.append("  STEP 2 — upload watchtower-dr-bundle-*.zip to the DR viewer.").append(nl);
        sb.append("  (One zip only — saved in mods/ by default.)").append(nl);
        sb.append(nl);
        sb.append("  Panel blocks writes? Run with --out /tmp instead:").append(nl);
        sb.append("  java -jar watchtower-cli-").append(version).append(".jar dr --out /tmp").append(nl);
        sb.append("  /tmp is on the game server HOST (Linux temp), not this server folder.").append(nl);
        sb.append("  Download the zip from /tmp via SFTP or your panel file manager.").append(nl);
        sb.append(nl);
        sb.append("Upload the zip to the Watchtower DR viewer (only one file — no loose JSON).").append(nl);
        if (viewerUrl != null && !viewerUrl.isBlank()) {
            sb.append(nl);
            sb.append("DR viewer: ").append(viewerUrl.strip()).append(nl);
        }
        sb.append(nl);
        sb.append("CLI download: see Modrinth / releases (watchtower-cli-").append(version).append(".jar)").append(nl).append(nl);
        sb.append("Updated: ").append(Instant.now().toString()).append(nl);
        return sb.toString();
    }

    private static String watchtowerVersion() {
        ServerContext ctx = ModRuntime.context();
        return ctx != null ? ctx.modVersion() : "unknown";
    }

    private static String readViewerUrl(ServerContext server) throws IOException {
        Map<String, String> map = WatchtowerConfWriter.readMap(WatchtowerPaths.confPath(server));
        return map.get("DR_VIEWER_URL");
    }
}
