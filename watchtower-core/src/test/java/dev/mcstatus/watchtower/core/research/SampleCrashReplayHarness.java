package dev.mcstatus.watchtower.core.research;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.analyze.CrashClassifier;
import dev.mcstatus.watchtower.core.analyze.CrashNarrator;
import dev.mcstatus.watchtower.core.analyze.IncidentChainBuilder;
import dev.mcstatus.watchtower.core.collect.CrashReportParser;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Stream;

public final class SampleCrashReplayHarness {
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();
    private static final Pattern TIME_LINE = Pattern.compile("^Time:\\s*(.+)$", Pattern.MULTILINE);

    private SampleCrashReplayHarness() {}

    public static Path replay(Path sampleRoot, Path outDir) throws Exception {
        Path crashesDir = sampleRoot.resolve("crash-reports");
        if (!Files.isDirectory(crashesDir)) {
            crashesDir = sampleRoot; // allow flat dumps
        }
        List<Path> files = new ArrayList<>();
        try (Stream<Path> s = Files.list(crashesDir)) {
            s.filter(p -> p.getFileName().toString().endsWith(".txt"))
                    .sorted(Comparator.comparing(p -> p.getFileName().toString()))
                    .forEach(files::add);
        }
        JsonObject root = new JsonObject();
        root.addProperty("schema", "sample-gap-crash-replay-v1");
        root.addProperty("sample_root", sampleRoot.toString().replace('\\', '/'));
        root.addProperty("generated_at", Instant.now().toString());
        JsonArray crashes = new JsonArray();
        for (Path file : files) {
            String text = Files.readString(file, StandardCharsets.UTF_8);
            crashes.add(summaryRow(relativize(sampleRoot, file), text));
        }
        IncidentChainBuilder.link(crashes);
        CrashNarrator.enrichAfterChain(crashes);
        root.add("crashes", crashes);
        Files.createDirectories(outDir);
        Path out = outDir.resolve("crash-replay.json");
        Files.writeString(out, GSON.toJson(root), StandardCharsets.UTF_8);
        return out;
    }

    private static JsonObject summaryRow(String file, String text) {
        CrashReportParser.ParsedCrash parsed = CrashReportParser.parse(text, List.of());
        JsonObject report = new JsonObject();
        report.addProperty("file", file);
        parsed.applyTo(report);
        CrashClassifier.Classification c = CrashClassifier.classify(report);

        JsonObject row = new JsonObject();
        row.addProperty("file", file);
        String time = extractTime(text);
        if (time != null) {
            row.addProperty("time", time);
        }
        if (parsed.exception() != null) {
            row.addProperty("exception", parsed.exception());
        }
        if (parsed.description() != null) {
            row.addProperty("description", parsed.description());
        }
        if (parsed.summary() != null) {
            row.addProperty("summary", parsed.summary());
        }
        if (parsed.stackFrames() != null) {
            row.add("stack_frames", parsed.stackFrames());
        }
        row.addProperty("failure_kind", c.failureKind());
        row.addProperty("category", c.category());
        if (c.primaryModId() != null) {
            row.addProperty("primary_mod_id", c.primaryModId());
        }
        if (c.suspectModId() != null) {
            row.addProperty("suspect_mod_id", c.suspectModId());
        }
        CrashNarrator.Narrative narrative = CrashNarrator.narrate(report, new JsonArray());
        CrashNarrator.enrichSummary(row, narrative);
        return row;
    }

    private static String extractTime(String text) {
        Matcher m = TIME_LINE.matcher(text);
        if (!m.find()) {
            return null;
        }
        return m.group(1).trim().replace(' ', 'T');
    }

    private static String relativize(Path root, Path file) {
        try {
            return root.toAbsolutePath().relativize(file.toAbsolutePath()).toString().replace('\\', '/');
        } catch (Exception e) {
            return file.getFileName().toString();
        }
    }
}
