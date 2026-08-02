# Forensic file note — logs/latest.log

**rel:** `logs/latest.log`  
**kind:** latest  
**line_count:** 3972  
**read_complete:** true  

## Time span
- First useful timestamp: 02Aug2026 15:32:57.758 (ModLauncher start)
- Last useful timestamp: 02Aug2026 15:33:59.259 (voice chat connect for RigelBound)
- Span: **~62 seconds** of an Aug 2 afternoon boot + early joins — **not** the Aug 1 crash evening

## Session phases
- Boot: ~lines 1–1600 — ModLauncher, mod discovery, mixin/DISTXFORM, registries
- Recipes / datapack: ~1600–3696 — KubeJS recipe WARNs, loot parse ERRORs, world load
- Runtime after Done: line 3697 `Done (3.998s)!` at 15:33:17.646 → early player joins through 15:33:59
- Stop / crash / restart: **none** in this latest.log (prior crashes are older rotated logs)

## Notable events
- NeoForge 21.1.248 / MC 1.21.1 dedicated server; Velocity proxy auth (`neovelocity`)
- Pattern counts after full traversal:
  - WARN ~1648; ERROR ~619; FATAL 0
  - Failed-to-parse / KubeJS recipe ~1402–1410 (mirrors kubejs/server.log)
  - createfood mentions ~1291
  - DISTXFORM client-on-server ERROR **15** (first 15:33:01.362 RenderSystem; last 15:33:02.672 ClientLevel)
  - GriefLogger Rollback Addon MariaDB: **2** ERROR lines at 15:33:08.653–654 — connection failed; addon disables itself
  - Can't keep up: **2** (15:33:27.422 / 15:33:51.927 — join storm after boot)
  - No watchdog, NoSuchMethod, Sable body-removed, or Spark profiler-inactive in this file
- Top ERROR loggers: LootDataType **560**, AbstractPackResources 16, RecipeManager 16, RuntimeDistCleaner 15, ServerRecipeBook 8, GriefloggerRollbackAddon 2, DataMapLoader 1, Sable 1
- Runtime: Sable auth on join; shtreimel sub-level add; PixelsAntiCheat hash OK; OPAC forceload ticket updates; FancyMenu handshake; voicechat secrets
- Unrecognized recipe book entries for create encased_chain_drive variants (removed recipes) on player join

## Player / ops impact
- Hurt vs quiet: **Mostly quiet** — successful boot to player joins. Boot ERROR/WARN flood is noise. Two Can't-keep-up during join burst are mild lag symptoms. MariaDB fail disables rollback addon only.

## Noise vs hurt
- Dominant spam patterns (full traversal):
  - createfood/KubeJS recipe WARN flood — first ~15:33:12, volume ~1402 in this file (same boot as kubejs/server.log)
  - loot LootDataType ERROR — 560 lines during datapack load
  - DISTXFORM — 15 lines early main thread
- Real incidents in this file: none matching Aug 1 hard crashes; MariaDB config fail (FB-11 class); join-time tick lag (acceptable)

## Surprises / script-blind candidates
- **Session mismatch**: this `latest.log` is Aug 2 post-crash reboot snippet; Aug 1 OPAC/Sable/watchdog evidence lives in dated `*.log.gz` (other batches)
- Grieflogger DB fail attributed to `griefloggerrollbackaddon` logger here, not core `grieflogger` — attribution nuance for FB-11
- Single Sable ERROR in boot — worth checking type if Issues surfaces it; not body-removed

## WT relevance / Prior pass
- Related: `signal-recipe-flood` / **FB-08**; `signal-distxform-loot` / **FB-10**; `signal-db-addon` / **FB-11**; tick-lag acceptable; Jade/KubeJS sidecars still separate blinds
- Ingestion: seen (primary LogScanner target)
