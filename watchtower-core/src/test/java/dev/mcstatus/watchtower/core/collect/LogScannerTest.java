package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.report.ReportConfig;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;

class LogScannerTest {

    @Test
    void kubejsServerSidecarRecipeWarnsAttributedWithSourcePath() throws Exception {
        Path server = Files.createTempDirectory("wt-kubejs-sidecar");
        Path kjs = Files.createDirectories(server.resolve("logs").resolve("kubejs"));
        String warn = "[15:33:12] [WARN] KubeRecipe.java#90: Failed to parse recipe "
                + "'createfood:create/filling/leather_soup_bowl_from_filling_leather_soup[create:filling]'! "
                + "Falling back to vanilla: Failed to read required component";
        Files.writeString(kjs.resolve("server.log"), warn + "\n");

        ReportConfig config = ReportConfig.builder().serverDir(server.toString()).lookbackHours(24).build();
        JsonObject staging = new JsonObject();
        staging.add("minecraft", new JsonObject());
        staging.add("optional", new JsonObject());
        staging.add("events", new JsonArray());

        LogScanner.scanLogs(server.toString(), staging, config.windowStartEpoch(), config);

        assertTrue(staging.getAsJsonObject("optional").has("mod_log_errors"),
                "kubejs/server.log recipe WARNs must surface in mod_log_errors");
        JsonArray errors = staging.getAsJsonObject("optional").getAsJsonArray("mod_log_errors");
        assertFalse(errors.isEmpty());

        JsonObject kubejsRow = findMod(errors, "kubejs");
        assertNotNull(kubejsRow, "kubejs sidecar lines must attribute kubejs mod");
        assertEquals("logs/kubejs/server.log", normalizePath(str(kubejsRow, "source")));
        assertTrue(hasEvidenceFile(kubejsRow, "logs/kubejs/server.log"));

        JsonObject createfoodRow = findMod(errors, "createfood");
        assertNotNull(createfoodRow, "recipe owner mod must be attributed from kubejs sidecar");
        assertEquals("recipe_parse", str(createfoodRow, "top_category"));
    }

    private static JsonObject findMod(JsonArray errors, String modId) {
        for (var el : errors) {
            JsonObject row = el.getAsJsonObject();
            if (modId.equals(str(row, "mod_id"))) {
                return row;
            }
        }
        return null;
    }

    private static boolean hasEvidenceFile(JsonObject row, String expectedFile) {
        if (!row.has("evidence") || !row.get("evidence").isJsonArray()) {
            return false;
        }
        for (var el : row.getAsJsonArray("evidence")) {
            JsonObject ev = el.getAsJsonObject();
            if (expectedFile.equals(normalizePath(str(ev, "file")))) {
                return true;
            }
        }
        return false;
    }

    private static String str(JsonObject o, String key) {
        return o.has(key) && !o.get(key).isJsonNull() ? o.get(key).getAsString() : "";
    }

    private static String normalizePath(String path) {
        return path == null ? "" : path.replace('\\', '/');
    }
}
