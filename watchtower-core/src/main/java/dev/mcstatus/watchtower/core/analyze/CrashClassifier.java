package dev.mcstatus.watchtower.core.analyze;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Classifies crash reports into mod / host-resource / loader / unknown buckets with fix hints.
 */
public final class CrashClassifier {

    private static final Pattern MOD_LOADING = Pattern.compile(
            "Mod\\s+\\(([^)]+)\\)", Pattern.CASE_INSENSITIVE);
    private static final Pattern FML_MOD_ID = Pattern.compile(
            "mod id\\s+['\"]?([a-z][\\w-]*)['\"]?", Pattern.CASE_INSENSITIVE);
    private static final Pattern NAMESPACE = Pattern.compile("([a-z][\\w]*):[\\w./_-]+");

    private CrashClassifier() {
    }

    public record Classification(String category, String suspectModId, JsonArray fixHints) {
    }

    public static Classification classify(JsonObject crash) {
        String exception = str(crash, "exception");
        String modFile = str(crash, "mod_file");
        String summary = str(crash, "summary");
        String combined = ((exception != null ? exception : "") + " "
                + (modFile != null ? modFile : "") + " "
                + (summary != null ? summary : "")).toLowerCase(Locale.ROOT);

        if (isHostResource(combined, exception)) {
            return new Classification("host_resource", null, hintsHostResource(combined, exception));
        }
        if (isModRelated(combined, modFile, exception)) {
            String suspect = suspectModId(modFile, exception, summary);
            return new Classification("mod", suspect, hintsMod(suspect, combined));
        }
        if (isLoader(combined)) {
            return new Classification("loader", null, hintsLoader());
        }
        return new Classification("unknown", null, hintsUnknown());
    }

    private static boolean isHostResource(String combined, String exception) {
        if (combined.contains("serverhangwatchdog")
                || combined.contains("single server tick took")
                || combined.contains("outofmemoryerror")
                || combined.contains("java heap space")
                || combined.contains("direct buffer memory")
                || combined.contains("gc overhead limit")
                || combined.contains("unable to create new native thread")) {
            return true;
        }
        return exception != null && exception.contains("ServerHangWatchdog");
    }

    private static boolean isModRelated(String combined, String modFile, String exception) {
        if (modFile != null && !modFile.isBlank() && !modFile.equals("java.lang.Error")) {
            return true;
        }
        if (combined.contains("modloadingcrash")
                || combined.contains("mod loading has failed")
                || combined.contains("modloadingexception")
                || combined.contains("fmlmodloading")) {
            return true;
        }
        if (exception != null && (exception.contains("ModLoading") || exception.contains("ModException"))) {
            return true;
        }
        return FML_MOD_ID.matcher(combined).find();
    }

    private static boolean isLoader(String combined) {
        return combined.contains("neoforged")
                || combined.contains("net.neoforged")
                || combined.contains("cpw.mods")
                || combined.contains("fml early loading")
                || combined.contains("bootstrap");
    }

    private static String suspectModId(String modFile, String exception, String summary) {
        if (modFile != null && !modFile.isBlank() && !modFile.contains("java.lang")) {
            String base = modFile;
            if (base.endsWith(".jar")) {
                base = base.substring(0, base.length() - 4);
            }
            if (base.contains("-")) {
                base = base.substring(0, base.indexOf('-'));
            }
            if (!base.isBlank() && !base.equals("Error")) {
                return base.toLowerCase(Locale.ROOT);
            }
        }
        Matcher mod = MOD_LOADING.matcher(exception != null ? exception : "");
        if (mod.find()) {
            return mod.group(1).strip().toLowerCase(Locale.ROOT);
        }
        Matcher fml = FML_MOD_ID.matcher((exception != null ? exception : "") + " " + (summary != null ? summary : ""));
        if (fml.find()) {
            return fml.group(1).strip().toLowerCase(Locale.ROOT);
        }
        Matcher ns = NAMESPACE.matcher(summary != null ? summary : "");
        if (ns.find()) {
            String id = ns.group(1);
            if (!"minecraft".equals(id) && !"neoforge".equals(id)) {
                return id;
            }
        }
        return null;
    }

    private static JsonArray hintsMod(String suspectModId, String combined) {
        List<String> hints = new ArrayList<>();
        if (suspectModId != null) {
            hints.add("Update or remove mod '" + suspectModId + "' — check latest.log for dependency errors.");
            hints.add("Re-download the mod JAR from the official source and replace it in mods/.");
        } else {
            hints.add("Open the crash report and find the mod cited in the stack trace.");
            hints.add("Update or remove the suspected mod, then restart the server.");
        }
        if (combined.contains("mixin")) {
            hints.add("Mixin conflicts often clear after updating both mods to versions tested together.");
        }
        return toArray(hints);
    }

    private static JsonArray hintsHostResource(String combined, String exception) {
        List<String> hints = new ArrayList<>();
        if (combined.contains("serverhangwatchdog") || (exception != null && exception.contains("ServerHangWatchdog"))) {
            hints.add("The server thread hung — check for heavy world gen, pregen, or entity farms before the crash.");
            hints.add("Review Spark or tick profiler output; reduce simulation distance or fix laggy contraptions.");
        } else if (combined.contains("outofmemory") || combined.contains("heap space")) {
            hints.add("Increase Java heap (-Xmx) if headroom is low, or find memory leaks / oversized modpacks.");
            hints.add("Check for duplicate mods, oversized chunk loaders, or run Spark heap analysis.");
        } else {
            hints.add("Host or JVM resource limit hit — review CPU, RAM, and disk at crash time.");
        }
        return toArray(hints);
    }

    private static JsonArray hintsLoader() {
        return toArray(List.of(
                "NeoForge or loader bootstrap failed — check mods/ for incompatible or corrupt jars.",
                "Compare NeoForge and Minecraft versions with your modpack requirements.",
                "Remove recently added mods one at a time until the server starts."));
    }

    private static JsonArray hintsUnknown() {
        return toArray(List.of(
                "Read the full crash report under crash-reports/ for the root exception.",
                "Search the mod id or exception online or in your pack's issue tracker.",
                "Acknowledge after review if the crash is historical and already resolved."));
    }

    private static JsonArray toArray(List<String> hints) {
        JsonArray arr = new JsonArray();
        hints.forEach(arr::add);
        return arr;
    }

    private static String str(JsonObject o, String key) {
        if (o == null || !o.has(key) || o.get(key).isJsonNull()) {
            return null;
        }
        return o.get(key).getAsString();
    }
}
