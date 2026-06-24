/**
 * Regenerates static preview fixtures with timestamps relative to now.
 * Run: npm run generate:mock
 */
import { mkdirSync, readFileSync, writeFileSync, copyFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  MOCK_CLIENT_ONLY_MODS,
  MOCK_CLIENT_ONLY_SUMMARY,
  MOCK_MOD_RECOMMENDATIONS,
  MOCK_RUNNING_MODS,
  mockModIssues,
  mockModLogErrors,
  mockModsInventoryDiff,
  mockModsInventoryTldr,
  mockReportMods,
} from './mock-mods-catalog.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = join(root, 'data');
const previewProfile = (process.env.PREVIEW_PROFILE || '').trim().toLowerCase();
const isFreshPreview = previewProfile === 'fresh';

function isoAt(ms) {
  return new Date(ms).toISOString();
}

function wave(t, base, amp, period = 1) {
  return base + amp * Math.sin((t / period) * Math.PI * 2);
}

function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

function round1(v) {
  return Math.round(v * 10) / 10;
}

function round2(v) {
  return Math.round(v * 100) / 100;
}

/** 0=Sun … 6=Sat — realistic player curve for heatmap preview */
function mockHeatmapPlayers(dow, hour) {
  const weekend = dow === 0 || dow === 6;
  const friday = dow === 5;

  if (hour >= 5 && hour <= 8) return 0.2 + (hour - 5) * 0.15;
  if (hour >= 9 && hour <= 11) return weekend ? 1.6 + hour * 0.2 : 0.35 + (hour - 9) * 0.3;

  if (weekend) {
    if (hour >= 12 && hour <= 16) return 3.2 + (hour - 12) * 1.15 + (dow === 6 ? 1.4 : 0.6);
    if (hour >= 17 && hour <= 22) {
      if (hour === 20) return dow === 6 ? 10.2 : 8.8;
      if (hour === 21) return dow === 6 ? 9.4 : 7.6;
      if (hour === 19 || hour === 22) return dow === 6 ? 7.2 : 5.8;
      return dow === 6 ? 5.5 : 4.2;
    }
    if (hour >= 23 || hour <= 4) return hour <= 4 ? 3.8 - hour * 0.45 : 3.4;
    return 1.4;
  }

  if (hour >= 17 && hour <= 22) {
    const base = friday ? 5.5 : 4;
    const peak = hour === 20 ? 3.2 : hour === 21 ? 2.6 : hour === 19 ? 1.6 : hour === 18 ? 0.9 : 0.5;
    return base + peak + (friday && hour >= 21 ? 0.8 : 0);
  }
  if (hour >= 12 && hour <= 14) return 1 + (hour === 13 ? 1.1 : 0);
  if (hour >= 23 || hour <= 4) return friday ? 2.8 - Math.min(hour, 4 - hour) * 0.25 : 1.4 - hour * 0.1;
  if (hour >= 13 && hour <= 16) return 0.55 + (hour - 13) * 0.18;
  return 0.2 + (hour % 3) * 0.08;
}

function mockHeatmapCell(dow, hour) {
  const avg_players = round1(clamp(mockHeatmapPlayers(dow, hour), 0, 12));
  const avg_mspt = round1(
    avg_players < 0.8 ? 5.4 + (hour % 5) * 0.25 : 7 + avg_players * 2.1 + (avg_players > 7 ? 4 : 0),
  );
  const avg_tps = round2(
    avg_players < 0.8 ? 19.92 - (hour % 4) * 0.04 : clamp(20 - avg_players * 0.27, 16.4, 19.95),
  );
  const low_tps_minutes = avg_players >= 7 ? 3 : avg_players >= 4 ? 2 : avg_players >= 2 ? 1 : 0;
  return {
    dow,
    hour_utc: hour,
    sample_minutes: 84,
    avg_players,
    avg_mspt,
    avg_tps,
    low_tps_minutes,
  };
}

function buildMockHourOfWeek(sampleMinutes = 84) {
  const cells = [];
  for (let dow = 0; dow < 7; dow += 1) {
    for (let h = 0; h < 24; h += 1) {
      cells.push({ ...mockHeatmapCell(dow, h), sample_minutes: sampleMinutes });
    }
  }
  return cells;
}

