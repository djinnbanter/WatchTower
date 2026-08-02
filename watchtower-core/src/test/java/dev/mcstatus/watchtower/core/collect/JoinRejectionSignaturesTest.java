package dev.mcstatus.watchtower.core.collect;

import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class JoinRejectionSignaturesTest {

    private static String load(String name) throws Exception {
        Path cwd = Path.of("").toAbsolutePath();
        for (Path c : List.of(
                cwd.resolve("samples/fixtures/join-clinic").resolve(name),
                cwd.resolve("../samples/fixtures/join-clinic").resolve(name),
                cwd.resolve("../../samples/fixtures/join-clinic").resolve(name))) {
            if (Files.isRegularFile(c)) {
                return Files.readString(c).strip();
            }
        }
        throw new IllegalStateException("fixture not found: " + name);
    }

    @Test
    void mismatchedChannelParsesModIds() throws Exception {
        var hit = JoinRejectionSignatures.match(load("neoforge-mismatched-channel.log"));
        assertNotNull(hit);
        assertEquals("mismatched_channel", hit.kind());
        assertTrue(hit.modIds().contains("create"));
        assertTrue(hit.modIds().contains("flywheel"));
        assertFalse(hit.player().isBlank());
    }

    @Test
    void missingModParsesModIds() throws Exception {
        var hit = JoinRejectionSignatures.match(load("neoforge-missing-mod.log"));
        assertNotNull(hit);
        assertEquals("missing_mod", hit.kind());
        assertTrue(hit.modIds().contains("create"));
        assertTrue(hit.modIds().contains("jei"));
    }

    @Test
    void fabricWrongVersionParsesModId() throws Exception {
        var hit = JoinRejectionSignatures.match(load("fabric-mod-rejection.log"));
        assertNotNull(hit);
        assertEquals("wrong_version", hit.kind());
        assertTrue(hit.modIds().stream().anyMatch(id -> id.contains("fabric")));
    }

    @Test
    void ordinaryTimeoutDoesNotMatch() throws Exception {
        assertNull(JoinRejectionSignatures.match(load("ordinary-timeout.log")));
    }
}
