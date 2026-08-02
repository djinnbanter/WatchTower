# Forensic file note — crash-reports/crash-2026-08-01_21.49.17-server.txt

**rel:** `crash-reports/crash-2026-08-01_21.49.17-server.txt`  
**kind:** crash  
**line_count:** 304  
**read_complete:** true  

## Time span
- First useful timestamp: 2026-08-01 21:49:17
- Last useful timestamp: same

## Session phases
- Boot: not in file
- Runtime: **35/40 players**; Sable overworld loaded=2, ewma=1.593ms; **2 sub-levels**; **active Create carriage contraption**
- Stop / crash / restart: tick-loop death during **world save / sublevel serialize**

## Notable events
- `java.lang.RuntimeException: Body has been removed`
- Stack: `RapierPhysicsPipeline.assertBodyValid` ← `getLinearVelocity` ← `SubLevelSerializer.serialize` ← `SubLevelHoldingChunkMap.moveAndSaveSubLevel/saveAll` ← `ServerLevel.save` (sable mixin `saveSubLevels`) ← `MinecraftServer.saveAllChunks` ← `tickServer`
- Shtreimel snapshot: `currently processing contraption: entity#143717 (CarriageContraptionEntity) contraption=create:carriage` at (34.50, 101.00, 174.39)
- Primary module jar named `sable_rapier` 1.21.1-2.0.3
- Crash is **save-path / stale physics body**, not a generic random tick crash

## Player / ops impact
- Hurt vs quiet: **Hard hurt** — mid-session crash for ~35 players during autosave; Create train/carriage + Sable sublevels in play

## Noise vs hurt
- Dominant spam patterns: none
- Real incidents: Sable body-removed on sublevel save (second Aug 1 root crash family)

## Surprises / script-blind candidates
- Create `CarriageContraptionEntity` is essential operator context; blaming Create as primary would be wrong, but omitting it from Fix is also wrong
- Immediate precursor to 21:50 watchdog

## WT relevance / Prior pass
- Related: `crash-0801-sable` / **FB-04** (bad_advice P1 — primary OK)
- Replay: primary `sable_rapier` correct; Fix is generic update/remove without sublevel-save / contraption context
- Ingestion: seen
