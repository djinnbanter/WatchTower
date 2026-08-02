# Forensic file note — logs/JadeErrorOutput.txt

**rel:** `logs/JadeErrorOutput.txt`  
**kind:** jade (sidecar)  
**line_count:** 205  
**read_complete:** true  

## Time span
- First useful timestamp: Aug 1, 2026, 6:54:07 PM
- Last useful timestamp: Aug 2, 2026, 2:56:31 PM

## Session phases
- Boot: n/a (runtime tooltip/server-data requests only)
- Runtime: **8 discrete INSTANCE events** across Aug 1 evening → Aug 2 afternoon (spans multiple server sessions including crash evening)
- Stop / crash / restart: none — non-fatal; caught/logged to sidecar

## Notable events
- 8 `INSTANCE` blocks (not 67 InvWrapper NPEs as prior census claimed for this file):
  1. Aug 1 6:54 PM — `InvWrapper.getInv()` NPE via Jade `ItemStorageProvider` / `ItemCollector`
  2. Aug 1 7:47 PM — same InvWrapper NPE
  3. Aug 1 9:04 PM — same InvWrapper NPE
  4. Aug 1 10:04 PM — same InvWrapper NPE
  5. Aug 1 10:52 PM — **different**: `LecternProvider` NPE — `getBlockEntity()` null when reading lectern book
  6. Aug 1 11:56 PM — InvWrapper NPE again (5th InvWrapper)
  7. Aug 2 3:56 AM — **different**: `IllegalStateException: Unexpected error: no cauldron at location BlockPos{x=3327, y=63, z=2519}` via `CauldronWrapper` / Jade `FluidStorageProvider`
  8. Aug 2 2:56 PM — **different**: `ClassCastException` Create `LecternControllerBlockEntity` cannot cast to vanilla `LecternBlockEntity` in Jade `LecternProvider`
- Jade 15.10.5+neoforge; NeoForge 21.1.248 on stacks
- Exact line count with `InvWrapper.getInv()`: **5** (one per InvWrapper event), not 67

## Player / ops impact
- Hurt vs quiet: **Quiet / cosmetic** — tooltip/overlay server-data failures; no crash, no kick. Players may see missing Jade inventory/fluid info on some blocks.

## Noise vs hurt
- Dominant spam patterns: InvWrapper NPE pattern — first Aug 1 6:54 PM, last Aug 1 11:56 PM, volume **5 events** in this sidecar (prior pass 67 figure does not match this file; may be corpus-wide / frame-count confusion)
- Real incidents: none operational; three distinct Jade failure modes worth typing if ever surfaced (InvWrapper, Lectern null BE, Create lectern ClassCast, cauldron race)

## Surprises / script-blind candidates
- Prior gap-matrix / FB-07 overstated InvWrapper-only volume for this sidecar; deep read finds **multi-exception** Jade sidecar, still unread by WT
- Create lectern ClassCast is a clear Create↔Jade compat signal census InvWrapper regex would miss
- Cauldron race at specific BlockPos is rare and script-blind

## WT relevance / Prior pass
- Related: `signal-jade-sidecar` / **FB-07** (blind P2) — still valid as ingestion blind; refine expected fixture to multi-exception Jade sidecar, not InvWrapper-only count of 67
- Ingestion: unread
