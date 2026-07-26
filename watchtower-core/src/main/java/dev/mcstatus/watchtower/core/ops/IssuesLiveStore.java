package dev.mcstatus.watchtower.core.ops;

import com.google.gson.JsonArray;
import com.google.gson.JsonElement;
import com.google.gson.JsonObject;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

/**
 * Pure merge helpers for the continuous issue ledger ({@code issues_live}).
 * Never deletes open/reviewed rows solely because a short pass missed them.
 */
public final class IssuesLiveStore {

    private IssuesLiveStore() {
    }

    public static List<IssuesLiveRecord> readAll(JsonObject cache) {
        List<IssuesLiveRecord> out = new ArrayList<>();
        if (cache == null || !cache.has(IssuesLiveSchema.ISSUES_LIVE)
                || !cache.get(IssuesLiveSchema.ISSUES_LIVE).isJsonArray()) {
            return out;
        }
        for (JsonElement el : cache.getAsJsonArray(IssuesLiveSchema.ISSUES_LIVE)) {
            if (!el.isJsonObject()) {
                continue;
            }
            IssuesLiveRecord r = IssuesLiveRecord.fromJson(el.getAsJsonObject());
            if (r != null) {
                out.add(r);
            }
        }
        return out;
    }

    public static void writeAll(JsonObject cache, List<IssuesLiveRecord> records, String updatedAtIso) {
        JsonArray arr = new JsonArray();
        for (IssuesLiveRecord r : records) {
            arr.add(r.toJson());
        }
        cache.add(IssuesLiveSchema.ISSUES_LIVE, arr);
        if (updatedAtIso != null && !updatedAtIso.isBlank()) {
            cache.addProperty(IssuesLiveSchema.ISSUES_LIVE_UPDATED_AT, updatedAtIso);
        }
    }

    public static List<IssuesLiveRecord> activeOnly(List<IssuesLiveRecord> records) {
        List<IssuesLiveRecord> out = new ArrayList<>();
        for (IssuesLiveRecord r : records) {
            if (IssuesLiveSchema.STATUS_OPEN.equalsIgnoreCase(r.status())) {
                out.add(r);
            }
        }
        return out;
    }

    /**
     * Upsert detection evidence. Preserves first_seen; may reopen reviewed on fingerprint/severity change.
     */
    public static List<IssuesLiveRecord> upsert(List<IssuesLiveRecord> existing, IssuesLiveRecord incoming, String nowIso) {
        Map<String, IssuesLiveRecord> byKey = indexByKey(existing);
        String nk = incoming.normalizedKey();
        IssuesLiveRecord prev = byKey.get(nk);
        if (prev == null) {
            IssuesLiveRecord created = incoming.toBuilder()
                    .status(IssuesLiveSchema.STATUS_OPEN)
                    .firstSeen(blankTo(incoming.firstSeen(), nowIso))
                    .lastSeen(blankTo(incoming.lastSeen(), nowIso))
                    .lastEvidenceAt(blankTo(incoming.lastEvidenceAt(), nowIso))
                    .resolvedAt(null)
                    .build();
            byKey.put(nk, created);
            return new ArrayList<>(byKey.values());
        }

        String status = prev.status();
        if (IssuesLiveSchema.STATUS_SUPPRESSED.equalsIgnoreCase(status)) {
            // Suppressed: refresh evidence timestamps only; do not reopen.
            byKey.put(nk, prev.toBuilder()
                    .lastSeen(nowIso)
                    .lastEvidenceAt(nowIso)
                    .message(prefer(incoming.message(), prev.message()))
                    .severity(prefer(incoming.severity(), prev.severity()))
                    .source(prefer(incoming.source(), prev.source()))
                    .build());
            return new ArrayList<>(byKey.values());
        }

        boolean fingerprintChanged = !safeFp(incoming.evidenceFingerprint()).equals(safeFp(prev.evidenceFingerprint()))
                && !safeFp(incoming.evidenceFingerprint()).isEmpty();
        boolean severityUp = severityRank(incoming.severity()) > severityRank(prev.severity());
        boolean wasResolved = IssuesLiveSchema.STATUS_RESOLVED.equalsIgnoreCase(status);
        boolean wasReviewed = IssuesLiveSchema.STATUS_REVIEWED.equalsIgnoreCase(status);

        if (wasReviewed && !fingerprintChanged && !severityUp) {
            byKey.put(nk, prev.toBuilder()
                    .lastSeen(nowIso)
                    .lastEvidenceAt(nowIso)
                    .message(prefer(incoming.message(), prev.message()))
                    .build());
            return new ArrayList<>(byKey.values());
        }

        String nextStatus = status;
        if (wasResolved || (wasReviewed && (fingerprintChanged || severityUp))) {
            nextStatus = IssuesLiveSchema.STATUS_OPEN;
        }
        if (IssuesLiveSchema.STATUS_OPEN.equalsIgnoreCase(status) || nextStatus.equals(IssuesLiveSchema.STATUS_OPEN)) {
            nextStatus = IssuesLiveSchema.STATUS_OPEN;
        }

        IssuesLiveRecord.Builder b = prev.toBuilder()
                .status(nextStatus)
                .lastSeen(nowIso)
                .lastEvidenceAt(nowIso)
                .message(prefer(incoming.message(), prev.message()))
                .severity(prefer(incoming.severity(), prev.severity()))
                .source(prefer(incoming.source(), prev.source()))
                .resolvedAt(IssuesLiveSchema.STATUS_OPEN.equals(nextStatus) ? null : prev.resolvedAt());
        if (!safeFp(incoming.evidenceFingerprint()).isEmpty()) {
            b.evidenceFingerprint(incoming.evidenceFingerprint());
        }
        if (!incoming.evidenceRefs().isEmpty()) {
            b.clearEvidenceRefs();
            incoming.evidenceRefs().forEach(b::addEvidenceRef);
        }
        if (!incoming.fixSteps().isEmpty()) {
            b.clearFixSteps();
            incoming.fixSteps().forEach(b::addFixStep);
            b.enrichedAt(nowIso);
        }
        byKey.put(nk, b.build());
        return new ArrayList<>(byKey.values());
    }

