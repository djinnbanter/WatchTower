package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.report.ReportConfig;
import dev.mcstatus.watchtower.core.spark.proto.SparkProtos;
import dev.mcstatus.watchtower.core.spark.proto.SparkSamplerProtos;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import java.time.Instant;

/**
 * Parses Spark {@link SparkSamplerProtos.SamplerData} into {@code optional.spark_profile} JSON.
 */
public final class SparkParser {

    private static final int TOP_METHODS = 10;
    private static final int DEEP_METHODS = 30;
    private static final int MOD_HINTS = 5;
    private static final int TOP_ENTITIES = 8;
    private static final int TOP_ENTITY_HOTSPOTS = 12;
    private static final int TOP_WORLD_ENTITIES = 6;
    private static final int NOTABLE_ENTITIES = 3;
    private static final int DATAPACKS_CAP = 25;
    private static final int[] CONCENTRATION_TOP_N = {1, 2, 5, 10, 20, 50};
    /** Operator-facing hint denylist: transform/config/API libs, not actionable lag sources. */
    private static final Set<String> INFRASTRUCTURE_MOD_IDS = Set.of(
            "pehkui",
            "forgeconfigapiport",
            "architectury",
            "mixinextras",
            "fabric-api",
            "fabric-api-base",
            "fabric-lifecycle-events-v1",
            "fabric-resource-loader-v0",
            "fabric-registry-sync-v0",
            "fabric-networking-api-v1",
            "fabric-command-api-v2",
            "fabric-entity-events-v1",
            "cloth-config",
            "cloth-config2",
            "modmenu",
            "jade",
            "wthit");
    private static final Set<String> SELECTED_SERVER_PROPERTY_KEYS = Set.of(
            "view-distance",
            "simulation-distance",
            "player-idle-timeout",
            "sync-chunk-writes",
            "region-file-compression",
            "entity-broadcast-range-percentage",
            "max-chained-neighbor-updates",
            "network-compression-threshold",
            "max-tick-time",
            "use-native-transport",
            "spawn-protection",
            "pause-when-empty-seconds",
            "rate-limit");
    private static final Set<String> SECRET_SERVER_PROPERTY_KEYS = Set.of(
            "rcon.password",
            "management-server-secret",
            "management-server-tls-keystore-password",
            "resource-pack-sha1");
    private static final Set<String> FLAGGED_GAMERULES = Set.of("spectatorsGenerateChunks");
    private static final int MAX_SOURCE_LEN = 120;
    private static final double OTHER_THREAD_MIN_PCT = 2.0;
    /** Safety ceiling only — real profiles are emitted in full below this. */
    private static final int MAX_TREE_NODES = 250_000;
    private static final int MAX_TREE_DEPTH = 512;
    /** No per-node child fan-out cap; budget/depth are the only limits. */
    private static final int MAX_TREE_CHILDREN = Integer.MAX_VALUE;

    private SparkParser() {
    }

    public static JsonObject toFacts(SparkCollectResult result, ReportConfig config) {
        if (result == null || result.data() == null) {
            return null;
        }
        SparkSamplerProtos.SamplerData data = result.data();
        SparkSamplerProtos.SamplerMetadata meta = data.hasMetadata() ? data.getMetadata() : null;

        JsonObject out = new JsonObject();
        out.addProperty("analysis_version", 2);
        out.addProperty("captured_at", SparkProfileFacts.formatCapturedAt(result.capturedAt()));
        out.addProperty("source_file", result.sourceFile());
        out.addProperty("source_kind", result.sourceKind());
        String sourcePath = result.relativeSourcePath();
        if (sourcePath == null || sourcePath.isBlank()) {
            sourcePath = result.sourcePath() != null
                    ? result.sourcePath().toString().replace('\\', '/')
                    : "";
        }
        out.addProperty("source_path", sourcePath);
        String viewerUrl = SparkBytebinUrls.viewerUrl(result.sourceFile());
        if (viewerUrl != null) {
            out.addProperty("spark_viewer_url", viewerUrl);
            String rawUrl = SparkBytebinUrls.rawJsonUrl(result.sourceFile());
            if (rawUrl != null) {
                out.addProperty("spark_raw_url", rawUrl);
            }
        }

        int freshHours = config.sparkFreshHours();
        boolean fresh = SparkProfileFacts.isFreshInstant(result.capturedAt(), freshHours);
        out.addProperty("fresh", fresh);

        boolean allocation = false;
        JsonObject modCatalog = new JsonObject();
        if (meta != null) {
            allocation = meta.getSamplerMode() == SparkSamplerProtos.SamplerMetadata.SamplerMode.ALLOCATION;
            modCatalog = buildModCatalog(meta);
            addSyntheticSources(modCatalog);
            if (!modCatalog.entrySet().isEmpty()) {
                out.add("mod_catalog", modCatalog);
            }
            out.add("window", buildWindow(meta));
            out.add("platform", buildPlatform(meta));
            out.add("context", buildContext(meta));
            out.add("system", buildSystem(meta));
            out.add("capture", buildCapture(meta));
            out.addProperty("engine", engineLabel(meta.getSamplerEngine()));
            out.addProperty("mode", meta.getSamplerMode() == SparkSamplerProtos.SamplerMetadata.SamplerMode.ALLOCATION
                    ? "allocation" : "execution");
        }

        JsonArray timeline = buildTimeline(data);
        out.add("timeline", timeline);
        if (meta != null && !timeline.isEmpty() && out.has("context")) {
            JsonObject lastWindow = timeline.get(timeline.size() - 1).getAsJsonObject();
            JsonObject ctx = out.getAsJsonObject("context");
            if (lastWindow.has("tile_entities")) {
                ctx.addProperty("tile_entities", lastWindow.get("tile_entities").getAsInt());
            }
        }

        Map<String, String> classSources = new HashMap<>();
        for (Map.Entry<String, String> e : data.getClassSourcesMap().entrySet()) {
            classSources.put(e.getKey(), e.getValue());
        }
        Map<String, String> methodSources = new HashMap<>(data.getMethodSourcesMap());
        Map<String, String> lineSources = new HashMap<>(data.getLineSourcesMap());

        int windowCount = timeWindowCount(data);
        List<MethodFrame> frames = new ArrayList<>();
        JsonArray threads = new JsonArray();
        List<ThreadRollup> otherThreads = new ArrayList<>();
        List<AnalyzedThread> analyzedThreads = new ArrayList<>();
        double allThreadWeight = 0;
        double selectedRootWeight = 0;
        for (SparkSamplerProtos.ThreadNode thread : data.getThreadsList()) {
            threads.add(thread.getName());
            AnalyzedThread analyzed = analyzeThread(thread, windowCount, classSources, methodSources, lineSources);
            analyzedThreads.add(analyzed);
            double threadTotal = analyzed.inclusiveTotal();
            allThreadWeight += threadTotal;
            if (isServerThread(thread.getName())) {
                frames.addAll(analyzed.frames());
                selectedRootWeight += threadTotal;
            } else if (threadTotal > 0) {
                otherThreads.add(new ThreadRollup(thread.getName(), threadTotal));
            }
        }
        out.add("threads_analyzed", threads);

        if (selectedRootWeight <= 0 && !analyzedThreads.isEmpty()) {
            AnalyzedThread fallback = analyzedThreads.stream()
                    .max(Comparator.comparingDouble(AnalyzedThread::inclusiveTotal))
                    .orElse(analyzedThreads.get(0));
            frames.clear();
            frames.addAll(fallback.frames());
            selectedRootWeight = fallback.inclusiveTotal();
            fallback.selected = true;
        } else {
            analyzedThreads.forEach(t -> t.selected = isServerThread(t.name()));
        }
        double normalizationWeight = selectedRootWeight > 0 ? selectedRootWeight : 1;
        out.add("call_tree", buildCallTree(data, analyzedThreads, normalizationWeight));

        if (!otherThreads.isEmpty() && allThreadWeight > 0) {
            JsonArray threadsOther = new JsonArray();
            otherThreads.sort(Comparator.comparingDouble(ThreadRollup::weight).reversed());
            for (ThreadRollup other : otherThreads) {
                double pct = (other.weight() / allThreadWeight) * 100.0;
                if (pct < OTHER_THREAD_MIN_PCT) {
                    continue;
                }
                JsonObject row = new JsonObject();
                row.addProperty("name", other.name());
                row.addProperty("weight", Math.round(other.weight()));
                row.addProperty("pct", round2(pct));
                threadsOther.add(row);
            }
            if (!threadsOther.isEmpty()) {
                out.add("threads_other", threadsOther);
            }
        }

        frames.sort(Comparator.comparingDouble(MethodFrame::selfWeight).reversed()
                .thenComparing(MethodFrame::className)
                .thenComparing(MethodFrame::methodName));
        JsonArray topMethods = new JsonArray();
        int methodCap = Math.min(TOP_METHODS, frames.size());
        for (int i = 0; i < methodCap; i++) {
            topMethods.add(frames.get(i).toJson(normalizationWeight));
        }
        out.add("top_methods", topMethods);

        JsonObject deep = new JsonObject();
        JsonArray deepMethods = new JsonArray();
        int deepCap = Math.min(DEEP_METHODS, frames.size());
        for (int i = 0; i < deepCap; i++) {
            deepMethods.add(frames.get(i).toJson(normalizationWeight));
        }
        deep.add("top_methods", deepMethods);
        out.add("deep", deep);

        Map<String, ModRollup> modRollups = rollupMods(frames, normalizationWeight);
        JsonArray modRollupsJson = new JsonArray();
        JsonArray modHints = new JsonArray();
        int hintCount = 0;
        for (ModRollup rollup : modRollups.values()) {
            modRollupsJson.add(rollup.toRollupJson(modCatalog));
            if (hintCount < MOD_HINTS
                    && !isPlatformOrInfrastructureMod(rollup.modId)) {
                modHints.add(rollup.toHintJson(allocation, modCatalog));
                hintCount++;
            }
        }
        out.add("mod_rollups", modRollupsJson);
        out.add("mod_hints", modHints);
        out.add("source_rollups", sourceRollups(modRollups, modCatalog));

        JsonObject verdict = buildVerdict(out, modRollups);
        out.add("verdict", verdict);

        return out;
    }

