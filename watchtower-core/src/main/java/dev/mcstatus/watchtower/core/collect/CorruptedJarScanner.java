package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

import java.io.IOException;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.zip.ZipException;
import java.util.zip.ZipFile;

/**
 * CA-21 corrupted jar detection — log patterns + optional top-level zip walk.
 */
public final class CorruptedJarScanner {

    private static final Pattern JAR_NAME = Pattern.compile(
            "([\\w.-]+\\.jar)", Pattern.CASE_INSENSITIVE);

    private CorruptedJarScanner() {
    }

    public record Hit(String path, String reason, String detail, String modId, String source) {
    }

    /** Scan log/crash/stderr text for zip END header / empty zip patterns. */
    public static List<Hit> scanLogs(String text) {
        List<Hit> hits = new ArrayList<>();
        if (text == null || text.isBlank()) {
            return hits;
        }
        String[] lines = text.split("\\R");
        for (int i = 0; i < lines.length; i++) {
            String line = lines[i];
            String lower = line.toLowerCase(Locale.ROOT);
            if (!lower.contains("zip")) {
                continue;
            }
            boolean endHeader = lower.contains("zip end header not found");
            boolean emptyZip = lower.contains("zip file is empty");
            if (!endHeader && !emptyZip) {
                continue;
            }
            String reason = emptyZip ? "empty" : "zip_error";
            String jar = findNearbyJar(lines, i);
            String modId = jar != null ? guessModId(jar) : null;
            String detail = line.strip();
            if (detail.length() > 240) {
                detail = detail.substring(0, 240);
            }
            hits.add(new Hit(jar, reason, detail, modId, "log_pattern"));
        }
        return dedupe(hits);
    }

    /**
     * Top-level mods/*.jar zip open check (no deep nested CRC).
     * Reasons: zip_error | empty | not_file | io_error
     */
    public static List<Hit> scanModsDir(Path modsDir) {
        List<Hit> hits = new ArrayList<>();
        if (modsDir == null || !Files.isDirectory(modsDir)) {
            return hits;
        }
        try (DirectoryStream<Path> stream = Files.newDirectoryStream(modsDir, "*.jar")) {
            for (Path jar : stream) {
                String name = jar.getFileName().toString();
                if (!Files.isRegularFile(jar)) {
                    hits.add(new Hit(name, "not_file", "not a regular file", guessModId(name), "zip_walk"));
                    continue;
                }
                try {
                    long size = Files.size(jar);
                    if (size <= 0) {
                        hits.add(new Hit(name, "empty", "jar file is empty", guessModId(name), "zip_walk"));
                        continue;
                    }
                    try (ZipFile zip = new ZipFile(jar.toFile())) {
                        if (!zip.entries().hasMoreElements()) {
                            hits.add(new Hit(name, "empty", "zip has no entries", guessModId(name), "zip_walk"));
                        }
                    }
                } catch (ZipException e) {
                    hits.add(new Hit(name, "zip_error",
                            e.getMessage() != null ? e.getMessage() : "ZipException",
                            guessModId(name), "zip_walk"));
                } catch (IOException e) {
                    hits.add(new Hit(name, "io_error",
                            e.getMessage() != null ? e.getMessage() : "IOException",
                            guessModId(name), "zip_walk"));
                }
            }
        } catch (IOException e) {
            hits.add(new Hit(modsDir.toString(), "io_error",
                    e.getMessage() != null ? e.getMessage() : "cannot list mods",
                    null, "zip_walk"));
        }
        return hits;
    }

    public static JsonArray toJson(List<Hit> hits) {
        JsonArray arr = new JsonArray();
        for (Hit h : hits) {
            JsonObject row = new JsonObject();
            if (h.path() != null) {
                row.addProperty("path", h.path());
            }
            row.addProperty("reason", h.reason());
            if (h.detail() != null) {
                row.addProperty("detail", h.detail());
            }
            if (h.modId() != null) {
                row.addProperty("mod_id", h.modId());
            }
            row.addProperty("source", h.source());
            arr.add(row);
        }
        return arr;
    }

    private static String findNearbyJar(String[] lines, int idx) {
        int from = Math.max(0, idx - 3);
        int to = Math.min(lines.length - 1, idx + 2);
        for (int i = from; i <= to; i++) {
            Matcher m = JAR_NAME.matcher(lines[i]);
            if (m.find()) {
                return m.group(1);
            }
        }
        return null;
    }

    private static String guessModId(String jar) {
        String base = jar;
        if (base.toLowerCase(Locale.ROOT).endsWith(".jar")) {
            base = base.substring(0, base.length() - 4);
        }
        int dash = base.lastIndexOf('-');
        if (dash > 0) {
            base = base.substring(0, dash);
        }
        return base.toLowerCase(Locale.ROOT).replace(' ', '_');
    }

    private static List<Hit> dedupe(List<Hit> hits) {
        Map<String, Hit> map = new LinkedHashMap<>();
        for (Hit h : hits) {
            String key = (h.path() != null ? h.path() : "") + "|" + h.reason() + "|" + h.source();
            map.putIfAbsent(key, h);
        }
        return new ArrayList<>(map.values());
    }
}
