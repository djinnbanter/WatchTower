# Ingestion checklist

Sample root: `samples/new samples 02.08.2026`

| kind | example path | wt_readers | status | notes |
| --- | --- | --- | --- | --- |
| latest | logs/latest.log | LogScanner, OpsLogTailScanner | seen |  |
| debug | logs/debug.log | LogScanner | seen |  |
| rotate_gz | logs/2026-07-29-1.log.gz | LogScanner, GzipLineReader | seen |  |
| debug_gz | logs/debug-1.log.gz | LogScanner, GzipLineReader | seen |  |
| crash | crash-reports/crash-2026-07-31_17.27.20-server.txt | CrashReportScanner, CrashMtimeScanner, CrashClassifier, CrashNarrator | seen |  |
| kubejs | logs/kubejs/client.log | SilentFailSignatures (partial via latest only) | partial | Dedicated kubejs/*.log not in LogScanner file set |
| jade | logs/JadeErrorOutput.txt | — | unread | JadeErrorOutput.txt sidecar not scanned today |
| archive | logs/mega.tar.gz | — | unread | Nested archives not auto-ingested; inventory dedupes members |
| other | — | — | partial | Unknown sidecar — review manually |
