package dev.mcstatus.watchtower;

import com.google.gson.JsonObject;
import dev.mcstatus.watchtower.core.collect.ModMutateJob;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

public final class WatchtowerRuntimeState {
    private volatile Instant lastReportStarted;
    private volatile Instant lastReportFinished;
    private volatile boolean lastReportSuccess;
    private volatile String lastReportMessage = "";
    private volatile String lastBriefPath = "";
    private volatile String lastFactsPath = "";
    private volatile String lastFullPath = "";
    private volatile boolean reportRunning;
    private volatile String reportStage = "";
    private volatile String reportStageLabel = "";
    private volatile String reportStageDetail = "";
    private volatile int lastActiveIssueCount;
    private volatile int lastHistoricalIssueCount;
    private volatile List<FactsReader.IssueSummary> lastActiveIssues = List.of();

    private volatile boolean modrinthScanRunning;
    private volatile Instant lastModrinthScanStarted;
    private volatile Instant lastModrinthScanFinished;
    private volatile boolean lastModrinthScanSuccess;
    private volatile String lastModrinthScanMessage = "";
    private volatile String modrinthStage = "";
    private volatile String modrinthStageLabel = "";
    private volatile String modrinthStageDetail = "";
    private volatile int modrinthProgressDone;
    private volatile int modrinthProgressTotal;
    private volatile int modrinthBatchIndex;
    private volatile int modrinthBatchCount;
    private volatile int modrinthBatchSize;
    private volatile Integer modrinthEtaSeconds;
    private volatile JsonObject lastModrinthStatus;

    private volatile boolean discoveryRunning;
    private volatile Instant lastDiscoveryStarted;
    private volatile Instant lastDiscoveryFinished;
    private volatile boolean lastDiscoverySuccess;
    private volatile String lastDiscoveryMessage = "";
    private volatile String discoveryStage = "";
    private volatile String discoveryStageLabel = "";
    private volatile String discoveryStageDetail = "";
    private volatile int discoveryProgressDone;
    private volatile int discoveryProgressTotal;
    private volatile JsonObject lastDiscoveryStatus;
    private volatile JsonObject discoveryCounts = new JsonObject();

    private volatile ModMutateJob activeMutateJob;
    private final Map<String, ModMutateJob> recentMutateJobs = new LinkedHashMap<>() {
        @Override
        protected boolean removeEldestEntry(Map.Entry<String, ModMutateJob> eldest) {
            return size() > 48;
        }
    };

    public synchronized boolean tryBeginReport() {
        if (reportRunning) {
            return false;
        }
        reportRunning = true;
        reportStage = "";
        reportStageLabel = "";
        reportStageDetail = "";
        lastReportStarted = Instant.now();
        return true;
    }

    public synchronized void setReportStage(String stage, String label) {
        reportStage = stage == null ? "" : stage;
        reportStageLabel = label == null ? "" : label;
        reportStageDetail = "";
    }

    public synchronized void setReportDetail(String detail) {
        reportStageDetail = detail == null ? "" : detail;
    }

    public synchronized void finishReport(
            boolean success,
            String message,
            String brief,
            String facts,
            String full,
            FactsReader.IssueCounts issueCounts
    ) {
        reportRunning = false;
        reportStage = "";
        reportStageLabel = "";
        reportStageDetail = "";
        lastReportFinished = Instant.now();
        lastReportSuccess = success;
        lastReportMessage = message == null ? "" : message;
        if (brief != null && !brief.isBlank()) {
            lastBriefPath = brief;
        }
        if (facts != null && !facts.isBlank()) {
            lastFactsPath = facts;
        }
        if (full != null && !full.isBlank()) {
            lastFullPath = full;
        }
        if (issueCounts != null) {
            lastActiveIssueCount = issueCounts.activeCount();
            lastHistoricalIssueCount = issueCounts.historicalCount();
            lastActiveIssues = issueCounts.activeIssues();
        }
    }

    public boolean isReportRunning() {
        return reportRunning;
    }

    /**
     * Best-effort clear of discovery/report busy flags when the server stops or unbinds
     * mid-audit. Idempotent. Does not write a successful last-report result.
     */
    public synchronized void releaseRunningLocksOnStop() {
        if (reportRunning) {
            finishReport(false, "Interrupted because the server stopped.", null, null, null, null);
        }
        if (discoveryRunning) {
            finishDiscovery(false, "Interrupted because the server stopped.", null);
        }
    }

    public String getReportStage() {
        return reportStage;
    }

    public String getReportStageLabel() {
        return reportStageLabel;
    }

    public String getReportStageDetail() {
        return reportStageDetail;
    }

    public Optional<Instant> getLastReportStarted() {
        return Optional.ofNullable(lastReportStarted);
    }

    public Optional<Instant> getLastReportFinished() {
        return Optional.ofNullable(lastReportFinished);
    }

