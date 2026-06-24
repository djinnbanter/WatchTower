package dev.mcstatus.watchtower.core.incident;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.Comparator;
import java.util.stream.Stream;

/**
 * Writes L2 lag incident files under {@code watchtower/incidents/}.
 */
public final class IncidentWriter {

    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static final DateTimeFormatter ID_FMT =
            DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH-mm-ss'Z'").withZone(ZoneId.of("UTC"));
    private static final DateTimeFormatter ISO = DateTimeFormatter.ISO_OFFSET_DATE_TIME;

    private IncidentWriter() {
    }

    public static String newIncidentId(Instant when) {
        return ID_FMT.format(when);
    }

    public static Path write(Path incidentsDir, JsonObject incident, int maxFiles) throws IOException {
        Files.createDirectories(incidentsDir);
        String id = incident.has("id") ? incident.get("id").getAsString() : newIncidentId(Instant.now());
        incident.addProperty("id", id);
        if (!incident.has("pinned_at")) {
            incident.addProperty("pinned_at", ZonedDateTime.now(ZoneId.systemDefault()).format(ISO));
        }
        Path target = incidentsDir.resolve(id + ".json");
        Path tmp = incidentsDir.resolve(id + ".json.tmp");
        Files.writeString(tmp, GSON.toJson(incident) + System.lineSeparator(), StandardCharsets.UTF_8);
        Files.move(tmp, target, StandardCopyOption.REPLACE_EXISTING, StandardCopyOption.ATOMIC_MOVE);
        trimOld(incidentsDir, maxFiles);
        return target;
    }

    public static void trimOld(Path incidentsDir, int maxFiles) throws IOException {
        if (!Files.isDirectory(incidentsDir) || maxFiles <= 0) {
            return;
        }
        try (Stream<Path> stream = Files.list(incidentsDir)) {
            var files = stream
                    .filter(p -> p.getFileName().toString().endsWith(".json"))
                    .sorted(Comparator.comparing(IncidentWriter::mtime).reversed())
                    .toList();
            for (int i = maxFiles; i < files.size(); i++) {
                Files.deleteIfExists(files.get(i));
            }
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
