package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonObject;
import org.junit.jupiter.api.Test;

import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import java.util.regex.Matcher;

import static org.junit.jupiter.api.Assertions.*;

class ChunkyLogSupportTest {

    @Test
    void parsesChunkyTaskLine() {
        String line = "[Chunky] Task running for minecraft:overworld. Processed: 6126564 chunks (43.54%), "
                + "ETA: 176:55:11, Rate: 12.5 cps";
        Matcher m = LogPatterns.CHUNKY_TASK.matcher(line);
        assertTrue(m.find());
        ZonedDateTime ts = ZonedDateTime.now(ZoneId.systemDefault());
        JsonObject entry = ChunkyLogSupport.buildEntryFromMatcher(m, ts, "latest.log", 42);
        assertEquals(6126564L, entry.get("chunks").getAsLong());
        assertEquals(43.54, entry.get("pct").getAsDouble(), 0.01);
        assertEquals(12.5, entry.get("rate").getAsDouble(), 0.01);
        assertTrue(entry.get("total").getAsLong() > 0);
    }

    @Test
    void liveTailerParsesChunkyLine() throws Exception {
        java.nio.file.Path tempDir = java.nio.file.Files.createTempDirectory("wt-chunky");
        java.nio.file.Path logs = tempDir.resolve("logs");
        java.nio.file.Files.createDirectories(logs);
        ZonedDateTime now = ZonedDateTime.now(ZoneId.systemDefault());
        String ts = now.format(DateTimeFormatter.ofPattern("ddMMMyyyy HH:mm:ss.SSS", Locale.ENGLISH));
        String line = "[" + ts + "] [Server thread/INFO] [minecraft/]: [Chunky] Task running for minecraft:overworld. "
                + "Processed: 1000 chunks (10.0%), ETA: 1:00:00, Rate: 5.0 cps";
        java.nio.file.Files.writeString(logs.resolve("latest.log"), line + System.lineSeparator());

        LivePregenTailer tailer = new LivePregenTailer();
        tailer.reset(tempDir, now.minusHours(1));
        tailer.tail();

        JsonObject chunky = tailer.getChunkyPregen();
        assertNotNull(chunky);
        assertTrue(chunky.get("pregen_active").getAsBoolean());
        assertEquals(10.0, chunky.getAsJsonObject("last").get("pct").getAsDouble(), 0.01);
    }
}
