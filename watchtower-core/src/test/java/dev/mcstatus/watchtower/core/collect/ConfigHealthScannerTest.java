package dev.mcstatus.watchtower.core.collect;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

class ConfigHealthScannerTest {

    @TempDir
    Path tmp;

    @Test
    void flagsBadTomlAndSkipsDefaultconfigs() throws Exception {
        Files.createDirectories(tmp.resolve("config"));
        Files.createDirectories(tmp.resolve("defaultconfigs"));
        Files.writeString(tmp.resolve("config").resolve("create-server.toml"), "key = \"unclosed");
        Files.writeString(tmp.resolve("defaultconfigs").resolve("bad.toml"), "key = \"unclosed");
        Files.createDirectories(tmp.resolve("world").resolve("serverconfig"));
        Files.writeString(tmp.resolve("world").resolve("serverconfig").resolve("empty.toml"), "");

        Path fixture = Path.of("samples", "fixtures", "forensics", "serverconfig-bad.toml");
        if (!Files.isRegularFile(fixture)) {
            fixture = Path.of("..", "samples", "fixtures", "forensics", "serverconfig-bad.toml");
        }
        if (Files.isRegularFile(fixture)) {
            Files.copy(fixture, tmp.resolve("world").resolve("serverconfig").resolve("fixture-bad.toml"));
        }

        List<ConfigHealthScanner.Issue> issues = ConfigHealthScanner.scan(tmp);
        assertTrue(issues.stream().anyMatch(i -> i.path().contains("create-server.toml")));
        assertTrue(issues.stream().anyMatch(i -> i.reason().equals("empty")));
        assertTrue(issues.stream().noneMatch(i -> i.path().contains("defaultconfigs")));
    }
}