function hourLabelUtc(hour) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${pad(hour)}:00–${pad((hour + 1) % 24)}:00 UTC`;
}

function deriveBusyQuietFromHeat(cells) {
  const byHour = Array.from({ length: 24 }, () => ({ players: 0, mspt: 0, mins: 0 }));
  for (const c of cells) {
    const b = byHour[c.hour_utc];
    b.mins += c.sample_minutes;
    b.players += c.avg_players * c.sample_minutes;
    b.mspt += c.avg_mspt * c.sample_minutes;
  }
  const hours = byHour.map((b, hour_utc) => ({
    hour_utc,
    label: hourLabelUtc(hour_utc),
    avg_players: b.mins ? round1(b.players / b.mins) : 0,
    avg_mspt: b.mins ? round1(b.mspt / b.mins) : 0,
    sample_minutes: b.mins,
  })).filter((h) => h.sample_minutes > 0);

  const busy_hours = [...hours].sort((a, b) => b.avg_players - a.avg_players).slice(0, 3)
    .map((h) => ({ ...h, busy: true }));
  const quiet_hours = [...hours].sort((a, b) => a.avg_players - b.avg_players).slice(0, 3)
    .map((h) => ({ ...h, busy: false }));
  return { busy_hours, quiet_hours };
}

function busyHoursInsightDetail(busyHours) {
  return busyHours.map((h) => `${h.label.replace(' UTC', '')} (avg ${h.avg_players} players)`).join('; ');
}

function generateSeries(now, {
  count = 120,
  stepMs = 30_000,
  base,
  spread,
  min,
  max,
  period = 12,
}) {
  const out = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const t = now - i * stepMs;
    const wobble = (Math.random() - 0.5) * spread * 0.35;
    const v = clamp(wave(i, base, spread, period) + wobble, min, max);
    out.push({ t: isoAt(t), v: Math.round(v * 100) / 100 });
  }
  return out;
}

function generateLiveSamples(now) {
  const count = 120;
  const stepMs = 30_000;
  return {
    tps: generateSeries(now, { count, stepMs, base: 19.7, spread: 0.35, min: 17.5, max: 20, period: 18 }),
    mspt: generateSeries(now, { count, stepMs, base: 6.5, spread: 4, min: 2, max: 38, period: 9 }),
    host_cpu: generateSeries(now, { count, stepMs, base: 44, spread: 18, min: 12, max: 88, period: 14 }),
    heap_mb: generateSeries(now, { count, stepMs, base: 5800, spread: 900, min: 4200, max: 7200, period: 20 }),
    mem_available_gb: generateSeries(now, { count, stepMs, base: 12.8, spread: 2.2, min: 8, max: 18, period: 24 }),
    disk_use_pct: generateSeries(now, { count, stepMs, base: 42, spread: 3, min: 38, max: 48, period: 40 }),
    players: generateSeries(now, { count, stepMs, base: 2.2, spread: 1.5, min: 0, max: 6, period: 8 }).map((p) => ({
      t: p.t,
      v: Math.round(p.v),
    })),
  };
}

function generateDiskIoHistory(now, count = 60, stepMs = 30_000) {
  const out = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const t = now - i * stepMs;
    out.push({
      t: isoAt(t),
      read: Math.round(clamp(wave(i, 28, 18, 11) + (Math.random() - 0.5) * 8, 0.5, 420) * 10) / 10,
      write: Math.round(clamp(wave(i, 12, 9, 8) + (Math.random() - 0.5) * 5, 0.2, 160) * 10) / 10,
    });
  }
  return out;
}

function generatePerformanceRollups(now, { hours = 24, stepSec = 60 } = {}) {
  const rowCount = Math.floor((hours * 3600) / stepSec);
  const rows = [];
  let lowTpsMinutes = 0;
  let tpsSum = 0;
  let msptSum = 0;
  const tpsMins = [];
  const msptP95s = [];
  let playersMax = 0;

  for (let i = rowCount - 1; i >= 0; i -= 1) {
    const t = now - i * stepSec * 1000;
    const d = new Date(t);
    const dow = d.getUTCDay();
    const hour = d.getUTCHours();
    const playerBase = mockHeatmapPlayers(dow, hour);
    const players = Math.round(clamp(playerBase + (Math.random() - 0.5) * 1.4, 0, 12));
    const busy = players >= 3;
    const tpsBase = busy ? 18.2 : 19.6;
    const tps = clamp(tpsBase + (Math.random() - 0.5) * 0.8, 14, 20);
    const mspt = clamp((busy ? 12 : 6) + (Math.random() - 0.5) * 8 + players * 1.2, 2, 55);
    const lowTps = tps < 19.5;
    if (lowTps) lowTpsMinutes += 1;
    tpsSum += tps;
    msptSum += mspt;
    tpsMins.push(tps);
    msptP95s.push(mspt);
    playersMax = Math.max(playersMax, players);
    rows.push({
      ts: isoAt(t),
      tps_avg: Math.round(tps * 100) / 100,
      tps_min: Math.round((tps - 0.3) * 100) / 100,
      mspt_avg: Math.round(mspt * 10) / 10,
      mspt_p95: Math.round((mspt + 4) * 10) / 10,
      mspt_jitter_max: Math.round((2 + Math.random() * 6) * 10) / 10,
      players_max: players,
      heap_used_gb_avg: Math.round((5.6 + Math.random() * 0.4) * 100) / 100,
      mem_used_gb_avg: Math.round((12 + Math.random() * 2) * 100) / 100,
      cpu_pct_avg: Math.round(clamp(busy ? 62 : 38, 10, 92) * 10) / 10,
      low_tps_flag: lowTps,
    });
  }

  return {
    enabled: true,
    hours,
    summary: {
      sample_minutes: rows.length,
      tps_avg: Math.round((tpsSum / rows.length) * 100) / 100,
      tps_min: Math.round(Math.min(...tpsMins) * 100) / 100,
      mspt_avg: Math.round((msptSum / rows.length) * 10) / 10,
      mspt_p95: Math.round(Math.max(...msptP95s) * 10) / 10,
      low_tps_minutes: lowTpsMinutes,
      players_max: playersMax,
    },
    rows,
  };
}

function generateStickyLagFixture(now) {
  const rows = [];
  const start = now - 3 * 3600_000;
  for (let i = 0; i < 180; i += 1) {
    const t = start + i * 60_000;
    const players = i < 30 ? 3 : 0;
    const mspt = i < 30 ? 14 : 68;
    rows.push({
      ts: isoAt(t),
      tps_avg: players > 0 ? 18.5 : 19.2,
      tps_min: 17.8,
      mspt_avg: mspt,
      mspt_p95: mspt + 5,
      mspt_jitter_max: 4,
      players_max: players,
      heap_used_gb_avg: 5.8,
      mem_used_gb_avg: 13.2,
      cpu_pct_avg: 42,
      low_tps_flag: false,
    });
  }
  return {
    fixture: 'l1-sticky-lag',
    schema: 1,
    interval_sec: 60,
    retention_days: 90,
    rows,
  };
}

function mockPerfWindowConfig(window = '7d') {
  const is30d = window === '30d';
  return {
    window,
    hours: is30d ? 720 : 168,
    days: is30d ? 30 : 7,
    heatSampleMinutes: is30d ? 360 : 84,
    scale: is30d ? 4.3 : 1,
  };
}

function generateMockPlayerBins(window = '7d') {
  const scale = mockPerfWindowConfig(window).scale;
  const s = (n) => Math.round(n * scale);
  return [
    { players_band: '0', minutes: s(420), mspt_avg: 8.4, tps_avg: 19.7 },
    { players_band: '1-2', minutes: s(280), mspt_avg: 14.2, tps_avg: 19.4 },
    { players_band: '3-5', minutes: s(520), mspt_avg: 22.8, tps_avg: 18.6 },
    { players_band: '6+', minutes: s(220), mspt_avg: 31.5, tps_avg: 17.9 },
  ];
}

function generateMockOutliers(now, window = '7d') {
  const outliers = [
    {
      ts: offsetIso(now, -45 * 60_000),
      players_max: 0,
      mspt_avg: 72,
      mem_used_gb_avg: 14.1,
      reason: 'high_mspt_idle',
    },
  ];
  if (window === '30d') {
    outliers.push(
      {
        ts: offsetIso(now, -4 * 86400_000 - 3 * 3600_000),
        players_max: 6,
        mspt_avg: 48,
        mem_used_gb_avg: 13.8,
        reason: 'high_mspt_vs_hour_median',
      },
      {
        ts: offsetIso(now, -11 * 86400_000 - 5 * 3600_000),
        players_max: 0,
        mspt_avg: 58,
        mem_used_gb_avg: 14,
        reason: 'high_mspt_idle',
      },
      {
        ts: offsetIso(now, -17 * 86400_000 - 2 * 3600_000),
        players_max: 4,
        mspt_avg: 52,
        mem_used_gb_avg: 13.5,
        reason: 'high_mspt_vs_hour_median',
      },
      {
        ts: offsetIso(now, -24 * 86400_000 - 6 * 3600_000),
        players_max: 7,
        mspt_avg: 61,
        mem_used_gb_avg: 14.4,
        reason: 'high_mspt_vs_hour_median',
      },
    );
  }
  return outliers;
}

function generateMockStickyLag(now, window = '7d') {
  const episodes = [
    {
      started_at: offsetIso(now, -90 * 60_000),
      ended_at: offsetIso(now, -45 * 60_000),
      duration_min: 45,
      peak_mspt: 72,
      narrative: 'MSPT stayed above threshold for 45 min after players left (peak 72 ms)',
    },
  ];
  if (window === '30d') {
    episodes.push(
      {
        started_at: offsetIso(now, -8 * 86400_000 - 120 * 60_000),
        ended_at: offsetIso(now, -8 * 86400_000 - 98 * 60_000),
        duration_min: 22,
        peak_mspt: 55,
        narrative: 'MSPT stayed above threshold for 22 min after players left (peak 55 ms)',
      },
      {
        started_at: offsetIso(now, -21 * 86400_000 - 180 * 60_000),
        ended_at: offsetIso(now, -21 * 86400_000 - 142 * 60_000),
        duration_min: 38,
        peak_mspt: 64,
        narrative: 'MSPT stayed above threshold for 38 min after players left (peak 64 ms)',
      },
    );
  }
  return episodes;
}

function generateMockInsights(now, window, busyQuiet, stickyLag, outliers) {
  const cfg = mockPerfWindowConfig(window);
  const idleOutliers = outliers.filter((o) => o.reason === 'high_mspt_idle').length;
  const stickyDetail = stickyLag[0]?.narrative || 'Sticky lag detected in window.';
  return [
    {
      id: 'sticky_lag',
      severity: 'warning',
      title: stickyLag.length > 1 ? `${stickyLag.length} sticky lag episodes` : 'Sticky lag after players left',
      detail: stickyLag.length > 1
        ? `${stickyLag.length} episode(s) where MSPT stayed high after players left. Latest: ${stickyDetail}`
        : stickyDetail,
      tab: 'overview',
    },
    {
      id: 'busy_hours',
      severity: 'info',
      title: `Typically busy hours (${cfg.window})`,
      detail: busyHoursInsightDetail(busyQuiet.busy_hours),
      tab: 'overview',
    },
    {
      id: 'outlier_idle',
      severity: 'warning',
      title: 'High MSPT with no players',
      detail: `${idleOutliers} minute(s) in window had elevated MSPT while idle — check farms, chunk loaders, or background jobs.`,
      tab: 'issues',
    },
  ];
}

function generateDailySeries(now, days) {
  const daily = [];
  for (let d = days - 1; d >= 0; d -= 1) {
    const dayMs = now - d * 86400_000;
    const date = new Date(dayMs).toISOString().slice(0, 10);
    const dow = new Date(dayMs).getUTCDay();
    const weekend = dow === 0 || dow === 6;
    daily.push({
      date,
      minutes: 1440,
      tps_avg: round2(19.35 - (d % 9) * 0.04 - (weekend ? 0.15 : 0)),
      mspt_avg: round1(11.2 + (d % 11) * 0.75 + (weekend ? 1.4 : 0)),
      mspt_p95: round1(25 + (d % 10) * 1.6 + (weekend ? 4 : 0)),
      players_peak: weekend ? 8 + (d % 4) : 5 + (d % 5),
      heap_avg: round2(5.65 + (d % 7) * 0.08),
      cpu_avg: Math.round(36 + (d % 8) * 2.2 + (weekend ? 6 : 0)),
      low_tps_minutes: Math.round((weekend ? 10 : 6) + (d % 6) * 1.5),
    });
  }
  return daily;
}

function generateSummaryExtended(window = '7d') {
  if (window === '30d') {
    return {
      sample_minutes: 43200,
      tps_avg: 18.92,
      mspt_avg: 14.2,
      mspt_p95: 48,
      mspt_jitter_max: 24,
      heap_used_gb_avg: 5.9,
      mem_used_gb_avg: 13.8,
      cpu_pct_avg: 46,
      players_peak: 12,
      low_tps_minutes: 312,
      sticky_episode_count: 3,
      outlier_count: 5,
    };
  }
  return {
    sample_minutes: 10080,
    tps_avg: 19.14,
    mspt_avg: 12.4,
    mspt_p95: 42,
    mspt_jitter_max: 18,
    heap_used_gb_avg: 5.75,
    mem_used_gb_avg: 13.2,
    cpu_pct_avg: 44,
    players_peak: 8,
    low_tps_minutes: 99,
    sticky_episode_count: 1,
    outlier_count: 1,
  };
}

function generatePeriodCompare(window = '7d') {
  const is30d = window === '30d';
  return {
    window,
    deltas: is30d
      ? {
          mspt_avg: { current: 14.2, prior: 11.6, delta: 2.6 },
          low_tps_minutes: { current: 312, prior: 248, delta: 64 },
          players_peak: { current: 12, prior: 9, delta: 3 },
          outlier_count: { current: 5, prior: 2, delta: 3 },
          sticky_episode_count: { current: 3, prior: 1, delta: 2 },
        }
      : {
          mspt_avg: { current: 12.4, prior: 10.8, delta: 1.6 },
          low_tps_minutes: { current: 99, prior: 72, delta: 27 },
          players_peak: { current: 8, prior: 6, delta: 2 },
          outlier_count: { current: 1, prior: 0, delta: 1 },
          sticky_episode_count: { current: 1, prior: 0, delta: 1 },
        },
  };
}

function generateMockCorrelations(window = '7d') {
  if (window === '30d') {
    return [
      {
        id: 'outliers_up',
        severity: 'warning',
        title: 'More outlier minutes than prior 30d',
        detail: 'Outlier minutes up 150% vs prior 30d window.',
      },
      {
        id: 'sticky_sessions',
        severity: 'warning',
        title: '3 sticky lag episodes this month',
        detail: 'MSPT stayed high after players left on 3 separate occasions.',
      },
      {
        id: 'mspt_trend',
        severity: 'warning',
        title: 'Average MSPT up vs prior period',
        detail: 'Avg MSPT 14.2 ms now vs 11.6 ms prior 30d window.',
      },
      {
        id: 'lag_busy_hours',
        severity: 'info',
        title: 'Lag events cluster in busy hours',
        detail: 'Lag-related events this month align with Fri/Sat evening peaks.',
      },
    ];
  }
  return [
    {
      id: 'sticky_sessions',
      severity: 'warning',
      title: 'Post-session sticky lag detected',
      detail: '1 episode(s) where MSPT stayed high after players left.',
    },
    {
      id: 'lag_busy_hours',
      severity: 'info',
      title: 'Lag events cluster in busy hours',
      detail: 'Recent lag-related events align with evening peak load.',
    },
  ];
}

function generateRelatedEvents(now, opsCache, window = '7d') {
  const activity = opsCache?.activity?.events ?? [];
  const related = activity
    .filter((e) => ['performance_spike', 'tick_lag'].includes(e.type))
    .map((e) => ({
      ts: e.time,
      type: e.type,
      title: e.type === 'performance_spike' ? 'Sticky lag after players left' : 'Server tick lag',
      detail: e.detail,
      tab_link: 'activity',
    }));
  if (window === '30d') {
    related.push(
      {
        ts: offsetIso(now, -3 * 86400_000 - 4 * 3600_000),
        type: 'tick_lag',
        title: 'Server tick lag',
        detail: 'TPS dipped to 17.2 during Saturday evening peak (6 players).',
        tab_link: 'activity',
      },
      {
        ts: offsetIso(now, -9 * 86400_000 - 2 * 3600_000),
        type: 'performance_spike',
        title: 'Performance spike',
        detail: 'MSPT spike to 54 ms with 5 players online.',
        tab_link: 'activity',
      },
      {
        ts: offsetIso(now, -16 * 86400_000 - 5 * 3600_000),
        type: 'tick_lag',
        title: 'Server tick lag',
        detail: 'Sustained low TPS for 8 minutes during mod farm load.',
        tab_link: 'activity',
      },
      {
        ts: offsetIso(now, -27 * 86400_000 - 1 * 3600_000),
        type: 'performance_spike',
        title: 'Performance spike',
        detail: 'Evening peak MSPT reached 48 ms with 8 players.',
        tab_link: 'activity',
      },
    );
  }
  const lagEntry = opsCache?.lag_issues?.entries?.[0];
  if (lagEntry?.time) {
    related.unshift({
      ts: lagEntry.time,
      type: 'lag_incident',
      title: lagEntry.title || 'Lag incident',
      detail: lagEntry.narrative || lagEntry.title,
      tab_link: 'issues',
    });
  }
  return related.sort((a, b) => Date.parse(b.ts) - Date.parse(a.ts));
}

function offsetIso(now, offsetMs) {
  return isoAt(now + offsetMs);
}

function generatePerformanceInsightsMock(now, window = '7d') {
  const cfg = mockPerfWindowConfig(window);
  const heatCells = buildMockHourOfWeek(cfg.heatSampleMinutes);
  const busyQuiet = deriveBusyQuietFromHeat(heatCells);
  const outliers = generateMockOutliers(now, window);
  const stickyLag = generateMockStickyLag(now, window);
  return {
    window: cfg.window,
    hours: cfg.hours,
    generated_at: isoAt(now),
    enabled: true,
    sufficient_data: true,
    mspt_warn: 50,
    tps_warn: 19.5,
    busy_quiet: busyQuiet,
    player_bins: generateMockPlayerBins(window),
    outlier_minutes: outliers,
    sticky_lag: stickyLag,
    insights: generateMockInsights(now, window, busyQuiet, stickyLag, outliers),
  };
}

function generatePerformanceDashboardMock(now, opsCache, window = '7d') {
  const cfg = mockPerfWindowConfig(window);
  const base = generatePerformanceInsightsMock(now, window);
  const heatCells = buildMockHourOfWeek(cfg.heatSampleMinutes);
  const related = generateRelatedEvents(now, opsCache, window);
  return {
    ...base,
    summary_extended: generateSummaryExtended(window),
    hour_of_week: heatCells,
    daily_series: generateDailySeries(now, cfg.days),
    period_compare: generatePeriodCompare(window),
    correlations: generateMockCorrelations(window),
    related_events: related,
    related_event_count: related.length,
    scorecard_perf: window === '30d'
      ? { low_tps_minutes_24h: 18, low_tps_minutes_7d: 112, mspt_p95_24h: 46 }
      : { low_tps_minutes_24h: 12, low_tps_minutes_7d: 99, mspt_p95_24h: 42 },
  };
}

/** Golden scaffold for 1.0.8 insight tests — 5-minute rows for 7 days (≥10 samples per UTC hour). */
function generateWeekNormalFixture(now) {
  const hours = 7 * 24;
  const rollups = generatePerformanceRollups(now, { hours, stepSec: 300 });
  rollups.fixture = 'l1-week-normal';
  rollups.schema = 1;
  rollups.interval_sec = 300;
  rollups.retention_days = 90;
  return rollups;
}

function generateCpuCores(count = 8) {
  return Array.from({ length: count }, (_, id) => ({
    id,
    pct: Math.round(clamp(35 + Math.sin(id) * 18 + (Math.random() - 0.5) * 12, 4, 96) * 10) / 10,
  }));
}

function generateByDimension() {
  return [
    { id: 'overworld', path: 'world', label: 'Overworld', gb: 88.1 },
    { id: 'nether', path: 'world/DIM-1', label: 'Nether', gb: 8.2 },
    { id: 'end', path: 'world/DIM1', label: 'End', gb: 4.1 },
    { id: 'mod:aether/aether', path: 'world/dimensions/aether/aether', label: 'aether / aether', gb: 3.8 },
  ];
}

function generateBandwidthHistory(now, count = 60, stepMs = 30_000) {
  const out = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const t = now - i * stepMs;
    out.push({
      t: isoAt(t),
      rx: Math.round(clamp(wave(i, 14, 8, 10) + (Math.random() - 0.5) * 3, 0.5, 45) * 10) / 10,
      tx: Math.round(clamp(wave(i, 3.5, 2.5, 7) + (Math.random() - 0.5) * 1.2, 0.2, 18) * 10) / 10,
    });
  }
  return out;
}

function latestFromSamples(samples, now) {
  const last = (key) => samples[key]?.[samples[key].length - 1]?.v;
  return {
    tps: last('tps') ?? 19.8,
    mspt: last('mspt') ?? 5.2,
    players_online: Math.round(last('players') ?? 2),
    entities: 1247,
    chunks: 3842,
    host_cpu_pct: last('host_cpu') ?? 42,
    heap_mb: { used: Math.round(last('heap_mb') ?? 5800), committed: 8192, max: 8192 },
    mem_available_gb: last('mem_available_gb') ?? 12.5,
    disk_use_pct: last('disk_use_pct') ?? 42,
    world_gb: 18.4,
    java_rss_gb: 10.2,
    by_dimension: generateByDimension(),
    sample_interval_sec: 1,
    retention_hours: 2160,
    polled_at: isoAt(now),
  };
}

function incidentIdAt(ms) {
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}-${pad(d.getUTCMinutes())}-${pad(d.getUTCSeconds())}Z`;
}

