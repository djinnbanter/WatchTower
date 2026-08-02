package dev.mcstatus.watchtower.core.analyze;

import com.google.gson.JsonArray;
import com.google.gson.JsonObject;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Parse Jade's {@code JadeErrorOutput.txt} sidecar into one capped, non-fatal compat signal.
 * Counts INSTANCE blocks and distinct exception classes — never crash/outage severity.
 */
public final class JadeSidecarAnalyzer {

    public static final String ISSUE_ID = "signal_jade_sidecar_compat";
    public static final String PRIMARY_MOD = "jade";

    private static final int MAX_SAMPLES = 5;
    private static final Pattern EXCEPTION_LINE = Pattern.compile(
            "^((?:[a-zA-Z_][\\w$]*\\.)+[A-Za-z_][\\w$]*(?:Exception|Error|Throwable))(?::|$)");

    private JadeSidecarAnalyzer() {
    }

    /**
     * @param text full JadeErrorOutput.txt contents, or null/blank
     * @return summary JsonObject, or null when no INSTANCE events found
     */
    public static JsonObject analyze(String text) {
        if (text == null || text.isBlank()) {
            return null;
        }

        List<Instance> instances = parseInstances(text);
        if (instances.isEmpty()) {
            return null;
        }

        Set<String> classes = new LinkedHashSet<>();
        JsonArray samples = new JsonArray();
        for (Instance inst : instances) {
            if (inst.exceptionClass != null && !inst.exceptionClass.isBlank()) {
                classes.add(inst.exceptionClass);
            }
            if (samples.size() < MAX_SAMPLES && inst.sampleLine != null && !inst.sampleLine.isBlank()) {
                samples.add(inst.sampleLine.length() > 240
                        ? inst.sampleLine.substring(0, 240)
                        : inst.sampleLine);
            }
        }

        JsonObject out = new JsonObject();
        out.addProperty("issue_id", ISSUE_ID);
        out.addProperty("primary_mod", PRIMARY_MOD);
        out.addProperty("instance_count", instances.size());
        out.addProperty("severity", "info");
        out.addProperty("crash_or_outage", false);

        JsonArray classArr = new JsonArray();
        for (String c : classes) {
            classArr.add(c);
        }
        out.add("exception_classes", classArr);
        out.add("samples", samples);
        return out;
    }

    private static List<Instance> parseInstances(String text) {
        String[] lines = text.split("\\R", -1);
        List<Instance> out = new ArrayList<>();
        for (int i = 0; i < lines.length; i++) {
            String line = lines[i].trim();
            if (!"INSTANCE".equalsIgnoreCase(line)) {
                continue;
            }
            Instance inst = new Instance();
            for (int j = i + 1; j < lines.length; j++) {
                String next = lines[j].trim();
                if (next.isEmpty()) {
                    continue;
                }
                if ("INSTANCE".equalsIgnoreCase(next)) {
                    break;
                }
                Matcher m = EXCEPTION_LINE.matcher(next);
                if (m.find()) {
                    inst.exceptionClass = m.group(1);
                    inst.sampleLine = next;
                    break;
                }
                // Jade sometimes prefixes the exception with a label; scan first token-ish line
                String lowered = next.toLowerCase(Locale.ROOT);
                if (lowered.startsWith("at ") || lowered.startsWith("causes:")) {
                    break;
                }
            }
            out.add(inst);
        }
        return out;
    }

    private static final class Instance {
        String exceptionClass;
        String sampleLine;
    }
}
