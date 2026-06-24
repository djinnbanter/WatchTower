package dev.mcstatus.watchtower.core.collect;

import java.io.IOException;
import java.nio.file.Path;
import java.util.Enumeration;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;

/**
 * Optional bytecode scan: counts client class references inside mod jars.
 */
public final class ModJarSideScanner {

    public record ScanResult(int clientClasses, int totalClasses, double clientRatio) {
    }

    private ModJarSideScanner() {
    }

    public static ScanResult scan(Path jarPath) throws IOException {
        int client = 0;
        int total = 0;
        try (ZipFile zip = new ZipFile(jarPath.toFile())) {
            Enumeration<? extends ZipEntry> entries = zip.entries();
            while (entries.hasMoreElements()) {
                ZipEntry entry = entries.nextElement();
                String name = entry.getName();
                if (!name.endsWith(".class") || entry.isDirectory()) {
                    continue;
                }
                total++;
                if (name.contains("net/minecraft/client/")) {
                    client++;
                }
            }
        }
        double ratio = total > 0 ? (double) client / total : 0.0;
        return new ScanResult(client, total, ratio);
    }

    public static Path modJarPath(String serverDir, String modId) {
        Path modsDir = Path.of(serverDir, "mods");
        if (!modsDir.toFile().isDirectory()) {
            return null;
        }
        Path direct = modsDir.resolve(modId + ".jar");
        if (direct.toFile().isFile()) {
            return direct;
        }
        try (var stream = java.nio.file.Files.newDirectoryStream(modsDir, modId + "-*.jar")) {
            for (Path p : stream) {
                return p;
            }
        } catch (IOException ignored) {
            // fall through
        }
        return null;
    }
}