    private static boolean isServerThread(String name) {
        if (name == null) {
            return false;
        }
        if (name.equalsIgnoreCase("Server thread")) {
            return true;
        }
        return name.contains("MinecraftServer");
    }

    private static AnalyzedThread analyzeThread(
            SparkSamplerProtos.ThreadNode thread,
            int windowCount,
            Map<String, String> classSources,
            Map<String, String> methodSources,
            Map<String, String> lineSources) {
        int width = Math.max(windowCount, thread.getTimesCount());
        for (SparkSamplerProtos.StackTraceNode node : thread.getChildrenList()) {
            width = Math.max(width, node.getTimesCount());
        }
        double[] rootInclusive = values(thread.getTimesList(), width);
        List<AnalyzedNode> roots = new ArrayList<>();
        List<MethodFrame> frames = new ArrayList<>();
        List<SparkSamplerProtos.StackTraceNode> nodes = thread.getChildrenList();
        for (int ref : thread.getChildrenRefsList()) {
            AnalyzedNode root = analyzeNode(nodes, ref, width, classSources, methodSources, lineSources,
                    frames, 0, new ArrayList<>(), null, new HashSet<>());
            if (root != null) {
                roots.add(root);
            }
        }
        if (sum(rootInclusive) <= 0) {
            rootInclusive = sumChildren(roots, width);
        }
        double[] rootSelf = exclusive(rootInclusive, roots);
        return new AnalyzedThread(thread.getName(), rootInclusive, rootSelf, roots, frames);
    }

    private static AnalyzedNode analyzeNode(
            List<SparkSamplerProtos.StackTraceNode> nodes,
            int index,
            int windowCount,
            Map<String, String> classSources,
            Map<String, String> methodSources,
            Map<String, String> lineSources,
            List<MethodFrame> out,
            int depth,
            List<String> parentChain,
            String parentModId,
            Set<Integer> activePath) {
        if (index < 0 || index >= nodes.size() || !activePath.add(index)) {
            return null;
        }
        SparkSamplerProtos.StackTraceNode node = nodes.get(index);
        String className = node.getClassName();
        String methodName = node.getMethodName();
        String methodDesc = node.getMethodDesc();

        String simple = className.contains(".") ? className.substring(className.lastIndexOf('.') + 1) : className;
        List<String> childChain = new ArrayList<>(parentChain);
        childChain.add(simple + "." + methodName);
        String modId = resolveMod(className, classSources);
        List<AnalyzedNode> children = new ArrayList<>();
        for (int ref : node.getChildrenRefsList()) {
            AnalyzedNode child = analyzeNode(nodes, ref, windowCount, classSources, methodSources, lineSources,
                    out, depth + 1, childChain, modId, activePath);
            if (child != null) {
                children.add(child);
            }
        }
        activePath.remove(index);

        double[] inclusive = values(node.getTimesList(), windowCount);
        double[] self = exclusive(inclusive, children);
        String source = resolveSource(className, methodName, methodDesc, node.getLineNumber(),
                methodSources, lineSources);
        Integer line = nonnegativeOptional(node.getLineNumber());
        Integer parentLine = nonnegativeOptional(node.getParentLineNumber());
        AnalyzedNode analyzed = new AnalyzedNode(className, methodName, methodDesc, modId,
                source, line, parentLine, inclusive, self, children);

        boolean hasChildren = !children.isEmpty();
        // Involvement uses inclusive weight only at source entry points so nested frames from the
        // same mod are not double-counted. Own share still uses exclusive/self everywhere.
        boolean involvementRoot = parentModId == null || !parentModId.equals(modId);
        if (!shouldSkipFrame(className, methodName, depth, hasChildren)
                && (sum(self) > 0 || sum(inclusive) > 0)) {
            out.add(new MethodFrame(className, methodName, methodDesc, modId, sum(self), sum(inclusive),
                    parentChain, source, line, parentLine, involvementRoot));
        }
        return analyzed;
    }

    private static int timeWindowCount(SparkSamplerProtos.SamplerData data) {
        int width = data.getTimeWindowsCount();
        if (width > 0) {
            return width;
        }
        for (SparkSamplerProtos.ThreadNode thread : data.getThreadsList()) {
            width = Math.max(width, thread.getTimesCount());
            for (SparkSamplerProtos.StackTraceNode node : thread.getChildrenList()) {
                width = Math.max(width, node.getTimesCount());
            }
        }
        return width;
    }

    private static double[] values(List<Double> input, int width) {
        double[] out = new double[Math.max(0, width)];
        for (int i = 0; i < input.size() && i < out.length; i++) {
            double value = input.get(i);
            out[i] = Double.isFinite(value) && value > 0 ? value : 0;
        }
        return out;
    }

    private static double[] sumChildren(List<AnalyzedNode> children, int width) {
        double[] sum = new double[width];
        for (AnalyzedNode child : children) {
            for (int i = 0; i < width; i++) {
                sum[i] += child.inclusive[i];
            }
        }
        return sum;
    }

    private static double[] exclusive(double[] inclusive, List<AnalyzedNode> children) {
        double[] self = Arrays.copyOf(inclusive, inclusive.length);
        for (AnalyzedNode child : children) {
            for (int i = 0; i < self.length; i++) {
                self[i] -= child.inclusive[i];
            }
        }
        for (int i = 0; i < self.length; i++) {
            self[i] = Math.max(0, self[i]);
        }
        return self;
    }

    private static double sum(double[] values) {
        double total = 0;
        for (double value : values) {
            total += value;
        }
        return total;
    }

    private static Integer nonnegativeOptional(int value) {
        return value > 0 ? value : null;
    }

    private static String resolveSource(
            String className,
            String methodName,
            String methodDesc,
            int lineNumber,
            Map<String, String> methodSources,
            Map<String, String> lineSources) {
        if (className == null || methodName == null) {
            return null;
        }
        if (methodDesc != null && !methodDesc.isBlank()) {
            String key = className + methodName + methodDesc;
            String hit = methodSources.get(key);
            if (hit != null && !hit.isBlank()) {
                return capSource(hit);
            }
        }
        String dotted = className + "." + methodName;
        String hit = methodSources.get(dotted);
        if (hit != null && !hit.isBlank()) {
            return capSource(hit);
        }
        if (lineNumber > 0) {
            String lineKey = className + ":" + lineNumber;
            hit = lineSources.get(lineKey);
            if (hit != null && !hit.isBlank()) {
                return capSource(hit);
            }
        }
        return null;
    }

    private static String capSource(String source) {
        if (source == null) {
            return null;
        }
        String trimmed = source.trim();
        if (trimmed.length() <= MAX_SOURCE_LEN) {
            return trimmed;
        }
        return trimmed.substring(0, MAX_SOURCE_LEN - 1) + "…";
    }

    private static JsonObject buildModCatalog(SparkSamplerProtos.SamplerMetadata meta) {
        JsonObject catalog = new JsonObject();
        for (Map.Entry<String, SparkProtos.PluginOrModMetadata> e : meta.getSourcesMap().entrySet()) {
            SparkProtos.PluginOrModMetadata src = e.getValue();
            JsonObject row = new JsonObject();
            if (!src.getName().isBlank()) {
                row.addProperty("name", src.getName());
            }
            if (!src.getVersion().isBlank()) {
                row.addProperty("version", src.getVersion());
            }
            if (!src.getAuthor().isBlank()) {
                row.addProperty("author", src.getAuthor());
            }
            if (!src.getDescription().isBlank()) {
                row.addProperty("description", src.getDescription());
            }
            row.addProperty("builtin", src.getBuiltin());
            catalog.add(e.getKey(), row);
        }
        return catalog;
    }

