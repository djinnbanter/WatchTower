package dev.mcstatus.watchtower.core.ops;

/**
 * Continuous issue ledger field names under {@code ops-cache.json}.
 */
public final class IssuesLiveSchema {

    public static final String ISSUES_LIVE = "issues_live";
    public static final String ISSUES_LIVE_UPDATED_AT = "issues_live_updated_at";

    public static final String ID = "id";
    public static final String KEY = "key";
    public static final String SEVERITY = "severity";
    public static final String STATUS = "status";
    public static final String FIRST_SEEN = "first_seen";
    public static final String LAST_SEEN = "last_seen";
    public static final String LAST_EVIDENCE_AT = "last_evidence_at";
    public static final String EVIDENCE_FINGERPRINT = "evidence_fingerprint";
    public static final String SOURCE = "source";
    public static final String MESSAGE = "message";
    public static final String EVIDENCE_REFS = "evidence_refs";
    public static final String FIX_STEPS = "fix_steps";
    public static final String ENRICHED_AT = "enriched_at";
    public static final String RESOLVED_AT = "resolved_at";

    public static final String STATUS_OPEN = "open";
    public static final String STATUS_REVIEWED = "reviewed";
    public static final String STATUS_SUPPRESSED = "suppressed";
    public static final String STATUS_RESOLVED = "resolved";

    public static final String SOURCE_LIVE = "live";
    public static final String SOURCE_OPS = "ops";
    public static final String SOURCE_EVENT = "event";
    public static final String SOURCE_CATCHUP = "catchup";

    private IssuesLiveSchema() {
    }
}
