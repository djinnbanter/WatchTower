package dev.mcstatus.watchtower.core.collect;

import com.google.gson.Gson;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.net.InetAddress;
import java.nio.charset.StandardCharsets;
import java.nio.file.DirectoryStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;

/**
 * Extended collectors: storage, security, bandwidth, load attribution, mods (ported from mc-status-extras.py).
 */
public final class ExtrasCollector {

    private static final Gson GSON = new Gson();

    private ExtrasCollector() {
    }

    public static JsonObject collectStorage(String serverDir) {
        JsonObject result = new JsonObject();
        String[] worldPaths = {
                serverDir + "/world",
                serverDir + "/DIM-1",
                serverDir + "/DIM1"
        };
        long worldTotal = 0;
        boolean worldFound = false;
        for (String wp : worldPaths) {
            if (Files.isDirectory(Path.of(wp))) {
                Long b = duBytes(wp);
                if (b != null) {
                    worldTotal += b;
                    worldFound = true;
                }
            }
        }
        if (worldFound) {
            result.addProperty("world_bytes", worldTotal);
            result.addProperty("world_gb", Math.round(worldTotal / (1024.0 * 1024.0 * 1024.0) * 100.0) / 100.0);
        }

        Long serverB = duBytes(serverDir);
        if (serverB != null) {
            result.addProperty("server_dir_bytes", serverB);
            result.addProperty("server_dir_gb", Math.round(serverB / (1024.0 * 1024.0 * 1024.0) * 100.0) / 100.0);
        }

        Path logsDir = Path.of(serverDir, "logs");
        if (Files.isDirectory(logsDir)) {
            Long lb = duBytes(logsDir.toString());
            if (lb != null) {
                result.addProperty("logs_bytes", lb);
                result.addProperty("logs_mb", Math.round(lb / (1024.0 * 1024.0) * 10.0) / 10.0);
            }
        }
        return result;
    }

    public static JsonObject collectDiskIo(String serverDir) {
        String device = resolveBlockDevice(serverDir);
        if (device == null) {
            return null;
        }

        for (String[] cmd : new String[][]{
                {"iostat", "-x", "1", "2"},
                {"sar", "-d", "1", "2"}
        }) {
            try {
                Process proc = new ProcessBuilder(cmd).redirectErrorStream(true).start();
                if (!proc.waitFor(15, TimeUnit.SECONDS)) {
                    proc.destroyForcibly();
                    continue;
                }
                String out = new String(proc.getInputStream().readAllBytes(), StandardCharsets.UTF_8).strip();
                if (out.isEmpty()) {
                    continue;
                }
                String[] lines = out.split("\\R");
                for (int i = lines.length - 1; i >= 0; i--) {
                    String line = lines[i];
                    if (!line.contains(device) || line.toLowerCase().startsWith("device")) {
                        continue;
                    }
                    String[] cols = line.trim().split("\\s+");
                    if ("iostat".equals(cmd[0]) && cols.length >= 14) {
                        try {
                            JsonObject io = new JsonObject();
                            io.addProperty("device", device);
                            io.addProperty("util_pct", Double.parseDouble(cols[cols.length - 2]));
                            io.addProperty("await_ms", Double.parseDouble(cols[cols.length - 1]));
                            io.addProperty("source", "iostat");
                            return io;
                        } catch (NumberFormatException ignored) {
                            // try next line
                        }
                    } else if ("sar".equals(cmd[0]) && cols.length >= 5) {
                        try {
                            JsonObject io = new JsonObject();
                            io.addProperty("device", device);
                            io.add("util_pct", null);
                            io.addProperty("tps", Double.parseDouble(cols[2]));
                            io.addProperty("source", "sar");
                            return io;
                        } catch (NumberFormatException ignored) {
                            // try next line
                        }
                    }
                }
            } catch (Exception ignored) {
                // try next command
            }
        }
        return null;
    }