    private static void addSyntheticSources(JsonObject catalog) {
        addSyntheticSource(catalog, "minecraft", "Minecraft", true,
                "Platform attribution used when Spark class_sources has no entry.");
        addSyntheticSource(catalog, "neoforge", "NeoForge", true,
                "Loader attribution used when Spark class_sources has no entry.");
        addSyntheticSource(catalog, "jvm", "JVM / Java runtime", true,
                "Java runtime, scheduler, sleep, wait, and library frames.");
        addSyntheticSource(catalog, "native", "Native runtime", true,
                "Native frame without a Spark mod/plugin source.");
        addSyntheticSource(catalog, "unknown", "Unknown source", false,
                "Spark did not include an authoritative class source for this frame.");
    }

    private static void addSyntheticSource(
            JsonObject catalog, String id, String name, boolean builtin, String description) {
        if (catalog.has(id)) {
            return;
        }
        JsonObject row = new JsonObject();
        row.addProperty("name", name);
        row.addProperty("builtin", builtin);
        row.addProperty("description", description);
        row.addProperty("attribution", "watchtower_builtin_fallback");
        catalog.add(id, row);
    }

    private static String displayName(String modId, JsonObject modCatalog) {
        if (modId == null || modCatalog == null || !modCatalog.has(modId)) {
            return null;
        }
        JsonObject row = modCatalog.getAsJsonObject(modId);
        if (!row.has("name")) {
            return null;
        }
        String name = row.get("name").getAsString();
        if (row.has("version") && !row.get("version").getAsString().isBlank()) {
            return name + " " + row.get("version").getAsString();
        }
        return name;
    }

    private static boolean shouldSkipFrame(String className, String methodName, int depth, boolean hasChildren) {
        if (className == null || className.isBlank()) {
            return true;
        }
        if (depth == 0 && hasChildren && className.contains("MinecraftServer") && "runServer".equals(methodName)) {
            return true;
        }
        return false;
    }

    private static String resolveMod(String className, Map<String, String> classSources) {
        if (className == null || className.isBlank()) {
            return "unknown";
        }
        String mod = classSources.get(className);
        if (mod != null && !mod.isBlank()) {
            return mod;
        }
        String lower = className.toLowerCase(Locale.ROOT);
        if (lower.startsWith("native.") || lower.contains(".so.") || lower.endsWith(".so")
                || lower.endsWith(".dll") || lower.endsWith(".dylib")) {
            return "native";
        }
        if (className.startsWith("net.minecraft")) {
            return "minecraft";
        }
        if (className.startsWith("net.neoforged") || className.startsWith("net.minecraftforge")) {
            return "neoforge";
        }
        if (className.startsWith("java.") || className.startsWith("javax.")
                || className.startsWith("jdk.") || className.startsWith("sun.")) {
            return "jvm";
        }
        return "unknown";
    }

    private static Map<String, ModRollup> rollupMods(List<MethodFrame> frames, double totalWeight) {
        Map<String, ModRollup> map = new LinkedHashMap<>();
        for (MethodFrame frame : frames) {
            String mod = frame.modId() != null ? frame.modId() : "unknown";
            ModRollup rollup = map.computeIfAbsent(mod, ModRollup::new);
            rollup.add(frame, totalWeight);
        }
        List<ModRollup> sorted = new ArrayList<>(map.values());
        sorted.sort(Comparator.comparingDouble(ModRollup::pct).reversed());
        Map<String, ModRollup> ordered = new LinkedHashMap<>();
        for (ModRollup r : sorted) {
            ordered.put(r.modId, r);
        }
        return ordered;
    }

    private static JsonArray sourceRollups(Map<String, ModRollup> modRollups, JsonObject modCatalog) {
        JsonArray out = new JsonArray();
        for (ModRollup rollup : modRollups.values()) {
            JsonObject row = rollup.toRollupJson(modCatalog);
            row.addProperty("own_pct", round2(rollup.pct));
            row.addProperty("involvement_pct", round2(rollup.involvementPct));
            row.addProperty("own_weight", round2(rollup.weightSum));
            row.addProperty("involvement_weight", round2(rollup.involvementWeightSum));
            out.add(row);
        }
        return out;
    }

    private static JsonObject buildWindow(SparkSamplerProtos.SamplerMetadata meta) {
        JsonObject w = new JsonObject();
        if (meta.getStartTime() >= 0) {
            w.addProperty("start_ms", meta.getStartTime());
        }
        if (meta.getEndTime() >= 0) {
            w.addProperty("end_ms", meta.getEndTime());
        }
        addNonnegative(w, "ticks", meta.getNumberOfTicks());
        addNonnegative(w, "sample_interval_us", meta.getInterval());
        if (meta.getEndTime() > meta.getStartTime()) {
            w.addProperty("duration_sec", (meta.getEndTime() - meta.getStartTime()) / 1000.0);
        }
        return w;
    }

    private static JsonObject buildPlatform(SparkSamplerProtos.SamplerMetadata meta) {
        JsonObject p = new JsonObject();
        if (meta.hasPlatformMetadata()) {
            SparkProtos.PlatformMetadata pm = meta.getPlatformMetadata();
            p.addProperty("type", pm.getType().name().toLowerCase(Locale.ROOT));
            p.addProperty("loader", pm.getName());
            p.addProperty("loader_version", pm.getVersion());
            p.addProperty("minecraft", pm.getMinecraftVersion());
            p.addProperty("spark_version", pm.getSparkVersion());
            if (!pm.getBrand().isBlank()) {
                p.addProperty("brand", pm.getBrand());
            }
        }
        if (!meta.getExtraPlatformMetadataMap().isEmpty()) {
            JsonObject extra = new JsonObject();
            meta.getExtraPlatformMetadataMap().forEach(extra::addProperty);
            p.add("extra", extra);
        }
        p.addProperty("engine", engineLabel(meta.getSamplerEngine()));
        p.addProperty("mode", meta.getSamplerMode() == SparkSamplerProtos.SamplerMetadata.SamplerMode.ALLOCATION
                ? "allocation" : "execution");
        return p;
    }

    private static JsonObject buildContext(SparkSamplerProtos.SamplerMetadata meta) {
        JsonObject ctx = new JsonObject();
        if (!meta.hasPlatformStatistics()) {
            return ctx;
        }
        SparkProtos.PlatformStatistics stats = meta.getPlatformStatistics();
        if (stats.hasTps()) {
            addNonnegative(ctx, "tps_1m", round2(stats.getTps().getLast1M()));
            addNonnegative(ctx, "tps_5m", round2(stats.getTps().getLast5M()));
            addNonnegative(ctx, "tps_15m", round2(stats.getTps().getLast15M()));
            if (stats.getTps().getGameTargetTps() > 0) {
                ctx.addProperty("target_tps", stats.getTps().getGameTargetTps());
            }
        }
        if (stats.hasMspt()) {
            if (stats.getMspt().hasLast1M()) {
                SparkProtos.RollingAverageValues one = stats.getMspt().getLast1M();
                addNonnegative(ctx, "mspt_mean_1m", round2(one.getMean()));
                addNonnegative(ctx, "mspt_max_1m", round2(one.getMax()));
                addNonnegative(ctx, "mspt_median_1m", round2(one.getMedian()));
                addNonnegative(ctx, "mspt_p95_1m", round2(one.getPercentile95()));
            }
            if (stats.getMspt().hasLast5M()) {
                SparkProtos.RollingAverageValues five = stats.getMspt().getLast5M();
                addNonnegative(ctx, "mspt_mean_5m", round2(five.getMean()));
                addNonnegative(ctx, "mspt_max_5m", round2(five.getMax()));
                addNonnegative(ctx, "mspt_median_5m", round2(five.getMedian()));
                addNonnegative(ctx, "mspt_p95_5m", round2(five.getPercentile95()));
            }
            if (stats.getMspt().getGameMaxIdealMspt() > 0) {
                ctx.addProperty("target_mspt", stats.getMspt().getGameMaxIdealMspt());
            }
        }
        if (stats.hasMemory() && stats.getMemory().hasHeap()) {
            var heap = stats.getMemory().getHeap();
            JsonObject heapJson = new JsonObject();
            addBytesMb(heapJson, "used_mb", heap.getUsed());
            addBytesMb(heapJson, "committed_mb", heap.getCommitted());
            addBytesMb(heapJson, "init_mb", heap.getInit());
            if (heap.getMax() > 0) {
                heapJson.addProperty("max_mb", round2(heap.getMax() / (1024.0 * 1024.0)));
            }
            ctx.add("jvm_heap", heapJson);
        }
        if (stats.getPlayerCount() >= 0) {
            ctx.addProperty("players", stats.getPlayerCount());
        }
        if (stats.hasPing() && stats.getPing().hasLast15M()) {
            JsonObject ping = rollingAverageJson(stats.getPing().getLast15M());
            if (!ping.entrySet().isEmpty()) {
                ctx.add("ping_15m", ping);
            }
        }
        if (stats.hasWorld()) {
            SparkProtos.WorldStatistics world = stats.getWorld();
            if (world.getTotalEntities() >= 0) {
                ctx.addProperty("world_entities", world.getTotalEntities());
            }
            JsonArray topEntities = entityCountRows(world.getEntityCountsMap(), TOP_ENTITIES);
            if (!topEntities.isEmpty()) {
                ctx.add("top_entities", topEntities);
            }
            JsonObject composition = buildEntityComposition(world);
            if (!composition.entrySet().isEmpty()) {
                ctx.add("entity_composition", composition);
            }
            WorldScan scan = scanWorld(world);
            if (!scan.worlds.isEmpty()) {
                ctx.add("worlds", scan.worlds);
            }
            if (!scan.playerChunks.isEmpty()) {
                ctx.add("players_chunks", scan.playerChunks);
            }
            JsonObject concentration = buildEntityConcentration(scan.chunkTotals, world.getTotalEntities());
            if (!concentration.entrySet().isEmpty()) {
                ctx.add("entity_concentration", concentration);
            }
            JsonArray hotspots = buildEntityHotspots(scan.hotspots, scan.playerLocations);
            if (!hotspots.isEmpty()) {
                ctx.add("entity_hotspots", hotspots);
            }
            JsonObject gamerules = buildFlaggedGamerules(world);
            if (!gamerules.entrySet().isEmpty()) {
                ctx.add("gamerules", gamerules);
            }
        }
        JsonArray datapacks = buildDatapacks(meta);
        if (!datapacks.isEmpty()) {
            ctx.add("datapacks", datapacks);
        }
        JsonObject platformGc = buildPlatformGc(stats.getGcMap());
        if (!platformGc.entrySet().isEmpty()) {
            ctx.add("gc", platformGc);
        }
        if (stats.getUptime() >= 0) {
            ctx.addProperty("uptime_ms", stats.getUptime());
        }
        return ctx;
    }

