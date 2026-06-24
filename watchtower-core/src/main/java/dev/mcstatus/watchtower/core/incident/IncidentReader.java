package dev.mcstatus.watchtower.core.incident;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Stream;

/**
 * Lists and loads L2 incident files.
 */
public final class IncidentReader {

    private IncidentReader() {
    }

    public static List<JsonObject> listSummaries(Path incidentsDir, int limit) throws IOException {
        if (!Files.isDirectory(incidentsDir)) {
            return List.of();
        }
        List<JsonObject> out = new ArrayList<>();
        try (Stream<Path> stream = Files.list(incidentsDir)) {
            stream.filter(p -> p.getFileName().toString().endsWith(".json"))
                    .sorted(Comparator.comparing(IncidentReader::mtime).reversed())
                    .limit(limit)
                    .forEach(p -> {
                        try {
                            JsonObject full = load(p);
                            JsonObject summary = new JsonObject();
                            copyIfPresent(full, summary, "id");
                            copyIfPresent(full, summary, "pinned_at");
                            copyIfPresent(full, summary, "source");
                            copyIfPresent(full, summary, "trigger");
                            copyIfPresent(full, summary, "severity");
                            copyIfPresent(full, summary, "note");
                            copyIfPresent(full, summary, "tps");
                            copyIfPresent(full, summary, "mspt");
                            copyIfPresent(full, summary, "players_online");
                            copyIfPresent(full, summary, "narrative");
                            out.add(summary);
                        } catch (IOException ignored) {
                        }
                    });
        }
        return out;
    }

    public static JsonObject loadById(Path incidentsDir, String id) throws IOException {
        if (id == null || id.isBlank()) {
            return null;
        }
        Path p = incidentsDir.resolve(safeId(id) + ".json");
        if (!Files.isRegularFile(p)) {
            return null;
        }
        return load(p);
    }

    private static String safeId(String id) {
        return id.replaceAll("[^a-zA-Z0-9._-]", "");
    }

    public static JsonObject load(Path path) throws IOException {
        return JsonParser.parseString(Files.readString(path, StandardCharsets.UTF_8)).getAsJsonObject();
    }

    public static JsonArray toJsonArray(List<JsonObject> items) {
        JsonArray arr = new JsonArray();
        items.forEach(arr::add);
        return arr;
    }

    private static void copyIfPresent(JsonObject from, JsonObject to, String key) {
        if (from.has(key) && !from.get(key).isJsonNull()) {
            to.add(key, from.get(key));
        }
    }

    private static long mtime(Path p) {
        try {
            return Files.getLastModifiedTime(p).toMillis();
        } catch (IOException e) {
            return 0;
        }
    }
}
