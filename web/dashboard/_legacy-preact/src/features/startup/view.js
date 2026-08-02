import { html, useEffect, useState } from '../../lib/preact.js';
import { reports, dataSources, opsCache } from '../../state/stores.js';
import { navigate } from '../../app/router.js';
import { Page, Section, EmptyState, FreshnessBadge, ListRow } from '../../ui/patterns/index.js';
import { Badge, Button, Card } from '../../ui/primitives/index.js';
import { Icon } from '../../ui/icons.js';
import { configAuditGet } from '../../api/endpoints.js';

const DISMISS_KEY = 'wt.configAuditDismissals';

function loadDismissals() {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function saveDismissals(map) {
  try {
    localStorage.setItem(DISMISS_KEY, JSON.stringify(map));
  } catch {
    /* ignore quota */
  }
}

function statusTone(status) {
  const s = (status ?? '').toLowerCase();
  if (s === 'ok' || s === 'healthy') return 'ok';
  if (s === 'failed' || s === 'error') return 'danger';
  if (s === 'warnings' || s === 'warning') return 'warn';
  return 'neutral';
}

function statusWord(status) {
  const s = (status ?? '').toLowerCase();
  if (s === 'ok' || s === 'healthy') return 'Clean boot';
  if (s === 'failed' || s === 'error') return 'Failed';
  if (s === 'warnings' || s === 'warning') return 'Warnings';
  if (s === 'unknown') return 'Incomplete profile';
  return status ? String(status).replace(/_/g, ' ') : 'Unknown';
}

function formatSec(sec) {
  if (sec == null || !Number.isFinite(Number(sec))) return '—';
  const n = Number(sec);
  if (n >= 100) return `${Math.round(n)}s`;
  if (n >= 10) return `${n.toFixed(1)}s`;
  return `${n.toFixed(2)}s`;
}

/** Drop absurd phase durations (e.g. old line-index-as-epoch bug) for display. */
function sanePhaseSec(sec, totalSec) {
  const n = Number(sec);
  if (!Number.isFinite(n) || n < 0) return null;
  const total = Number(totalSec);
  if (Number.isFinite(total) && total > 0 && n > total * 2) return null;
  return n;
}

function formatDoneAt(iso) {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleString();
}

function formatDelta(cmp) {
  if (!cmp || cmp.delta_sec == null) return null;
  const abs = Math.abs(Number(cmp.delta_sec));
  const mag = abs >= 100 ? `${Math.round(abs)}s` : `${abs.toFixed(1)}s`;
  const dir = (cmp.direction ?? '').toLowerCase();
  if (dir === 'faster') return { label: `${mag} faster`, tone: 'ok' };
  if (dir === 'slower') return { label: `${mag} slower`, tone: 'warn' };
  if (dir === 'same') return { label: 'Same as last', tone: 'ok' };
  const signed = Number(cmp.delta_sec);
  if (signed > 0) return { label: `+${mag}`, tone: 'warn' };
  if (signed < 0) return { label: `−${mag}`, tone: 'ok' };
  return { label: mag, tone: 'neutral' };
}

function humanId(id) {
  if (!id) return '—';
  return String(id).replace(/_/g, ' ');
}

function phaseLabel(phases, phaseId) {
  if (!phaseId) return '—';
  const hit = (phases ?? []).find((p) => p.id === phaseId);
  return hit?.label ?? humanId(phaseId);
}

function maxPhaseSec(phases, totalSec) {
  if (!phases?.length) return 0;
  const vals = phases
    .map((p) => sanePhaseSec(p.sec, totalSec))
    .filter((n) => n != null);
  return Math.max(...vals, 0.01);
}

function slowRankMap(slowest) {
  const map = new Map();
  (slowest ?? []).forEach((s, i) => {
    if (s?.phase != null && !map.has(s.phase)) map.set(s.phase, i + 1);
  });
  return map;
}

function verdictTone(verdict) {
  if (verdict === 'fine') return 'ok';
  if (verdict === 'consider_lowering' || verdict === 'consider_raising') return 'warn';
  return 'neutral';
}

function verdictLabel(verdict) {
  switch (verdict) {
    case 'fine': return 'Fine';
    case 'consider_lowering': return 'Consider lowering';
    case 'consider_raising': return 'Consider raising';
    case 'missing': return 'Missing';
    default: return verdict ? String(verdict).replace(/_/g, ' ') : 'Unknown';
  }
}

function ConfigAuditCard({ audit, dismissals, showDismissed, onDismiss, onUndismiss, onToggleDismissed }) {
  if (!audit || audit.status === 'disabled') return null;

  const rows = Array.isArray(audit.properties) ? audit.properties : [];
  const active = rows.filter((r) => !dismissals[r.key]);
  const dismissed = rows.filter((r) => !!dismissals[r.key]);
  const visible = showDismissed ? rows : active;
  const jvm = audit.jvm || null;
  const summary = audit.summary || {};
  const considerCount = summary.consider ?? 0;

  if (audit.status === 'unavailable' && !rows.length) {
    return html`
      <${Section}
        title="Launch & config audit"
        badge=${html`<${Badge} tone="neutral">Read-only</${Badge}>`}
      >
        <${Card} className="startup-audit" tone="neutral" padding="20">
          <div class="startup-audit__banner">
            <${Icon} name="alert-triangle" size=${16} />
            <p>${audit.detail || 'Could not read server.properties'}</p>
          </div>
        </${Card}>
      </${Section}>
    `;
  }

  return html`
    <${Section}
      title="Launch & config audit"
      badge=${html`<${Badge} tone=${considerCount > 0 ? 'warn' : 'ok'}>Read-only advisory</${Badge}>`}
      actions=${dismissed.length ? html`
        <${Button} kind="ghost" size="sm" onClick=${onToggleDismissed}>
          ${showDismissed ? 'Hide dismissed' : `Show dismissed (${dismissed.length})`}
        </${Button}>
      ` : null}
    >
      <${Card} className="startup-audit" tone=${considerCount > 0 ? 'warn' : 'neutral'} padding="20">
        <div class="startup-audit__head">
          <div>
            <div class="startup-audit__eyebrow">server.properties</div>
            <p class="startup-audit__lede">
              Read-only advisory — Watchtower will not change these files.
            </p>
          </div>
          <div class="startup-audit__counts" aria-label="Audit summary">
            <span class="startup-audit__count">
              <strong>${summary.fine ?? 0}</strong> fine
            </span>
            <span class="startup-audit__count startup-audit__count--consider">
              <strong>${considerCount}</strong> consider
            </span>
          </div>
        </div>

        ${visible.length ? html`
          <div class="startup-audit__list">
            ${visible.map((row, i) => {
              const isDismissed = !!dismissals[row.key];
              const tone = verdictTone(row.verdict);
              return html`
                <${ListRow}
                  key=${row.key}
                  className=${isDismissed ? 'startup-audit__row startup-audit__row--dismissed' : 'startup-audit__row'}
                  staggerIndex=${i}
                  tone=${tone}
                  icon=${html`<${Icon} name="settings" size=${14} />`}
                  title=${`${row.title || row.key}${row.value != null ? ` · ${row.value}` : ''}`}
                  meta=${row.detail}
                  badge=${html`<${Badge} tone=${tone}>${verdictLabel(row.verdict)}</${Badge}>`}
                  actions=${html`
                    <${Button}
                      kind="neutral"
                      size="sm"
                      onClick=${(e) => {
                        e?.stopPropagation?.();
                        if (isDismissed) onUndismiss(row.key);
                        else onDismiss(row.key);
                      }}
                    >${isDismissed ? 'Restore' : 'Dismiss'}</${Button}>
                  `}
                />
              `;
            })}
          </div>
        ` : html`
          <div class="startup-empty startup-empty--ok">
            <${Icon} name="check" size=${16} />
            <span>${dismissed.length ? 'All rows dismissed' : 'No settings to review'}</span>
          </div>
        `}

        ${jvm ? html`
          <div class="startup-audit__jvm">
            <div class="startup-audit__jvm-text">
              <div class="startup-audit__jvm-label">JVM launch flags</div>
              <p class="startup-audit__jvm-advice">
                ${jvm.flags_profile ? html`<code class="startup-audit__profile">${jvm.flags_profile}</code>` : null}
                ${jvm.flags_profile ? ' · ' : ''}
                ${jvm.advice || 'Open Insights → Configs for full flag advice.'}
              </p>
            </div>
            <${Button}
              kind="accent"
              size="sm"
              onClick=${() => navigate('insights', { view: 'configs' })}
            >Open Insights → Configs</${Button}>
          </div>
        ` : null}
      </${Card}>
    </${Section}>
  `;
}

function useConfigAudit() {
  const factsAudit = reports.value?.facts?.optional?.config_launch_audit ?? null;
  const [audit, setAudit] = useState(factsAudit);
  const [dismissals, setDismissals] = useState(loadDismissals);
  const [showDismissed, setShowDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await configAuditGet();
        if (!cancelled && data) setAudit(data);
      } catch {
        if (!cancelled && factsAudit) setAudit(factsAudit);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!audit && factsAudit) setAudit(factsAudit);
  }, [factsAudit]);

  const onDismiss = (key) => {
    setDismissals((prev) => {
      const next = { ...prev, [key]: true };
      saveDismissals(next);
      return next;
    });
  };
  const onUndismiss = (key) => {
    setDismissals((prev) => {
      const next = { ...prev };
      delete next[key];
      saveDismissals(next);
      return next;
    });
  };

  return {
    audit,
    dismissals,
    showDismissed,
    onDismiss,
    onUndismiss,
    onToggleDismissed: () => setShowDismissed((v) => !v),
  };
}