function mockLagFindings() {
  return [
    { kind: 'confirmed', category: 'players', text: '4 player(s) online at spike time' },
    { kind: 'confirmed', category: 'pregen', text: 'World pregen was running — overworld 43%' },
    { kind: 'confirmed', category: 'command', text: 'Recent heavy command — Admin: /chunky continue' },
    { kind: 'confirmed', category: 'entities', text: 'Entity count elevated (1247)' },
  ];
}

function generateMockLagIncident(now, incidentId, pinnedAt) {
  const narrative = 'MSPT hit 118ms with TPS 8.4 and 4 players online. World pregen was active. Last command: /chunky continue.';
  return {
    id: incidentId,
    pinned_at: pinnedAt,
    source: 'auto',
    trigger: 'auto_mspt',
    severity: 'critical',
    tps: 8.4,
    mspt: 118.2,
    players_online: 4,
    entities: 1247,
    chunks: 3842,
    heap_used_gb: 6.1,
    heap_max_gb: 8.0,
    players: [
      { name: 'Steve', uuid: '00000000-0000-0000-0000-000000000001', ping: 42, dimension: 'minecraft:overworld' },
      { name: 'Alex', uuid: '00000000-0000-0000-0000-000000000002', ping: 55, dimension: 'minecraft:overworld' },
      { name: 'NotchFan42', uuid: '00000000-0000-0000-0000-000000000003', ping: 68, dimension: 'minecraft:the_nether' },
      { name: 'BuilderBob', uuid: '00000000-0000-0000-0000-000000000004', ping: 31, dimension: 'minecraft:overworld' },
    ],
    context: {
      recent_commands: [
        { time: offsetIso(now, -10 * 60_000), player: 'Admin', command: '/chunky continue' },
        { time: offsetIso(now, -22 * 60_000), player: 'Steve', command: '/fill ~ ~ ~ ~10 ~10 ~10 stone' },
      ],
      recent_joins_leaves: [
        { time: offsetIso(now, -12 * 60_000), type: 'player_join', detail: 'Steve' },
        { time: offsetIso(now, -14 * 60_000), type: 'player_leave', detail: 'Alex' },
      ],
      background_jobs: [{ type: 'chunky_pregen', detail: 'overworld 43%' }],
      host_cpu_pct: 78.2,
      log_tail: [
        "[Server thread/WARN]: Can't keep up! Is the server overloaded? Running 5200ms or 104 ticks behind",
        '[Server thread/INFO]: Admin issued server command: /chunky continue',
        '[Server thread/INFO]: [Chunky] Task running for minecraft:overworld — 43.54% complete',
      ],
    },
    narrative,
    findings: mockLagFindings(),
    primary_suspect: 'World pregen was running — overworld 43%',
  };
}

