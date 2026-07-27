package dev.mcstatus.watchtower.core.report;

import com.google.gson.JsonObject;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.attribute.FileTime;
import java.time.Instant;
import java.time.temporal.ChronoUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class OverviewMetaBuilderTest {

    @TempDir
    Path temp;

    @Test
    void missingLegacyFactsIsNeutralNotStale() {
        JsonObject meta = OverviewMetaBuilder.build(
                temp, temp, "bare", new JsonObject(), new JsonObject(), "1.0.0-test",
                ReportConfig.fromMap(java.util.Map.of()));
        assertTrue(meta.has("stale"));
        assertFalse(meta.get("stale").getAsBoolean());
        assertFalse(meta.has("last_report_at"));
    }

    @Test
    void supportOnlyFactsStillNeutral() throws Exception {
        Files.writeString(temp.resolve("watchtower-facts-support-2026-01-01.json"), "{}");
        JsonObject meta = OverviewMetaBuilder.build(
                temp, temp, "bare", new JsonObject(), new JsonObject(), "1.0.0-test",
                ReportConfig.fromMap(java.util.Map.of()));
        assertFalse(meta.get("stale").getAsBoolean());
        assertFalse(meta.has("last_report_at"));
    }

    @Test
    void realLegacyFactsExposeLastReportAt() throws Exception {
        Path facts = temp.resolve("watchtower-facts-2026-06-01.json");
        Files.writeString(facts, "{}");
        Files.setLastModifiedTime(facts, FileTime.from(Instant.now().minus(2, ChronoUnit.HOURS)));
        JsonObject meta = OverviewMetaBuilder.build(
                temp, temp, "bare", new JsonObject(), new JsonObject(), "1.0.0-test",
                ReportConfig.fromMap(java.util.Map.of()));
        assertTrue(meta.has("last_report_at"));
        assertEquals("watchtower-facts-2026-06-01.json", meta.get("last_report_file").getAsString());
        assertFalse(meta.get("stale").getAsBoolean());
    }
}
