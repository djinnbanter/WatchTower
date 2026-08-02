# Forensic file note — logs/debug-4.log.gz

**rel:** `logs/debug-4.log.gz`  
**kind:** debug_rotate_gz  
**line_count:** 39626  
**read_complete:** true  

## Time span
- First useful timestamp: `01Aug2026 20:43:55.931`
- Last useful timestamp: `01Aug2026 21:50:21.800`
- **Paired INFO rotate:** `logs/2026-08-01-6.log.gz` (Sable crash + watchdog follow-up hour)

## Session phases
- Boot: Post-OPAC/watchdog reboot at DEBUG. `Done (3.895s)!` L21054 / 20:44:15.
- Runtime: Same as `-6` — lag (153× cant-keep-up), Jade NPE, KubeJS vots.js, shtreimel sub-level add + unregistered ship at 21:49:11.
- Stop / crash / restart: **FB-04 then FB-05.** Sable `Body has been removed` during `SubLevelSerializer.serialize` / save (L32941+) → crash `crash-2026-08-01_21.49.17-server.txt` (L34404–34405) → Stopping server L34406. Watchdog FATAL 21:50:21 (L34750+) → `crash-2026-08-01_21.50.21-server.txt` (L39623–39624). Second body-removed during dump (L34496).

## Notable events
- Full stack identical to INFO twin; DEBUG adds mixin TRACE and MariaDB DEBUG around the same failures.
- “watchdog” keyword ~1472 hits: almost all pre-hang mixin/TRACE noise + thread-dump text; only the L34750+ cluster is the real hang (FB-05).
- Confirms Create/Sable/shtreimel precursor lines for Fix advice.

## Player / ops impact
- Hurt vs quiet: Hard outage mid-session; same as `-6`.

## Noise vs hurt
- Dominant spam: mixin DEBUG bulk; recipe/loot/DISTXFORM boot; MariaDB DEBUG (~4891 pattern hits inflated); lag WARNs; cant-keep-up 153×.
- Real incidents: **FB-04** Sable body-removed; **FB-05** watchdog follow-up; tick lag; Jade NPE.

## Surprises / script-blind candidates
- DEBUG thread dump embeds inflate exception keyword counts (second Body has been removed).
- Pairing proof: DEBUG and INFO must be deduped for incident counting or FB fixtures double-count.

## WT relevance / Prior pass
- Related: **FB-04**, **FB-05** (primary evidence twin of `-6`); prior chain **FB-02/FB-03**. Noise FB-07/08/10/11.
- Ingestion: seen
