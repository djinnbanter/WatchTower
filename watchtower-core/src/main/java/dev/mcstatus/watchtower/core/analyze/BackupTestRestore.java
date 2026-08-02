package dev.mcstatus.watchtower.core.analyze;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

import java.io.BufferedInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.FileStore;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.UUID;
import java.util.function.IntConsumer;
import java.util.zip.GZIPInputStream;
import java.util.zip.ZipEntry;
import java.util.zip.ZipInputStream;

/**
 * Sandboxed test-restore extract under {@code watchtower/restore-verify/<id>/} (1.1.20).
 */
public final class BackupTestRestore {

    public static final double DISK_SAFETY_FACTOR = 1.5;
    public static final String STATE_KEY = "backup_test_restore";

    private BackupTestRestore() {
    }

    public static Path restoreRoot(Path serverDir) {
        return serverDir.toAbsolutePath().normalize().resolve("watchtower").resolve("restore-verify");
    }

    public static Path sandboxForId(Path serverDir, String id) {
        String safe = sanitizeId(id);
        return restoreRoot(serverDir).resolve(safe).normalize();
    }

    public static String sanitizeId(String id) {
        if (id == null || id.isBlank()) {
            return UUID.randomUUID().toString().replace("-", "");
        }
        String s = id.trim().replaceAll("[^a-zA-Z0-9._-]", "_");
        return s.isEmpty() ? UUID.randomUUID().toString().replace("-", "") : s;
    }

    public static boolean isInsideRestoreRoot(Path serverDir, Path candidate) {
        if (serverDir == null || candidate == null) {
            return false;
        }
        Path root = restoreRoot(serverDir);
        Path abs = candidate.toAbsolutePath().normalize();
        return abs.startsWith(root);
    }

    public static void assertEnoughDisk(Path destParent, long archiveBytes) throws IOException {
        long need = (long) Math.ceil(archiveBytes * DISK_SAFETY_FACTOR);
        Path probe = destParent;
        while (probe != null && !Files.exists(probe)) {
            probe = probe.getParent();
        }
        if (probe == null) {
            throw new IOException("disk_check_failed");
        }
        FileStore store = Files.getFileStore(probe);
        long free = store.getUsableSpace();
        if (free < need) {
            throw new IOException("insufficient_disk");
        }
    }

    /**
     * Extract archive into sandbox. Returns light-verify result of extracted tree.
     */
    public static JsonObject extract(Path archive, Path destDir, IntConsumer progressPct) throws IOException {
        if (archive == null || !Files.isRegularFile(archive)) {
            throw new IOException("archive_missing");
        }
        if (destDir == null) {
            throw new IOException("dest_missing");
        }
        Path dest = destDir.toAbsolutePath().normalize();
        Files.createDirectories(dest);
        assertEnoughDisk(dest, Files.size(archive));

        String name = archive.getFileName().toString().toLowerCase(Locale.ROOT);
        if (name.endsWith(".zip")) {
            extractZip(archive, dest, progressPct);
        } else if (name.endsWith(".tar.gz") || name.endsWith(".tgz")) {
            extractTarGz(archive, dest, progressPct);
        } else {
            throw new IOException("unsupported_format");
        }
        if (progressPct != null) {
            progressPct.accept(100);
        }
        List<String> names = new ArrayList<>();
        try (var walk = Files.walk(dest)) {
            walk.filter(Files::isRegularFile).forEach(p ->
                    names.add(dest.relativize(p).toString().replace('\\', '/')));
        }
        return BackupVerifier.classifyNames(names, new ArrayList<>(), true);
    }

    public static void deleteSandbox(Path serverDir, String id) throws IOException {
        Path dir = sandboxForId(serverDir, id);
        if (!isInsideRestoreRoot(serverDir, dir)) {
            throw new IOException("path_escape");
        }
        if (!Files.exists(dir)) {
            return;
        }
        try (var walk = Files.walk(dir)) {
            walk.sorted(Comparator.reverseOrder()).forEach(p -> {
                try {
                    Files.deleteIfExists(p);
                } catch (IOException ignored) {
                }
            });
        }
    }

    public static JsonObject newJob(String id, String path, String dest) {
        JsonObject job = new JsonObject();
        job.addProperty("id", id);
        job.addProperty("path", path);
        job.addProperty("dest", dest);
        job.addProperty("status", "running");
        job.addProperty("progress_pct", 0);
        job.addProperty("started_at", java.time.Instant.now().toString());
        return job;
    }

