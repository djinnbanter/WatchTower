package dev.mcstatus.watchtower.cli;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.WatchtowerFiles;
import dev.mcstatus.watchtower.core.collect.ForensicsFindService;
import dev.mcstatus.watchtower.core.collect.JarClassIndex;
import dev.mcstatus.watchtower.core.collect.ModJarMetadataReader;
import dev.mcstatus.watchtower.core.ops.OpsCacheWriter;
import dev.mcstatus.watchtower.core.report.DrBundlePackager;
import dev.mcstatus.watchtower.core.report.DrLogAnchorFinder;
import dev.mcstatus.watchtower.core.report.DrLogCorrelation;
import dev.mcstatus.watchtower.core.report.DrLogFileSelector;
import dev.mcstatus.watchtower.core.report.DrModListDiffAnalyzer;
import dev.mcstatus.watchtower.core.report.ForensicsZipUtil;
import dev.mcstatus.watchtower.core.report.ReportConfig;
import dev.mcstatus.watchtower.core.report.ReportEngine;
import dev.mcstatus.watchtower.core.report.ReportPreset;

import java.io.IOException;
import java.nio.file.FileVisitResult;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.SimpleFileVisitor;
import java.nio.file.attribute.BasicFileAttributes;
import java.util.ArrayList;
import java.util.List;

/**
 * Headless CLI entry point for disaster-recovery reports.
 */
public final class DrCliMain {

    private DrCliMain() {
    }

    public static void main(String[] args) {
        int exit = run(args);
        System.exit(exit);
    }

    static int run(String[] args) {
        if (args.length == 0 || isHelp(args[0])) {
            printUsage();
            return args.length == 0 ? 1 : 0;
        }

        if ("dr".equalsIgnoreCase(args[0])) {
            return runDr(args);
        }
        if ("report".equalsIgnoreCase(args[0])) {
            return runReport(args);
        }
        if ("forensics".equalsIgnoreCase(args[0])) {
            return runForensics(args);
        }
        if ("rules".equalsIgnoreCase(args[0])) {
            return runRules(args);
        }

        System.err.println("Unknown command: " + args[0]);
        printUsage();
        return 1;
    }

    private static int runDr(String[] args) {
        DrOptions options;
        try {
            options = DrOptions.parse(args, 1);
        } catch (DrOptions.HelpRequested e) {
            printDrUsage();
            return 0;
        } catch (IllegalArgumentException e) {
            System.err.println(e.getMessage());
            printDrUsage();
            return 1;
        }

        Path serverDir = Path.of(options.serverDir()).toAbsolutePath().normalize();
        if (!Files.isDirectory(serverDir)) {
            System.err.println("Server directory not found: " + serverDir);
            return 1;
        }

        Path outDir = options.outputDir();
        try {
            Files.createDirectories(outDir);
        } catch (IOException e) {
            System.err.println("Cannot create output directory: " + outDir + " — " + e.getMessage());
            return 1;
        }

        DrLogAnchorFinder.AnchorSelection anchorSel = DrLogAnchorFinder.resolve(serverDir, options.minutes());
        List<String> preWarnings = new ArrayList<>();
        if (!anchorSel.anchor().found()) {
            preWarnings.add("No successful server start found in logs — using " + options.minutes()
                    + " minute fallback window.");
        }

        System.out.println("Server: " + serverDir);
        if (options.zipFile() != null) {
            System.out.println("Output zip (host filesystem): " + options.zipFile());
        } else {
            System.out.println("Output directory (host filesystem): " + outDir);
            System.out.println("Zip file: watchtower-dr-bundle-<timestamp>.zip in that folder");
            if (options.outExplicit()) {
                System.out.println("  Download the zip from this path via SFTP or your panel — not from the Minecraft server folder.");
            }
        }
        if (anchorSel.anchor().found()) {
            System.out.println("Selection: since_last_successful_start (anchor: "
                    + anchorSel.anchor().anchorTime() + ")");
        } else {
            System.out.println("Selection: since_last_successful_start (anchor not found — "
                    + options.minutes() + "m fallback)");
        }
        for (String w : preWarnings) {
            System.out.println("Warning: " + w);
        }
        System.out.println();

        ReportConfig config;
        try {
            config = DrReportConfig.forServer(serverDir, options.minutes(), anchorSel.windowStart());
        } catch (IOException e) {
            System.err.println("Failed to load report config: " + e.getMessage());
            return 1;
        }

        Path workDir;
        try {
            workDir = Files.createTempDirectory("watchtower-dr-work-");
        } catch (IOException e) {
            System.err.println("Cannot create temp work directory: " + e.getMessage());
            return 1;
        }

        try {
            ReportEngine.ReportResult result = ReportEngine.run(config, workDir);
            if (!result.success()) {
                System.err.println(result.message());
                return 1;
            }

            DrLogFileSelector.DrLogSelection selection = DrLogFileSelector.select(serverDir, options.minutes());
            DrLogCorrelation.CorrelationResult correlation = DrLogCorrelation.correlate(selection);
            DrModListDiffAnalyzer.ModDiffResult modDiff = DrModListDiffAnalyzer.analyze(selection);

            JsonObject facts = result.facts();
            List<String> warnings = new ArrayList<>(preWarnings);
            Path zipPath = DrBundlePackager.resolveZipPath(outDir, options.zipFile());

            DrBundlePackager.enrichFacts(facts, selection, correlation, modDiff, zipPath, warnings);
            DrBundlePackager.rewriteFacts(result.factsPath(), facts);

            DrBundlePackager.BundleResult bundle = DrBundlePackager.packageBundle(
                    outDir,
                    options.zipFile(),
                    serverDir,
                    result.factsPath(),
                    result.briefPath(),
                    facts,
                    selection,
                    correlation);

            System.out.println("DR report completed.");
            System.out.println("Bundle: " + bundle.zipPath() + " (" + ForensicsZipUtil.formatSize(bundle.sizeBytes()) + ")");
            System.out.println("Upload this zip to the Watchtower DR viewer.");
            for (String w : bundle.warnings()) {
                if (!warnings.contains(w)) {
                    System.out.println("Warning: " + w);
                }
            }
            System.out.println();
            System.out.print(DrBundlePackager.formatCorrelationSummary(selection, correlation));
            return 0;
        } catch (IOException e) {
            System.err.println("Failed to create DR bundle: " + e.getMessage());
            return 1;
        } finally {
            deleteRecursive(workDir);
        }
    }