    private static JsonArray entityCountRows(Map<String, Integer> counts, int limit) {
        JsonArray out = new JsonArray();
        var stream = counts.entrySet().stream()
                .filter(e -> e.getValue() != null && e.getValue() >= 0)
                .sorted(Map.Entry.<String, Integer>comparingByValue().reversed());
        if (limit > 0) {
            stream = stream.limit(limit);
        }
        stream.forEach(e -> {
            JsonObject row = new JsonObject();
            row.addProperty("id", e.getKey());
            row.addProperty("count", e.getValue());
            out.add(row);
        });
        return out;
    }

    private static JsonObject buildEntityComposition(SparkProtos.WorldStatistics world) {
        JsonObject out = new JsonObject();
        int total = world.getTotalEntities();
        if (total <= 0) {
            return out;
        }
        Map<String, Integer> counts = world.getEntityCountsMap();
        int xp = Math.max(0, counts.getOrDefault("minecraft:experience_orb", 0));
        int items = Math.max(0, counts.getOrDefault("minecraft:item", 0));
        int createGlue = Math.max(0, counts.getOrDefault("create:super_glue", 0));
        int honeyGlue = Math.max(0, counts.getOrDefault("simulated:honey_glue", 0));
        int markers = Math.max(0, counts.getOrDefault("minecraft:marker", 0));
        int glue = createGlue + honeyGlue;
        int xpItems = xp + items;
        int automation = xpItems + glue;
        out.addProperty("xp_orbs", xp);
        out.addProperty("items", items);
        out.addProperty("create_super_glue", createGlue);
        out.addProperty("simulated_honey_glue", honeyGlue);
        out.addProperty("glue_family", glue);
        out.addProperty("xp_items", xpItems);
        out.addProperty("automation_cluster", automation);
        out.addProperty("markers", markers);
        out.addProperty("xp_share_pct", round2(xp * 100.0 / total));
        out.addProperty("item_share_pct", round2(items * 100.0 / total));
        out.addProperty("glue_share_pct", round2(glue * 100.0 / total));
        out.addProperty("xp_items_share_pct", round2(xpItems * 100.0 / total));
        out.addProperty("automation_share_pct", round2(automation * 100.0 / total));
        out.addProperty("marker_share_pct", round2(markers * 100.0 / total));
        out.addProperty("total_entities", total);

        List<Map.Entry<String, Integer>> notable = counts.entrySet().stream()
                .filter(e -> e.getValue() != null && e.getValue() > 0)
                .filter(e -> isNotableCustomEntity(e.getKey()))
                .sorted(Map.Entry.<String, Integer>comparingByValue().reversed())
                .limit(NOTABLE_ENTITIES)
                .toList();
        if (!notable.isEmpty()) {
            Map.Entry<String, Integer> dominant = notable.get(0);
            out.addProperty("dominant_custom_id", dominant.getKey());
            out.addProperty("dominant_custom_count", dominant.getValue());
            out.addProperty("dominant_custom_share_pct", round2(dominant.getValue() * 100.0 / total));
            JsonArray notableArr = new JsonArray();
            for (Map.Entry<String, Integer> entry : notable) {
                JsonObject row = new JsonObject();
                row.addProperty("id", entry.getKey());
                row.addProperty("count", entry.getValue());
                row.addProperty("share_pct", round2(entry.getValue() * 100.0 / total));
                notableArr.add(row);
            }
            out.add("notable_entities", notableArr);
        }
        return out;
    }

    private static boolean isNotableCustomEntity(String id) {
        if (id == null || id.isBlank()) {
            return false;
        }
        // Non-vanilla namespaces only (Create glue, mushlings, etc.).
        return !id.startsWith("minecraft:");
    }

    static boolean isInfrastructureMod(String modId) {
        if (modId == null || modId.isBlank()) {
            return false;
        }
        String id = modId.toLowerCase(Locale.ROOT);
        if (INFRASTRUCTURE_MOD_IDS.contains(id)) {
            return true;
        }
        // Fabric API modules and common config/port libs.
        return id.startsWith("fabric-") && (id.contains("-api") || id.endsWith("-v0") || id.endsWith("-v1")
                || id.endsWith("-v2") || id.endsWith("-v3"))
                || id.contains("forgeconfigapi")
                || id.startsWith("mixinextras");
    }

    static boolean isPlatformOrInfrastructureMod(String modId) {
        if (modId == null) {
            return true;
        }
        return Set.of("minecraft", "neoforge", "forge", "jvm", "native", "unknown").contains(modId)
                || isInfrastructureMod(modId);
    }

    private static JsonArray buildDatapacks(SparkSamplerProtos.SamplerMetadata meta) {
        JsonArray out = new JsonArray();
        if (meta.getExtraPlatformMetadataMap().isEmpty()) {
            return out;
        }
        String raw = meta.getExtraPlatformMetadataMap().get("datapacks");
        if (raw == null || raw.isBlank()) {
            return out;
        }
        try {
            JsonElement parsed = com.google.gson.JsonParser.parseString(raw);
            if (!parsed.isJsonObject()) {
                return out;
            }
            JsonObject map = parsed.getAsJsonObject();
            int count = 0;
            for (Map.Entry<String, JsonElement> entry : map.entrySet()) {
                if (count >= DATAPACKS_CAP) {
                    break;
                }
                if (!entry.getValue().isJsonObject()) {
                    continue;
                }
                JsonObject pack = entry.getValue().getAsJsonObject();
                JsonObject row = new JsonObject();
                row.addProperty("id", entry.getKey());
                if (pack.has("name") && pack.get("name").isJsonPrimitive()) {
                    row.addProperty("name", pack.get("name").getAsString());
                }
                if (pack.has("source") && pack.get("source").isJsonPrimitive()) {
                    row.addProperty("source", pack.get("source").getAsString());
                }
                out.add(row);
                count++;
            }
            if (map.size() > DATAPACKS_CAP) {
                JsonObject more = new JsonObject();
                more.addProperty("id", "_truncated");
                more.addProperty("name", (map.size() - DATAPACKS_CAP) + " more datapacks");
                more.addProperty("source", "truncated");
                out.add(more);
            }
        } catch (Exception ignored) {
            return new JsonArray();
        }
        return out;
    }

    private static WorldScan scanWorld(SparkProtos.WorldStatistics world) {
        JsonArray worlds = new JsonArray();
        JsonArray playerChunks = new JsonArray();
        List<PlayerChunk> playerLocations = new ArrayList<>();
        List<EntityHotspot> hotspots = new ArrayList<>();
        List<Integer> chunkTotals = new ArrayList<>();
        for (SparkProtos.WorldStatistics.World w : world.getWorldsList()) {
            String dimension = w.getName();
            Map<String, Integer> dimCounts = new HashMap<>();
            int dimTotal = 0;
            for (SparkProtos.WorldStatistics.Region region : w.getRegionsList()) {
                for (SparkProtos.WorldStatistics.Chunk chunk : region.getChunksList()) {
                    int total = chunk.getTotalEntities();
                    if (total <= 0) {
                        continue;
                    }
                    dimTotal += total;
                    chunkTotals.add(total);
                    String topType = null;
                    int topCount = 0;
                    Map<String, Integer> chunkCounts = new HashMap<>();
                    for (Map.Entry<String, Integer> ent : chunk.getEntityCountsMap().entrySet()) {
                        int count = ent.getValue() == null ? 0 : ent.getValue();
                        if (count < 0) {
                            continue;
                        }
                        chunkCounts.put(ent.getKey(), count);
                        dimCounts.merge(ent.getKey(), count, Integer::sum);
                        if (count > topCount) {
                            topCount = count;
                            topType = ent.getKey();
                        }
                        if ("minecraft:player".equals(ent.getKey()) && count > 0) {
                            playerLocations.add(new PlayerChunk(dimension, chunk.getX(), chunk.getZ(), count));
                            JsonObject player = new JsonObject();
                            player.addProperty("dimension", dimension);
                            player.addProperty("chunk_x", chunk.getX());
                            player.addProperty("chunk_z", chunk.getZ());
                            player.addProperty("count", count);
                            playerChunks.add(player);
                        }
                    }
                    hotspots.add(new EntityHotspot(
                            dimension, chunk.getX(), chunk.getZ(), total, topType, topCount, chunkCounts));
                }
            }
            JsonObject worldRow = new JsonObject();
            worldRow.addProperty("id", dimension);
            int reported = w.getTotalEntities() >= 0 ? w.getTotalEntities() : dimTotal;
            worldRow.addProperty("entities", reported);
            if (world.getTotalEntities() > 0 && reported >= 0) {
                worldRow.addProperty("share_pct", round2(reported * 100.0 / world.getTotalEntities()));
            }
            JsonArray top = entityCountRows(dimCounts, TOP_WORLD_ENTITIES);
            if (!top.isEmpty()) {
                worldRow.add("top_entities", top);
            }
            worlds.add(worldRow);
        }
        return new WorldScan(worlds, playerChunks, playerLocations, hotspots, chunkTotals);
    }