    public boolean isLastReportSuccess() {
        return lastReportSuccess;
    }

    public String getLastReportMessage() {
        return lastReportMessage;
    }

    public String getLastBriefPath() {
        return lastBriefPath;
    }

    public String getLastFactsPath() {
        return lastFactsPath;
    }

    public String getLastFullPath() {
        return lastFullPath;
    }

    public int getLastActiveIssueCount() {
        return lastActiveIssueCount;
    }

    public int getLastHistoricalIssueCount() {
        return lastHistoricalIssueCount;
    }

    public List<FactsReader.IssueSummary> getLastActiveIssues() {
        return lastActiveIssues;
    }

    public synchronized boolean tryBeginModrinthScan() {
        if (modrinthScanRunning) {
            return false;
        }
        modrinthScanRunning = true;
        modrinthStage = "prepare";
        modrinthStageLabel = "Preparing Modrinth scan";
        modrinthStageDetail = "";
        modrinthProgressDone = 0;
        modrinthProgressTotal = 0;
        modrinthBatchIndex = 0;
        modrinthBatchCount = 0;
        modrinthBatchSize = 0;
        modrinthEtaSeconds = null;
        lastModrinthScanStarted = Instant.now();
        lastModrinthScanMessage = "";
        return true;
    }

    public synchronized void setModrinthScanStage(String stage, String label) {
        modrinthStage = stage == null ? "" : stage;
        modrinthStageLabel = label == null ? "" : label;
        modrinthStageDetail = "";
    }

    public synchronized void setModrinthScanDetail(String detail) {
        modrinthStageDetail = detail == null ? "" : detail;
    }

    public synchronized void setModrinthScanUnits(int done, int total) {
        modrinthProgressDone = Math.max(0, done);
        modrinthProgressTotal = Math.max(0, total);
    }

    public synchronized void setModrinthScanBatch(int index, int count, int size) {
        modrinthBatchIndex = Math.max(0, index);
        modrinthBatchCount = Math.max(0, count);
        modrinthBatchSize = Math.max(0, size);
    }

    public synchronized void setModrinthScanEtaSeconds(Integer seconds) {
        modrinthEtaSeconds = seconds;
    }

    public synchronized void finishModrinthScan(boolean success, String message, JsonObject status) {
        modrinthScanRunning = false;
        modrinthStage = "";
        modrinthStageLabel = "";
        modrinthStageDetail = "";
        modrinthProgressDone = 0;
        modrinthProgressTotal = 0;
        modrinthBatchIndex = 0;
        modrinthBatchCount = 0;
        modrinthBatchSize = 0;
        modrinthEtaSeconds = null;
        lastModrinthScanFinished = Instant.now();
        lastModrinthScanSuccess = success;
        lastModrinthScanMessage = message == null ? "" : message;
        if (status != null) {
            lastModrinthStatus = status.deepCopy();
        }
    }

    public boolean isModrinthScanRunning() {
        return modrinthScanRunning;
    }

    public String getModrinthStage() {
        return modrinthStage;
    }

    public String getModrinthStageLabel() {
        return modrinthStageLabel;
    }

    public String getModrinthStageDetail() {
        return modrinthStageDetail;
    }

    public int getModrinthProgressDone() {
        return modrinthProgressDone;
    }

    public int getModrinthProgressTotal() {
        return modrinthProgressTotal;
    }

    public int getModrinthBatchIndex() {
        return modrinthBatchIndex;
    }

    public int getModrinthBatchCount() {
        return modrinthBatchCount;
    }

    public int getModrinthBatchSize() {
        return modrinthBatchSize;
    }

    public Integer getModrinthEtaSeconds() {
        return modrinthEtaSeconds;
    }

    public Optional<Instant> getLastModrinthScanStarted() {
        return Optional.ofNullable(lastModrinthScanStarted);
    }

    public Optional<Instant> getLastModrinthScanFinished() {
        return Optional.ofNullable(lastModrinthScanFinished);
    }

    public boolean isLastModrinthScanSuccess() {
        return lastModrinthScanSuccess;
    }

    public String getLastModrinthScanMessage() {
        return lastModrinthScanMessage;
    }

    public JsonObject getLastModrinthStatus() {
        return lastModrinthStatus;
    }

    public synchronized boolean tryBeginDiscovery() {
        if (discoveryRunning) {
            return false;
        }
        discoveryRunning = true;
        discoveryStage = "prepare";
        discoveryStageLabel = "Preparing discovery";
        discoveryStageDetail = "";
        discoveryProgressDone = 0;
        discoveryProgressTotal = 0;
        discoveryCounts = new JsonObject();
        lastDiscoveryStarted = Instant.now();
        lastDiscoveryMessage = "";
        lastDiscoverySuccess = false;
        return true;
    }