    private static void extractZip(Path archive, Path dest, IntConsumer progressPct) throws IOException {
        long size = Math.max(1, Files.size(archive));
        long copied = 0;
        try (InputStream in = Files.newInputStream(archive);
             ZipInputStream zis = new ZipInputStream(new BufferedInputStream(in))) {
            ZipEntry entry;
            while ((entry = zis.getNextEntry()) != null) {
                Path out = resolveZipSlip(dest, entry.getName());
                if (entry.isDirectory()) {
                    Files.createDirectories(out);
                } else {
                    Files.createDirectories(out.getParent());
                    try (OutputStream os = Files.newOutputStream(out)) {
                        zis.transferTo(os);
                    }
                    copied += entry.getCompressedSize() > 0 ? entry.getCompressedSize() : 1024;
                    if (progressPct != null) {
                        progressPct.accept((int) Math.min(99, (copied * 100) / size));
                    }
                }
                zis.closeEntry();
            }
        }
    }

    private static void extractTarGz(Path archive, Path dest, IntConsumer progressPct) throws IOException {
        long size = Math.max(1, Files.size(archive));
        long readBytes = 0;
        try (InputStream raw = Files.newInputStream(archive);
             BufferedInputStream bis = new BufferedInputStream(raw);
             GZIPInputStream gis = new GZIPInputStream(bis)) {
            byte[] header = new byte[512];
            while (true) {
                int n = readFully(gis, header);
                readBytes += Math.max(0, n);
                if (n < 512) {
                    break;
                }
                if (isAllZero(header)) {
                    break;
                }
                String entryName = readTarName(header);
                long entrySize = parseOctal(header, 124, 12);
                char type = (char) header[156];
                if (!entryName.isEmpty() && type != '5') {
                    Path out = resolveZipSlip(dest, entryName);
                    Files.createDirectories(out.getParent());
                    try (OutputStream os = Files.newOutputStream(out)) {
                        copyLimited(gis, os, entrySize);
                    }
                } else {
                    skipFully(gis, entrySize);
                }
                long pad = (512 - (entrySize % 512)) % 512;
                skipFully(gis, pad);
                if (progressPct != null) {
                    progressPct.accept((int) Math.min(99, (readBytes * 100) / size));
                }
            }
        }
    }

    static Path resolveZipSlip(Path destRoot, String entryName) throws IOException {
        if (entryName == null || entryName.isBlank()) {
            throw new IOException("zip_slip");
        }
        String cleaned = entryName.replace('\\', '/');
        if (cleaned.startsWith("/") || cleaned.contains("..")) {
            // still resolve and check
        }
        Path out = destRoot.resolve(cleaned).normalize();
        if (!out.startsWith(destRoot)) {
            throw new IOException("zip_slip");
        }
        return out;
    }

    private static String readTarName(byte[] header) {
        String name = nullTerminated(header, 0, 100);
        String prefix = nullTerminated(header, 345, 155);
        if (!prefix.isEmpty()) {
            return prefix + "/" + name;
        }
        return name;
    }

    private static String nullTerminated(byte[] buf, int off, int len) {
        int end = off;
        int max = Math.min(buf.length, off + len);
        while (end < max && buf[end] != 0) {
            end++;
        }
        return new String(buf, off, end - off, StandardCharsets.UTF_8).trim();
    }

    private static long parseOctal(byte[] buf, int off, int len) {
        String s = nullTerminated(buf, off, len).replaceAll("[^0-7]", "");
        if (s.isEmpty()) {
            return 0;
        }
        try {
            return Long.parseLong(s, 8);
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    private static int readFully(InputStream in, byte[] buf) throws IOException {
        int off = 0;
        while (off < buf.length) {
            int n = in.read(buf, off, buf.length - off);
            if (n < 0) {
                return off;
            }
            off += n;
        }
        return off;
    }

    private static void copyLimited(InputStream in, OutputStream out, long n) throws IOException {
        byte[] buf = new byte[8192];
        long left = n;
        while (left > 0) {
            int r = in.read(buf, 0, (int) Math.min(buf.length, left));
            if (r < 0) {
                break;
            }
            out.write(buf, 0, r);
            left -= r;
        }
    }

    private static void skipFully(InputStream in, long n) throws IOException {
        long left = n;
        while (left > 0) {
            long skipped = in.skip(left);
            if (skipped <= 0) {
                if (in.read() < 0) {
                    break;
                }
                left--;
            } else {
                left -= skipped;
            }
        }
    }

    private static boolean isAllZero(byte[] buf) {
        for (byte b : buf) {
            if (b != 0) {
                return false;
            }
        }
        return true;
    }
}
