/**
 * Port of BriefWriter (DR subset) — plain-text summary.
 */
export function writeBrief(facts) {
  const lines = [];
  const h = facts.health || {};
  lines.push(`Watchtower DR — ${facts.meta?.generated || 'analysis'}`);
  lines.push(`Status: ${(h.status || 'unknown').toUpperCase()}`);
  lines.push('');

  const summaries = facts.optional?.crash_summaries ?? [];
  if (summaries.length) {
    lines.push('Crashes:');
    for (const c of summaries) {
      lines.push(`  • ${c.time || '?'} — ${c.plain_english || c.summary || c.file}`);
      for (const hint of c.fix_hints || []) {
        lines.push(`    → ${hint}`);
      }
    }
    lines.push('');
  }

  const recs = facts.optional?.mod_recommendations ?? [];
  if (recs.length) {
    lines.push('Mod recommendations:');
    for (const r of recs.slice(0, 6)) {
      lines.push(`  • ${r.mod_id}: ${r.fix}`);
    }
    lines.push('');
  }

  const issues = facts.issues ?? [];
  if (issues.length) {
    lines.push('Issues:');
    for (const i of issues) {
      lines.push(`  [${i.severity}] ${i.id}: ${i.message}`);
    }
  }

  return lines.join('\n');
}
