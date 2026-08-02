package dev.mcstatus.watchtower.core.research;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.analyze.CrashClassifier;
import dev.mcstatus.watchtower.core.analyze.CrashNarrator;
import dev.mcstatus.watchtower.core.collect.CrashReportParser;

import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Stream;

public final class SampleCrashReplayHarness {
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();

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
            CrashReportParser.ParsedCrash parsed = CrashReportParser.parse(text, List.of());
            JsonObject report = new JsonObject();
            report.addProperty("file", relativize(sampleRoot, file));
            parsed.applyTo(report);
            CrashClassifier.Classification c = CrashClassifier.classify(report);
            CrashNarrator.Narrative n = CrashNarrator.narrate(report, new JsonArray());
            JsonObject row = new JsonObject();
            row.addProperty("file", relativize(sampleRoot, file));
            row.addProperty("description", report.has("description") ? report.get("description").getAsString() : "");
            row.addProperty("exception", report.has("exception") ? report.get("exception").getAsString() : "");
            row.addProperty("failure_kind", c.failureKind());
            row.addProperty("category", c.category());
            row.addProperty("primary_mod_id", c.primaryModId());
            row.addProperty("suspect_mod_id", c.suspectModId());
            row.addProperty("plain_english", n.plainEnglish());
            row.addProperty("likely_cause", n.likelyCause());
            row.addProperty("confidence", n.confidence());
            row.add("fix_hints", n.fixHints());
            row.addProperty("manual_review", n.manualReview());
            crashes.add(row);
        }
        root.add("crashes", crashes);
        Files.createDirectories(outDir);
        Path out = outDir.resolve("crash-replay.json");
        Files.writeString(out, GSON.toJson(root), StandardCharsets.UTF_8);
        return out;
    }

    private static String relativize(Path root, Path file) {
        try {
            return root.toAbsolutePath().relativize(file.toAbsolutePath()).toString().replace('\\', '/');
        } catch (Exception e) {
            return file.getFileName().toString();
        }
    }
}
