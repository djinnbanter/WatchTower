package dev.mcstatus.watchtower.core.collect;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;

class SilentFailSignaturesTest {

    @Test
    void matchesKubejsWithPathAndLine() {
        String line = "[Server thread/ERROR] [KubeJS Server/]: Error running event handler "
                + "(kubejs/server_scripts/machines.js:42): thermal:machine_furnace is not a valid recipe";
        SilentFailSignatures.Hit hit = SilentFailSignatures.match(line);
        assertNotNull(hit);
        assertEquals("kubejs", hit.kind());
        assertEquals("warning", hit.severity());
        assertEquals("kubejs/server_scripts/machines.js", hit.path());
        assertEquals(42, hit.line());
    }

    @Test
    void matchesCrafttweakerWithPathAndLine() {
        String line = "[Server thread/ERROR] [CraftTweaker/CT-LOGGER]: Error(s) parsing "
                + "scripts/gear.zs line 15: unexpected token";
        SilentFailSignatures.Hit hit = SilentFailSignatures.match(line);
        assertNotNull(hit);
        assertEquals("crafttweaker", hit.kind());
        assertEquals("scripts/gear.zs", hit.path());
        assertEquals(15, hit.line());
    }

    @Test
    void matchesDatapackJsonWithPath() {
        String line = "[Server thread/ERROR] [minecraft/SimpleJsonResourceReloadListener]: "
                + "Couldn't parse data file 'create:machine_furnace' from data pack 'file/create'";
        SilentFailSignatures.Hit hit = SilentFailSignatures.match(line);
        assertNotNull(hit);
        assertEquals("datapack_json", hit.kind());
        assertEquals("create:machine_furnace", hit.path());
        assertNull(hit.line());
    }

    @Test
    void matchesReloadFailedWithoutPath() {
        String line = "[Server thread/ERROR]: Failed to execute reload";
        SilentFailSignatures.Hit hit = SilentFailSignatures.match(line);
        assertNotNull(hit);
        assertEquals("reload_failed", hit.kind());
        assertEquals("info", hit.severity());
        assertNull(hit.path());
    }

    @Test
    void ignoresUnrelatedReloadInfo() {
        String line = "[Server thread/INFO]: Reloading data packs...";
        assertNull(SilentFailSignatures.match(line));
    }
}
