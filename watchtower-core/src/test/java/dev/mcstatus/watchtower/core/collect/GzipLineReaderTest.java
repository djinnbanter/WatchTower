package dev.mcstatus.watchtower.core.collect;

import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class GzipLineReaderTest {

    @Test
    void includesGzFilesInWindowUpToScaledCap() throws Exception {
        Path tmp = Files.createTempDirectory("wt-gz");
        Path logs = tmp.resolve("logs");
        Files.createDirectories(logs);
        Files.writeString(logs.resolve("latest.log"), "line\n");

        long now = System.currentTimeMillis() / 1000L;
        for (int i = 0; i < 8; i++) {
            Path gz = logs.resolve("2026-06-1" + i + "-1.log.gz");
            Files.write(gz, new byte[] {0x1f, (byte) 0x8b}); // minimal gzip header stub
            Files.setLastModifiedTime(gz, java.nio.file.attribute.FileTime.fromMillis((now - i * 3600L) * 1000L));
        }

        double windowStart = now - 48 * 3600L;
        List<Path> files = GzipLineReader.iterLogFiles(tmp.toString(), 5, windowStart);
        long gzCount = files.stream().filter(p -> p.toString().endsWith(".gz")).count();
        assertTrue(gzCount >= 5, "expected multiple gz files in 48h window, got " + gzCount);
    }
}
