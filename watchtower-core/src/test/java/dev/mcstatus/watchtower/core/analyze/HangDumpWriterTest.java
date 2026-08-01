package dev.mcstatus.watchtower.core.analyze;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class HangDumpWriterTest {

    @TempDir
    Path serverDir;

    @Test
    void writeOnceCreatesCappedFileUnderHangs() throws Exception {
        Path rel = HangDumpWriter.writeOnce(serverDir, "ticking", 48);
        assertNotNull(rel);
        Path abs = serverDir.resolve(rel);
        assertTrue(Files.isRegularFile(abs));
        assertTrue(Files.size(abs) <= HangDumpWriter.MAX_BYTES);
        String text = Files.readString(abs);
        assertTrue(text.contains("phase=ticking"));
        assertTrue(text.contains("stall_seconds=48"));
    }
}
