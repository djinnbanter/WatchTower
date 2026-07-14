/**
 * DR viewer panel — reads optional.mod_forensics / config_health from facts JSON only.
 * No jar walk in the browser (1.0.17 parity rule).
 */
export function renderModForensicsPanel(optional) {
  if (!optional) {
    return { html: '<p class="muted">No optional facts.</p>', skipped: true };
  }
  const mf = optional.mod_forensics || {};
  const health = optional.config_health || [];
  const corrupt = mf.corrupt_jars || [];
  const scan = mf.scan_config || {};
  if (scan.mod_forensics_scan === false) {
    return {
      html: '<p class="muted">Mod forensics skipped (MOD_FORENSICS_SCAN=false).</p>',
      skipped: true,
    };
  }
  const lines = [];
  lines.push(`<h3>Mod forensics</h3>`);
  lines.push(`<p>Index: <code>${mf.class_index_status || 'n/a'}</code>`
    + (mf.class_index_built_at ? ` · built ${mf.class_index_built_at}` : '')
    + `</p>`);
  lines.push(`<p>Corrupt jars: <strong>${corrupt.length}</strong></p>`);
  if (corrupt.length) {
    lines.push('<ul>');
    for (const c of corrupt.slice(0, 12)) {
      lines.push(`<li><code>${escapeHtml(c.path || '?')}</code> · ${escapeHtml(c.reason || '')}</li>`);
    }
    lines.push('</ul>');
  }
  lines.push(`<p>Config health issues: <strong>${health.length}</strong></p>`);
  if (health.length) {
    lines.push('<ul>');
    for (const c of health.slice(0, 12)) {
      lines.push(`<li><code>${escapeHtml(c.path || '?')}</code> · ${escapeHtml(c.reason || '')}</li>`);
    }
    lines.push('</ul>');
  }
  const stderr = mf.stderr_sources || [];
  if (stderr.length) {
    lines.push(`<p>Stderr sources: ${stderr.map(escapeHtml).join(', ')}</p>`);
  }
  lines.push('<p class="muted">Owning-jar lookup is server-side (find-class). JDK jdeps is offline-only — not run in this viewer.</p>');
  return { html: lines.join('\n'), skipped: false };
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