    private static JsonObject buildEntityConcentration(List<Integer> chunkTotals, int totalEntities) {
        JsonObject out = new JsonObject();
        if (chunkTotals.isEmpty() || totalEntities <= 0) {
            return out;
        }
        List<Integer> sorted = new ArrayList<>(chunkTotals);
        sorted.sort(Comparator.reverseOrder());
        out.addProperty("chunks_with_entities", sorted.size());
        JsonObject topShare = new JsonObject();
        for (int n : CONCENTRATION_TOP_N) {
            int sum = 0;
            int cap = Math.min(n, sorted.size());
            for (int i = 0; i < cap; i++) {
                sum += sorted.get(i);
            }
            topShare.addProperty(String.valueOf(n), round2(sum * 100.0 / totalEntities));
        }
        out.add("top_n_share_pct", topShare);
        return out;
    }

    private static JsonArray buildEntityHotspots(List<EntityHotspot> rows, List<PlayerChunk> players) {
        JsonArray out = new JsonArray();
        rows.sort(Comparator.comparingInt(EntityHotspot::totalEntities).reversed());
        int cap = Math.min(TOP_ENTITY_HOTSPOTS, rows.size());
        for (int i = 0; i < cap; i++) {
            out.add(rows.get(i).toJson(players));
        }
        return out;
    }

    private static JsonObject buildFlaggedGamerules(SparkProtos.WorldStatistics world) {
        JsonObject out = new JsonObject();
        for (SparkProtos.WorldStatistics.GameRule rule : world.getGameRulesList()) {
            if (!FLAGGED_GAMERULES.contains(rule.getName())) {
                continue;
            }
            JsonObject row = new JsonObject();
            addNonblank(row, "default", rule.getDefaultValue());
            JsonObject values = new JsonObject();
            rule.getWorldValuesMap().forEach(values::addProperty);
            if (!values.entrySet().isEmpty()) {
                row.add("world_values", values);
            }
            out.add(rule.getName(), row);
        }
        return out;
    }

    private record WorldScan(
            JsonArray worlds,
            JsonArray playerChunks,
            List<PlayerChunk> playerLocations,
            List<EntityHotspot> hotspots,
            List<Integer> chunkTotals) {
    }

    private record PlayerChunk(String dimension, int chunkX, int chunkZ, int count) {
    }

    private record EntityHotspot(
            String dimension,
            int chunkX,
            int chunkZ,
            int totalEntities,
            String topType,
            int topCount,
            Map<String, Integer> entityCounts) {

        private JsonObject toJson(List<PlayerChunk> players) {
            JsonObject o = new JsonObject();
            o.addProperty("dimension", dimension);
            o.addProperty("chunk_x", chunkX);
            o.addProperty("chunk_z", chunkZ);
            o.addProperty("block_x_min", chunkX * 16);
            o.addProperty("block_x_max", chunkX * 16 + 15);
            o.addProperty("block_z_min", chunkZ * 16);
            o.addProperty("block_z_max", chunkZ * 16 + 15);
            o.addProperty("total_entities", totalEntities);
            if (topType != null) {
                o.addProperty("top_type", topType);
                o.addProperty("top_count", topCount);
            }
            JsonArray counts = entityCountRows(entityCounts == null ? Map.of() : entityCounts, 0);
            if (!counts.isEmpty()) {
                o.add("entity_counts", counts);
            }
            int sameDimensionPlayers = 0;
            if (players != null) {
                for (PlayerChunk player : players) {
                    if (dimension.equals(player.dimension())) {
                        sameDimensionPlayers += Math.max(0, player.count());
                    }
                }
            }
            o.addProperty("same_dimension_players", sameDimensionPlayers);
            Integer nearest = nearestPlayerDistance(players);
            if (nearest != null) {
                o.addProperty("nearest_player_chunk_distance", nearest);
            }
            return o;
        }

        private Integer nearestPlayerDistance(List<PlayerChunk> players) {
            if (players == null || players.isEmpty()) {
                return null;
            }
            int best = Integer.MAX_VALUE;
            boolean found = false;
            for (PlayerChunk player : players) {
                if (!dimension.equals(player.dimension())) {
                    continue;
                }
                int distance = Math.max(Math.abs(chunkX - player.chunkX()), Math.abs(chunkZ - player.chunkZ()));
                if (distance < best) {
                    best = distance;
                    found = true;
                }
            }
            return found ? best : null;
        }
    }

    private static JsonObject rollingAverageJson(SparkProtos.RollingAverageValues values) {
        JsonObject out = new JsonObject();
        if (values == null) {
            return out;
        }
        addNonnegative(out, "mean", round2(values.getMean()));
        addNonnegative(out, "max", round2(values.getMax()));
        addNonnegative(out, "min", round2(values.getMin()));
        addNonnegative(out, "median", round2(values.getMedian()));
        addNonnegative(out, "p95", round2(values.getPercentile95()));
        return out;
    }