function generateOpsCache(now, performanceRollups) {
  const lagAt = now - 8 * 60_000;
  const incidentId = incidentIdAt(lagAt);
  const pinnedAt = offsetIso(now, -8 * 60_000);
  const perf = performanceRollups?.summary ?? {};
  const scorecardLowTps = Math.min(perf.low_tps_minutes ?? 12, 48);
  const scorecardMsptP95 = Math.max(perf.mspt_p95 ?? 42.3, 38);

  const activityEvents = [
    {
      time: offsetIso(now, -8 * 60_000),
      type: 'lag_incident',
      detail: 'Lag spike captured',
      source: 'scan',
      incident_id: incidentId,
    },
    {
      time: offsetIso(now, -8 * 60_000),
      type: 'tick_lag',
      detail: "Can't keep up! Is the server overloaded? Running 5200ms or 104 ticks behind",
      source: 'scan',
      ms_behind: 5200,
    },
    {
      time: offsetIso(now, -10 * 60_000),
      type: 'command',
      detail: '/chunky continue',
      source: 'scan',
      player: 'Admin',
    },
    {
      time: offsetIso(now, -12 * 60_000),
      type: 'player_join',
      detail: 'Steve',
      source: 'scan',
    },
    {
      time: offsetIso(now, -14 * 60_000),
      type: 'player_leave',
      detail: 'Alex',
      source: 'scan',
    },
    {
      time: offsetIso(now, -22 * 60_000),
      type: 'command',
      detail: '/fill ~ ~ ~ ~10 ~10 ~10 stone',
      source: 'scan',
      player: 'Steve',
    },
    {
      time: offsetIso(now, -8 * 60_000),
      type: 'backup_job',
      detail: '[Crafty] Starting backup for Example Server',
      source: 'scan',
    },
    {
      time: offsetIso(now, -6 * 60_000),
      type: 'restart_scheduled',
      detail: 'Server will restart in 5 minutes',
      source: 'scan',
    },
    {
      time: offsetIso(now, -45 * 60_000),
      type: 'performance_spike',
      detail: 'MSPT stayed above threshold for 45 min after players left (peak 72 ms)',
      source: 'scan',
    },
  ];

  const findings = mockLagFindings();
  const lagEntry = {
    id: `LAG-${incidentId}`,
    incident_id: incidentId,
    severity: 'critical',
    time: pinnedAt,
    title: 'Lag spike — MSPT 118ms · TPS 8.4',
    narrative: 'MSPT hit 118ms with TPS 8.4 and 4 players online. World pregen was active. Last command: /chunky continue.',
    hints: [
      '4 players online — lag may be player-driven (entities, chunk loading)',
      'World pregen running — competes with tick time; consider pausing during peak hours',
      'Recent command: /chunky continue',
      'Entity count elevated (1247) — check farms / mob caps',
    ],
    findings,
    primary_suspect: 'World pregen was running — overworld 43%',
    metrics: { tps: 8.4, mspt: 118.2, players_online: 4 },
    players: ['Steve', 'Alex', 'NotchFan42', 'BuilderBob'],
    resolved: false,
  };

  const modScanAt = offsetIso(now, -2 * 60_000);
  const modLogErrorEntries = mockModLogErrors(now);
  const modLogErrors = {
    scanned_at: modScanAt,
    new_count: modLogErrorEntries.length,
    entries: modLogErrorEntries,
  };
  const modIssueEntries = mockModIssues(modScanAt);
  const modIssues = {
    updated_at: modScanAt,
    active_count: modIssueEntries.length,
    entries: modIssueEntries,
  };
  const runningMods = {
    scanned_at: offsetIso(now, -2 * 60_000 + 5000),
    count: MOCK_RUNNING_MODS.length,
    mods: MOCK_RUNNING_MODS,
  };
  const inventoryDiff = mockModsInventoryDiff(now);
  const rightNowAt = offsetIso(now, -30_000);
  const rightNow = {
    updated_at: rightNowAt,
    signals: [
      { type: 'backup_job', label: 'Backup in progress', severity: 'warning', detail: '[Crafty] Starting backup for Example Server', tab: 'backups' },
      { type: 'restart_scheduled', label: 'Restart scheduled', severity: 'warning', detail: 'Server will restart in 5 minutes', tab: 'activity' },
      { type: 'mod_errors', label: `${modLogErrorEntries.length} mod log errors`, severity: 'warning', tab: 'mods' },
      { type: 'mods_changed', label: mockModsInventoryTldr(inventoryDiff), severity: 'info', tab: 'performance' },
      { type: 'lag', label: '1 active lag incident', severity: 'warning', tab: 'issues' },
      { type: 'log_stale', label: 'Log output stale', severity: 'warning', detail: '22 min since last log write', tab: 'issues' },
    ],
  };
  const logStale = {
    checked_at: offsetIso(now, -30_000),
    active: true,
    gap_minutes: 22.4,
    last_mtime: offsetIso(now, -22 * 60_000),
  };
  const backupsLive = {
    scanned_at: offsetIso(now, -18 * 60_000),
    last_backup: {
      file: '2026-06-23_08-00-00.zip',
      mtime: Math.floor((now - 18 * 60_000) / 1000),
      size_mb: 842,
      age_hours: 0.3,
    },
    inventory_summary: { file_count: 12, total_gb: 9.8 },
  };

  return {
    schema_version: 3,
    updated_at: offsetIso(now, 0),
    report_reconcile_at: offsetIso(now, -2 * 3600_000),
    ops_cache_seq: 4,
    activity: {
      scanned_at: offsetIso(now, -30_000),
      new_count: activityEvents.length,
      events: activityEvents,
    },
    lag_issues: {
      updated_at: pinnedAt,
      active_count: 1,
      entries: [lagEntry],
    },
    _mock_incident: generateMockLagIncident(now, incidentId, pinnedAt),
    crashes: {
      scanned_at: offsetIso(now, -45_000),
      count: 3,
      unreviewed: 2,
      latest: {
        file: 'crash-2026-06-22_14-33-07-server.txt',
        mtime: Math.floor((now - 45 * 60_000) / 1000),
        size: 28410,
        display_label: 'Create contraption tick overflow — block entity update took too long',
        source: 'scan',
      },
      entries: [
        {
          file: 'crash-2026-06-22_14-33-07-server.txt',
          mtime: Math.floor((now - 45 * 60_000) / 1000),
          size: 28410,
          display_label: 'Create contraption tick overflow — block entity update took too long',
          source: 'scan',
        },
        {
          file: 'crash-2026-06-18_08-12-44-server.txt',
          mtime: Math.floor((now - 4 * 3600_000) / 1000),
          size: 48291,
          display_label: 'Watchdog timeout — server stopped responding',
          source: 'scan',
        },
        {
          file: 'crash-2026-06-17_22-18-11-server.txt',
          mtime: Math.floor((now - 28 * 3600_000) / 1000),
          size: 12004,
          display_label: 'Mod loading error',
          source: 'scan',
        },
      ],
    },
    scorecard: {
      low_tps_minutes_24h: scorecardLowTps,
      low_tps_minutes_7d: 48,
      mspt_p95_24h: scorecardMsptP95,
      mspt_jitter_max_24h: 18.1,
    },
    mod_log_errors: modLogErrors,
    running_mods: runningMods,
    mod_issues: modIssues,
    right_now: rightNow,
    log_stale: logStale,
    backups_live: backupsLive,
    mods_inventory: {
      scanned_at: offsetIso(now, -2 * 60_000),
      tldr: mockModsInventoryTldr(inventoryDiff),
      jar_count: MOCK_RUNNING_MODS.length,
      diff: inventoryDiff,
    },
    disk_jump: {
      scanned_at: offsetIso(now, -30_000),
      active: true,
      disk_use_pct: 48.2,
      baseline_disk_use_pct: 42.0,
      delta_pct: 6.2,
      delta_free_gb: 12.4,
      message: 'Disk use rose 6.2% since last report (12.4 GB less free)',
    },
  };
}