    public static int countMods(String serverDir) {
        Path modsDir = Path.of(serverDir, "mods");
        if (!Files.isDirectory(modsDir)) {
            return 0;
        }
        int count = 0;
        try (DirectoryStream<Path> stream = Files.newDirectoryStream(modsDir, "*.jar")) {
            for (Path ignored : stream) {
                count++;
            }
        } catch (IOException e) {
            return 0;
        }
        return count;
    }

    /**
     * Fallback mod list from jar filenames when snapshot mods are unavailable.
     */
    public static JsonArray listModsFromDir(String serverDir) {
        return ModJarMetadataReader.listModsFromDir(serverDir);
    }

    public static JsonObject computeLoadAttribution(
            boolean dhPregenActive,
            Integer playersOnline,
            Integer concurrentAtWorstLag,
            Integer verdictPlayers) {
        int players = playersOnline != null ? playersOnline : 0;
        int atLag = concurrentAtWorstLag != null ? concurrentAtWorstLag : players;
        if (verdictPlayers != null) {
            atLag = verdictPlayers;
        }

        String verdict = "unknown";
        if (dhPregenActive && atLag == 0) {
            verdict = "likely_pregen";
        } else if (atLag > 0 && !dhPregenActive) {
            verdict = "likely_gameplay";
        } else if (dhPregenActive && atLag > 0) {
            verdict = "mixed";
        } else if (dhPregenActive) {
            verdict = "likely_pregen";
        } else if (atLag > 0) {
            verdict = "likely_gameplay";
        }

        JsonObject result = new JsonObject();
        result.addProperty("dh_pregen_active", dhPregenActive);
        result.addProperty("players_online", players);
        result.addProperty("concurrent_at_worst_lag", atLag);
        result.addProperty("verdict", verdict);
        return result;
    }

