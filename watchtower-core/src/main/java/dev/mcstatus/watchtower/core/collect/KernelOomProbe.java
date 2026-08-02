package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * Probes kernel / host logs for OOM-killer evidence (journalctl -k, kern.log, dmesg).
 * Used by external-kill post-mortem detection — does not require a Minecraft crash report.
 */
public final class KernelOomProbe {

    private static final int TIMEOUT_SEC = 5;
    private static final int MAX_EVIDENCE = 20;

    private KernelOomProbe() {
    }

    /**
     * @param readable whether any kernel/host log source returned lines (even without OOM matches)
     * @param evidence matching {@link LogPatterns#KERNEL_OOM} lines
     */
    public record Result(boolean readable, JsonArray evidence) {
        public static Result empty() {
            return new Result(false, new JsonArray());
        }
    }

    /**
     * Probe kernel logs since {@code sinceIso} (ISO-8601 or journalctl --since string).
     * All failures are swallowed — returns {@link Result#empty()} when nothing is readable.
     */
    public static Result probe(String sinceIso) {
        String since = sinceIso != null && !sinceIso.isBlank() ? sinceIso : "1 hour ago";
        List<String> lines = runJournalctl(List.of(
                "journalctl", "-k", "--since", since, "-o", "short-iso", "--no-pager"));
        String source = "journalctl-k";

        if (lines.isEmpty()) {
            lines = readHostLogFallbacks();
            source = "host-log";
        }
        if (lines.isEmpty()) {
            lines = runDmesg();
            source = "dmesg";
        }
        if (lines.isEmpty()) {
            return Result.empty();
        }

        JsonArray evidence = new JsonArray();
        for (String line : lines) {
            if (line == null || line.isBlank()) {
                continue;
            }
            String low = line.toLowerCase();
            if (low.contains("containerd")) {
                continue;
            }
            if (!LogPatterns.KERNEL_OOM.matcher(line).find()) {
                continue;
            }
            String tsPart = line.length() > 25 ? line.substring(0, 25) : line;
            JsonObject ev = CollectSupport.evidence(source, null, truncate(line, 300), tsPart);
            evidence.add(ev);
            if (evidence.size() >= MAX_EVIDENCE) {
                break;
            }
        }
        return new Result(true, evidence);
    }

    private static List<String> runJournalctl(List<String> cmd) {
        return runProcess(cmd);
    }

    private static List<String> runDmesg() {
        return runProcess(List.of("dmesg", "-T"));
    }

    private static List<String> runProcess(List<String> cmd) {
        try {
            Process proc = new ProcessBuilder(cmd).redirectErrorStream(false).start();
            proc.getErrorStream().close();
            if (!proc.waitFor(TIMEOUT_SEC, TimeUnit.SECONDS)) {
                proc.destroyForcibly();
                return List.of();
            }
            List<String> lines = new ArrayList<>();
            try (var reader = new BufferedReader(new InputStreamReader(proc.getInputStream(), StandardCharsets.UTF_8))) {
                String line;
                while ((line = reader.readLine()) != null) {
                    if (!line.isBlank()) {
                        lines.add(line);
                    }
                }
            }
            return lines;
        } catch (IOException | InterruptedException e) {
            if (e instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            return List.of();
        }
    }

    private static List<String> readHostLogFallbacks() {
        List<String> lines = new ArrayList<>();
        for (String path : List.of("/var/log/kern.log", "/var/log/syslog")) {
            Path p = Path.of(path);
            if (!Files.isRegularFile(p)) {
                continue;
            }
            try {
                List<String> all = Files.readAllLines(p, StandardCharsets.UTF_8);
                int start = Math.max(0, all.size() - 500);
                lines.addAll(all.subList(start, all.size()));
            } catch (IOException ignored) {
                // skip
            }
        }
        return lines;
    }

    private static String truncate(String s, int max) {
        if (s == null) {
            return "";
        }
        return s.length() > max ? s.substring(0, max) : s;
    }
}