export function PageView() {
  const facts = reports.value?.facts;
  const factsProfile = facts?.optional?.startup_profile ?? null;
  const opsProfile = opsCache.value?.data?.startup_profile ?? null;
  const profile = factsProfile ?? opsProfile ?? null;
  const profileFromOps = !factsProfile && !!opsProfile;
  const freshnessLayer = profileFromOps ? 'scan' : 'report';
  const freshnessAt = profileFromOps
    ? (dataSources.value?.scanAt ?? opsCache.value?.at ?? null)
    : (dataSources.value?.reportAt ?? null);
  const auditState = useConfigAudit();

  if (!profile) {
    return html`
      <${Page}
      title="Startup"
      subtitle="Last boot timeline and warnings"
      actions=${html`<${FreshnessBadge} layer=${freshnessLayer} at=${freshnessAt} />`}
    >
        <div class="ui-page__stack" data-view="startup">
          <${EmptyState}
            title="No boot profile yet"
            body="Waiting for a boot profile — after the server reaches Done!, Watchtower captures phases automatically via Scanning."
            action=${html`
              <${Button} kind="accent" size="sm" onClick=${() => navigate('overview')}>
                Back to Overview
              </${Button}>
            `}
          />
          <${ConfigAuditCard} ...${auditState} />
        </div>
      </${Page}>
    `;
  }

  const {
    total_sec,
    status,
    phases = [],
    slowest = [],
    warnings = [],
    errors = [],
    compare_to_last_boot,
    done_at,
  } = profile;

  const phaseMax = maxPhaseSec(phases, total_sec);
  const tone = statusTone(status);
  const delta = formatDelta(compare_to_last_boot);
  const ranks = slowRankMap(slowest);
  const blocking = errors.filter((e) => e.blocking).length;
  const doneLabel = formatDoneAt(done_at);
  const slowestSec = slowest[0] ? sanePhaseSec(slowest[0].sec, total_sec) : null;
  const slowestLabel = slowest[0] && slowestSec != null
    ? `${phaseLabel(phases, slowest[0].phase)} · ${formatSec(slowestSec)}`
    : null;

  return html`
    <${Page}
      title="Startup"
      subtitle="Last boot timeline and warnings"
      actions=${html`<${FreshnessBadge} layer=${freshnessLayer} at=${freshnessAt} />`}
    >
      <div class="ui-page__stack" data-view="startup">

        <section class=${`startup-hero startup-hero--${tone}`}>
          <div class="startup-hero__main">
            <div class="startup-hero__eyebrow">
              <span class=${`startup-hero__dot startup-hero__dot--${tone}`}></span>
              <span>${statusWord(status)}</span>
              ${doneLabel ? html`<span class="startup-hero__sep">·</span><span>Finished ${doneLabel}</span>` : null}
            </div>
            <div class="startup-hero__time">${formatSec(total_sec)}</div>
            <p class="startup-hero__caption">
              ${slowestLabel
                ? html`Slowest phase: <strong>${slowestLabel}</strong>`
                : 'Boot timeline from the latest health report'}
            </p>
          </div>
          <div class="startup-hero__stats">
            <div class="startup-hero__stat">
              <span class="startup-hero__stat-label">vs last boot</span>
              <span class=${`startup-hero__stat-value${delta ? ` startup-hero__stat-value--${delta.tone}` : ''}`}>
                ${delta?.label ?? '—'}
              </span>
            </div>
            <div class="startup-hero__stat">
              <span class="startup-hero__stat-label">Warnings</span>
              <span class=${`startup-hero__stat-value${warnings.length ? ' startup-hero__stat-value--warn' : ''}`}>
                ${warnings.length}
              </span>
            </div>
            <div class="startup-hero__stat">
              <span class="startup-hero__stat-label">Errors</span>
              <span class=${`startup-hero__stat-value${errors.length ? ' startup-hero__stat-value--danger' : ''}`}>
                ${errors.length}${blocking ? html`<span class="startup-hero__stat-note">${blocking} blocking</span>` : null}
              </span>
            </div>
            <div class="startup-hero__stat">
              <span class="startup-hero__stat-label">Phases</span>
              <span class="startup-hero__stat-value">${phases.length || '—'}</span>
            </div>
          </div>
        </section>

        <${ConfigAuditCard} ...${auditState} />

        <${Section} title="Boot phases">
          ${phases.length ? html`
            <div class="startup-phases">
              ${phases.map((p) => {
                const sec = sanePhaseSec(p.sec, total_sec);
                const pct = sec != null ? Math.min(100, (sec / phaseMax) * 100) : 0;
                const shareRaw = sec != null && total_sec > 0
                  ? Math.round((sec / Number(total_sec)) * 100)
                  : null;
                const share = shareRaw != null ? Math.max(0, Math.min(100, shareRaw)) : null;
                const rank = ranks.get(p.id);
                const isSlow = rank === 1;
                return html`
                  <div
                    class=${`startup-phase${isSlow ? ' startup-phase--slow' : ''}${rank ? ' startup-phase--ranked' : ''}`}
                    key=${p.id ?? p.label}
                  >
                    <div class="startup-phase__meta">
                      <div class="startup-phase__title">
                        ${rank ? html`<span class="startup-phase__rank" title=${`#${rank} slowest`}>${rank}</span>` : null}
                        <span class="startup-phase__label">${p.label ?? humanId(p.id)}</span>
                      </div>
                      <div class="startup-phase__nums">
                        ${share != null ? html`<span class="startup-phase__share">${share}%</span>` : null}
                        <span class="startup-phase__sec">${formatSec(sec)}</span>
                      </div>
                    </div>
                    <div class="startup-phase__bar" aria-hidden="true">
                      <span style=${{ width: `${pct}%` }}></span>
                    </div>
                  </div>
                `;
              })}
            </div>
          ` : html`
            <${EmptyState} title="No phases" body="Boot phase markers were not found in the log for this report." />
          `}
        </${Section}>

        <div class="startup-split">
          <${Section}
            title="Warnings"
            badge=${warnings.length ? html`<${Badge} tone="warn">${warnings.length}</${Badge}>` : html`<${Badge} tone="ok">0</${Badge}>`}
          >
            ${warnings.length ? html`
              <div class="startup-list">
                ${warnings.map((w) => html`
                  <div class="startup-chip startup-chip--warn" key=${w.id}>
                    <${Icon} name="alert-triangle" size=${14} />
                    <span class="startup-chip__title">${humanId(w.id)}</span>
                    <span class="startup-chip__meta">${w.count ?? 0}×</span>
                  </div>
                `)}
              </div>
            ` : html`
              <div class="startup-empty startup-empty--ok">
                <${Icon} name="check" size=${16} />
                <span>No startup warnings</span>
              </div>
            `}
          </${Section}>

          <${Section}
            title="Errors"
            badge=${errors.length
              ? html`<${Badge} tone="danger">${errors.length}</${Badge}>`
              : html`<${Badge} tone="ok">0</${Badge}>`}
          >
            ${errors.length ? html`
              <div class="startup-list">
                ${errors.map((err, i) => html`
                  <${Card}
                    key=${`${err.mod_id ?? 'mod'}-${i}`}
                    className=${`startup-error${err.blocking ? ' startup-error--blocking' : ''}`}
                    padding="12"
                    tone=${err.blocking ? 'danger' : 'warn'}
                  >
                    <div class="startup-error__head">
                      <div class="startup-error__id">
                        <${Icon} name="alert-triangle" size=${14} />
                        <strong>${err.mod_id ?? 'unknown mod'}</strong>
                      </div>
                      <${Badge} tone=${err.blocking ? 'danger' : 'warn'}>
                        ${err.blocking ? 'blocking' : 'non-blocking'}
                      </${Badge}>
                    </div>
                    ${err.kind ? html`
                      <p class="startup-error__kind">${humanId(err.kind)}</p>
                    ` : null}
                    ${err.mod_id ? html`
                      <div class="startup-error__actions">
                        <${Button}
                          kind="neutral"
                          size="sm"
                          onClick=${() => navigate('mods', { view: 'overview', mod: err.mod_id })}
                        >Open Mods</${Button}>
                      </div>
                    ` : null}
                  </${Card}>
                `)}
              </div>
            ` : html`
              <div class="startup-empty startup-empty--ok">
                <${Icon} name="check" size=${16} />
                <span>No startup errors</span>
              </div>
            `}
          </${Section}>
        </div>

      </div>
    </${Page}>
  `;
}
