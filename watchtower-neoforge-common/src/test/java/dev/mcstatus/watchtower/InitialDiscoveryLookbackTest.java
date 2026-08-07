package dev.mcstatus.watchtower;

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

class InitialDiscoveryLookbackTest {

    @TempDir Path temp;

    @Test
    void lookbackHoursFromConfReadsWizardSavedValue() throws Exception {
        Path root = temp.resolve("server");
        Files.createDirectories(root.resolve("watchtower"));
        Files.writeString(
                root.resolve("watchtower").resolve("watchtower.conf"),
                "LOOKBACK_HOURS=336\n",
                StandardCharsets.UTF_8);

        Integer hours = InitialDiscoveryRunner.lookbackHoursFromConf(new StubServer(root));
        assertEquals(336, hours);
    }

    @Test
    void lookbackHoursFromConfReturnsNullWhenUnset() throws Exception {
        Path root = temp.resolve("server-empty");
        Files.createDirectories(root.resolve("watchtower"));
        Files.writeString(
                root.resolve("watchtower").resolve("watchtower.conf"),
                "MSPT_WARN=50\n",
                StandardCharsets.UTF_8);

        assertNull(InitialDiscoveryRunner.lookbackHoursFromConf(new StubServer(root)));
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
            return LoggerFactory.getLogger("InitialDiscoveryLookbackTest");
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
