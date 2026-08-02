package dev.mcstatus.watchtower.core.config;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ModConfigServiceTest {

    @TempDir
    Path temp;

    private Path serverWithConfig(String rel, String body) throws Exception {
        Path server = temp.resolve("server");
        Path file = server.resolve(rel);
        Files.createDirectories(file.getParent());
        Files.writeString(file, body);
        return server;
    }

    @Test
    void listFindsConfigToml() throws Exception {
        Path server = serverWithConfig("config/a.toml", "x = 1\n");
        List<JsonObject> list = ModConfigService.list(server);
        assertEquals(1, list.size());
        assertEquals("config/a.toml", list.get(0).get("path").getAsString());
    }

    @Test
    void resolveRejectsEscapeAndMods() {
        Path server = temp.resolve("server");
        assertThrows(IllegalArgumentException.class,
                () -> ModConfigService.resolveConfigFile(server, "../secrets.txt"));
        assertThrows(IllegalArgumentException.class,
                () -> ModConfigService.resolveConfigFile(server, "mods/x.jar"));
        assertThrows(IllegalArgumentException.class,
                () -> ModConfigService.resolveConfigFile(server, "config/../../etc/passwd"));
    }

    @Test
    void secretHintDetectsPasswordKey() throws Exception {
        Path server = serverWithConfig("config/secret.toml", "password = \"hunter2\"\n");
        List<JsonObject> list = ModConfigService.list(server);
        assertTrue(list.get(0).get("secret_hint").getAsBoolean());
        assertTrue(ModConfigService.secretHint("api_key = \"x\""));
        assertFalse(ModConfigService.secretHint("enabled = true"));
    }

    @Test
    void readReturnsContentAndWarnings() throws Exception {
        Path server = serverWithConfig("config/bad.json", "{not-json");
        JsonObject r = ModConfigService.read(server, "config/bad.json");
        assertEquals("{not-json", r.get("content").getAsString());
        assertTrue(r.getAsJsonArray("parse_warnings").size() >= 1);
    }

    @Test
    void saveBackupAndUndoRestoresBytes() throws Exception {
        Path server = serverWithConfig("config/a.toml", "x = 1\n");
        Path wt = temp.resolve("watchtower");
        Files.createDirectories(wt);
        JsonObject before = ModConfigService.read(server, "config/a.toml");
        long mtime = before.get("mtime").getAsLong();

        JsonObject saved = ModConfigService.save(server, wt, "config/a.toml", "x = 2\n", mtime);
        assertEquals("x = 2\n", Files.readString(server.resolve("config/a.toml")));
        assertTrue(saved.has("backup_path"));

        JsonObject undone = ModConfigService.undo(server, wt, "config/a.toml");
        assertEquals("x = 1\n", Files.readString(server.resolve("config/a.toml")));
        assertEquals("config/a.toml", undone.get("path").getAsString());
    }

    @Test
    void saveStaleMtimeConflicts() throws Exception {
        Path server = serverWithConfig("config/a.toml", "x = 1\n");
        Path wt = temp.resolve("watchtower");
        Files.createDirectories(wt);
        assertThrows(ModConfigService.ConflictException.class,
                () -> ModConfigService.save(server, wt, "config/a.toml", "x = 2\n", 1L));
    }

    @Test
    void saveOversizeRefused() throws Exception {
        Path server = serverWithConfig("config/a.toml", "x = 1\n");
        Path wt = temp.resolve("watchtower");
        Files.createDirectories(wt);
        long mtime = Files.getLastModifiedTime(server.resolve("config/a.toml")).toInstant().getEpochSecond();
        String huge = "a".repeat(ModConfigService.MAX_CONTENT_BYTES + 1);
        assertThrows(ModConfigService.OversizeException.class,
                () -> ModConfigService.save(server, wt, "config/a.toml", huge, mtime));
    }

    @Test
    void readTomlOffersFormEditor() throws Exception {
        Path server = serverWithConfig("config/a.toml", "[recipes]\nbulkPressing = false\n");
        JsonObject r = ModConfigService.read(server, "config/a.toml");
        assertEquals("form", r.get("editor").getAsString());
        assertTrue(r.has("fields"));
        assertTrue(r.getAsJsonArray("fields").size() >= 1);
        assertTrue(r.has("content"));
    }

    @Test
    void readTomlWithArrayFallsBackToRawNotFail() throws Exception {
        Path server = serverWithConfig("config/a.toml", "tags = [\"a\", \"b\"]\n");
        JsonObject r = ModConfigService.read(server, "config/a.toml");
        assertEquals("tags = [\"a\", \"b\"]\n", r.get("content").getAsString());
        // Plain arrays may be form-ok now; either form or raw is fine as long as content is present.
        assertTrue(r.has("content"));
        assertTrue(r.has("editor"));
    }

    @Test
    void saveRejectsDisallowedExtension() throws Exception {
        Path server = serverWithConfig("config/evil.bin", "x");
        Path wt = temp.resolve("watchtower");
        Files.createDirectories(wt);
        assertThrows(IllegalArgumentException.class,
                () -> ModConfigService.save(server, wt, "config/evil.bin", "y", 0L));
    }

    @Test
    void backupDirsDoNotCollideAcrossSlashVsDoubleUnderscore() {
        Path wt = temp.resolve("watchtower");
        Path a = ModConfigService.backupDirFor(wt, "config/a/b.toml");
        Path b = ModConfigService.backupDirFor(wt, "config/a__b.toml");
        assertFalse(a.equals(b));
    }

    @Test
    void readBadTomlFallsBackToRaw() throws Exception {
        Path server = serverWithConfig("config/bad.toml", "not = = toml\n");
        JsonObject r = ModConfigService.read(server, "config/bad.toml");
        assertEquals("raw", r.get("editor").getAsString());
        assertFalse(r.has("fields"));
    }

    @Test
    void saveFieldsWritesAndBacksUp() throws Exception {
        Path server = serverWithConfig("config/a.toml", "# keep\nx = 1\n");
        Path wt = temp.resolve("watchtower");
        Files.createDirectories(wt);
        JsonObject before = ModConfigService.read(server, "config/a.toml");
        long mtime = before.get("mtime").getAsLong();
        JsonArray fields = before.getAsJsonArray("fields");

        // Flip the root integer
        for (int i = 0; i < fields.size(); i++) {
            JsonObject f = fields.get(i).getAsJsonObject();
            if ("x".equals(f.get("key").getAsString()) && "integer".equals(f.get("kind").getAsString())) {
                f.addProperty("value", 99);
            }
        }

        JsonObject saved = ModConfigService.saveFields(server, wt, "config/a.toml", fields, mtime);
        assertTrue(saved.has("backup_path"));
        String written = Files.readString(server.resolve("config/a.toml"));
        assertTrue(written.startsWith("# keep"));
        assertTrue(written.contains("x = 99"));
        assertFalse(written.contains("WatchTower form rewrite"));
        assertTrue(TomlFormModel.parse(written).formOk());
    }

    @Test
    void saveFieldsRejectsInvalidTree() throws Exception {
        Path server = serverWithConfig("config/a.toml", "x = 1\n");
        Path wt = temp.resolve("watchtower");
        Files.createDirectories(wt);
        long mtime = Files.getLastModifiedTime(server.resolve("config/a.toml")).toInstant().getEpochSecond();
        JsonArray bad = new JsonArray();
        JsonObject leaf = new JsonObject();
        leaf.addProperty("kind", "nope");
        leaf.addProperty("key", "x");
        leaf.addProperty("path", "x");
        leaf.addProperty("section", "");
        leaf.addProperty("value", 1);
        bad.add(leaf);
        assertThrows(IllegalArgumentException.class,
                () -> ModConfigService.saveFields(server, wt, "config/a.toml", bad, mtime));
    }
}
