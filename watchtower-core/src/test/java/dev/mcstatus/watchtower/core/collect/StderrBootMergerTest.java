package dev.mcstatus.watchtower.core.collect;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;

class StderrBootMergerTest {

    @TempDir
    Path tmp;

    @Test
    void mergesWhenPresentNoOpWhenAbsent() throws Exception {
        StderrBootMerger.Result absent = StderrBootMerger.merge(tmp, "logs/stderr.log");
        assertTrue(absent.lines().isEmpty());
        assertTrue(absent.sources().isEmpty());

        Path logs = tmp.resolve("logs");
        Files.createDirectories(logs);
        Files.writeString(logs.resolve("stderr.log"), "zip END header not found\nearly fml\n");
        StderrBootMerger.Result present = StderrBootMerger.merge(tmp, "logs/stderr.log,logs/stderr_stream.log");
        assertEquals(1, present.sources().size());
        assertTrue(present.lines().get(0).startsWith("[stderr]"));
        assertFalse(present.excerpt().isEmpty());
    }
}
