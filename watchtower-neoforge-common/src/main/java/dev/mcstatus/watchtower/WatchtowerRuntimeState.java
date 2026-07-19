package dev.mcstatus.watchtower;

import com.google.gson.JsonObject;

import java.time.Instant;
import java.util.List;
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
}
