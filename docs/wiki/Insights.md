# Insights

**Insights** shows patterns over a window — config health, mod churn, and storage trends — not the live second.

---

## When to open it

- You want busy/quiet hours or recurring lag patterns
- Disk runway / RAM sizing questions
- After Overview’s performance or storage teaser

Use [[Live-Charts]] for right-now TPS and tick lag.

---

## What you’ll see

| Nav | Job |
|-----|-----|
| **Overview** (patterns) | Window summary |
| **Schedule** | Busy/quiet timing |
| **Load** | Load patterns |
| **Incidents** | Recurring incident shape |
| **Configs** | Config / JVM health notes |
| **Mod changes** | Pack churn over the window |
| **Storage** | Disk projection and dimension breakdown |

### Patterns vs right now

| Insights | Live |
|----------|------|
| Last days/weeks of behavior | Last minutes/hours of vitals |
| DISK_FILL / RAM sizing in plain language | Instant heap and TPS |

---

## What to do next

1. Pick the window that matches your question
2. Follow storage runway into host disk planning
3. Open [[Configuration]] if Configs flags restart-needed keys
4. Return to [[Issues]] if a pattern becomes an active problem

---

## Related

- [[Live-Charts]]
- [[Dashboard-Overview]]
- [[Configuration]]
- [[Activity]]