    private static JsonObject buildSystem(SparkSamplerProtos.SamplerMetadata meta) {
        JsonObject sys = new JsonObject();
        if (!meta.hasSystemStatistics()) {
            return sys;
        }
        SparkProtos.SystemStatistics stats = meta.getSystemStatistics();
        if (stats.hasCpu()) {
            JsonObject cpu = new JsonObject();
            cpu.addProperty("usage_unit", "percent");
            if (stats.getCpu().hasProcessUsage()) {
                addNonnegative(cpu, "process_1m", usagePercent(stats.getCpu().getProcessUsage().getLast1M()));
                addNonnegative(cpu, "process_15m", usagePercent(stats.getCpu().getProcessUsage().getLast15M()));
            }
            if (stats.getCpu().hasSystemUsage()) {
                addNonnegative(cpu, "system_1m", usagePercent(stats.getCpu().getSystemUsage().getLast1M()));
                addNonnegative(cpu, "system_15m", usagePercent(stats.getCpu().getSystemUsage().getLast15M()));
            }
            if (stats.getCpu().getThreads() > 0) {
                cpu.addProperty("threads", stats.getCpu().getThreads());
            }
            if (!stats.getCpu().getModelName().isBlank()) {
                cpu.addProperty("model", stats.getCpu().getModelName());
            }
            sys.add("cpu", cpu);
        }
        if (stats.hasMemory()) {
            JsonObject mem = new JsonObject();
            if (stats.getMemory().hasPhysical()) {
                long used = stats.getMemory().getPhysical().getUsed();
                long total = stats.getMemory().getPhysical().getTotal();
                addBytesGb(mem, "physical_used_gb", used);
                addBytesGb(mem, "physical_total_gb", total);
            }
            if (stats.getMemory().hasSwap()) {
                addBytesGb(mem, "swap_used_gb", stats.getMemory().getSwap().getUsed());
                addBytesGb(mem, "swap_total_gb", stats.getMemory().getSwap().getTotal());
            }
            if (!mem.entrySet().isEmpty()) {
                sys.add("memory", mem);
            }
        }
        if (stats.hasDisk()) {
            JsonObject disk = new JsonObject();
            long total = stats.getDisk().getTotal();
            long used = stats.getDisk().getUsed();
            if (total > 0 && used >= 0) {
                disk.addProperty("used_pct", round2(used * 100.0 / total));
                disk.addProperty("used_bytes", used);
                disk.addProperty("total_bytes", total);
                addBytesGb(disk, "used_gb", used);
                addBytesGb(disk, "total_gb", total);
            }
            if (!disk.entrySet().isEmpty()) {
                sys.add("disk", disk);
            }
        }
        if (!stats.getNetMap().isEmpty()) {
            JsonObject network = new JsonObject();
            SparkProtos.SystemStatistics.NetInterface primary = null;
            String primaryName = null;
            for (Map.Entry<String, SparkProtos.SystemStatistics.NetInterface> entry
                    : new TreeMap<>(stats.getNetMap()).entrySet()) {
                if ("lo".equals(entry.getKey())) {
                    continue;
                }
                primary = entry.getValue();
                primaryName = entry.getKey();
                break;
            }
            if (primary == null) {
                Map.Entry<String, SparkProtos.SystemStatistics.NetInterface> first =
                        stats.getNetMap().entrySet().iterator().next();
                primary = first.getValue();
                primaryName = first.getKey();
            }
            if (primaryName != null) {
                network.addProperty("interface", primaryName);
            }
            if (primary.hasTxBytesPerSecond()) {
                JsonObject tx = rollingAverageJson(primary.getTxBytesPerSecond());
                if (!tx.entrySet().isEmpty()) {
                    network.add("tx_bytes_per_sec", tx);
                    if (tx.has("mean")) {
                        network.addProperty("tx_mb_per_sec_mean", round2(tx.get("mean").getAsDouble() / (1024.0 * 1024.0)));
                    }
                    if (tx.has("max")) {
                        network.addProperty("tx_mb_per_sec_max", round2(tx.get("max").getAsDouble() / (1024.0 * 1024.0)));
                    }
                }
            }
            if (primary.hasRxBytesPerSecond()) {
                JsonObject rx = rollingAverageJson(primary.getRxBytesPerSecond());
                if (!rx.entrySet().isEmpty()) {
                    network.add("rx_bytes_per_sec", rx);
                    if (rx.has("mean")) {
                        network.addProperty("rx_kb_per_sec_mean", round2(rx.get("mean").getAsDouble() / 1024.0));
                    }
                }
            }
            if (!network.entrySet().isEmpty()) {
                sys.add("network", network);
            }
        }
        if (!stats.getGcMap().isEmpty()) {
            JsonObject gc = buildSystemGc(stats.getGcMap());
            if (!gc.entrySet().isEmpty()) {
                sys.add("gc", gc);
            }
        }
        if (stats.hasOs()) {
            JsonObject os = new JsonObject();
            addNonblank(os, "name", stats.getOs().getName());
            addNonblank(os, "version", stats.getOs().getVersion());
            addNonblank(os, "arch", stats.getOs().getArch());
            if (!os.entrySet().isEmpty()) {
                sys.add("os", os);
            }
        }
        if (stats.hasJava()) {
            JsonObject java = new JsonObject();
            addNonblank(java, "vendor", stats.getJava().getVendor());
            addNonblank(java, "version", stats.getJava().getVersion());
            addNonblank(java, "vendor_version", stats.getJava().getVendorVersion());
            addNonblank(java, "vm_args", stats.getJava().getVmArgs());
            if (!java.entrySet().isEmpty()) {
                sys.add("java", java);
            }
        }
        if (stats.hasJvm()) {
            JsonObject jvm = new JsonObject();
            addNonblank(jvm, "name", stats.getJvm().getName());
            addNonblank(jvm, "vendor", stats.getJvm().getVendor());
            addNonblank(jvm, "version", stats.getJvm().getVersion());
            if (!jvm.entrySet().isEmpty()) {
                sys.add("jvm", jvm);
            }
        }
        if (stats.getUptime() >= 0) {
            sys.addProperty("uptime_ms", stats.getUptime());
        }
        return sys;
    }

    private static JsonObject buildSystemGc(Map<String, SparkProtos.SystemStatistics.Gc> collectors) {
        JsonObject out = new JsonObject();
        JsonObject rows = new JsonObject();
        long totalCollections = 0;
        for (Map.Entry<String, SparkProtos.SystemStatistics.Gc> entry : new TreeMap<>(collectors).entrySet()) {
            SparkProtos.SystemStatistics.Gc value = entry.getValue();
            JsonObject row = new JsonObject();
            if (value.getTotal() >= 0) {
                row.addProperty("collections", value.getTotal());
                totalCollections += value.getTotal();
            }
            addNonnegative(row, "avg_time_ms", value.getAvgTime());
            addNonnegative(row, "avg_frequency_seconds", value.getAvgFrequency());
            if (!row.entrySet().isEmpty()) {
                rows.add(entry.getKey(), row);
            }
        }
        if (!rows.entrySet().isEmpty()) {
            out.addProperty("total_collections", totalCollections);
            out.add("collectors", rows);
        }
        return out;
    }

    private static JsonObject buildPlatformGc(Map<String, SparkProtos.PlatformStatistics.Gc> collectors) {
        JsonObject out = new JsonObject();
        JsonObject rows = new JsonObject();
        long totalCollections = 0;
        for (Map.Entry<String, SparkProtos.PlatformStatistics.Gc> entry : new TreeMap<>(collectors).entrySet()) {
            SparkProtos.PlatformStatistics.Gc value = entry.getValue();
            JsonObject row = new JsonObject();
            if (value.getTotal() >= 0) {
                row.addProperty("collections", value.getTotal());
                totalCollections += value.getTotal();
            }
            addNonnegative(row, "avg_time_ms", value.getAvgTime());
            addNonnegative(row, "avg_frequency_seconds", value.getAvgFrequency());
            if (!row.entrySet().isEmpty()) {
                rows.add(entry.getKey(), row);
            }
        }
        if (!rows.entrySet().isEmpty()) {
            out.addProperty("total_collections", totalCollections);
            out.add("collectors", rows);
        }
        return out;
    }

    private static JsonObject buildCapture(SparkSamplerProtos.SamplerMetadata meta) {
        JsonObject cap = new JsonObject();
        if (meta.hasCreator()) {
            cap.addProperty("creator", meta.getCreator().getName());
            cap.addProperty("creator_type", meta.getCreator().getType().name().toLowerCase(Locale.ROOT));
        }
        if (!meta.getComment().isBlank()) {
            cap.addProperty("comment", meta.getComment());
        }
        JsonObject settings = new JsonObject();
        addNonnegative(settings, "interval_us", meta.getInterval());
        settings.addProperty("engine", engineLabel(meta.getSamplerEngine()));
        settings.addProperty("async_engine",
                meta.getSamplerEngine() == SparkSamplerProtos.SamplerMetadata.SamplerEngine.ASYNC);
        if (!meta.getSamplerEngineVersion().isBlank()) {
            settings.addProperty("engine_version", meta.getSamplerEngineVersion());
        }
        if (meta.hasDataAggregator()) {
            SparkSamplerProtos.SamplerMetadata.DataAggregator agg = meta.getDataAggregator();
            settings.addProperty("aggregator",
                    agg.getType() == SparkSamplerProtos.SamplerMetadata.DataAggregator.Type.TICKED
                            ? "ticked" : "simple");
            settings.addProperty("thread_grouper", agg.getThreadGrouper().name().toLowerCase(Locale.ROOT));
            if (agg.getTickLengthThreshold() >= 0) {
                settings.addProperty("tick_length_threshold", agg.getTickLengthThreshold());
            }
            if (agg.getNumberOfIncludedTicks() >= 0) {
                settings.addProperty("included_ticks", agg.getNumberOfIncludedTicks());
            }
        }
        if (meta.hasThreadDumper()) {
            SparkSamplerProtos.SamplerMetadata.ThreadDumper dumper = meta.getThreadDumper();
            String filter = switch (dumper.getType()) {
                case SPECIFIC -> "specific";
                case REGEX -> "regex";
                default -> "all";
            };
            settings.addProperty("thread_filter", filter);
            if (dumper.getPatternsCount() > 0) {
                settings.addProperty("thread_pattern_count", dumper.getPatternsCount());
            }
            if (dumper.getIdsCount() > 0) {
                settings.addProperty("thread_id_count", dumper.getIdsCount());
            }
        }
        cap.add("profiler_settings", settings);
        if (!meta.getServerConfigurationsMap().isEmpty()) {
            JsonObject configs = new JsonObject();
            meta.getServerConfigurationsMap().forEach(configs::addProperty);
            cap.add("server_configurations", configs);
            String properties = meta.getServerConfigurationsMap().get("server.properties");
            JsonObject selected = selectedServerProperties(properties);
            if (!selected.entrySet().isEmpty()) {
                cap.add("selected_server_properties", selected);
            }
        }
        JsonArray datapacks = buildDatapacks(meta);
        if (!datapacks.isEmpty()) {
            cap.add("datapacks", datapacks);
        }
        return cap;
    }

    private static JsonObject selectedServerProperties(String propertiesJson) {
        JsonObject out = new JsonObject();
        if (propertiesJson == null || propertiesJson.isBlank()) {
            return out;
        }
        try {
            JsonObject parsed = com.google.gson.JsonParser.parseString(propertiesJson).getAsJsonObject();
            for (String key : SELECTED_SERVER_PROPERTY_KEYS) {
                if (SECRET_SERVER_PROPERTY_KEYS.contains(key)) {
                    continue;
                }
                if (!parsed.has(key) || parsed.get(key).isJsonNull()) {
                    continue;
                }
                JsonElement value = parsed.get(key);
                if (value.isJsonPrimitive()) {
                    out.add(key, value);
                }
            }
        } catch (Exception ignored) {
            return out;
        }
        return out;
    }