    /** Mark condition cleared — resolve open rows; do not delete. */
    public static List<IssuesLiveRecord> resolve(List<IssuesLiveRecord> existing, String key, String nowIso) {
        if (key == null || key.isBlank()) {
            return existing;
        }
        String nk = key.trim().toUpperCase(Locale.ROOT);
        List<IssuesLiveRecord> out = new ArrayList<>();
        for (IssuesLiveRecord r : existing) {
            if (!r.normalizedKey().equals(nk)) {
                out.add(r);
                continue;
            }
            if (IssuesLiveSchema.STATUS_SUPPRESSED.equalsIgnoreCase(r.status())
                    || IssuesLiveSchema.STATUS_REVIEWED.equalsIgnoreCase(r.status())) {
                out.add(r);
                continue;
            }
            out.add(r.toBuilder()
                    .status(IssuesLiveSchema.STATUS_RESOLVED)
                    .resolvedAt(nowIso)
                    .lastSeen(nowIso)
                    .build());
        }
        return out;
    }

    public static List<IssuesLiveRecord> markReviewed(List<IssuesLiveRecord> existing, String key, String nowIso) {
        return setStatus(existing, canonicalIssueKey(key), IssuesLiveSchema.STATUS_REVIEWED, nowIso);
    }

    public static List<IssuesLiveRecord> markSuppressed(List<IssuesLiveRecord> existing, String key, String nowIso) {
        return setStatus(existing, canonicalIssueKey(key), IssuesLiveSchema.STATUS_SUPPRESSED, nowIso);
    }

    /**
     * Dashboard ack keys are often {@code issue:DISK_HIGH}; ledger rows use bare condition ids.
     */
    public static String canonicalIssueKey(String key) {
        if (key == null) {
            return "";
        }
        String k = key.trim();
        if (k.regionMatches(true, 0, "issue:", 0, 6)) {
            k = k.substring(6).trim();
        }
        return k;
    }

    public static List<IssuesLiveRecord> unsuppress(List<IssuesLiveRecord> existing, String key, String nowIso) {
        if (key == null || key.isBlank()) {
            return existing;
        }
        String nk = key.trim().toUpperCase(Locale.ROOT);
        List<IssuesLiveRecord> out = new ArrayList<>();
        for (IssuesLiveRecord r : existing) {
            if (!r.normalizedKey().equals(nk)) {
                out.add(r);
                continue;
            }
            out.add(r.toBuilder()
                    .status(IssuesLiveSchema.STATUS_OPEN)
                    .lastSeen(nowIso)
                    .resolvedAt(null)
                    .build());
        }
        return out;
    }

