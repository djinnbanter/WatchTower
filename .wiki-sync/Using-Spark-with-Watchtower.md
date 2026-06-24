# Using Spark with Watchtower

Spark is a mod that records **what is using server time** when lag happens. Watchtower reads Spark’s saved profile and turns it into plain advice on the **Spark** tab — which mods and code paths are slowing ticks down.

---

## What you need

- [Spark](https://modrinth.com/mod/spark) installed on the server
- Watchtower **1.0.0**
- A saved `.sparkprofile` file (see below)

---

## Quick workflow (Spark tab)

1. **Capture while lagging:** `/spark profiler start` → wait **30–60 seconds** → `/spark profiler stop --save-to-file`
2. **Open the Spark tab** and use the **profile dropdown** to pick the file you want (click **Refresh** if you just saved a new one)
3. **Read the breakdown** — use the sub-tabs (**Summary**, **Mods & code**, **World**, **Capture window**, **Advanced**) to explore the profile; your last tab choice is remembered per browser

You do **not** need to run a full Watchtower report to view profiles on the Spark tab. A full report is **optional** — it only adds a Spark summary to **Overview** and `brief.txt`.

---

## Capture a profile while the server is lagging

1. `/spark profiler start`
2. Wait **30–60 seconds** while lag is happening
3. `/spark profiler stop --save-to-file`

Spark saves a file like `config/spark/profile-2026-06-23_14.30.00.sparkprofile`.

**Optional:** copy the file to `<server>/watchtower/spark-upload/` so it appears first in the dropdown.

---

## Pick a profile

On the **Spark** tab:

- Use the **Profile** dropdown in the header to switch between saved `.sparkprofile` files on disk (newest first)
- Click **Refresh** to rescan `watchtower/spark-upload/` and `config/spark/`
- Your last selection is remembered per server

Watchtower lists up to **25** profiles. The newest capture time wins when sorting.

---

## Run a health report (optional)

To surface Spark on **Overview** and in `brief.txt`, run a **full health report**:

- Click **Run report** on the Spark tab or Overview, or
- `/watchtower run`, or
- Wait for a scheduled report

The report embeds the **newest** profile on disk at report time. The Spark tab dropdown can still show any older file on disk.

---

## Read the Spark tab

Open **Spark** in the sidebar (under Fix problems). After you pick a profile, five sub-tabs organize the report:

| Sub-tab | What it shows |
| -------- | ----------------- |
| **Summary** | Verdict, KPIs (TPS, MSPT, players, entities), key findings, recommended actions |
| **Mods & code** | Mod tick usage, mod signals, hot methods |
| **World** | Top entities, entity hotspots, dimension breakdown |
| **Capture window** | Timeline and host CPU/RAM/disk during the capture |
| **Advanced** | Performance chart, full method table, JVM heap, server config, capture metadata |

The **How to use Spark** workflow panel stays at the top (collapses after first profile load).

| Other UI | What it tells you |
| -------- | ----------------- |
| **Profile dropdown** | Switch between saved `.sparkprofile` files on disk |
| **Refresh** | Rescan `watchtower/spark-upload/` and `config/spark/` |

Profiles from the last **24 hours** are highlighted as fresh on Overview. Older profiles still show with a note to capture a new one.

---

## Technical details

### Search paths

Watchtower checks `watchtower/spark-upload/` first, then `config/spark/profile-*.sparkprofile`.

### API (dashboard)

| Endpoint | Purpose |
| -------- | ------- |
| `GET /api/spark/profiles` | List profiles on disk |
| `GET /api/spark/profile?path=…` | Parse one profile on demand |

### Configuration (`watchtower.conf`)

| Key | Default | Purpose |
| ----- | ------- | ------- |
| `SPARK_ENABLED` | `true` | Turn Spark ingest on/off |
| `SPARK_FRESH_HOURS` | `24` | “Fresh” window for brief / Overview |
| `SPARK_UPLOAD_DIR` | *(empty)* | Custom upload folder |

### Limits

- Does not download from spark.lucko.me automatically — file must be on disk
- Does not replace Spark’s interactive flame graph — use **Open in Spark viewer** for the full tree

### Maintainer tooling

```bash
./gradlew :watchtower-core:sparkAuditFixtures
node web/dashboard/scripts/generate-spark-mocks.mjs
```

---

## Related

- [[Roadmap]] — Spark integration history
- [[Understanding-Data-Sources]] — report-time vs live data
