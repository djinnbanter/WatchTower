package dev.mcstatus.watchtower.core.report;

import org.junit.jupiter.api.Test;

import java.util.Map;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Continuous data-flow kill-switch defaults and env parse (W11).
 */
class ContinuousFlowKillSwitchTest {

    @Test
    void continuousKillSwitchesDefaultOn() {
        ReportConfig c = ReportConfig.builder().build();
        assertTrue(c.issuesLiveEnabled());
        assertTrue(c.startupProfileOnBoot());
        assertTrue(c.modsLightOnJarChange());
        assertTrue(c.crashEnrichOnMtime());
        assertEquals(900, c.playerDirectoryPollSec());
    }

    @Test
    void continuousKillSwitchesCanDisableViaEnv() {
        ReportConfig c = ReportConfig.fromMap(Map.of(
                "ISSUES_LIVE_ENABLED", "false",
                "STARTUP_PROFILE_ON_BOOT", "0",
                "MODS_LIGHT_ON_JAR_CHANGE", "no",
                "CRASH_ENRICH_ON_MTIME", "false",
                "PLAYER_DIRECTORY_POLL_SEC", "120"
        ));
        assertFalse(c.issuesLiveEnabled());
        assertFalse(c.startupProfileOnBoot());
        assertFalse(c.modsLightOnJarChange());
        assertFalse(c.crashEnrichOnMtime());
        assertEquals(120, c.playerDirectoryPollSec());
    }
}
