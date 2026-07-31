# Drop Standing Orders from home Shift Log

**Date:** 2026-07-31  
**Status:** Approved in brainstorm (Approach 1 — surgical cut)  
**Surfaces:** `web/marketing` home Shift Log

## 1. Goal

Remove the Standing Orders beat from the marketing home tour so the page stays feature-first through Insights, then Close CTAs.

Home flow becomes:

Welcome → Live → Issues → Crashes → Overview → Insights → Close

No promises / “not our job” room on `/` in this change. Trust copy is not relocated to How it works, FAQ, Close, or footer yet.

## 2. Why

After the product tour, Standing Orders reads as a policy speech rather than another useful desk stop. Close already carries demo / Modrinth CTAs. Product promises remain true in PRODUCT.md / ROADMAP and in `product.ts` for later use.

## 3. In / out of scope

**In**

- Remove `OrdersEntry` from [`web/marketing/app/page.tsx`](web/marketing/app/page.tsx)
- Remove `orders` from [`web/marketing/content/night.ts`](web/marketing/content/night.ts) (`NightEntryId`, `NIGHT` row)
- Update [`web/marketing/scripts/audit-shift-log.mjs`](web/marketing/scripts/audit-shift-log.mjs) `EXPECTED_RAIL` (drop `orders` / `Standing orders`)
- Update home thesis / comments that name Standing orders (e.g. [`web/marketing/app/layout.tsx`](web/marketing/app/layout.tsx))
- Fix any live-tree references to `orders` as a Shift Log entry id

**Out**

- Deleting [`web/marketing/components/entries/orders.tsx`](web/marketing/components/entries/orders.tsx)
- Deleting or rewriting `PROMISES` / `NOT_OUR_JOB` in `product.ts`
- Deleting archive [`promises.tsx`](web/marketing/components/sections/promises.tsx) / [`boundaries.tsx`](web/marketing/components/sections/boundaries.tsx)
- Adding promises to How it works, FAQ, Close, or footer
- Changing Close / footer CTA copy (unless it literally says Standing orders)

## 4. Keep for later

- `orders.tsx` may sit unused until a trust page reuses it or it is deleted in a cleanup
- `PROMISES` and `NOT_OUR_JOB` stay the source of truth for product claims when relocated

## 5. Verification

- `cd web/marketing && node scripts/audit-shift-log.mjs` passes
- Home scroll: Insights then End of shift / Close; no Standing orders band
- Typecheck / build: no missing `nightById('orders')` on the live home tree
- Grep marketing home path for `Standing orders` / `OrdersEntry` — only unused `orders.tsx` (and archive sections) may remain

## 6. Success criteria

- Seven-beat Shift Log on `/`
- No fluff policy room between Insights and Close
- Product promise strings still in repo, not invented elsewhere
