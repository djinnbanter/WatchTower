package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonObject;

import java.io.IOException;
import java.io.Reader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Properties;

/**
 * Reads {@code server.properties} from a server directory.
 */
public final class ServerPropertiesReader {

    public static final String FILE_NAME = "server.properties";

    private ServerPropertiesReader() {
    }

    public record Result(
            boolean available,
            Path path,
            Map<String, String> values,
            String error
    ) {
        public String get(String key) {
            if (values == null || key == null) {
                return null;
            }
            return values.get(key);
        }

        public String levelName() {
            String ln = get("level-name");
            if (ln == null || ln.isBlank()) {
                return "world";
            }
            return ln.strip();
        }

        public Integer getInt(String key) {
            String raw = get(key);
            if (raw == null || raw.isBlank()) {
                return null;
            }
            try {
                return Integer.parseInt(raw.strip());
            } catch (NumberFormatException e) {
                return null;
            }
        }

        public Boolean getBoolean(String key) {
            String raw = get(key);
            if (raw == null || raw.isBlank()) {
                return null;
            }
            String v = raw.strip().toLowerCase();
            if ("true".equals(v) || "yes".equals(v) || "on".equals(v)) {
                return true;
            }
            if ("false".equals(v) || "no".equals(v) || "off".equals(v)) {
                return false;
            }
            return null;
        }

        public JsonObject toJson() {
            JsonObject out = new JsonObject();
            out.addProperty("available", available);
            if (path != null) {
                out.addProperty("path", path.toString().replace('\\', '/'));
            }
            if (error != null) {
                out.addProperty("error", error);
            }
            JsonObject vals = new JsonObject();
            if (values != null) {
                for (Map.Entry<String, String> e : values.entrySet()) {
                    vals.addProperty(e.getKey(), e.getValue());
                }
            }
            out.add("values", vals);
            return out;
        }
    }

    public static Result read(Path serverDir) {
        if (serverDir == null) {
            return new Result(false, null, Map.of(), "server directory missing");
        }
        Path path = serverDir.resolve(FILE_NAME);
        if (!Files.isRegularFile(path)) {
            return new Result(false, path, Map.of(), "Could not read server.properties");
        }
        try {
            Properties props = new Properties();
            try (Reader r = Files.newBufferedReader(path, StandardCharsets.UTF_8)) {
                props.load(r);
            }
            Map<String, String> values = new LinkedHashMap<>();
            for (String name : props.stringPropertyNames()) {
                String v = props.getProperty(name);
                if (v != null) {
                    values.put(name, v.strip());
                }
            }
            return new Result(true, path, Map.copyOf(values), null);
        } catch (IOException e) {
            return new Result(false, path, Map.of(),
                    e.getMessage() != null ? e.getMessage() : "Could not read server.properties");
        }
    }
}
