# Crash Rule Packs

Optional YAML matchers for pack-specific crash patterns. Built-in Java classifiers always run first; YAML packs run after and record hits. Most owners never need a custom pack — start on [[Crashes]].

Operators who maintain a modpack can drop packs under `config/watchtower/rules/` so Fix hints match your pack’s known failure modes.

## Where packs live

| Source | Path |
|--------|------|
| Builtin (JAR) | `builtin-rules/*.yaml` inside Watchtower |
| Operator | `config/watchtower/rules/*.yaml` on the server |

Conf flags (in `watchtower/watchtower.conf`):

```ini
CRASH_RULE_PACKS=true
CRASH_RULE_BUILTIN=true
ISSUE_SUPPRESSIONS=CLIENT_ON_SERVER
ISSUE_SUPPRESSION_REGEX=
```

Bad packs are skipped with a warning — the server still boots.

## Limits

- Regex ≤ 500 characters
- ≤ 64 rules per pack
- ≤ 10 packs loaded
- **No** `exec`, JEXL, HTTP, shell, or file-write predicates

## Minimal example

```yaml
schema_version: 1
pack: { id: my-pack, name: "My pack", priority: 100 }

rules:
  - id: kubejs-startup-syntax
    priority: 180
    when:
      all:
        - { source: log_excerpt, log_type: latest, regex: "KubeJS startup script syntax errors" }
        - { mod_present: kubejs }
    emit:
      failure_kind: mod_load_script
      primary_mod_id: kubejs
      fix_hints: ["Fix kubejs/server_scripts syntax"]
```

## Predicate vocabulary (v1)

| Key | Meaning |
| --- | ------- |
| `source` | `crash_report` \| `log_excerpt` \| `stack` \| `fml_issue` \| `description` |
| `regex` | Java regex |
| `mod_present` / `mod_absent` | Mod list check |
| `all` / `any` | Composites |
| `log_type` | For `log_excerpt`: `latest` \| `stderr` \| `pre_crash` |
| `field` | For `fml_issue`: `mod_id` \| `message` \| `file` |

## Emit merge policy

- Every match is recorded in `crash_rule_hits[]`
- `failure_kind` / `primary_mod_id` apply only when Java kind is `unknown`, or when `emit.override: true` and the rule priority wins
- `fix_hints` append (dedupe) unless `override: true`

## Validate before deploy

```bash
java -jar watchtower-cli.jar rules validate config/watchtower/rules/my-pack.yaml
java -jar watchtower-cli.jar rules list --server /path/to/server
```

Dashboard: crash rule packs are still configured via `watchtower.conf` and files under `config/watchtower/rules/` (Settings → Alerts is disk/retention only in the current dashboard).

## Issue suppressions

Hide noisy Issues inbox ids without touching Crashes:

```ini
ISSUE_SUPPRESSIONS=CLIENT_ON_SERVER,LOOT_PARSE_SPAM
```

Or use **Suppress** on an Issues card (stored in `.watchtower-state.json`). Suppressed items appear under **Hidden** and can be restored with **Unsuppress**. Suppressions never change crash Fix headlines.
