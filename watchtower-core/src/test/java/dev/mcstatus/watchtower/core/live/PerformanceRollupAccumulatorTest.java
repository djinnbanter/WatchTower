package dev.mcstatus.watchtower.core.live;

import com.google.gson.JsonObject;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class PerformanceRollupAccumulatorTest {

    @Test
    void finalizeRow_computesP95JitterAndLowTpsFlag() {
        PerformanceRollupAccumulator acc = new PerformanceRollupAccumulator();
        double tpsWarn = 19.5;
        for (int i = 0; i < 60; i++) {
            double tps = i == 10 ? 15.0 : 20.0;
            double mspt = 40.0 + (i % 5);
            acc.addSample(tps, mspt, 2, 6.0, 14.0, 50.0, tpsWarn);
        }
        JsonObject row = acc.finalizeRow(1_700_000_000L);
        assertEquals(15.0, row.get("tps_min").getAsDouble(), 0.01);
        assertTrue(row.get("low_tps_flag").getAsBoolean());
        assertTrue(row.get("mspt_p95").getAsDouble() >= row.get("mspt_avg").getAsDouble());
        assertTrue(row.get("mspt_jitter_max").getAsDouble() > 0);
        assertEquals(2, row.get("players_max").getAsInt());
    }

    @Test
    void p95_and_jitter_helpers() {
        List<Double> mspt = List.of(10.0, 20.0, 30.0, 40.0, 100.0);
        assertEquals(100.0, PerformanceRollupAccumulator.p95(new ArrayList<>(mspt)), 0.01);
        assertEquals(60.0, PerformanceRollupAccumulator.maxJitter(new ArrayList<>(mspt)), 0.01);
    }
}
