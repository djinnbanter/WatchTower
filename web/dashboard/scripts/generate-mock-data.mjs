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
import {
  clamp,
  round1,
  round2,
  playerTarget,
  createSimState,
  stepSim,
  generateCorrelatedLiveSamples,
  generateCorrelatedLiveSamplesSpan,
  gauss,
} from '../src/api/mock-physics.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dataDir = join(root, 'data');
const previewProfile = (process.env.PREVIEW_PROFILE || 'normal').trim().toLowerCase();

function isoAt(ms) {
  return new Date(ms).toISOString();
}

/** Alias — heatmap / rollups share the diurnal player curve. */
function mockHeatmapPlayers(dow, hour) {
  return playerTarget(dow, hour);
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

function generateLiveBundle(now) {
  // ~30d history: sparse older samples + dense last 24h for short brush windows.
  return generateCorrelatedLiveSamplesSpan(now, {
    spanMs: 30 * 86_400_000,
    recentMs: 86_400_000,
    denseStepMs: 30_000,
    sparseStepMs: 10 * 60_000,
  });
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

  const state = createSimState(null, now - (rowCount - 1) * stepSec * 1000);

  for (let i = rowCount - 1; i >= 0; i -= 1) {
    const t = now - i * stepSec * 1000;
    // Several physics steps per rollup bucket for smoother averages
    const sub = Math.max(1, Math.round(stepSec / 30));
    let tpsAcc = 0;
    let msptAcc = 0;
    let msptPeak = 0;
    let cpuAcc = 0;
    let heapAcc = 0;
    let playersPeak = 0;
    for (let s = 0; s < sub; s += 1) {
      const m = stepSim(state, t - (sub - 1 - s) * 30_000, 30);
      tpsAcc += m.tps;
      msptAcc += m.mspt;
      msptPeak = Math.max(msptPeak, m.mspt);
      cpuAcc += m.host_cpu;
      heapAcc += m.heap_mb;
      playersPeak = Math.max(playersPeak, m.players);
    }
    const tps = tpsAcc / sub;
    const mspt = msptAcc / sub;
    const players = playersPeak;
    const lowTps = tps < 19.5;
    if (lowTps) lowTpsMinutes += Math.max(1, Math.round(stepSec / 60));
    tpsSum += tps;
    msptSum += mspt;
    tpsMins.push(tps);
    msptP95s.push(msptPeak);
    playersMax = Math.max(playersMax, players);
    const jitter = round1(clamp(msptPeak - mspt + Math.abs(gauss()) * 2, 0.5, 40));
    // 1.1.6: rising GC / heap in the latest 12h vs prior 12h (restart hygiene mock).
    const ageHours = (now - t) / 3_600_000;
    const recent12h = ageHours < 12;
    const gcPause = recent12h ? 4.2 : 2.8;
    const heapPressure = recent12h ? 71.0 : 69.0;
    rows.push({
      ts: isoAt(t),
      tps_avg: round2(tps),
      tps_min: round2(Math.max(4, tps - (msptPeak > 50 ? 1.5 : 0.25))),
      mspt_avg: round1(mspt),
      mspt_p95: round1(msptPeak),
      mspt_jitter_max: jitter,
      players_max: players,
      heap_used_gb_avg: round2(heapAcc / sub / 1024),
      mem_used_gb_avg: round2(clamp(32 - state.memAvail, 8, 28)),
      cpu_pct_avg: round1(cpuAcc / sub),
      heap_pressure_pct_avg: round1(heapPressure),
      heap_pressure_pct_p95: round1(heapPressure + (recent12h ? 2 : 1)),
      gc_pause_pct_avg: round2(gcPause),
      entities_max: Math.round(clamp(800 + players * 180 + (recent12h ? 900 : 0) + Math.abs(gauss()) * 200, 200, 6000)),
      chunks_max: Math.round(clamp(220 + players * 40 + (recent12h ? 180 : 0) + Math.abs(gauss()) * 40, 80, 2000)),
      unattended_chunks_max: Math.round(clamp(recent12h ? 120 + Math.abs(gauss()) * 40 : 40, 0, 800)),
      low_tps_flag: lowTps,
    });
  }

  return {
    enabled: true,
    hours,
    summary: {
      sample_minutes: rows.length * Math.max(1, Math.round(stepSec / 60)),
      tps_avg: round2(tpsSum / rows.length),
      tps_min: round2(Math.min(...tpsMins)),
      mspt_avg: round1(msptSum / rows.length),
      mspt_p95: round1(Math.max(...msptP95s)),
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
  // Peak concurrent in fixtures is ~7 → empty + terciles 1-2 / 3-4 / 5-7
  return [
    { players_band: '0', minutes: s(420), mspt_avg: 8.4, tps_avg: 19.7 },
    { players_band: '1-2', minutes: s(280), mspt_avg: 14.2, tps_avg: 19.4 },
    { players_band: '3-4', minutes: s(520), mspt_avg: 22.8, tps_avg: 18.6 },
    { players_band: '5-7', minutes: s(220), mspt_avg: 31.5, tps_avg: 17.9 },
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
    let playersPeak = 0;
    let msptAcc = 0;
    let tpsAcc = 0;
    let lowMins = 0;
    for (let h = 0; h < 24; h += 1) {
      const p = playerTarget(dow, h);
      const players = Math.round(clamp(p, 0, 12));
      playersPeak = Math.max(playersPeak, players);
      let mspt = 3.8 + players * 2.4;
      if (players >= 7) mspt += (players - 6) * 2.5;
      if (h >= 19 && h <= 22) mspt += 1.5;
      if (weekend) mspt += 1.2;
      mspt += (d % 5) * 0.15;
      const tps = mspt <= 50
        ? clamp(20 - Math.max(0, mspt - 40) * 0.12, 18.5, 20)
        : clamp(1000 / mspt, 8, 19.8);
      msptAcc += mspt;
      tpsAcc += tps;
      if (tps < 19.5) lowMins += weekend ? 6 : 3;
    }
    daily.push({
      date,
      minutes: 1440,
      tps_avg: round2(tpsAcc / 24),
      mspt_avg: round1(msptAcc / 24),
      mspt_p95: round1(msptAcc / 24 + (weekend ? 16 : 11) + (d % 5) * 1.1),
      players_peak: playersPeak,
      heap_avg: round2(5.4 + playersPeak * 0.08 + (d % 7) * 0.04),
      cpu_avg: Math.round(clamp(26 + playersPeak * 3.8 + (weekend ? 5 : 0) + (d % 4), 18, 85)),
      low_tps_minutes: Math.round(lowMins + (d % 6)),
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

/** Rolling multi-boot series for Startup "Boot times" chart (phases included). */
function mockBootHistory(nowMs) {
  const day = 24 * 3600_000;
  const templates = [
    { daysAgo: 7, total: 118.2, status: 'ok', phases: [32.4, 18.1, 36.2, 31.5] },
    { daysAgo: 6, total: 124.6, status: 'ok', phases: [34.0, 19.4, 38.8, 32.4] },
    { daysAgo: 5, total: 131.1, status: 'warnings', phases: [35.6, 21.2, 40.1, 34.2] },
    { daysAgo: 4, total: 128.4, status: 'warnings', phases: [34.8, 20.5, 39.6, 33.5] },
    { daysAgo: 3, total: 135.9, status: 'warnings', phases: [36.9, 22.8, 42.0, 34.2] },
    { daysAgo: 2, total: 122.7, status: 'ok', phases: [33.1, 18.9, 37.4, 33.3] },
    { daysAgo: 1, total: 129.9, status: 'warnings', phases: [35.2, 20.8, 40.4, 33.5] },
    { daysAgo: 0, total: 142.3, status: 'warnings', phases: [38.1, 22.0, 41.5, 28.4] },
  ];
  const labels = [
    ['registry', 'Registry freeze'],
    ['datapack', 'Datapack load'],
    ['mod_init', 'Mod initialization'],
    ['world_load', 'World load'],
  ];
  return templates.map((t) => ({
    done_at: t.daysAgo === 0 ? offsetIso(nowMs, -3 * 3600_000) : offsetIso(nowMs, -t.daysAgo * day - 4 * 3600_000),
    total_sec: t.total,
    status: t.status,
    phases: labels.map(([id, label], i) => ({ id, label, sec: t.phases[i] })),
  }));
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
    players_band_scale: 7,
    players_band_scale_source: 'observed_peak',
    outlier_minutes: outliers,
    sticky_lag: stickyLag,
    insights: generateMockInsights(now, window, busyQuiet, stickyLag, outliers),
  };
}

function generateWorldPressureCompare(window = '7d') {
  // Coherent with generateOpsCache world_pressure census (Overworld storm ~5.1k entities).
  // Quiet = off-peak p95; busy = typical evening; peak = weekend spike; storm sits between busy and peak.
  const peakEntities = window === '30d' ? 7200 : 5800;
  const peakChunks = window === '30d' ? 2400 : 2050;
  const busyEntities = window === '30d' ? 4600 : 4200;
  const busyChunks = window === '30d' ? 1750 : 1550;
  const quietEntities = 1800;
  const quietChunks = 700;
  return {
    window,
    quiet: {
      entities_p50: Math.round(quietEntities * 0.78),
      entities_p95: quietEntities,
      chunks_p95: quietChunks,
      sample_minutes: window === '30d' ? 4800 : 1120,
      hours_utc: [3, 4, 5],
    },
    busy: {
      entities_p50: Math.round(busyEntities * 0.82),
      entities_p95: busyEntities,
      chunks_p95: busyChunks,
      sample_minutes: window === '30d' ? 5400 : 1260,
      hours_utc: [18, 19, 20],
    },
    peak: {
      entities_max: peakEntities,
      chunks_max: peakChunks,
      entities_at: '2026-07-26T19:40:00Z',
      chunks_at: '2026-07-26T19:40:00Z',
    },
    method:
      'quiet=p95 during Schedule quiet hours; busy=p95 during busy hours; peak=max minute in window',
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
    world_pressure_compare: generateWorldPressureCompare(window),
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

function generateCpuCores(count = 8, hostCpu = 42) {
  return Array.from({ length: count }, (_, id) => ({
    id,
    pct: round1(clamp(hostCpu * (0.55 + (id % 3) * 0.12) + Math.sin(id * 1.7) * 10 + gauss() * 6, 3, 99)),
  }));
}

function generateByDimension() {
  // Keep dimension GB summing near world_gb (~18.4) so Overview Storage stays coherent.
  return [
    { id: 'overworld', path: 'world', label: 'Overworld', gb: 15.6 },
    { id: 'nether', path: 'world/DIM-1', label: 'Nether', gb: 1.4 },
    { id: 'end', path: 'world/DIM1', label: 'End', gb: 0.7 },
    { id: 'mod:aether/aether', path: 'world/dimensions/aether/aether', label: 'aether / aether', gb: 0.7 },
  ];
}

function generateByLogs() {
  // Sums to ~0.4 GB to match facts.optional.storage.logs_gb.
  return [
    { id: 'latest', path: 'logs/latest.log', label: 'latest.log', gb: 0.08, mb: 82 },
    { id: 'debug', path: 'logs/debug.log', label: 'debug.log', gb: 0.05, mb: 51 },
    { id: 'archives', path: 'logs/*.gz', label: 'Rotated archives', gb: 0.22, mb: 225 },
    { id: 'other_logs', path: 'logs', label: 'Other log files', gb: 0.05, mb: 51 },
  ];
}

function generateByOther() {
  // Sums to ~2.1 GB residual of server dir after world/mods/logs.
  return [
    { id: 'other:libraries', path: 'libraries', label: 'libraries', gb: 0.85 },
    { id: 'other:config', path: 'config', label: 'config', gb: 0.42 },
    { id: 'other:versions', path: 'versions', label: 'versions', gb: 0.28 },
    { id: 'other:crash-reports', path: 'crash-reports', label: 'crash-reports', gb: 0.18 },
    { id: 'other:kubejs', path: 'kubejs', label: 'kubejs', gb: 0.15 },
    { id: 'other:defaultconfigs', path: 'defaultconfigs', label: 'defaultconfigs', gb: 0.08 },
    { id: 'other:rest', path: '.', label: 'Other folders', gb: 0.14 },
  ];
}

/** Top jars summing to ~1.2 GB to match facts.optional.storage.mods_gb. */
function generateByMods() {
  const weights = [
    ['create', 0.22],
    ['mekanism', 0.14],
    ['ae2', 0.11],
    ['botania', 0.09],
    ['alexsmobs', 0.08],
    ['jei', 0.07],
    ['biomesoplenty', 0.06],
    ['sophisticatedbackpacks', 0.05],
    ['kubejs', 0.04],
    ['geckolib', 0.03],
    ['supplementaries', 0.03],
    ['farmersdelight', 0.025],
    ['waystones', 0.02],
    ['modernfix', 0.015],
    ['lithium', 0.012],
    ['spark', 0.008],
  ];
  const rest = Math.max(0, 1.2 - weights.reduce((s, [, w]) => s + w, 0));
  const byId = new Map(MOCK_RUNNING_MODS.map((m) => [m.id, m]));
  const rows = weights.map(([id, gb]) => {
    const mod = byId.get(id);
    const version = mod?.version ?? '1.0.0';
    const jar = `${id}-${version}.jar`;
    return {
      id: `mod:${jar.toLowerCase()}`,
      path: `mods/${jar}`,
      label: jar,
      gb: round2(gb),
      mb: Math.round(gb * 1024 * 10) / 10,
    };
  });
  if (rest >= 0.01) {
    rows.push({
      id: 'mod:rest',
      path: 'mods',
      label: 'Other jars',
      gb: round2(rest),
      mb: Math.round(rest * 1024 * 10) / 10,
    });
  }
  return rows.sort((a, b) => b.gb - a.gb);
}

function latestFromSamples(samples, now, simMeta = null) {
  const last = (key) => samples[key]?.[samples[key].length - 1]?.v;
  const heapUsed = Math.round(last('heap_mb') ?? 5800);
  const players = Math.round(last('players') ?? 2);
  return {
    tps: last('tps') ?? 19.8,
    mspt: last('mspt') ?? 5.2,
    players_online: players,
    entities: simMeta?.entities ?? 1247,
    chunks: simMeta?.chunks ?? 3842,
    host_cpu_pct: last('host_cpu') ?? 42,
    heap_mb: { used: heapUsed, committed: 8192, max: 8192 },
    mem_available_gb: last('mem_available_gb') ?? 12.5,
    disk_use_pct: last('disk_use_pct') ?? 42,
    world_gb: 18.4,
    java_rss_gb: round2(clamp(heapUsed / 1024 + 3.8 + players * 0.15, 6, 16)),
    java_uptime_sec: 38 * 3600,
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
      time: offsetIso(now, -3 * 60_000),
      type: 'mod_jar_added',
      detail: 'create-1.21.1-6.0.0.jar',
      source: 'scan',
      path: 'create-1.21.1-6.0.0.jar',
    },
    {
      time: offsetIso(now, -4 * 60_000),
      type: 'config_changed',
      detail: 'config/create-common.toml',
      source: 'scan',
      path: 'config/create-common.toml',
    },
    {
      time: offsetIso(now, -5 * 60_000),
      type: 'mod_disabled',
      detail: 'dimdoors-1.21.jar → dimdoors-1.21.jar.disabled',
      source: 'dashboard',
      path: 'dimdoors-1.21.jar.disabled',
    },
    {
      time: offsetIso(now, -6 * 60_000),
      type: 'restart_scheduled',
      detail: 'Server will restart in 5 minutes',
      source: 'scan',
    },
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
      time: offsetIso(now, -8 * 60_000),
      type: 'backup_job',
      detail: '[Crafty] Starting backup for Example Server',
      source: 'scan',
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
      time: offsetIso(now, -28 * 60_000),
      type: 'mod_jar_updated',
      detail: 'jei-1.21.1-neoforge-19.21.0.jar',
      source: 'scan',
      path: 'jei-1.21.1-neoforge-19.21.0.jar',
    },
    {
      time: offsetIso(now, -33 * 60_000),
      type: 'mod_jar_removed',
      detail: 'old-debug-1.0.jar',
      source: 'scan',
      path: 'old-debug-1.0.jar',
    },
    {
      time: offsetIso(now, -38 * 60_000),
      type: 'mod_enabled',
      detail: 'appleskin-neoforge-mc1.21-3.0.9.jar.disabled → appleskin-neoforge-mc1.21-3.0.9.jar',
      source: 'dashboard',
      path: 'appleskin-neoforge-mc1.21-3.0.9.jar',
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
      {
        type: 'join_clinic',
        label: '3 recent pack sync join failures',
        severity: 'warning',
        detail: 'NotchFan42 / BuilderBob / FridayGuest — open Session → Join clinic',
        tab: 'session',
      },
      { type: 'log_stale', label: 'Log output stale', severity: 'warning', detail: '22 min since last log write', tab: 'issues' },
    ],
  };
  const logStale = {
    checked_at: offsetIso(now, -30_000),
    active: true,
    gap_minutes: 22.4,
    last_mtime: offsetIso(now, -22 * 60_000),
  };
  const backupsInventory = Array.from({ length: 12 }, (_, i) => {
    const ageHours = i === 0 ? 0.3 : 24.3 * i;
    const day = String(23 - i).padStart(2, '0');
    const file = `2026-06-${day}_08-00-00.zip`;
    const dir = i < 5 ? '/srv/backups/minecraft' : '/mnt/nas/mc-backups';
    const checkedAt = offsetIso(now, -(i + 1) * 3600_000);
    /** Varied integrity chips for Backups preview (1.1.20).
     * Newest is suspicious so Issues → BACKUP_VERIFY_FAILED matches product rules. */
    const verify =
      i === 0
        ? {
            status: 'suspicious',
            mode: 'light',
            checked_at: checkedAt,
            findings: ['archive_ok', 'has_level.dat', 'missing:region_mca'],
          }
        : i === 1
          ? {
              status: 'verified',
              mode: 'light',
              checked_at: checkedAt,
              findings: ['archive_ok', 'has_level.dat', 'has_region_mca'],
            }
          : i === 2
            ? {
                status: 'broken',
                mode: 'light',
                checked_at: checkedAt,
                findings: ['truncated_or_unreadable'],
              }
            : i === 3
              ? {
                  status: 'not_checked',
                  mode: 'light',
                  checked_at: checkedAt,
                  findings: ['unsupported_format'],
                }
              : i === 4
                ? {
                    status: 'pending',
                    mode: 'light',
                    checked_at: checkedAt,
                    findings: [],
                  }
                : {
                    status: 'verified',
                    mode: 'light',
                    checked_at: checkedAt,
                    findings: ['archive_ok', 'has_level.dat', 'has_region_mca'],
                  };
    return {
      file,
      path: `${dir}/${file}`,
      size_mb: 842 - i * 5,
      age_hours: Math.round(ageHours * 10) / 10,
      ...(i === 0 ? { mtime: Math.floor((now - 18 * 60_000) / 1000) } : {}),
      verify,
    };
  });
  const backupsLive = {
    scanned_at: offsetIso(now, -18 * 60_000),
    last_backup: {
      file: backupsInventory[0].file,
      path: backupsInventory[0].path,
      mtime: Math.floor((now - 18 * 60_000) / 1000),
      size_mb: backupsInventory[0].size_mb,
      age_hours: 0.3,
    },
    inventory_summary: { file_count: backupsInventory.length, total_gb: 9.8 },
    inventory: backupsInventory,
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
      count: 13,
      unreviewed: 12,
      unreviewed_groups: 11,
      latest: {
        file: 'crash-2026-06-22_14-33-07-server.txt',
        mtime: Math.floor((now - 45 * 60_000) / 1000),
        size: 28410,
        display_label: 'Create contraption collision — mf.axis null (evidence-backed)',
        source: 'scan',
      },
      entries: [
        {
          file: 'crash-2026-06-22_14-33-07-server.txt',
          mtime: Math.floor((now - 45 * 60_000) / 1000),
          size: 28410,
          display_label: 'Create contraption collision — mf.axis null (evidence-backed)',
          source: 'scan',
        },
        {
          file: 'crash-2026-07-10_19-04-12-server.txt',
          mtime: Math.floor((now - 6 * 3600_000) / 1000),
          size: 22104,
          display_label: 'Create crashed while ticking — BeltBlockEntity (no contraption evidence)',
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
          file: 'crash-2026-06-18_08-13-50-server.txt',
          mtime: Math.floor((now - 4 * 3600_000 + 60_000) / 1000),
          size: 48102,
          display_label: 'Watchdog follow-up — paired with primary hang',
          source: 'scan',
        },
        {
          file: 'crash-2026-06-19_11-02-18-server.txt',
          mtime: Math.floor((now - 2 * 3600_000) / 1000),
          size: 47011,
          display_label: 'Watchdog timeout — Chunky pregen stall',
          source: 'scan',
        },
        {
          file: 'crash-2026-07-11_02-15-33-server.txt',
          mtime: Math.floor((now - 18 * 3600_000) / 1000),
          size: 31200,
          display_label: 'Corrupt world NBT — Unexpected end of ZLIB input stream',
          source: 'scan',
        },
        {
          file: 'crash-2026-07-09_21-48-01-server.txt',
          mtime: Math.floor((now - 2 * 24 * 3600_000) / 1000),
          size: 19840,
          display_label: 'Mixin init failed — create.mixins.json',
          source: 'scan',
        },
        {
          file: 'crash-2026-07-06_09-33-12-server.txt',
          mtime: Math.floor((now - 5 * 24 * 3600_000) / 1000),
          size: 17600,
          display_label: 'Mixin conflict — create vs createaddition',
          source: 'scan',
        },
        {
          file: 'crash-2026-07-05_14-01-55-server.txt',
          mtime: Math.floor((now - 6 * 24 * 3600_000) / 1000),
          size: 14200,
          display_label: 'Duplicate mods — create installed twice',
          source: 'scan',
        },
        {
          file: 'crash-2026-07-08_16-22-44-server.txt',
          mtime: Math.floor((now - 3 * 24 * 3600_000) / 1000),
          size: 15420,
          display_label: 'Java version mismatch — LuckPerms needs Java 21',
          source: 'scan',
        },
        {
          file: 'crash-2026-07-04_20-44-08-server.txt',
          mtime: Math.floor((now - 7 * 24 * 3600_000) / 1000),
          size: 11800,
          display_label: 'File lock — world/session.lock held',
          source: 'scan',
        },
        {
          file: 'crash-2026-07-07_11-05-19-server.txt',
          mtime: Math.floor((now - 4 * 24 * 3600_000) / 1000),
          size: 9800,
          display_label: 'OutOfMemoryError — Java heap space',
          source: 'scan',
        },
        {
          file: 'crash-2026-06-17_22-18-11-server.txt',
          mtime: Math.floor((now - 28 * 3600_000) / 1000),
          size: 12004,
          display_label: 'Mod crash (examplemod) — reviewed',
          source: 'scan',
          reviewed: true,
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
      message: 'Disk use rose 6.2% since last check (12.4 GB less free)',
    },
    weekly_digest: generateWeeklyDigest(now),
    external_kill: {
      detected_at: offsetIso(now, -5 * 60_000),
      killed_at: offsetIso(now, -35 * 60_000),
      failure_kind: 'external_kill',
      subtype: 'oom',
      confidence: 'high',
      kernel_log_readable: true,
      display_label: 'Killed by the OS out-of-memory killer',
      plain_english:
        'The server process was killed from outside the JVM by the OS or container out-of-memory killer. There is no Minecraft crash report because the process was terminated by the host, not by a mod exception.',
      likely_cause: 'Container or host memory limit exceeded',
      fix_hints: [
        'The server process was killed by the OS or container out-of-memory killer — nothing in Minecraft crashed.',
        'Raise the container / host memory limit, or lower -Xmx so the JVM fits under the limit.',
        'Open Insights → Configs for the RAM sizing advisor before changing flags.',
        'Leave 1–2 GB above -Xmx for JVM overhead and the OS.',
      ],
      evidence: [
        {
          file: 'journalctl-k',
          line: null,
          quote: 'Out of memory: Killed process 18432 (java) total-vm:12582912kB',
          time: offsetIso(now, -35 * 60_000),
        },
      ],
      session_boot_at: offsetIso(now, -8 * 3600_000),
      recent: [],
    },
    mods_light: {
      updated_at: offsetIso(now, -2 * 60_000),
      trigger: 'jar_change',
      client_only_mods: [
        {
          mod_id: 'iris',
          display_name: 'Iris',
          version: '1.7.5+1.21.1',
          bucket: 'likely_removable',
          confidence: 'high',
          reason: 'Known client-only shader mod',
          removal_advice: 'Remove from the dedicated server mods folder.',
        },
        {
          mod_id: 'oculus',
          display_name: 'Oculus',
          version: '1.8.0',
          bucket: 'likely_removable',
          confidence: 'high',
          reason: 'Client rendering / shaders — not needed on a dedicated server',
          removal_advice: 'Safe to remove from server mods/.',
        },
      ],
      client_only_mods_summary: {
        detected: 2,
        likely_removable_count: 2,
        test_remove_count: 0,
        client_warning_count: 0,
      },
    },
    issues_live: [
      {
        id: 'BACKUP_VERIFY_FAILED',
        key: 'BACKUP_VERIFY_FAILED',
        severity: 'warning',
        status: 'open',
        first_seen: offsetIso(now, -6 * 60_000),
        last_seen: offsetIso(now, -6 * 60_000),
        evidence_fingerprint: 'backup:verify:suspicious',
        source: 'ops',
        message:
          'Newest backup failed integrity check (suspicious): /srv/backups/minecraft/2026-06-23_08-00-00.zip',
        evidence_refs: ['ops:backups_live'],
        fix_steps: [
          'Open Backups and check the integrity chip on the newest archive.',
          'Run Verify now — if it still fails, take a fresh backup before relying on restore.',
          'Do not treat a suspicious archive as a recovery plan until a light verify (or test restore) passes.',
        ],
      },
      {
        id: 'EXTERNAL_KILL:oom',
        key: 'EXTERNAL_KILL:oom',
        severity: 'warning',
        status: 'open',
        first_seen: offsetIso(now, -5 * 60_000),
        last_seen: offsetIso(now, -5 * 60_000),
        evidence_fingerprint: 'external_kill:oom',
        source: 'ops',
        message: 'Killed by the OS out-of-memory killer',
        evidence_refs: ['ops:external_kill'],
        fix_steps: [
          'The server process was killed by the OS or container out-of-memory killer — nothing in Minecraft crashed.',
          'Raise the container / host memory limit, or lower -Xmx so the JVM fits under the limit.',
          'Open Insights → Configs for the RAM sizing advisor before changing flags.',
        ],
      },
      {
        id: `MOD_JAR_DRIFT:${inventoryDiff.drift?.[0]?.jar || 'create-addons-extra-1.0.0.jar'}`,
        key: `MOD_JAR_DRIFT:${inventoryDiff.drift?.[0]?.jar || 'create-addons-extra-1.0.0.jar'}`,
        severity: 'warning',
        status: 'open',
        first_seen: offsetIso(now, -2 * 60_000),
        last_seen: offsetIso(now, -2 * 60_000),
        evidence_fingerprint: `mod_drift:${inventoryDiff.drift?.[0]?.jar || 'create-addons-extra-1.0.0.jar'}`,
        source: 'ops',
        message: `\`${inventoryDiff.drift?.[0]?.jar || 'create-addons-extra-1.0.0.jar'}\` changed without a version bump — verify this was intentional.`,
        evidence_refs: ['ops:mods_inventory'],
        fix_steps: [
          'Open Mods → Changes and confirm the jar swap was intentional.',
          'If unexpected, restore the jar from a known-good backup and re-check.',
        ],
      },
      {
        id: 'SILENT_FAIL:kubejs|kubejs/server_scripts/machines.js:42',
        key: 'SILENT_FAIL:kubejs|kubejs/server_scripts/machines.js:42',
        severity: 'warning',
        status: 'open',
        first_seen: offsetIso(now, -3 * 60_000),
        last_seen: offsetIso(now, -3 * 60_000),
        evidence_fingerprint: 'silent_fail:kubejs|kubejs/server_scripts/machines.js:42',
        source: 'ops',
        message: 'KubeJS script error — `kubejs/server_scripts/machines.js:42`',
        evidence_refs: ['ops:silent_fails'],
        fix_steps: [
          'Open the script at the reported path and check the last edited recipe/event handler.',
          "Run /reload (or KubeJS's reload command) after fixing the syntax to confirm it clears.",
        ],
      },
      {
        id: 'SILENT_FAIL:reload_failed|abcdef01',
        key: 'SILENT_FAIL:reload_failed|abcdef01',
        severity: 'info',
        status: 'open',
        first_seen: offsetIso(now, -4 * 60_000),
        last_seen: offsetIso(now, -4 * 60_000),
        evidence_fingerprint: 'silent_fail:reload_failed|abcdef01',
        source: 'ops',
        message: '/reload command failed',
        evidence_refs: ['ops:silent_fails'],
        fix_steps: [
          'Check the log lines immediately above this one for the underlying error.',
          'Fix the reported file, then re-run /reload.',
        ],
      },
      {
        id: 'CLIENT_ON_SERVER:iris',
        key: 'CLIENT_ON_SERVER:iris',
        severity: 'info',
        status: 'open',
        first_seen: offsetIso(now, -2 * 60_000),
        last_seen: offsetIso(now, -2 * 60_000),
        evidence_fingerprint: 'client_on_server:iris',
        source: 'ops',
        message: 'Iris — Known client-only shader mod',
        evidence_refs: ['ops:mods_light'],
        fix_steps: [
          'Open Mods → Overview (Client filter) and confirm this jar is not needed server-side.',
          'Remove from the dedicated server mods folder.',
        ],
      },
      {
        id: 'CLIENT_ON_SERVER:oculus',
        key: 'CLIENT_ON_SERVER:oculus',
        severity: 'info',
        status: 'open',
        first_seen: offsetIso(now, -2 * 60_000),
        last_seen: offsetIso(now, -2 * 60_000),
        evidence_fingerprint: 'client_on_server:oculus',
        source: 'ops',
        message: 'Oculus — Client rendering / shaders — not needed on a dedicated server',
        evidence_refs: ['ops:mods_light'],
        fix_steps: [
          'Open Mods → Overview (Client filter) and confirm this jar is not needed server-side.',
          'Safe to remove from server mods/.',
        ],
      },
      {
        id: 'WORLD_PRESSURE:item_storm:minecraft:overworld',
        key: 'WORLD_PRESSURE:item_storm:minecraft:overworld',
        severity: 'warning',
        status: 'open',
        first_seen: offsetIso(now, -6 * 60_000),
        last_seen: offsetIso(now, -1 * 60_000),
        evidence_fingerprint: 'world_pressure:item_storm:minecraft:overworld',
        source: 'ops',
        message:
          'Item storm in Overworld — 2,200 item entities in Overworld — 43% of entities there; total load is 2.8x quiet-hours normal.',
        evidence_refs: ['ops:world_pressure'],
        fix_steps: [
          'Fly to the busiest chunks in Overworld and check hoppers/void filters on item farms',
          'Look for broken item vacuum or overflow near forced chunks',
          'Capture a Spark profile and open World → busy chunks for a precise hotspot',
        ],
      },
      {
        id: 'JOIN_SYNC:mismatched_channel|NotchFan42|create,flywheel',
        key: 'JOIN_SYNC:mismatched_channel|NotchFan42|create,flywheel',
        severity: 'warning',
        status: 'open',
        first_seen: offsetIso(now, -18 * 60_000),
        last_seen: offsetIso(now, -6 * 60_000),
        evidence_fingerprint: 'join_sync:mismatched_channel|NotchFan42|create,flywheel',
        source: 'ops',
        message: "NotchFan42 can't join — create, flywheel (mismatched channels)",
        evidence_refs: ['ops:join_clinic'],
        fix_steps: [
          'Install/update the listed mods on the client to match the server.',
          'Remove client mods that register network channels the server does not have.',
          'Open Session → Join clinic and Copy fix for a player-safe list.',
        ],
      },
      {
        id: 'JOIN_SYNC:missing_mod|BuilderBob|jei,farmersdelight',
        key: 'JOIN_SYNC:missing_mod|BuilderBob|jei,farmersdelight',
        severity: 'warning',
        status: 'open',
        first_seen: offsetIso(now, -45 * 60_000),
        last_seen: offsetIso(now, -12 * 60_000),
        evidence_fingerprint: 'join_sync:missing_mod|BuilderBob|jei,farmersdelight',
        source: 'ops',
        message: "BuilderBob can't join — jei, farmersdelight (missing mods)",
        evidence_refs: ['ops:join_clinic'],
        fix_steps: [
          'Install the missing mod(s) on the client (same version as the server).',
          'Open Session → Join clinic and Copy fix for a player-safe list.',
        ],
      },
      {
        id: 'JOIN_SYNC:wrong_version|FridayGuest|supplementaries',
        key: 'JOIN_SYNC:wrong_version|FridayGuest|supplementaries',
        severity: 'warning',
        status: 'open',
        first_seen: offsetIso(now, -95 * 60_000),
        last_seen: offsetIso(now, -25 * 60_000),
        evidence_fingerprint: 'join_sync:wrong_version|FridayGuest|supplementaries',
        source: 'ops',
        message: "FridayGuest can't join — supplementaries (wrong mod versions)",
        evidence_refs: ['ops:join_clinic'],
        fix_steps: [
          'Update the named mod(s) on the client to the server\'s version.',
          'Open Session → Join clinic and Copy fix for a player-safe list.',
        ],
      },
    ],
    join_clinic: {
      scanned_at: offsetIso(now, 0),
      new_count: 3,
      entries: [
        {
          key: 'mismatched_channel|NotchFan42|create,flywheel',
          kind: 'mismatched_channel',
          platform: 'neoforge',
          player: 'NotchFan42',
          time: offsetIso(now, -6 * 60_000),
          confidence: 'high',
          reason:
            'Failed to connect to server: Incompatible mod set: mismatched channels: [create:main, flywheel:network]',
          sample_line:
            'NotchFan42 lost connection: Failed to connect to server: Incompatible mod set: mismatched channels: [create:main, flywheel:network]',
          missing: [
            { mod_id: 'create', server_version: '6.0.4', display_name: 'Create' },
            { mod_id: 'flywheel', server_version: '1.0.2', display_name: 'Flywheel' },
          ],
          extra: [],
          wrong_version: [],
          suppressed_client_only: [],
          vs_known_good: false,
          fix_copy:
            'Hey NotchFan42 — the server rejected your join (mismatched channels).\n\nInstall/update on your client:\n- create (server has 6.0.4)\n- flywheel (server has 1.0.2)\n\nAsk the admin if you need the pack download.',
        },
        {
          key: 'missing_mod|BuilderBob|jei,farmersdelight',
          kind: 'missing_mod',
          platform: 'neoforge',
          player: 'BuilderBob',
          time: offsetIso(now, -12 * 60_000),
          confidence: 'high',
          reason: 'Mod Rejection: Missing required mods: [jei, farmersdelight]',
          sample_line:
            'BuilderBob lost connection: Mod Rejection: Missing required mods: [jei, farmersdelight]',
          missing: [
            { mod_id: 'jei', server_version: '19.21.0', display_name: 'Just Enough Items' },
            { mod_id: 'farmersdelight', server_version: '1.2.7', display_name: "Farmer's Delight" },
          ],
          extra: [],
          wrong_version: [],
          suppressed_client_only: [],
          vs_known_good: false,
          fix_copy:
            "Hey BuilderBob — the server rejected your join (missing mods).\n\nInstall/update on your client:\n- jei (server has 19.21.0)\n- farmersdelight (server has 1.2.7)\n\nAsk the admin if you need the pack download.",
        },
        {
          key: 'wrong_version|FridayGuest|supplementaries',
          kind: 'wrong_version',
          platform: 'neoforge',
          player: 'FridayGuest',
          time: offsetIso(now, -25 * 60_000),
          confidence: 'high',
          reason:
            'Incompatible client: Mod mismatch: supplementaries@3.1.14 required, client has 3.0.9',
          sample_line:
            'FridayGuest lost connection: Incompatible client: Mod mismatch: supplementaries@3.1.14 required, client has 3.0.9',
          missing: [],
          extra: [],
          wrong_version: [
            {
              mod_id: 'supplementaries',
              server_version: '3.1.14',
              client_version: '3.0.9',
              display_name: 'Supplementaries',
            },
          ],
          suppressed_client_only: [],
          vs_known_good: true,
          fix_copy:
            'Hey FridayGuest — the server rejected your join (wrong mod versions).\n\nInstall/update on your client:\n- supplementaries → need 3.1.14 (you have 3.0.9)\n\nNote: server jars have drifted since the last baseline — confirm the pack pin with an admin.\n\nAsk the admin if you need the pack download.',
        },
        {
          key: 'mismatched_channel|Alex|create',
          kind: 'mismatched_channel',
          platform: 'neoforge',
          player: 'Alex',
          time: offsetIso(now, -78 * 60_000),
          confidence: 'high',
          reason: 'Incompatible mod set: mismatched channels: [create:main]',
          sample_line:
            'Alex lost connection: Failed to connect to server: Incompatible mod set: mismatched channels: [create:main]',
          missing: [{ mod_id: 'create', server_version: '6.0.4', display_name: 'Create' }],
          extra: [{ mod_id: 'sodiumextras' }],
          wrong_version: [],
          suppressed_client_only: [
            { mod_id: 'modmenu', bucket: 'likely_removable' },
          ],
          vs_known_good: false,
          fix_copy:
            'Hey Alex — the server rejected your join (mismatched channels).\n\nInstall/update on your client:\n- create (server has 6.0.4)\n\nRemove these client-only extras (not on the server):\n- sodiumextras\n\nAsk the admin if you need the pack download.',
        },
        {
          key: 'missing_mod|Steve|jei',
          kind: 'missing_mod',
          platform: 'neoforge',
          player: 'Steve',
          time: offsetIso(now, -140 * 60_000),
          confidence: 'high',
          reason: 'Mod Rejection: Missing required mods: [jei]',
          sample_line: 'Steve lost connection: Mod Rejection: Missing required mods: [jei]',
          missing: [
            { mod_id: 'jei', server_version: '19.21.0', display_name: 'Just Enough Items' },
          ],
          extra: [],
          wrong_version: [],
          suppressed_client_only: [],
          vs_known_good: false,
          fix_copy:
            'Hey Steve — the server rejected your join (missing mods).\n\nInstall/update on your client:\n- jei (server has 19.21.0)\n\nAsk the admin if you need the pack download.',
        },
      ],
    },
    world_pressure: {
      scanned_at: offsetIso(now, 0),
      census_at: offsetIso(now, -2_000),
      learning: false,
      correlated_with_mspt: true,
      correlation: {
        high_entity_mspt_p95: 58.4,
        low_entity_mspt_p95: 24.1,
        ratio: 2.4,
        minutes: 420,
        correlated: true,
      },
      // Story: quiet night (1 player exploring Nether). Overworld farm hub stays awake almost
      // entirely from spawn tickets + /forceload + NeoForge mod force-loads (small leftover =
      // other DistanceManager tickets). Mining is nearly all Create-style mod loaders (flag demo).
      // Overworld entities sit between busy p95 (4200) and 7d peak (5800) so the alert bars read as a storm.
      // Totals: 5800 entities, 688 chunks. Quiet ~1800 / busy ~4200 / peak ~5800 entities.
      dimensions: [
        {
          id: 'minecraft:overworld',
          label: 'Overworld',
          entities: 5100,
          items: 2200,
          living: 2600,
          // spawnChunkRadius 4 → 9×9 = 81; farm /forceload ring; Create loaders around base
          loaded_chunks: 312,
          spawn_chunks: 81,
          forced_chunks: 24,
          mod_forced_chunks: 168,
          players: 0,
          unattended: true,
          top_types: [
            { type: 'minecraft:item', count: 2200 },
            { type: 'minecraft:cow', count: 850 },
            { type: 'minecraft:chicken', count: 500 },
            { type: 'minecraft:zombie', count: 380 },
          ],
          baseline: {
            entities_p50: 1400,
            entities_p95: 1800,
            chunks_p95: 700,
            sample_minutes: 640,
          },
        },
        {
          id: 'create:mining',
          label: 'Mining',
          entities: 420,
          items: 25,
          living: 380,
          // Empty of players; almost everything held by NeoForge force-load tickets
          loaded_chunks: 280,
          spawn_chunks: 0,
          forced_chunks: 8,
          mod_forced_chunks: 240,
          players: 0,
          unattended: true,
          top_types: [
            { type: 'minecraft:zombie', count: 180 },
            { type: 'minecraft:bat', count: 95 },
            { type: 'minecraft:skeleton', count: 70 },
            { type: 'minecraft:item', count: 25 },
          ],
          baseline: {
            entities_p50: 1400,
            entities_p95: 1800,
            chunks_p95: 700,
            sample_minutes: 640,
          },
        },
        {
          id: 'minecraft:the_nether',
          label: 'Nether',
          entities: 280,
          items: 8,
          living: 250,
          // One player → most of loaded is player view/simulation (not in the three buckets)
          loaded_chunks: 96,
          spawn_chunks: 0,
          forced_chunks: 2,
          mod_forced_chunks: 6,
          players: 1,
          unattended: false,
          top_types: [
            { type: 'minecraft:piglin', count: 90 },
            { type: 'minecraft:zombified_piglin', count: 70 },
            { type: 'minecraft:magma_cube', count: 28 },
            { type: 'minecraft:ghast', count: 6 },
          ],
          baseline: {
            entities_p50: 1400,
            entities_p95: 1800,
            chunks_p95: 700,
            sample_minutes: 640,
          },
        },
      ],
      classifiers: [
        {
          kind: 'item_storm',
          dimension: 'minecraft:overworld',
          severity: 'warning',
          sustained_scans: 4,
          first_seen: offsetIso(now, -6 * 60_000),
          last_seen: offsetIso(now, -1 * 60_000),
          headline: 'Item storm in Overworld',
          detail:
            '2,200 item entities in Overworld — 43% of entities there; total load is 2.8x quiet-hours normal.',
          evidence: {
            items: 2200,
            entities: 5100,
            loaded_chunks: 312,
            forced_chunks: 24,
            spawn_chunks: 81,
            mod_forced_chunks: 168,
          },
          next_steps: [
            'Fly to the busiest chunks in Overworld and check hoppers/void filters on item farms',
            'Look for broken item vacuum or overflow near forced chunks',
            'Capture a Spark profile and open World → busy chunks for a precise hotspot',
          ],
        },
      ],
      streaks: {
        'item_storm:minecraft:overworld': 4,
      },
    },
  };
}

function generateWeeklyDigest(now) {
  const week = 7 * 24 * 3600_000;
  const entries = [
    {
      id: `digest-${new Date(now).toISOString().slice(0, 10)}`,
      generated_at: offsetIso(now, 0),
      trigger: 'auto',
      window_days: 7,
      period_start: offsetIso(now, -week),
      period_end: offsetIso(now, 0),
      grade: 'healthy',
      grade_word: 'Healthy',
      grade_prev: 'degraded',
      grade_trend: 'improved',
      crashes: { count: 1, top_mod_id: 'create', top_mod_count: 1 },
      disk: { use_pct: 48.2, growth_gb_7d_est: 8.4, days_until_full: 210.5 },
      performance: {
        trend: 'better',
        mspt_avg: 38.1,
        mspt_avg_prior: 45.2,
        mspt_delta_pct: -15.7,
        low_tps_minutes: 18,
        low_tps_minutes_prior: 48,
        sample_minutes: 9840,
        sample_minutes_prior: 9700,
      },
      mods: { added: 1, removed: 0, changed: 2 },
      top_action: {
        code: 'CANT_KEEP_UP',
        severity: 'warning',
        message: "Can't keep up! appeared 3 times in the lookback window.",
        tab_link: 'issues',
      },
      summary:
        "This week: grade Healthy, 1 crash (create), disk ≈+8.4 GB, MSPT down 16% vs last week. Do this next: Can't keep up! appeared 3 times in the lookback window.",
    },
    {
      id: `digest-${new Date(now - week).toISOString().slice(0, 10)}`,
      generated_at: offsetIso(now, -week),
      trigger: 'auto',
      window_days: 7,
      period_start: offsetIso(now, -2 * week),
      period_end: offsetIso(now, -week),
      grade: 'degraded',
      grade_word: 'Degraded',
      grade_prev: 'healthy',
      grade_trend: 'worse',
      crashes: { count: 2, top_mod_id: 'create', top_mod_count: 2 },
      disk: { use_pct: 45.0, growth_gb_7d_est: 14.7, days_until_full: 173.5 },
      performance: {
        trend: 'worse',
        mspt_avg: 45.2,
        mspt_avg_prior: 38.1,
        mspt_delta_pct: 18.6,
        low_tps_minutes: 48,
        low_tps_minutes_prior: 31,
        sample_minutes: 9700,
        sample_minutes_prior: 9600,
      },
      mods: { added: 3, removed: 2, changed: 4 },
      top_action: {
        code: 'CANT_KEEP_UP',
        severity: 'warning',
        message: "Can't keep up! appeared 3 times in the lookback window.",
        tab_link: 'issues',
      },
      summary:
        "This week: grade Degraded, 2 crashes (both create), disk ≈+14.7 GB, MSPT up 19% vs last week. Do this next: Can't keep up! appeared 3 times in the lookback window.",
    },
    {
      id: `digest-${new Date(now - 2 * week).toISOString().slice(0, 10)}`,
      generated_at: offsetIso(now, -2 * week),
      trigger: 'auto',
      window_days: 7,
      period_start: offsetIso(now, -3 * week),
      period_end: offsetIso(now, -2 * week),
      grade: 'healthy',
      grade_word: 'Healthy',
      grade_trend: 'unknown',
      crashes: { count: 0 },
      disk: { use_pct: 42.0, growth_gb_7d_est: 3.2, days_until_full: 280.0 },
      performance: {
        trend: 'steady',
        mspt_avg: 38.1,
        mspt_avg_prior: 37.5,
        mspt_delta_pct: 1.6,
        low_tps_minutes: 12,
        low_tps_minutes_prior: 10,
        sample_minutes: 9600,
        sample_minutes_prior: 9500,
      },
      mods: { added: 0, removed: 0, changed: 1 },
      top_action: null,
      summary: 'This week: grade Healthy, 0 crashes, disk ≈+3.2 GB, MSPT steady.',
    },
  ];
  return {
    updated_at: offsetIso(now, 0),
    history: entries,
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
    version: '1.2.0-beta.1',
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
    safe_restart: {
      verdict: 'caution',
      headline: 'Restart with caution',
      summary: 'Players online and pregen active — wait for a quieter window if you can.',
      reasons: [
        { label: 'Players online', detail: '2 players connected', tab: 'live' },
        { label: 'Pregen running', detail: 'Chunky overworld ~44%', tab: 'insights' },
      ],
    },
    restart_hygiene: (() => {
      // Next quiet window: tomorrow 03:00-05:00 UTC (canonical; UI localizes).
      const start = new Date(now);
      start.setUTCDate(start.getUTCDate() + 1);
      start.setUTCHours(3, 0, 0, 0);
      const end = new Date(start.getTime() + 2 * 3600_000);
      return {
        active: true,
        severity: 'info',
        headline: 'Consider a maintenance restart',
        uptime_sec: 38 * 3600,
        signals: [
          { id: 'gc_rising', current: 4.2, prior: 2.8, delta_pct: 50.0 },
          { id: 'heap_stable', current: 71.0, prior: 69.0 },
        ],
        quiet_window: {
          next_start_at: start.toISOString().replace(/\.\d{3}Z$/, 'Z'),
          next_end_at: end.toISOString().replace(/\.\d{3}Z$/, 'Z'),
          avg_players: 0.2,
          avg_mspt: 24.0,
          sample_minutes: 42,
        },
        checked_at: isoAt(now),
      };
    })(),
  };
}

const now = Date.now();
const liveBundle = generateLiveBundle(now);
const samples = liveBundle.series;
const bandwidthHistory = liveBundle.bandwidth;
const diskIoHistory = liveBundle.diskIo;
const lastSnap = liveBundle.bandwidth.length
  ? {
      entities: liveBundle.state.entities,
      chunks: liveBundle.state.chunks,
      thermal_c: liveBundle.state.thermalC,
    }
  : null;
const latest = latestFromSamples(samples, now, lastSnap);
const lastDiskIo = diskIoHistory[diskIoHistory.length - 1];
const lastBw = bandwidthHistory[bandwidthHistory.length - 1];
const performanceRollups = generatePerformanceRollups(now, { hours: 24, stepSec: 60 });
const performanceRollups7d = generatePerformanceRollups(now, { hours: 168, stepSec: 60 });
const performanceRollups30d = generatePerformanceRollups(now, { hours: 720, stepSec: 300 });
const cpuCores = generateCpuCores(8, latest.host_cpu_pct);
const byDimension = generateByDimension();
const byLogs = generateByLogs();
const byOther = generateByOther();
const byMods = generateByMods();

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

const packageC = round1(lastSnap?.thermal_c ?? 58);
const envelope = {
  latest,
  chunky_pregen: chunkyPregenMock(now),
  thermal: {
    available: true,
    package_c: packageC,
    ambient_c: 32,
    zones: [
      { id: 'tctl', label: 'Package', c: packageC },
      { id: 'core0', label: 'CPU Core 0', c: round1(packageC - 3 + gauss() * 1.5) },
      { id: 'core1', label: 'CPU Core 1', c: round1(packageC - 4 + gauss() * 1.5) },
      { id: 'core2', label: 'CPU Core 2', c: round1(packageC - 2 + gauss() * 1.5) },
      { id: 'core3', label: 'CPU Core 3', c: round1(packageC - 5 + gauss() * 1.5) },
      { id: 'core4', label: 'CPU Core 4', c: round1(packageC - 6 + gauss() * 1.5) },
      { id: 'core5', label: 'CPU Core 5', c: round1(packageC - 3.5 + gauss() * 1.5) },
      { id: 'core6', label: 'CPU Core 6', c: round1(packageC - 7 + gauss() * 1.5) },
      { id: 'core7', label: 'CPU Core 7', c: round1(packageC - 8 + gauss() * 1.5) },
      { id: 'nvme', label: 'NVMe', c: round1(42 + latest.host_cpu_pct * 0.05) },
      { id: 'ambient', label: 'Ambient', c: 32 },
    ],
  },
  bandwidth: {
    interface: 'eth0',
    rx_mbps: lastBw.rx,
    tx_mbps: lastBw.tx,
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
    mods_gb: 1.2,
    logs_gb: 0.4,
    total_gb: 22.1,
    delta_mb_24h: 128,
    by_dimension: byDimension,
    by_logs: byLogs,
    by_other: byOther,
    by_mods: byMods,
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
      tps_samples: sample(10, 16, 3),
      mspt_samples: sample(10, 55, 15),
      events: [{ t: offsetIso(Date.now(), -50 * 60_000), type: 'mod_runtime', detail: 'Create contraption NPE (mf.axis)' }],
    },
    'crash-2026-07-10_19-04-12-server.txt': {
      window_minutes: 10,
      tps_samples: sample(10, 18, 2),
      mspt_samples: sample(10, 40, 10),
      events: [{ t: offsetIso(Date.now(), -6 * 3600_000), type: 'mod_runtime', detail: 'Create BeltBlockEntity NPE (generic)' }],
    },
    'crash-2026-06-18_08-12-44-server.txt': {
      window_minutes: 10,
      tps_samples: sample(10, 12, 4),
      mspt_samples: sample(10, 85, 20),
      events: [{ t: offsetIso(Date.now(), -15 * 60_000), type: 'watchdog', detail: 'Server hung on main thread' }],
    },
    'crash-2026-06-18_08-13-50-server.txt': {
      window_minutes: 10,
      tps_samples: sample(10, 11, 4),
      mspt_samples: sample(10, 90, 22),
      events: [{ t: offsetIso(Date.now(), -14 * 60_000), type: 'watchdog', detail: 'Follow-up watchdog after primary hang' }],
    },
    'crash-2026-06-19_11-02-18-server.txt': {
      window_minutes: 10,
      tps_samples: sample(10, 10, 5),
      mspt_samples: sample(10, 95, 25),
      events: [{ t: offsetIso(Date.now(), -2 * 3600_000), type: 'watchdog', detail: 'Chunky pregen stall' }],
    },
    'crash-2026-07-11_02-15-33-server.txt': {
      window_minutes: 10,
      tps_samples: sample(10, 19, 1),
      mspt_samples: sample(10, 30, 8),
      events: [{ t: offsetIso(Date.now(), -18 * 3600_000), type: 'world_nbt', detail: 'ZLIB EOF while reading region' }],
    },
    'crash-2026-07-09_21-48-01-server.txt': {
      window_minutes: 10,
      tps_samples: sample(10, 20, 0),
      mspt_samples: sample(10, 5, 1),
      events: [{ t: offsetIso(Date.now(), -2 * 24 * 3600_000), type: 'mod_load_mixin', detail: 'create.mixins.json init failed' }],
    },
    'crash-2026-07-06_09-33-12-server.txt': {
      window_minutes: 10,
      tps_samples: sample(10, 20, 0),
      mspt_samples: sample(10, 5, 1),
      events: [{ t: offsetIso(Date.now(), -5 * 24 * 3600_000), type: 'mod_load_mixin_conflict', detail: 'create vs createaddition mixin target' }],
    },
    'crash-2026-07-05_14-01-55-server.txt': {
      window_minutes: 10,
      tps_samples: sample(10, 20, 0),
      mspt_samples: sample(10, 5, 1),
      events: [{ t: offsetIso(Date.now(), -6 * 24 * 3600_000), type: 'mod_load_duplicate', detail: 'create jar listed twice' }],
    },
    'crash-2026-07-08_16-22-44-server.txt': {
      window_minutes: 10,
      tps_samples: sample(10, 20, 0),
      mspt_samples: sample(10, 5, 1),
      events: [{ t: offsetIso(Date.now(), -3 * 24 * 3600_000), type: 'platform_mismatch', detail: 'LuckPerms class file 65 vs runtime 61' }],
    },
    'crash-2026-07-04_20-44-08-server.txt': {
      window_minutes: 10,
      tps_samples: sample(10, 20, 0),
      mspt_samples: sample(10, 5, 1),
      events: [{ t: offsetIso(Date.now(), -7 * 24 * 3600_000), type: 'env_lock', detail: 'session.lock held by another process' }],
    },
    'crash-2026-07-07_11-05-19-server.txt': {
      window_minutes: 10,
      tps_samples: sample(10, 8, 3),
      mspt_samples: sample(10, 120, 30),
      events: [{ t: offsetIso(Date.now(), -4 * 24 * 3600_000), type: 'oom', detail: 'Java heap space' }],
    },
    'crash-2026-06-17_22-18-11-server.txt': {
      window_minutes: 10,
      tps_samples: sample(10, 19.8, 0.5),
      mspt_samples: sample(10, 22, 5),
      events: [{ t: offsetIso(Date.now(), -20 * 60_000), type: 'mod_runtime', detail: 'examplemod tick NPE (reviewed)' }],
    },
  };
  writeFileSync(join(dataDir, 'crash-contexts.json'), `${JSON.stringify(contexts, null, 2)}\n`);
}

/** Minimal crash-report text so Logs / Crashes "view report" works in preview. */
function writeCrashReportFixtures() {
  const dir = join(dataDir, 'crash-reports');
  mkdirSync(dir, { recursive: true });
  const reports = {
    'crash-2026-06-22_14-33-07-server.txt': [
      '---- Minecraft Crash Report ----',
      'Time: 2026-06-22 14:33:07',
      'Description: Exception in server tick loop',
      '',
      'java.lang.NullPointerException: Cannot invoke "ContraptionCollision.mf()" because "mf.axis" is null',
      '\tat TRANSFORMER/create@6.0.0/com.simibubi.create.content.contraptions.ContraptionCollision.tick(ContraptionCollision.java:118)',
      '\tat net.minecraft.server.MinecraftServer.tickServer(MinecraftServer.java:917)',
      '',
      '-- System Details --',
      '\tMod List:',
      '\t\tcreate-6.0.0.jar |Create |create |6.0.0 |DONE |',
      '',
    ].join('\n'),
    'crash-2026-07-10_19-04-12-server.txt': [
      '---- Minecraft Crash Report ----',
      'Time: 2026-07-10 19:04:12',
      'Description: Exception in server tick loop',
      '',
      'java.lang.NullPointerException: Cannot invoke "BeltBlockEntity.getSpeed()"',
      '\tat TRANSFORMER/create@6.0.0/com.simibubi.create.content.kinetics.belt.BeltBlockEntity.tick(BeltBlockEntity.java:204)',
      '',
    ].join('\n'),
    'crash-2026-06-18_08-12-44-server.txt': [
      '---- Minecraft Crash Report ----',
      'Time: 2026-06-18 08:12:44',
      'Description: Watching Server',
      '',
      'java.lang.Error: ServerHangWatchdog detected that a single server tick took 60.00 seconds (should be max 0.05)',
      '\tat net.minecraft.server.dedicated.ServerHangWatchdog.run(ServerHangWatchdog.java:52)',
      '',
    ].join('\n'),
    'crash-2026-06-18_08-13-50-server.txt': [
      '---- Minecraft Crash Report ----',
      'Time: 2026-06-18 08:13:50',
      'Description: Watching Server',
      '',
      'java.lang.Error: ServerHangWatchdog detected that a single server tick took 60.00 seconds (should be max 0.05)',
      '',
    ].join('\n'),
    'crash-2026-06-19_11-02-18-server.txt': [
      '---- Minecraft Crash Report ----',
      'Time: 2026-06-19 11:02:18',
      'Description: Watching Server',
      '',
      'java.lang.Error: ServerHangWatchdog detected that a single server tick took 60.00 seconds (should be max 0.05)',
      '\tat TRANSFORMER/chunky@1.4/org.popcraft.chunky.ChunkyTask.run(ChunkyTask.java:88)',
      '',
    ].join('\n'),
    'crash-2026-07-11_02-15-33-server.txt': [
      '---- Minecraft Crash Report ----',
      'Time: 2026-07-11 02:15:33',
      'Description: Exception generating new chunk',
      '',
      'java.io.EOFException: Unexpected end of ZLIB input stream',
      '\tat java.base/java.util.zip.InflaterInputStream.fill(InflaterInputStream.java:255)',
      '',
    ].join('\n'),
    'crash-2026-07-09_21-48-01-server.txt': [
      '---- Minecraft Crash Report ----',
      'Time: 2026-07-09 21:48:01',
      'Description: Mod loading has failed',
      '',
      'org.spongepowered.asm.mixin.throwables.MixinInitialisationError: Error initialising mixin config create.mixins.json',
      '',
    ].join('\n'),
    'crash-2026-07-06_09-33-12-server.txt': [
      '---- Minecraft Crash Report ----',
      'Time: 2026-07-06 09:33:12',
      'Description: Mod loading has failed',
      '',
      'org.spongepowered.asm.mixin.transformer.throwables.InvalidMixinException: @Overwrite conflict createaddition → create',
      '',
    ].join('\n'),
    'crash-2026-07-05_14-01-55-server.txt': [
      '---- Minecraft Crash Report ----',
      'Time: 2026-07-05 14:01:55',
      'Description: Mod loading has failed',
      '',
      'net.neoforged.fml.ModLoadingException: Duplicate mods found: create',
      '\tFound jars: create-6.0.0.jar, create-6.0.0-copy.jar',
      '',
    ].join('\n'),
    'crash-2026-07-08_16-22-44-server.txt': [
      '---- Minecraft Crash Report ----',
      'Time: 2026-07-08 16:22:44',
      'Description: Initializing game',
      '',
      'java.lang.UnsupportedClassVersionError: me/lucko/luckperms/common/plugin/AbstractLuckPermsPlugin has been compiled by a more recent version of the Java Runtime (class file version 65.0), this version of the Java Runtime only recognizes class file versions up to 61.0',
      '',
    ].join('\n'),
    'crash-2026-07-04_20-44-08-server.txt': [
      '---- Minecraft Crash Report ----',
      'Time: 2026-07-04 20:44:08',
      'Description: Exception in server tick loop',
      '',
      'java.nio.file.FileSystemException: world/session.lock: The process cannot access the file because it is being used by another process',
      '',
    ].join('\n'),
    'crash-2026-07-07_11-05-19-server.txt': [
      '---- Minecraft Crash Report ----',
      'Time: 2026-07-07 11:05:19',
      'Description: Exception in server tick loop',
      '',
      'java.lang.OutOfMemoryError: Java heap space',
      '',
    ].join('\n'),
    'crash-2026-06-17_22-18-11-server.txt': [
      '---- Minecraft Crash Report ----',
      'Time: 2026-06-17 22:18:11',
      'Description: Exception in server tick loop',
      '',
      'java.lang.NullPointerException: Cannot invoke "examplemod.TickHandler.onTick()" because "this.handler" is null',
      '\tat TRANSFORMER/examplemod@1.0.0/examplemod.ExampleMod.onServerTick(ExampleMod.java:42)',
      '',
    ].join('\n'),
  };
  for (const [name, body] of Object.entries(reports)) {
    writeFileSync(join(dir, name), body);
  }
}

function patchFactsModFixtures() {
  const factsPath = join(dataDir, 'facts.json');
  const facts = JSON.parse(readFileSync(factsPath, 'utf8'));
  if (!facts.optional) facts.optional = {};
  facts.optional.mods = mockReportMods();
  facts.optional.mod_log_errors = mockModLogErrors(Date.now()).map(({ source, last_seen_epoch, ...rest }) => rest);
  facts.optional.mod_recommendations = MOCK_MOD_RECOMMENDATIONS;
  facts.optional.client_only_mods = MOCK_CLIENT_ONLY_MODS;
  facts.optional.client_only_mods_summary = MOCK_CLIENT_ONLY_SUMMARY;
  facts.optional.startup_profile = {
    total_sec: 142.3,
    done_at: offsetIso(Date.now(), -3 * 3600_000),
    status: 'warnings',
    phases: [
      { id: 'registry', label: 'Registry freeze', sec: 38.1 },
      { id: 'datapack', label: 'Datapack load', sec: 22.0 },
      { id: 'mod_init', label: 'Mod initialization', sec: 41.5 },
      { id: 'world_load', label: 'World load', sec: 28.4 },
    ],
    slowest: [
      { phase: 'mod_init', sec: 41.5 },
      { phase: 'registry', sec: 38.1 },
      { phase: 'world_load', sec: 28.4 },
    ],
    warnings: [
      { id: 'loot_parse', count: 12 },
      { id: 'recipe_missing', count: 3 },
    ],
    errors: [
      { mod_id: 'pride', kind: 'mod_corrupt', blocking: false },
      { mod_id: 'examplemod', kind: 'mod_runtime', blocking: false },
    ],
    compare_to_last_boot: { delta_sec: 12.4, direction: 'slower' },
    boot_history: mockBootHistory(Date.now()),
  };
  facts.optional.fml_issues = [
    {
      mod_id: 'create',
      kind: 'mod_load_dependency',
      message: 'Missing dependency: flywheel',
      file: 'create-1.21.1.jar',
    },
    {
      mod_id: 'kubejs',
      kind: 'mod_load_script',
      message: 'Script error in server_scripts/recipes.js',
      file: 'kubejs-neoforge-1.21.1.jar',
    },
    {
      mod_id: 'ae2',
      kind: 'mod_load_failed',
      message: 'Failed to load channel registry',
      file: 'appliedenergistics2-1.21.1.jar',
    },
  ];
  const nowMs = Date.now();
  const watchdogBase = {
    failure_kind: 'watchdog_pregen',
    primary_mod_id: 'chunky',
    stall_mod_id: 'chunky',
    category: 'host_resource',
    exception: 'java.lang.Error: ServerHangWatchdog detected that a single server tick took 60.00 seconds',
    likely_cause: 'Tick hang / pregen contention',
    confidence: 'high',
    manual_review: false,
    watchdog_tick_ms: 60000,
    plain_english: 'Server tick hang — chunky blocked while Chunky pregen was active (~60s). Pause pregen or defer map render.',
    fix_hints: [
      'Pause Chunky / map pregen or reduce radius before changing RAM or other settings.',
      'Defer chunky full render until pregen completes.',
      'Restart the server and watch MSPT before re-enabling pregen.',
    ],
  };
  facts.optional.crash_summaries = [
    {
      file: 'crash-2026-06-22_14-33-07-server.txt',
      time: offsetIso(nowMs, -45 * 60_000),
      summary: 'Exception in server tick loop',
      display_label: 'java.lang.NullPointerException: Cannot invoke "ContraptionCollision.mf()" because "mf.axis" is null',
      exception: 'java.lang.NullPointerException: Cannot invoke "ContraptionCollision.mf()" because "mf.axis" is null',
      exception_class: 'java.lang.NullPointerException',
      create_issue: 'contraption_collision',
      hot_frame: 'com.simibubi.create.content.contraptions.ContraptionCollision.tick',
      historical: false,
      category: 'mod',
      failure_kind: 'mod_runtime',
      primary_mod_id: 'create',
      suspect_mod_id: 'create',
      matched_rule_id: 'create-contraption-npe',
      matched_pack_id: 'builtin',
      mod_file: 'create-6.0.0.jar',
      stack_frames: [
        'TRANSFORMER/create@6.0.0/com.simibubi.create.content.contraptions.ContraptionCollision.tick',
      ],
      plain_english: 'Create contraption collision (create) — stop the stuck assembly so the world can load, then update Create if needed.',
      likely_cause: 'Mod crash',
      confidence: 'medium',
      manual_review: false,
      fix_hints: [
        'Find the contraption controller / bearing and break it to stop the stuck assembly so the world can load.',
        'Reduce stress or split oversized contraptions near the crash location.',
        'Update Create if a newer NeoForge build exists; check the Create issue tracker for collision NPEs.',
      ],
      mod_fix: {
        action: 'update',
        action_detail: 'Stop the stuck assembly first, then update Create if a fixed NeoForge build is available',
        why: 'Stack evidence shows ContraptionCollision / mf.axis — a proven Create contraption path.',
        install_hint: 'Download a matching Create jar from Modrinth for NeoForge 1.21.1 after the world loads',
      },
      incident_id: 'inc-create-2026-06-22',
    },
    {
      file: 'crash-2026-07-10_19-04-12-server.txt',
      time: offsetIso(nowMs, -6 * 3600_000),
      summary: 'Exception in server tick loop',
      display_label: 'java.lang.NullPointerException: Cannot invoke "BeltBlockEntity.getSpeed()"',
      exception: 'java.lang.NullPointerException: Cannot invoke "BeltBlockEntity.getSpeed()"',
      exception_class: 'java.lang.NullPointerException',
      historical: false,
      category: 'mod',
      failure_kind: 'mod_runtime',
      primary_mod_id: 'create',
      suspect_mod_id: 'create',
      mod_file: 'create-6.0.0.jar',
      stack_frames: [
        'TRANSFORMER/create@6.0.0/com.simibubi.create.content.kinetics.belt.BeltBlockEntity.tick',
      ],
      plain_english: 'Create crashed during play (create) — inspect the stack and update Create or matching addons if versions look wrong.',
      likely_cause: 'Mod crash',
      confidence: 'medium',
      manual_review: false,
      fix_hints: [
        'Inspect the Create stack frames and update matching Create addons if versions look mismatched.',
        'Restart the server and watch for repeats after any jar change.',
      ],
      mod_fix: {
        action: 'update',
        action_detail: 'Update Create for NeoForge 1.21.1 if outdated; align Create addons',
        why: 'Create is on the stack, but there is no contraption/collision evidence — do not assume a stuck assembly.',
      },
    },
    {
      ...watchdogBase,
      file: 'crash-2026-06-18_08-12-44-server.txt',
      time: '2026-06-18T08:12:44+00:00',
      summary: 'Watching Server',
      display_label: watchdogBase.exception,
      historical: false,
      incident_id: 'inc-watchdog-chunky',
    },
    {
      ...watchdogBase,
      file: 'crash-2026-06-18_08-13-50-server.txt',
      time: '2026-06-18T08:13:50+00:00',
      summary: 'Watching Server',
      display_label: watchdogBase.exception,
      historical: false,
      incident_id: 'inc-watchdog-chunky',
      failure_kind: 'watchdog_followup',
      watchdog_followup: true,
      paired_primary_file: 'crash-2026-06-18_08-12-44-server.txt',
    },
    {
      ...watchdogBase,
      file: 'crash-2026-06-19_11-02-18-server.txt',
      time: '2026-06-19T11:02:18+00:00',
      summary: 'Watching Server',
      display_label: watchdogBase.exception,
      historical: false,
    },
    {
      file: 'crash-2026-07-11_02-15-33-server.txt',
      time: offsetIso(nowMs, -18 * 3600_000),
      summary: 'Exception generating new chunk',
      display_label: 'java.io.EOFException: Unexpected end of ZLIB input stream',
      exception: 'java.io.EOFException: Unexpected end of ZLIB input stream',
      exception_class: 'java.io.EOFException',
      historical: false,
      category: 'host_resource',
      failure_kind: 'world_nbt_corrupt',
      primary_mod_id: null,
      plain_english: 'World or chunk NBT data looks corrupt (ZLIB/EOF while loading). Restore the affected region from a backup.',
      likely_cause: 'Corrupt world data',
      confidence: 'high',
      manual_review: false,
      fix_hints: [
        'Back up the world, then restore the affected region/chunk from a known-good backup.',
        'Only delete or repair the bad region file after the backup exists.',
        'Check disk health; ZLIB/EOF errors often mean incomplete writes.',
      ],
    },
    {
      file: 'crash-2026-07-09_21-48-01-server.txt',
      time: offsetIso(nowMs, -2 * 24 * 3600_000),
      summary: 'Mod loading has failed',
      display_label: 'MixinInitialisationError: Error initialising mixin config create.mixins.json',
      exception: 'org.spongepowered.asm.mixin.throwables.MixinInitialisationError',
      exception_class: 'org.spongepowered.asm.mixin.throwables.MixinInitialisationError',
      mixin_config: 'create.mixins.json',
      historical: false,
      category: 'mod',
      failure_kind: 'mod_load_mixin',
      primary_mod_id: 'create',
      suspect_mod_id: 'create',
      plain_english: 'Mixin config create.mixins.json failed while loading mod create — update or remove that mod.',
      likely_cause: 'Mixin failed to load',
      confidence: 'high',
      manual_review: false,
      fix_hints: [
        'Update Create to a build matching NeoForge 1.21.1',
        'If it persists, temporarily remove create.mixins.json owner and retest boot',
      ],
      mod_fix: {
        action: 'update',
        action_detail: 'Update Create (mixin owner) then restart',
        why: 'MixinInitialisationError named create.mixins.json',
      },
    },
    {
      file: 'crash-2026-07-06_09-33-12-server.txt',
      time: offsetIso(nowMs, -5 * 24 * 3600_000),
      summary: 'Mod loading has failed',
      display_label: 'InvalidMixinException: @Overwrite conflict createaddition → create',
      exception: 'org.spongepowered.asm.mixin.transformer.throwables.InvalidMixinException',
      exception_class: 'org.spongepowered.asm.mixin.transformer.throwables.InvalidMixinException',
      mixin_config: 'createaddition.mixins.json',
      historical: false,
      category: 'mod',
      failure_kind: 'mod_load_mixin_conflict',
      primary_mod_id: 'createaddition',
      suspect_mod_id: 'createaddition',
      plain_english: 'Mixin conflict between createaddition and create — update both or remove the addon.',
      likely_cause: 'Mixin overwrite conflict',
      confidence: 'high',
      manual_review: false,
      fix_hints: [
        'Update Create Additions to a build matching Create 6.x',
        'If it persists, temporarily remove createaddition and retest boot',
      ],
      mod_fix: {
        action: 'update',
        action_detail: 'Align Create Additions with Create, or remove the conflicting addon',
        why: 'InvalidMixinException names createaddition overwriting create',
        related_mods: ['create'],
      },
    },
    {
      file: 'crash-2026-07-05_14-01-55-server.txt',
      time: offsetIso(nowMs, -6 * 24 * 3600_000),
      summary: 'Mod loading has failed',
      display_label: 'ModLoadingException: Duplicate mods found: create',
      exception: 'net.neoforged.fml.ModLoadingException: Duplicate mods found: create',
      exception_class: 'net.neoforged.fml.ModLoadingException',
      duplicate_mod_ids: ['create'],
      duplicate_jars: ['create-6.0.0.jar', 'create-6.0.0-copy.jar'],
      historical: false,
      category: 'mod',
      failure_kind: 'mod_load_duplicate',
      primary_mod_id: 'create',
      suspect_mod_id: 'create',
      plain_english: 'Create is installed twice — remove the duplicate jar from mods/.',
      likely_cause: 'Duplicate mod jars',
      confidence: 'high',
      manual_review: false,
      fix_hints: [
        'Remove create-6.0.0-copy.jar (keep one Create jar)',
        'Restart and confirm Mod List shows a single create entry',
      ],
      mod_fix: {
        action: 'remove_duplicate',
        action_detail: 'Delete the extra create jar so only one remains',
        why: 'FML reported duplicate mod id create with two jars',
      },
    },
    {
      file: 'crash-2026-07-08_16-22-44-server.txt',
      time: offsetIso(nowMs, -3 * 24 * 3600_000),
      summary: 'Initializing game',
      display_label: 'java.lang.UnsupportedClassVersionError: me/lucko/luckperms/... class file version 65.0',
      exception: 'java.lang.UnsupportedClassVersionError',
      exception_class: 'java.lang.UnsupportedClassVersionError',
      class_name: 'me/lucko/luckperms/common/plugin/AbstractLuckPermsPlugin',
      owning_jar: 'LuckPerms-NeoForge-5.4.jar',
      compiled_java: 21,
      runtime_java: 17,
      historical: false,
      category: 'loader',
      failure_kind: 'platform_mismatch',
      primary_mod_id: 'luckperms',
      suspect_mod_id: 'luckperms',
      plain_english: 'LuckPerms needs Java 21 but the server runs Java 17 — upgrade the JVM or use an older build.',
      likely_cause: 'Java / class version mismatch',
      confidence: 'high',
      manual_review: false,
      fix_hints: [
        'Upgrade the server JVM to Java 21+ (NeoForge 1.21 expects it). This mod was compiled for Java 21 but the server runs Java 17.',
        'Owning jar: LuckPerms-NeoForge-5.4.jar (luckperms)',
      ],
      mod_fix: {
        action: 'update',
        action_detail: 'Run the server on Java 21, or install a LuckPerms build for Java 17',
        why: 'UnsupportedClassVersionError with owning jar attributed via class index',
      },
    },
    {
      file: 'crash-2026-07-04_20-44-08-server.txt',
      time: offsetIso(nowMs, -7 * 24 * 3600_000),
      summary: 'Exception in server tick loop',
      display_label: 'FileSystemException: world/session.lock is locked',
      exception: 'java.nio.file.FileSystemException: world/session.lock',
      exception_class: 'java.nio.file.FileSystemException',
      locked_path: 'world/session.lock',
      historical: false,
      category: 'host_resource',
      failure_kind: 'env_lock',
      plain_english: 'A file is locked by another Windows process — close other Minecraft/Java instances and retry.',
      likely_cause: 'File in use',
      confidence: 'high',
      manual_review: false,
      fix_hints: [
        'Stop other Java/Minecraft instances (and close Explorer previews / antivirus locks) holding: world/session.lock',
        'Only delete world/session.lock after confirming nothing is using this world folder.',
      ],
    },
    {
      file: 'crash-2026-07-07_11-05-19-server.txt',
      time: offsetIso(nowMs, -4 * 24 * 3600_000),
      summary: 'Exception in server tick loop',
      display_label: 'java.lang.OutOfMemoryError: Java heap space',
      exception: 'java.lang.OutOfMemoryError: Java heap space',
      exception_class: 'java.lang.OutOfMemoryError',
      oom_kind: 'heap',
      historical: false,
      category: 'host_resource',
      failure_kind: 'host_resource',
      plain_english: 'Java ran out of heap memory during play.',
      likely_cause: 'Out of memory',
      confidence: 'high',
      manual_review: false,
      fix_hints: [
        'Confirm the pack needs more heap before raising RAM — oversized packs and leaks look the same.',
        'Increase Java heap (-Xmx) only if the host still has free RAM; otherwise find leaks or shrink the pack.',
        'Check duplicate mods, oversized chunk loaders, or run Spark heap analysis.',
      ],
    },
    {
      file: 'crash-2026-06-17_22-18-11-server.txt',
      time: '2026-06-17T22:18:11+00:00',
      summary: 'Exception in server tick loop',
      display_label: 'java.lang.NullPointerException: Cannot invoke method on null object',
      exception: 'java.lang.NullPointerException: Cannot invoke "examplemod.TickHandler.onTick()" because "this.handler" is null',
      exception_class: 'java.lang.NullPointerException',
      historical: true,
      category: 'mod',
      failure_kind: 'mod_runtime',
      primary_mod_id: 'examplemod',
      suspect_mod_id: 'examplemod',
      mod_file: 'examplemod-1.0.0.jar',
      stack_frames: [
        'TRANSFORMER/examplemod@1.0.0/examplemod.ExampleMod.onServerTick',
      ],
      plain_english: 'The crash points to mod examplemod — check for updates, corrupt jars, or mixin conflicts.',
      likely_cause: 'Mod crash',
      confidence: 'medium',
      manual_review: false,
      fix_hints: [
        'Update or remove mod \'examplemod\' — check latest.log for dependency errors',
        'Re-download the mod JAR from the official source and replace it in mods/',
      ],
      mod_fix: {
        action: 'update',
        action_detail: 'Update examplemod to 1.0.1 or remove until pack maintainer fixes.',
        install_hint: 'Download from Modrinth/CurseForge matching NeoForge 1.21.1.',
      },
    },
  ];
  facts.optional.crash_rule_hits = [
    {
      rule_id: 'create-contraption-npe',
      pack_id: 'builtin',
      priority: 50200,
      matched_at: offsetIso(nowMs, -45 * 60_000),
      crash_file: 'crash-2026-06-22_14-33-07-server.txt',
      emit: {
        failure_kind: 'mod_runtime',
        primary_mod_id: 'create',
        confidence: 'high',
      },
    },
  ];
  facts.optional.suppressed_issues = [
    {
      id: 'CLIENT_ON_SERVER',
      message: 'Client-only mod detected on dedicated server (suppressed in preview).',
      severity: 'warning',
      suppressed: true,
    },
  ];
  facts.optional.active_suppressions = {
    conf_ids: ['CLIENT_ON_SERVER'],
    state: [],
    merged: [{ id: 'CLIENT_ON_SERVER', source: 'conf' }],
  };
  facts.optional.memory_diagnostics = {
    page_file_disabled: false,
    physical_mb: 32768,
    jvm_args: '-Xms4G -Xmx8G',
    heap_max_mb: 8192,
  };
  facts.optional.mod_forensics = {
    class_index_status: 'ready',
    class_index_built_at: offsetIso(nowMs, -90 * 60_000),
    class_index_jar_count: 48,
    class_index_entry_count: 18240,
    corrupt_jars: [
      {
        path: 'mods/pride-broken.jar',
        reason: 'zip_end_header',
        source: 'log',
        mod_id: 'pride',
      },
    ],
    stderr_sources: ['logs/stderr.log'],
    scan_config: {
      mod_forensics_scan: true,
      corrupt_jar_walk: false,
      index_on_report: false,
    },
  };
  facts.optional.config_health = [
    {
      path: 'world/serverconfig/create-server.toml',
      reason: 'parse_error',
      detail: 'Expected \'=\' after key at line 42',
    },
  ];
  facts.optional.connector_warnings = [
    {
      mod_id: 'connector',
      kind: 'connector_present',
      severity: 'info',
      boot_only: true,
      blocking: false,
      message: 'Sinytra Connector loaded — Fabric mods can be unstable.',
    },
  ];
  facts.optional.security_flags = [];
  // Enrich issues list with forensics / config findings (info severity — G-05 safe)
  const issueIds = new Set((facts.issues || []).map((i) => i.id));
  const extraIssues = [
    {
      id: 'CORRUPTED_MOD_JAR',
      message: 'Corrupt mod jar detected from logs: mods/pride-broken.jar (zip END header)',
      severity: 'warning',
    },
    {
      id: 'CONFIG_CORRUPT',
      message: 'Broken serverconfig: world/serverconfig/create-server.toml (parse_error)',
      severity: 'warning',
    },
  ];
  if (!Array.isArray(facts.issues)) facts.issues = [];
  for (const issue of extraIssues) {
    if (!issueIds.has(issue.id)) facts.issues.push(issue);
  }
  facts.optional.acknowledged_crashes = {
    'crash-2026-06-17_22-18-11-server.txt': '2026-06-18T06:00:00.000Z',
  };
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
// Forensics API fixtures for static preview (Mods Forensics tab + Find owning jar)
writeFileSync(join(dataDir, 'forensics-status.json'), `${JSON.stringify({
  index: {
    state: 'ready',
    built_at: offsetIso(now, -90 * 60_000),
    jar_count: 48,
    entry_count: 18240,
    stale: false,
  },
  config: {
    mod_forensics_scan: true,
    corrupt_jar_walk: false,
    index_on_report: false,
  },
  last_report_scan: {
    at: offsetIso(now, -2 * 3600_000),
    corrupt_jars: 1,
    config_issues: 1,
    stderr_merged: true,
  },
}, null, 2)}\n`);
writeFileSync(join(dataDir, 'forensics-find-class.json'), `${JSON.stringify({
  query: 'com/simibubi/create/content/contraptions/ContraptionCollision',
  matches: [
    {
      mod_id: 'create',
      jar: 'create-6.0.0.jar',
      class: 'com/simibubi/create/content/contraptions/ContraptionCollision',
      inner_path: 'com/simibubi/create/content/contraptions/ContraptionCollision.class',
      source: 'jar_entry_scan',
    },
    {
      mod_id: 'luckperms',
      jar: 'LuckPerms-NeoForge-5.4.jar',
      class: 'me/lucko/luckperms/common/plugin/AbstractLuckPermsPlugin',
      inner_path: 'me/lucko/luckperms/common/plugin/AbstractLuckPermsPlugin.class',
      source: 'jar_entry_scan',
    },
  ],
  truncated: false,
  index: { state: 'ready', jar_count: 48, entry_count: 18240 },
}, null, 2)}\n`);
writeFileSync(join(dataDir, 'forensics-config-health.json'), `${JSON.stringify({
  config_health: [
    {
      path: 'world/serverconfig/create-server.toml',
      reason: 'parse_error',
      detail: "Expected '=' after key at line 42",
    },
  ],
}, null, 2)}\n`);
writeReportsIndex(now);
writeCrashContextFixtures();
writeCrashReportFixtures();
copyFileSync(
  join(root, 'assets', 'watchtower-icon-simple.png'),
  join(dataDir, 'server-icon.png'),
);

if (mockIncident?.id) {
  const incidentsDir = join(dataDir, 'incidents');
  mkdirSync(incidentsDir, { recursive: true });
  writeFileSync(join(incidentsDir, `${mockIncident.id}.json`), `${JSON.stringify(mockIncident, null, 2)}\n`);
}

if (process.env.UPDATE_SHARED_FIXTURES === '1') {
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
}

console.log(`Wrote mock live fixtures (${samples.tps.length} points per series, ${performanceRollups.rows.length} rollup rows / 24h) to data/`);
console.log(`  + performance-rollups-7d.json (${performanceRollups7d.rows.length} rows)`);
console.log(`  + performance-rollups-30d.json (${performanceRollups30d.rows.length} rows, 5m step)`);
console.log(`  + performance-insights.json (7d overview poll)`);
console.log(`  + performance-insights-30d.json (30d overview poll)`);
console.log(`  + performance-dashboard.json (full Insights tab payload, 7d)`);
console.log(`  + performance-dashboard-30d.json (Insights tab payload, 30d)`);
console.log(`  + ops-cache.json (activity ledger, lag_issues, mod_log_errors, running_mods, mod_issues, world_pressure, join_clinic, right_now, log_stale, backups_live)`);
console.log(`  + overview-meta.json (scorecard, crash/lag/mod TLDR, right_now, log_stale_tldr)`);
console.log(`  + issues-peek.json`);
console.log(`  + facts.json (crash summaries, forensics, config health, CA parity kinds)`);
console.log(`  + forensics-status.json / forensics-find-class.json / forensics-config-health.json`);
console.log(`  + crash-contexts.json + crash-reports/*.txt`);
if (mockIncident?.id) console.log(`  + incidents/${mockIncident.id}.json`);

if (process.env.UPDATE_SHARED_FIXTURES === '1') {
  const sparkMocks = spawnSync(process.platform === 'win32' ? 'gradlew.bat' : './gradlew', [':watchtower-core:sparkAuditFixtures', '-q'], {
    cwd: join(root, '..', '..'),
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });
  if (sparkMocks.status !== 0) {
    console.warn('sparkAuditFixtures failed — using existing golden JSON if present');
  }
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

try {
  await import('./patch-alpha-fixtures.mjs');
} catch (e) {
  if (e?.code !== 'ERR_MODULE_NOT_FOUND') console.warn(e);
}

try {
  const { applyProfile } = await import('./apply-preview-profile.mjs');
  applyProfile(previewProfile, { now });
  console.log(`  PREVIEW_PROFILE=${previewProfile}`);
} catch (e) {
  console.error(`Could not apply PREVIEW_PROFILE=${previewProfile}:`, e.message || e);
  process.exitCode = 1;
}
