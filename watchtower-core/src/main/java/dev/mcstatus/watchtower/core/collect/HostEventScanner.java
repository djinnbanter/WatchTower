package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * Host event scanning via journalctl with log fallbacks (ported from {@code scan_host_events}).
 */
public final class HostEventScanner {

    private HostEventScanner() {
    }

    public static void scanHostEvents(JsonObject staging, String since, double cutoff) {
        JsonArray kernelOomEvidence = new JsonArray();

        List<String> journalLines = readJournalLines(since);
        for (String line : journalLines) {
            parseHostEventLine(line, "journalctl", kernelOomEvidence, staging);
        }

        if (journalLines.isEmpty()) {
            for (String line : readHostLogFallbacks()) {
                parseHostEventLine(line, "host-log", kernelOomEvidence, staging);
            }
        }

        for (String line : readKernelJournal(since)) {
            String low = line.toLowerCase();
            if (LogPatterns.KERNEL_OOM.matcher(line).find() && !low.contains("containerd")) {
                String tsPart = line.length() > 25 ? line.substring(0, 25) : line;
                String detail = line.length() > 26 ? line.substring(26, Math.min(line.length(), 226)) : line;
                JsonObject ev = CollectSupport.evidence("journalctl-k", null, truncate(line, 300), tsPart);
                if (!containsEvidence(kernelOomEvidence, ev)) {
                    kernelOomEvidence.add(ev);
                    JsonObject event = new JsonObject();
                    event.addProperty("time", tsPart);
                    event.addProperty("type", "kernel_oom");
                    event.addProperty("source", "journal");
                    event.addProperty("detail", detail);
                    event.addProperty("importance", 10);
                    event.addProperty("verified", true);
                    JsonArray evArr = new JsonArray();
                    evArr.add(ev);
                    event.add("evidence", evArr);
                    CollectSupport.appendEvent(staging, event);
                }
            }
        }

        if (!hasEventType(staging, "reboot")) {
            JsonObject reboot = inferRebootFromUptime(cutoff);
            if (reboot != null) {
                CollectSupport.appendEvent(staging, reboot);
            }
        }

        staging.add("kernel_oom_evidence", kernelOomEvidence);
    }

    private static boolean hasEventType(JsonObject staging, String type) {
        JsonArray events = staging.getAsJsonArray("events");
        for (var el : events) {
            if (type.equals(CollectSupport.getString(el.getAsJsonObject(), "type"))) {
                return true;
            }
        }
        return false;
    }

    private static boolean containsEvidence(JsonArray arr, JsonObject target) {
        for (var el : arr) {
            if (el.equals(target)) {
                return true;
            }
        }
        return false;
    }

    private static JsonObject inferRebootFromUptime(double cutoff) {
        Path uptimePath = Path.of("/proc/uptime");
        if (!Files.isRegularFile(uptimePath)) {
            return null;
        }
        try {
            double uptimeSec = Double.parseDouble(Files.readString(uptimePath, StandardCharsets.UTF_8).split("\\s+")[0]);
            double bootTs = Instant.now().getEpochSecond() - uptimeSec;
            if (bootTs < cutoff) {
                return null;
            }
            ZonedDateTime bootDt = Instant.ofEpochSecond((long) bootTs).atZone(ZoneId.systemDefault());
            JsonObject event = new JsonObject();
            event.addProperty("time", CollectSupport.iso(bootDt));
            event.addProperty("type", "reboot");
            event.addProperty("source", "proc_uptime");
            event.addProperty("detail",
                    String.format("System boot inferred from /proc/uptime (uptime %.1fh)", uptimeSec / 3600.0));
            event.addProperty("importance", 10);
            return event;
        } catch (IOException | NumberFormatException e) {
            return null;
        }
    }

    private static void parseHostEventLine(
            String line,
            String sourceLabel,
            JsonArray kernelOomEvidence,
            JsonObject staging) {
        String low = line.toLowerCase();
        String tsPart = line.length() > 25 ? line.substring(0, 25) : line;
        String detail = line.length() > 26 ? line.substring(26, Math.min(line.length(), 226)) : truncate(line, 200);

        if (LogPatterns.KERNEL_OOM.matcher(line).find() && !low.contains("containerd")) {
            JsonObject ev = CollectSupport.evidence(sourceLabel, null, truncate(line, 300), tsPart);
            kernelOomEvidence.add(ev);
            JsonObject event = new JsonObject();
            event.addProperty("time", tsPart);
            event.addProperty("type", "kernel_oom");
            event.addProperty("source", "journal");
            event.addProperty("detail", detail);
            event.addProperty("importance", 10);
            event.addProperty("verified", true);
            JsonArray evArr = new JsonArray();
            evArr.add(ev);
            event.add("evidence", evArr);
            CollectSupport.appendEvent(staging, event);
        } else if (LogPatterns.REBOOT_LINE.matcher(line).find()) {
            JsonObject event = new JsonObject();
            event.addProperty("time", tsPart);
            event.addProperty("type", "reboot");
            event.addProperty("source", "journal");
            event.addProperty("detail", detail);
            event.addProperty("importance", 10);
            CollectSupport.appendEvent(staging, event);
        } else if (LogPatterns.CRON_SESSION.matcher(line).find() || LogPatterns.SESSION_SUDO.matcher(line).find()) {
            return;
        } else if (LogPatterns.SESSION_SU_CRAFTY.matcher(line).find()) {
            JsonObject event = new JsonObject();
            event.addProperty("time", tsPart);
            event.addProperty("type", "session_close");
            event.addProperty("subtype", "su_crafty");
            event.addProperty("source", "journal");
            event.addProperty("detail", detail);
            event.addProperty("importance", 9);
            JsonArray evArr = new JsonArray();
            evArr.add(CollectSupport.evidence(sourceLabel, null, truncate(line, 300), tsPart));
            event.add("evidence", evArr);
            CollectSupport.appendEvent(staging, event);
        } else if (LogPatterns.SESSION_SSHD.matcher(line).find()) {
            JsonObject event = new JsonObject();
            event.addProperty("time", tsPart);
            event.addProperty("type", "session_close");
            event.addProperty("subtype", "sshd");
            event.addProperty("source", "journal");
            event.addProperty("detail", detail);
            event.addProperty("importance", 9);
            JsonArray evArr = new JsonArray();
            evArr.add(CollectSupport.evidence(sourceLabel, null, truncate(line, 300), tsPart));
            event.add("evidence", evArr);
            CollectSupport.appendEvent(staging, event);
        }
    }

    private static String truncate(String s, int max) {
        return s.length() > max ? s.substring(0, max) : s;
    }

    private static List<String> readJournalLines(String since) {
        return runJournalctl(List.of("journalctl", "--since", since, "-o", "short-iso", "--no-pager"));
    }

    private static List<String> readKernelJournal(String since) {
        return runJournalctl(List.of("journalctl", "-k", "--since", since, "-o", "short-iso", "--no-pager"));
    }

    private static List<String> runJournalctl(List<String> cmd) {
        try {
            Process proc = new ProcessBuilder(cmd).redirectErrorStream(false).start();
            proc.getErrorStream().close();
            if (!proc.waitFor(30, TimeUnit.SECONDS)) {
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
        for (String path : LogPatterns.HOST_LOG_FALLBACKS) {
            Path p = Path.of(path);
            if (!Files.isRegularFile(p)) {
                continue;
            }
            try {
                lines.addAll(Files.readAllLines(p, StandardCharsets.UTF_8));
            } catch (IOException ignored) {
                // skip
            }
        }
        return lines;
    }
}
