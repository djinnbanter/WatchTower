# Forensic file note — logs/debug-1.log.gz

**rel:** `logs/debug-1.log.gz`  
**kind:** debug_gz  
**line_count:** 137762  
**read_complete:** true  

## Time span
- First useful timestamp: 01Aug2026 23:06:32.386
- Last useful timestamp: 02Aug2026 15:31:08.636

## Session phases
- Boot: Same wall-clock boot as `2026-08-01-1.log.gz` (DEBUG twin). `Done (4.073s)` @ L21045. Watchtower ready; opac_better_commands still present after evening API crashes.
- Runtime: **~16.4 hour** continuous session Aug 1 23:06 → Aug 2 15:31. 302 joins / 302 leaves. Chronic tick lag throughout; severe storm afternoon Aug 2 (~15:16–15:22). Watchtower auto-captured lag **71×**. Periodic KubeJS `vots.js` redeclaration ERROR every ~30 minutes. Jade InvWrapper NPE at least twice. Repeated Sable “Couldn't find sub-level … chunk [3, 10]” ERRORs (**32×**).
- Stop / crash / restart: Clean-ish panel stop @ 15:31:07 (`Stopping server` L137713) after LuckPerms/TAB/Votifier teardown. Watchtower Modrinth scan completes on pool threads as last lines (L137761–137762). **No OPAC NSM, no ServerHangWatchdog hang, no Sable body-removed crash in this window** — those are earlier Aug 1 evening (FB-01…FB-05), outside this DEBUG span.

## Notable events
- **Lag (dominant real ops signal):** 1069× `Can't keep up`; max **30432 ms / 608 ticks** @ L135931 (02Aug 15:19:46); 602× ≥5s, 149× ≥10s, **1× ≥30s**. Worst cluster Aug 2 ~15:16–15:22 (top-10 all in that window). Final WT auto-capture @ L136999 shows MSPT **127.5 / TPS 7.9**.
- **KubeJS vots.js redeclaration:** 62 hits of `TypeError: redeclaration of var voteData` (`server_scripts:vots.js#119`) roughly every half hour from 00:00 through 15:30 — script bug noise on ServerEvents.tick, not a crash. Script also successfully clears daily vote list / registers votes at times.
- **Jade InvWrapper NPE (FB-07):** Real events include 23:56:48 (same as INFO rotate) and another `See JadeErrorOutput.txt` @ ~14:56:31. Census count 348 is **wildly inflated** by matching Jade DEBUG/load lines.
- **Sable sublevel missing (FB-04 residue):** 32× `Couldn't find sub-level at index 0 … chunk [3, 10]` spanning boot through 15:17 — persistent corrupt/missing sublevel storage after evening Sable crash chain.
- **No FB-01/02/03/05 in-file:** 0× `NoSuchMethodError` / PartyChatCommand / PartyChatListener / ServerHangWatchdog hang / Body has been removed. OPAC addon remains loaded (scan/DEBUG mentions) but does not re-crash in this DEBUG span.
- Resource reload mid-life produces another large loot-parse ERROR wave (Aug 2 Worker-ResourceReload) — census loot_parse 2240 includes reload, not just boot.
- createfood/KubeJS recipe WARNs also reappear on reload (~13:49) — **FB-08** continues.
- Spark still present; player chat notes “spark is gltiching” @ ~13:39 (social, not a crash).

## Player / ops impact
- Hurt vs quiet: Overnight/day session is survivable but chronically behind; afternoon Aug 2 lag spike is severe (20–30s behind). Jade NPEs annoy HUD probes. Sable sublevel errors risk future save crashes (FB-04 class). No hard crash in this DEBUG file — stop is operator/panel.

## Noise vs hurt
- Dominant spam after full traversal:
  - DEBUG mixin/FML/LuckPerms SQL TRACE (vast majority of 137k lines) — verbosity noise.
  - Loot-parse + createfood/KubeJS recipe floods on boot + reload (**FB-08**).
  - vots.js redeclaration every ~30m (62) — script noise.
  - Census false-positive jade_invwrapper_npe (348 vs ~2 real events).
- Real incidents: chronic + peaking tick lag; WT auto-captures; Jade NPE (**FB-07**); Sable missing sublevel (**FB-04** residue); post-**FB-01…05** recovery with opac_better_commands still installed.

## Surprises / script-blind candidates
- **Census jade_invwrapper_npe overcount on debug_gz** — pattern matches Jade logger/DEBUG, not InvWrapper NPE; deep-read ground truth ~2 events.
- vots.js redeclaration cadence is a clear scripted-ops signal not in the primary census catalog samples for this file.
- Long DEBUG session bridges Aug 1 night → Aug 2 afternoon; INFO rotates alone understate Aug 2 lag peak (max 30s behind).
- Watchtower Modrinth scan completing during shutdown is a neat WT-own line at EOF.

## WT relevance / Prior pass
- Related: **FB-07**, **FB-04** residue, **FB-08**, post-**FB-01…FB-05** (addon still present; no new NSM/watchdog pair here). Tick-lag volume is by-design acceptable but this file is the best lag-storm evidence for Aug 2.
- Ingestion: partial (debug_gz; WT typically prioritizes INFO rotates / latest — verify whether 4MB tail would even see afternoon lag peak vs boot DEBUG flood)
