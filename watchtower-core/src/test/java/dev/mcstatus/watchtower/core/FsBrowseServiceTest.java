package dev.mcstatus.watchtower.core;

import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.fs.FsBrowseService;
import dev.mcstatus.watchtower.core.report.ReportConfig;
import org.junit.jupiter.api.Test;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;

class FsBrowseServiceTest {

    @Test
    void listDirectoryShowsArchivesAndCounts() throws Exception {
        Path tmp = Files.createTempDirectory("wt-fs-browse");
        Path dir = tmp.resolve("backups");
        Files.createDirectories(dir);
        Files.writeString(dir.resolve("2026-06-17.zip"), "a");
        Files.writeString(dir.resolve("readme.txt"), "b");
        Files.createDirectories(dir.resolve("subdir"));

        JsonObject listing = FsBrowseService.listDirectory(dir.toString());
        assertEquals(dir.toRealPath().toString(), listing.get("path").getAsString());
        assertEquals(1, listing.get("archive_count").getAsInt());
        assertEquals(3, listing.getAsJsonArray("entries").size());

        boolean sawZip = false;
        for (var el : listing.getAsJsonArray("entries")) {
            JsonObject row = el.getAsJsonObject();
            if ("2026-06-17.zip".equals(row.get("name").getAsString())) {
                sawZip = true;
                assertTrue(row.get("archive").getAsBoolean());
            }
        }
        assertTrue(sawZip);
    }

    @Test
    void listDirectoryRejectsTraversal() {
        assertThrows(IOException.class, () -> FsBrowseService.listDirectory("/tmp/../etc"));
    }

    @Test
    void listRootsIncludesServerDir() throws Exception {
        Path tmp = Files.createTempDirectory("wt-fs-roots");
        Path server = tmp.resolve("server");
        Files.createDirectories(server);
        ReportConfig config = ReportConfig.builder().serverDir(server.toString()).build();
        JsonObject roots = FsBrowseService.listRoots(server.toString(), config, null);
        assertTrue(roots.getAsJsonArray("roots").size() >= 1);
    }
}
