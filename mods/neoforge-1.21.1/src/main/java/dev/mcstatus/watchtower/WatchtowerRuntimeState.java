package dev.mcstatus.watchtower;

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
    private volatile int lastActiveIssueCount;
    private volatile int lastHistoricalIssueCount;
    private volatile List<FactsReader.IssueSummary> lastActiveIssues = List.of();

    public synchronized boolean tryBeginReport() {
        if (reportRunning) {
            return false;
        }
        reportRunning = true;
        lastReportStarted = Instant.now();
        return true;
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
}
