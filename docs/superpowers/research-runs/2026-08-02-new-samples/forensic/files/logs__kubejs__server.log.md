# Forensic file note — logs/kubejs/server.log

**rel:** `logs/kubejs/server.log`  
**kind:** kubejs  
**line_count:** 1425  
**read_complete:** true  

## Time span
- First useful timestamp: 15:33:09 (Aug 2 boot, matches `latest.log`)
- Last useful timestamp: 15:33:17 (`Server resource reload complete!`)

## Session phases
- Boot: INIT plugins + load 6/6 server scripts (donate, forceclear, playtime, recipies, tos, vots) — 0 errors/warnings in script load
- Runtime: recipe processing flood at 15:33:12, then finish summaries
- Stop / crash / restart: none in this file (resource reload complete only)

## Notable events
- Levels after full traversal: INIT 8, INFO 14, **WARN 1402**, ERROR 0, FATAL 0
- **1402** `KubeRecipe.java#90: Failed to parse recipe ...! Falling back to vanilla` WARNs — all at 15:33:12
- Recipe-id namespace counts: createfood **1285**, createframed 47, create_oxidized 45, create_vibrant_vaults 10, create_compressed 7, create_winery 5, plus singles for createadditionallogistics / bellsandwhistles / pantographsandwires
- Failure shape: Create recipe JSON schema mismatch — missing `id`/`amount` in processing outputs; also unknown `minecraft:fluid_tag` / fluid_stack ingredient types
- Closing INFO: Found 13,430 recipes (skipped 1,992); Added 38 / removed 31 / modified 1 / **0 failed recipes** taking 931 ms — KubeJS still completes modifications despite WARN flood
- First WARN: createfood filling `leather_soup_bowl...`; last WARN before finish: createfood deploying `raw_bacon_calzone...`

## Player / ops impact
- Hurt vs quiet: **Quiet for stability** — boot noise / missing createfood recipes falling back to vanilla; not an Aug 1 crash driver. Possible missing Create food recipes in-game.

## Noise vs hurt
- Dominant spam patterns: createfood Failed-to-parse WARN — first line 19 / 15:33:12, last ~1419 / 15:33:12, volume **~1285 createfood + ~117 other** = 1402 WARNs after full traversal
- Real incidents: none (0 ERROR); schema incompat between createfood (and friends) and Create 6 recipe codec under KubeJS parse path

## Surprises / script-blind candidates
- This sidecar holds the dense recipe flood; `latest.log` mirrors some of it under `[KubeJS Server/]` but WT LogScanner does not open `logs/kubejs/*.log`
- Census regex `Failed to parse recipe` matches these WARNs; ModErrorCategory trigger `Parsing error loading recipe` may **not** — pattern mismatch risk
- Typo script name `recipies.js` present — harmless

## WT relevance / Prior pass
- Related: `signal-kubejs-sidecar` / **FB-09**; overlaps `signal-recipe-flood` / **FB-08**
- Ingestion: unread (sidecar) / partial if same lines appear in latest.log
