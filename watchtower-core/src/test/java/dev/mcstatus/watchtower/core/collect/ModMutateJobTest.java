package dev.mcstatus.watchtower.core.collect;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class ModMutateJobTest {

    @Test
    void happyPathQueuedToDone() {
        ModMutateJob job = ModMutateJob.newSwap(
                "acc_1", "owner", "jei", "jei-1.0.jar",
                "proj", "ver", "abc", "fp1");
        assertEquals(ModMutateJob.STATE_QUEUED, job.state);
        assertTrue(job.transition(ModMutateJob.STATE_FETCHING));
        assertTrue(job.transition(ModMutateJob.STATE_VERIFYING));
        assertTrue(job.transition(ModMutateJob.STATE_BACKING_UP));
        assertTrue(job.transition(ModMutateJob.STATE_APPLYING));
        assertTrue(job.transition(ModMutateJob.STATE_DONE));
        assertTrue(job.isTerminal());
        assertFalse(job.transition(ModMutateJob.STATE_FETCHING));
    }

    @Test
    void failedFromFetching() {
        ModMutateJob job = ModMutateJob.newSwap(
                "acc_1", "owner", "jei", "jei-1.0.jar",
                "proj", "ver", "abc", "fp1");
        assertTrue(job.transition(ModMutateJob.STATE_FETCHING));
        assertTrue(job.transition(ModMutateJob.STATE_FAILED));
        assertEquals(ModMutateJob.STATE_FAILED, job.state);
        assertFalse(job.transition(ModMutateJob.STATE_VERIFYING));
    }

    @Test
    void cancelOnlyBeforeApplying() {
        ModMutateJob job = ModMutateJob.newSwap(
                "acc_1", "owner", "jei", "jei-1.0.jar",
                "proj", "ver", "abc", "fp1");
        assertTrue(job.canCancel());
        assertTrue(job.transition(ModMutateJob.STATE_FETCHING));
        assertTrue(job.canCancel());
        assertTrue(job.transition(ModMutateJob.STATE_VERIFYING));
        assertTrue(job.canCancel());
        assertTrue(job.transition(ModMutateJob.STATE_BACKING_UP));
        assertTrue(job.canCancel());
        assertTrue(job.transition(ModMutateJob.STATE_APPLYING));
        assertFalse(job.canCancel());
        assertFalse(job.transition(ModMutateJob.STATE_CANCELLED));
        assertEquals(ModMutateJob.STATE_APPLYING, job.state);
    }

    @Test
    void cancelFromQueued() {
        ModMutateJob job = ModMutateJob.newSwap(
                "acc_1", "owner", "jei", "jei-1.0.jar",
                "proj", "ver", "abc", null);
        assertTrue(job.transition(ModMutateJob.STATE_CANCELLED));
        assertEquals(ModMutateJob.STATE_CANCELLED, job.state);
    }

    @Test
    void jsonRoundTrip() {
        ModMutateJob job = ModMutateJob.newSwap(
                "acc_1", "ella", "jei", "jei-1.0.jar",
                "proj", "ver", "deadbeef", "fp");
        job.transition(ModMutateJob.STATE_FETCHING);
        ModMutateJob loaded = ModMutateJob.fromJson(job.toJson());
        assertEquals(job.id, loaded.id);
        assertEquals(ModMutateJob.STATE_FETCHING, loaded.state);
        assertEquals("jei", loaded.mod_id);
        assertEquals("ella", loaded.actor_name);
    }

    @Test
    void batchAndInstallFactories() {
        ModMutateJob.Step step = new ModMutateJob.Step();
        step.mod_id = "foo";
        step.version_id = "ver1";
        ModMutateJob batch = ModMutateJob.newBatchSwap(
                "a", "alice", java.util.List.of(step), "fp", true);
        assertEquals(ModMutateJob.KIND_BATCH_SWAP, batch.kind);
        assertEquals(Boolean.TRUE, batch.continue_on_failure);
        assertEquals("foo", batch.mod_id);
        assertEquals(1, batch.steps.size());

        ModMutateJob install = ModMutateJob.newInstall(
                "a", "alice", "bar", "proj", "ver2", "sha", null);
        assertEquals(ModMutateJob.KIND_INSTALL, install.kind);
        assertEquals("bar", install.mod_id);
        assertEquals("ver2", install.version_id);
    }
}
