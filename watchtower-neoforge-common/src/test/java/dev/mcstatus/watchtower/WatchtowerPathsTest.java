package dev.mcstatus.watchtower;

import org.junit.jupiter.api.Test;

import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import dev.mcstatus.watchtower.runtime.WatchtowerSample;

class WatchtowerPathsTest {
    @Test
    void watchtowerRootUsesServerDir() {
        Path root = WatchtowerPaths.watchtowerRoot(Path.of("server"));
        assertEquals(Path.of("server", "watchtower"), root);
        assertTrue(WatchtowerPaths.confPath(Path.of("server")).endsWith(Path.of("watchtower", "watchtower.conf")));
    }

    @Test
    void modStagingAndBackupsDirsUseWatchtowerFilesConstants() {
        Path server = Path.of("server");
        assertEquals(
                Path.of("server", "watchtower", "mod-staging"),
                WatchtowerPaths.modStagingDir(server));
        assertEquals(
                Path.of("server", "watchtower", "mod-backups"),
                WatchtowerPaths.modBackupsDir(server));
    }

    @Test
    void sampleHeapOnlyReturnsFiniteValues() {
        WatchtowerSample.HeapMb heap = WatchtowerSample.sampleHeapOnly();
        assertTrue(heap.used() >= 0);
        assertTrue(heap.committed() >= heap.used());
        assertTrue(heap.max() >= heap.committed() || heap.max() > 0);
    }
}
