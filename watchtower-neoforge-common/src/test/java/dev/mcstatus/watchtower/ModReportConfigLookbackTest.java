package dev.mcstatus.watchtower;

import dev.mcstatus.watchtower.core.report.ReportConfig;
import dev.mcstatus.watchtower.runtime.OnlinePlayerView;
import dev.mcstatus.watchtower.runtime.ServerContext;
import dev.mcstatus.watchtower.runtime.WatchtowerSample;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class ModReportConfigLookbackTest {

    @TempDir Path temp;

    @Test
    void forServerKeepsConfLookbackWhenOptsDoNotOverride() throws Exception {
        Path root = temp.resolve("server");
        Files.createDirectories(root.resolve("watchtower"));
        Files.writeString(
                root.resolve("watchtower").resolve("watchtower.conf"),
                "LOOKBACK_HOURS=168\nINCREMENTAL=false\nLOG_GZIP_COUNT=12\n",
                StandardCharsets.UTF_8);

        ServerContext server = new StubServer(root);
        ReportConfig config = ModReportConfig.forServer(server, ReportRunOptions.empty());
        assertEquals(168, config.lookbackHours());
        assertFalse(config.incremental());
    }

    @Test
    void forServerHonorsLookbackOverride() throws Exception {
        Path root = temp.resolve("server2");
        Files.createDirectories(root.resolve("watchtower"));
        Files.writeString(
                root.resolve("watchtower").resolve("watchtower.conf"),
                "LOOKBACK_HOURS=168\nINCREMENTAL=true\nLOG_GZIP_COUNT=12\n",
                StandardCharsets.UTF_8);

        ServerContext server = new StubServer(root);
        ReportConfig config = ModReportConfig.forServer(
                server, new ReportRunOptions(72, null, false, false, true));
        assertEquals(72, config.lookbackHours());
        assertFalse(config.incremental());
    }

    private static final class StubServer implements ServerContext {
        private final Path root;

        StubServer(Path root) {
            this.root = root;
        }

        @Override
        public Path serverDirectory() {
            return root;
        }

        @Override
        public void execute(Runnable task) {
            task.run();
        }

        @Override
        public boolean runConsoleCommand(String command) {
            return false;
        }

        @Override
        public boolean isModLoaded(String modId) {
            return false;
        }

        @Override
        public int playerCount() {
            return 0;
        }

        @Override
        public String modId() {
            return "watchtower";
        }

        @Override
        public String modVersion() {
            return "test";
        }

        @Override
        public String minecraftVersion() {
            return "1.21.1";
        }

        @Override
        public Logger logger() {
            return LoggerFactory.getLogger("ModReportConfigLookbackTest");
        }

        @Override
        public WatchtowerSample.Sample collectSample() {
            return null;
        }

        @Override
        public List<OnlinePlayerView> onlinePlayers() {
            return new ArrayList<>();
        }

        @Override
        public double smoothedMspt() {
            return 0;
        }

        @Override
        public WatchtowerSample.SessionMspt sessionMspt() {
            return new WatchtowerSample.SessionMspt(0, 0, 0, 0, java.time.Instant.EPOCH);
        }
    }
}
