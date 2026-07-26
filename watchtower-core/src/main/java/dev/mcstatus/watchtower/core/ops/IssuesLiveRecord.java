package dev.mcstatus.watchtower.core.ops;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Objects;

/**
 * One continuous issue ledger row ({@code ops-cache.issues_live[]}).
 */
public final class IssuesLiveRecord {

    private final String id;
    private final String key;
    private final String severity;
    private final String status;
    private final String firstSeen;
    private final String lastSeen;
    private final String lastEvidenceAt;
    private final String evidenceFingerprint;
    private final String source;
    private final String message;
    private final List<String> evidenceRefs;
    private final List<String> fixSteps;
    private final String enrichedAt;
    private final String resolvedAt;

    private IssuesLiveRecord(Builder b) {
        this.id = b.id;
        this.key = b.key != null && !b.key.isBlank() ? b.key : b.id;
        this.severity = b.severity != null ? b.severity : "warning";
        this.status = b.status != null ? b.status : IssuesLiveSchema.STATUS_OPEN;
        this.firstSeen = b.firstSeen;
        this.lastSeen = b.lastSeen;
        this.lastEvidenceAt = b.lastEvidenceAt;
        this.evidenceFingerprint = b.evidenceFingerprint != null ? b.evidenceFingerprint : "";
        this.source = b.source != null ? b.source : IssuesLiveSchema.SOURCE_OPS;
        this.message = b.message != null ? b.message : "";
        this.evidenceRefs = List.copyOf(b.evidenceRefs);
        this.fixSteps = List.copyOf(b.fixSteps);
        this.enrichedAt = b.enrichedAt;
        this.resolvedAt = b.resolvedAt;
    }

    public static Builder builder() {
        return new Builder();
    }

    public static IssuesLiveRecord fromJson(JsonObject o) {
        if (o == null) {
            return null;
        }
        String id = str(o, IssuesLiveSchema.ID);
        if (id.isBlank()) {
            id = str(o, IssuesLiveSchema.KEY);
        }
        if (id.isBlank()) {
            return null;
        }
        Builder b = builder()
                .id(id)
                .key(str(o, IssuesLiveSchema.KEY).isBlank() ? id : str(o, IssuesLiveSchema.KEY))
                .severity(str(o, IssuesLiveSchema.SEVERITY))
                .status(str(o, IssuesLiveSchema.STATUS))
                .firstSeen(str(o, IssuesLiveSchema.FIRST_SEEN))
                .lastSeen(str(o, IssuesLiveSchema.LAST_SEEN))
                .lastEvidenceAt(str(o, IssuesLiveSchema.LAST_EVIDENCE_AT))
                .evidenceFingerprint(str(o, IssuesLiveSchema.EVIDENCE_FINGERPRINT))
                .source(str(o, IssuesLiveSchema.SOURCE))
                .message(str(o, IssuesLiveSchema.MESSAGE))
                .enrichedAt(nullableStr(o, IssuesLiveSchema.ENRICHED_AT))
                .resolvedAt(nullableStr(o, IssuesLiveSchema.RESOLVED_AT));
        for (String ref : stringList(o, IssuesLiveSchema.EVIDENCE_REFS)) {
            b.addEvidenceRef(ref);
        }
        for (String step : stringList(o, IssuesLiveSchema.FIX_STEPS)) {
            b.addFixStep(step);
        }
        return b.build();
    }

    public JsonObject toJson() {
        JsonObject o = new JsonObject();
        o.addProperty(IssuesLiveSchema.ID, id);
        o.addProperty(IssuesLiveSchema.KEY, key);
        o.addProperty(IssuesLiveSchema.SEVERITY, severity);
        o.addProperty(IssuesLiveSchema.STATUS, status);
        if (firstSeen != null && !firstSeen.isBlank()) {
            o.addProperty(IssuesLiveSchema.FIRST_SEEN, firstSeen);
        }
        if (lastSeen != null && !lastSeen.isBlank()) {
            o.addProperty(IssuesLiveSchema.LAST_SEEN, lastSeen);
        }
        if (lastEvidenceAt != null && !lastEvidenceAt.isBlank()) {
            o.addProperty(IssuesLiveSchema.LAST_EVIDENCE_AT, lastEvidenceAt);
        }
        o.addProperty(IssuesLiveSchema.EVIDENCE_FINGERPRINT, evidenceFingerprint);
        o.addProperty(IssuesLiveSchema.SOURCE, source);
        o.addProperty(IssuesLiveSchema.MESSAGE, message);
        o.add(IssuesLiveSchema.EVIDENCE_REFS, toJsonArray(evidenceRefs));
        o.add(IssuesLiveSchema.FIX_STEPS, toJsonArray(fixSteps));
        if (enrichedAt != null) {
            o.addProperty(IssuesLiveSchema.ENRICHED_AT, enrichedAt);
        }
        if (resolvedAt != null) {
            o.addProperty(IssuesLiveSchema.RESOLVED_AT, resolvedAt);
        }
        return o;
    }

