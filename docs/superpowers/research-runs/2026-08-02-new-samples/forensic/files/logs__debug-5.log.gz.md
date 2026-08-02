# Forensic file note — logs/debug-5.log.gz

**rel:** `logs/debug-5.log.gz`  
**kind:** debug_rotate_gz  
**line_count:** 44896  
**read_complete:** true  

## Time span
- First useful timestamp: `01Aug2026 19:25:52.960`
- Last useful timestamp: `01Aug2026 20:43:06.120`
- **Paired INFO rotate:** `logs/2026-08-01-5.log.gz` (OPAC listener crash + watchdog follow-up)

## Session phases
- Boot: After FB-01 (19:24 command crash — not in this file). DEBUG boot NeoForge 21.1.248. `Done (3.812s)!` L21045 / 19:26:12.
- Runtime: Busy evening; 83 joins / 62 leaves; 207× cant-keep-up; SDLink webhook 429 storm; server-full disconnects; OPAC party invite/join; Jade InvWrapper NPE; KubeJS vots.js errors.
- Stop / crash / restart: **FB-02 then FB-03.** `NoSuchMethodError` `getPlayerConfigs()` via `PartyChatListener` / `PartyMessenger` (L38397 / L38421) → crash `crash-2026-08-01_20.42.00-server.txt` (L39889–39890) → Stopping server L39891. Watchdog FATAL 20:43:05 (L40275+) → `crash-2026-08-01_20.43.06-server.txt` (L44893–44894). Huge inline thread dump.

## Notable events
- Same causal chain as INFO twin: party chat after invite → opac_better_commands API mismatch → tick death → watchdog ~63 s later.
- DEBUG “watchdog” ~1474 keyword hits mostly mixin TRACE + dump text; real hang is the 20:43:05 FATAL cluster only.
- db_addon-like ~5899 hits dominated by LuckPerms MariaDB DEBUG, not 5899 GriefLogger fails (actual fail still 2 ERROR lines at boot).
- SDLink 429 (~155) still visible at DEBUG.

## Player / ops impact
- Hurt vs quiet: Hard outage; full kick 20:42; forced shutdown 20:43.

## Noise vs hurt
- Dominant spam: mixin DEBUG (file ~3.2× INFO twin), recipe/loot/DISTXFORM, MariaDB DEBUG, handleDisconnection×2, vehicle WARNs, cant-keep-up 207×, SDLink 429.
- Real incidents: **FB-02** OPAC listener NSM; **FB-03** watchdog follow-up; lag; Jade NPE; webhook rate limit.

## Surprises / script-blind candidates
- Largest DEBUG rotate in batch — spam summarization mandatory after traversal.
- Incident dedupe vs `2026-08-01-5.log.gz` essential for census vs AI counts.
- FB-01 not in this file but is the reason this session exists (reboot at 19:25).

## WT relevance / Prior pass
- Related: **FB-02**, **FB-03**; links prior **FB-01**; noise FB-07/08/10/11.
- Ingestion: seen
