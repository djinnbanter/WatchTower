package dev.mcstatus.watchtower.core.analyze;

import com.google.gson.JsonObject;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DiskProjectionAnalyzerTest {

    @Test
    void steadyGrowthProjectsDaysWithinTolerance() {
        Instant now = Instant.now().truncatedTo(ChronoUnit.HOURS);
        List<JsonObject> rows = new ArrayList<>();
        // 24h of hourly free space: declining 0.5 GB/hour = 12 GB/day
        for (int h = 24; h >= 0; h--) {
            Instant ts = now.minus(h, ChronoUnit.HOURS);
            double free = 24.0 + h * 0.5;
            rows.add(minuteRow(ts, free));
        }
        JsonObject out = DiskProjectionAnalyzer.analyze(rows, 24.0, 70.0, 24, 6, 5.0, null);
        assertEquals("filling", out.get("verdict").getAsString());
        double days = out.get("days_until_full").getAsDouble();
        assertTrue(days >= 1.6 && days <= 2.4, "days=" + days);
        assertTrue(DiskProjectionAnalyzer.shouldRaiseIssue(out, 14));
    }

    @Test
    void flatDiskIsStableAndNoIssue() {
        Instant now = Instant.now().truncatedTo(ChronoUnit.HOURS);
        List<JsonObject> rows = new ArrayList<>();
        for (int h = 24; h >= 0; h--) {
            rows.add(minuteRow(now.minus(h, ChronoUnit.HOURS), 40.0));
        }
        JsonObject out = DiskProjectionAnalyzer.analyze(rows, 40.0, 50.0, 24, 6, 5.0, null);
        assertEquals("stable", out.get("verdict").getAsString());
        assertFalse(DiskProjectionAnalyzer.shouldRaiseIssue(out, 14));
    }

    @Test
    void outlierDumpIsIgnored() {
        Instant now = Instant.now().truncatedTo(ChronoUnit.HOURS);
        List<JsonObject> rows = new ArrayList<>();
        for (int h = 24; h >= 0; h--) {
            double free = 30.0 + h * 0.1;
            if (h == 12) {
                free = 20.0;
            }
            rows.add(minuteRow(now.minus(h, ChronoUnit.HOURS), free));
        }
        JsonObject out = DiskProjectionAnalyzer.analyze(rows, 30.0, 60.0, 24, 6, 5.0, null);
        assertEquals("filling", out.get("verdict").getAsString());
        double rate = out.get("fill_rate_gb_per_day").getAsDouble();
        assertTrue(rate < 5.0, "rate=" + rate);
    }

    @Test
    void insufficientSpan() {
        Instant now = Instant.now().truncatedTo(ChronoUnit.HOURS);
        List<JsonObject> rows = new ArrayList<>();
        for (int h = 3; h >= 0; h--) {
            rows.add(minuteRow(now.minus(h, ChronoUnit.HOURS), 20.0 + h));
        }
        JsonObject out = DiskProjectionAnalyzer.analyze(rows, 20.0, 80.0, 24, 6, 5.0, null);
        assertEquals("insufficient", out.get("verdict").getAsString());
        assertFalse(DiskProjectionAnalyzer.shouldRaiseIssue(out, 14));
    }

    private static JsonObject minuteRow(Instant ts, double freeGb) {
        JsonObject row = new JsonObject();
        row.addProperty("ts", ts.toString());
        row.addProperty("disk_free_gb_avg", freeGb);
        row.addProperty("disk_use_pct_avg", 50.0);
        return row;
    }
}