function generateIssuesPeek(opsCache) {
  const lagEntries = opsCache?.lag_issues?.entries ?? [];
  const modEntries = opsCache?.mod_issues?.entries ?? [];
  const peek = {
    source: 'ops_cache',
    stale_report: false,
    lag_issues: lagEntries.filter((e) => !e.resolved),
    mod_issues: modEntries.filter((e) => !e.resolved).slice(0, 3),
  };
  if (opsCache?.log_stale?.active) {
    peek.log_stale = {
      ...opsCache.log_stale,
      id: 'LOG_STALE',
      title: 'Log output stale',
      severity: 'warning',
      narrative: `${Math.round(opsCache.log_stale.gap_minutes ?? 0)} minutes since latest.log was last written`,
    };
  }
  return peek;
}

function generateOverviewMeta(now, opsCache, performanceRollups, envelope) {
  const perf = performanceRollups?.summary ?? {};
  const scorecardLowTps = Math.min(perf.low_tps_minutes ?? 12, 48);
  const scorecardMsptP95 = Math.max(perf.mspt_p95 ?? 42.3, 38);
  const lowTps = scorecardLowTps;
  const msptP95 = scorecardMsptP95;
  const latestCrash = opsCache?.crashes?.latest;
  const lagEntry = opsCache?.lag_issues?.entries?.[0];
  const modIssue = opsCache?.mod_issues?.entries?.[0];
  const modErrCount = (opsCache?.mod_log_errors?.entries ?? []).filter((e) => e?.mod_id !== 'client_noise').length;

  const unreviewed = opsCache.crashes?.unreviewed ?? 2;
  const grade = unreviewed > 0 ? 'critical' : (lowTps >= 30 || msptP95 > 50 ? 'degraded' : 'healthy');
  const gradeWord = grade === 'critical' ? 'Critical' : grade === 'degraded' ? 'Degraded' : 'Healthy';

  return {
    version: '1.0.0',
    stale: false,
    last_report_at: offsetIso(now, -2 * 3600_000),
    age_hours: 2,
    ops_cache_updated_at: opsCache.updated_at,
    report_reconcile_at: opsCache.report_reconcile_at,
    activity_scanned_at: opsCache.activity?.scanned_at,
    mods_scanned_at: opsCache.mod_log_errors?.scanned_at,
    running_mod_count: opsCache.running_mods?.count ?? 0,
    ops_poll_active: false,
    ops_log_scan_active: true,
    backup_poll_active: true,
    backups_scanned_at: opsCache.backups_live?.scanned_at,
    health_grade: 'D',
    scorecard: {
      grade,
      grade_word: gradeWord,
      performance: {
        low_tps_minutes_24h: lowTps,
        low_tps_minutes_7d: 48,
        mspt_p95_24h: msptP95,
        mspt_jitter_max_24h: 18.1,
        subtitle: `${lowTps} low-TPS minutes (24h) · MSPT p95 ${Math.round(msptP95)}ms`,
      },
      crashes: {
        unreviewed,
        latest_label: latestCrash?.display_label ?? 'Watchdog timeout — server stopped responding',
        latest_file: latestCrash?.file,
        latest_at: latestCrash ? offsetIso(latestCrash.mtime * 1000, 0) : null,
      },
    },
    crash_tldr: latestCrash ? {
      label: latestCrash.display_label,
      file: latestCrash.file,
      at: offsetIso(latestCrash.mtime * 1000, 0),
      unreviewed,
    } : null,
    lag_tldr: lagEntry ? {
      label: lagEntry.title,
      narrative: lagEntry.narrative,
      incident_id: lagEntry.incident_id,
      severity: lagEntry.severity,
    } : null,
    mod_tldr: modIssue ? {
      label: modIssue.title,
      mod_id: modIssue.mod_id,
      severity: modIssue.severity,
      count: modErrCount,
    } : null,
    right_now: opsCache.right_now ?? null,
    performance_insights_tldr: {
      label: 'Sticky lag after players left',
      detail: 'MSPT stayed above threshold for 45 min after players left (peak 72 ms)',
      window: '7d',
    },
    log_stale_tldr: opsCache.log_stale?.active ? {
      active: true,
      gap_minutes: opsCache.log_stale.gap_minutes,
      last_mtime: opsCache.log_stale.last_mtime,
    } : null,
    mods_changed_tldr: opsCache.mods_inventory?.tldr ? {
      label: opsCache.mods_inventory.tldr,
      added_count: opsCache.mods_inventory.diff?.added_count ?? 0,
      removed_count: opsCache.mods_inventory.diff?.removed_count ?? 0,
      changed_count: opsCache.mods_inventory.diff?.changed_count ?? 0,
    } : null,
    disk_jump_tldr: opsCache.disk_jump?.active ? {
      active: true,
      label: opsCache.disk_jump.message,
      delta_pct: opsCache.disk_jump.delta_pct,
    } : null,
    spark_tldr: {
      label: 'sable dominated Server thread during critical lag',
      grade: 'critical',
      mod_id: 'sable',
      pct: 21,
      captured_at: offsetIso(now, -45 * 60_000),
      fresh: true,
    },
    rss_hint: {
      show: true,
      rss_gb: envelope.latest?.java_rss_gb ?? 10.2,
      heap_max_gb: (envelope.latest?.heap_mb?.max ?? 8192) / 1024,
      message: 'Native memory (RSS) is elevated vs Java heap max — possible off-heap/native leak; check mods using JNI or large direct buffers.',
    },
  };
}

