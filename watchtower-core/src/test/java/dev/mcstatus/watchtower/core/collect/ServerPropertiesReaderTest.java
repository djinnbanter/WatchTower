package dev.mcstatus.watchtower.core.collect;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;

class ServerPropertiesReaderTest {

    @TempDir
    Path temp;

    @Test
    void readsDefaultStyleFile() throws Exception {
        Path props = temp.resolve("server.properties");
        Files.writeString(props, """
                #Minecraft server properties
                view-distance=10
                simulation-distance=10
                max-tick-time=60000
                level-name=world
                network-compression-threshold=256
                sync-chunk-writes=true
                entity-broadcast-range-percentage=100
                """, StandardCharsets.UTF_8);

        ServerPropertiesReader.Result r = ServerPropertiesReader.read(temp);
        assertTrue(r.available());
        assertEquals("10", r.get("view-distance"));
        assertEquals(10, r.getInt("view-distance"));
        assertEquals("world", r.levelName());
        assertEquals(Boolean.TRUE, r.getBoolean("sync-chunk-writes"));
    }

    @Test
    void readsEditedValuesAndCustomLevelName() throws Exception {
        Path props = temp.resolve("server.properties");
        Files.writeString(props, """
                view-distance=16
                simulation-distance=12
                max-tick-time=20000
                level-name=skyblock
                sync-chunk-writes=false
                """, StandardCharsets.UTF_8);

        ServerPropertiesReader.Result r = ServerPropertiesReader.read(temp);
        assertTrue(r.available());
        assertEquals(16, r.getInt("view-distance"));
        assertEquals("skyblock", r.levelName());
        assertEquals(Boolean.FALSE, r.getBoolean("sync-chunk-writes"));
    }

    @Test
    void missingFileIsUnavailable() {
        ServerPropertiesReader.Result r = ServerPropertiesReader.read(temp);
        assertFalse(r.available());
        assertEquals("world", r.levelName());
        assertNotNull(r.error());
    }
}
