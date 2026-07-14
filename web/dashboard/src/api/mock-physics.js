/**
 * Coherent Minecraft-server mock physics for preview fixtures + live simulator.
 * Metrics are correlated: players → MSPT/TPS/CPU/net; heap sawtooth GC; rare lag events.
 */

export function clamp(v, min, max) {
  return Math.min(max, Math.max(min, v));
}

export function round1(v) {
  return Math.round(v * 10) / 10;
}

export function round2(v) {
  return Math.round(v * 100) / 100;
}

/** Rough Gaussian via Box–Muller. */
export function gauss(rng = Math.random) {
  let u = 0;
  let v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/**
 * Typical small-community SMP player curve (0=Sun … 6=Sat, hour UTC).
 * Peak evenings / weekends; near-empty weekday mornings.
 */
export function playerTarget(dow, hour) {
  const weekend = dow === 0 || dow === 6;
  const friday = dow === 5;

  if (hour >= 5 && hour <= 8) return 0.15 + (hour - 5) * 0.12;
  if (hour >= 9 && hour <= 11) return weekend ? 1.4 + (hour - 9) * 0.35 : 0.3 + (hour - 9) * 0.25;

  if (weekend) {
    if (hour >= 12 && hour <= 16) return 3.0 + (hour - 12) * 1.1 + (dow === 6 ? 1.3 : 0.5);
    if (hour >= 17 && hour <= 22) {
      if (hour === 20) return dow === 6 ? 10.0 : 8.5;
      if (hour === 21) return dow === 6 ? 9.2 : 7.4;
      if (hour === 19 || hour === 22) return dow === 6 ? 7.0 : 5.6;
      return dow === 6 ? 5.2 : 4.0;
    }
    if (hour >= 23 || hour <= 4) return hour <= 4 ? clamp(3.6 - hour * 0.5, 0.4, 4) : 3.2;
    return 1.3;
  }

  if (hour >= 17 && hour <= 22) {
    const base = friday ? 5.2 : 3.8;
    const peak = hour === 20 ? 3.0 : hour === 21 ? 2.4 : hour === 19 ? 1.5 : hour === 18 ? 0.8 : 0.4;
    return base + peak + (friday && hour >= 21 ? 0.7 : 0);
  }
  if (hour >= 12 && hour <= 14) return 0.9 + (hour === 13 ? 1.0 : 0);
  if (hour >= 23 || hour <= 4) {
    return friday ? clamp(2.6 - Math.min(hour, 4) * 0.3, 0.3, 3) : clamp(1.2 - (hour <= 4 ? hour : 0) * 0.15, 0.1, 2);
  }
  if (hour >= 13 && hour <= 16) return 0.5 + (hour - 13) * 0.15;
  return 0.15 + (hour % 3) * 0.06;
}

/**
 * Create mutable sim state. Pass `fromLatest` to continue from envelope latest.
 */
export function createSimState(fromLatest = null, nowMs = Date.now()) {
  const d = new Date(nowMs);
  const target = playerTarget(d.getUTCDay(), d.getUTCHours());
  const players = fromLatest?.players_online != null
    ? Math.round(fromLatest.players_online)
    : Math.round(clamp(target + gauss() * 0.6, 0, 12));

  return {
    players,
    heap: fromLatest?.heap_mb?.used ?? 5400,
    heapFloor: 4900,
    memAvail: fromLatest?.mem_available_gb ?? 13.5,
    diskPct: fromLatest?.disk_use_pct ?? 41.4,
    stickyMspt: 0,
    eventBoost: 0,
    eventTicksLeft: 0,
    saveCooldown: 8 + Math.floor(Math.random() * 20),
    joinBurst: 0,
    entities: fromLatest?.entities ?? 900,
    chunks: fromLatest?.chunks ?? 3200,
    thermalC: 52,
    ambientC: 29.5,
  };
}

/**
 * Advance one sample step. `stepSec` is the simulated interval (30 for live, 60 for rollups).
 * Returns metric snapshot for that timestamp.
 */
export function stepSim(state, tMs, stepSec = 30, rng = Math.random) {
  const d = new Date(tMs);
  const dow = d.getUTCDay();
  const hour = d.getUTCHours();
  const target = playerTarget(dow, hour);
  const stepsPerMin = 60 / stepSec;

  // ── Players: walk toward diurnal target with discrete joins/leaves ─────────
  const joinChance = 0.04 + Math.abs(target - state.players) * 0.03;
  if (rng() < joinChance / Math.max(1, stepsPerMin * 0.5)) {
    const toward = Math.sign(target - state.players);
    const delta = toward !== 0 ? toward : (rng() < 0.5 ? 1 : -1);
    const next = clamp(state.players + delta, 0, 12);
    if (next > state.players) state.joinBurst = Math.max(state.joinBurst, 3 + Math.floor(rng() * 4));
    state.players = next;
  }
  // Rare multi-join during peak
  if (target >= 6 && rng() < 0.008 / stepsPerMin && state.players < 11) {
    state.players = clamp(state.players + 1 + (rng() < 0.4 ? 1 : 0), 0, 12);
    state.joinBurst = 6;
  }

  // ── Lag events ─────────────────────────────────────────────────────────────
  if (state.eventTicksLeft > 0) {
    state.eventTicksLeft -= 1;
    state.eventBoost *= 0.72;
    if (state.eventTicksLeft === 0) state.eventBoost = 0;
  } else if (rng() < (0.01 + state.players * 0.002) / Math.max(1, stepsPerMin * 0.35)) {
    // Weighted event types
    const roll = rng();
    if (roll < 0.35) {
      // Chunk gen / teleport / nether travel
      state.eventBoost = 18 + rng() * 45;
      state.eventTicksLeft = 2 + Math.floor(rng() * 5);
    } else if (roll < 0.55) {
      // Farm / redstone pulse
      state.eventBoost = 12 + rng() * 28;
      state.eventTicksLeft = 1 + Math.floor(rng() * 3);
    } else if (roll < 0.7) {
      // Heavy command / fill
      state.eventBoost = 40 + rng() * 90;
      state.eventTicksLeft = 2 + Math.floor(rng() * 4);
    } else if (roll < 0.85 && state.players === 0) {
      // Idle sticky lag (chunk loaders / hoppers)
      state.stickyMspt = Math.max(state.stickyMspt, 35 + rng() * 40);
      state.eventBoost = 8;
      state.eventTicksLeft = 2;
    } else {
      // Brief hitch
      state.eventBoost = 8 + rng() * 20;
      state.eventTicksLeft = 1;
    }
  }

  // Sticky residual decays faster with players online (they "reset" loaders by exploring)
  if (state.stickyMspt > 0) {
    const decay = state.players > 0 ? 0.88 : 0.992;
    state.stickyMspt *= decay;
    if (state.stickyMspt < 4) state.stickyMspt = 0;
  }

  // World autosave every ~5–8 minutes
  state.saveCooldown -= 1;
  let saveIo = 0;
  if (state.saveCooldown <= 0) {
    saveIo = 35 + rng() * 90;
    state.saveCooldown = Math.round((5 + rng() * 3) * 60 / stepSec);
    state.eventBoost = Math.max(state.eventBoost, 6 + rng() * 10);
    state.eventTicksLeft = Math.max(state.eventTicksLeft, 1);
  }

  const p = state.players;

  // ── MSPT / TPS ─────────────────────────────────────────────────────────────
  // Idle base includes a few always-on farms; scales with players, super-linear above 6
  let baseMspt = 3.8 + p * 2.4;
  if (p >= 4) baseMspt += (p - 3) * 1.1;
  if (p >= 7) baseMspt += (p - 6) * 2.8;
  // Evening peak hostility / entity pressure
  if (hour >= 19 && hour <= 22) baseMspt += 1.2 + p * 0.35;

  const noise = gauss(rng) * (0.9 + p * 0.35);
  const mspt = clamp(
    baseMspt + noise + state.eventBoost + state.stickyMspt,
    2.0,
    200,
  );

  // Real servers: TPS ≈ min(20, 1000/mspt) when overloaded; otherwise hug 20 with tiny jitter
  let tps;
  if (mspt <= 50) {
    // Soft approach: mild dips before hard overload
    const soft = clamp(20 - Math.max(0, mspt - 40) * 0.15, 18.5, 20);
    tps = clamp(soft + gauss(rng) * 0.08, 18.2, 20);
  } else {
    tps = clamp(1000 / mspt + gauss(rng) * 0.2, 4, 19.9);
  }

  // ── Heap (sawtooth GC) ─────────────────────────────────────────────────────
  const allocPerStep = (14 + p * 5 + state.eventBoost * 0.35) * (stepSec / 30);
  state.heap += allocPerStep + Math.abs(gauss(rng)) * 8;
  const gcPressure = state.heap > 7000 || (state.heap > 6200 && rng() < 0.025)
    || (state.heap > 5800 && rng() < 0.008);
  if (gcPressure) {
    state.heapFloor = clamp(4700 + p * 90 + rng() * 180, 4500, 6100);
    state.heap = state.heapFloor + rng() * 220;
  }
  state.heap = clamp(state.heap, 3800, 8000);

  // ── Host CPU ───────────────────────────────────────────────────────────────
  const cpu = clamp(
    12 + p * 5.5 + (mspt - 4) * 0.65 + state.eventBoost * 0.35 + gauss(rng) * 3.5,
    6,
    99,
  );

  // ── Host RAM free (slow inverse of process pressure) ───────────────────────
  const rssPressure = state.heap / 8192 * 3.2 + p * 0.12;
  state.memAvail += ((15.8 - rssPressure) - state.memAvail) * 0.08 + gauss(rng) * 0.05;
  state.memAvail = clamp(state.memAvail, 5.5, 22);

  // ── Disk used % — slow monotonic creep, not a sine ─────────────────────────
  state.diskPct += (0.00008 + (saveIo > 0 ? 0.002 : 0) + (rng() < 0.002 ? 0.015 : 0)) * (stepSec / 30);
  state.diskPct = clamp(state.diskPct, 28, 92);

  // ── Entities / chunks ──────────────────────────────────────────────────────
  const entityTarget = 420 + p * 180 + (hour >= 19 ? 120 : 0) + state.eventBoost * 4;
  state.entities += (entityTarget - state.entities) * 0.12 + gauss(rng) * 20;
  state.entities = Math.round(clamp(state.entities, 200, 8000));
  const chunkTarget = 1800 + p * 420 + state.joinBurst * 80;
  state.chunks += (chunkTarget - state.chunks) * 0.1 + gauss(rng) * 15;
  state.chunks = Math.round(clamp(state.chunks, 800, 12000));

  // ── Network (Mbps) — scales with players; RX >> TX on vanilla/modded ───────
  const netBase = 0.4 + p * 1.8 + (state.joinBurst > 0 ? 4 : 0);
  const rx = round1(clamp(netBase + Math.abs(gauss(rng)) * (0.8 + p * 0.25) + state.eventBoost * 0.05, 0.05, 80));
  const tx = round1(clamp(netBase * 0.22 + Math.abs(gauss(rng)) * 0.35 + p * 0.15, 0.02, 35));

  // ── Disk I/O MB/s ──────────────────────────────────────────────────────────
  let read = 0.3 + Math.abs(gauss(rng)) * 0.8;
  let write = 0.2 + Math.abs(gauss(rng)) * 0.5;
  if (state.joinBurst > 0) {
    read += 12 + rng() * 40; // chunk load storm
    state.joinBurst -= 1;
  }
  if (saveIo > 0) {
    write += saveIo;
    read += 2 + rng() * 8;
  }
  if (state.eventBoost > 25) read += 5 + rng() * 20;
  read = round1(clamp(read, 0.05, 480));
  write = round1(clamp(write, 0.05, 320));

  // ── Thermal (package °C) — follows CPU with lag; ambient drifts slowly ─────
  const thermalTarget = 42 + cpu * 0.28 + (p > 6 ? 4 : 0);
  state.thermalC += (thermalTarget - state.thermalC) * 0.15 + gauss(rng) * 0.3;
  state.thermalC = clamp(state.thermalC, 38, 92);
  const ambientTarget = 27 + (state.thermalC - 50) * 0.08 + (hour >= 12 && hour <= 18 ? 1.5 : 0);
  state.ambientC += (ambientTarget - state.ambientC) * 0.06 + gauss(rng) * 0.12;
  state.ambientC = clamp(state.ambientC, 22, 42);

  return {
    players: state.players,
    tps: round2(tps),
    mspt: round1(mspt),
    host_cpu: round1(cpu),
    heap_mb: Math.round(state.heap),
    mem_available_gb: round2(state.memAvail),
    disk_use_pct: round2(state.diskPct),
    rx,
    tx,
    read,
    write,
    entities: state.entities,
    chunks: state.chunks,
    thermal_c: round1(state.thermalC),
    ambient_c: round1(state.ambientC),
  };
}

/** Build full aligned live series maps for `count` steps ending at `nowMs`. */
export function generateCorrelatedLiveSamples(nowMs, {
  count = 720,
  stepMs = 30_000,
} = {}) {
  const state = createSimState(null, nowMs - (count - 1) * stepMs);
  const series = {
    tps: [],
    mspt: [],
    host_cpu: [],
    heap_mb: [],
    mem_available_gb: [],
    disk_use_pct: [],
    players: [],
    thermal_package: [],
    thermal_ambient: [],
  };
  const bandwidth = [];
  const diskIo = [];
  const stepSec = stepMs / 1000;

  for (let i = count - 1; i >= 0; i -= 1) {
    const t = nowMs - i * stepMs;
    const m = stepSim(state, t, stepSec);
    const iso = new Date(t).toISOString();
    series.tps.push({ t: iso, v: m.tps });
    series.mspt.push({ t: iso, v: m.mspt });
    series.host_cpu.push({ t: iso, v: m.host_cpu });
    series.heap_mb.push({ t: iso, v: m.heap_mb });
    series.mem_available_gb.push({ t: iso, v: m.mem_available_gb });
    series.disk_use_pct.push({ t: iso, v: m.disk_use_pct });
    series.players.push({ t: iso, v: m.players });
    series.thermal_package.push({ t: iso, v: m.thermal_c });
    series.thermal_ambient.push({ t: iso, v: m.ambient_c });
    bandwidth.push({ t: iso, rx: m.rx, tx: m.tx });
    diskIo.push({ t: iso, read: m.read, write: m.write });
  }

  return { series, bandwidth, diskIo, state };
}
