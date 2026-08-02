package dev.mcstatus.watchtower.core.analyze;

import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;

class GriefLoggerCreateCompatSignaturesTest {

    @Test
    void matchReturnsCompatHitDistinctFromDbAddonAcl() {
        String blob = """
                [29Jul2026 21:31:11.921] [Server thread/ERROR] [net.minecraft.util.thread.BlockableEventLoop/FATAL]: Error executing task on Server
                java.lang.NullPointerException: Cannot invoke "net.minecraft.world.MenuProvider.getClass()" because "menuProvider" is null
                \tat TRANSFORMER/grieflogger@1.2.9-1.21.1/com.daqem.grieflogger.block.container.ContainerHandler.getContainers(ContainerHandler.java:39)
                \tat TRANSFORMER/create@6.0.10/com.simibubi.create.api.contraption.storage.item.MountedItemStorage.handleInteraction(MountedItemStorage.java:80)
                [29Jul2026 21:31:11.923] Failed to process a synchronized task of the payload: create:contraption_interact
                """;
        GriefLoggerCreateCompatSignatures.Hit h = GriefLoggerCreateCompatSignatures.match(blob);
        assertNotNull(h);
        assertEquals("grieflogger", h.modId());
        assertEquals("grieflogger_create_compat", h.kind());
        assertNotEquals("db_addon_acl", h.kind());
        assertEquals("signal_gl_create_npe", GriefLoggerCreateCompatSignatures.ISSUE_ID);
        assertNotEquals(DbAddonSignatures.ISSUE_ID, GriefLoggerCreateCompatSignatures.ISSUE_ID);
    }

    @Test
    void menuProviderAloneDoesNotMatch() {
        assertNull(GriefLoggerCreateCompatSignatures.match(
                "NullPointerException: menuProvider is null somewhere unrelated"));
    }

    @Test
    void containerHandlerWithoutCreateEvidenceDoesNotMatch() {
        assertNull(GriefLoggerCreateCompatSignatures.match(
                "menuProvider is null\n"
                        + "at com.daqem.grieflogger.block.container.ContainerHandler.getContainers"));
    }

    @Test
    void fixtureContainsMatchableCompatBlob() throws Exception {
        String text = Files.readString(resolveFixture(
                "samples/fixtures/log-intelligence/grieflogger-create-npe-0729/excerpt.log"));
        GriefLoggerCreateCompatSignatures.Hit h = GriefLoggerCreateCompatSignatures.match(text);
        assertNotNull(h, "fixture must match GriefLogger × Create mounted-storage NPE");
        assertEquals("grieflogger", h.modId());
        assertEquals("grieflogger_create_compat", h.kind());
        assertNotEquals("db_addon_acl", h.kind());
        assertTrue(h.sampleLine().toLowerCase().contains("containerhandler")
                || h.sampleLine().toLowerCase().contains("menuprovider")
                || h.sampleLine().toLowerCase().contains("contraption"));
    }

    @Test
    void fixStepsMentionCompatAndFatalWithoutCrashReport() {
        var steps = GriefLoggerCreateCompatSignatures.fixSteps();
        assertFalse(steps.isEmpty());
        String joined = String.join(" ", steps).toLowerCase();
        assertTrue(joined.contains("grieflogger") || joined.contains("grief logger"));
        assertTrue(joined.contains("create") || joined.contains("mounted")
                || joined.contains("contraption"));
        assertTrue(joined.contains("fatal") || joined.contains("crash"));
        assertTrue(joined.contains("update") || joined.contains("disable")
                || joined.contains("interact"));
    }

    private static Path resolveFixture(String relative) {
        Path path = Path.of(relative);
        if (Files.isRegularFile(path)) {
            return path;
        }
        path = Path.of("..").resolve(relative);
        if (Files.isRegularFile(path)) {
            return path;
        }
        path = Path.of("../..").resolve(relative);
        if (Files.isRegularFile(path)) {
            return path;
        }
        throw new IllegalStateException("fixture not found: " + relative);
    }
}
