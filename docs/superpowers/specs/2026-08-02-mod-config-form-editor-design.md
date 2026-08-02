# TOML form config editor (Mods → Configs)

**Status:** Approved  
**Date:** 2026-08-02  
**Extends:** [`2026-08-02-mod-config-editor-design.md`](2026-08-02-mod-config-editor-design.md) (sandbox, backup, undo, kill-switch)  
**Roadmap:** `docs/dev/roadmap/versions/1.1.19-1.1.29-change-safety-and-recovery.md` §1.1.25

## Product job

When a file under `config/` is parseable TOML, Mods → Configs shows a typed form (sections, toggles, numbers, strings, arrays) instead of only a raw textarea. Unparseable or non-TOML files stay raw. Saves still backup and undo; form saves clean-rewrite TOML (comments may change).

## Locked decisions

| Decision | Choice |
|----------|--------|
| Form offer | Only `.toml` with successful TomlJ parse |
| Fallback | Whole-file raw when parse fails or structure unsupported |
| Formats in v1 | TOML forms only; JSON/YAML/properties/cfg stay raw |
| Rewrite | Clean serialize from field tree (not comment-preserving) |
| Schemas | Schema-from-file — no per-mod hand schemas |
| Toggle | Form \| Raw when form available; Form→Raw regenerates preview text from fields |
| Save | Diff of final text → backup → write; form PUT sends `fields`; raw PUT sends `content` |
| Library | `org.tomlj:tomlj:1.1.1`, shaded into `watchtower-core` like SnakeYAML |

## Architecture

`TomlFormModel` (parse → Gson field tree; hand serialize) → `ModConfigService.read` / `saveFields` → HTTP → Configs tab.

Field JSON:

```json
{
  "kind": "bool|integer|number|string|array|table",
  "key": "bulkPressing",
  "path": "recipes.bulkPressing",
  "section": "recipes",
  "value": false,
  "hint": "Default: false",
  "children": []
}
```

## API deltas

- `GET ?path=` → `editor: form|raw`, optional `fields`, always `content`
- `PUT` → `{ path, expected_mtime, content }` **or** `{ path, expected_mtime, fields }`

## Ship when

- Nested Create-style TOML: form edit → diff → save → valid TOML; undo restores prior bytes
- Bad/non-TOML → raw only
- Form|Raw preserves in-progress edits
- Viewer cannot save; packaging audit green

## Non-goals

JSON/YAML forms; comment-preserving rewrite; per-mod schemas; `world/serverconfig/`; Monaco; auto-restart
