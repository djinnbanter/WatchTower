# Forensic file note — crash-reports/crash-2026-08-01_20.42.00-server.txt

**rel:** `crash-reports/crash-2026-08-01_20.42.00-server.txt`  
**kind:** crash  
**line_count:** 307  
**read_complete:** true  

## Time span
- First useful timestamp: 2026-08-01 20:42:00
- Last useful timestamp: same (~77 min after command-path OPAC crash)

## Session phases
- Boot: not in this file (server had restarted after 19:24)
- Runtime: **40/40 players**; overworld Sable loaded=1, ewma=0.663ms; **1 sub-level** (uuid 23e3aeb4… plot 10000,10000)
- Stop / crash / restart: tick-loop death via party chat **listener**; immediate precursor to watchdog at 20:43:06

## Notable events
- Same `NoSuchMethodError` on `IServerData.getPlayerConfigs()`
- Stack differs: `PartyChatListener.onServerChat` ← `CommonHooks.onServerChatSubmittedEvent` ← `handleChat` (normal chat submit, not slash-command)
- Same mod versions: opac_better_commands 1.5 / openpartiesandclaims 0.29.3
- Crash UUID `4041a983-0f67-4d58-9251-b8249aaeff1a`

## Player / ops impact
- Hurt vs quiet: **Hard hurt** — second full wipe at player cap; any chat that triggers party listener can detonate

## Noise vs hurt
- Dominant spam patterns: none
- Real incidents: second OPAC entry point; starts the 20:42→20:43 crash/watchdog pair

## Surprises / script-blind candidates
- Easy to treat as a new bug vs 19:24 command crash — same root, different trigger
- Active Sable sub-level is context only; exception is still OPAC

## WT relevance / Prior pass
- Related: `crash-0801-opac-listener` / **FB-02**; pairs with **FB-03** watchdog follow-up
- Replay: same `mod_runtime` + generic Fix gap as FB-01
- Ingestion: seen
