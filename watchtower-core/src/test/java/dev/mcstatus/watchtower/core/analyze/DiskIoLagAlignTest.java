package dev.mcstatus.watchtower.core.analyze;

import com.google.gson.JsonObject;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

class DiskIoLagAlignTest {

    @Test
    void firesWhenHighMsptAlignsWithWriteAwait() {
        Instant now = Instant.parse("2026-07-16T12:00:00Z");
        List<JsonObject> rows = new ArrayList<>();
        for (int i = 0; i < 12; i++) {
            JsonObject row = new JsonObject();
            row.addProperty("ts", now.minus(i, ChronoUnit.MINUTES).toString());
            row.addProperty("mspt_avg", 80.0);
            row.addProperty("disk_write_await_ms_avg", 120.0);
            row.addProperty("disk_write_mb_s_avg", 8.0);
            rows.add(row);
        }
        JsonObject insight = DiskIoLagAlign.evaluate(rows, 50.0, 50.0, 5.0);
        assertNotNull(insight);
        assertEquals(DiskIoLagAlign.INSIGHT_ID, insight.get("id").getAsString());
    }

    @Test
    void noFireWhenMsptHighButDiskQuiet() {
        Instant now = Instant.parse("2026-07-16T12:00:00Z");
        List<JsonObject> rows = new ArrayList<>();
        for (int i = 0; i < 12; i++) {
            JsonObject row = new JsonObject();
            row.addProperty("ts", now.minus(i, ChronoUnit.MINUTES).toString());
            row.addProperty("mspt_avg", 80.0);
            row.addProperty("disk_write_await_ms_avg", 2.0);
            row.addProperty("disk_write_mb_s_avg", 0.1);
            rows.add(row);
        }
        assertNull(DiskIoLagAlign.evaluate(rows, 50.0, 50.0, 5.0));
    }
}