const now = Date.now();
const samples = generateLiveSamples(now);
const latest = latestFromSamples(samples, now);
const bandwidthHistory = generateBandwidthHistory(now);
const diskIoHistory = generateDiskIoHistory(now);
const lastDiskIo = diskIoHistory[diskIoHistory.length - 1];
const performanceRollups = generatePerformanceRollups(now, { hours: 24, stepSec: 60 });
const performanceRollups7d = generatePerformanceRollups(now, { hours: 168, stepSec: 60 });
const performanceRollups30d = generatePerformanceRollups(now, { hours: 720, stepSec: 300 });
const cpuCores = generateCpuCores(8);
const byDimension = generateByDimension();

function chunkyPregenMock(now) {
  return {
    pregen_active: true,
    pregen_paused: false,
    hours_since_last: 0.01,
    cps_avg: 12.5,
    last: {
      dimension: 'minecraft:overworld',
      chunks: 6126564,
      total: 14068432,
      pct: 43.54,
      cps: 12.5,
      rate: 12.5,
      eta: '176:55:11',
      time: isoAt(now),
    },
  };
}

const envelope = {
  latest,
  chunky_pregen: chunkyPregenMock(now),
  thermal: {
    available: true,
    package_c: 58,
    ambient_c: 32,
    zones: [
      { id: 'tctl', label: 'Package', c: 58 },
      { id: 'core0', label: 'CPU Core 0', c: 55 },
      { id: 'core1', label: 'CPU Core 1', c: 54 },
      { id: 'core2', label: 'CPU Core 2', c: 57 },
      { id: 'core3', label: 'CPU Core 3', c: 53 },
      { id: 'core4', label: 'CPU Core 4', c: 52 },
      { id: 'core5', label: 'CPU Core 5', c: 56 },
      { id: 'core6', label: 'CPU Core 6', c: 51 },
      { id: 'core7', label: 'CPU Core 7', c: 50 },
      { id: 'nvme', label: 'NVMe', c: 44 },
      { id: 'ambient', label: 'Ambient', c: 32 },
    ],
  },
  bandwidth: {
    interface: 'eth0',
    rx_mbps: bandwidthHistory[bandwidthHistory.length - 1].rx,
    tx_mbps: bandwidthHistory[bandwidthHistory.length - 1].tx,
    sample_age_sec: 2,
  },
  bandwidth_history: bandwidthHistory,
  disk_io: {
    device: 'nvme0n1',
    read_mb_s: lastDiskIo.read,
    write_mb_s: lastDiskIo.write,
    sample_age_sec: 2,
    source: 'diskstats',
  },
  disk_io_history: diskIoHistory,
  cpu_cores: cpuCores,
  cpu_count: cpuCores.length,
  storage: {
    world_gb: latest.world_gb,
    by_dimension: byDimension,
  },
};

