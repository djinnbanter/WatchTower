package dev.mcstatus.watchtower.core.rules;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.analyze.CrashClassifier;
import dev.mcstatus.watchtower.core.analyze.ModListGate;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Pattern;

/**
 * Evaluates YAML crash rules after Java {@link CrashClassifier}. Classifier-first merge policy.
 */
public final class CrashRuleEvaluator {

    private CrashRuleEvaluator() {
    }

    public record Hit(
            String ruleId,
            String packId,
            int priority,
            String matchedAt,
            CrashRuleModels.EmitSpec emit
    ) {
        public JsonObject toJson() {
            JsonObject o = new JsonObject();
            o.addProperty("rule_id", ruleId);
            o.addProperty("pack_id", packId);
            o.addProperty("priority", priority);
            o.addProperty("matched_at", matchedAt);
            JsonObject emitObj = new JsonObject();
            if (emit.failureKind() != null) {
                emitObj.addProperty("failure_kind", emit.failureKind());
            }
            if (emit.primaryModId() != null) {
                emitObj.addProperty("primary_mod_id", emit.primaryModId());
            }
            if (emit.confidence() != null) {
                emitObj.addProperty("confidence", emit.confidence());
            }
            if (emit.issueId() != null) {
                emitObj.addProperty("issue_id", emit.issueId());
            }
            if (!emit.fixHints().isEmpty()) {
                JsonArray hints = new JsonArray();
                for (String h : emit.fixHints()) {
                    hints.add(h);
                }
                emitObj.add("fix_hints", hints);
            }
            if (emit.override()) {
                emitObj.addProperty("override", true);
            }
            o.add("emit", emitObj);
            return o;
        }
    }

    public record EvalResult(
            List<Hit> hits,
            CrashClassifier.Classification merged,
            boolean kindChanged
    ) {
        public EvalResult {
            hits = hits == null ? List.of() : List.copyOf(hits);
        }
    }

    public record EvalContext(
            JsonObject crash,
            JsonObject summaryRow,
            JsonArray mods,
            JsonArray fmlIssues,
            String logLatest,
            String logStderr,
            String logPreCrash,
            ModListGate gate
    ) {
        public static EvalContext of(
                JsonObject crash,
                JsonObject summaryRow,
                JsonArray mods,
                JsonArray fmlIssues,
                String logLatest,
                String logStderr,
                String logPreCrash
        ) {
            return new EvalContext(
                    crash,
                    summaryRow,
                    mods != null ? mods : new JsonArray(),
                    fmlIssues != null ? fmlIssues : new JsonArray(),
                    logLatest != null ? logLatest : "",
                    logStderr != null ? logStderr : "",
                    logPreCrash != null ? logPreCrash : "",
                    ModListGate.fromMods(mods)
            );
        }
    }

    public static EvalResult evaluate(
            CrashRuleRegistry registry,
            EvalContext ctx,
            CrashClassifier.Classification javaClass
    ) {
        if (registry == null || javaClass == null) {
            return new EvalResult(List.of(), javaClass, false);
        }
        String matchedAt = Instant.now().toString();
        List<Hit> hits = new ArrayList<>();
        CrashClassifier.Classification current = javaClass;
        int assignedPriority = Integer.MIN_VALUE;
        boolean kindChanged = false;

        for (CrashRuleRegistry.ResolvedRule rr : registry.resolvedRules()) {
            if (!matches(rr.rule().when(), ctx)) {
                continue;
            }
            CrashRuleModels.EmitSpec emit = rr.rule().emit();
            int pri = rr.pack().priority() * 1000 + rr.rule().priority();
            hits.add(new Hit(rr.rule().id(), rr.pack().id(), pri, matchedAt, emit));

            boolean canApplyKind = CrashClassifier.FK_UNKNOWN.equals(current.failureKind())
                    || (emit.override() && pri >= assignedPriority);
            if (canApplyKind && emit.failureKind() != null && !emit.failureKind().isBlank()) {
                current = mergeClassification(current, emit, emit.override());
                assignedPriority = pri;
                kindChanged = true;
            } else if (!emit.fixHints().isEmpty()) {
                current = appendHints(current, emit.fixHints(), false);
            }
        }
        return new EvalResult(hits, current, kindChanged);
    }

    private static CrashClassifier.Classification mergeClassification(
            CrashClassifier.Classification base,
            CrashRuleModels.EmitSpec emit,
            boolean wipeHints
    ) {
        String kind = emit.failureKind() != null ? emit.failureKind() : base.failureKind();
        String primary = emit.primaryModId() != null ? emit.primaryModId() : base.primaryModId();
        String suspect = primary != null ? primary : base.suspectModId();
        String category = categoryForKind(kind, base.category());
        JsonArray hints = wipeHints ? new JsonArray() : copyHints(base.fixHints());
        appendHintStrings(hints, emit.fixHints());
        JsonObject details = base.details() != null ? base.details().deepCopy() : new JsonObject();
        details.addProperty("crash_rule_emit", true);
        return new CrashClassifier.Classification(
                category, kind, suspect, primary, base.stallModId(), hints, details);
    }

    private static CrashClassifier.Classification appendHints(
            CrashClassifier.Classification base,
            List<String> extra,
            boolean wipe
    ) {
        JsonArray hints = wipe ? new JsonArray() : copyHints(base.fixHints());
        appendHintStrings(hints, extra);
        return new CrashClassifier.Classification(
                base.category(),
                base.failureKind(),
                base.suspectModId(),
                base.primaryModId(),
                base.stallModId(),
                hints,
                base.details() != null ? base.details().deepCopy() : new JsonObject());
    }

