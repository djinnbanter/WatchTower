package dev.mcstatus.watchtower.core.research;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

import java.nio.file.Path;

import static org.junit.jupiter.api.Assertions.assertTrue;

class SampleCrashReplayHarnessTest {

    @Test
    @EnabledIfSystemProperty(named = "wt.sample.root", matches = ".+")
    void replayCrashesToResearchOut() throws Exception {
        Path sampleRoot = resolveRepoPath(System.getProperty("wt.sample.root"));
        Path outDir = resolveRepoPath(System.getProperty(
                "wt.research.out",
                "docs/superpowers/research-runs/_adhoc"));
        Path written = SampleCrashReplayHarness.replay(sampleRoot, outDir);
        assertTrue(java.nio.file.Files.isRegularFile(written), "missing " + written);
    }

    /** Repo-relative paths resolve from {@code wt.repo.root} (default: parent of watchtower-core). */
    private static Path resolveRepoPath(String raw) {
        Path p = Path.of(raw);
        if (p.isAbsolute()) {
            return p;
        }
        String repoRoot = System.getProperty("wt.repo.root", "..");
        return Path.of(repoRoot).resolve(p).normalize();
    }
}
