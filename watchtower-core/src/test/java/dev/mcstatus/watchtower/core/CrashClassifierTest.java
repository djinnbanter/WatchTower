package dev.mcstatus.watchtower.core;

import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.analyze.CrashClassifier;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class CrashClassifierTest {

    @Test
    void classifiesModLoadingCrash() {
        JsonObject crash = new JsonObject();
        crash.addProperty("exception", "net.neoforged.neoforge.logging.CrashReportExtender");
        crash.addProperty("mod_file", "create-6.0.8.jar");
        crash.addProperty("summary", "Mod loading error has occurred");

        CrashClassifier.Classification c = CrashClassifier.classify(crash);
        assertEquals("mod", c.category());
        assertEquals("create", c.suspectModId());
        assertFalse(c.fixHints().isEmpty());
    }

    @Test
    void classifiesWatchdogAsHostResource() {
        JsonObject crash = new JsonObject();
        crash.addProperty("exception", "java.lang.Error: ServerHangWatchdog detected that a single server tick took 60.00 seconds");
        crash.addProperty("summary", "Watching Server");

        CrashClassifier.Classification c = CrashClassifier.classify(crash);
        assertEquals("host_resource", c.category());
        assertNull(c.suspectModId());
        assertTrue(c.fixHints().get(0).getAsString().toLowerCase().contains("hang")
                || c.fixHints().get(0).getAsString().toLowerCase().contains("thread"));
    }

    @Test
    void classifiesOomAsHostResource() {
        JsonObject crash = new JsonObject();
        crash.addProperty("exception", "java.lang.OutOfMemoryError: Java heap space");

        CrashClassifier.Classification c = CrashClassifier.classify(crash);
        assertEquals("host_resource", c.category());
    }
}
