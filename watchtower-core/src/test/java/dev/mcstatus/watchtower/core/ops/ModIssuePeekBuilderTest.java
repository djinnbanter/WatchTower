package dev.mcstatus.watchtower.core.ops;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;

class ModIssuePeekBuilderTest {

    @Test
    void excludesClientNoiseAndSortsBySeverity() {
        JsonArray errors = new JsonArray();
        JsonObject noise = new JsonObject();
        noise.addProperty("mod_id", "client_noise");
        noise.addProperty("total", 50);
        errors.add(noise);

        JsonObject critical = new JsonObject();
        critical.addProperty("mod_id", "broken_mod");
        critical.addProperty("total", 2);
        critical.addProperty("top_category", "mod_load_failed");
        errors.add(critical);

        JsonObject minor = new JsonObject();
        minor.addProperty("mod_id", "noisy_mod");
        minor.addProperty("total", 20);
        minor.addProperty("top_category", "logger_error");
        errors.add(minor);

        JsonArray peek = ModIssuePeekBuilder.buildPeekEntries(errors);
        assertEquals(2, peek.size());
        assertEquals("broken_mod", peek.get(0).getAsJsonObject().get("mod_id").getAsString());
        assertFalse(peek.get(0).getAsJsonObject().get("id").getAsString().contains("client_noise"));
    }
}
