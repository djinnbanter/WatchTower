package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonObject;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class HostEnvironmentDetectorTest {

    @Test
    void pterodactylInDockerIsHighConfidenceContainer() {
        JsonObject env = HostEnvironmentDetector.detect("pterodactyl", true, true);
        assertEquals("container", env.get("deployment").getAsString());
        assertEquals("pterodactyl", env.get("hosting").getAsString());
        assertEquals("high", env.get("confidence").getAsString());
        assertTrue(env.get("summary").getAsString().contains("Pterodactyl"));
    }

    @Test
    void bareMetalNativeLinux() {
        JsonObject env = HostEnvironmentDetector.detect("none", false, false, false);
        assertEquals("bare_metal", env.get("deployment").getAsString());
        assertEquals("trusted", env.getAsJsonObject("metrics").getAsJsonObject("mem_available_gb").get("status").getAsString());
    }

    @Test
    void virtualizedHostClassifiesAsVps() {
        JsonObject env = HostEnvironmentDetector.detect("none", false, false, true);
        assertEquals("vps", env.get("deployment").getAsString());
        assertEquals("approximate",
                env.getAsJsonObject("metrics").getAsJsonObject("mem_available_gb").get("status").getAsString());
    }

    @Test
    void containerWithoutCgroupMarksMemMisleading() {
        JsonObject env = HostEnvironmentDetector.detect("bloom", true, false);
        assertEquals("container", env.get("deployment").getAsString());
        assertEquals("misleading",
                env.getAsJsonObject("metrics").getAsJsonObject("mem_available_gb").get("status").getAsString());
        assertEquals("unavailable",
                env.getAsJsonObject("metrics").getAsJsonObject("thermal").get("status").getAsString());
    }

    @Test
    void hostedContainerHelper() {
        assertTrue(HostEnvironmentDetector.isHostedContainer("pterodactyl"));
        assertFalse(HostEnvironmentDetector.isHostedContainer("none"));
    }

    @Test
    void enrichSummaryUsesCgroupAndPanel() {
        JsonObject env = HostEnvironmentDetector.detect("crafty", true, true);
        JsonObject system = new JsonObject();
        system.addProperty("cpu_limit_cores", 2.0);
        system.addProperty("cpu_count", 8);
        system.addProperty("mem_total_gb", 16.0);
        system.addProperty("ram_source", "cgroup_v2");

        HostEnvironmentDetector.enrichSummary(env, system);
        String summary = env.get("summary").getAsString();
        assertTrue(summary.contains("Crafty"));
        assertTrue(summary.contains("2.0 of 8 cores allocated"));
        assertTrue(summary.contains("CPU % is vs quota"));
    }
}
