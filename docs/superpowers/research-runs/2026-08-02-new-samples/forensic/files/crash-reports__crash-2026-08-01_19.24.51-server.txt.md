# Forensic file note — crash-reports/crash-2026-08-01_19.24.51-server.txt

**rel:** `crash-reports/crash-2026-08-01_19.24.51-server.txt`  
**kind:** crash  
**line_count:** 307  
**read_complete:** true  

## Time span
- First useful timestamp: 2026-08-01 19:24:51
- Last useful timestamp: same

## Session phases
- Boot: not in this file
- Runtime: full server — **40/40 players**; Sable physics for overworld/nether/end (0 bodies loaded, samples=21920); 0 sub-levels
- Stop / crash / restart: **tick-loop death** via party chat **command** path

## Notable events
- `java.lang.NoSuchMethodError: '...IServerData.getPlayerConfigs()'`
- Stack: `PartyMessenger.sendPartyMessage` ← `PartyChatCommand.register` ← brigadier ← `ServerGamePacketListenerImpl.performUnsignedChatCommand`
- Mods: `opac_better_commands` **1.5** vs `openpartiesandclaims` **0.29.3** — API/version mismatch
- NeoForge 21.1.248; `Server Running: true`; JVM `-Xms12G -XX:MaxRAMPercentage=95.0`
- Crash UUID `90c31b13-f90c-4223-bd94-bf704da713eb`
- Pack delta vs Jul 31: includes `neovelocity`, `brassworksmissions`, datapack `file/bwmissions.zip`

## Player / ops impact
- Hurt vs quiet: **Hard hurt** — full server crash at player cap from one party-chat command; all 40 players disconnected

## Noise vs hurt
- Dominant spam patterns: none in crash body
- Real incidents: OPAC Better Commands API mismatch on command entry point (first Aug 1 hard crash)

## Surprises / script-blind candidates
- Same missing method later fires via **chat listener** (20:42) — two entry points, one root cause
- Sable header present but physics snapshot is healthy / not causal

## WT relevance / Prior pass
- Related: `crash-0801-opac-cmd` / **FB-01** (wrong_kind, bad_advice P1)
- Replay: primary `opac_better_commands` OK; `failure_kind=mod_runtime` + generic update/remove Fix — misses API/version-alignment advice
- Ingestion: seen
