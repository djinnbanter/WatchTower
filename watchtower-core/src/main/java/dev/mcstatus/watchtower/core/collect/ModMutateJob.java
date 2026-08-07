package dev.mcstatus.watchtower.core.collect;

import com.google.gson.Gson;
import com.google.gson.GsonBuilder;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

/**
 * Gson-friendly assisted mod-mutate job record (swap / batch / install / quarantine / undo).
 */
public final class ModMutateJob {
    private static final Gson GSON = new GsonBuilder().create();

    public static final String KIND_SWAP = "swap";
    public static final String KIND_BATCH_SWAP = "batch_swap";
    public static final String KIND_INSTALL = "install";
    public static final String KIND_QUARANTINE = "quarantine";
    public static final String KIND_UNDO = "undo";

    public static final String STATE_QUEUED = "queued";
    public static final String STATE_FETCHING = "fetching";
    public static final String STATE_VERIFYING = "verifying";
    public static final String STATE_BACKING_UP = "backing_up";
    public static final String STATE_APPLYING = "applying";
    public static final String STATE_DONE = "done";
    public static final String STATE_FAILED = "failed";
    public static final String STATE_CANCELLED = "cancelled";

    private static final Set<String> TERMINAL = Set.of(STATE_DONE, STATE_FAILED, STATE_CANCELLED);
    private static final Set<String> CANCELABLE = Set.of(
            STATE_QUEUED, STATE_FETCHING, STATE_VERIFYING, STATE_BACKING_UP);

    public String id;
    /** swap | batch_swap | install | quarantine | undo */
    public String kind;
    /** queued | fetching | verifying | backing_up | applying | done | failed | cancelled */
    public String state;
    public String created_at;
    public String updated_at;
    public String actor_id;
    public String actor_name;

    public String mod_id;
    public String jar_basename;
    public String project_id;
    public String version_id;
    public String expected_sha512;

    public String backup_id;
    public String impact_fingerprint;
    public String error;
    public String error_code;
    public Boolean retryable;
    /** Batch only: when true, keep applying remaining steps after a failure. Default false. */
    public Boolean continue_on_failure;

    public List<Step> steps = new ArrayList<>();

    public static final class Step {
        public String mod_id;
        public String jar_basename;
        public String project_id;
        public String version_id;
        public String expected_sha512;
        public String state;
        public String error;
        public String error_code;
        public String backup_id;
    }

    public ModMutateJob() {
    }

    public static ModMutateJob newSwap(
            String actorId,
            String actorName,
            String modId,
            String jarBasename,
            String projectId,
            String versionId,
            String expectedSha512,
            String impactFingerprint) {
        ModMutateJob job = new ModMutateJob();
        job.id = "mut_" + UUID.randomUUID().toString().replace("-", "").substring(0, 16);
        job.kind = KIND_SWAP;
        job.state = STATE_QUEUED;
        String now = Instant.now().toString();
        job.created_at = now;
        job.updated_at = now;
        job.actor_id = actorId;
        job.actor_name = actorName;
        job.mod_id = modId;
        job.jar_basename = jarBasename;
        job.project_id = projectId;
        job.version_id = versionId;
        job.expected_sha512 = expectedSha512;
        job.impact_fingerprint = impactFingerprint;
        job.steps = new ArrayList<>();
        return job;
    }

    public static ModMutateJob newQuarantine(
            String actorId, String actorName, String modId, String jarBasename) {
        ModMutateJob job = newSwap(actorId, actorName, modId, jarBasename, null, null, null, null);
        job.kind = KIND_QUARANTINE;
        return job;
    }

    public static ModMutateJob newUndo(
            String actorId, String actorName, String backupId, String modId) {
        ModMutateJob job = newSwap(actorId, actorName, modId, null, null, null, null, null);
        job.kind = KIND_UNDO;
        job.backup_id = backupId;
        return job;
    }

    public static ModMutateJob newBatchSwap(
            String actorId,
            String actorName,
            List<Step> steps,
            String impactFingerprint,
            boolean continueOnFailure) {
        ModMutateJob job = newSwap(actorId, actorName, null, null, null, null, null, impactFingerprint);
        job.kind = KIND_BATCH_SWAP;
        job.continue_on_failure = continueOnFailure;
        job.steps = steps != null ? new ArrayList<>(steps) : new ArrayList<>();
        if (!job.steps.isEmpty()) {
            Step first = job.steps.get(0);
            job.mod_id = first.mod_id;
            job.jar_basename = first.jar_basename;
            job.project_id = first.project_id;
            job.version_id = first.version_id;
            job.expected_sha512 = first.expected_sha512;
        }
        return job;
    }

    public static ModMutateJob newInstall(
            String actorId,
            String actorName,
            String modId,
            String projectId,
            String versionId,
            String expectedSha512,
            String impactFingerprint) {
        ModMutateJob job = newSwap(
                actorId, actorName, modId, null, projectId, versionId, expectedSha512, impactFingerprint);
        job.kind = KIND_INSTALL;
        return job;
    }

    /**
     * Transition to a new state. Returns false if the transition is illegal.
     * Terminal states cannot leave; {@code failed}/{@code cancelled} allowed from non-terminal;
     * cancel only before {@code applying}.
     */
    public boolean transition(String nextState) {
        if (nextState == null || nextState.isBlank()) {
            return false;
        }
        String next = nextState.trim().toLowerCase(Locale.ROOT);
        if (state != null && TERMINAL.contains(state)) {
            return false;
        }
        if (STATE_CANCELLED.equals(next)) {
            if (!canCancel()) {
                return false;
            }
            state = STATE_CANCELLED;
            touch();
            return true;
        }
        if (STATE_FAILED.equals(next)) {
            if (state != null && TERMINAL.contains(state)) {
                return false;
            }
            state = STATE_FAILED;
            touch();
            return true;
        }
        if (!isAllowedForward(state, next)) {
            return false;
        }
        state = next;
        touch();
        return true;
    }

    public boolean canCancel() {
        return state != null && CANCELABLE.contains(state);
    }

    public boolean isTerminal() {
        return state != null && TERMINAL.contains(state);
    }

    public String toJson() {
        return GSON.toJson(this);
    }

    public static ModMutateJob fromJson(String json) {
        if (json == null || json.isBlank()) {
            return null;
        }
        ModMutateJob job = GSON.fromJson(json, ModMutateJob.class);
        if (job != null && job.steps == null) {
            job.steps = new ArrayList<>();
        }
        return job;
    }

    private void touch() {
        updated_at = Instant.now().toString();
    }

    private static boolean isAllowedForward(String from, String to) {
        if (from == null) {
            return STATE_QUEUED.equals(to);
        }
        return switch (from) {
            case STATE_QUEUED -> STATE_FETCHING.equals(to)
                    || STATE_VERIFYING.equals(to) // install/undo may skip fetch
                    || STATE_BACKING_UP.equals(to)
                    || STATE_APPLYING.equals(to);
            case STATE_FETCHING -> STATE_VERIFYING.equals(to);
            case STATE_VERIFYING -> STATE_BACKING_UP.equals(to) || STATE_APPLYING.equals(to);
            case STATE_BACKING_UP -> STATE_APPLYING.equals(to);
            case STATE_APPLYING -> STATE_DONE.equals(to);
            default -> false;
        };
    }

    @Override
    public String toString() {
        return "ModMutateJob{id=" + id + ", kind=" + kind + ", state=" + state + "}";
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) {
            return true;
        }
        if (!(o instanceof ModMutateJob that)) {
            return false;
        }
        return Objects.equals(id, that.id);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id);
    }
}
