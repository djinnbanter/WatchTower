# Join clinic

**A friend can't join** and the admin spends Friday night diffing `mods/` folders by hand. Join clinic watches `latest.log` for Forge/NeoForge/Fabric pack-sync rejections, names the mods involved, and gives you a player-safe Copy fix list.

Watchtower **never** changes `mods/` or the world for you — advice and copy only.

---

## What it detects

On the usual ops log scan (same cadence as activity / silent fails), Watchtower looks for disconnect lines whose reason is pack-related:

| Kind | Typical log language |
|------|----------------------|
| **mismatched_channel** | Incompatible mod set / mismatched channels |
| **missing_mod** | Mod rejection / missing required mods |
| **wrong_version** | Mod mismatch with required vs client version |
| **registry** | Registry incompatibility |
| **unknown_pack** | Other pack/network mismatch wording |

Ordinary timeouts, kicks, whitelist denials, and auth failures are ignored.

Named mod ids come from channel/registry namespaces and rejection lists on the **server log only** (no client-log paste). Confidence is `high` when mod ids were captured, otherwise `medium`/`low`.

---

## Diff labels

Each rejection is compared to the server's running mods (or jar inventory):

| Label | Meaning |
|-------|---------|
| **missing** | Log named a mod the server has — client likely lacks it |
| **wrong_version** | Log named both required and client versions for a mod |
| **extra** | Log named a mod the server does not have |
| **suppressed_client_only** | Would be “extra”, but already scored `likely_removable` / `client_library` — not shown as a false positive |

If jar drift is present on the inventory baseline, the entry may set **vs known-good** so Copy fix mentions pack drift.

---

## Where you see it

- **Session → Session activity** — failed joins appear in the right-column feed with joins and leaves; expand a failed row for named mod chips and **Copy fix**
- **Issues** — open `JOIN_SYNC:…` rows; primary action **Open Session activity**
- **Overview** — attention queue picks up open Issues automatically

Issue ids look like `JOIN_SYNC:mismatched_channel|PlayerName|create,flywheel`.

---

## What to do

1. Open **Session → Session activity** (or the Issue’s **Open Session activity** action).
2. Expand the failed join, hit **Copy fix**, and paste to the player (IPs/tokens are redacted).
3. Have them install/update the listed mods (or remove extras), then retry join.
4. If the pack drifted on the server, confirm the jar baseline before blaming the client.

---

## Kill-switch

| Key | Default | Effect |
|-----|---------|--------|
| `JOIN_CLINIC_ENABLED` | `true` | When false, join rejections are not raised as Issues (scanner/analyzer still follow ops-cache merge when enabled paths run — Issues evaluator respects the flag) |

See [[Configuration]].

---

## Related

- [[Session]] — roster + Session activity plate
- [[Issues]] — `JOIN_SYNC` findings
- [[Mods]] — jar inventory / drift
- [[HTTP-API]] — `ops-cache.join_clinic`
- [[Script Failed Silently]] — similar log → Issue pipeline
