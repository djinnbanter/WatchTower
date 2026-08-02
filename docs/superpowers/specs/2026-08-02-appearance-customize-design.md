# Appearance Customize (Theme + Accent) Design

**Date:** 2026-08-02  
**Status:** Locked for implementation

## Goal

Operators pick **Light / Dark / Black / System** and one of **eight accent presets** from a rail **Customize** popover and Settings → Appearance. Signed-in accounts sync those prefs across devices.

## Locked decisions

| Item | Choice |
|------|--------|
| Themes | `light`, `dark`, `black`, `system` |
| System resolution | `prefers-color-scheme` → light or dark only (never auto-black) |
| Accents | `signal` (default), `amber`, `teal`, `violet`, `rose`, `green`, `coral`, `slate` |
| Status colors | Unchanged (`--wt-ok` / `--wt-warn` / `--wt-danger` / chart channels) |
| Persistence | Per-account `ui_theme` + `ui_accent` on `DashboardAuthRecord` in `dashboard-auth.json` |
| Cache | `localStorage` `wt-theme` + `wt-accent` for instant paint / pre-auth |
| Who can change | Any authenticated role (including viewers); sync when signed in |
| Server-wide theme | Not in `/api/settings` / `watchtower.conf` |
| Custom hex | Out of scope |
| Rail UX | Single Customize button → compact popover (theme + swatches) |
| Settings | Same controls via shared `AppearanceControls` |

## Architecture

1. `PUT /api/accounts/me/appearance` with `{ theme, accent }`
2. Session JSON includes `ui_theme`, `ui_accent`
3. `ThemeProvider` applies `data-theme` (resolved) + `data-accent`, mirrors localStorage, debounces account writes
4. CSS: `[data-theme][data-accent]` overrides `--wt-accent`, `--wt-accent-soft`, `--wt-accent-ink`, `--wt-spotlight`

## Ship-when

- Customize popover: switch Black + teal; primary buttons readable
- System follows OS light/dark
- Reload while signed in restores account prefs
- Settings Appearance mirrors rail
- Fixture preview supports same PUT/session fields
- Packaging audit OK

## Non-goals

Custom color picker, server-default theme for all users, retinting warn/danger/instrument channels.
