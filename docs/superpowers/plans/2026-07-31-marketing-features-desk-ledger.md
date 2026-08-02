# Features desk ledger Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild Features capability catalog as one Night Watch Desk ledger (numbered hairline rows in a single InstrumentPlate).

**Architecture:** `CapabilityCatalog` wraps lead + standard `CapabilityRow` lists inside one plate; page drops card grid / marks / tones.

**Tech Stack:** Next.js App Router, React, InstrumentPlate, Reveal, DESIGN.md tokens.

## Global Constraints

- Product truth only; no Fabric shipping; no ProductDesk on Features
- Night Watch Desk tokens; no AI-SaaS chrome; no decorative icon rows
- Hyphens only in copy; WatchTower spelling

---

### Task 1: Design note

- [x] Write `docs/superpowers/specs/2026-07-31-marketing-features-desk-ledger-design.md`

### Task 2: Row + catalog components

- [x] Add `capability-row.tsx` and `capability-catalog.tsx`

### Task 3: Page + content cleanup

- [x] Rewire `app/features/page.tsx`; strip `tone` from content; delete tile + marks

### Task 4: Audit + verify

- [x] Update audit guards; verify `/features` builds