    private static JsonArray buildTimeline(SparkSamplerProtos.SamplerData data) {
        JsonArray timeline = new JsonArray();
        if (data.getTimeWindowStatisticsMap().isEmpty()) {
            return timeline;
        }
        TreeMap<Integer, SparkProtos.WindowStatistics> sorted = new TreeMap<>(data.getTimeWindowStatisticsMap());
        for (Map.Entry<Integer, SparkProtos.WindowStatistics> e : sorted.entrySet()) {
            SparkProtos.WindowStatistics w = e.getValue();
            JsonObject row = new JsonObject();
            row.addProperty("window", e.getKey());
            addNonnegative(row, "ticks", w.getTicks());
            addNonnegative(row, "tps", round2(w.getTps()));
            addNonnegative(row, "mspt_median", round2(w.getMsptMedian()));
            addNonnegative(row, "mspt_max", round2(w.getMsptMax()));
            addNonnegative(row, "players", w.getPlayers());
            addNonnegative(row, "entities", w.getEntities());
            addNonnegative(row, "tile_entities", w.getTileEntities());
            addNonnegative(row, "chunks", w.getChunks());
            if (w.getCpuProcess() >= 0) {
                row.addProperty("cpu_process", usagePercent(w.getCpuProcess()));
                row.addProperty("cpu_unit", "percent");
            }
            if (w.getStartTime() > 0) {
                row.addProperty("start_at", SparkProfileFacts.formatCapturedAt(Instant.ofEpochMilli(w.getStartTime())));
            }
            if (w.getEndTime() > 0) {
                row.addProperty("end_at", SparkProfileFacts.formatCapturedAt(Instant.ofEpochMilli(w.getEndTime())));
            }
            timeline.add(row);
        }
        return timeline;
    }

    private static JsonObject buildCallTree(
            SparkSamplerProtos.SamplerData data,
            List<AnalyzedThread> threads,
            double normalizationWeight) {
        JsonObject out = new JsonObject();
        out.addProperty("bounded", false);
        out.addProperty("max_nodes", MAX_TREE_NODES);
        out.addProperty("max_depth", MAX_TREE_DEPTH);
        out.addProperty("max_children_per_node", MAX_TREE_CHILDREN);
        out.addProperty("normalization", "selected_server_thread_root");
        out.addProperty("normalization_value", round2(normalizationWeight));
        boolean allocation = data.hasMetadata()
                && data.getMetadata().getSamplerMode() == SparkSamplerProtos.SamplerMetadata.SamplerMode.ALLOCATION;
        out.addProperty("value_unit", allocation ? "bytes" : "ms");
        JsonArray windows = new JsonArray();
        data.getTimeWindowsList().forEach(windows::add);
        out.add("time_windows", windows);

        TreeBudget budget = new TreeBudget(MAX_TREE_NODES);
        JsonArray rows = new JsonArray();
        for (int threadIndex = 0; threadIndex < threads.size(); threadIndex++) {
            AnalyzedThread thread = threads.get(threadIndex);
            JsonObject row = new JsonObject();
            String threadId = "thread-" + threadIndex;
            row.addProperty("id", threadId);
            row.addProperty("name", thread.name());
            row.addProperty("selected", thread.selected);
            addWeights(row, thread.inclusive, thread.self, normalizationWeight);
            List<AnalyzedNode> rankedRoots = new ArrayList<>(thread.roots);
            rankedRoots.sort(Comparator.comparingDouble(AnalyzedNode::inclusiveTotal).reversed());
            JsonArray children = new JsonArray();
            for (int rootIndex = 0; rootIndex < rankedRoots.size(); rootIndex++) {
                AnalyzedNode root = rankedRoots.get(rootIndex);
                JsonObject child = treeNodeJson(root, normalizationWeight, budget, 0,
                        threadId + ":node-" + rootIndex, threadId);
                if (child != null) {
                    children.add(child);
                }
            }
            row.add("children", children);
            int omitted = Math.max(0, rankedRoots.size() - children.size());
            if (omitted > 0) {
                row.addProperty("truncated_children", omitted);
            }
            rows.add(row);
        }
        out.add("threads", rows);
        int emitted = MAX_TREE_NODES - budget.remaining;
        out.addProperty("nodes_emitted", emitted);
        out.addProperty("truncated", budget.truncated);
        if (budget.truncated) {
            out.addProperty("bounded", true);
        }
        return out;
    }

    private static JsonObject treeNodeJson(
            AnalyzedNode node,
            double normalizationWeight,
            TreeBudget budget,
            int depth,
            String nodeId,
            String parentId) {
        if (depth >= MAX_TREE_DEPTH || budget.remaining <= 0) {
            budget.truncated = true;
            return null;
        }
        budget.remaining--;
        JsonObject out = new JsonObject();
        out.addProperty("id", nodeId);
        out.addProperty("parent_id", parentId);
        out.addProperty("class", node.className);
        out.addProperty("method", node.methodName);
        out.addProperty("mod_id", node.modId);
        if (node.methodDesc != null && !node.methodDesc.isBlank()) {
            out.addProperty("method_desc", node.methodDesc);
        }
        if (node.source != null) {
            out.addProperty("source", node.source);
        }
        if (node.line != null) {
            out.addProperty("line", node.line);
        }
        if (node.parentLine != null) {
            out.addProperty("parent_line", node.parentLine);
        }
        addWeights(out, node.inclusive, node.self, normalizationWeight);
        List<AnalyzedNode> rankedChildren = new ArrayList<>(node.children);
        rankedChildren.sort(Comparator.comparingDouble(AnalyzedNode::inclusiveTotal).reversed());
        JsonArray children = new JsonArray();
        int cap = Math.min(MAX_TREE_CHILDREN, rankedChildren.size());
        for (int i = 0; i < cap; i++) {
            JsonObject child = treeNodeJson(rankedChildren.get(i), normalizationWeight, budget, depth + 1,
                    nodeId + "." + i, nodeId);
            if (child == null) {
                break;
            }
            children.add(child);
        }
        out.add("children", children);
        int omitted = Math.max(0, rankedChildren.size() - children.size());
        if (omitted > 0) {
            out.addProperty("truncated_children", omitted);
            budget.truncated = true;
        }
        return out;
    }

    private static void addWeights(
            JsonObject out,
            double[] inclusive,
            double[] self,
            double normalizationWeight) {
        double inclusiveTotal = sum(inclusive);
        double selfTotal = sum(self);
        out.addProperty("inclusive_weight", round2(inclusiveTotal));
        out.addProperty("self_weight", round2(selfTotal));
        out.addProperty("involvement_pct", round2(inclusiveTotal * 100.0 / normalizationWeight));
        out.addProperty("own_pct", round2(selfTotal * 100.0 / normalizationWeight));
        out.add("inclusive_by_window", valuesJson(inclusive));
        out.add("self_by_window", valuesJson(self));
    }

    private static JsonArray valuesJson(double[] values) {
        JsonArray out = new JsonArray();
        for (double value : values) {
            out.add(round2(value));
        }
        return out;
    }

    private static JsonObject buildVerdict(JsonObject profile, Map<String, ModRollup> modRollups) {
        JsonObject verdict = new JsonObject();
        JsonObject ctx = profile.has("context") ? profile.getAsJsonObject("context") : new JsonObject();
        double tps = ctx.has("tps_1m") ? ctx.get("tps_1m").getAsDouble() : 20;
        double mspt = ctx.has("mspt_p95_1m") ? ctx.get("mspt_p95_1m").getAsDouble() : 0;
        double msptMean = ctx.has("mspt_mean_1m") ? ctx.get("mspt_mean_1m").getAsDouble() : 0;
        double msptMax5m = ctx.has("mspt_max_5m") ? ctx.get("mspt_max_5m").getAsDouble() : 0;

        String grade;
        if (tps < 12 || mspt > 100 || msptMax5m >= 1000) {
            grade = "critical";
        } else if (tps < 17 || mspt > 60 || msptMax5m >= 250) {
            grade = "degraded";
        } else {
            grade = "healthy";
        }
        verdict.addProperty("grade", grade);

        ModRollup topMod = modRollups.isEmpty() ? null : modRollups.values().iterator().next();
        boolean allocation = SparkProfileFacts.isAllocation(profile);
        String headline;
        if (topMod != null && topMod.pct >= 8
                && !Set.of("minecraft", "neoforge", "forge", "jvm", "native", "unknown")
                .contains(topMod.modId)) {
            if (allocation) {
                headline = String.format(Locale.US, "%s used the most sampled memory allocation",
                        topMod.modId);
            } else {
                headline = String.format(Locale.US, "%s used a large share of server time — check findings below",
                        topMod.modId);
            }
        } else if (grade.equals("healthy")) {
            headline = allocation
                    ? "No single mod dominated memory allocation in this capture"
                    : "Tick speed looked okay — still review findings below";
        } else {
            headline = allocation
                    ? "Heavy memory allocation — review the findings below"
                    : "Your server was lagging — start with the findings below";
        }
        verdict.addProperty("headline", headline);

        String summary;
        if (msptMean > 0) {
            summary = String.format(Locale.US, "TPS %.1f · typical tick %.0f ms · slow ticks (p95) %.0f ms",
                    tps, msptMean, mspt);
        } else {
            summary = String.format(Locale.US, "TPS %.1f · slow ticks (p95) %.0f ms", tps, mspt);
        }
        if (msptMax5m >= 1000) {
            summary += String.format(Locale.US, " · worst hitch %.1f s", msptMax5m / 1000.0);
        } else if (msptMax5m >= 250) {
            summary += String.format(Locale.US, " · worst recent tick %.0f ms", msptMax5m);
        }
        if (ctx.has("players")) {
            summary += String.format(Locale.US, " · %d players", ctx.get("players").getAsInt());
        }
        if (ctx.has("world_entities")) {
            summary += String.format(Locale.US, " · %d entities", ctx.get("world_entities").getAsInt());
        }
        verdict.addProperty("summary", summary);
        return verdict;
    }

