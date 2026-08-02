# Forensic file note — logs/debug-2.log.gz

**rel:** `logs/debug-2.log.gz`  
**kind:** debug_gz  
**line_count:** 21271  
**read_complete:** true  

## Time span
- First useful timestamp: 01Aug2026 23:05:42.735
- Last useful timestamp: 01Aug2026 23:06:12.161

## Session phases
- Boot: DEBUG-level twin of a bounce boot immediately before the long overnight session. Same NeoForge 21.1.248 / 1.21.1 pack. Dense TRACE/DEBUG mixin + FML scan (~21k lines for ~30s wall). Includes `opac_better_commands`, Sable, Spark, Watchtower, Jade, createfood recipe flood, loot-parse flood, DISTXFORM, MariaDB addon fail.
- Runtime: `Done (4.005s)` @ L21049 (23:06:02). Watchtower ready + dashboard `0.0.0.0:26014` @ L21092–21093. Players already authenticating via Velocity (ChuckieGamer, Hyp3rionNL, MatusOP, …) within seconds of Done — never fully settles into play.
- Stop / crash / restart: Graceful-looking stop ~8s after Done: Votifier/TAB/LuckPerms shutdown then `Stopping server` @ L21228 (23:06:10). No crash report. Immediate relaunch becomes `2026-08-01-1.log.gz` / `debug-1.log.gz` at 23:06:32.

## Notable events
- Entire DEBUG rotate is a **panel/host bounce** with almost no gameplay — c2me/tt20 ServerWatchdog mixins apply at Done, then process stops.
- Watchtower engine probe OK (4.0.6) + ready messages present.
- No `NoSuchMethodError`, no Sable body-removed, no ServerHangWatchdog hang (only mixin metadata mentioning ServerWatchdog).
- Census `jade_invwrapper_npe:15` is false-positive on Jade DEBUG/load lines — **zero real InvWrapper NPE** in this short life.

## Player / ops impact
- Hurt vs quiet: Seconds of downtime during reconnect storm after evening crashes. Players mid-Velocity-auth when kill lands. Not a mod fault.

## Noise vs hurt
- Dominant spam: DEBUG mixin flood (majority of lines), loot-parse ~560, createfood/KubeJS recipe WARNs ~1400, DISTXFORM 171 (DEBUG+ERROR), LuckPerms SQL DEBUG chatter.
- Real incidents: intentional/short restart only.

## Surprises / script-blind candidates
- DEBUG log makes recipe/loot noise look enormous relative to INFO rotates — same underlying spam, amplified by verbosity.
- Pair with `debug-1`: this file is the failed/aborted start; `debug-1` is the session that sticks.
- Census jade_invwrapper overcount on DEBUG files is a pattern catalog bug candidate.

## WT relevance / Prior pass
- Related: post-**FB-01…FB-05** recovery bounce; OPAC Better Commands still loaded. Ingestion of debug_gz is typically **partial** for WT LogScanner (INFO rotates preferred) — note as unread/partial vs latest/rotates depending on product path.
- Ingestion: partial
