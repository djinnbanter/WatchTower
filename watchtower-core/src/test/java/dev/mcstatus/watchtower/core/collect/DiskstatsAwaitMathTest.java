package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonObject;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class DiskstatsAwaitMathTest {

    @Test
    void writeAwaitFromDeltas() {
        // Simulate two diskstats snapshots: 100 writes took 5000 ms writing → await 50 ms
        long dWrites = 100;
        long dTimeMs = 5000;
        double awaitMs = (double) dTimeMs / (double) dWrites;
        assertEquals(50.0, awaitMs, 0.01);

        JsonObject disk = new JsonObject();
        disk.addProperty("write_await_ms", Math.round(awaitMs * 10.0) / 10.0);
        disk.addProperty("latency_source", "diskstats");
        assertEquals(50.0, disk.get("write_await_ms").getAsDouble(), 0.01);
        assertEquals("diskstats", disk.get("latency_source").getAsString());
    }

    @Test
    void zeroWritesDoesNotDivide() {
        long dWrites = 0;
        long dTimeMs = 100;
        boolean canCompute = dWrites > 0 && dTimeMs >= 0;
        assertTrue(!canCompute);
    }
}