    /**
     * Enrich from catch-up/report without resetting ack/suppress.
     */
    public static List<IssuesLiveRecord> enrich(List<IssuesLiveRecord> existing, IssuesLiveRecord incoming, String nowIso) {
        Map<String, IssuesLiveRecord> byKey = indexByKey(existing);
        String nk = incoming.normalizedKey();
        IssuesLiveRecord prev = byKey.get(nk);
        if (prev == null) {
            return upsert(existing, incoming.toBuilder().source(IssuesLiveSchema.SOURCE_CATCHUP).build(), nowIso);
        }
        IssuesLiveRecord.Builder b = prev.toBuilder()
                .message(prefer(incoming.message(), prev.message()))
                .severity(prefer(incoming.severity(), prev.severity()))
                .enrichedAt(nowIso)
                .lastSeen(nowIso);
        if (!incoming.fixSteps().isEmpty()) {
            b.clearFixSteps();
            incoming.fixSteps().forEach(b::addFixStep);
        }
        if (!incoming.evidenceRefs().isEmpty()) {
            b.clearEvidenceRefs();
            incoming.evidenceRefs().forEach(b::addEvidenceRef);
        }
        byKey.put(nk, b.build());
        return new ArrayList<>(byKey.values());
    }

    /**
     * Apply a detection pass: upsert all seen keys; resolve open keys not in {@code seenKeys}
     * only when {@code resolveMissing} is true. Default for continuous passes: resolveMissing=false
     * (missed pass must not drop opens — caller resolves explicitly when evidence clears).
     */
    public static List<IssuesLiveRecord> applyPass(
            List<IssuesLiveRecord> existing,
            List<IssuesLiveRecord> detected,
            Set<String> seenKeys,
            boolean resolveMissing,
            String nowIso
    ) {
        List<IssuesLiveRecord> cur = existing;
        for (IssuesLiveRecord d : detected) {
            cur = upsert(cur, d, nowIso);
        }
        if (!resolveMissing || seenKeys == null) {
            return cur;
        }
        for (IssuesLiveRecord r : List.copyOf(cur)) {
            if (!IssuesLiveSchema.STATUS_OPEN.equalsIgnoreCase(r.status())) {
                continue;
            }
            if (!seenKeys.contains(r.normalizedKey())) {
                cur = resolve(cur, r.key(), nowIso);
            }
        }
        return cur;
    }

    private static List<IssuesLiveRecord> setStatus(
            List<IssuesLiveRecord> existing, String key, String status, String nowIso
    ) {
        if (key == null || key.isBlank()) {
            return existing;
        }
        String nk = key.trim().toUpperCase(Locale.ROOT);
        List<IssuesLiveRecord> out = new ArrayList<>();
        boolean found = false;
        for (IssuesLiveRecord r : existing) {
            if (!r.normalizedKey().equals(nk)) {
                out.add(r);
                continue;
            }
            found = true;
            out.add(r.toBuilder().status(status).lastSeen(nowIso).build());
        }
        if (!found) {
            out.add(IssuesLiveRecord.builder()
                    .id(key.trim())
                    .key(key.trim())
                    .status(status)
                    .firstSeen(nowIso)
                    .lastSeen(nowIso)
                    .lastEvidenceAt(nowIso)
                    .message("")
                    .build());
        }
        return out;
    }

    private static Map<String, IssuesLiveRecord> indexByKey(List<IssuesLiveRecord> existing) {
        Map<String, IssuesLiveRecord> map = new LinkedHashMap<>();
        if (existing == null) {
            return map;
        }
        for (IssuesLiveRecord r : existing) {
            map.put(r.normalizedKey(), r);
        }
        return map;
    }

    private static String blankTo(String v, String fallback) {
        return v == null || v.isBlank() ? fallback : v;
    }

    private static String prefer(String incoming, String prev) {
        return incoming != null && !incoming.isBlank() ? incoming : prev;
    }

    private static String safeFp(String fp) {
        return fp == null ? "" : fp.trim();
    }

    private static int severityRank(String sev) {
        if (sev == null) {
            return 0;
        }
        return switch (sev.trim().toLowerCase(Locale.ROOT)) {
            case "critical", "error" -> 3;
            case "warning", "warn" -> 2;
            case "info" -> 1;
            default -> 0;
        };
    }

    /** Convenience: ISO-8601 now. */
    public static String nowIso() {
        return Instant.now().toString();
    }
}