    private static int runReport(String[] args) {
        ReportCliOptions options;
        try {
            options = ReportCliOptions.parse(args, 1);
        } catch (ReportCliOptions.HelpRequested e) {
            printReportUsage();
            return 0;
        } catch (IllegalArgumentException e) {
            System.err.println(e.getMessage());
            printReportUsage();
            return 1;
        }

        Path serverDir = options.serverDir();
        if (!Files.isDirectory(serverDir)) {
            System.err.println("Server directory not found: " + serverDir);
            return 1;
        }

        Path reportDir = serverDir.resolve("watchtower").normalize();
        try {
            Files.createDirectories(reportDir);
        } catch (IOException e) {
            System.err.println("Cannot create report directory: " + reportDir + " — " + e.getMessage());
            return 1;
        }

        ReportConfig config;
        try {
            config = HeadlessReportConfig.forPreset(
                    serverDir,
                    options.preset(),
                    options.lookbackHours(),
                    options.incremental());
        } catch (IOException e) {
            System.err.println("Failed to load report config: " + e.getMessage());
            return 1;
        }

        System.out.println("Server: " + serverDir);
        System.out.println("Preset: " + options.preset().name().toLowerCase()
                + " (lookback " + config.lookbackHours() + "h, incremental=" + config.incremental() + ")");
        System.out.println("Report directory: " + reportDir);
        System.out.println();

        ReportEngine.ReportResult result = ReportEngine.run(config, reportDir);
        if (!result.success()) {
            System.err.println(result.message());
            return 1;
        }

        if (result.facts() != null) {
            try {
                Path opsCachePath = reportDir.resolve(WatchtowerFiles.OPS_CACHE_FILENAME);
                Path rollupsPath = reportDir.resolve("performance-rollups.json");
                Path statePath = Path.of(config.stateFile());
                OpsCacheWriter.reconcileFromFacts(
                        opsCachePath, statePath, rollupsPath, result.facts(), config.lookbackHours());
            } catch (IOException e) {
                System.err.println("Warning: ops cache reconcile failed — " + e.getMessage());
            }
        }

        System.out.println("Report completed.");
        if (result.briefPath() != null) {
            System.out.println("Brief: " + result.briefPath());
        }
        if (result.factsPath() != null) {
            System.out.println("Facts: " + result.factsPath());
        }
        if (options.preset() == ReportPreset.PANEL) {
            System.out.println();
            System.out.println("Panel cron example (daily 04:00):");
            System.out.println("  0 4 * * * cd " + serverDir + " && java -jar watchtower-cli.jar report --preset panel");
        }
        return 0;
    }

