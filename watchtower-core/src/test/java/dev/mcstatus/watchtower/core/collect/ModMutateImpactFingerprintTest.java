package dev.mcstatus.watchtower.core.collect;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ModMutateImpactFingerprintTest {

    @Test
    void bindsModAndVersion() {
        String a = ModMutateImpactFingerprint.compute("create", "ver_1", "safe", "ok", "[]");
        String b = ModMutateImpactFingerprint.compute("create", "ver_2", "safe", "ok", "[]");
        String c = ModMutateImpactFingerprint.compute("flywheel", "ver_1", "safe", "ok", "[]");
        assertTrue(a.startsWith("ifp_"));
        assertFalse(ModMutateImpactFingerprint.matches(a, b));
        assertFalse(ModMutateImpactFingerprint.matches(a, c));
        assertTrue(ModMutateImpactFingerprint.matches(a, a));
    }

    @Test
    void knownVectorMatchesDashboardStyle() {
        // v1\ncreate\nver_abc\nsafe\nok\n[]
        String fp = ModMutateImpactFingerprint.compute("create", "ver_abc", "safe", "ok", "[]");
        assertEquals(fp, ModMutateImpactFingerprint.compute("create", "ver_abc", "safe", "ok", "[]"));
        assertEquals(
                "ifp_" + Integer.toUnsignedString(ModMutateImpactFingerprint.fnv1a32(
                        "v1\ncreate\nver_abc\nsafe\nok\n[]"), 16),
                fp);
    }
}
