package dev.mcstatus.watchtower.core.ops;

import com.google.gson.JsonObject;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

class PackChangeActivityScannerTest {

    @TempDir
    Path temp;

    private Path tempServerWithMods(String... jars) throws Exception {
        Path root = temp.resolve("server");
        Path mods = root.resolve("mods");
        Files.createDirectories(mods);
        for (String jar : jars) {
            Files.writeString(mods.resolve(jar), "jar-bytes");
        }
        return root;
    }

    @Test
    void firstScanWritesBaselineEmitsNothing() throws Exception {
        Path root = tempServerWithMods("a.jar");
        PackChangeActivityScanner.Result r = PackChangeActivityScanner.scan(root, null, 1_700_000_000L);
        assertTrue(r.events().isEmpty());
        assertTrue(r.nextSnapshot().getAsJsonObject("mods").has("a.jar"));
    }

    @Test
    void jarAddedEmitsModJarAdded() throws Exception {
        Path root = tempServerWithMods("a.jar");
        PackChangeActivityScanner.Result base = PackChangeActivityScanner.scan(root, null, 1_700_000_000L);
        Files.writeString(root.resolve("mods").resolve("b.jar"), "x");
        PackChangeActivityScanner.Result r =
                PackChangeActivityScanner.scan(root, base.nextSnapshot(), 1_700_000_060L);
        assertEquals(1, r.events().size());
        assertEquals("mod_jar_added", r.events().get(0).get("type").getAsString());
        assertTrue(r.events().get(0).get("detail").getAsString().contains("b.jar"));
        assertEquals("scan", r.events().get(0).get("source").getAsString());
    }

    @Test
    void jarRemovedAndUpdated() throws Exception {
        long t0 = 1_700_000_000L;
        Path root = tempServerWithMods("keep.jar", "gone.jar");
        PackChangeActivityScanner.Result base = PackChangeActivityScanner.scan(root, null, t0);
        Files.delete(root.resolve("mods").resolve("gone.jar"));
        Files.writeString(root.resolve("mods").resolve("keep.jar"), "jar-bytes-updated-longer");
        // bump mtime if needed — content change usually updates mtime; force via setLastModifiedTime
        Files.setLastModifiedTime(
                root.resolve("mods").resolve("keep.jar"),
                java.nio.file.attribute.FileTime.fromMillis((t0 + 120) * 1000L));
        PackChangeActivityScanner.Result r = PackChangeActivityScanner.scan(root, base.nextSnapshot(), t0 + 60);
        assertTrue(r.events().stream().anyMatch(e -> "mod_jar_removed".equals(e.get("type").getAsString())
                && e.get("detail").getAsString().contains("gone.jar")));
        assertTrue(r.events().stream().anyMatch(e -> "mod_jar_updated".equals(e.get("type").getAsString())
                && e.get("detail").getAsString().contains("keep.jar")));
    }

    @Test
    void softDisableRenameDoesNotEmitJarAddRemove() throws Exception {
        long t0 = 1_700_000_000L;
        Path root = tempServerWithMods("foo.jar");
        PackChangeActivityScanner.Result base = PackChangeActivityScanner.scan(root, null, t0);
        Files.move(root.resolve("mods").resolve("foo.jar"), root.resolve("mods").resolve("foo.jar.disabled"));
        PackChangeActivityScanner.Result r = PackChangeActivityScanner.scan(root, base.nextSnapshot(), t0 + 60);
        assertTrue(r.events().stream().noneMatch(e -> e.get("type").getAsString().startsWith("mod_jar_")));
    }
}