    private static void deleteRecursive(Path root) {
        if (root == null || !Files.exists(root)) {
            return;
        }
        try {
            Files.walkFileTree(root, new SimpleFileVisitor<>() {
                @Override
                public FileVisitResult visitFile(Path file, BasicFileAttributes attrs) throws IOException {
                    Files.deleteIfExists(file);
                    return FileVisitResult.CONTINUE;
                }

                @Override
                public FileVisitResult postVisitDirectory(Path dir, IOException exc) throws IOException {
                    Files.deleteIfExists(dir);
                    return FileVisitResult.CONTINUE;
                }
            });
        } catch (IOException ignored) {
        }
    }

    private static boolean isHelp(String arg) {
        return "--help".equals(arg) || "-h".equals(arg) || "help".equalsIgnoreCase(arg);
    }

    private static void printUsage() {
        System.out.println("""
                Watchtower CLI — headless reports

                  java -jar watchtower-cli.jar dr [options]       Disaster recovery bundle
                  java -jar watchtower-cli.jar report [options]   Health report (live mode)
                  java -jar watchtower-cli.jar forensics <cmd>    Mod forensics (find-class / find-package)
                  java -jar watchtower-cli.jar rules <cmd>        Crash rule packs (validate / list)

                Run with --help on either command for details.
                """);
    }

    private static int runRules(String[] args) {
        if (args.length < 2 || isHelp(args[1])) {
            printRulesUsage();
            return args.length < 2 ? 1 : 0;
        }
        String sub = args[1];
        if ("validate".equalsIgnoreCase(sub)) {
            String file = null;
            for (int i = 2; i < args.length; i++) {
                if (!args[i].startsWith("-") && file == null) {
                    file = args[i];
                } else if (isHelp(args[i])) {
                    printRulesUsage();
                    return 0;
                }
            }
            if (file == null) {
                System.err.println("Missing YAML file path");
                printRulesUsage();
                return 1;
            }
            Path path = Path.of(file).toAbsolutePath().normalize();
            if (!Files.isRegularFile(path)) {
                System.err.println("File not found: " + path);
                return 1;
            }
            try {
                String yaml = Files.readString(path);
                var result = dev.mcstatus.watchtower.core.rules.CrashRuleSchema.validate(yaml);
                if (result.valid()) {
                    System.out.println("OK: " + path.getFileName() + " is a valid crash rule pack");
                    return 0;
                }
                System.err.println("INVALID: " + path);
                for (String e : result.errors()) {
                    System.err.println("  - " + e);
                }
                return 2;
            } catch (IOException e) {
                System.err.println("Read failed: " + e.getMessage());
                return 1;
            }
        }
        if ("list".equalsIgnoreCase(sub)) {
            String server = ".";
            for (int i = 2; i < args.length; i++) {
                if ("--server".equals(args[i]) && i + 1 < args.length) {
                    server = args[++i];
                } else if (isHelp(args[i])) {
                    printRulesUsage();
                    return 0;
                }
            }
            Path serverDir = Path.of(server).toAbsolutePath().normalize();
            var reg = dev.mcstatus.watchtower.core.rules.CrashRuleRegistry.load(serverDir, true, true);
            System.out.println("Packs (" + reg.packs().size() + "):");
            for (var pack : reg.packs()) {
                System.out.println("  " + pack.id() + "  priority=" + pack.priority()
                        + (pack.builtin() ? "  [builtin]" : "  [operator]")
                        + "  rules=" + pack.rules().size());
                for (var rule : pack.rules()) {
                    System.out.println("    - " + rule.id() + " (p=" + rule.priority() + ")");
                }
            }
            for (String w : reg.warnings()) {
                System.err.println("WARN: " + w);
            }
            return 0;
        }
        System.err.println("Unknown rules command: " + sub);
        printRulesUsage();
        return 1;
    }

    private static void printRulesUsage() {
        System.out.println("""
                watchtower rules — declarative crash rule packs

                  java -jar watchtower-cli.jar rules validate <file.yaml>
                  java -jar watchtower-cli.jar rules list [--server <path>]

                Operator packs live in config/watchtower/rules/*.yaml
                Builtin packs ship inside the JAR under builtin-rules/
                """);
    }

