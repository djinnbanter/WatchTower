# Forensic file note — logs/debug.log

**rel:** `logs/debug.log`  
**kind:** debug_log  
**line_count:** 22407  
**read_complete:** true  

## Time span
- First useful timestamp: `02Aug2026 15:32:57.758` (ModLauncher boot — afternoon restart after 15:31 stop)
- Last useful timestamp: `02Aug2026 15:33:59.861` (LuckPerms MariaDB messenger DEBUG query; file ends mid-session ~1 min post-Done)

## Session phases
- Boot: Full debug-level boot for NeoForge 21.1.248 / 1.21.1. Extremely verbose mixin TRACE/DEBUG, mod discovery DEBUG, DISTXFORM configure + client-class rejects, FML container creation. GriefLogger MariaDB connection fail (ERROR) + disable. Loot/createfood/KubeJS recipe parse floods. OPAC better commands discovered + registered. `Done (3.998s)!` L21462 / 15:33:17.
- Runtime: Short live window only (~42 s in file after Done). 13 Velocity-authenticated players begin joining. 2× `Can't keep up` (L21874, L22358). Recipe-book unrecognized Create recipes. WatchTower ready. No crash. File ends while still running (corpus cut / sample capture), no `Stopping server`.
- Stop / crash / restart: None in file.

## Notable events
- Pairs with timeline note: brief afternoon boot after clean 15:31 stop of `2026-08-02-1`.
- DEBUG inflation: “watchdog” keyword hits are almost all mixin metadata / TRACE for `ServerWatchdog` class + c2me instrumentation injects at Done — **not** hang events (0 FATAL watchdog).
- db_addon-like volume includes LuckPerms MariaDB client DEBUG query spam after boot, not only GriefLogger fail (true fail still present once).
- Jade plugin load DEBUG lines inflate jade-ish census hits without InvWrapper NPE stacks in this short window.
- opac_better_commands **still installed** afternoon of Aug 2.

## Player / ops impact
- Hurt vs quiet: Fresh boot; light early lag (2 cant-keep-up). No outage in capture window.

## Noise vs hurt
- Dominant spam after full traversal (~22k lines, ~1 wall-minute of DEBUG logging):
  - Mixin DEBUG/TRACE class version / CallbackInfo chatter — thousands of lines (majority of file)
  - DISTXFORM DEBUG+ERROR (~171 pattern hits including configure) — FB-10 class
  - createfood/KubeJS/loot boot floods — FB-08/10
  - LuckPerms MariaDB DEBUG queries — high-frequency at end
  - copycats @Unique discard WARNs
- Real incidents: GriefLogger MariaDB fail (FB-11); mild post-boot lag. No crash-class events.

## Surprises / script-blind candidates
- Naive keyword census on debug.log wildly overcounts “watchdog”, “jade”, “MariaDB” vs INFO logs.
- Sample ends mid-runtime — incomplete session artifact.
- Dashboard/host still panel `/home/container`.

## WT relevance / Prior pass
- Related: post-Aug1 recovery boot; latent **FB-01/FB-02** (OPAC present); FB-08/10/11 boot noise. Not FB-03/05.
- Ingestion: seen (debug.log typically ingested if on scanner path; DEBUG volume = noise_drown risk)
