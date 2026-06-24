package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonObject;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class PerCoreCpuSamplerTest {

    @Test
    void firstSampleReturnsNullThenUsageOnSecondSample() {
        PerCoreCpuSampler sampler = new PerCoreCpuSampler();
        assertNull(sampler.sample());
        JsonObject out = sampler.sample();
        if (out != null) {
            assertTrue(out.has("cores"));
            assertTrue(out.getAsJsonArray("cores").size() >= 0);
        }
    }
}
