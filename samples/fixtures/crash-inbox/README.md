# Crash inbox golden fixtures (1.0.14)

Synthetic `crash_summaries` for **G-12 fingerprint grouping** and inbox polish. Used by `CrashFingerprintGrouperTest` — not live server data.

## Fingerprint contract

```text
{failure_kind}|{stall_or_primary_or_-}|{exception_class_or_-}|{top_transformer_mods_csv}
```

| Part | Rule |
| ---- | ---- |
| `failure_kind` | As stored on the summary (`watchdog`, `watchdog_followup`, `watchdog_pregen`, `mod_runtime`, …) |
| `stall_or_primary` | `stall_mod_id` if set, else `primary_mod_id`, else `-` |
| `exception_class` | Text before `:` on `exception`, or first `*Exception`/`*Error` token, else `-` |
| `top_transformer_mods` | Up to 3 unique `stack_frames[].mod_id`, sorted, comma-joined; else `-` |

Examples: `watchdog|-|java.lang.Error|-`, `watchdog_pregen|squaremap|java.lang.Error|squaremap`, `mod_runtime|create|java.lang.NullPointerException|create`.

## Cap

After grouping, if more than **12** groups, merge the smallest groups that share a `failure_kind` into `{failure_kind}|other|-|-` (label `Other …`) until ≤12. If still **>15**, merge across kinds into `other|other|-|-`.

## Files

| File | Role |
| ---- | ---- |
| `grouped-input.json` | JsonArray of synthetic crash summaries |
| `grouped-expected.json` | Expected `groups[]` shape / key fingerprints after grouping |
