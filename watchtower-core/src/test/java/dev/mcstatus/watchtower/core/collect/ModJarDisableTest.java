package dev.mcstatus.watchtower.core.collect;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;

class ModJarDisableTest {

    @Test
    void disableRenamesJarToJarDisabled(@TempDir Path mods) throws Exception {
        Files.writeString(mods.resolve("foo-1.0.jar"), "x");
        var r = ModJarDisable.disable(mods, "foo-1.0.jar");
        assertTrue(r.ok());
        assertEquals("foo-1.0.jar.disabled", r.jarAfter());
        assertTrue(Files.exists(mods.resolve("foo-1.0.jar.disabled")));
        assertFalse(Files.exists(mods.resolve("foo-1.0.jar")));
    }

    @Test
    void refusePathEscape(@TempDir Path mods) {
        var r = ModJarDisable.disable(mods, "../secrets.jar");
        assertFalse(r.ok());
        assertEquals("invalid_jar", r.errorCode());
    }

    @Test
    void refuseNestedSlash(@TempDir Path mods) {
        var r = ModJarDisable.disable(mods, "sub/foo.jar");
        assertFalse(r.ok());
        assertEquals("invalid_jar", r.errorCode());
    }

    @Test
    void enableRoundTrip(@TempDir Path mods) throws Exception {
        Files.writeString(mods.resolve("foo-1.0.jar.disabled"), "x");
        var r = ModJarDisable.enable(mods, "foo-1.0.jar.disabled");
        assertTrue(r.ok());
        assertEquals("foo-1.0.jar", r.jarAfter());
        assertTrue(Files.exists(mods.resolve("foo-1.0.jar")));
        assertFalse(Files.exists(mods.resolve("foo-1.0.jar.disabled")));
    }

    @Test
    void disableIdempotentIfAlreadyDisabled(@TempDir Path mods) throws Exception {
        Files.writeString(mods.resolve("foo-1.0.jar.disabled"), "x");
        var r = ModJarDisable.disable(mods, "foo-1.0.jar.disabled");
        assertTrue(r.ok());
        assertEquals("foo-1.0.jar.disabled", r.jarAfter());
        assertTrue(Files.exists(mods.resolve("foo-1.0.jar.disabled")));
    }

    @Test
    void enableAcceptsLegacyDotDisabledSuffix(@TempDir Path mods) throws Exception {
        Files.writeString(mods.resolve("bar.jar.disabled"), "x");
        // also support plain .disabled if someone used name.disabled without .jar — enable path for .jar.disabled
        var r = ModJarDisable.enable(mods, "bar.jar.disabled");
        assertTrue(r.ok());
        assertEquals("bar.jar", r.jarAfter());
    }

    @Test
    void namingHelpers() {
        assertTrue(ModJarDisable.isDisabledName("foo.jar.disabled"));
        assertFalse(ModJarDisable.isDisabledName("foo.jar"));
        assertEquals("foo.jar.disabled", ModJarDisable.disabledNameFor("foo.jar"));
        assertEquals("foo.jar", ModJarDisable.enabledNameFor("foo.jar.disabled"));
    }

    @Test
    void missingJarFails(@TempDir Path mods) {
        var r = ModJarDisable.disable(mods, "missing.jar");
        assertFalse(r.ok());
        assertEquals("not_found", r.errorCode());
    }
}
