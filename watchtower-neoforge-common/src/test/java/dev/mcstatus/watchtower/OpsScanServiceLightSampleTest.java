package dev.mcstatus.watchtower;

import dev.mcstatus.watchtower.runtime.OnlinePlayerView;
import dev.mcstatus.watchtower.runtime.ServerContext;
import dev.mcstatus.watchtower.runtime.WatchtowerSample;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class OpsScanServiceLightSampleTest {

    @TempDir
    Path serverDir;

    @Test
    void buildManualIncident_uses_light_sample() {
        AtomicBoolean light = new AtomicBoolean();
        AtomicBoolean full = new AtomicBoolean();
        ServerContext server = new StubContext(serverDir) {
            @Override
            public WatchtowerSample.Sample collectSample() {
                full.set(true);
                return emptySample();
            }

            @Override
            public WatchtowerSample.Sample collectSampleLight() {
                light.set(true);
                return emptySample();
            }
        };
        OpsScanService.buildManualIncident(server, null, "auto_mspt");
        assertTrue(light.get());
        assertFalse(full.get());
    }

    private static WatchtowerSample.Sample emptySample() {
        return new WatchtowerSample.Sample(
                50, 20, 0, -1, -1, 0, List.of(),
                new WatchtowerSample.SessionMspt(0, 0, 0, 0, Instant.EPOCH),
                new WatchtowerSample.HeapMb(100, 200, 512),
                List.of(),
                List.of());
    }

    private abstract static class StubContext implements ServerContext {
        private final Path dir;

        StubContext(Path dir) {
            this.dir = dir;
        }

        @Override
        public Path serverDirectory() {
            return dir;
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
            return LoggerFactory.getLogger("OpsScanServiceLightSampleTest");
        }

        @Override
        public List<OnlinePlayerView> onlinePlayers() {
            return new ArrayList<>();
        }

        @Override
        public double smoothedMspt() {
            return 50;
        }

        @Override
        public WatchtowerSample.SessionMspt sessionMspt() {
            return new WatchtowerSample.SessionMspt(0, 0, 0, 0, Instant.EPOCH);
        }
    }
}
