# 1.1.25 — Mod config editor (Mods → Configs)

**Status:** Approved  
**Date:** 2026-08-02  
**Roadmap:** `docs/dev/roadmap/versions/1.1.19-1.1.29-change-safety-and-recovery.md` §1.1.25

## Product job

Admin+ can safely edit mod config files under server `config/` from **Mods → Configs**, with mandatory backup and undo. Not a generic filesystem editor; not `server.properties` apply (stays Insights → Configs).

## Locked decisions

| Decision | Choice |
|----------|--------|
| Editor | Raw monospace only — no structured TOML forms |
| Roots | `config/` only |
| Secrets | Mask in list/snippets; real bytes in editor; audit = path only |
| Save | Diff → backup → write; mtime conflict → 409; max 512 KiB |
| Undo | Newest backup; keep last 10 per file |
| Kill-switch | `MOD_CONFIG_EDIT_ENABLED` default true; when false, all config-edit routes 403 |

## Architecture

`ModConfigService` (core) → sandboxed list/read/save/undo.  
`DashboardHttpServer` → `/api/mods/configs` (+ undo).  
UI → `configs-tab.tsx` on Mods.

Backup dir: `watchtower/config-backups/<rel-with-__>/<yyyyMMdd-HHmmss>.bak`

## API

| Route | Method | Auth |
|-------|--------|------|
| `/api/mods/configs` | GET list / GET `?path=` read | Any authenticated |
| `/api/mods/configs` | PUT save | Admin+ |
| `/api/mods/configs/undo` | POST | Admin+ |

## Ship when

- Edit → diff → save → undo restores bytes
- Path escape fails
- Viewer cannot save
- Audit has actor + path
- Packaging audit green

## Non-goals

Structured forms; `world/serverconfig/`; `server.properties` write; jar edits; auto-restart; Monaco.