    private static int runForensics(String[] args) {
        if (args.length < 2 || isHelp(args[1])) {
            printForensicsUsage();
            return args.length < 2 ? 1 : 0;
        }
        String sub = args[1];
        String server = ".";
        String query = null;
        String mode = "prefix";
        boolean includeNested = true;
        for (int i = 2; i < args.length; i++) {
            String a = args[i];
            if ("--server".equals(a) && i + 1 < args.length) {
                server = args[++i];
            } else if ("--mode".equals(a) && i + 1 < args.length) {
                mode = args[++i];
            } else if ("--no-nested".equals(a)) {
                includeNested = false;
            } else if (!a.startsWith("-") && query == null) {
                query = a;
            } else if (isHelp(a)) {
                printForensicsUsage();
                return 0;
            }
        }
        if (query == null || query.isBlank()) {
            System.err.println("Missing class/package query");
            printForensicsUsage();
            return 1;
        }
        Path serverDir = Path.of(server).toAbsolutePath().normalize();
        if (!Files.isDirectory(serverDir)) {
            System.err.println("Server directory not found: " + serverDir);
            return 1;
        }
        try {
            ReportConfig config = ReportConfig.builder()
                    .serverDir(serverDir.toString())
                    .modForensicsScan(true)
                    .build();
            Path modsDir = serverDir.resolve("mods");
            Path cache = JarClassIndex.defaultCachePath(serverDir.toString());
            JsonArray mods = ModJarMetadataReader.listModsFromDir(serverDir.toString());
            JsonObject result;
            if ("find-class".equalsIgnoreCase(sub)) {
                result = ForensicsFindService.findClass(config, modsDir, mods, cache, query, includeNested);
            } else if ("find-package".equalsIgnoreCase(sub)) {
                result = ForensicsFindService.findPackage(config, modsDir, mods, cache, query, mode);
            } else {
                System.err.println("Unknown forensics command: " + sub);
                printForensicsUsage();
                return 1;
            }
            System.out.println(result);
            return 0;
        } catch (IOException e) {
            System.err.println("Forensics failed: " + e.getMessage());
            return 1;
        }
    }

    private static void printForensicsUsage() {
        System.out.println("""
                watchtower forensics — class/package owning-jar lookup

                  java -jar watchtower-cli.jar forensics find-class <ClassName> [--server <path>] [--no-nested]
                  java -jar watchtower-cli.jar forensics find-package <package> [--server <path>] [--mode prefix|exact_package]
                """);
    }

    private static void printReportUsage() {
        System.out.println("""
                watchtower report — headless health report

                  java -jar watchtower-cli.jar report --server /path/to/server --preset full

                Presets:
                  quick   6h lookback, incremental (post-incident)
                  full    24h lookback, full audit (default)
                  panel   24h lookback for panel cron (server may be stopped)

                Options:
                  --server <path>     Server directory (default: current directory)
                  --preset <name>     quick | full | panel (default: full)
                  --lookback <hours>  Override lookback hours (1–720)
                  --incremental       Force incremental window
                  --no-incremental    Force full window
                  --help              Show this help
                """);
    }

    private static void printDrUsage() {
        System.out.println("""
                ═══════════════════════════════════════════════════════════════
                  Watchtower DR — your server won't boot? Start here.
                ═══════════════════════════════════════════════════════════════

                STEP 1 — SSH into your game server and open a terminal

                  Go to your server's mods folder, then run:

                    cd /path/to/your/server/mods
                    java -jar watchtower-cli-1.0.0.jar dr

                STEP 2 — Upload the zip to the Watchtower DR viewer

                  You get ONE file: watchtower-dr-bundle-<timestamp>.zip
                  By default it lands in the folder you're in (usually mods/).

                ───────────────────────────────────────────────────────────────
                Panel won't let you save files?  Use --out on the HOST:

                    java -jar watchtower-cli-1.0.0.jar dr --out /tmp

                  /tmp = Linux temp folder on the same machine as SSH.
                  It is NOT inside your Minecraft server directory.
                  Download the zip from /tmp with SFTP or your panel file manager.

                  Windows host?  Try:  --out %TEMP%
                  Or pick any path:  --out ~/dr-bundle.zip

                ───────────────────────────────────────────────────────────────
                Options (only if you need them)

                  --server <path>   Server folder (auto when run from mods/)
                  --out <dir>       Write zip to this folder on the host
                  --out <file.zip>  Exact zip path on the host
                  --minutes <n>     Log fallback window in minutes (default 1440)
                  --help            Show this help
                """);
    }
}
