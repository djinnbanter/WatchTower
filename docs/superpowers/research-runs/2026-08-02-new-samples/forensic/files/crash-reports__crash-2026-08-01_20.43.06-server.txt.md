# Forensic file note — crash-reports/crash-2026-08-01_20.43.06-server.txt

**rel:** `crash-reports/crash-2026-08-01_20.43.06-server.txt`  
**kind:** crash (watchdog)  
**line_count:** 3168  
**read_complete:** true  

## Time span
- First useful timestamp: 2026-08-01 20:43:06
- Last useful timestamp: same (~66 s after OPAC listener crash 20:42:00)

## Session phases
- Boot: not applicable
- Runtime: thread dump of a server whose **main tick thread is already gone**
- Stop / crash / restart: `Description: Watching Server` — `ServerHangWatchdog` after prior tick-loop death

## Notable events
- `java.lang.Error: ServerHangWatchdog detected that a single server tick took 60000004.00 seconds (should be max 0.05)` (~60s max-tick config)
- Full traversal: **249** named threads in dump; **no `"Server thread"` entry** — confirms follow-up after tick loop already died from OPAC crash, not an independent lag hang with a stuck stack to diagnose
- c2me-worker-* threads present; Chunky appears only in mod-list region (~2 hits), not as a stuck pregen stack
- Netty Epoll Server IO threads abundant — networking still alive while tick dead
- c2me mixin on ServerWatchdog itself (`MixinDedicatedServerWatchdog`) — why WT may latch `c2me_base` as primary from watchdog frames
- Remainder: System Details + large mod list (same pack as OPAC crashes)

## Player / ops impact
- Hurt vs quiet: **Sequel hurt** — players already doomed by 20:42 crash; this report is the ~60s watchdog epilogue, not a new root outage

## Noise vs hurt
- Dominant spam patterns: thread-dump volume (ForkJoin + Netty + c2me workers) — traverse fully; signal is **absence of Server thread** + timing vs prior crash
- Real incidents: watchdog_followup to OPAC listener crash

## Surprises / script-blind candidates
- Missing Server thread is a strong chain signal that stack-frame scorers (c2me in watchdog mixin) miss
- Chunky/DH/MSPT advice is actively misleading here

## WT relevance / Prior pass
- Related: `crash-0801-watchdog-2043` / **FB-03** (linkage, wrong_primary, bad_advice P1)
- Replay: `failure_kind=watchdog`, primary `c2me_base`, host_resource framing; no `paired_primary_file` to 20.42.00
- Expected: `watchdog_followup`, primary `opac_better_commands`, link prior crash
- Ingestion: seen
