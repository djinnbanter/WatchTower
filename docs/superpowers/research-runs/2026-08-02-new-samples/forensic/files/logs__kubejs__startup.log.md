# Forensic file note — logs/kubejs/startup.log

**rel:** `logs/kubejs/startup.log`  
**kind:** kubejs  
**line_count:** 13  
**read_complete:** true  

## Time span
- First useful timestamp: 15:33:06 (same Aug 2 boot as `latest.log` / server.log)
- Last useful timestamp: 15:33:06

## Session phases
- Boot: entire file is KubeJS startup script load (~1 s)
- Runtime: none
- Stop / crash / restart: none

## Notable events
- KubeJS 2101.7.2-build.368; MC 2101 NeoForge
- Plugins loaded: Builtin, ArchitecturyIntegration, KubeUtils, LootJS, AdditionsPlugin, KubeJSCreate
- `startup_scripts:main.js` — "Hello, World!" example; Loaded 1/1 startup scripts in 0.643 s with **0 errors and 0 warnings**
- Validated 0 files in kubejs/data/ in 1ms

## Player / ops impact
- Hurt vs quiet: **Quiet** — clean startup scripts

## Noise vs hurt
- Dominant spam patterns: none
- Real incidents: none

## Surprises / script-blind candidates
- Contrast with `server.log`: startup is clean while server recipe phase floods WARNs — recipe flood is **not** in startup.log
- Example Hello World script still shipping — hygiene only

## WT relevance / Prior pass
- Related: `signal-kubejs-sidecar` / **FB-09**
- Ingestion: unread (outside GzipLineReader.iterLogFiles)
