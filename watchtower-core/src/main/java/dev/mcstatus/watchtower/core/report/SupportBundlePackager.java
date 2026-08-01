package dev.mcstatus.watchtower.core.report;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;
import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.WatchtowerFiles;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.zip.ZipOutputStream;

/**
 * Packages a support zip: manifest v4, recipe, environment, facts/brief, ops, extras.
 */
public final class SupportBundlePackager {

    public static final int BUNDLE_VERSION = 4;
    private static final Gson GSON = new GsonBuilder().setPrettyPrinting().create();

    public record ExtraEntry(String zipName, Path filePath, String textContent) {
        public static ExtraEntry file(String zipName, Path filePath) {
            return new ExtraEntry(zipName, filePath, null);
        }

        public static ExtraEntry text(String zipName, String text) {
            return new ExtraEntry(zipName, null, text);
        }
    }

    public record PackageRequest(
            Path outDir,
            Path factsPath,
            Path briefPath,
            Path opsCachePath,
            Path rollupsPath,
            List<ExtraEntry> extras,
            boolean composed,
            SupportComposeOptions options,
            JsonObject environment,
            JsonArray evidenceFiles,
            JsonArray omissions,
            String zipTimestamp,
            String opsCacheRedactedJson,
            JsonObject qualityGate
    ) {
        public PackageRequest(
                Path outDir,
                Path factsPath,
                Path briefPath,
                Path opsCachePath,
                Path rollupsPath,
                List<ExtraEntry> extras,
                boolean composed,
                SupportComposeOptions options,
                JsonObject environment,
                JsonArray evidenceFiles,
                JsonArray omissions,
                String zipTimestamp,
                String opsCacheRedactedJson
        ) {
            this(outDir, factsPath, briefPath, opsCachePath, rollupsPath, extras, composed, options,
                    environment, evidenceFiles, omissions, zipTimestamp, opsCacheRedactedJson, null);
        }
    }

    private SupportBundlePackager() {
    }

    public record BundleResult(Path zipPath, long sizeBytes) {
    }

    public static BundleResult packageSupportBundle(Path outDir, Path factsPath, Path briefPath) throws IOException {
        return packageSupportBundle(outDir, factsPath, briefPath, null, null);
    }

    public static BundleResult packageSupportBundle(
            Path outDir,
            Path factsPath,
            Path briefPath,
            Path opsCachePath
    ) throws IOException {
        return packageSupportBundle(outDir, factsPath, briefPath, opsCachePath, null);
    }

    public static BundleResult packageSupportBundle(
            Path outDir,
            Path factsPath,
            Path briefPath,
            Path opsCachePath,
            Path rollupsPath
    ) throws IOException {
        return packageSupportBundle(outDir, factsPath, briefPath, opsCachePath, rollupsPath, List.of(), false);
    }

    public static BundleResult packageSupportBundle(
            Path outDir,
            Path factsPath,
            Path briefPath,
            Path opsCachePath,
            Path rollupsPath,
            List<ExtraEntry> extras,
            boolean composed
    ) throws IOException {
        return packageSupportBundle(new PackageRequest(
                outDir, factsPath, briefPath, opsCachePath, rollupsPath, extras, composed,
                SupportComposeOptions.quickDefaults(), null, new JsonArray(), new JsonArray(), null, null));
    }

    public static BundleResult packageSupportBundle(PackageRequest req) throws IOException {
        Path outDir = req.outDir();
        Files.createDirectories(outDir);
        String timestamp = req.zipTimestamp() != null && !req.zipTimestamp().isBlank()
                ? req.zipTimestamp()
                : ZonedDateTime.now(ZoneId.systemDefault())
                .format(DateTimeFormatter.ofPattern("yyyy-MM-dd_HH-mm-ss_SSS"));
        Path zipPath = outDir.resolve("watchtower-support-" + timestamp + ".zip");

        Path factsPath = req.factsPath();
        Path briefPath = req.briefPath();
        String factsName = factsPath != null && Files.isRegularFile(factsPath)
                ? factsPath.getFileName().toString()
                : null;
        String briefName = briefPath != null && Files.isRegularFile(briefPath)
                ? briefPath.getFileName().toString()
                : null;
        boolean hasOpsCache = req.opsCachePath() != null && Files.isRegularFile(req.opsCachePath());
        String opsName = hasOpsCache ? WatchtowerFiles.OPS_CACHE_FILENAME : null;
        boolean hasRollups = req.rollupsPath() != null && Files.isRegularFile(req.rollupsPath());
        String rollupsName = hasRollups ? req.rollupsPath().getFileName().toString() : null;
        SupportComposeOptions options = req.options() != null ? req.options() : SupportComposeOptions.quickDefaults();

        JsonObject manifest = buildManifest(
                factsName, briefName, opsName, rollupsName, req.composed(), options,
                req.evidenceFiles(), req.omissions(), req.qualityGate());

        try (ZipOutputStream zos = new ZipOutputStream(Files.newOutputStream(zipPath))) {
            ForensicsZipUtil.addTextEntry(zos, "manifest.json", GSON.toJson(manifest));
            ForensicsZipUtil.addTextEntry(zos, "builder-options.json", options.toPrettyJson());
            if (req.environment() != null) {
                ForensicsZipUtil.addTextEntry(zos, "environment.json", GSON.toJson(req.environment()));
            }
            if (options.category() != null && !options.category().isBlank()
                    || options.note() != null && !options.note().isBlank()) {
                ForensicsZipUtil.addTextEntry(zos, "PROBLEM.txt", problemText(options));
            }
            if (factsPath != null && Files.isRegularFile(factsPath)) {
                String zipFacts = "report/" + (factsName != null ? factsName : "facts-support.json");
                ForensicsZipUtil.addFileEntry(zos, zipFacts, factsPath);
            }
            if (briefPath != null && Files.isRegularFile(briefPath)) {
                String zipBrief = "report/" + (briefName != null ? briefName : "brief.txt");
                ForensicsZipUtil.addFileEntry(zos, zipBrief, briefPath);
            }
            if (hasOpsCache) {
                String opsJson = req.opsCacheRedactedJson() != null
                        ? req.opsCacheRedactedJson()
                        : SupportRedactor.redactJsonText(Files.readString(req.opsCachePath()));
                ForensicsZipUtil.addTextEntry(zos, "watchtower/" + opsName, opsJson);
            }
            if (hasRollups && options.includeRollups()) {
                ForensicsZipUtil.addFileEntry(zos, "performance/" + rollupsName, req.rollupsPath());
            }
            if (req.extras() != null) {
                for (ExtraEntry extra : req.extras()) {
                    if (extra == null || extra.zipName() == null || extra.zipName().isBlank()) {
                        continue;
                    }
                    if (extra.filePath() != null && Files.isRegularFile(extra.filePath())) {
                        ForensicsZipUtil.addFileEntry(zos, extra.zipName(), extra.filePath());
                    } else if (extra.textContent() != null) {
                        ForensicsZipUtil.addTextEntry(zos, extra.zipName(), extra.textContent());
                    }
                }
            }
            ForensicsZipUtil.addTextEntry(zos, "README.txt",
                    readmeText(factsName != null, hasOpsCache, req.composed(), options));
        }

        return new BundleResult(zipPath, Files.size(zipPath));
    }

