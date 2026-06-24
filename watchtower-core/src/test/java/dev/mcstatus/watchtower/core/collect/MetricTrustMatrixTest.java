package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonObject;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class MetricTrustMatrixTest {

    @Test
    void cgroupUpgradesMemTrust() {
        JsonObject metrics = MetricTrustMatrix.buildMetrics("container", "pterodactyl", true, true);
        assertEquals("trusted", metrics.getAsJsonObject("mem_used_gb").get("status").getAsString());
        assertEquals("misleading", metrics.getAsJsonObject("mem_available_gb").get("status").getAsString());
        assertEquals("Scoped", metrics.getAsJsonObject("mem_available_gb").get("display_label").getAsString());
        assertEquals("Approximate", metrics.getAsJsonObject("host_cpu_pct").get("display_label").getAsString());
        assertFalse(metrics.getAsJsonObject("heap").has("display_label"));
    }

    @Test
    void bannerWhenMisleadingMetric() {
        JsonObject env = HostEnvironmentDetector.detect("bloom", true, false);
        assertTrue(MetricTrustMatrix.shouldShowContextBanner(env, true));
        assertFalse(MetricTrustMatrix.shouldShowContextBanner(env, false));
    }

    @Test
    void noBannerOnBareMetalWhenTrusted() {
        JsonObject env = HostEnvironmentDetector.detect("none", false, false, false);
        assertFalse(MetricTrustMatrix.shouldShowContextBanner(env, true));
    }
}
