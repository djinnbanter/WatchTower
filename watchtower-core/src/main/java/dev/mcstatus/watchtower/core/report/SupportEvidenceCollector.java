package dev.mcstatus.watchtower.core.report;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.collect.GzipLineReader;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;

/**
 * Collects log / crash / boot evidence for support packs without loading whole files into memory
 * when only a tail is needed.
 */
public final class SupportEvidenceCollector {

    public record CollectedText(String zipName, String content, long bytes, String skipReason) {
        public static CollectedText ok(String zipName, String content) {
            byte[] raw = content.getBytes(StandardCharsets.UTF_8);
            return new CollectedText(zipName, content, raw.length, null);
        }

        public static CollectedText skipped(String zipName, String reason) {
            return new CollectedText(zipName, null, 0, reason);
        }
    }

    public record CollectedFile(String zipName, Path path, long bytes, String skipReason) {
        public static CollectedFile ok(String zipName, Path path, long bytes) {
            return new CollectedFile(zipName, path, bytes, null);
        }

        public static CollectedFile skipped(String zipName, String reason) {
            return new CollectedFile(zipName, null, 0, reason);
        }
    }

    public record BudgetState(long usedBytes, long softBudget, long hardBudget, List<JsonObject> omissions) {
        public BudgetState withUsed(long next) {
            return new BudgetState(next, softBudget, hardBudget, omissions);
        }

        public void omit(String file, String reason) {
            JsonObject o = new JsonObject();
            o.addProperty("file", file);
            o.addProperty("reason", reason);
            omissions.add(o);
        }

        public boolean softExceeded() {
            return usedBytes > softBudget;
        }

        public boolean canFit(long size) {
            return usedBytes + size <= hardBudget;
        }
    }

    private SupportEvidenceCollector() {
    }

    public static BudgetState newBudget(SupportComposeOptions options) {
        long hard = options != null ? options.maxZipEvidenceBytes() : SupportComposeOptions.HARD_BUDGET_BYTES;
        return new BudgetState(0, SupportComposeOptions.SOFT_BUDGET_BYTES, hard, new ArrayList<>());
    }

    public static String tailLines(Path file, int maxLines) throws IOException {
        if (file == null || !Files.isRegularFile(file) || maxLines <= 0) {
            return "";
        }
        Deque<String> ring = new ArrayDeque<>(Math.min(maxLines, 10_000));
        GzipLineReader.forEachLine(file, (lineNo, line) -> {
            if (ring.size() >= maxLines) {
                ring.removeFirst();
            }
            ring.addLast(line);
        });
        return String.join("\n", ring) + (ring.isEmpty() ? "" : "\n");
    }

    public static String headAndTail(Path file, int headLines, int tailLines) throws IOException {
        if (file == null || !Files.isRegularFile(file)) {
            return "";
        }
        List<String> head = new ArrayList<>(Math.max(0, headLines));
        Deque<String> tail = new ArrayDeque<>(Math.max(1, tailLines));
        int[] count = {0};
        GzipLineReader.forEachLine(file, (lineNo, line) -> {
            count[0]++;
            if (head.size() < headLines) {
                head.add(line);
            }
            if (tail.size() >= tailLines) {
                tail.removeFirst();
            }
            tail.addLast(line);
        });
        StringBuilder sb = new StringBuilder();
        sb.append("=== HEAD (").append(head.size()).append(" lines) ===\n");
        for (String line : head) {
            sb.append(line).append('\n');
        }
        if (count[0] > headLines + tailLines) {
            sb.append("\n=== … truncated … ===\n\n");
        }
        sb.append("=== TAIL (").append(tail.size()).append(" lines) ===\n");
        for (String line : tail) {
            sb.append(line).append('\n');
        }
        return sb.toString();
    }

    public static CollectedText collectLog(
            Path serverDir,
            SupportComposeOptions.LogSelection sel,
            long maxBytesTotal,
            BudgetState budget
    ) throws IOException {
        if (sel == null || sel.mode() == SupportComposeOptions.LogMode.OFF) {
            return CollectedText.skipped("evidence/logs/" + (sel != null ? sel.file() : "unknown"), "off");
        }
        if (!SupportSafePaths.isSafeBasename(sel.file())) {
            return CollectedText.skipped("evidence/logs/" + sel.file(), "unsafe_name");
        }
        Path logsDir = serverDir.resolve("logs");
        Path path = SupportSafePaths.resolveBasename(logsDir, sel.file());
        if (path == null || !Files.isRegularFile(path)) {
            return CollectedText.skipped("evidence/logs/" + sel.file(), "not_found");
        }
        String zipName = "evidence/logs/" + sel.file();
        String content;
        if (sel.mode() == SupportComposeOptions.LogMode.FULL) {
            long size = Files.size(path);
            if (size > maxBytesTotal) {
                content = SupportRedactor.redactText(tailLines(path, Math.max(sel.tailLines(), 2000)));
                budget.omit(zipName, "too_large_fell_back_to_tail");
            } else if (!budget.canFit(size)) {
                content = SupportRedactor.redactText(tailLines(path, Math.max(sel.tailLines(), 2000)));
                budget.omit(zipName, "budget_fell_back_to_tail");
            } else {
                content = SupportRedactor.redactText(Files.readString(path, StandardCharsets.UTF_8));
            }
        } else {
            content = SupportRedactor.redactText(tailLines(path, sel.tailLines() > 0 ? sel.tailLines() : 2000));
        }
        long bytes = content.getBytes(StandardCharsets.UTF_8).length;
        if (!budget.canFit(bytes)) {
            budget.omit(zipName, "budget");
            return CollectedText.skipped(zipName, "budget");
        }
        return CollectedText.ok(zipName, content);
    }