const snapshot = {
  source: 'watchtower',
  polled_at: latest.polled_at,
  overworld: { tps: latest.tps, mspt: latest.mspt },
  players_online: latest.players_online,
  entities: latest.entities,
  chunks: latest.chunks,
  mod_count: MOCK_RUNNING_MODS.length,
};

function writeReportsIndex(nowMs) {
  const latestGen = new Date(nowMs - 2 * 3600_000);
  const prevGen = new Date(nowMs - 26 * 3600_000);
  const fmtLabel = (d) => d.toISOString().replace('T', ' ').slice(0, 19);
  const index = {
    reports: [
      {
        id: 'latest',
        label: fmtLabel(latestGen),
        facts: 'facts.json',
        brief: 'brief.txt',
        engine: '4.0.6',
        generated: latestGen.toISOString(),
        window_start: new Date(latestGen.getTime() - 24 * 3600_000).toISOString(),
        lookback_hours: 24,
      },
      {
        id: 'prev',
        label: fmtLabel(prevGen),
        facts: 'facts-prev.json',
        brief: 'brief.txt',
        engine: '4.0.5',
        generated: prevGen.toISOString(),
        window_start: new Date(prevGen.getTime() - 24 * 3600_000).toISOString(),
        lookback_hours: 24,
      },
    ],
  };
  writeFileSync(join(dataDir, 'reports-index.json'), `${JSON.stringify(index, null, 2)}\n`);
  const prevFactsPath = join(dataDir, 'facts-prev.json');
  try {
    const prevFacts = JSON.parse(readFileSync(prevFactsPath, 'utf8'));
    prevFacts.meta = prevFacts.meta || {};
    prevFacts.meta.generated = prevGen.toISOString();
    writeFileSync(prevFactsPath, `${JSON.stringify(prevFacts, null, 2)}\n`);
  } catch { /* keep hand-authored prev facts */ }
  const factsPath = join(dataDir, 'facts.json');
  try {
    const facts = JSON.parse(readFileSync(factsPath, 'utf8'));
    facts.meta = facts.meta || {};
    facts.meta.generated = latestGen.toISOString();
    writeFileSync(factsPath, `${JSON.stringify(facts, null, 2)}\n`);
  } catch { /* patched later */ }
}

function writeCrashContextFixtures() {
  const sample = (n, base, spread) => Array.from({ length: n }, (_, i) => ({
    t: offsetIso(Date.now(), -(n - i) * 60_000),
    v: round1(base + spread * Math.sin(i / 2)),
  }));
  const contexts = {
    'crash-2026-06-22_14-33-07-server.txt': {
      window_minutes: 10,
      tps_samples: sample(10, 18.5, 2),
      mspt_samples: sample(10, 48, 12),
      events: [{ t: offsetIso(Date.now(), -8 * 60_000), type: 'tick_lag', detail: "Can't keep up! 12 ticks behind" }],
    },
    'crash-2026-06-18_08-12-44-server.txt': {
      window_minutes: 10,
      tps_samples: sample(10, 12, 4),
      mspt_samples: sample(10, 85, 20),
      events: [{ t: offsetIso(Date.now(), -15 * 60_000), type: 'watchdog', detail: 'Server hung on main thread' }],
    },
    'crash-2026-06-17_22-18-11-server.txt': {
      window_minutes: 10,
      tps_samples: sample(10, 19.8, 0.5),
      mspt_samples: sample(10, 22, 5),
      events: [{ t: offsetIso(Date.now(), -20 * 60_000), type: 'mod_load', detail: 'Mixin apply failed during startup' }],
    },
  };
  writeFileSync(join(dataDir, 'crash-contexts.json'), `${JSON.stringify(contexts, null, 2)}\n`);
}

