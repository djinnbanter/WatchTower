# Forensic file note — crash-reports/crash-2026-08-01_21.50.21-server.txt

**rel:** `crash-reports/crash-2026-08-01_21.50.21-server.txt`  
**kind:** crash (watchdog)  
**line_count:** 3423  
**read_complete:** true  

## Time span
- First useful timestamp: 2026-08-01 21:50:21
- Last useful timestamp: same (~64 s after Sable crash 21:49:17)

## Session phases
- Boot: n/a
- Runtime: post-Sable-crash dump
- Stop / crash / restart: second `Watching Server` watchdog of the evening

## Notable events
- Same watchdog Error: single tick took 60000004.00 seconds
- Full traversal: **288** named threads; again **no `"Server thread"`**
- Same structural pattern as 20:43: c2me workers + Netty alive; Chunky only in mod list; c2me mixin on ServerWatchdog
- Larger dump than 20:43 (3423 vs 3168 lines) — more worker/thread noise, same causal shape

## Player / ops impact
- Hurt vs quiet: **Sequel** to Sable save crash — not an independent hang diagnosis target

## Noise vs hurt
- Dominant spam patterns: thread dump volume (ForkJoin/c2me/Netty); signal is timing + missing Server thread
- Real incidents: watchdog_followup pair #2 (Sable → watchdog)

## Surprises / script-blind candidates
- Identical wrong-primary failure mode as FB-03; second golden for IncidentChainBuilder

## WT relevance / Prior pass
- Related: `crash-0801-watchdog-2150` / **FB-05**
- Replay: `watchdog` + `c2me_base` primary; should be `watchdog_followup` with `sable_rapier` / paired file 21.49.17
- Ingestion: seen
