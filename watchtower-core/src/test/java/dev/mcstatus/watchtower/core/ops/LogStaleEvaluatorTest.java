package dev.mcstatus.watchtower.core.ops;

import com.google.gson.JsonObject;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class LogStaleEvaluatorTest {

    @TempDir
    Path temp;

    @Test
    void inactiveWhenJavaNotRunning() throws Exception {
        Path log = temp.resolve("latest.log");
        Files.writeString(log, "line\n", StandardCharsets.UTF_8);
        JsonObject out = LogStaleEvaluator.evaluate(log, false, 15);
        assertFalse(out.get("active").getAsBoolean());
    }

    @Test
    void activeWhenMtimeGapExceedsThreshold() throws Exception {
        Path log = temp.resolve("latest.log");
        Files.writeString(log, "line\n", StandardCharsets.UTF_8);
        Instant old = Instant.now().minusSeconds(20L * 60L);
        Files.setLastModifiedTime(log, java.nio.file.attribute.FileTime.from(old));

        JsonObject out = LogStaleEvaluator.evaluate(log, true, 15);
        assertTrue(out.get("active").getAsBoolean());
        assertTrue(out.get("gap_minutes").getAsDouble() >= 15.0);
    }

    @Test
    void inactiveWhenLogRecentlyWritten() throws Exception {
        Path log = temp.resolve("latest.log");
        Files.writeString(log, "fresh\n", StandardCharsets.UTF_8);
        JsonObject out = LogStaleEvaluator.evaluate(log, true, 15);
        assertFalse(out.get("active").getAsBoolean());
    }
}
