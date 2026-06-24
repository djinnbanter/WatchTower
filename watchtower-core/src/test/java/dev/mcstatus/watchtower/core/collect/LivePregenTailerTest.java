package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonObject;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Locale;
import java.util.regex.Matcher;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class LivePregenTailerTest {

    @TempDir
    Path tempDir;

    @Test
    void tailParsesPregenWithEta() throws Exception {
        Path logs = tempDir.resolve("logs");
        Files.createDirectories(logs);
        ZonedDateTime now = ZonedDateTime.now(ZoneId.systemDefault());
        String ts = now.format(DateTimeFormatter.ofPattern("ddMMMyyyy HH:mm:ss.SSS", Locale.ENGLISH));
        String line = "[" + ts + "] [Server thread/INFO]: Generated radius: 680.7 / 3126 chunks (31 cps, 21.774%), ETA: 1d 6h";
        Files.writeString(logs.resolve("latest.log"), line + System.lineSeparator(), StandardCharsets.UTF_8);

        LivePregenTailer tailer = new LivePregenTailer();
        ZonedDateTime started = now.minusHours(2);
        tailer.reset(tempDir, started);
        tailer.tail();

        JsonObject dh = tailer.getDhPregen();
        assertNotNull(dh);
        JsonObject last = dh.getAsJsonObject("last");
        assertEquals(21.774, last.get("pct").getAsDouble(), 0.001);
        assertEquals("1d 6h", last.get("eta").getAsString());
        assertTrue(dh.get("pregen_active").getAsBoolean());
    }

    @Test
    void buildEntryFromMatcherCapturesEta() {
        String line = "Generated radius: 100.0 / 5000 chunks (25 cps, 2.0%), ETA: 3d 12h";
        Matcher pm = LogPatterns.PREGEN.matcher(line);
        assertTrue(pm.find());
        JsonObject entry = PregenLogSupport.buildEntryFromMatcher(
                pm,
                ZonedDateTime.now(ZoneId.systemDefault()),
                "latest.log",
                1);
        assertEquals("3d 12h", entry.get("eta").getAsString());
        assertEquals(2.0, entry.get("pct").getAsDouble(), 0.001);
    }
}