    private static String problemText(SupportComposeOptions options) {
        StringBuilder sb = new StringBuilder();
        sb.append("Watchtower support — problem report\n");
        sb.append("===================================\n\n");
        if (options.category() != null && !options.category().isBlank()) {
            sb.append("Category: ").append(options.category()).append("\n");
        }
        if (options.note() != null && !options.note().isBlank()) {
            sb.append("\n").append(options.note().trim()).append("\n");
        }
        return sb.toString();
    }

    private static JsonObject buildManifest(
            String factsName,
            String briefName,
            String opsCacheName,
            String rollupsName,
            boolean composed,
            SupportComposeOptions options,
            JsonArray evidenceFiles,
            JsonArray omissions,
            JsonObject qualityGate
    ) {
        JsonObject manifest = new JsonObject();
        manifest.addProperty("bundle_version", BUNDLE_VERSION);
        manifest.addProperty("report_mode", composed ? "support_compose" : "support");
        manifest.addProperty("generated_at", ZonedDateTime.now(ZoneId.systemDefault()).toString());
        manifest.addProperty("composed_from_continuous", composed);
        manifest.addProperty("redaction", true);
        manifest.addProperty("preset", options.preset().name());
        if (options.category() != null && !options.category().isBlank()) {
            manifest.addProperty("category", options.category());
        }
        JsonObject caps = new JsonObject();
        caps.addProperty("log_tail_lines", options.logTailLines());
        caps.addProperty("max_log_bytes_total", options.maxLogBytesTotal());
        caps.addProperty("max_spark_bytes", options.maxSparkBytes());
        caps.addProperty("max_zip_evidence_bytes", options.maxZipEvidenceBytes());
        caps.addProperty("soft_budget_bytes", SupportComposeOptions.SOFT_BUDGET_BYTES);
        caps.addProperty("hard_budget_bytes", SupportComposeOptions.HARD_BUDGET_BYTES);
        manifest.add("caps", caps);
        if (factsName != null) {
            manifest.addProperty("facts", "report/" + factsName);
        }
        if (briefName != null) {
            manifest.addProperty("brief", "report/" + briefName);
        }
        if (opsCacheName != null) {
            manifest.addProperty("ops_cache", "watchtower/" + opsCacheName);
        }
        if (rollupsName != null && options.includeRollups()) {
            manifest.addProperty("performance_rollups", "performance/" + rollupsName);
        }
        manifest.add("evidence", evidenceFiles != null ? evidenceFiles : new JsonArray());
        manifest.add("omissions", omissions != null ? omissions : new JsonArray());
        if (qualityGate != null) {
            manifest.add("quality_gate", qualityGate);
        }
        return manifest;
    }

    private static String readmeText(boolean hasFacts, boolean hasOps, boolean composed, SupportComposeOptions options) {
        StringBuilder sb = new StringBuilder();
        sb.append("Watchtower support bundle\n");
        sb.append("=========================\n\n");
        sb.append("Privacy: text artifacts are redacted (secrets, IPs, UUIDs). Spark profiles are binary and unredacted.\n");
        sb.append("Never includes dashboard-auth, the audit log, world/playerdata, backups, or mod jars.\n\n");
        if (composed) {
            sb.append("Composed from continuous Watching + Scanning data (ops-cache, rollups).\n");
            sb.append("Facts/brief in this zip are synthesized for support only — not BAU dashboard truth.\n\n");
        } else if (hasFacts) {
            sb.append("Includes latest facts/brief when available.\n");
        } else {
            sb.append("No full catch-up report was present — packed live ops data instead.\n");
        }
        if (hasOps) {
            sb.append("Includes ops-cache.json (background scans + issues_live when present).\n");
        }
        sb.append("\nHow to read\n");
        sb.append("-----------\n");
        sb.append("Server issue:  PROBLEM.txt → report/brief.txt → evidence/crashes → evidence/logs → mods/\n");
        sb.append("Watchtower bug: PROBLEM.txt → environment.json → watchtower/conf-redacted.conf → ops-cache\n");
        sb.append("\nPreset: ").append(options.preset().name()).append("\n");
        sb.append("\nShare this zip with whoever is helping you triage the server.\n");
        return sb.toString();
    }
}
