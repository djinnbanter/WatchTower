package dev.mcstatus.watchtower.core.analyze;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

import java.io.BufferedInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Enumeration;
import java.util.List;
import java.util.Locale;
import java.util.zip.GZIPInputStream;
import java.util.zip.ZipEntry;
import java.util.zip.ZipFile;

/**
 * Light backup integrity checks (1.1.20). Lists archive/folder entries; does not extract.
 */
public final class BackupVerifier {

    public static final String STATUS_VERIFIED = "verified";
    public static final String STATUS_SUSPICIOUS = "suspicious";
    public static final String STATUS_BROKEN = "broken";
    public static final String STATUS_NOT_CHECKED = "not_checked";
    public static final String STATUS_PENDING = "pending";

    private static final int MAX_ENTRIES = 50_000;
    private static final long MAX_WALL_MS = 30_000L;

    private BackupVerifier() {
    }

    /** Light verify: open archive/folder; never extracts. */
    public static JsonObject lightVerify(Path backupPath) {
        List<String> findings = new ArrayList<>();
        if (backupPath == null) {
            return result(STATUS_BROKEN, findings("missing_path"));
        }
        Path path = backupPath.toAbsolutePath().normalize();
        if (!Files.exists(path)) {
            return result(STATUS_BROKEN, findings("missing_path"));
        }

        try {
            if (Files.isDirectory(path)) {
                return classifyNames(listFolderNames(path), findings, true);
            }
            if (!Files.isRegularFile(path)) {
                findings.add("not_a_file");
                return result(STATUS_BROKEN, findings);
            }

            String name = path.getFileName().toString().toLowerCase(Locale.ROOT);
            if (name.endsWith(".zip")) {
                return classifyNames(listZipNames(path), findings, true);
            }
            if (name.endsWith(".tar.gz") || name.endsWith(".tgz")) {
                return classifyNames(listTarGzNames(path), findings, true);
            }
            // .7z, bare .tar, etc.
            findings.add("unsupported_format");
            return result(STATUS_NOT_CHECKED, findings);
        } catch (IOException e) {
            findings.add("truncated_or_unreadable");
            return result(STATUS_BROKEN, findings);
        } catch (RuntimeException e) {
            findings.add("truncated_or_unreadable");
            return result(STATUS_BROKEN, findings);
        }
    }

    /** Classify already-listed entry names (also used after test-restore extract). */
    public static JsonObject classifyNames(List<String> names, List<String> findings, boolean archiveOpened) {
        if (findings == null) {
            findings = new ArrayList<>();
        }
        if (archiveOpened) {
            findings.add("archive_ok");
        }
        boolean hasLevel = false;
        boolean hasRegion = false;
        if (names != null) {
            for (String raw : names) {
                if (raw == null || raw.isBlank()) {
                    continue;
                }
                String n = raw.replace('\\', '/');
                String base = n.substring(n.lastIndexOf('/') + 1).toLowerCase(Locale.ROOT);
                if ("level.dat".equals(base) || "level.dat_old".equals(base)) {
                    hasLevel = true;
                }
                if (n.toLowerCase(Locale.ROOT).contains("/region/") && base.endsWith(".mca")) {
                    hasRegion = true;
                }
                // also allow region at root of a dim folder without leading slash quirks
                if (n.toLowerCase(Locale.ROOT).contains("region/") && base.endsWith(".mca")) {
                    hasRegion = true;
                }
            }
        }
        if (!hasLevel) {
            findings.add("missing:level.dat");
            return result(STATUS_SUSPICIOUS, findings);
        }
        if (!hasRegion) {
            findings.add("missing:region_mca");
            return result(STATUS_SUSPICIOUS, findings);
        }
        findings.add("has_level.dat");
        findings.add("has_region_mca");
        return result(STATUS_VERIFIED, findings);
    }

    private static List<String> listZipNames(Path zip) throws IOException {
        List<String> names = new ArrayList<>();
        long start = System.currentTimeMillis();
        try (ZipFile zf = new ZipFile(zip.toFile())) {
            Enumeration<? extends ZipEntry> en = zf.entries();
            while (en.hasMoreElements()) {
                if (names.size() >= MAX_ENTRIES || System.currentTimeMillis() - start > MAX_WALL_MS) {
                    names.add("__scan_capped__");
                    break;
                }
                ZipEntry e = en.nextElement();
                if (e != null && e.getName() != null) {
                    names.add(e.getName());
                }
            }
        }
        return names;
    }

    private static List<String> listFolderNames(Path root) throws IOException {
        List<String> names = new ArrayList<>();
        long start = System.currentTimeMillis();
        try (var stream = Files.walk(root)) {
            stream.forEach(p -> {
                if (names.size() >= MAX_ENTRIES || System.currentTimeMillis() - start > MAX_WALL_MS) {
                    return;
                }
                if (Files.isRegularFile(p)) {
                    names.add(root.relativize(p).toString().replace('\\', '/'));
                }
            });
        }
        return names;
    }

    /**
     * Minimal ustar name listing from gzip+tar (no external deps).
     */
    static List<String> listTarGzNames(Path tarGz) throws IOException {
        List<String> names = new ArrayList<>();
        long start = System.currentTimeMillis();
        try (InputStream raw = Files.newInputStream(tarGz);
             BufferedInputStream bis = new BufferedInputStream(raw);
             GZIPInputStream gis = new GZIPInputStream(bis)) {
            byte[] header = new byte[512];
            while (true) {
                if (names.size() >= MAX_ENTRIES || System.currentTimeMillis() - start > MAX_WALL_MS) {
                    names.add("__scan_capped__");
                    break;
                }
                int read = readFully(gis, header);
                if (read < 512) {
                    break;
                }
                if (isAllZero(header)) {
                    break;
                }
                String entryName = readTarName(header);
                long size = parseOctal(header, 124, 12);
                if (!entryName.isEmpty()) {
                    names.add(entryName);
                }
                long skip = ((size + 511) / 512) * 512;
                skipFully(gis, skip);
            }
        }
        return names;
    }

    private static String readTarName(byte[] header) {
        // ustar prefix at 345 (155) + name at 0 (100)
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

    private static List<String> findings(String one) {
        List<String> f = new ArrayList<>();
        f.add(one);
        return f;
    }

    private static JsonObject result(String status, List<String> findings) {
        JsonObject out = new JsonObject();
        out.addProperty("status", status);
        out.addProperty("checked_at", Instant.now().toString());
        out.addProperty("mode", "light");
        JsonArray arr = new JsonArray();
        if (findings != null) {
            for (String f : findings) {
                if (f != null && !f.isBlank()) {
                    arr.add(f);
                }
            }
        }
        out.add("findings", arr);
        return out;
    }
}