    public static JsonObject collectSecurity(
            ZonedDateTime windowStart,
            String craftyAuditPath,
            List<String> mcLogPaths) {
        JsonObject result = new JsonObject();
        result.addProperty("failed_ssh", 0);
        result.addProperty("failed_crafty", 0);
        result.addProperty("failed_mc", 0);
        Set<String> ips = new HashSet<>();

        String sinceArg = windowStart != null
                ? windowStart.format(DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss"))
                : "24 hours ago";

        int failedSsh = countSshFailuresJournal(sinceArg, ips);
        result.addProperty("failed_ssh", failedSsh);

        if (failedSsh == 0) {
            for (String path : List.of("/var/log/auth.log", "/var/log/auth.log.1")) {
                if (!Files.isRegularFile(Path.of(path))) {
                    continue;
                }
                int n = countSshFailuresFile(path, ips);
                result.addProperty("failed_ssh", n);
                if (n > 0) {
                    break;
                }
            }
        }

        if (craftyAuditPath != null && Files.isRegularFile(Path.of(craftyAuditPath))) {
            try {
                for (String line : Files.readAllLines(Path.of(craftyAuditPath), StandardCharsets.UTF_8)) {
                    line = line.strip();
                    if (line.isEmpty()) {
                        continue;
                    }
                    try {
                        JsonObject rec = GSON.fromJson(line, JsonObject.class);
                        String action = (CollectSupport.getString(rec, "action") + CollectSupport.getString(rec, "event"))
                                .toLowerCase();
                        if (action.contains("fail") || action.contains("denied") || action.contains("invalid")) {
                            result.addProperty("failed_crafty", result.get("failed_crafty").getAsInt() + 1);
                        }
                        String sip = rec.has("source_ip") && !rec.get("source_ip").isJsonNull()
                                ? rec.get("source_ip").getAsString()
                                : CollectSupport.getString(rec, "ip");
                        if (!sip.isEmpty()) {
                            ips.add(sip);
                        }
                    } catch (com.google.gson.JsonSyntaxException ignored) {
                        // skip
                    }
                }
            } catch (IOException ignored) {
                // skip
            }
        }

        for (String path : mcLogPaths) {
            if (!Files.isRegularFile(Path.of(path))) {
                continue;
            }
            try {
                for (String line : Files.readAllLines(Path.of(path), StandardCharsets.UTF_8)) {
                    if (LogPatterns.MC_AUTH_FAIL.matcher(line).find()) {
                        result.addProperty("failed_mc", result.get("failed_mc").getAsInt() + 1);
                    }
                }
            } catch (IOException ignored) {
                // skip
            }
        }

        int privateCount = 0;
        int publicCount = 0;
        for (String ipS : ips) {
            try {
                InetAddress addr = InetAddress.getByName(ipS);
                if (addr.isLoopbackAddress() || addr.isSiteLocalAddress() || addr.isLinkLocalAddress()) {
                    privateCount++;
                } else {
                    publicCount++;
                }
            } catch (Exception ignored) {
                // skip invalid
            }
        }

        JsonArray ipArr = new JsonArray();
        ips.stream().sorted().forEach(ipArr::add);
        result.add("unique_ips", ipArr);
        result.addProperty("unique_ip_count", ips.size());
        result.addProperty("private_ip_count", privateCount);
        result.addProperty("public_ip_count", publicCount);
        return result;
    }

    public static JsonObject readProcNetDev() {
        Path procNet = Path.of("/proc/net/dev");
        if (!Files.isRegularFile(procNet)) {
            return null;
        }
        try {
            List<String> lines = Files.readAllLines(procNet, StandardCharsets.UTF_8);
            JsonObject best = null;
            for (int i = 2; i < lines.size(); i++) {
                String line = lines.get(i);
                int colon = line.indexOf(':');
                if (colon < 0) {
                    continue;
                }
                String iface = line.substring(0, colon).strip();
                if ("lo".equals(iface)) {
                    continue;
                }
                String[] cols = line.substring(colon + 1).trim().split("\\s+");
                if (cols.length < 9) {
                    continue;
                }
                long rx = Long.parseLong(cols[0]);
                long tx = Long.parseLong(cols[8]);
                JsonObject candidate = new JsonObject();
                candidate.addProperty("interface", iface);
                candidate.addProperty("rx_bytes", rx);
                candidate.addProperty("tx_bytes", tx);
                if (best == null
                        || rx + tx > best.get("rx_bytes").getAsLong() + best.get("tx_bytes").getAsLong()) {
                    best = candidate;
                }
            }
            return best;
        } catch (IOException | NumberFormatException e) {
            return null;
        }
    }

    /**
     * Cumulative read/write bytes for the block device backing {@code serverDir} (Linux /proc/diskstats).
     */
    public static JsonObject readServerDiskIo(String serverDir) {
        String device = resolveBlockDevice(serverDir);
        if (device == null) {
            return null;
        }
        return readProcDiskstats(device);
    }

    public static JsonObject readProcDiskstats(String device) {
        if (device == null || device.isBlank()) {
            return null;
        }
        Path diskstats = Path.of("/proc/diskstats");
        if (!Files.isRegularFile(diskstats)) {
            return null;
        }
        try {
            for (String line : Files.readAllLines(diskstats, StandardCharsets.UTF_8)) {
                String[] parts = line.trim().split("\\s+");
                if (parts.length < 14) {
                    continue;
                }
                String name = parts[2];
                if (!device.equals(name) && !name.startsWith(device)) {
                    continue;
                }
                long readSectors = Long.parseLong(parts[5]);
                long writeSectors = Long.parseLong(parts[9]);
                JsonObject io = new JsonObject();
                io.addProperty("device", name);
                io.addProperty("read_bytes", readSectors * 512L);
                io.addProperty("write_bytes", writeSectors * 512L);
                io.addProperty("source", "diskstats");
                return io;
            }
        } catch (IOException | NumberFormatException e) {
            return null;
        }
        return null;
    }

    public static Double storageDeltaMb(long currentBytes, JsonArray history, double hours) {
        if (history == null || history.isEmpty()) {
            return null;
        }
        double target = Instant.now().getEpochSecond() - hours * 3600.0;
        JsonObject past = null;
        List<JsonObject> sorted = new ArrayList<>();
        for (var el : history) {
            sorted.add(el.getAsJsonObject());
        }
        sorted.sort((a, b) -> Double.compare(
                a.has("ts") ? a.get("ts").getAsDouble() : 0,
                b.has("ts") ? b.get("ts").getAsDouble() : 0));
        for (JsonObject entry : sorted) {
            double ts = entry.has("ts") ? entry.get("ts").getAsDouble() : 0;
            if (ts <= target) {
                past = entry;
            }
        }
        if (past == null && !sorted.isEmpty()) {
            past = sorted.getFirst();
        }
        if (past == null || !past.has("world_bytes")) {
            return null;
        }
        long delta = currentBytes - past.get("world_bytes").getAsLong();
        return Math.round(delta / (1024.0 * 1024.0) * 10.0) / 10.0;
    }

    private static int countSshFailuresJournal(String sinceArg, Set<String> ips) {
        try {
            Process proc = new ProcessBuilder("journalctl", "--since", sinceArg, "-q", "--no-pager")
                    .redirectErrorStream(true)
                    .start();
            if (!proc.waitFor(30, TimeUnit.SECONDS)) {
                proc.destroyForcibly();
                return 0;
            }
            int count = 0;
            try (var reader = new BufferedReader(new InputStreamReader(proc.getInputStream(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    if (LogPatterns.SSH_FAIL.matcher(line).find()) {
                        count++;
                    }
                    Matcher m = LogPatterns.IPV4.matcher(line);
                    while (m.find()) {
                        ips.add(m.group(1));
                    }
                }
            }
            return count;
        } catch (Exception e) {
            return 0;
        }
    }

    private static int countSshFailuresFile(String path, Set<String> ips) {
        int count = 0;
        try {
            for (String line : Files.readAllLines(Path.of(path), StandardCharsets.UTF_8)) {
                if (LogPatterns.SSH_FAIL.matcher(line).find()) {
                    count++;
                }
                Matcher m = LogPatterns.IPV4.matcher(line);
                while (m.find()) {
                    ips.add(m.group(1));
                }
            }
        } catch (IOException ignored) {
            return 0;
        }
        return count;
    }

    private static Long duBytes(String path) {
        try {
            Process proc = new ProcessBuilder("du", "-sb", path).redirectErrorStream(true).start();
            if (!proc.waitFor(120, TimeUnit.SECONDS)) {
                proc.destroyForcibly();
                return null;
            }
            if (proc.exitValue() != 0) {
                return null;
            }
            String out = new String(proc.getInputStream().readAllBytes(), StandardCharsets.UTF_8).strip();
            return Long.parseLong(out.split("\\s+")[0]);
        } catch (Exception e) {
            return null;
        }
    }

    private static String resolveBlockDevice(String serverDir) {
        try {
            Path serverPath = Path.of(serverDir).toAbsolutePath().normalize();
            Path mount = serverPath;
            while (mount != null && !Files.exists(mount)) {
                mount = mount.getParent();
            }
            while (mount != null && !mount.equals(mount.getRoot())) {
                if (mount.getFileSystem().supportedFileAttributeViews().contains("posix")) {
                    // isMount check via parent walk
                }
                if (isMountPoint(mount)) {
                    break;
                }
                mount = mount.getParent();
            }
            if (mount == null) {
                mount = serverPath.getRoot();
            }
            Path mounts = Path.of("/proc/mounts");
            if (!Files.isRegularFile(mounts)) {
                return null;
            }
            String mountStr = mount.toString();
            for (String line : Files.readAllLines(mounts, StandardCharsets.UTF_8)) {
                String[] parts = line.split("\\s+");
                if (parts.length >= 2 && parts[1].equals(mountStr)) {
                    String dev = parts[0];
                    int slash = dev.lastIndexOf('/');
                    return slash >= 0 ? dev.substring(slash + 1) : dev;
                }
            }
        } catch (IOException ignored) {
            // fall through
        }
        return null;
    }

    private static boolean isMountPoint(Path path) {
        try {
            Path parent = path.getParent();
            if (parent == null) {
                return true;
            }
            return !Files.exists(parent) || !Files.getFileStore(path).equals(Files.getFileStore(parent));
        } catch (IOException e) {
            return path.getParent() == null;
        }
    }
}