    public static CollectedText collectBootExcerpt(Path serverDir, BudgetState budget) throws IOException {
        Path latest = serverDir.resolve("logs").resolve("latest.log");
        if (!Files.isRegularFile(latest)) {
            return CollectedText.skipped("evidence/logs-boot-excerpt.txt", "not_found");
        }
        String content = SupportRedactor.redactText(headAndTail(latest, 500, 500));
        long bytes = content.getBytes(StandardCharsets.UTF_8).length;
        if (!budget.canFit(bytes)) {
            budget.omit("evidence/logs-boot-excerpt.txt", "budget");
            return CollectedText.skipped("evidence/logs-boot-excerpt.txt", "budget");
        }
        return CollectedText.ok("evidence/logs-boot-excerpt.txt", content);
    }

    public static List<CollectedFile> collectCrashes(
            Path serverDir,
            SupportComposeOptions options,
            BudgetState budget
    ) throws IOException {
        List<CollectedFile> out = new ArrayList<>();
        Path crashDir = serverDir.resolve("crash-reports");
        if (!Files.isDirectory(crashDir)) {
            return out;
        }
        List<String> names = new ArrayList<>();
        if (options.crashFiles() != null && !options.crashFiles().isEmpty()) {
            names.addAll(options.crashFiles());
        } else if (options.crashLastN() > 0) {
            try (var stream = Files.list(crashDir)) {
                stream.filter(Files::isRegularFile)
                        .filter(p -> p.getFileName().toString().endsWith(".txt"))
                        .sorted((a, b) -> Long.compare(mtime(b), mtime(a)))
                        .limit(options.crashLastN())
                        .map(p -> p.getFileName().toString())
                        .forEach(names::add);
            }
        }
        int limit = options.maxCrashFiles() > 0 ? options.maxCrashFiles() : names.size();
        int attached = 0;
        for (String name : names) {
            if (attached >= limit) {
                break;
            }
            String bare = name.startsWith("crash-reports/") ? name.substring("crash-reports/".length()) : name;
            if (!SupportSafePaths.isSafeBasename(bare)) {
                out.add(CollectedFile.skipped("evidence/crashes/" + bare, "unsafe_name"));
                continue;
            }
            Path path = SupportSafePaths.resolveBasename(crashDir, bare);
            if (path == null || !Files.isRegularFile(path)) {
                out.add(CollectedFile.skipped("evidence/crashes/" + bare, "not_found"));
                continue;
            }
            long size = Files.size(path);
            String zipName = "evidence/crashes/" + bare;
            if (size > options.maxCrashBytesEach()) {
                // Attach truncated redacted text instead
                byte[] raw = Files.readAllBytes(path);
                int cap = (int) Math.min(raw.length, options.maxCrashBytesEach());
                String text = SupportRedactor.redactText(new String(raw, 0, cap, StandardCharsets.UTF_8));
                // Represent as text via a sentinel: caller handles text extras separately
                out.add(new CollectedFile(zipName + ".truncated.txt", null, text.getBytes(StandardCharsets.UTF_8).length, "truncated:" + text));
                attached++;
                continue;
            }
            if (!budget.canFit(size)) {
                budget.omit(zipName, "budget");
                out.add(CollectedFile.skipped(zipName, "budget"));
                continue;
            }
            out.add(CollectedFile.ok(zipName, path, size));
            attached++;
        }
        return out;
    }

    public static List<CollectedFile> collectSpark(
            Path serverDir,
            Path sparkDir,
            SupportComposeOptions options,
            BudgetState budget
    ) throws IOException {
        List<CollectedFile> out = new ArrayList<>();
        if (sparkDir == null || !Files.isDirectory(sparkDir)) {
            return out;
        }
        List<Path> profiles = new ArrayList<>();
        if (options.sparkPaths() != null && !options.sparkPaths().isEmpty()) {
            for (String rel : options.sparkPaths()) {
                Path p = SupportSafePaths.resolveUnder(serverDir, rel);
                if (p != null && Files.isRegularFile(p) && p.getFileName().toString().endsWith(".sparkprofile")) {
                    profiles.add(p);
                }
            }
        } else {
            try (var stream = Files.list(sparkDir)) {
                stream.filter(p -> p.getFileName().toString().endsWith(".sparkprofile"))
                        .sorted((a, b) -> Long.compare(mtime(b), mtime(a)))
                        .forEach(profiles::add);
            }
        }
        StringBuilder listing = new StringBuilder();
        for (Path profile : profiles) {
            long size = Files.size(profile);
            listing.append(profile.getFileName()).append(" (")
                    .append(ForensicsZipUtil.formatSize(size)).append(")\n");
            // Never attach raw .sparkprofile bytes — protobuf cannot be scrubbed for secrets.
            budget.omit("evidence/spark/" + profile.getFileName(), "binary_unredactable");
        }
        if (!listing.isEmpty()) {
            out.add(new CollectedFile("spark-profiles.txt", null, listing.length(), "listing:" + listing));
        }
        return out;
    }

    private static long mtime(Path p) {
        try {
            return Files.getLastModifiedTime(p).toMillis();
        } catch (IOException e) {
            return 0L;
        }
    }

    public static JsonArray omissionsArray(BudgetState budget) {
        JsonArray arr = new JsonArray();
        for (JsonObject o : budget.omissions()) {
            arr.add(o);
        }
        return arr;
    }
}
