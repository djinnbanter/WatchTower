package dev.mcstatus.watchtower;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class WatchtowerSetupTomlSeedTest {

    @Test
    void leavesExistingLookbackIncrementalAndRetentionAlone() {
        String conf = """
                # saved by wizard
                LOOKBACK_HOURS=168
                INCREMENTAL=false
                LIVE_RETENTION_HOURS=720
                MSPT_WARN=50
                """;
        String out = WatchtowerSetup.seedTomlDefaultsIfAbsent(conf, 24, true, 2160);
        assertTrue(out.contains("LOOKBACK_HOURS=168"));
        assertFalse(out.contains("LOOKBACK_HOURS=24"));
        assertTrue(out.contains("INCREMENTAL=false"));
        assertFalse(out.contains("INCREMENTAL=true"));
        assertTrue(out.contains("LIVE_RETENTION_HOURS=720"));
        assertFalse(out.contains("LIVE_RETENTION_HOURS=2160"));
    }

    @Test
    void seedsMissingKeysFromTomlDefaults() {
        String conf = """
                # sparse conf
                MSPT_WARN=50
                """;
        String out = WatchtowerSetup.seedTomlDefaultsIfAbsent(conf, 24, true, 2160);
        assertTrue(out.contains("LOOKBACK_HOURS=24"));
        assertTrue(out.contains("INCREMENTAL=true"));
        assertTrue(out.contains("LIVE_RETENTION_HOURS=2160"));
        assertTrue(out.contains("MSPT_WARN=50"));
    }
}
