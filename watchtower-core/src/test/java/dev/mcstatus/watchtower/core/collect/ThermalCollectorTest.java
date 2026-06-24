package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonObject;
import org.junit.jupiter.api.Test;

import java.nio.file.Files;
import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.*;

class ThermalCollectorTest {

    @Test
    void readsMockSysfsTemps() throws Exception {
        Path tmp = Files.createTempDirectory("wt-hwmon");
        Path hwmon0 = tmp.resolve("hwmon0");
        Files.createDirectories(hwmon0);
        Files.writeString(hwmon0.resolve("name"), "k10temp");
        Files.writeString(hwmon0.resolve("temp1_input"), "68500");
        Files.writeString(hwmon0.resolve("temp1_label"), "Tctl");

        JsonObject thermal = ThermalCollector.collect(tmp);
        assertTrue(thermal.get("available").getAsBoolean());
        assertEquals("sysfs", thermal.get("source").getAsString());
        assertTrue(thermal.get("package_c").getAsDouble() >= 68.0);
        assertFalse(thermal.getAsJsonArray("zones").isEmpty());
    }

    @Test
    void unavailableWhenNoHwmon() throws Exception {
        Path empty = Files.createTempDirectory("wt-hwmon-empty");
        JsonObject thermal = ThermalCollector.collect(empty);
        assertFalse(thermal.get("available").getAsBoolean());
        assertEquals("no_sensors", thermal.get("reason").getAsString());
    }
}
