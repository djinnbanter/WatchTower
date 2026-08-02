package dev.mcstatus.watchtower.core.analyze;

import java.io.IOException;
import java.lang.management.ManagementFactory;
import java.lang.management.ThreadInfo;
import java.lang.management.ThreadMXBean;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.ZoneOffset;
import java.time.format.DateTimeFormatter;

/**
 * Writes a bounded plain-text hang dump under {@code watchtower/hangs/}.
 */
public final class HangDumpWriter {

    public static final long MAX_BYTES = 2L * 1024L * 1024L;
    private static final DateTimeFormatter FILE_TS =
            DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss").withZone(ZoneOffset.UTC);

    private HangDumpWriter() {
    }

    /**
     * @return relative path {@code watchtower/hangs/...} or null on failure
     */
    public static Path writeOnce(Path serverDir, String phase, long stallSeconds) {
        if (serverDir == null) {
            return null;
        }
        try {
            Path dir = serverDir.resolve("watchtower").resolve("hangs");
            Files.createDirectories(dir);
            String name = "hang-" + FILE_TS.format(Instant.now()) + ".txt";
            Path file = dir.resolve(name);
            StringBuilder sb = new StringBuilder(16_384);
            sb.append("WatchTower hang dump\n");
            sb.append("phase=").append(phase != null ? phase : "unknown").append('\n');
            sb.append("stall_seconds=").append(stallSeconds).append('\n');
            sb.append("captured_at=").append(Instant.now()).append('\n');
            sb.append('\n');
            ThreadMXBean bean = ManagementFactory.getThreadMXBean();
            ThreadInfo[] infos = bean.dumpAllThreads(false, false);
            if (infos != null) {
                for (ThreadInfo info : infos) {
                    if (info != null) {
                        sb.append(info.toString()).append('\n');
                    }
                }
            }
            byte[] bytes = sb.toString().getBytes(StandardCharsets.UTF_8);
            if (bytes.length > MAX_BYTES) {
                byte[] truncated = new byte[(int) MAX_BYTES];
                System.arraycopy(bytes, 0, truncated, 0, truncated.length);
                bytes = truncated;
            }
            Files.write(file, bytes);
            return Path.of("watchtower", "hangs", name);
        } catch (IOException | RuntimeException e) {
            return null;
        }
    }
}