    public synchronized void setDiscoveryStage(String stage, String label) {
        discoveryStage = stage == null ? "" : stage;
        discoveryStageLabel = label == null ? "" : label;
        discoveryStageDetail = "";
    }

    public synchronized void setDiscoveryDetail(String detail) {
        discoveryStageDetail = detail == null ? "" : detail;
    }

    public synchronized void setDiscoveryUnits(int done, int total) {
        discoveryProgressDone = Math.max(0, done);
        discoveryProgressTotal = Math.max(0, total);
    }

    public synchronized void setDiscoveryCounts(JsonObject counts) {
        discoveryCounts = counts != null ? counts.deepCopy() : new JsonObject();
    }

    /** Merge a single live count into discovery progress (e.g. logs / crashes / jars). */
    public synchronized void putDiscoveryCount(String key, int count) {
        if (key == null || key.isBlank()) {
            return;
        }
        if (discoveryCounts == null) {
            discoveryCounts = new JsonObject();
        }
        discoveryCounts.addProperty(key, Math.max(0, count));
    }

    public synchronized void finishDiscovery(boolean success, String message, JsonObject status) {
        discoveryRunning = false;
        discoveryStage = success ? "done" : discoveryStage;
        discoveryStageLabel = success ? "Done" : discoveryStageLabel;
        discoveryStageDetail = "";
        discoveryProgressDone = 0;
        discoveryProgressTotal = 0;
        lastDiscoveryFinished = Instant.now();
        lastDiscoverySuccess = success;
        lastDiscoveryMessage = message == null ? "" : message;
        if (status != null) {
            lastDiscoveryStatus = status.deepCopy();
            if (status.has("counts") && status.get("counts").isJsonObject()) {
                discoveryCounts = status.getAsJsonObject("counts").deepCopy();
            }
        }
    }

    public boolean isDiscoveryRunning() {
        return discoveryRunning;
    }

    public String getDiscoveryStage() {
        return discoveryStage;
    }

    public String getDiscoveryStageLabel() {
        return discoveryStageLabel;
    }

    public String getDiscoveryStageDetail() {
        return discoveryStageDetail;
    }

    public int getDiscoveryProgressDone() {
        return discoveryProgressDone;
    }

    public int getDiscoveryProgressTotal() {
        return discoveryProgressTotal;
    }

    public JsonObject getDiscoveryCounts() {
        return discoveryCounts != null ? discoveryCounts.deepCopy() : new JsonObject();
    }

    public Optional<Instant> getLastDiscoveryStarted() {
        return Optional.ofNullable(lastDiscoveryStarted);
    }

    public Optional<Instant> getLastDiscoveryFinished() {
        return Optional.ofNullable(lastDiscoveryFinished);
    }

    public boolean isLastDiscoverySuccess() {
        return lastDiscoverySuccess;
    }

    public String getLastDiscoveryMessage() {
        return lastDiscoveryMessage;
    }

    public JsonObject getLastDiscoveryStatus() {
        return lastDiscoveryStatus;
    }

    /**
     * Claim the single-writer mutate lock. Returns false when another non-terminal job is active.
     */
    public synchronized boolean tryBeginMutate(ModMutateJob job) {
        if (job == null) {
            return false;
        }
        if (isMutateBusy()) {
            return false;
        }
        activeMutateJob = job;
        rememberMutateJob(job);
        return true;
    }

    /**
     * Release the mutate lock only when {@code jobId} matches the active job.
     * Stale finishes from an earlier runner must not clear a newer job's lock.
     */
    public synchronized void finishMutate(String jobId) {
        if (activeMutateJob == null) {
            return;
        }
        rememberMutateJob(activeMutateJob);
        if (jobId != null && jobId.equals(activeMutateJob.id)) {
            activeMutateJob = null;
        }
    }

    public synchronized ModMutateJob getActiveMutateJob() {
        return activeMutateJob;
    }

    /** Busy until {@link #finishMutate(String)} clears the active slot (even if the job is terminal). */
    public synchronized boolean isMutateBusy() {
        return activeMutateJob != null;
    }

    public synchronized void updateMutateJob(ModMutateJob job) {
        if (job == null) {
            return;
        }
        if (activeMutateJob != null && job.id != null && job.id.equals(activeMutateJob.id)) {
            activeMutateJob = job;
        }
        rememberMutateJob(job);
    }

    /** Active job first, then a recent finished job by id (brief retention). */
    public synchronized ModMutateJob getMutateJob(String jobId) {
        if (jobId == null || jobId.isBlank()) {
            return null;
        }
        if (activeMutateJob != null && jobId.equals(activeMutateJob.id)) {
            return activeMutateJob;
        }
        return recentMutateJobs.get(jobId);
    }

    private void rememberMutateJob(ModMutateJob job) {
        if (job == null || job.id == null || job.id.isBlank()) {
            return;
        }
        recentMutateJobs.put(job.id, job);
    }
}