    private static JsonArray copyHints(JsonArray src) {
        JsonArray out = new JsonArray();
        if (src == null) {
            return out;
        }
        for (JsonElement el : src) {
            out.add(el.deepCopy());
        }
        return out;
    }

    private static void appendHintStrings(JsonArray hints, List<String> extra) {
        Set<String> seen = new LinkedHashSet<>();
        for (JsonElement el : hints) {
            if (el.isJsonPrimitive()) {
                seen.add(el.getAsString());
            }
        }
        for (String h : extra) {
            if (h != null && !h.isBlank() && seen.add(h)) {
                hints.add(h);
            }
        }
    }

    private static String categoryForKind(String kind, String fallback) {
        if (kind == null) {
            return fallback;
        }
        if (kind.startsWith("mod_")) {
            return "mod";
        }
        if (kind.startsWith("loader") || kind.contains("loader")) {
            return "loader";
        }
        if (kind.contains("host") || kind.contains("oom") || kind.contains("disk")) {
            return "host_resource";
        }
        return fallback != null ? fallback : "unknown";
    }

    static boolean matches(CrashRuleModels.PredicateNode node, EvalContext ctx) {
        if (node == null) {
            return false;
        }
        return switch (node) {
            case CrashRuleModels.AllNode all -> {
                if (all.children().isEmpty()) {
                    yield false;
                }
                for (CrashRuleModels.PredicateNode c : all.children()) {
                    if (!matches(c, ctx)) {
                        yield false;
                    }
                }
                yield true;
            }
            case CrashRuleModels.AnyNode any -> {
                for (CrashRuleModels.PredicateNode c : any.children()) {
                    if (matches(c, ctx)) {
                        yield true;
                    }
                }
                yield false;
            }
            case CrashRuleModels.ModPresent mp -> ctx.gate().requiresMod(mp.modId());
            case CrashRuleModels.ModAbsent ma -> ctx.gate().forbidsMod(ma.modId());
            case CrashRuleModels.SourceMatch sm -> matchSource(sm, ctx);
        };
    }

    private static boolean matchSource(CrashRuleModels.SourceMatch sm, EvalContext ctx) {
        if (sm.regex() == null || sm.regex().isBlank()) {
            return false;
        }
        Pattern pat;
        try {
            pat = Pattern.compile(sm.regex(), Pattern.CASE_INSENSITIVE | Pattern.DOTALL);
        } catch (Exception e) {
            return false;
        }
        String source = sm.source() != null ? sm.source().toLowerCase(Locale.ROOT) : "";
        return switch (source) {
            case "crash_report" -> pat.matcher(crashReportText(ctx)).find();
            case "stack" -> pat.matcher(stackText(ctx)).find();
            case "description" -> pat.matcher(str(ctx.crash(), "description")).find();
            case "log_excerpt" -> pat.matcher(logText(sm.logType(), ctx)).find();
            case "fml_issue" -> matchFml(sm, ctx, pat);
            default -> false;
        };
    }

    private static boolean matchFml(CrashRuleModels.SourceMatch sm, EvalContext ctx, Pattern pat) {
        String field = sm.field() != null ? sm.field() : "message";
        for (JsonElement el : ctx.fmlIssues()) {
            if (!el.isJsonObject()) {
                continue;
            }
            JsonObject issue = el.getAsJsonObject();
            String hay = str(issue, field);
            if (hay.isEmpty() && "message".equals(field)) {
                hay = str(issue, "raw");
            }
            if (!hay.isEmpty() && pat.matcher(hay).find()) {
                return true;
            }
        }
        return false;
    }

    private static String logText(String logType, EvalContext ctx) {
        String lt = logType != null ? logType.toLowerCase(Locale.ROOT) : "latest";
        return switch (lt) {
            case "stderr" -> ctx.logStderr();
            case "pre_crash" -> ctx.logPreCrash();
            default -> ctx.logLatest();
        };
    }

    private static String crashReportText(EvalContext ctx) {
        StringBuilder sb = new StringBuilder();
        sb.append(str(ctx.crash(), "summary")).append('\n');
        sb.append(str(ctx.crash(), "description")).append('\n');
        sb.append(str(ctx.crash(), "exception")).append('\n');
        sb.append(str(ctx.crash(), "raw")).append('\n');
        sb.append(str(ctx.crash(), "text")).append('\n');
        sb.append(stackText(ctx));
        if (ctx.summaryRow() != null) {
            sb.append(str(ctx.summaryRow(), "summary")).append('\n');
            sb.append(str(ctx.summaryRow(), "description")).append('\n');
        }
        return sb.toString();
    }

    private static String stackText(EvalContext ctx) {
        StringBuilder sb = new StringBuilder();
        sb.append(str(ctx.crash(), "stack")).append('\n');
        sb.append(str(ctx.crash(), "stack_trace")).append('\n');
        if (ctx.crash() != null && ctx.crash().has("stack_frames") && ctx.crash().get("stack_frames").isJsonArray()) {
            for (JsonElement el : ctx.crash().getAsJsonArray("stack_frames")) {
                sb.append(el.isJsonPrimitive() ? el.getAsString() : el.toString()).append('\n');
            }
        }
        return sb.toString();
    }

    private static String str(JsonObject o, String key) {
        if (o == null || !o.has(key) || o.get(key).isJsonNull()) {
            return "";
        }
        try {
            return o.get(key).getAsString();
        } catch (Exception e) {
            return o.get(key).toString();
        }
    }
}
