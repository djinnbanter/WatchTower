package dev.mcstatus.watchtower.core.analyze;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class JadeSidecarAnalyzerTest {

    @Test
    void countsMultiExceptionJadeInstances() throws Exception {
        String text = Files.readString(fixture());
        JsonObject out = JadeSidecarAnalyzer.analyze(text);

        assertNotNull(out);
        assertEquals("signal_jade_sidecar_compat", out.get("issue_id").getAsString());
        assertEquals("jade", out.get("primary_mod").getAsString());
        assertEquals(8, out.get("instance_count").getAsInt());
        assertEquals("info", out.get("severity").getAsString());
        assertFalse(out.get("crash_or_outage").getAsBoolean());

        JsonArray classes = out.getAsJsonArray("exception_classes");
        assertNotNull(classes);
        Set<String> seen = new HashSet<>();
        classes.forEach(el -> seen.add(el.getAsString()));
        assertTrue(seen.contains("java.lang.NullPointerException"));
        assertTrue(seen.contains("java.lang.IllegalStateException"));
        assertTrue(seen.contains("java.lang.ClassCastException"),
                "must cover Create LecternController ClassCast, not InvWrapper-only");

        JsonArray samples = out.getAsJsonArray("samples");
        assertNotNull(samples);
        assertTrue(samples.size() <= 5);
        assertTrue(samples.size() >= 1);
    }

    @Test
    void emptyTextYieldsNull() {
        assertNull(JadeSidecarAnalyzer.analyze(""));
        assertNull(JadeSidecarAnalyzer.analyze(null));
        assertNull(JadeSidecarAnalyzer.analyze("no instances here\n"));
    }

    private static Path fixture() {
        Path cwd = Path.of("").toAbsolutePath();
        for (Path candidate : List.of(
                cwd.resolve("samples/fixtures/log-intelligence/jade-sidecar-compat/JadeErrorOutput.txt"),
                cwd.resolve("../samples/fixtures/log-intelligence/jade-sidecar-compat/JadeErrorOutput.txt"),
                cwd.resolve("../../samples/fixtures/log-intelligence/jade-sidecar-compat/JadeErrorOutput.txt"))) {
            if (Files.isRegularFile(candidate)) {
                return candidate;
            }
        }
        throw new IllegalStateException("Jade sidecar fixture not found from " + cwd);
    }
}