function patchFactsModFixtures() {
  if (isFreshPreview) return;
  const factsPath = join(dataDir, 'facts.json');
  const facts = JSON.parse(readFileSync(factsPath, 'utf8'));
  if (!facts.optional) facts.optional = {};
  facts.optional.mods = mockReportMods();
  facts.optional.mod_log_errors = mockModLogErrors(Date.now()).map(({ source, last_seen_epoch, ...rest }) => rest);
  facts.optional.mod_recommendations = MOCK_MOD_RECOMMENDATIONS;
  facts.optional.client_only_mods = MOCK_CLIENT_ONLY_MODS;
  facts.optional.client_only_mods_summary = MOCK_CLIENT_ONLY_SUMMARY;
  const clientIssue = facts.issues?.find((i) => i.id === 'CLIENT_MODS_ON_SERVER');
  if (clientIssue) {
    clientIssue.message = `${MOCK_CLIENT_ONLY_MODS.length} client-only mods detected on the server.`;
  }
  writeFileSync(factsPath, `${JSON.stringify(facts, null, 2)}\n`);
}

writeFileSync(join(dataDir, 'live-samples.json'), `${JSON.stringify(samples, null, 2)}\n`);
writeFileSync(join(dataDir, 'live-envelope.json'), `${JSON.stringify(envelope, null, 2)}\n`);
writeFileSync(join(dataDir, 'snapshot.json'), `${JSON.stringify(snapshot, null, 2)}\n`);
writeFileSync(join(dataDir, 'performance-rollups.json'), `${JSON.stringify(performanceRollups, null, 2)}\n`);

writeFileSync(join(dataDir, 'performance-rollups.json'), `${JSON.stringify(performanceRollups, null, 2)}\n`);
writeFileSync(join(dataDir, 'performance-rollups-7d.json'), `${JSON.stringify(performanceRollups7d, null, 2)}\n`);
writeFileSync(join(dataDir, 'performance-rollups-30d.json'), `${JSON.stringify(performanceRollups30d, null, 2)}\n`);

const performanceInsights = generatePerformanceInsightsMock(now, '7d');
writeFileSync(join(dataDir, 'performance-insights.json'), `${JSON.stringify(performanceInsights, null, 2)}\n`);
const performanceInsights30d = generatePerformanceInsightsMock(now, '30d');
writeFileSync(join(dataDir, 'performance-insights-30d.json'), `${JSON.stringify(performanceInsights30d, null, 2)}\n`);

const opsCache = generateOpsCache(now, performanceRollups);
const performanceDashboard = generatePerformanceDashboardMock(now, opsCache, '7d');
writeFileSync(join(dataDir, 'performance-dashboard.json'), `${JSON.stringify(performanceDashboard, null, 2)}\n`);
const performanceDashboard30d = generatePerformanceDashboardMock(now, opsCache, '30d');
writeFileSync(join(dataDir, 'performance-dashboard-30d.json'), `${JSON.stringify(performanceDashboard30d, null, 2)}\n`);
const mockIncident = opsCache._mock_incident;
delete opsCache._mock_incident;
const issuesPeek = generateIssuesPeek(opsCache);
const overviewMeta = generateOverviewMeta(now, opsCache, performanceRollups, envelope);
writeFileSync(join(dataDir, 'ops-cache.json'), `${JSON.stringify(opsCache, null, 2)}\n`);
writeFileSync(join(dataDir, 'issues-peek.json'), `${JSON.stringify(issuesPeek, null, 2)}\n`);
writeFileSync(join(dataDir, 'overview-meta.json'), `${JSON.stringify(overviewMeta, null, 2)}\n`);
patchFactsModFixtures();
if (!isFreshPreview) {
  writeReportsIndex(now);
}
writeCrashContextFixtures();
copyFileSync(
  join(root, 'assets', 'watchtower-icon-simple.png'),
  join(dataDir, 'server-icon.png'),
);

if (isFreshPreview) {
  writeFileSync(join(dataDir, 'reports-index.json'), `${JSON.stringify({ reports: [] }, null, 2)}\n`);
  console.log('  PREVIEW_PROFILE=fresh — empty reports-index.json');
}
if (mockIncident?.id) {
  const incidentsDir = join(dataDir, 'incidents');
  mkdirSync(incidentsDir, { recursive: true });
  writeFileSync(join(incidentsDir, `${mockIncident.id}.json`), `${JSON.stringify(mockIncident, null, 2)}\n`);
}

const fixtureDir = join(root, '..', '..', 'samples', 'fixtures', 'performance-insights');
try {
  mkdirSync(fixtureDir, { recursive: true });
  writeFileSync(
    join(fixtureDir, 'l1-week-normal.json'),
    `${JSON.stringify(generateWeekNormalFixture(now), null, 2)}\n`,
  );
  writeFileSync(
    join(fixtureDir, 'l1-sticky-lag.json'),
    `${JSON.stringify(generateStickyLagFixture(now), null, 2)}\n`,
  );
} catch (e) {
  console.warn('Could not write samples/fixtures:', e.message);
}

console.log(`Wrote mock live fixtures (${samples.tps.length} points per series, ${performanceRollups.rows.length} rollup rows / 24h) to data/`);
console.log(`  + performance-rollups-7d.json (${performanceRollups7d.rows.length} rows)`);
console.log(`  + performance-rollups-30d.json (${performanceRollups30d.rows.length} rows, 5m step)`);
console.log(`  + performance-insights.json (7d overview poll)`);
console.log(`  + performance-insights-30d.json (30d overview poll)`);
console.log(`  + performance-dashboard.json (full Insights tab payload, 7d)`);
console.log(`  + performance-dashboard-30d.json (Insights tab payload, 30d)`);
console.log(`  + ops-cache.json (activity ledger, lag_issues, mod_log_errors, running_mods, mod_issues, right_now, log_stale, backups_live)`);
console.log(`  + overview-meta.json (scorecard, crash/lag/mod TLDR, right_now, log_stale_tldr)`);
console.log(`  + issues-peek.json`);
console.log(`  + facts.json (mods manifest, recommendations, client-only, log errors)`);
if (mockIncident?.id) console.log(`  + incidents/${mockIncident.id}.json`);

const sparkMocks = spawnSync(process.platform === 'win32' ? 'gradlew.bat' : './gradlew', [':watchtower-core:sparkAuditFixtures', '-q'], {
  cwd: join(root, '..', '..'),
  stdio: 'inherit',
  shell: process.platform === 'win32',
});
if (sparkMocks.status !== 0) {
  console.warn('sparkAuditFixtures failed — using existing golden JSON if present');
}
const sparkMocksNode = spawnSync(process.execPath, ['scripts/generate-spark-mocks.mjs'], {
  cwd: root,
  stdio: 'inherit',
});
if (sparkMocksNode.status !== 0) {
  console.warn('generate-spark-mocks.mjs failed');
} else {
  console.log('  + spark-profiles.json, spark-profile-mocks.json');
}