    private static String engineLabel(SparkSamplerProtos.SamplerMetadata.SamplerEngine engine) {
        return engine == SparkSamplerProtos.SamplerMetadata.SamplerEngine.ASYNC ? "async" : "java";
    }

    private static void addNonnegative(JsonObject out, String key, double value) {
        if (Double.isFinite(value) && value >= 0) {
            out.addProperty(key, value);
        }
    }

    private static void addNonnegative(JsonObject out, String key, int value) {
        if (value >= 0) {
            out.addProperty(key, value);
        }
    }

    private static void addBytesMb(JsonObject out, String key, long bytes) {
        if (bytes >= 0) {
            out.addProperty(key, round2(bytes / (1024.0 * 1024.0)));
        }
    }

    private static void addBytesGb(JsonObject out, String key, long bytes) {
        if (bytes >= 0) {
            out.addProperty(key, round2(bytes / (1024.0 * 1024.0 * 1024.0)));
        }
    }

    private static void addNonblank(JsonObject out, String key, String value) {
        if (value != null && !value.isBlank()) {
            out.addProperty(key, value);
        }
    }

    private static double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }

    private static double usagePercent(double ratio) {
        return ratio < 0 ? ratio : round2(ratio * 100.0);
    }

    private static final class MethodFrame {
        private final String className;
        private final String methodName;
        private final String methodDesc;
        private final String modId;
        private final double selfWeight;
        private final double inclusiveWeight;
        private final List<String> parentChain;
        private final String source;
        private final Integer line;
        private final Integer parentLine;
        private final boolean involvementRoot;

        private MethodFrame(
                String className,
                String methodName,
                String methodDesc,
                String modId,
                double selfWeight,
                double inclusiveWeight,
                List<String> parentChain,
                String source,
                Integer line,
                Integer parentLine,
                boolean involvementRoot) {
            this.className = className;
            this.methodName = methodName;
            this.methodDesc = methodDesc;
            this.modId = modId;
            this.selfWeight = selfWeight;
            this.inclusiveWeight = inclusiveWeight;
            this.parentChain = parentChain == null ? List.of() : List.copyOf(parentChain);
            this.source = source;
            this.line = line;
            this.parentLine = parentLine;
            this.involvementRoot = involvementRoot;
        }

        private double selfWeight() {
            return selfWeight;
        }

        private String className() {
            return className;
        }

        private String methodName() {
            return methodName;
        }

        private String modId() {
            return modId;
        }

        private JsonObject toJson(double totalWeight) {
            JsonObject o = new JsonObject();
            double pct = totalWeight > 0 ? (selfWeight / totalWeight) * 100.0 : 0;
            o.addProperty("pct", round2(pct));
            o.addProperty("weight", Math.round(selfWeight));
            o.addProperty("own_pct", round2(pct));
            o.addProperty("involvement_pct", round2(inclusiveWeight * 100.0 / totalWeight));
            o.addProperty("self_weight", round2(selfWeight));
            o.addProperty("inclusive_weight", round2(inclusiveWeight));
            o.addProperty("class", className);
            o.addProperty("method", methodName);
            if (methodDesc != null && !methodDesc.isBlank()) {
                o.addProperty("method_desc", methodDesc);
            }
            o.addProperty("mod_id", modId);
            String simple = className.contains(".") ? className.substring(className.lastIndexOf('.') + 1) : className;
            o.addProperty("label", modId + " · " + simple + "." + methodName);
            if (source != null) {
                o.addProperty("source", source);
            }
            if (line != null) {
                o.addProperty("line", line);
            }
            if (parentLine != null) {
                o.addProperty("parent_line", parentLine);
            }
            if (!parentChain.isEmpty()) {
                JsonArray chain = new JsonArray();
                parentChain.forEach(chain::add);
                o.add("parent_chain", chain);
            }
            return o;
        }
    }

    private record ThreadRollup(String name, double weight) {
    }

    private static final class ModRollup {
        private final String modId;
        private double weightSum;
        private double involvementWeightSum;
        private double pct;
        private double involvementPct;
        private int methodCount;
        private String topLabel = "";
        private double topWeight = -1;

        private ModRollup(String modId) {
            this.modId = modId;
        }

        private void add(MethodFrame frame, double totalWeight) {
            weightSum += frame.selfWeight;
            if (frame.involvementRoot) {
                involvementWeightSum += frame.inclusiveWeight;
            }
            methodCount++;
            pct = totalWeight > 0 ? (weightSum / totalWeight) * 100.0 : 0;
            involvementPct = totalWeight > 0
                    ? Math.min(100.0, (involvementWeightSum / totalWeight) * 100.0)
                    : 0;
            if (frame.selfWeight > topWeight) {
                String simple = frame.className.contains(".")
                        ? frame.className.substring(frame.className.lastIndexOf('.') + 1)
                        : frame.className;
                topLabel = simple + "." + frame.methodName;
                topWeight = frame.selfWeight;
            }
        }

        private double pct() {
            return pct;
        }

        private JsonObject toRollupJson(JsonObject modCatalog) {
            JsonObject o = new JsonObject();
            o.addProperty("mod_id", modId);
            o.addProperty("pct", round2(pct));
            o.addProperty("own_pct", round2(pct));
            o.addProperty("involvement_pct", round2(involvementPct));
            o.addProperty("method_count", methodCount);
            o.addProperty("top_label", topLabel);
            o.addProperty("attribution",
                    "unknown".equals(modId) || "native".equals(modId)
                            ? "unattributed"
                            : modCatalog != null && modCatalog.has(modId)
                            && modCatalog.getAsJsonObject(modId).has("attribution")
                            ? modCatalog.getAsJsonObject(modId).get("attribution").getAsString()
                            : "spark_class_sources");
            String dn = displayName(modId, modCatalog);
            if (dn != null) {
                o.addProperty("display_name", dn);
            }
            return o;
        }

        private JsonObject toHintJson(boolean allocation, JsonObject modCatalog) {
            JsonObject o = new JsonObject();
            o.addProperty("mod_id", modId);
            o.addProperty("pct", round2(pct));
            String summary = allocation
                    ? topLabel + " had the highest observed exclusive allocation share"
                    : topLabel + " had the highest observed exclusive Server thread share";
            o.addProperty("summary", summary);
            String dn = displayName(modId, modCatalog);
            if (dn != null) {
                o.addProperty("display_name", dn);
            }
            return o;
        }
    }

    private static final class AnalyzedThread {
        private final String name;
        private final double[] inclusive;
        private final double[] self;
        private final List<AnalyzedNode> roots;
        private final List<MethodFrame> frames;
        private boolean selected;

        private AnalyzedThread(
                String name,
                double[] inclusive,
                double[] self,
                List<AnalyzedNode> roots,
                List<MethodFrame> frames) {
            this.name = name;
            this.inclusive = inclusive;
            this.self = self;
            this.roots = roots;
            this.frames = frames;
        }

        private String name() {
            return name;
        }

        private double inclusiveTotal() {
            return sum(inclusive);
        }

        private List<MethodFrame> frames() {
            return frames;
        }
    }

    private static final class AnalyzedNode {
        private final String className;
        private final String methodName;
        private final String methodDesc;
        private final String modId;
        private final String source;
        private final Integer line;
        private final Integer parentLine;
        private final double[] inclusive;
        private final double[] self;
        private final List<AnalyzedNode> children;

        private AnalyzedNode(
                String className,
                String methodName,
                String methodDesc,
                String modId,
                String source,
                Integer line,
                Integer parentLine,
                double[] inclusive,
                double[] self,
                List<AnalyzedNode> children) {
            this.className = className;
            this.methodName = methodName;
            this.methodDesc = methodDesc;
            this.modId = modId;
            this.source = source;
            this.line = line;
            this.parentLine = parentLine;
            this.inclusive = inclusive;
            this.self = self;
            this.children = children;
        }

        private double inclusiveTotal() {
            return sum(inclusive);
        }
    }

    private static final class TreeBudget {
        private int remaining;
        private boolean truncated;

        private TreeBudget(int remaining) {
            this.remaining = remaining;
        }
    }
}
