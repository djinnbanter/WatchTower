# Forensic file note — logs/debug-3.log.gz

**rel:** `logs/debug-3.log.gz`  
**kind:** debug_rotate_gz  
**line_count:** 34277  
**read_complete:** true  

## Time span
- First useful timestamp: `01Aug2026 21:50:26.913`
- Last useful timestamp: `01Aug2026 23:05:37.450`
- **Paired INFO rotate:** `logs/2026-08-01-7.log.gz` (same wall clock / same session)

## Session phases
- Boot: Same reboot after Sable+watchdog as `-7`, but DEBUG-level. `Done (3.947s)!` L21046. Massive early mixin/DISTXFORM/FML DEBUG preamble (~20k lines before Done).
- Runtime: Mirrors `-7` gameplay: 75 joins / 56 leaves, 130× cant-keep-up, boat move storms, Jade NPEs (InvWrapper + lectern), Sable missing sub-level index ERRORs, LuckPerms hikari issues. No hard crash.
- Stop / crash / restart: Clean `Stopping server` L34197 / 23:05:28. No crash reports.

## Notable events
- Confirms recovery session narrative from INFO twin; adds DEBUG-only density.
- Keyword “watchdog” hits (~9) are mixin TRACE/DEBUG around ServerWatchdog class — **not** hang FATAL (0 actual hangs; matches `-7`).
- db_addon pattern inflated (~5053) by LuckPerms MariaDB DEBUG traffic + GriefLogger fail — do not treat as 5k DB outages.
- Jade → `See JadeErrorOutput.txt` still present (FB-07 sidecar pointer).

## Player / ops impact
- Hurt vs quiet: Same as `-7` — laggy but no crash; ops stop at 23:05.

## Noise vs hurt
- Dominant spam: mixin DEBUG (bulk of +26k lines vs INFO twin), DISTXFORM (~171), recipe/loot floods, MariaDB DEBUG, vehicle/lag WARNs, cant-keep-up 130×.
- Real incidents: same as `-7` (lag; Sable sublevel miss aftermath; Jade NPEs). No FB-01..05 new crashes.

## Surprises / script-blind candidates
- DEBUG twin nearly 4.2× line count of INFO for identical incidents — census must weight by level or pair files.
- Post-FB-04 “Couldn't find sub-level at index 0” visible in both twins.

## WT relevance / Prior pass
- Related: aftermath **FB-04/FB-05**; latent OPAC **FB-01/FB-02**; FB-07/08/10/11.
- Ingestion: seen (partial if debug rotates under-weighted vs INFO)
