package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import dev.mcstatus.watchtower.core.panel.ProcessChecks;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.TimeUnit;
import java.util.stream.Stream;

/**
 * Host CPU temperature from lm-sensors or Linux sysfs hwmon.
 */
public final class ThermalCollector {

    private static final Path SYSFS_HWMON = Path.of("/sys/class/hwmon");
    private static final int WARN_THRESHOLD_C = 85;
    private static final int SENSOR_TIMEOUT_SEC = 3;

    private ThermalCollector() {
    }

    public static JsonObject collect() {
        return collect(SYSFS_HWMON);
    }

    static JsonObject collect(Path hwmonRoot) {
        if (ProcessChecks.isDockerContainer()) {
            JsonObject unavailable = new JsonObject();
            unavailable.addProperty("available", false);
            unavailable.addProperty("reason", "docker_container");
            unavailable.addProperty("reason_detail",
                    "Docker and panel containers usually cannot read the host CPU temperature.");
            return unavailable;
        }
        if (SYSFS_HWMON.equals(hwmonRoot)) {
            JsonObject fromSensors = tryLmSensors();
            if (fromSensors != null) {
                return fromSensors;
            }
        }
        JsonObject fromSysfs = readSysfs(hwmonRoot);
        if (fromSysfs != null) {
            return fromSysfs;
        }
        JsonObject unavailable = new JsonObject();
        unavailable.addProperty("available", false);
        if (isLinux() && !Files.isDirectory(hwmonRoot)) {
            unavailable.addProperty("reason", "unavailable");
            unavailable.addProperty("reason_detail",
                    "Hardware sensors are not exposed on this Linux VM or rented host.");
        } else {
            unavailable.addProperty("reason", "no_sensors");
            unavailable.addProperty("reason_detail",
                    "No lm-sensors or sysfs hwmon temperature readings were found.");
        }
        return unavailable;
    }

    private static JsonObject tryLmSensors() {
        if (!isLinux()) {
            return null;
        }
        try {
            Process proc = new ProcessBuilder("sensors", "-j")
                    .redirectErrorStream(true)
                    .start();
            if (!proc.waitFor(SENSOR_TIMEOUT_SEC, TimeUnit.SECONDS)) {
                proc.destroyForcibly();
                return null;
            }
            if (proc.exitValue() != 0) {
                return null;
            }
            String json;
            try (BufferedReader reader = new BufferedReader(
                    new InputStreamReader(proc.getInputStream(), StandardCharsets.UTF_8))) {
                json = reader.lines().reduce("", (a, b) -> a + b);
            }
            if (json.isBlank()) {
                return null;
            }
            return parseSensorsJson(json);
        } catch (IOException | InterruptedException e) {
            Thread.currentThread().interrupt();
            return null;
        }
    }

    private static JsonObject parseSensorsJson(String json) {
        try {
            var root = JsonParser.parseString(json).getAsJsonObject();
            List<Zone> zones = new ArrayList<>();
            Double packageC = null;
            for (String chip : root.keySet()) {
                if (!root.get(chip).isJsonObject()) {
                    continue;
                }
                var chipObj = root.getAsJsonObject(chip);
                for (String label : chipObj.keySet()) {
                    if (!chipObj.get(label).isJsonObject()) {
                        continue;
                    }
                    var reading = chipObj.getAsJsonObject(label);
                    if (!reading.has("temp1_input") && !reading.has("temp2_input")) {
                        continue;
                    }
                    double c = reading.has("temp1_input")
                            ? reading.get("temp1_input").getAsDouble()
                            : reading.get("temp2_input").getAsDouble();
                    String zoneLabel = label;
                    if (reading.has("temp1_label")) {
                        zoneLabel = reading.get("temp1_label").getAsString();
                    }
                    zones.add(new Zone(sanitizeId(label), zoneLabel, c));
                    if (zoneLabel.toLowerCase(Locale.ROOT).contains("package")
                            || label.toLowerCase(Locale.ROOT).contains("package")) {
                        packageC = c;
                    }
                }
            }
            if (zones.isEmpty()) {
                return null;
            }
            if (packageC == null) {
                packageC = zones.stream().max(Comparator.comparingDouble(z -> z.c)).map(z -> z.c).orElse(null);
            }
            return buildResult(packageC, zones, "lm-sensors");
        } catch (Exception e) {
            return null;
        }
    }

    private static JsonObject readSysfs(Path hwmonRoot) {
        if (!Files.isDirectory(hwmonRoot)) {
            return null;
        }
        List<Zone> zones = new ArrayList<>();
        Double packageC = null;
        try (Stream<Path> stream = Files.list(hwmonRoot)) {
            for (Path hwmon : stream.filter(Files::isDirectory).toList()) {
                String chipName = readFirstLine(hwmon.resolve("name"));
                try (Stream<Path> temps = Files.list(hwmon)) {
                    for (Path temp : temps.filter(p -> p.getFileName().toString().matches("temp\\d+_input")).toList()) {
                        String input = Files.readString(temp, StandardCharsets.UTF_8).trim();
                        long milli = Long.parseLong(input);
                        double c = milli / 1000.0;
                        String idx = temp.getFileName().toString().replace("_input", "");
                        Path labelPath = hwmon.resolve(idx + "_label");
                        String label = Files.isRegularFile(labelPath)
                                ? Files.readString(labelPath, StandardCharsets.UTF_8).trim()
                                : (chipName != null ? chipName : idx);
                        String id = sanitizeId((chipName != null ? chipName : hwmon.getFileName().toString()) + "_" + idx);
                        zones.add(new Zone(id, label, c));
                        if (label.toLowerCase(Locale.ROOT).contains("package")
                                || label.toLowerCase(Locale.ROOT).contains("tdie")
                                || label.toLowerCase(Locale.ROOT).contains("tctl")) {
                            packageC = c;
                        }
                    }
                }
            }
        } catch (IOException | NumberFormatException e) {
            return null;
        }
        if (zones.isEmpty()) {
            return null;
        }
        if (packageC == null) {
            packageC = zones.stream().max(Comparator.comparingDouble(z -> z.c)).map(z -> z.c).orElse(null);
        }
        return buildResult(packageC, zones, "sysfs");
    }

    private static JsonObject buildResult(Double packageC, List<Zone> zones, String source) {
        JsonObject out = new JsonObject();
        out.addProperty("available", true);
        if (packageC != null) {
            out.addProperty("package_c", Math.round(packageC * 10.0) / 10.0);
        }
        out.addProperty("source", source);
        out.addProperty("warn_threshold_c", WARN_THRESHOLD_C);
        JsonArray zoneArr = new JsonArray();
        for (Zone z : zones.stream().limit(64).toList()) {
            JsonObject row = new JsonObject();
            row.addProperty("id", z.id);
            row.addProperty("label", z.label);
            row.addProperty("c", Math.round(z.c * 10.0) / 10.0);
            zoneArr.add(row);
        }
        out.add("zones", zoneArr);
        return out;
    }

    private static String readFirstLine(Path path) {
        try {
            if (Files.isRegularFile(path)) {
                return Files.readString(path, StandardCharsets.UTF_8).trim();
            }
        } catch (IOException ignored) {
            // fall through
        }
        return null;
    }

    private static String sanitizeId(String raw) {
        return raw.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+", "_").replaceAll("^_|_$", "");
    }

    private static boolean isLinux() {
        String os = System.getProperty("os.name", "").toLowerCase(Locale.ROOT);
        return os.contains("linux");
    }

    private record Zone(String id, String label, double c) {
    }
}
