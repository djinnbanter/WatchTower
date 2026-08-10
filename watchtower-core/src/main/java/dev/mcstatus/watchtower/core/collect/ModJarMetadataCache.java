package dev.mcstatus.watchtower.core.collect;

import java.io.IOException;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Session-scoped in-memory cache of {@link ModJarMetadataReader} results.
 * Tick paths must only read snapshots — never call {@code readFromModsDir} directly.
 */
public final class ModJarMetadataCache {

    private static final ModJarMetadataCache INSTANCE = new ModJarMetadataCache();

    private static final Snapshot EMPTY = new Snapshot("", List.of(), Map.of(), false);

    private final AtomicReference<Snapshot> snapshot = new AtomicReference<>(EMPTY);
    private final AtomicBoolean dirty = new AtomicBoolean(false);
    private final AtomicBoolean rebuilding = new AtomicBoolean(false);

    private ModJarMetadataCache() {
    }

    public static ModJarMetadataCache get() {
        return INSTANCE;
    }

    public record Snapshot(
            String fingerprint,
            List<ModJarMetadataReader.ModEntry> entries,
            Map<String, String> nestedIdToParentJar,
            boolean ready) {
    }

    /**
     * Cheap fingerprint of {@code mods/}: sorted {@code name|size|mtime} lines for mod jars
     * (including {@code *.jar.disabled}). Missing dir → empty string.
     */
    public static String fingerprintModsDir(Path modsDir) {
        if (modsDir == null || !Files.isDirectory(modsDir)) {
            return "";
        }
        List<Path> jars = new ArrayList<>();
        try (DirectoryStream<Path> stream = Files.newDirectoryStream(modsDir, ModJarMetadataReader::isModJarFile)) {
            for (Path jar : stream) {
                jars.add(jar);
            }
        } catch (IOException e) {
            return "";
        }
        jars.sort(Comparator.comparing(p -> p.getFileName().toString().toLowerCase(Locale.ROOT)));
        StringBuilder sb = new StringBuilder();
        for (Path jar : jars) {
            try {
                String name = jar.getFileName().toString();
                long size = Files.size(jar);
                long mtime = Files.getLastModifiedTime(jar).toMillis();
                if (!sb.isEmpty()) {
                    sb.append('\n');
                }
                sb.append(name).append('|').append(size).append('|').append(mtime);
            } catch (IOException ignored) {
                // skip unreadable entry
            }
        }
        return sb.toString();
    }

    public Snapshot snapshot() {
        return snapshot.get();
    }

    public Map<String, String> nestedIdToParentJar() {
        return snapshot.get().nestedIdToParentJar();
    }

    public List<ModJarMetadataReader.ModEntry> entries() {
        return snapshot.get().entries();
    }

    public void invalidate(String reason) {
        dirty.set(true);
    }

    public void publish(String fingerprint, List<ModJarMetadataReader.ModEntry> entries) {
        List<ModJarMetadataReader.ModEntry> copy =
                entries == null ? List.of() : List.copyOf(entries);
        Map<String, String> nested = buildNestedMap(copy);
        String fp = fingerprint != null ? fingerprint : "";
        snapshot.set(new Snapshot(fp, copy, Map.copyOf(nested), true));
        dirty.set(false);
    }

    public boolean isDirty() {
        return dirty.get();
    }

    public boolean isRebuilding() {
        return rebuilding.get();
    }

    public void setRebuilding(boolean value) {
        rebuilding.set(value);
    }

    public void resetForTests() {
        snapshot.set(EMPTY);
        dirty.set(false);
        rebuilding.set(false);
    }

    static Map<String, String> buildNestedMap(List<ModJarMetadataReader.ModEntry> entries) {
        Map<String, String> out = new HashMap<>();
        for (ModJarMetadataReader.ModEntry e : entries) {
            if (e.jarFile() == null || e.jarInJar() == null) {
                continue;
            }
            for (ModJarMetadataReader.JarInJarEntry nested : e.jarInJar()) {
                if (nested.id() != null && !nested.id().isBlank()) {
                    out.putIfAbsent(nested.id().toLowerCase(Locale.ROOT), e.jarFile());
                }
            }
        }
        return out;
    }
}
