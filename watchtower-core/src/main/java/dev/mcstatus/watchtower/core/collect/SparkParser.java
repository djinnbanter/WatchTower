package dev.mcstatus.watchtower.core.collect;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.report.ReportConfig;
import me.lucko.spark.proto.SparkProtos;
import me.lucko.spark.proto.SparkSamplerProtos;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
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
    private static final int TOP_ENTITY_HOTSPOTS = 8;
    private static final int MAX_SOURCE_LEN = 120;
    private static final double OTHER_THREAD_MIN_PCT = 2.0;

    private SparkParser() {
    }

    public static JsonObject toFacts(SparkCollectResult result, ReportConfig config) {
        if (result == null || result.data() == null) {
            return null;
        }
        SparkSamplerProtos.SamplerData data = result.data();
        SparkSamplerProtos.SamplerMetadata meta = data.hasMetadata() ? data.getMetadata() : null;

        JsonObject out = new JsonObject();
        out.addProperty("captured_at", SparkProfileFacts.formatCapturedAt(result.capturedAt()));
        out.addProperty("source_file", result.sourceFile());
        out.addProperty("source_kind", result.sourceKind());
        out.addProperty("source_path", result.sourcePath().toString().replace('\\', '/'));
        String viewerUrl = SparkBytebinUrls.viewerUrl(result.sourceFile());
        if (viewerUrl != null) {
            out.addProperty("spark_viewer_url", viewerUrl);
            String rawUrl = SparkBytebinUrls.rawJsonUrl(result.sourceFile());
            if (rawUrl != null) {
                out.addProperty("spark_raw_url", rawUrl);
            }
        }

        int freshHours = config.sparkFreshHours();
        boolean fresh = java.time.Duration.between(result.capturedAt(), java.time.Instant.now()).toHours() < freshHours;
        out.addProperty("fresh", fresh);

        boolean allocation = false;
        JsonObject modCatalog = new JsonObject();
        if (meta != null) {
            allocation = meta.getSamplerMode() == SparkSamplerProtos.SamplerMetadata.SamplerMode.ALLOCATION;
            modCatalog = buildModCatalog(meta);
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

        List<MethodFrame> frames = new ArrayList<>();
        JsonArray threads = new JsonArray();
        List<ThreadRollup> otherThreads = new ArrayList<>();
        double allThreadWeight = 0;
        for (SparkSamplerProtos.ThreadNode thread : data.getThreadsList()) {
            threads.add(thread.getName());
            List<MethodFrame> threadFrames = new ArrayList<>();
            walkThread(thread, classSources, methodSources, lineSources, threadFrames, 0, new ArrayList<>());
            double threadTotal = threadFrames.stream().mapToDouble(MethodFrame::weight).sum();
            allThreadWeight += threadTotal;
            if (isServerThread(thread.getName())) {
                frames.addAll(threadFrames);
            } else if (threadTotal > 0) {
                otherThreads.add(new ThreadRollup(thread.getName(), threadTotal));
            }
        }
        out.add("threads_analyzed", threads);

        double totalWeight = frames.stream().mapToDouble(MethodFrame::weight).sum();
        if (totalWeight <= 0) {
            totalWeight = 1;
        }
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

        if (totalWeight <= 0) {
            totalWeight = 1;
        }

        frames.sort(Comparator.comparingDouble(MethodFrame::weight).reversed());
        JsonArray topMethods = new JsonArray();
        int methodCap = Math.min(TOP_METHODS, frames.size());
        for (int i = 0; i < methodCap; i++) {
            topMethods.add(frames.get(i).toJson(totalWeight));
        }
        out.add("top_methods", topMethods);

        JsonObject deep = new JsonObject();
        JsonArray deepMethods = new JsonArray();
        int deepCap = Math.min(DEEP_METHODS, frames.size());
        for (int i = 0; i < deepCap; i++) {
            deepMethods.add(frames.get(i).toJson(totalWeight));
        }
        deep.add("top_methods", deepMethods);
        out.add("deep", deep);

        Map<String, ModRollup> modRollups = rollupMods(frames, totalWeight);
        JsonArray modRollupsJson = new JsonArray();
        JsonArray modHints = new JsonArray();
        int hintCount = 0;
        for (ModRollup rollup : modRollups.values()) {
            modRollupsJson.add(rollup.toRollupJson(modCatalog));
            if (hintCount < MOD_HINTS) {
                modHints.add(rollup.toHintJson(allocation, modCatalog));
                hintCount++;
            }
        }
        out.add("mod_rollups", modRollupsJson);
        out.add("mod_hints", modHints);

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

    private static void walkThread(
            SparkSamplerProtos.ThreadNode thread,
            Map<String, String> classSources,
            Map<String, String> methodSources,
            Map<String, String> lineSources,
            List<MethodFrame> out,
            int depth,
            List<String> parentChain) {
        List<SparkSamplerProtos.StackTraceNode> nodes = thread.getChildrenList();
        for (int ref : thread.getChildrenRefsList()) {
            if (ref >= 0 && ref < nodes.size()) {
                walkNode(nodes, ref, classSources, methodSources, lineSources, out, depth, parentChain);
            }
        }
    }

    private static void walkNode(
            List<SparkSamplerProtos.StackTraceNode> nodes,
            int index,
            Map<String, String> classSources,
            Map<String, String> methodSources,
            Map<String, String> lineSources,
            List<MethodFrame> out,
            int depth,
            List<String> parentChain) {
        if (index < 0 || index >= nodes.size()) {
            return;
        }
        SparkSamplerProtos.StackTraceNode node = nodes.get(index);
        double weight = sumTimes(node.getTimesList());
        String className = node.getClassName();
        String methodName = node.getMethodName();
        String methodDesc = node.getMethodDesc();

        boolean hasChildren = node.getChildrenRefsCount() > 0;
        if (!shouldSkipFrame(className, methodName, depth, hasChildren) && weight > 0) {
            String modId = resolveMod(className, classSources);
            String source = resolveSource(className, methodName, methodDesc, node.getLineNumber(),
                    methodSources, lineSources);
            Integer line = node.getLineNumber() > 0 ? node.getLineNumber() : null;
            out.add(new MethodFrame(className, methodName, modId, weight, parentChain, source, line));
        }

        String simple = className.contains(".") ? className.substring(className.lastIndexOf('.') + 1) : className;
        List<String> childChain = new ArrayList<>(parentChain);
        childChain.add(simple + "." + methodName);
        for (int ref : node.getChildrenRefsList()) {
            walkNode(nodes, ref, classSources, methodSources, lineSources, out, depth + 1, childChain);
        }
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
            if (!row.entrySet().isEmpty()) {
                catalog.add(e.getKey(), row);
            }
        }
        return catalog;
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
        if (className.startsWith("java.") || className.startsWith("jdk.") || className.startsWith("sun.")) {
            return true;
        }
        if (depth == 0 && hasChildren && className.contains("MinecraftServer") && "runServer".equals(methodName)) {
            return true;
        }
        return false;
    }

    private static double sumTimes(List<Double> times) {
        double sum = 0;
        for (double t : times) {
            sum += t;
        }
        return sum;
    }

    private static String resolveMod(String className, Map<String, String> classSources) {
        if (className == null) {
            return "unknown";
        }
        String mod = classSources.get(className);
        if (mod != null && !mod.isBlank()) {
            return mod;
        }
        if (className.startsWith("net.minecraft")) {
            return "minecraft";
        }
        if (className.startsWith("net.neoforged") || className.startsWith("net.minecraftforge")) {
            return "neoforge";
        }
        int dot = className.indexOf('.');
        if (dot > 0) {
            return className.substring(0, dot);
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

    private static JsonObject buildWindow(SparkSamplerProtos.SamplerMetadata meta) {
        JsonObject w = new JsonObject();
        w.addProperty("start_ms", meta.getStartTime());
        w.addProperty("end_ms", meta.getEndTime());
        w.addProperty("ticks", meta.getNumberOfTicks());
        w.addProperty("sample_interval_us", meta.getInterval());
        if (meta.getEndTime() > meta.getStartTime()) {
            w.addProperty("duration_sec", (meta.getEndTime() - meta.getStartTime()) / 1000.0);
        }
        return w;
    }

    private static JsonObject buildPlatform(SparkSamplerProtos.SamplerMetadata meta) {
        JsonObject p = new JsonObject();
        if (meta.hasPlatformMetadata()) {
            SparkProtos.PlatformMetadata pm = meta.getPlatformMetadata();
            p.addProperty("loader", pm.getName());
            p.addProperty("loader_version", pm.getVersion());
            p.addProperty("minecraft", pm.getMinecraftVersion());
            p.addProperty("spark_version", pm.getSparkVersion());
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
            ctx.addProperty("tps_1m", round2(stats.getTps().getLast1M()));
            ctx.addProperty("tps_5m", round2(stats.getTps().getLast5M()));
            ctx.addProperty("tps_15m", round2(stats.getTps().getLast15M()));
        }
        if (stats.hasMspt()) {
            if (stats.getMspt().hasLast1M()) {
                ctx.addProperty("mspt_p95_1m", round2(stats.getMspt().getLast1M().getPercentile95()));
                ctx.addProperty("mspt_median_1m", round2(stats.getMspt().getLast1M().getMedian()));
            }
            if (stats.getMspt().hasLast5M()) {
                ctx.addProperty("mspt_p95_5m", round2(stats.getMspt().getLast5M().getPercentile95()));
            }
        }
        if (stats.hasMemory() && stats.getMemory().hasHeap()) {
            var heap = stats.getMemory().getHeap();
            JsonObject heapJson = new JsonObject();
            heapJson.addProperty("used_mb", round2(heap.getUsed() / (1024.0 * 1024.0)));
            if (heap.getMax() > 0) {
                heapJson.addProperty("max_mb", round2(heap.getMax() / (1024.0 * 1024.0)));
            }
            ctx.add("jvm_heap", heapJson);
        }
        if (stats.getPlayerCount() > 0) {
            ctx.addProperty("players", stats.getPlayerCount());
        }
        if (stats.hasWorld()) {
            ctx.addProperty("world_entities", stats.getWorld().getTotalEntities());
            JsonArray topEntities = new JsonArray();
            stats.getWorld().getEntityCountsMap().entrySet().stream()
                    .sorted(Map.Entry.<String, Integer>comparingByValue().reversed())
                    .limit(TOP_ENTITIES)
                    .forEach(e -> {
                        JsonObject row = new JsonObject();
                        row.addProperty("id", e.getKey());
                        row.addProperty("count", e.getValue());
                        topEntities.add(row);
                    });
            ctx.add("top_entities", topEntities);
            JsonArray hotspots = buildEntityHotspots(stats.getWorld());
            if (!hotspots.isEmpty()) {
                ctx.add("entity_hotspots", hotspots);
            }
        }
        return ctx;
    }

    private static JsonArray buildEntityHotspots(SparkProtos.WorldStatistics world) {
        JsonArray out = new JsonArray();
        if (world == null) {
            return out;
        }
        List<EntityHotspot> rows = new ArrayList<>();
        for (SparkProtos.WorldStatistics.World w : world.getWorldsList()) {
            String dimension = w.getName();
            for (SparkProtos.WorldStatistics.Region region : w.getRegionsList()) {
                for (SparkProtos.WorldStatistics.Chunk chunk : region.getChunksList()) {
                    if (chunk.getTotalEntities() <= 0) {
                        continue;
                    }
                    String topType = null;
                    int topCount = 0;
                    for (Map.Entry<String, Integer> ent : chunk.getEntityCountsMap().entrySet()) {
                        if (ent.getValue() > topCount) {
                            topCount = ent.getValue();
                            topType = ent.getKey();
                        }
                    }
                    rows.add(new EntityHotspot(dimension, chunk.getX(), chunk.getZ(),
                            chunk.getTotalEntities(), topType, topCount));
                }
            }
        }
        rows.sort(Comparator.comparingInt(EntityHotspot::totalEntities).reversed());
        int cap = Math.min(TOP_ENTITY_HOTSPOTS, rows.size());
        for (int i = 0; i < cap; i++) {
            out.add(rows.get(i).toJson());
        }
        return out;
    }

    private record EntityHotspot(
            String dimension,
            int chunkX,
            int chunkZ,
            int totalEntities,
            String topType,
            int topCount) {

        private JsonObject toJson() {
            JsonObject o = new JsonObject();
            o.addProperty("dimension", dimension);
            o.addProperty("chunk_x", chunkX);
            o.addProperty("chunk_z", chunkZ);
            o.addProperty("total_entities", totalEntities);
            if (topType != null) {
                o.addProperty("top_type", topType);
                o.addProperty("top_count", topCount);
            }
            return o;
        }
    }

    private static JsonObject buildSystem(SparkSamplerProtos.SamplerMetadata meta) {
        JsonObject sys = new JsonObject();
        if (!meta.hasSystemStatistics()) {
            return sys;
        }
        SparkProtos.SystemStatistics stats = meta.getSystemStatistics();
        if (stats.hasCpu()) {
            JsonObject cpu = new JsonObject();
            if (stats.getCpu().hasProcessUsage()) {
                cpu.addProperty("process_1m", round2(stats.getCpu().getProcessUsage().getLast1M()));
            }
            if (stats.getCpu().hasSystemUsage()) {
                cpu.addProperty("system_1m", round2(stats.getCpu().getSystemUsage().getLast1M()));
            }
            if (stats.getCpu().getThreads() > 0) {
                cpu.addProperty("threads", stats.getCpu().getThreads());
            }
            sys.add("cpu", cpu);
        }
        if (stats.hasMemory()) {
            JsonObject mem = new JsonObject();
            if (stats.getMemory().hasPhysical()) {
                long used = stats.getMemory().getPhysical().getUsed();
                long total = stats.getMemory().getPhysical().getTotal();
                if (total > 0) {
                    mem.addProperty("physical_used_gb", round2(used / (1024.0 * 1024.0 * 1024.0)));
                    mem.addProperty("physical_total_gb", round2(total / (1024.0 * 1024.0 * 1024.0)));
                }
            }
            if (!mem.entrySet().isEmpty()) {
                sys.add("memory", mem);
            }
        }
        if (stats.hasDisk()) {
            JsonObject disk = new JsonObject();
            long total = stats.getDisk().getTotal();
            if (total > 0) {
                disk.addProperty("used_pct", round2(stats.getDisk().getUsed() * 100.0 / total));
            }
            sys.add("disk", disk);
        }
        if (!stats.getGcMap().isEmpty()) {
            double gcTotalMs = 0;
            for (SparkProtos.SystemStatistics.Gc gc : stats.getGcMap().values()) {
                gcTotalMs += gc.getTotal();
            }
            if (gcTotalMs > 0) {
                JsonObject gc = new JsonObject();
                gc.addProperty("total_ms", Math.round(gcTotalMs));
                sys.add("gc", gc);
            }
        }
        return sys;
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
        settings.addProperty("interval_us", meta.getInterval());
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
        }
        return cap;
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
            row.addProperty("ticks", w.getTicks());
            row.addProperty("tps", round2(w.getTps()));
            row.addProperty("mspt_median", round2(w.getMsptMedian()));
            row.addProperty("mspt_max", round2(w.getMsptMax()));
            row.addProperty("players", w.getPlayers());
            row.addProperty("entities", w.getEntities());
            row.addProperty("tile_entities", w.getTileEntities());
            row.addProperty("chunks", w.getChunks());
            if (w.getCpuProcess() > 0) {
                row.addProperty("cpu_process", round2(w.getCpuProcess()));
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

    private static JsonObject buildVerdict(JsonObject profile, Map<String, ModRollup> modRollups) {
        JsonObject verdict = new JsonObject();
        JsonObject ctx = profile.has("context") ? profile.getAsJsonObject("context") : new JsonObject();
        double tps = ctx.has("tps_1m") ? ctx.get("tps_1m").getAsDouble() : 20;
        double mspt = ctx.has("mspt_p95_1m") ? ctx.get("mspt_p95_1m").getAsDouble() : 0;

        String grade;
        if (tps < 12 || mspt > 100) {
            grade = "critical";
        } else if (tps < 17 || mspt > 60) {
            grade = "degraded";
        } else {
            grade = "healthy";
        }
        verdict.addProperty("grade", grade);

        ModRollup topMod = modRollups.isEmpty() ? null : modRollups.values().iterator().next();
        boolean allocation = SparkProfileFacts.isAllocation(profile);
        String headline;
        if (topMod != null && topMod.pct >= 8 && !"minecraft".equals(topMod.modId) && !"neoforge".equals(topMod.modId)) {
            if (allocation) {
                headline = String.format(Locale.US, "%s had highest allocation share during capture",
                        topMod.modId);
            } else {
                headline = String.format(Locale.US, "%s dominated Server thread during %s lag",
                        topMod.modId, grade.equals("healthy") ? "mild" : grade);
            }
        } else if (grade.equals("healthy")) {
            headline = allocation
                    ? "No single mod dominated allocations — sample looked balanced"
                    : "No single mod dominated tick time — server looked healthy during capture";
        } else {
            headline = allocation
                    ? "Allocation pressure during capture — review hot sites below"
                    : "Tick lag during capture — review hot methods and entity pressure below";
        }
        verdict.addProperty("headline", headline);

        String summary = String.format(Locale.US, "TPS %.1f · MSPT p95 %.0fms",
                tps, mspt);
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

    private static double round2(double v) {
        return Math.round(v * 100.0) / 100.0;
    }

    private static final class MethodFrame {
        private final String className;
        private final String methodName;
        private final String modId;
        private final double weight;
        private final List<String> parentChain;
        private final String source;
        private final Integer line;

        private MethodFrame(
                String className,
                String methodName,
                String modId,
                double weight,
                List<String> parentChain,
                String source,
                Integer line) {
            this.className = className;
            this.methodName = methodName;
            this.modId = modId;
            this.weight = weight;
            this.parentChain = parentChain == null ? List.of() : List.copyOf(parentChain);
            this.source = source;
            this.line = line;
        }

        private double weight() {
            return weight;
        }

        private String modId() {
            return modId;
        }

        private JsonObject toJson(double totalWeight) {
            JsonObject o = new JsonObject();
            double pct = totalWeight > 0 ? (weight / totalWeight) * 100.0 : 0;
            o.addProperty("pct", round2(pct));
            o.addProperty("weight", Math.round(weight));
            o.addProperty("class", className);
            o.addProperty("method", methodName);
            o.addProperty("mod_id", modId);
            String simple = className.contains(".") ? className.substring(className.lastIndexOf('.') + 1) : className;
            o.addProperty("label", modId + " · " + simple + "." + methodName);
            if (source != null) {
                o.addProperty("source", source);
            }
            if (line != null) {
                o.addProperty("line", line);
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
        private double pct;
        private int methodCount;
        private String topLabel = "";

        private ModRollup(String modId) {
            this.modId = modId;
        }

        private void add(MethodFrame frame, double totalWeight) {
            weightSum += frame.weight;
            methodCount++;
            pct = totalWeight > 0 ? (weightSum / totalWeight) * 100.0 : 0;
            if (topLabel.isEmpty()) {
                String simple = frame.className.contains(".")
                        ? frame.className.substring(frame.className.lastIndexOf('.') + 1)
                        : frame.className;
                topLabel = simple + "." + frame.methodName;
            }
        }

        private double pct() {
            return pct;
        }

        private JsonObject toRollupJson(JsonObject modCatalog) {
            JsonObject o = new JsonObject();
            o.addProperty("mod_id", modId);
            o.addProperty("pct", round2(pct));
            o.addProperty("method_count", methodCount);
            o.addProperty("top_label", topLabel);
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
                    ? topLabel + " had highest allocation share"
                    : topLabel + " dominant on Server thread";
            o.addProperty("summary", summary);
            String dn = displayName(modId, modCatalog);
            if (dn != null) {
                o.addProperty("display_name", dn);
            }
            return o;
        }
    }
}