    public String id() { return id; }
    public String key() { return key; }
    public String severity() { return severity; }
    public String status() { return status; }
    public String firstSeen() { return firstSeen; }
    public String lastSeen() { return lastSeen; }
    public String lastEvidenceAt() { return lastEvidenceAt; }
    public String evidenceFingerprint() { return evidenceFingerprint; }
    public String source() { return source; }
    public String message() { return message; }
    public List<String> evidenceRefs() { return evidenceRefs; }
    public List<String> fixSteps() { return fixSteps; }
    public String enrichedAt() { return enrichedAt; }
    public String resolvedAt() { return resolvedAt; }

    public String normalizedKey() {
        return key.trim().toUpperCase(Locale.ROOT);
    }

    public Builder toBuilder() {
        Builder b = builder()
                .id(id)
                .key(key)
                .severity(severity)
                .status(status)
                .firstSeen(firstSeen)
                .lastSeen(lastSeen)
                .lastEvidenceAt(lastEvidenceAt)
                .evidenceFingerprint(evidenceFingerprint)
                .source(source)
                .message(message)
                .enrichedAt(enrichedAt)
                .resolvedAt(resolvedAt);
        evidenceRefs.forEach(b::addEvidenceRef);
        fixSteps.forEach(b::addFixStep);
        return b;
    }

    private static String str(JsonObject o, String k) {
        if (!o.has(k) || o.get(k).isJsonNull()) {
            return "";
        }
        return o.get(k).getAsString();
    }

    private static String nullableStr(JsonObject o, String k) {
        String s = str(o, k);
        return s.isBlank() ? null : s;
    }

    private static List<String> stringList(JsonObject o, String k) {
        List<String> out = new ArrayList<>();
        if (!o.has(k) || !o.get(k).isJsonArray()) {
            return out;
        }
        for (JsonElement el : o.getAsJsonArray(k)) {
            if (el.isJsonPrimitive()) {
                out.add(el.getAsString());
            }
        }
        return out;
    }

    private static JsonArray toJsonArray(List<String> items) {
        JsonArray a = new JsonArray();
        for (String s : items) {
            a.add(s);
        }
        return a;
    }

    public static final class Builder {
        private String id;
        private String key;
        private String severity = "warning";
        private String status = IssuesLiveSchema.STATUS_OPEN;
        private String firstSeen;
        private String lastSeen;
        private String lastEvidenceAt;
        private String evidenceFingerprint = "";
        private String source = IssuesLiveSchema.SOURCE_OPS;
        private String message = "";
        private final List<String> evidenceRefs = new ArrayList<>();
        private final List<String> fixSteps = new ArrayList<>();
        private String enrichedAt;
        private String resolvedAt;

        public Builder id(String v) { this.id = v; return this; }
        public Builder key(String v) { this.key = v; return this; }
        public Builder severity(String v) {
            if (v != null && !v.isBlank()) this.severity = v;
            return this;
        }
        public Builder status(String v) {
            if (v != null && !v.isBlank()) this.status = v;
            return this;
        }
        public Builder firstSeen(String v) { this.firstSeen = v; return this; }
        public Builder lastSeen(String v) { this.lastSeen = v; return this; }
        public Builder lastEvidenceAt(String v) { this.lastEvidenceAt = v; return this; }
        public Builder evidenceFingerprint(String v) {
            this.evidenceFingerprint = v != null ? v : "";
            return this;
        }
        public Builder source(String v) {
            if (v != null && !v.isBlank()) this.source = v;
            return this;
        }
        public Builder message(String v) { this.message = v != null ? v : ""; return this; }
        public Builder addEvidenceRef(String v) {
            if (v != null && !v.isBlank()) this.evidenceRefs.add(v);
            return this;
        }
        public Builder clearEvidenceRefs() { this.evidenceRefs.clear(); return this; }
        public Builder addFixStep(String v) {
            if (v != null && !v.isBlank()) this.fixSteps.add(v);
            return this;
        }
        public Builder clearFixSteps() { this.fixSteps.clear(); return this; }
        public Builder enrichedAt(String v) { this.enrichedAt = v; return this; }
        public Builder resolvedAt(String v) { this.resolvedAt = v; return this; }

        public IssuesLiveRecord build() {
            Objects.requireNonNull(id, "id");
            if (id.isBlank()) throw new IllegalArgumentException("id blank");
            return new IssuesLiveRecord(this);
        }
    }
}
